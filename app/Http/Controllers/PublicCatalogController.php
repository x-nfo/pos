<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\CatalogOrder;
use App\Models\Category;
use App\Models\CustomerVoucher;
use App\Models\NewsletterSubscriber;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\PromoBanner;
use App\Models\Setting;
use App\Models\SizeChart;
use App\Models\Warehouse;
use App\Services\CatalogOrderService;
use App\Services\OperatingHoursService;
use App\Services\PricingService;
use App\Services\RajaOngkirService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class PublicCatalogController extends Controller
{
    public function __construct(
        private PricingService $pricingService,
        private OperatingHoursService $operatingHoursService,
        private CatalogOrderService $catalogOrderService,
        private RajaOngkirService $rajaOngkirService,
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
                    ->where(function ($sub) use ($branchId) {
                        $sub->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
                            ->orWhereHas('variants.warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
                    });
            })
            ->withCount(['products' => function ($q) use ($branchId) {
                $q->whereNull('deleted_at')
                    ->whereNull('parent_id')
                    ->where(function ($sub) use ($branchId) {
                        $sub->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
                            ->orWhereHas('variants.warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
                    });
            }])
            ->orderBy('name')
            ->get(['id', 'name', 'image']);

        // 4. Fetch products in this specific branch (including out-of-stock items)
        $productsQuery = Product::query()
            ->with([
                'category:id,name,size_chart_id',
                'category.sizeChart',
                'sizeChart',
                'units',
                'warehouses',
                'variants' => function ($v) {
                    $v->with(['warehouses']);
                },
            ])
            ->whereNull('parent_id')
            ->where(function ($q) use ($branchId) {
                $q->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
                    ->orWhereHas('variants.warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
            })
            ->when($categoryId && $categoryId !== 'all', function ($q) use ($categoryId) {
                $q->where('category_id', $categoryId);
            })
            ->when($search !== '', function ($q) use ($search) {
                $term = '%'.$search.'%';
                $q->where(function ($sub) use ($term) {
                    $sub->where('title', 'like', $term)
                        ->orWhere('description', 'like', $term)
                        ->orWhere('barcode', 'like', $term)
                        ->orWhere('sku', 'like', $term)
                        ->orWhereHas('variants', function ($vq) use ($term) {
                            $vq->where('title', 'like', $term)
                                ->orWhere('barcode', 'like', $term)
                                ->orWhere('sku', 'like', $term);
                        });
                });
            });

        // 4a. Apply extra filters (stock, price, colors) & sorting
        $sort = (string) $request->query('sort', 'title');
        $inStockOnly = $request->boolean('in_stock');
        $maxPrice = $request->query('max_price');
        $colorsParam = $request->query('colors');
        $colors = [];
        if (is_array($colorsParam)) {
            $colors = array_values(array_filter($colorsParam));
        } elseif (is_string($colorsParam) && trim($colorsParam) !== '') {
            $colors = array_values(array_filter(array_map('trim', explode(',', $colorsParam))));
        }

        $productsQuery->when($inStockOnly, function ($q) use ($branchId) {
            $q->where(function ($sub) use ($branchId) {
                $sub->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId)->where('product_warehouse.stock', '>', 0))
                    ->orWhereHas('variants.warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId)->where('product_warehouse.stock', '>', 0));
            });
        });

        $productsQuery->when($maxPrice && is_numeric($maxPrice) && (int) $maxPrice > 0, function ($q) use ($maxPrice) {
            $q->where('sell_price', '<=', (int) $maxPrice);
        });

        $productsQuery->when(! empty($colors), function ($q) use ($colors) {
            $q->whereHas('variants', function ($vq) use ($colors) {
                $vq->where(function ($sub) use ($colors) {
                    foreach ($colors as $color) {
                        $sub->orWhere('variant_attributes', 'like', '%"color_name":"'.$color.'"%')
                            ->orWhere('variant_attributes', 'like', '%"warna":"'.$color.'"%');
                    }
                });
            });
        });

        match ($sort) {
            'price-asc' => $productsQuery->orderBy('sell_price', 'asc')->orderBy('id', 'desc'),
            'price-desc' => $productsQuery->orderBy('sell_price', 'desc')->orderBy('id', 'desc'),
            'name-asc' => $productsQuery->orderBy('title', 'asc'),
            'newest' => $productsQuery->orderBy('id', 'desc'),
            default => $productsQuery->orderBy('title', 'asc'),
        };

        $perPage = (int) $request->query('per_page', 16);
        if ($perPage <= 0 || $perPage > 60) {
            $perPage = 16;
        }

        $paginated = $productsQuery->paginate($perPage)->withQueryString();
        $pricingBadges = $this->pricingService->previewProducts(collect($paginated->items()), null);

        $paginated->through(fn (Product $p) => $this->formatProduct($p, $branchId, $pricingBadges->get($p->id)));

        // 4b. Fetch available colors in this branch for the filter drawer
        $availableColors = Product::query()
            ->whereNotNull('parent_id')
            ->whereNotNull('variant_attributes')
            ->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
            ->get(['variant_attributes'])
            ->map(function ($p) {
                $attrs = is_array($p->variant_attributes) ? $p->variant_attributes : json_decode((string) $p->variant_attributes, true);
                if (! is_array($attrs)) {
                    return null;
                }
                $name = $attrs['color_name'] ?? $attrs['warna'] ?? null;
                $hex = $attrs['color_hex'] ?? $attrs['hex'] ?? null;

                return ($name && $hex) ? ['name' => $name, 'hex' => $hex] : null;
            })
            ->filter()
            ->unique('name')
            ->values()
            ->all();

        // 4c. Max price limit for slider
        $branchMaxPrice = (int) (Product::query()
            ->whereNull('parent_id')
            ->where(function ($q) use ($branchId) {
                $q->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
                    ->orWhereHas('variants.warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
            })
            ->max('sell_price') ?: 5000000);
        $maxPriceLimit = (int) ceil(max($branchMaxPrice, 100000) * 1.1);

        $globalDelivery = Setting::getBool('catalog_delivery_enabled', true);
        $globalPickup = Setting::getBool('catalog_pickup_enabled', true);
        $branchOperatingStatus = $this->operatingHoursService->getWarehouseStatus($activeBranch);

        // 5. Store branding & active branch contact
        $storeInfo = $this->getStoreInfo($activeBranch);

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

        // Fetch active bank accounts for transfer payment
        $bankAccounts = BankAccount::query()
            ->active()
            ->forWarehouse($branchId)
            ->ordered()
            ->get(['id', 'warehouse_id', 'bank_name', 'account_number', 'account_name', 'logo'])
            ->map(fn (BankAccount $b) => [
                'id' => $b->id,
                'warehouse_id' => $b->warehouse_id,
                'bank_name' => $b->bank_name,
                'account_number' => $b->account_number,
                'account_name' => $b->account_name,
                'logo_url' => $b->logo_url,
            ]);

        return Inertia::render('Public/Catalog', [
            'categories' => $categories,
            'products' => $paginated,
            'availableColors' => $availableColors,
            'maxPriceLimit' => $maxPriceLimit,
            'promoBanners' => $promoBanners,
            'staticBanner' => $staticBanner,
            'store' => $storeInfo,
            'branches' => $formattedBranches,
            'activeBranch' => $activeBranchData,
            'bankAccounts' => $bankAccounts,
            'availableCoupons' => $this->getPublicCoupons(),
            'sizeCharts' => SizeChart::where('is_active', true)->orderBy('name')->get(),
            'filters' => [
                'q' => $search,
                'category_id' => $categoryId ?? 'all',
                'cabang' => $activeBranch?->code,
                'sort' => $sort,
                'in_stock' => $inStockOnly,
                'max_price' => $maxPrice ? (int) $maxPrice : null,
                'colors' => $colors,
            ],
        ]);
    }

    /**
     * Show Karima-style editorial storefront homepage
     */
    public function home(Request $request): Response
    {
        $branchParam = $request->query('cabang');

        // 1. Fetch active branches
        $branches = Warehouse::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get();

        if ($branches->isEmpty()) {
            $defaultWh = Warehouse::defaultWarehouse();
            $branches = collect([$defaultWh]);
        }

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

        // 2. Fetch featured collections (categories with products count and luxury visuals)
        $featuredCollections = Category::query()
            ->whereHas('products', function ($q) use ($branchId) {
                $q->whereNull('deleted_at')
                    ->where(function ($sub) use ($branchId) {
                        $sub->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
                            ->orWhereHas('variants.warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
                    });
            })
            ->withCount(['products' => function ($q) use ($branchId) {
                $q->whereNull('deleted_at')
                    ->whereNull('parent_id')
                    ->where(function ($sub) use ($branchId) {
                        $sub->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
                            ->orWhereHas('variants.warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
                    });
            }])
            ->orderBy('name')
            ->limit(8)
            ->get(['id', 'name', 'image'])
            ->map(function ($cat, $index) {
                $defaultImages = [
                    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=800&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=800&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=800&auto=format&fit=crop',
                ];
                $imgUrl = null;
                if ($cat->image) {
                    $imgUrl = str_starts_with($cat->image, 'http') ? $cat->image : asset('storage/'.ltrim($cat->image, '/'));
                } else {
                    $imgUrl = $defaultImages[$index % count($defaultImages)];
                }

                return [
                    'id' => $cat->id,
                    'name' => $cat->name,
                    'slug' => str($cat->name)->slug(),
                    'image_url' => $imgUrl,
                    'products_count' => $cat->products_count,
                ];
            });

        // 3. Fetch "The Essentials" (Top 6 latest products)
        $featuredProductsQuery = Product::query()
            ->with([
                'category:id,name,size_chart_id',
                'category.sizeChart',
                'sizeChart',
                'units',
                'warehouses',
                'variants' => fn ($v) => $v->with(['warehouses']),
            ])
            ->whereNull('parent_id')
            ->where(function ($q) use ($branchId) {
                $q->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
                    ->orWhereHas('variants.warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
            })
            ->orderByDesc('id')
            ->limit(6)
            ->get();

        $pricingBadges = $this->pricingService->previewProducts($featuredProductsQuery, null);
        $featuredProducts = $featuredProductsQuery->map(
            fn (Product $p) => $this->formatProduct($p, $branchId, $pricingBadges->get($p->id))
        );

        // 4. Hero Banner resolution
        $customBanners = PromoBanner::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->get();

        $heroBanner = null;
        $activePromoBanners = [];

        if ($customBanners->isNotEmpty()) {
            $topBanner = $customBanners->first();
            $heroBanner = [
                'id' => $topBanner->id,
                'headline' => $topBanner->title ?: (Setting::get('store_tagline') ?: 'Kemewahan Dalam Kesederhanaan'),
                'subtitle' => $topBanner->subtitle ?: 'Koleksi Busana Muslimah & Busana Elegan Berkualitas Butik',
                'imageUrl' => $topBanner->image_url ?: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1920&auto=format&fit=crop',
                'mobileImageUrl' => $topBanner->image_url ?: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
                'ctaText' => 'Jelajahi Koleksi',
                'ctaLink' => route('catalog.index'),
            ];

            foreach ($customBanners->slice(1) as $banner) {
                $activePromoBanners[] = [
                    'id' => 'banner-'.$banner->id,
                    'title' => $banner->title ?: '',
                    'subtitle' => $banner->subtitle ?: '',
                    'imageUrl' => $banner->image_url,
                    'linkUrl' => $banner->link_url ?: route('catalog.index'),
                ];
            }
        } else {
            $heroBanner = [
                'id' => 'default-hero',
                'headline' => Setting::get('store_tagline') ?: 'Kemewahan Dalam Kesederhanaan',
                'subtitle' => 'Koleksi Busana Muslimah & Busana Elegan Berkualitas Butik',
                'imageUrl' => 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1920&auto=format&fit=crop',
                'mobileImageUrl' => 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
                'ctaText' => 'Jelajahi Koleksi',
                'ctaLink' => route('catalog.index'),
            ];
        }

        if (empty($activePromoBanners)) {
            $activePromoBanners[] = [
                'id' => 'promo-special',
                'title' => 'Edisi Terbatas & Penawaran Istimewa',
                'subtitle' => 'Dapatkan potongan harga eksklusif untuk pesanan pertama Anda melalui WhatsApp atau web kami.',
                'imageUrl' => 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1600&auto=format&fit=crop',
                'linkUrl' => route('catalog.index'),
            ];
        }

        $globalDelivery = Setting::getBool('catalog_delivery_enabled', true);
        $globalPickup = Setting::getBool('catalog_pickup_enabled', true);
        $branchOperatingStatus = $this->operatingHoursService->getWarehouseStatus($activeBranch);
        $storeInfo = $this->getStoreInfo($activeBranch);

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

        $bankAccounts = BankAccount::query()
            ->active()
            ->forWarehouse($branchId)
            ->ordered()
            ->get(['id', 'warehouse_id', 'bank_name', 'account_number', 'account_name', 'logo'])
            ->map(fn (BankAccount $b) => [
                'id' => $b->id,
                'warehouse_id' => $b->warehouse_id,
                'bank_name' => $b->bank_name,
                'account_number' => $b->account_number,
                'account_name' => $b->account_name,
                'logo_url' => $b->logo_url,
            ]);

        return Inertia::render('Public/Home', [
            'heroBanner' => $heroBanner,
            'featuredProducts' => $featuredProducts,
            'featuredCollections' => $featuredCollections,
            'activePromoBanners' => $activePromoBanners,
            'store' => $storeInfo,
            'branches' => $formattedBranches,
            'activeBranch' => $activeBranchData,
            'bankAccounts' => $bankAccounts,
            'availableCoupons' => $this->getPublicCoupons(),
            'sizeCharts' => SizeChart::where('is_active', true)->orderBy('name')->get(),
            'filters' => [
                'cabang' => $activeBranch?->code,
            ],
        ]);
    }

    /**
     * Handle newsletter subscription
     */
    public function subscribeNewsletter(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email:rfc,filter', 'max:150'],
        ], [
            'email.required' => 'Alamat email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
        ]);

        NewsletterSubscriber::updateOrCreate(
            ['email' => strtolower(trim($validated['email']))],
            ['is_active' => true, 'source' => 'storefront']
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Selamat datang di The Inner Circle. Terima kasih telah berlangganan!',
        ]);
    }

    /**
     * Show public product detail page
     */
    public function show(Request $request, string $id): Response
    {
        $branchParam = $request->query('cabang');

        $branches = Warehouse::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('code')
            ->get();

        if ($branches->isEmpty()) {
            $defaultWh = Warehouse::defaultWarehouse();
            $branches = collect([$defaultWh]);
        }

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

        $product = Product::query()
            ->with([
                'category:id,name,size_chart_id',
                'category.sizeChart',
                'sizeChart',
                'units',
                'warehouses',
                'variants' => function ($v) {
                    $v->with(['warehouses']);
                },
            ])
            ->where(function ($q) use ($id) {
                $q->where('id', $id)
                    ->orWhere('barcode', $id)
                    ->orWhere('sku', $id);
            })
            ->first();

        if (! $product) {
            abort(404, 'Produk tidak ditemukan');
        }

        $initialVariantId = null;
        if ($product->parent_id) {
            $initialVariantId = $product->id;
            $product = Product::query()
                ->with([
                    'category:id,name,size_chart_id',
                    'category.sizeChart',
                    'sizeChart',
                    'units',
                    'warehouses',
                    'variants' => function ($v) {
                        $v->with(['warehouses']);
                    },
                ])
                ->findOrFail($product->parent_id);
        }

        $formattedProduct = $this->formatProduct($product, $branchId);

        // Fetch related products in the same category or branch
        $relatedProducts = Product::query()
            ->with([
                'category:id,name,size_chart_id',
                'category.sizeChart',
                'sizeChart',
                'units',
                'warehouses',
                'variants' => function ($v) {
                    $v->with(['warehouses']);
                },
            ])
            ->whereNull('parent_id')
            ->where('id', '!=', $product->id)
            ->where(function ($q) use ($branchId) {
                $q->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId))
                    ->orWhereHas('variants.warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $branchId));
            })
            ->when($product->category_id, fn ($q) => $q->where('category_id', $product->category_id))
            ->limit(4)
            ->get()
            ->map(fn (Product $p) => $this->formatProduct($p, $branchId));

        $storeInfo = $this->getStoreInfo($activeBranch);
        $globalDelivery = Setting::getBool('catalog_delivery_enabled', true);
        $globalPickup = Setting::getBool('catalog_pickup_enabled', true);
        $branchOperatingStatus = $this->operatingHoursService->getWarehouseStatus($activeBranch);

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

        $bankAccounts = BankAccount::query()
            ->active()
            ->forWarehouse($branchId)
            ->ordered()
            ->get(['id', 'warehouse_id', 'bank_name', 'account_number', 'account_name', 'logo'])
            ->map(fn (BankAccount $b) => [
                'id' => $b->id,
                'warehouse_id' => $b->warehouse_id,
                'bank_name' => $b->bank_name,
                'account_number' => $b->account_number,
                'account_name' => $b->account_name,
                'logo_url' => $b->logo_url,
            ]);

        $categories = Category::query()
            ->whereHas('products')
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Public/ProductDetail', [
            'product' => $formattedProduct,
            'initialVariantId' => $initialVariantId,
            'relatedProducts' => $relatedProducts,
            'store' => $storeInfo,
            'branches' => $formattedBranches,
            'activeBranch' => $activeBranchData,
            'bankAccounts' => $bankAccounts,
            'availableCoupons' => $this->getPublicCoupons(),
            'categories' => $categories,
        ]);
    }

    /**
     * Format a product for public display
     */
    protected function formatProduct(Product $product, int $branchId, ?array $pricing = null): array
    {
        if ($pricing === null) {
            $pricingBadges = $this->pricingService->previewProducts(collect([$product]), null);
            $pricing = $pricingBadges->get($product->id, []);
        }

        $discountAmount = (int) ($pricing['discount_amount'] ?? 0);
        $finalPrice = (int) ($pricing['final_price'] ?? $product->sell_price);
        $originalPrice = (int) $product->sell_price;
        $hasDiscount = $discountAmount > 0 && $finalPrice < $originalPrice;
        $discountPercentage = $hasDiscount && $originalPrice > 0
            ? (int) round((($originalPrice - $finalPrice) / $originalPrice) * 100)
            : 0;

        $hasVariants = (bool) $product->has_variants;
        $variants = $product->variants->map(function ($v) use ($branchId, $hasDiscount, $discountPercentage) {
            $vStock = (int) ($v->warehouses->firstWhere('id', $branchId)?->pivot->stock ?? 0);
            $vOrigPrice = (int) $v->sell_price;
            $vFinalPrice = $vOrigPrice;
            if ($hasDiscount && $discountPercentage > 0) {
                $vFinalPrice = (int) round($vOrigPrice * (1 - ($discountPercentage / 100)));
            }

            return [
                'id' => $v->id,
                'parent_id' => $v->parent_id,
                'barcode' => $v->barcode,
                'sku' => $v->sku,
                'title' => $v->title,
                'sell_price' => $vOrigPrice,
                'final_price' => $vFinalPrice,
                'stock' => $vStock,
                'is_sold_out' => $vStock <= 0,
                'variant_attributes' => $v->variant_attributes,
                'image' => $v->image,
            ];
        })->values()->toArray();

        $branchStock = $hasVariants
            ? collect($variants)->sum('stock')
            : (int) ($product->warehouses->firstWhere('id', $branchId)?->pivot->stock ?? 0);

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

        $galleryImages = array_values(array_unique(array_filter([
            $product->image,
            ...$product->variants->pluck('image')->filter()->toArray(),
        ])));

        return [
            'id' => $product->id,
            'parent_id' => $product->parent_id,
            'has_variants' => $hasVariants,
            'variant_display_type' => $product->variant_display_type ?? 'color',
            'variant_attributes' => $product->variant_attributes,
            'variants' => $variants,
            'barcode' => $product->barcode,
            'sku' => $product->sku,
            'title' => $product->title,
            'description' => $product->description,
            'image' => $product->image,
            'gallery_images' => $galleryImages,
            'sell_price' => $originalPrice,
            'final_price' => $finalPrice,
            'discount_amount' => $discountAmount,
            'discount_percentage' => $discountPercentage,
            'has_discount' => $hasDiscount,
            'category_id' => $product->category_id,
            'category_name' => $product->category?->name,
            'size_chart' => $product->resolved_size_chart,
            'stock' => $branchStock,
            'units' => $units,
            'is_low_stock' => $product->min_stock > 0 && $branchStock <= $product->min_stock,
            'is_sold_out' => $branchStock <= 0,
        ];
    }

    /**
     * Get store information
     */
    protected function getStoreInfo(?Warehouse $activeBranch): array
    {
        $storeLogo = Setting::get('store_logo');
        if ($storeLogo && ! str_starts_with($storeLogo, 'http') && ! str_starts_with($storeLogo, '/storage')) {
            $storeLogo = asset('storage/'.ltrim($storeLogo, '/'));
        }

        $branchPhone = $activeBranch?->phone;
        $rawPhone = $branchPhone ?: Setting::get('store_phone', '');
        $cleanPhone = preg_replace('/[^0-9]/', '', $rawPhone);
        if (str_starts_with($cleanPhone, '0')) {
            $cleanPhone = '62'.substr($cleanPhone, 1);
        }

        $activeAddress = $activeBranch?->address ?: Setting::get('store_address', '');
        $globalDelivery = Setting::getBool('catalog_delivery_enabled', true);
        $globalPickup = Setting::getBool('catalog_pickup_enabled', true);

        $branchDelivery = $activeBranch ? ($activeBranch->catalog_delivery_enabled ?? true) : true;
        $branchPickup = $activeBranch ? ($activeBranch->catalog_pickup_enabled ?? true) : true;
        $branchOperatingStatus = $this->operatingHoursService->getWarehouseStatus($activeBranch);

        return [
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
            'rajaongkir_enabled' => $this->rajaOngkirService->isEnabled(),
            'branch_name' => $activeBranch?->name,
            'branch_code' => $activeBranch?->code,
            'operating_status' => $branchOperatingStatus,
        ];
    }

    /**
     * Search destinations for public catalog shipping calculation
     */
    public function searchDestinations(Request $request): JsonResponse
    {
        $search = trim(strip_tags((string) $request->query('search', '')));
        $limit = min(10, max(1, (int) $request->query('limit', 8)));

        if (mb_strlen($search) < 3) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $destinations = $this->rajaOngkirService->searchDestinations($search, $limit);

        return response()->json([
            'success' => true,
            'data' => $destinations,
        ]);
    }

    /**
     * Calculate shipping cost for public catalog
     */
    public function calculateShipping(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'destination_id' => ['required', 'integer', 'min:1'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'courier' => ['nullable', 'string', 'max:30', 'regex:/^[A-Za-z0-9\-_]+$/'],
        ]);

        $warehouse = Warehouse::find($validated['warehouse_id']);
        $originId = $warehouse?->rajaongkir_origin_id ?: $this->rajaOngkirService->getDefaultOriginId();

        if (! $originId) {
            return response()->json([
                'success' => false,
                'message' => 'Lokasi asal pengiriman toko belum dikonfigurasi.',
                'options' => [],
            ], 422);
        }

        // Calculate total weight
        $productIds = collect($validated['items'])->pluck('product_id')->unique();
        $products = Product::whereIn('id', $productIds)->get()->keyBy('id');
        $defaultWeight = $this->rajaOngkirService->getDefaultWeight();

        $totalWeight = 0;
        foreach ($validated['items'] as $item) {
            $product = $products->get($item['product_id']);
            $weight = ($product && (int) $product->weight > 0) ? (int) $product->weight : $defaultWeight;
            $totalWeight += ($weight * max(1, (int) $item['qty']));
        }
        $totalWeight = max(1, $totalWeight);

        $courier = $validated['courier'] ?? null;
        if ($courier && $courier !== 'all') {
            $rawOptions = $this->rajaOngkirService->calculateCost($originId, (int) $validated['destination_id'], $totalWeight, $courier);
            $options = [];
            foreach ($rawOptions as $opt) {
                $service = $opt['service'] ?? '';
                $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower("{$courier}-{$service}"));
                $options[] = [
                    'id' => trim((string) $slug, '-'),
                    'courier_code' => $courier,
                    'courier_name' => $opt['name'] ?? strtoupper($courier),
                    'service' => $service,
                    'description' => $opt['description'] ?? '',
                    'cost' => (int) ($opt['cost'] ?? 0),
                    'etd' => $opt['etd'] ?? '',
                ];
            }
        } else {
            $options = $this->rajaOngkirService->calculateAllCouriers($originId, (int) $validated['destination_id'], $totalWeight);
        }

        return response()->json([
            'success' => true,
            'origin_id' => $originId,
            'weight' => $totalWeight,
            'rates' => $options,
            'options' => $options,
        ]);
    }

    /**
     * Check and validate a discount coupon code
     */
    public function checkCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:30', 'regex:/^[A-Za-z0-9\-_]+$/'],
            'subtotal' => ['required', 'numeric', 'min:0'],
            'customer_phone' => ['nullable', 'string', 'min:8', 'max:25', 'regex:/^(\+62|62|0)[0-9\s\-()]{7,18}$/'],
            'customer_name' => ['nullable', 'string', 'max:100'],
        ], [
            'code.required' => 'Silakan masukkan kode kupon terlebih dahulu.',
            'code.regex' => 'Format kode kupon hanya boleh berupa huruf, angka, tanda hubung (-), atau garis bawah (_).',
            'customer_phone.regex' => 'Format nomor WhatsApp / telepon tidak valid.',
            'subtotal.required' => 'Subtotal belanja tidak valid.',
        ]);

        $rawCode = strtoupper(trim(strip_tags((string) $validated['code'])));
        $voucher = CustomerVoucher::where('code', $rawCode)
            ->orWhereRaw('UPPER(code) = ?', [$rawCode])
            ->first();

        if (! $voucher) {
            return response()->json([
                'valid' => false,
                'message' => 'Kode kupon "'.$rawCode.'" tidak ditemukan atau tidak valid.',
            ], 404);
        }

        if (! $voucher->is_active) {
            return response()->json([
                'valid' => false,
                'message' => 'Kupon ini sedang tidak aktif.',
            ], 422);
        }

        $now = now();
        if ($voucher->starts_at && $voucher->starts_at->isFuture()) {
            return response()->json([
                'valid' => false,
                'message' => 'Kupon baru dapat digunakan mulai '.$voucher->starts_at->translatedFormat('d M Y H:i').'.',
            ], 422);
        }

        if ($voucher->expires_at && $voucher->expires_at->isPast()) {
            return response()->json([
                'valid' => false,
                'message' => 'Kupon telah kedaluwarsa pada '.$voucher->expires_at->translatedFormat('d M Y H:i').'.',
            ], 422);
        }

        if ($voucher->usage_limit !== null && $voucher->times_used >= $voucher->usage_limit) {
            return response()->json([
                'valid' => false,
                'message' => 'Kuota pemakaian kupon ini telah habis.',
            ], 422);
        }

        if ($voucher->customer_id) {
            if ($voucher->is_used) {
                return response()->json([
                    'valid' => false,
                    'message' => 'Kupon ini sudah pernah digunakan.',
                ], 422);
            }

            $phone = trim((string) ($validated['customer_phone'] ?? ''));
            if (! empty($phone)) {
                $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
                $custPhone = preg_replace('/[^0-9]/', '', (string) $voucher->customer?->no_telp);
                $isMatch = ! empty($cleanPhone) && ! empty($custPhone) && (
                    str_ends_with($cleanPhone, substr($custPhone, -8)) ||
                    str_ends_with($custPhone, substr($cleanPhone, -8))
                );
                if (! $isMatch) {
                    return response()->json([
                        'valid' => false,
                        'message' => 'Kupon ini khusus untuk nomor pelanggan yang terdaftar ('.($voucher->customer?->name ?? 'Pelanggan Khusus').').',
                    ], 422);
                }
            }
        }

        $subtotal = (int) $validated['subtotal'];
        if ($voucher->minimum_order > 0 && $subtotal < (int) $voucher->minimum_order) {
            $shortage = (int) $voucher->minimum_order - $subtotal;

            return response()->json([
                'valid' => false,
                'message' => 'Minimal belanja untuk kupon ini adalah Rp '.number_format($voucher->minimum_order, 0, ',', '.').' (kurang Rp '.number_format($shortage, 0, ',', '.').').',
                'minimum_order' => (int) $voucher->minimum_order,
                'current_subtotal' => $subtotal,
            ], 422);
        }

        $discount = $voucher->calculateDiscount($subtotal);

        return response()->json([
            'valid' => true,
            'voucher' => [
                'id' => $voucher->id,
                'code' => $voucher->code,
                'name' => $voucher->name,
                'discount_type' => $voucher->discount_type,
                'discount_value' => (float) $voucher->discount_value,
                'max_discount' => $voucher->max_discount ? (int) $voucher->max_discount : null,
                'minimum_order' => (int) $voucher->minimum_order,
                'discount_amount' => $discount,
                'formatted_discount' => 'Rp '.number_format($discount, 0, ',', '.'),
            ],
            'discount_amount' => $discount,
            'subtotal' => $subtotal,
            'message' => 'Kupon '.$voucher->code.' berhasil diterapkan! Hemat Rp '.number_format($discount, 0, ',', '.'),
        ]);
    }

    /**
     * Get active public store coupons available to all customers
     */
    protected function getPublicCoupons(): array
    {
        return CustomerVoucher::query()
            ->whereNull('customer_id')
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>=', now());
            })
            ->where(function ($q) {
                $q->whereNull('usage_limit')->orWhereRaw('times_used < usage_limit');
            })
            ->orderBy('minimum_order')
            ->get(['id', 'code', 'name', 'discount_type', 'discount_value', 'minimum_order', 'max_discount', 'expires_at'])
            ->map(fn ($v) => [
                'id' => $v->id,
                'code' => $v->code,
                'name' => $v->name,
                'discount_type' => $v->discount_type,
                'discount_value' => (float) $v->discount_value,
                'minimum_order' => (int) $v->minimum_order,
                'max_discount' => $v->max_discount ? (int) $v->max_discount : null,
                'expires_at' => optional($v->expires_at)?->format('d M Y'),
            ])
            ->values()
            ->all();
    }

    /**
     * Submit an online order from the public catalog
     */
    public function checkout(Request $request): JsonResponse|RedirectResponse
    {
        if (is_string($request->input('items'))) {
            $decodedItems = json_decode($request->input('items'), true);
            if (is_array($decodedItems)) {
                $request->merge(['items' => $decodedItems]);
            }
        }

        $validated = $request->validate([
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'customer_name' => ['required', 'string', 'min:2', 'max:100', 'regex:/^[\pL\pN][\pL\pN\s\'\.\,\-]*$/u'],
            'customer_phone' => ['nullable', 'string', 'min:8', 'max:25', 'regex:/^(\+62|62|0)[0-9\s\-()]{7,18}$/'],
            'delivery_method' => ['required', 'string', 'in:pickup,delivery'],
            'delivery_address' => ['required_if:delivery_method,delivery', 'nullable', 'string', 'min:5', 'max:500'],
            'shipping_cost' => ['nullable', 'numeric', 'min:0'],
            'shipping_courier' => ['nullable', 'string', 'max:30', 'regex:/^[A-Za-z0-9\-\s]+$/'],
            'shipping_service' => ['nullable', 'string', 'max:50', 'regex:/^[A-Za-z0-9\-\s\/\+]+$/'],
            'shipping_etd' => ['nullable', 'string', 'max:30', 'regex:/^[A-Za-z0-9\-\s]+$/'],
            'shipping_weight' => ['nullable', 'numeric', 'min:0'],
            'shipping_destination_id' => ['nullable', 'integer'],
            'shipping_destination_label' => ['nullable', 'string', 'max:255'],
            'coupon_code' => ['nullable', 'string', 'max:30', 'regex:/^[A-Za-z0-9\-_]+$/'],
            'notes' => ['nullable', 'string', 'max:500'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'payment_proof' => ['nullable', 'file', 'mimes:jpeg,png,jpg,webp,pdf', 'max:5120'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.unit_id' => ['nullable', 'integer', 'exists:units,id'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ], [
            'warehouse_id.required' => 'Cabang toko harus dipilih.',
            'customer_name.required' => 'Nama pemesan wajib diisi.',
            'customer_name.min' => 'Nama pemesan minimal 2 karakter.',
            'customer_name.max' => 'Nama pemesan maksimal 100 karakter.',
            'customer_name.regex' => 'Nama pemesan hanya boleh berupa huruf, angka, spasi, titik, tanda hubung, atau tanda petik.',
            'customer_phone.min' => 'Nomor WhatsApp / telepon minimal 8 digit.',
            'customer_phone.max' => 'Nomor WhatsApp / telepon maksimal 25 karakter.',
            'customer_phone.regex' => 'Nomor WhatsApp / telepon tidak valid (contoh: 081234567890 atau +6281234567890).',
            'delivery_method.required' => 'Metode pengambilan pesanan harus dipilih.',
            'delivery_address.required_if' => 'Alamat pengiriman wajib diisi untuk opsi kirim ke alamat.',
            'delivery_address.min' => 'Alamat pengiriman minimal 5 karakter.',
            'delivery_address.max' => 'Alamat pengiriman maksimal 500 karakter.',
            'shipping_courier.regex' => 'Format kode kurir tidak valid.',
            'shipping_service.regex' => 'Format layanan kurir tidak valid.',
            'shipping_etd.regex' => 'Format estimasi pengiriman tidak valid.',
            'coupon_code.regex' => 'Kode kupon hanya boleh berupa huruf, angka, tanda hubung (-), atau garis bawah (_).',
            'payment_proof.mimes' => 'Bukti transfer harus berupa file gambar (JPG, PNG, atau WEBP) atau dokumen PDF.',
            'payment_proof.max' => 'Ukuran file bukti transfer maksimal 5 MB.',
            'items.required' => 'Keranjang belanja masih kosong.',
            'items.min' => 'Keranjang belanja minimal memuat 1 barang.',
        ]);

        // Sanitasi teks dari input publik untuk mencegah XSS & dirty characters
        $validated['customer_name'] = $this->sanitizePlainText($validated['customer_name']);
        if (! empty($validated['customer_phone'])) {
            $validated['customer_phone'] = $this->sanitizePlainText($validated['customer_phone']);
        }
        if (! empty($validated['delivery_address'])) {
            $validated['delivery_address'] = $this->sanitizePlainText($validated['delivery_address']);
        }
        if (! empty($validated['notes'])) {
            $validated['notes'] = $this->sanitizePlainText($validated['notes']);
        }
        if (! empty($validated['shipping_destination_label'])) {
            $validated['shipping_destination_label'] = $this->sanitizePlainText($validated['shipping_destination_label']);
        }
        if (! empty($validated['shipping_courier'])) {
            $validated['shipping_courier'] = $this->sanitizePlainText($validated['shipping_courier']);
        }
        if (! empty($validated['shipping_service'])) {
            $validated['shipping_service'] = $this->sanitizePlainText($validated['shipping_service']);
        }
        if (! empty($validated['shipping_etd'])) {
            $validated['shipping_etd'] = $this->sanitizePlainText($validated['shipping_etd']);
        }
        if (! empty($validated['coupon_code'])) {
            $validated['coupon_code'] = strtoupper((string) $this->sanitizePlainText($validated['coupon_code']));
        }
        if (! empty($validated['items'])) {
            foreach ($validated['items'] as $idx => $it) {
                if (isset($it['note'])) {
                    $validated['items'][$idx]['note'] = $this->sanitizePlainText($it['note']);
                }
            }
        }

        if ($request->hasFile('payment_proof')) {
            $disk = config('filesystems.payment_proof_disk', 'local');
            $folder = 'catalog-payment-proofs/'.now()->format('Y/m');
            $proofPath = $request->file('payment_proof')->store($folder, $disk);
            $validated['payment_proof'] = $proofPath;
            $validated['payment_proof_uploaded_at'] = now();
        }

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

        if ($validated['delivery_method'] === CatalogOrder::DELIVERY_PICKUP) {
            $globalPickup = Setting::getBool('catalog_pickup_enabled', true);
            $branchPickup = $warehouse->catalog_pickup_enabled ?? true;
            if (! $globalPickup || ! $branchPickup) {
                throw ValidationException::withMessages([
                    'delivery_method' => 'Layanan ambil di toko sedang dinonaktifkan untuk cabang ini.',
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
                    'coupon_code' => $order->coupon_code,
                    'discount_amount' => (int) $order->discount_amount,
                    'grand_total' => $order->grand_total,
                    'status' => $order->status,
                    'status_url' => route('catalog.order.status', $order->access_token),
                    'payment_method' => $order->payment_method,
                    'bank_account_id' => $order->bank_account_id,
                    'payment_proof' => $order->payment_proof,
                    'payment_proof_url' => $order->payment_proof_url,
                    'shipping_cost' => (int) $order->shipping_cost,
                    'shipping_courier' => $order->shipping_courier,
                    'shipping_service' => $order->shipping_service,
                    'shipping_etd' => $order->shipping_etd,
                    'shipping_weight' => (int) $order->shipping_weight,
                    'shipping_destination_id' => $order->shipping_destination_id,
                    'shipping_destination_label' => $order->shipping_destination_label,
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
        $order = CatalogOrder::with(['items.product', 'items.unit', 'warehouse', 'bankAccount'])
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

        $bankAccounts = BankAccount::query()
            ->active()
            ->forWarehouse($order->warehouse_id)
            ->ordered()
            ->get(['id', 'warehouse_id', 'bank_name', 'account_number', 'account_name', 'logo'])
            ->map(fn (BankAccount $b) => [
                'id' => $b->id,
                'warehouse_id' => $b->warehouse_id,
                'bank_name' => $b->bank_name,
                'account_number' => $b->account_number,
                'account_name' => $b->account_name,
                'logo_url' => $b->logo_url,
            ]);

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
                'payment_method' => $order->payment_method,
                'payment_proof' => $order->payment_proof,
                'payment_proof_url' => $order->payment_proof_url,
                'payment_proof_uploaded_at' => $order->payment_proof_uploaded_at?->toISOString(),
                'bank_account' => $order->bankAccount ? [
                    'id' => $order->bankAccount->id,
                    'bank_name' => $order->bankAccount->bank_name,
                    'account_number' => $order->bankAccount->account_number,
                    'account_name' => $order->bankAccount->account_name,
                    'logo_url' => $order->bankAccount->logo_url,
                ] : null,
                'subtotal' => $order->subtotal,
                'coupon_code' => $order->coupon_code,
                'discount_amount' => (int) $order->discount_amount,
                'shipping_cost' => $order->shipping_cost,
                'shipping_courier' => $order->shipping_courier,
                'shipping_service' => $order->shipping_service,
                'shipping_etd' => $order->shipping_etd,
                'shipping_weight' => $order->shipping_weight,
                'shipping_destination_label' => $order->shipping_destination_label,
                'shipping_tracking_number' => $order->shipping_tracking_number,
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
            'bankAccounts' => $bankAccounts,
        ]);
    }

    /**
     * Upload or update payment proof for an existing order
     */
    public function uploadPaymentProof(Request $request, string $accessToken): JsonResponse|RedirectResponse
    {
        $order = CatalogOrder::where('access_token', $accessToken)->firstOrFail();

        // Best practice e-commerce: Bukti transfer hanya boleh diunggah jika status pesanan masih SUBMITTED (menunggu konfirmasi)
        if ($order->status !== CatalogOrder::STATUS_SUBMITTED) {
            $errorMessage = 'Bukti transfer tidak dapat diubah karena pesanan sudah diproses atau dibatalkan.';
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $errorMessage,
                ], 422);
            }

            return redirect()->route('catalog.order.status', $order->access_token)->with('error', $errorMessage);
        }

        $validated = $request->validate([
            'payment_proof' => ['required', 'file', 'mimes:jpeg,png,jpg,webp,pdf', 'max:5120'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
        ], [
            'payment_proof.required' => 'File bukti transfer wajib diunggah.',
            'payment_proof.mimes' => 'Bukti transfer harus berupa file gambar (JPG, PNG, atau WEBP) atau dokumen PDF.',
            'payment_proof.max' => 'Ukuran file bukti transfer maksimal 5 MB.',
        ]);

        $disk = config('filesystems.payment_proof_disk', 'local');
        $folder = 'catalog-payment-proofs/'.now()->format('Y/m');
        $path = $request->file('payment_proof')->store($folder, $disk);
        $this->catalogOrderService->updatePaymentProof($order, $path, $validated['bank_account_id'] ?? null);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Bukti transfer berhasil diunggah!',
                'payment_proof_url' => route('catalog.order.payment-proof.show', $order->access_token),
                'payment_proof_is_pdf' => str_ends_with(strtolower($path), '.pdf'),
                'payment_proof_uploaded_at' => now()->toISOString(),
            ]);
        }

        return redirect()->route('catalog.order.status', $order->access_token)->with('success', 'Bukti transfer berhasil diperbarui!');
    }

    /**
     * Securely stream payment proof file with privacy headers (anti-indexing, no-cache, token-authorized)
     */
    public function showPaymentProof(string $accessToken): SymfonyResponse
    {
        $order = CatalogOrder::where('access_token', $accessToken)->firstOrFail();

        if (! $order->payment_proof) {
            abort(404, 'Bukti transfer belum diunggah untuk pesanan ini.');
        }

        $configuredDisk = config('filesystems.payment_proof_disk', 'local');
        $disk = null;

        if (Storage::disk($configuredDisk)->exists($order->payment_proof)) {
            $disk = $configuredDisk;
        } elseif (Storage::disk('local')->exists($order->payment_proof)) {
            $disk = 'local';
        } elseif (Storage::disk('public')->exists($order->payment_proof)) {
            $disk = 'public';
        }

        if (! $disk) {
            abort(404, 'File bukti transfer tidak ditemukan di penyimpanan server.');
        }

        $mimeType = Storage::disk($disk)->mimeType($order->payment_proof) ?: 'application/octet-stream';
        $extension = pathinfo($order->payment_proof, PATHINFO_EXTENSION) ?: 'jpg';
        $filename = 'bukti-transfer-'.$order->order_number.'.'.$extension;

        return Storage::disk($disk)->response($order->payment_proof, $filename, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-Robots-Tag' => 'noindex, nofollow',
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

    /**
     * Sanitize user text input by stripping tags, scripts, styles, control characters, and null bytes
     */
    protected function sanitizePlainText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        // Strip script, style, and iframe blocks completely including inner content
        $cleaned = preg_replace('#<script\b[^>]*>(.*?)</script>#is', '', $value);
        $cleaned = preg_replace('#<style\b[^>]*>(.*?)</style>#is', '', (string) $cleaned);
        $cleaned = preg_replace('#<iframe\b[^>]*>(.*?)</iframe>#is', '', (string) $cleaned);

        // Strip any remaining HTML tags
        $cleaned = strip_tags((string) $cleaned);

        // Normalize multiple spaces/newlines and strip null bytes
        $cleaned = str_replace("\0", '', (string) $cleaned);
        $cleaned = preg_replace("/[\r\n]{3,}/", "\n\n", (string) $cleaned);

        return trim((string) $cleaned);
    }
}
