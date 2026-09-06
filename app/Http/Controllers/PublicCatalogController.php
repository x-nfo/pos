<?php

namespace App\Http\Controllers;

use App\Models\CatalogOrder;
use App\Models\Category;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\PromoBanner;
use App\Models\Setting;
use App\Models\Warehouse;
use App\Services\CatalogOrderService;
use App\Services\OperatingHoursService;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PublicCatalogController extends Controller
{
    public function __construct(
        private PricingService $pricingService,
        private OperatingHoursService $operatingHoursService,
        private CatalogOrderService $catalogOrderService,
    ) {}

    public function index(Request $request): Response
    {
        $search = (string) $request->query('q', '');
        $categoryId = $request->query('category_id');
        $branchParam = $request->query('cabang');

        // 1. Fetch all active branches
        $branches = Warehouse::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get();

        if ($branches->isEmpty()) {
            $defaultWh = Warehouse::defaultWarehouse();
            $branches = collect([$defaultWh]);
        }

        // 2. Resolve active branch from parameter or default
        $activeBranch = null;
        if ($branchParam) {
            $activeBranch = $branches->first(function ($b) use ($branchParam) {
                return strcasecmp((string) $b->code, (string) $branchParam) === 0
                    || (string) $b->id === (string) $branchParam;
            });
        }

        if (! $activeBranch) {
            $defaultWh = Warehouse::defaultWarehouse();
            $activeBranch = $branches->firstWhere('id', $defaultWh->id) ?? $branches->first();
        }

        $branchId = $activeBranch?->id;

        // 3. Fetch categories that have products in this specific branch
        $categories = Category::query()
            ->whereHas('products', function ($q) use ($branchId) {
                $q->whereNull('deleted_at')
                    ->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
            })
            ->withCount(['products' => function ($q) use ($branchId) {
                $q->whereNull('deleted_at')
                    ->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
            }])
            ->orderBy('name')
            ->get(['id', 'name', 'image']);

        // 4. Fetch products in this specific branch (including out-of-stock items)
        $productsQuery = Product::query()
            ->with(['category:id,name', 'units', 'warehouses'])
            ->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
            ->when($categoryId && $categoryId !== 'all', function ($q) use ($categoryId) {
                $q->where('category_id', $categoryId);
            })
            ->when($search !== '', function ($q) use ($search) {
                $term = '%'.$search.'%';
                $q->where(function ($sub) use ($term) {
                    $sub->where('title', 'like', $term)
                        ->orWhere('description', 'like', $term)
                        ->orWhere('barcode', 'like', $term)
                        ->orWhere('sku', 'like', $term);
                });
            })
            ->orderBy('title');

        $products = $productsQuery->get();
        $pricingBadges = $this->pricingService->previewProducts($products, null);

        $formattedProducts = $products->map(function (Product $product) use ($pricingBadges, $branchId) {
            $pricing = $pricingBadges->get($product->id);
            $discountAmount = (int) ($pricing['discount_amount'] ?? 0);
            $finalPrice = (int) ($pricing['final_price'] ?? $product->sell_price);
            $originalPrice = (int) $product->sell_price;
            $hasDiscount = $discountAmount > 0 && $finalPrice < $originalPrice;
            $discountPercentage = $hasDiscount && $originalPrice > 0
                ? (int) round((($originalPrice - $finalPrice) / $originalPrice) * 100)
                : 0;

            $branchStock = (int) ($product->warehouses->firstWhere('id', $branchId)?->pivot->stock ?? 0);

            $units = $product->units->map(function ($u) use ($product, $hasDiscount, $discountPercentage, $originalPrice) {
                $isBase = (bool) ($u->pivot->is_base ?? false);
                $factor = (float) ($u->pivot->conversion_factor ?? 1);

                $unitSellPrice = $isBase
                    ? (int) $product->sell_price
                    : (int) (($u->pivot->sell_price && (int) $u->pivot->sell_price > 0) ? $u->pivot->sell_price : round($product->sell_price * $factor));

                $unitFinalPrice = $unitSellPrice;
                if ($hasDiscount && $originalPrice > 0 && $discountPercentage > 0) {
                    $unitFinalPrice = (int) round($unitSellPrice * (1 - ($discountPercentage / 100)));
                }

                return [
                    'id' => $u->id,
                    'code' => $u->code,
                    'name' => $u->name,
                    'symbol' => $u->symbol,
                    'is_base' => $isBase,
                    'conversion_factor' => $factor,
                    'sell_price' => $unitSellPrice,
                    'final_price' => $unitFinalPrice,
                ];
            })->values()->toArray();

            if (empty($units)) {
                $units = [
                    [
                        'id' => null,
                        'code' => 'PCS',
                        'name' => 'Pcs',
                        'symbol' => 'pcs',
                        'is_base' => true,
                        'conversion_factor' => 1.0,
                        'sell_price' => $originalPrice,
                        'final_price' => $finalPrice,
                    ],
                ];
            }

            return [
                'id' => $product->id,
                'barcode' => $product->barcode,
                'sku' => $product->sku,
                'title' => $product->title,
                'description' => $product->description,
                'image' => $product->image,
                'sell_price' => $originalPrice,
                'final_price' => $finalPrice,
                'discount_amount' => $discountAmount,
                'discount_percentage' => $discountPercentage,
                'has_discount' => $hasDiscount,
                'category_id' => $product->category_id,
                'category_name' => $product->category?->name,
                'stock' => $branchStock,
                'units' => $units,
                'is_low_stock' => $product->min_stock > 0 && $branchStock <= $product->min_stock,
                'is_sold_out' => $branchStock <= 0,
            ];
        });

        // 5. Store branding & active branch contact
        $storeLogo = Setting::get('store_logo');
        if ($storeLogo && ! str_starts_with($storeLogo, 'http') && ! str_starts_with($storeLogo, '/storage')) {
            $storeLogo = asset('storage/'.ltrim($storeLogo, '/'));
        }

        // Branch phone priority, fallback to general store phone
        $branchPhone = $activeBranch?->phone;
        $rawPhone = $branchPhone ?: Setting::get('store_phone', '');
        $cleanPhone = preg_replace('/[^0-9]/', '', $rawPhone);
        if (str_starts_with($cleanPhone, '0')) {
            $cleanPhone = '62'.substr($cleanPhone, 1);
        }

        $activeAddress = $activeBranch?->address ?: Setting::get('store_address', '');

        // Delivery & Pickup resolution per branch + global setting
        $globalDelivery = Setting::getBool('catalog_delivery_enabled', true);
        $globalPickup = Setting::getBool('catalog_pickup_enabled', true);

        $branchDelivery = $activeBranch ? ($activeBranch->catalog_delivery_enabled ?? true) : true;
        $branchPickup = $activeBranch ? ($activeBranch->catalog_pickup_enabled ?? true) : true;
        $branchOperatingStatus = $this->operatingHoursService->getWarehouseStatus($activeBranch);

        $storeInfo = [
            'name' => Setting::get('store_name', config('app.name', 'Toko Kami')),
            'tagline' => Setting::get('app_tagline', 'Katalog Produk & Pemesanan Cepat'),
            'logo' => $storeLogo,
            'phone' => $rawPhone,
            'wa_number' => $cleanPhone,
            'address' => $activeAddress,
            'city' => Setting::get('store_city', ''),
            'email' => Setting::get('store_email', ''),
            'delivery_enabled' => $globalDelivery && $branchDelivery,
            'pickup_enabled' => $globalPickup && $branchPickup,
            'branch_name' => $activeBranch?->name,
            'branch_code' => $activeBranch?->code,
            'operating_status' => $branchOperatingStatus,
        ];

        // Format branches list for the customer selector
        $formattedBranches = $branches->map(fn ($b) => [
            'id' => $b->id,
            'code' => $b->code,
            'name' => $b->name,
            'type' => $b->type,
            'address' => $b->address,
            'phone' => $b->phone,
            'delivery_enabled' => $globalDelivery && ($b->catalog_delivery_enabled ?? true),
            'pickup_enabled' => $globalPickup && ($b->catalog_pickup_enabled ?? true),
            'operating_status' => $this->operatingHoursService->getWarehouseStatus($b),
        ]);

        $activeBranchData = $activeBranch ? [
            'id' => $activeBranch->id,
            'code' => $activeBranch->code,
            'name' => $activeBranch->name,
            'type' => $activeBranch->type,
            'address' => $activeBranch->address,
            'phone' => $activeBranch->phone,
            'delivery_enabled' => $globalDelivery && ($activeBranch->catalog_delivery_enabled ?? true),
            'pickup_enabled' => $globalPickup && ($activeBranch->catalog_pickup_enabled ?? true),
            'operating_status' => $branchOperatingStatus,
        ] : null;

        // Collect promo banners
        $promoBanners = [];
        $isPromoEnabled = Setting::getBool('promo_banner_enabled', true);

        if ($isPromoEnabled) {
            // First check custom promo banners with uploaded images
            $customBanners = PromoBanner::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderByDesc('id')
                ->get();

            if ($customBanners->isNotEmpty()) {
                foreach ($customBanners as $banner) {
                    $promoBanners[] = [
                        'id' => 'banner-'.$banner->id,
                        'badge' => 'PROMO SPESIAL',
                        'title' => $banner->title ?: '',
                        'subtitle' => $banner->subtitle ?: '',
                        'image' => $banner->image,
                        'image_url' => $banner->image_url,
                        'link_url' => $banner->link_url,
                        'category_id' => $banner->category_id,
                        'action_text' => 'Lihat Promo',
                    ];
                }
            } else {
                // Fallback to dynamic pricing rules or custom title setting
                $activeRules = PricingRule::query()
                    ->where('is_active', true)
                    ->where(function ($q) {
                        $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
                    })
                    ->where(function ($q) {
                        $q->whereNull('ends_at')->orWhere('ends_at', '>=', now());
                    })
                    ->orderByDesc('priority')
                    ->limit(3)
                    ->get();

                $gradients = [
                    'from-rose-500 via-pink-600 to-indigo-700',
                    'from-amber-500 via-orange-600 to-rose-600',
                    'from-emerald-500 via-teal-600 to-cyan-700',
                ];

                foreach ($activeRules as $index => $rule) {
                    $discountLabel = 'PROMO SPESIAL';
                    if ($rule->discount_type === 'percentage') {
                        $discountLabel = 'DISKON '.(int) $rule->discount_value.'%';
                    } elseif ($rule->discount_type === 'fixed_amount') {
                        $discountLabel = 'HEMAT RP '.number_format((float) $rule->discount_value, 0, ',', '.');
                    } elseif ($rule->kind === 'buy_x_get_y') {
                        $discountLabel = 'BUY 1 GET 1';
                    }

                    $promoBanners[] = [
                        'id' => 'rule-'.$rule->id,
                        'badge' => $discountLabel,
                        'title' => $rule->name,
                        'subtitle' => $rule->notes ?: 'Dapatkan penawaran promo terbatas untuk produk pilihan kami sekarang juga!',
                        'action_text' => 'Lihat Promo',
                        'category_id' => $rule->category_id,
                        'gradient' => $gradients[$index % count($gradients)],
                    ];
                }

                $customTitle = Setting::get('promo_banner_title');
                $customSubtitle = Setting::get('promo_banner_subtitle');
                $customBadge = Setting::get('promo_banner_badge', 'PROMO SPESIAL');
                $customActionText = Setting::get('promo_banner_action_text', 'Belanja Sekarang');

                if (count($promoBanners) === 0 || ! empty($customTitle)) {
                    array_unshift($promoBanners, [
                        'id' => 'custom-main-banner',
                        'badge' => $customBadge ?: 'PROMO SPESIAL',
                        'title' => $customTitle ?: 'Pesan Mudah Langsung via WhatsApp',
                        'subtitle' => $customSubtitle ?: 'Pilih produk kebutuhan Anda dan kirim pesanan dalam hitungan detik!',
                        'action_text' => $customActionText ?: 'Belanja Sekarang',
                        'category_id' => null,
                        'gradient' => 'from-indigo-600 via-primary-600 to-sky-600',
                    ]);
                }
            }
        }

        // Collect static secondary promo banner (Alfagift Style - below slider)
        $staticBanner = null;
        $isStaticEnabled = Setting::getBool('static_banner_enabled', true);
        $staticTitle = Setting::get('static_banner_title', Setting::get('promo_banner_title', ''));
        $staticImage = Setting::get('static_banner_image', '');

        if ($isStaticEnabled && (! empty($staticTitle) || ! empty($staticImage))) {
            $staticBanner = [
                'badge' => Setting::get('static_banner_badge', Setting::get('promo_banner_badge', 'PROMO SPESIAL')),
                'title' => $staticTitle,
                'subtitle' => Setting::get('static_banner_subtitle', Setting::get('promo_banner_subtitle', '')),
                'action_text' => Setting::get('static_banner_action_text', Setting::get('promo_banner_action_text', 'Belanja Sekarang')),
                'link_url' => Setting::get('static_banner_link_url', ''),
                'image' => $staticImage,
                'image_url' => $staticImage ? asset('storage/'.$staticImage) : null,
                'gradient' => 'from-indigo-600 via-primary-600 to-sky-600',
            ];
        }

        return Inertia::render('Public/Catalog', [
            'categories' => $categories,
            'products' => $formattedProducts,
            'promoBanners' => $promoBanners,
            'staticBanner' => $staticBanner,
            'store' => $storeInfo,
            'branches' => $formattedBranches,
            'activeBranch' => $activeBranchData,
            'filters' => [
                'q' => $search,
                'category_id' => $categoryId ?? 'all',
                'cabang' => $activeBranch?->code,
            ],
        ]);
    }

    /**
     * Submit an online order from the public catalog
     */
    public function checkout(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'customer_name' => ['required', 'string', 'max:100'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'delivery_method' => ['required', 'string', 'in:pickup,delivery'],
            'delivery_address' => ['required_if:delivery_method,delivery', 'nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.unit_id' => ['nullable', 'integer', 'exists:units,id'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ], [
            'warehouse_id.required' => 'Cabang toko harus dipilih.',
            'customer_name.required' => 'Nama pemesan wajib diisi.',
            'delivery_method.required' => 'Metode pengambilan pesanan harus dipilih.',
            'delivery_address.required_if' => 'Alamat pengiriman wajib diisi untuk opsi kirim ke alamat.',
            'items.required' => 'Keranjang belanja masih kosong.',
            'items.min' => 'Keranjang belanja minimal memuat 1 barang.',
        ]);

        $warehouse = Warehouse::findOrFail($validated['warehouse_id']);
        $opStatus = $this->operatingHoursService->getWarehouseStatus($warehouse);

        if (! ($opStatus['is_open'] ?? true)) {
            throw ValidationException::withMessages([
                'store' => 'Maaf, toko sedang tutup ('.($opStatus['badge_text'] ?? 'Tutup').'). Pemesanan online belum dapat diproses.',
            ]);
        }

        if ($validated['delivery_method'] === CatalogOrder::DELIVERY_SHIPPING) {
            $globalDelivery = Setting::getBool('catalog_delivery_enabled', true);
            $branchDelivery = $warehouse->catalog_delivery_enabled ?? true;
            if (! $globalDelivery || ! $branchDelivery) {
                throw ValidationException::withMessages([
                    'delivery_method' => 'Layanan pengiriman ke alamat sedang dinonaktifkan untuk cabang ini.',
                ]);
            }

            if (empty(trim($validated['delivery_address'] ?? ''))) {
                throw ValidationException::withMessages([
                    'delivery_address' => 'Alamat pengiriman wajib diisi untuk opsi kirim ke alamat.',
                ]);
            }
        }

        $order = $this->catalogOrderService->createOrder($validated);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Pesanan Anda berhasil dibuat!',
                'order' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'access_token' => $order->access_token,
                    'subtotal' => $order->subtotal,
                    'grand_total' => $order->grand_total,
                    'status' => $order->status,
                    'status_url' => route('catalog.order.status', $order->access_token),
                ],
            ]);
        }

        return redirect()->route('catalog.order.status', $order->access_token);
    }

    /**
     * Display the public order tracking page
     */
    public function orderStatus(string $accessToken): Response
    {
        $order = CatalogOrder::with(['items.product', 'items.unit', 'warehouse'])
            ->where('access_token', $accessToken)
            ->firstOrFail();

        $storeLogo = Setting::get('store_logo');
        if ($storeLogo && ! str_starts_with($storeLogo, 'http') && ! str_starts_with($storeLogo, '/storage')) {
            $storeLogo = asset('storage/'.ltrim($storeLogo, '/'));
        }

        $branchPhone = $order->warehouse?->phone;
        $rawPhone = $branchPhone ?: Setting::get('store_phone', '');
        $cleanPhone = preg_replace('/[^0-9]/', '', $rawPhone);
        if (str_starts_with($cleanPhone, '0')) {
            $cleanPhone = '62'.substr($cleanPhone, 1);
        }

        $storeInfo = [
            'name' => Setting::get('store_name', config('app.name', 'Toko Kami')),
            'logo' => $storeLogo,
            'phone' => $rawPhone,
            'wa_number' => $cleanPhone,
            'address' => $order->warehouse?->address ?: Setting::get('store_address', ''),
        ];

        return Inertia::render('Public/CatalogOrderStatus', [
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'access_token' => $order->access_token,
                'status' => $order->status,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'delivery_method' => $order->delivery_method,
                'delivery_address' => $order->delivery_address,
                'notes' => $order->notes,
                'subtotal' => $order->subtotal,
                'shipping_cost' => $order->shipping_cost,
                'grand_total' => $order->grand_total,
                'cancellation_reason' => $order->cancellation_reason,
                'created_at' => $order->created_at?->toISOString(),
                'confirmed_at' => $order->confirmed_at?->toISOString(),
                'completed_at' => $order->completed_at?->toISOString(),
                'cancelled_at' => $order->cancelled_at?->toISOString(),
                'warehouse' => [
                    'id' => $order->warehouse?->id,
                    'name' => $order->warehouse?->name,
                    'address' => $order->warehouse?->address,
                    'phone' => $order->warehouse?->phone,
                ],
                'items' => $order->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_title' => $item->product_title,
                    'qty' => $item->qty,
                    'price' => $item->price,
                    'subtotal' => $item->subtotal,
                    'note' => $item->note,
                    'image' => $item->product?->image,
                    'unit' => $item->unit ? [
                        'id' => $item->unit->id,
                        'name' => $item->unit->name,
                        'code' => $item->unit->code,
                        'symbol' => $item->unit->symbol,
                    ] : null,
                ]),
            ],
            'store' => $storeInfo,
        ]);
    }

    /**
     * Polling endpoint for real-time status checks
     */
    public function orderStatusCheck(string $accessToken): JsonResponse
    {
        $order = CatalogOrder::where('access_token', $accessToken)
            ->firstOrFail(['id', 'order_number', 'status', 'cancellation_reason', 'confirmed_at', 'completed_at', 'cancelled_at', 'updated_at']);

        $statusLabel = match ($order->status) {
            CatalogOrder::STATUS_SUBMITTED => 'Menunggu Konfirmasi',
            CatalogOrder::STATUS_CONFIRMED => 'Dikonfirmasi Toko',
            CatalogOrder::STATUS_PROCESSING => 'Sedang Disiapkan',
            CatalogOrder::STATUS_READY => 'Siap Diambil / Sedang Dikirim',
            CatalogOrder::STATUS_COMPLETED => 'Selesai',
            CatalogOrder::STATUS_CANCELLED => 'Dibatalkan',
            default => $order->status,
        };

        return response()->json([
            'success' => true,
            'status' => $order->status,
            'status_label' => $statusLabel,
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status,
                'status_label' => $statusLabel,
                'cancellation_reason' => $order->cancellation_reason,
                'confirmed_at' => $order->confirmed_at?->toISOString(),
                'completed_at' => $order->completed_at?->toISOString(),
                'cancelled_at' => $order->cancelled_at?->toISOString(),
                'updated_at' => $order->updated_at?->toISOString(),
            ],
        ]);
    }
}
