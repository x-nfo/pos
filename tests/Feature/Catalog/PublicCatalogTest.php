<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\PromoBanner;
use App\Models\Setting;
use App\Models\User;
use App\Models\Warehouse;
use Carbon\Carbon;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->warehouse = Warehouse::create([
            'name' => 'Gudang Utama',
            'code' => 'GDG01',
            'is_active' => true,
            'is_default' => true,
        ]);
    }

    public function test_public_catalog_page_can_be_rendered(): void
    {
        $category = Category::create([
            'name' => 'Kopi & Teh',
            'description' => 'Aneka Minuman Hangat & Dingin',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'barcode' => 'PROD-001',
            'title' => 'Kopi Susu Gula Aren',
            'description' => 'Kopi espresso dengan susu segar dan gula aren asli',
            'buy_price' => 8000,
            'sell_price' => 18000,
            'stock' => 25,
            'tax_rate' => 0,
        ]);

        $response = $this->get(route('catalog.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->has('products', 1)
            ->has('categories', 1)
            ->where('products.0.title', 'Kopi Susu Gula Aren')
            ->where('products.0.final_price', 18000)
            ->has('store')
        );
    }

    public function test_public_catalog_filters_by_category(): void
    {
        $category1 = Category::create(['name' => 'Makanan', 'description' => 'Makanan']);
        $category2 = Category::create(['name' => 'Minuman', 'description' => 'Minuman']);

        Product::create([
            'category_id' => $category1->id,
            'barcode' => 'PROD-MAK',
            'title' => 'Roti Bakar',
            'description' => 'Roti bakar coklat',
            'buy_price' => 5000,
            'sell_price' => 15000,
            'stock' => 10,
            'tax_rate' => 0,
        ]);

        Product::create([
            'category_id' => $category2->id,
            'barcode' => 'PROD-MIN',
            'title' => 'Es Teh Manis',
            'description' => 'Es teh segar',
            'buy_price' => 2000,
            'sell_price' => 5000,
            'stock' => 30,
            'tax_rate' => 0,
        ]);

        $response = $this->get(route('catalog.index', ['category_id' => $category2->id]));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->has('products', 1)
            ->where('products.0.title', 'Es Teh Manis')
        );
    }

    public function test_public_catalog_searches_by_title_or_code(): void
    {
        $category = Category::create(['name' => 'Umum', 'description' => 'Umum']);

        Product::create([
            'category_id' => $category->id,
            'barcode' => 'BRC-111',
            'sku' => 'SKU-KOPI',
            'title' => 'Kopi Arabika Gayo',
            'description' => 'Biji kopi pilihan',
            'buy_price' => 40000,
            'sell_price' => 75000,
            'stock' => 15,
            'tax_rate' => 0,
        ]);

        Product::create([
            'category_id' => $category->id,
            'barcode' => 'BRC-222',
            'sku' => 'SKU-TEH',
            'title' => 'Teh Hijau Melati',
            'description' => 'Daun teh harum',
            'buy_price' => 15000,
            'sell_price' => 30000,
            'stock' => 20,
            'tax_rate' => 0,
        ]);

        $response = $this->get(route('catalog.index', ['q' => 'Arabika']));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->has('products', 1)
            ->where('products.0.title', 'Kopi Arabika Gayo')
        );
    }

    public function test_public_catalog_displays_products_with_zero_stock_as_sold_out(): void
    {
        $category = Category::create(['name' => 'Snack', 'description' => 'Snack']);

        Product::create([
            'category_id' => $category->id,
            'barcode' => 'PROD-OUT-OF-STOCK',
            'title' => 'Keripik Singkong (Habis)',
            'description' => 'Keripik renyah',
            'buy_price' => 5000,
            'sell_price' => 10000,
            'stock' => 0,
            'tax_rate' => 0,
        ]);

        $response = $this->get(route('catalog.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->has('products', 1)
            ->where('products.0.title', 'Keripik Singkong (Habis)')
            ->where('products.0.stock', 0)
            ->where('products.0.is_sold_out', true)
        );
    }

    public function test_root_url_renders_catalog_when_landing_page_mode_is_storefront(): void
    {
        Setting::set('landing_page_mode', 'storefront');

        $response = $this->get('/');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
        );
    }

    public function test_branding_setting_can_be_updated_to_storefront(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class, UserSeeder::class]);
        $admin = User::role('super-admin')->first();
        $admin->markEmailAsVerified();

        $payload = [
            'app_name' => 'Warung Digital',
            'app_tagline' => 'Toko Kelontong Modern',
            'theme_primary_color' => '#059669',
            'theme_accent_color' => '#10b981',
            'landing_page_mode' => 'storefront',
        ];

        $response = $this->actingAs($admin)->post(route('settings.branding.update'), $payload);

        $response->assertSessionHasNoErrors();
        $this->assertSame('storefront', Setting::get('landing_page_mode'));
    }

    public function test_public_catalog_provides_promo_banners_from_settings_and_pricing_rules(): void
    {
        PricingRule::create([
            'name' => 'Diskon Kilat Akhir Pekan',
            'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
            'is_active' => true,
            'priority' => 10,
            'target_type' => PricingRule::TARGET_ALL,
            'customer_scope' => PricingRule::SCOPE_ALL,
            'discount_type' => PricingRule::TYPE_PERCENTAGE,
            'discount_value' => 20,
            'notes' => 'Diskon 20% untuk semua pelanggan',
        ]);

        Setting::set('promo_banner_enabled', '1');
        Setting::set('promo_banner_badge', 'FLASH SALE');
        Setting::set('promo_banner_title', 'Promo Kemerdekaan Toko Kami');

        $response = $this->get(route('catalog.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->has('promoBanners', 2)
            ->where('promoBanners.0.title', 'Promo Kemerdekaan Toko Kami')
            ->where('promoBanners.0.badge', 'FLASH SALE')
            ->where('promoBanners.1.title', 'Diskon Kilat Akhir Pekan')
            ->where('promoBanners.1.badge', 'DISKON 20%')
        );
    }

    public function test_public_catalog_returns_empty_promo_banners_when_disabled(): void
    {
        Setting::set('promo_banner_enabled', '0');

        PricingRule::create([
            'name' => 'Promo Diskon',
            'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
            'is_active' => true,
            'priority' => 1,
            'target_type' => PricingRule::TARGET_ALL,
            'customer_scope' => PricingRule::SCOPE_ALL,
            'discount_type' => PricingRule::TYPE_PERCENTAGE,
            'discount_value' => 10,
        ]);

        $response = $this->get(route('catalog.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->has('promoBanners', 0)
        );
    }

    public function test_public_catalog_reflects_delivery_enabled_and_disabled_setting(): void
    {
        // Default is enabled
        $response = $this->get(route('catalog.index'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->where('store.delivery_enabled', true)
        );

        // Disabled by admin
        Setting::set('catalog_delivery_enabled', '0');

        $responseDisabled = $this->get(route('catalog.index'));
        $responseDisabled->assertOk();
        $responseDisabled->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->where('store.delivery_enabled', false)
        );
    }

    public function test_store_profile_setting_can_toggle_delivery_option(): void
    {
        $this->seed([PermissionSeeder::class, RoleSeeder::class, UserSeeder::class]);
        $admin = User::role('super-admin')->first();
        $admin->markEmailAsVerified();

        // Update delivery option to false
        $response = $this->actingAs($admin)->post(route('settings.store.update'), [
            'store_name' => 'Warung Pojok',
            'store_address' => 'Jl. Merak No. 10',
            'catalog_delivery_enabled' => false,
            'catalog_pickup_enabled' => true,
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertFalse(Setting::getBool('catalog_delivery_enabled'));
        $this->assertTrue(Setting::getBool('catalog_pickup_enabled'));

        // Update delivery option back to true
        $response2 = $this->actingAs($admin)->post(route('settings.store.update'), [
            'store_name' => 'Warung Pojok',
            'store_address' => 'Jl. Merak No. 10',
            'catalog_delivery_enabled' => true,
            'catalog_pickup_enabled' => true,
        ]);

        $response2->assertSessionHasNoErrors();
        $this->assertTrue(Setting::getBool('catalog_delivery_enabled'));
    }

    public function test_public_catalog_supports_multi_branch_selection_and_stock_isolation(): void
    {
        $branch1 = Warehouse::create([
            'name' => 'Cabang Tebet',
            'code' => 'TBT-01',
            'phone' => '081234567890',
            'address' => 'Jl. Tebet Raya No. 10',
            'is_active' => true,
            'is_default' => true,
        ]);

        $branch2 = Warehouse::create([
            'name' => 'Cabang Kemang',
            'code' => 'KMG-02',
            'phone' => '089876543210',
            'address' => 'Jl. Kemang Selatan No. 20',
            'is_active' => true,
            'is_default' => false,
        ]);

        $category = Category::create(['name' => 'Kopi', 'description' => 'Minuman']);

        $productA = Product::create([
            'category_id' => $category->id,
            'barcode' => 'PROD-A',
            'title' => 'Espresso Tebet Exclusive',
            'buy_price' => 10000,
            'sell_price' => 20000,
            'tax_rate' => 0,
        ]);

        $productB = Product::create([
            'category_id' => $category->id,
            'barcode' => 'PROD-B',
            'title' => 'Cold Brew Kemang Exclusive',
            'buy_price' => 12000,
            'sell_price' => 25000,
            'tax_rate' => 0,
        ]);

        // Branch 1 has Product A (stock 12) and Product B (stock 0)
        // Branch 2 has Product A (stock 0) and Product B (stock 18)
        $productA->warehouses()->syncWithoutDetaching([
            $branch1->id => ['stock' => 12],
            $branch2->id => ['stock' => 0],
        ]);
        $productB->warehouses()->syncWithoutDetaching([
            $branch1->id => ['stock' => 0],
            $branch2->id => ['stock' => 18],
        ]);

        // Request Catalog for Branch 1
        $response1 = $this->get(route('catalog.index', ['cabang' => 'TBT-01']));
        $response1->assertOk();
        $response1->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->where('activeBranch.code', 'TBT-01')
            ->where('activeBranch.name', 'Cabang Tebet')
            ->where('store.phone', '081234567890')
            ->where('store.wa_number', '6281234567890')
            ->where('store.address', 'Jl. Tebet Raya No. 10')
            ->where('store.branch_name', 'Cabang Tebet')
            ->has('products', 2)
            ->where('products.0.title', 'Cold Brew Kemang Exclusive')
            ->where('products.0.stock', 0)
            ->where('products.0.is_sold_out', true)
            ->where('products.1.title', 'Espresso Tebet Exclusive')
            ->where('products.1.stock', 12)
            ->where('products.1.is_sold_out', false)
        );

        // Request Catalog for Branch 2
        $response2 = $this->get(route('catalog.index', ['cabang' => 'KMG-02']));
        $response2->assertOk();
        $response2->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->where('activeBranch.code', 'KMG-02')
            ->where('activeBranch.name', 'Cabang Kemang')
            ->where('store.phone', '089876543210')
            ->where('store.wa_number', '6289876543210')
            ->where('store.address', 'Jl. Kemang Selatan No. 20')
            ->where('store.branch_name', 'Cabang Kemang')
            ->has('products', 2)
            ->where('products.0.title', 'Cold Brew Kemang Exclusive')
            ->where('products.0.stock', 18)
            ->where('products.0.is_sold_out', false)
            ->where('products.1.title', 'Espresso Tebet Exclusive')
            ->where('products.1.stock', 0)
            ->where('products.1.is_sold_out', true)
        );
    }

    public function test_public_catalog_honors_branch_level_delivery_settings(): void
    {
        $branchDeliveryOn = Warehouse::create([
            'name' => 'Cabang Delivery On',
            'code' => 'DELIV-ON',
            'is_active' => true,
            'catalog_delivery_enabled' => true,
            'catalog_pickup_enabled' => true,
        ]);

        $branchDeliveryOff = Warehouse::create([
            'name' => 'Cabang Pickup Only',
            'code' => 'PICKUP-ONLY',
            'is_active' => true,
            'catalog_delivery_enabled' => false,
            'catalog_pickup_enabled' => true,
        ]);

        // When global delivery is enabled
        Setting::set('catalog_delivery_enabled', '1');

        $resOn = $this->get(route('catalog.index', ['cabang' => 'DELIV-ON']));
        $resOn->assertOk();
        $resOn->assertInertia(fn (Assert $page) => $page
            ->where('store.delivery_enabled', true)
        );

        $resOff = $this->get(route('catalog.index', ['cabang' => 'PICKUP-ONLY']));
        $resOff->assertOk();
        $resOff->assertInertia(fn (Assert $page) => $page
            ->where('store.delivery_enabled', false)
        );

        // When global delivery is disabled, even branch with delivery enabled becomes false
        Setting::set('catalog_delivery_enabled', '0');

        $resGlobalOff = $this->get(route('catalog.index', ['cabang' => 'DELIV-ON']));
        $resGlobalOff->assertOk();
        $resGlobalOff->assertInertia(fn (Assert $page) => $page
            ->where('store.delivery_enabled', false)
        );
    }

    public function test_public_catalog_displays_custom_uploaded_promo_banners(): void
    {
        $category = Category::create(['name' => 'Kopi']);

        PromoBanner::create([
            'title' => 'Promo Alfagift Style 1',
            'subtitle' => 'Diskon 20% Kopi Pilihan',
            'image' => 'banners/banner1.jpg',
            'category_id' => $category->id,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        PromoBanner::create([
            'title' => 'Promo Alfagift Style 2',
            'subtitle' => 'Promo Gantung Gajian',
            'image' => 'banners/banner2.jpg',
            'link_url' => 'https://wa.me/628123456789',
            'is_active' => true,
            'sort_order' => 2,
        ]);

        PromoBanner::create([
            'title' => 'Promo Nonaktif',
            'image' => 'banners/banner3.jpg',
            'is_active' => false,
        ]);

        $response = $this->get(route('catalog.index'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/Catalog')
            ->has('promoBanners', 2)
            ->where('promoBanners.0.title', 'Promo Alfagift Style 1')
            ->where('promoBanners.0.category_id', $category->id)
            ->where('promoBanners.1.title', 'Promo Alfagift Style 2')
            ->where('promoBanners.1.link_url', 'https://wa.me/628123456789')
        );
    }

    public function test_public_catalog_returns_dynamic_operating_status_for_active_branch(): void
    {
        $branch24h = Warehouse::create([
            'name' => 'Cabang 24 Jam',
            'code' => 'CBG-24H',
            'is_active' => true,
            'is_24_hours' => true,
        ]);

        $res24h = $this->get(route('catalog.index', ['cabang' => 'CBG-24H']));
        $res24h->assertOk();
        $res24h->assertInertia(fn (Assert $page) => $page
            ->where('store.operating_status.is_open', true)
            ->where('store.operating_status.status', 'open')
            ->where('store.operating_status.badge_text', 'Buka 24 Jam')
        );

        $branchHours = Warehouse::create([
            'name' => 'Cabang Jam Kerja',
            'code' => 'CBG-HOURS',
            'is_active' => true,
            'is_24_hours' => false,
            'open_time' => '08:00',
            'close_time' => '20:00',
            'operating_days' => [1, 2, 3, 4, 5], // Mon-Fri
        ]);

        // Mock time during open hours on Monday (2026-09-07 is Monday)
        Carbon::setTestNow(Carbon::parse('2026-09-07 10:00:00'));

        $resOpen = $this->get(route('catalog.index', ['cabang' => 'CBG-HOURS']));
        $resOpen->assertOk();
        $resOpen->assertInertia(fn (Assert $page) => $page
            ->where('store.operating_status.is_open', true)
            ->where('store.operating_status.status', 'open')
            ->where('store.operating_status.badge_text', 'Buka · Tutup 20:00')
        );

        // Mock time before open hours on Monday at 07:00
        Carbon::setTestNow(Carbon::parse('2026-09-07 07:00:00'));

        $resBeforeOpen = $this->get(route('catalog.index', ['cabang' => 'CBG-HOURS']));
        $resBeforeOpen->assertOk();
        $resBeforeOpen->assertInertia(fn (Assert $page) => $page
            ->where('store.operating_status.is_open', false)
            ->where('store.operating_status.status', 'closed')
            ->where('store.operating_status.badge_text', 'Tutup · Buka 08:00')
        );

        // Mock time outside open hours on Monday at 21:00 (after close)
        Carbon::setTestNow(Carbon::parse('2026-09-07 21:00:00'));

        $resClosed = $this->get(route('catalog.index', ['cabang' => 'CBG-HOURS']));
        $resClosed->assertOk();
        $resClosed->assertInertia(fn (Assert $page) => $page
            ->where('store.operating_status.is_open', false)
            ->where('store.operating_status.status', 'closed')
            ->where('store.operating_status.badge_text', 'Tutup · Buka Besok 08:00')
        );

        // Mock Sunday (2026-09-13), not in operating days
        Carbon::setTestNow(Carbon::parse('2026-09-13 10:00:00'));

        $resSunday = $this->get(route('catalog.index', ['cabang' => 'CBG-HOURS']));
        $resSunday->assertOk();
        $resSunday->assertInertia(fn (Assert $page) => $page
            ->where('store.operating_status.is_open', false)
            ->where('store.operating_status.status', 'closed')
        );

        Carbon::setTestNow(); // reset
    }

    public function test_public_catalog_supports_temporary_closure_with_reason_and_reopen_date(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-07 10:00:00'));

        $branchHoliday = Warehouse::create([
            'name' => 'Cabang Libur Idul Fitri',
            'code' => 'CBG-IDULFITRI',
            'is_active' => true,
            'is_24_hours' => true,
            'is_temporarily_closed' => true,
            'closure_reason' => 'Libur Hari Raya Idul Fitri',
            'reopen_date' => '2026-09-15',
        ]);

        $response = $this->get(route('catalog.index', ['cabang' => 'CBG-IDULFITRI']));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('store.operating_status.is_open', false)
            ->where('store.operating_status.status', 'temporarily_closed')
            ->where('store.operating_status.badge_text', 'Tutup Sementara · Libur Hari Raya Idul Fitri')
            ->where('store.operating_status.closure_reason', 'Libur Hari Raya Idul Fitri')
            ->where('store.operating_status.reopen_date_formatted', '15 Sep 2026')
        );

        Carbon::setTestNow();
    }

    public function test_public_catalog_auto_reopens_if_reopen_date_has_passed(): void
    {
        $branchHoliday = Warehouse::create([
            'name' => 'Cabang Libur Singkat',
            'code' => 'CBG-LIBUR',
            'is_active' => true,
            'is_24_hours' => true,
            'is_temporarily_closed' => true,
            'closure_reason' => 'Renovasi Interior',
            'reopen_date' => '2026-09-10',
        ]);

        // After reopen_date (2026-09-11), it should automatically be open (since is_24_hours = true)
        Carbon::setTestNow(Carbon::parse('2026-09-11 10:00:00'));

        $response = $this->get(route('catalog.index', ['cabang' => 'CBG-LIBUR']));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('store.operating_status.is_open', true)
            ->where('store.operating_status.status', 'open')
            ->where('store.operating_status.badge_text', 'Buka 24 Jam')
        );

        Carbon::setTestNow();
    }

    public function test_public_catalog_displays_static_secondary_banner(): void
    {
        Setting::set('static_banner_enabled', '1');
        Setting::set('static_banner_badge', 'SPECIAL DEALS');
        Setting::set('static_banner_title', 'Promo Belanja Hemat Akhir Pekan');
        Setting::set('static_banner_subtitle', 'Beli 2 gratis 1 untuk semua varian kopi');
        Setting::set('static_banner_action_text', 'Klaim Sekarang');

        $response = $this->get(route('catalog.index'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->has('staticBanner')
            ->where('staticBanner.badge', 'SPECIAL DEALS')
            ->where('staticBanner.title', 'Promo Belanja Hemat Akhir Pekan')
            ->where('staticBanner.action_text', 'Klaim Sekarang')
        );
    }

    public function test_public_catalog_hides_static_banner_when_disabled(): void
    {
        Setting::set('static_banner_enabled', '0');
        Setting::set('static_banner_title', 'Promo Belanja Hemat Akhir Pekan');

        $response = $this->get(route('catalog.index'));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('staticBanner', null)
        );
    }
}
