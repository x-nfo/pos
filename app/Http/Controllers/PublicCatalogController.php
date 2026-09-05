<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\PromoBanner;
use App\Models\Setting;
use App\Models\Warehouse;
use App\Services\OperatingHoursService;
use App\Services\PricingService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PublicCatalogController extends Controller
{
    public function __construct(
        private PricingService $pricingService,
        private OperatingHoursService $operatingHoursService,
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
}
