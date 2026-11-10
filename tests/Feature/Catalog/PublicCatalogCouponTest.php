<?php

namespace Tests\Feature\Catalog;

use App\Models\CatalogOrder;
use App\Models\Category;
use App\Models\CustomerVoucher;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCatalogCouponTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouse;

    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->warehouse = Warehouse::create([
            'name' => 'Cabang Karima Pusat',
            'code' => 'KRM01',
            'is_active' => true,
            'is_default' => true,
            'catalog_delivery_enabled' => true,
            'catalog_pickup_enabled' => true,
            'open_time' => '00:00',
            'close_time' => '23:59',
        ]);

        $category = Category::create(['name' => 'Gamis & Abaya']);

        $this->product = Product::create([
            'category_id' => $category->id,
            'barcode' => 'KRM-ABAYA-01',
            'title' => 'Abaya Silk Karima',
            'buy_price' => 100000,
            'sell_price' => 150000,
            'stock' => 50,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::updateOrCreate([
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
        ], [
            'stock' => 50,
        ]);
    }

    public function test_check_coupon_success_for_fixed_amount_coupon(): void
    {
        CustomerVoucher::create([
            'code' => 'HEMAT25',
            'name' => 'Voucher Potongan 25 Ribu',
            'discount_type' => CustomerVoucher::TYPE_FIXED_AMOUNT,
            'discount_value' => 25000,
            'minimum_order' => 100000,
            'is_active' => true,
        ]);

        // Test with lowercase code to ensure case-insensitivity
        $response = $this->postJson(route('catalog.coupon.check'), [
            'code' => 'hemat25',
            'subtotal' => 150000,
        ]);

        $response->assertOk();
        $response->assertJsonPath('valid', true);
        $response->assertJsonPath('discount_amount', 25000);
        $response->assertJsonPath('voucher.code', 'HEMAT25');
        $this->assertStringContainsString('25.000', $response->json('message'));
    }

    public function test_check_coupon_success_for_percentage_coupon_with_max_discount_cap(): void
    {
        CustomerVoucher::create([
            'code' => 'DISKON20',
            'name' => 'Diskon 20% Maks 25 Ribu',
            'discount_type' => CustomerVoucher::TYPE_PERCENTAGE,
            'discount_value' => 20,
            'max_discount' => 25000,
            'minimum_order' => 50000,
            'is_active' => true,
        ]);

        // Subtotal 200.000 -> 20% is 40.000, but capped at 25.000
        $response = $this->postJson(route('catalog.coupon.check'), [
            'code' => 'DISKON20',
            'subtotal' => 200000,
        ]);

        $response->assertOk();
        $response->assertJsonPath('valid', true);
        $response->assertJsonPath('discount_amount', 25000);
    }

    public function test_check_coupon_fails_when_coupon_not_found(): void
    {
        $response = $this->postJson(route('catalog.coupon.check'), [
            'code' => 'TIDAKADA',
            'subtotal' => 100000,
        ]);

        $response->assertStatus(404);
        $response->assertJsonPath('valid', false);
        $this->assertStringContainsString('tidak ditemukan', $response->json('message'));
    }

    public function test_check_coupon_fails_when_coupon_inactive(): void
    {
        CustomerVoucher::create([
            'code' => 'NONAKTIF',
            'name' => 'Kupon Nonaktif',
            'discount_type' => CustomerVoucher::TYPE_FIXED_AMOUNT,
            'discount_value' => 10000,
            'is_active' => false,
        ]);

        $response = $this->postJson(route('catalog.coupon.check'), [
            'code' => 'NONAKTIF',
            'subtotal' => 100000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('valid', false);
        $this->assertStringContainsString('tidak aktif', $response->json('message'));
    }

    public function test_check_coupon_fails_when_coupon_expired(): void
    {
        CustomerVoucher::create([
            'code' => 'KADALUWARSA',
            'name' => 'Kupon Kadaluwarsa',
            'discount_type' => CustomerVoucher::TYPE_FIXED_AMOUNT,
            'discount_value' => 10000,
            'is_active' => true,
            'expires_at' => now()->subDay(),
        ]);

        $response = $this->postJson(route('catalog.coupon.check'), [
            'code' => 'KADALUWARSA',
            'subtotal' => 100000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('valid', false);
        $this->assertStringContainsString('kedaluwarsa', $response->json('message'));
    }

    public function test_check_coupon_fails_when_minimum_order_not_met(): void
    {
        CustomerVoucher::create([
            'code' => 'MINORDER',
            'name' => 'Kupon Min Belanja 100 Ribu',
            'discount_type' => CustomerVoucher::TYPE_FIXED_AMOUNT,
            'discount_value' => 10000,
            'minimum_order' => 100000,
            'is_active' => true,
        ]);

        $response = $this->postJson(route('catalog.coupon.check'), [
            'code' => 'MINORDER',
            'subtotal' => 50000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('valid', false);
        $this->assertStringContainsString('Minimal belanja', $response->json('message'));
    }

    public function test_check_coupon_fails_when_usage_quota_is_exhausted(): void
    {
        CustomerVoucher::create([
            'code' => 'HABIS',
            'name' => 'Kupon Kuota Habis',
            'discount_type' => CustomerVoucher::TYPE_FIXED_AMOUNT,
            'discount_value' => 10000,
            'usage_limit' => 5,
            'times_used' => 5,
            'is_active' => true,
        ]);

        $response = $this->postJson(route('catalog.coupon.check'), [
            'code' => 'HABIS',
            'subtotal' => 100000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('valid', false);
        $this->assertStringContainsString('Kuota pemakaian', $response->json('message'));
    }

    public function test_customer_can_checkout_with_coupon_and_deduct_grand_total(): void
    {
        $voucher = CustomerVoucher::create([
            'code' => 'KARIMA20',
            'name' => 'Diskon Karima 20 Ribu',
            'discount_type' => CustomerVoucher::TYPE_FIXED_AMOUNT,
            'discount_value' => 20000,
            'minimum_order' => 100000,
            'usage_limit' => 10,
            'times_used' => 0,
            'is_active' => true,
        ]);

        $payload = [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Siti Aisyah',
            'customer_phone' => '081234567890',
            'delivery_method' => 'pickup',
            'coupon_code' => 'KARIMA20',
            'items' => [
                [
                    'product_id' => $this->product->id, // price 150000
                    'qty' => 1,
                ],
            ],
        ];

        $response = $this->postJson(route('catalog.checkout'), $payload);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        // Subtotal: 150.000, Discount: 20.000, Grand Total: 130.000
        $response->assertJsonPath('order.subtotal', 150000);
        $response->assertJsonPath('order.discount_amount', 20000);
        $response->assertJsonPath('order.coupon_code', 'KARIMA20');
        $response->assertJsonPath('order.grand_total', 130000);

        $this->assertDatabaseHas('catalog_orders', [
            'customer_name' => 'Siti Aisyah',
            'coupon_code' => 'KARIMA20',
            'discount_amount' => 20000,
            'grand_total' => 130000,
            'customer_voucher_id' => $voucher->id,
        ]);

        // Verify times_used is incremented
        $this->assertEquals(1, $voucher->fresh()->times_used);
    }

    public function test_cancelling_catalog_order_restores_coupon_usage(): void
    {
        $admin = User::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $admin->assignRole('super-admin');

        $voucher = CustomerVoucher::create([
            'code' => 'RESTORE10',
            'name' => 'Kupon Restore',
            'discount_type' => CustomerVoucher::TYPE_FIXED_AMOUNT,
            'discount_value' => 10000,
            'minimum_order' => 50000,
            'usage_limit' => 10,
            'times_used' => 0,
            'is_active' => true,
        ]);

        $payload = [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Ahmad',
            'customer_phone' => '081299887766',
            'delivery_method' => 'pickup',
            'coupon_code' => 'RESTORE10',
            'items' => [
                ['product_id' => $this->product->id, 'qty' => 1],
            ],
        ];

        $res = $this->postJson(route('catalog.checkout'), $payload);
        $orderId = $res->json('order.id');

        $this->assertEquals(1, $voucher->fresh()->times_used);

        $order = CatalogOrder::find($orderId);

        // Cancel order as staff
        $this->actingAs($admin)->post(route('catalog-orders.cancel', $order->id), [
            'reason' => 'Pelanggan salah pesan warna',
        ]);

        // times_used must be decremented back to 0
        $this->assertEquals(0, $voucher->fresh()->times_used);
    }

    public function test_public_coupons_are_returned_in_catalog_props(): void
    {
        CustomerVoucher::create([
            'customer_id' => null, // public coupon
            'code' => 'PROMOBARU',
            'name' => 'Promo Pengguna Baru 10%',
            'discount_type' => CustomerVoucher::TYPE_PERCENTAGE,
            'discount_value' => 10,
            'minimum_order' => 50000,
            'is_active' => true,
        ]);

        $response = $this->get(route('catalog.index'));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Public/Catalog')
            ->has('availableCoupons')
            ->where('availableCoupons.0.code', 'PROMOBARU')
        );
    }
}
