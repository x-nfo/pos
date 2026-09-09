<?php

namespace Tests\Feature\Catalog;

use App\Models\CashierShift;
use App\Models\CatalogOrder;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\ProductWarehouse;
use App\Models\Transaction;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CatalogOrderTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouse;

    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->warehouse = Warehouse::create([
            'name' => 'Cabang Utama',
            'code' => 'CBG01',
            'is_active' => true,
            'is_default' => true,
            'catalog_delivery_enabled' => true,
            'catalog_pickup_enabled' => true,
            // Always open during tests — prevents time-dependent flakiness
            'open_time' => '00:00',
            'close_time' => '23:59',
        ]);

        $category = Category::create([
            'name' => 'Minuman',
        ]);

        $this->product = Product::create([
            'category_id' => $category->id,
            'barcode' => 'PROD-100',
            'title' => 'Es Teh Manis',
            'buy_price' => 2000,
            'sell_price' => 5000,
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

    public function test_customer_can_submit_catalog_order(): void
    {
        $payload = [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'delivery_method' => 'pickup',
            'notes' => 'Tolong sedotan jangan lupa',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'qty' => 2,
                ],
            ],
        ];

        $response = $this->postJson(route('catalog.checkout'), $payload);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'success',
            'order' => ['id', 'order_number', 'access_token', 'grand_total', 'status_url'],
        ]);

        $this->assertDatabaseHas('catalog_orders', [
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'delivery_method' => 'pickup',
            'status' => CatalogOrder::STATUS_SUBMITTED,
            'subtotal' => 10000,
            'grand_total' => 10000,
        ]);

        $this->assertDatabaseHas('catalog_order_items', [
            'product_id' => $this->product->id,
            'qty' => 2,
            'price' => 5000,
            'subtotal' => 10000,
        ]);
    }

    public function test_cannot_order_with_empty_cart(): void
    {
        $payload = [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Budi Santoso',
            'delivery_method' => 'pickup',
            'items' => [],
        ];

        $response = $this->postJson(route('catalog.checkout'), $payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items']);
    }

    public function test_cannot_order_delivery_without_address(): void
    {
        $payload = [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Budi Santoso',
            'delivery_method' => 'delivery',
            'delivery_address' => '',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'qty' => 1,
                ],
            ],
        ];

        $response = $this->postJson(route('catalog.checkout'), $payload);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['delivery_address']);
    }

    public function test_customer_can_view_order_status_page(): void
    {
        $order = CatalogOrder::create([
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Rina Wijaya',
            'customer_phone' => '08987654321',
            'delivery_method' => 'delivery',
            'delivery_address' => 'Jl. Mawar No. 12',
            'subtotal' => 5000,
            'grand_total' => 5000,
            'status' => CatalogOrder::STATUS_SUBMITTED,
        ]);

        $order->items()->create([
            'product_id' => $this->product->id,
            'product_title' => $this->product->title,
            'qty' => 1,
            'price' => 5000,
            'subtotal' => 5000,
        ]);

        $response = $this->get(route('catalog.order.status', $order->access_token));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/CatalogOrderStatus')
            ->has('order')
            ->where('order.customer_name', 'Rina Wijaya')
            ->where('order.status', CatalogOrder::STATUS_SUBMITTED)
        );
    }

    public function test_customer_can_poll_order_status_check(): void
    {
        $order = CatalogOrder::create([
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Andi',
            'delivery_method' => 'pickup',
            'subtotal' => 5000,
            'grand_total' => 5000,
            'status' => CatalogOrder::STATUS_CONFIRMED,
        ]);

        $response = $this->getJson(route('catalog.order.status-check', $order->access_token));

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('status', CatalogOrder::STATUS_CONFIRMED);
        $response->assertJsonPath('status_label', 'Dikonfirmasi Toko');
        $response->assertJsonPath('order.status', CatalogOrder::STATUS_CONFIRMED);
        $response->assertJsonPath('order.status_label', 'Dikonfirmasi Toko');
    }

    public function test_cashier_can_confirm_order_and_deduct_stock(): void
    {
        $admin = User::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $admin->assignRole('super-admin');

        $order = CatalogOrder::create([
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Joko',
            'delivery_method' => 'pickup',
            'subtotal' => 15000,
            'grand_total' => 15000,
            'status' => CatalogOrder::STATUS_SUBMITTED,
        ]);

        $order->items()->create([
            'product_id' => $this->product->id,
            'product_title' => $this->product->title,
            'qty' => 3,
            'price' => 5000,
            'subtotal' => 15000,
        ]);

        $response = $this->actingAs($admin)->post(route('catalog-orders.confirm', $order->id));

        $response->assertRedirect();
        $this->assertEquals(CatalogOrder::STATUS_CONFIRMED, $order->fresh()->status);

        // Stock in branch was 50, decremented by 3 -> 47
        $this->assertEquals(47, ProductWarehouse::where('product_id', $this->product->id)->where('warehouse_id', $this->warehouse->id)->value('stock'));

        // Stock mutation recorded
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $this->product->id,
            'reference_type' => 'catalog_order',
            'reference_id' => $order->id,
            'qty' => 3,
            'mutation_type' => 'out',
        ]);
    }

    public function test_cashier_can_cancel_order_and_restore_stock(): void
    {
        $admin = User::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $admin->assignRole('super-admin');

        $order = CatalogOrder::create([
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Siti',
            'delivery_method' => 'pickup',
            'subtotal' => 10000,
            'grand_total' => 10000,
            'status' => CatalogOrder::STATUS_SUBMITTED,
        ]);

        $order->items()->create([
            'product_id' => $this->product->id,
            'product_title' => $this->product->title,
            'qty' => 2,
            'price' => 5000,
            'subtotal' => 10000,
        ]);

        // First confirm
        $this->actingAs($admin)->post(route('catalog-orders.confirm', $order->id));
        $this->assertEquals(48, ProductWarehouse::where('product_id', $this->product->id)->where('warehouse_id', $this->warehouse->id)->value('stock'));

        // Then cancel
        $response = $this->actingAs($admin)->post(route('catalog-orders.cancel', $order->id), [
            'reason' => 'Pelanggan minta ganti menu',
        ]);

        $response->assertRedirect();
        $this->assertEquals(CatalogOrder::STATUS_CANCELLED, $order->fresh()->status);
        $this->assertEquals('Pelanggan minta ganti menu', $order->fresh()->cancellation_reason);

        // Stock restored back to 50
        $this->assertEquals(50, ProductWarehouse::where('product_id', $this->product->id)->where('warehouse_id', $this->warehouse->id)->value('stock'));

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $this->product->id,
            'reference_type' => 'catalog_order_restore',
            'reference_id' => $order->id,
            'qty' => 2,
            'mutation_type' => 'in',
        ]);
    }

    public function test_cashier_can_load_order_to_pos_cart(): void
    {
        $admin = User::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $admin->assignRole('super-admin');

        $order = CatalogOrder::create([
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Dewi',
            'delivery_method' => 'pickup',
            'subtotal' => 10000,
            'grand_total' => 10000,
            'status' => CatalogOrder::STATUS_CONFIRMED,
        ]);

        $order->items()->create([
            'product_id' => $this->product->id,
            'product_title' => $this->product->title,
            'qty' => 2,
            'price' => 5000,
            'subtotal' => 10000,
        ]);

        $response = $this->actingAs($admin)->post(route('catalog-orders.load-to-pos', $order->id));

        $response->assertRedirect(route('transactions.index', ['resume_hold' => 'CATALOG-'.$order->order_number]));

        $this->assertDatabaseHas('carts', [
            'cashier_id' => $admin->id,
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $this->product->id,
            'qty' => 2,
            'hold_id' => 'CATALOG-'.$order->order_number,
        ]);
    }

    public function test_customer_cannot_have_more_than_3_pending_orders_within_24_hours(): void
    {
        $phone = '081299998888';

        for ($i = 0; $i < 3; $i++) {
            $order = CatalogOrder::create([
                'warehouse_id' => $this->warehouse->id,
                'customer_name' => 'Spam Tester',
                'customer_phone' => $phone,
                'delivery_method' => 'pickup',
                'subtotal' => 5000,
                'grand_total' => 5000,
                'status' => CatalogOrder::STATUS_SUBMITTED,
            ]);
            $order->items()->create([
                'product_id' => $this->product->id,
                'product_title' => $this->product->title,
                'qty' => 1,
                'price' => 5000,
                'subtotal' => 5000,
            ]);
        }

        $payload = [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Spam Tester',
            'customer_phone' => $phone,
            'delivery_method' => 'pickup',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'qty' => 1,
                ],
            ],
        ];

        $response = $this->postJson(route('catalog.checkout'), $payload);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['customer_phone']);
    }

    public function test_dashboard_identifies_multiple_active_orders_for_same_customer(): void
    {
        $admin = User::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $admin->assignRole('super-admin');

        $phone = '081211112222';

        for ($i = 0; $i < 2; $i++) {
            $order = CatalogOrder::create([
                'warehouse_id' => $this->warehouse->id,
                'customer_name' => 'Multi Order Customer',
                'customer_phone' => $phone,
                'delivery_method' => 'pickup',
                'subtotal' => 5000,
                'grand_total' => 5000,
                'status' => CatalogOrder::STATUS_SUBMITTED,
            ]);
            $order->items()->create([
                'product_id' => $this->product->id,
                'product_title' => $this->product->title,
                'qty' => 1,
                'price' => 5000,
                'subtotal' => 5000,
            ]);
        }

        $response = $this->actingAs($admin)->get(route('catalog-orders.index'));

        $response->assertOk();
        $response->assertInertia(
            fn (Assert $page) => $page
                ->component('Dashboard/CatalogOrders/Index')
                ->has('orders.data', 2)
                ->where('orders.data.0.other_active_orders_count', 1)
                ->where('orders.data.1.other_active_orders_count', 1)
        );
    }

    public function test_completing_or_cancelling_catalog_order_clears_pos_held_cart(): void
    {
        $admin = User::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $admin->assignRole('super-admin');

        $order = CatalogOrder::create([
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Budi Hold Test',
            'delivery_method' => 'pickup',
            'subtotal' => 10000,
            'grand_total' => 10000,
            'status' => CatalogOrder::STATUS_CONFIRMED,
        ]);

        $order->items()->create([
            'product_id' => $this->product->id,
            'product_title' => $this->product->title,
            'qty' => 2,
            'price' => 5000,
            'subtotal' => 10000,
        ]);

        // Load to POS
        $this->actingAs($admin)->post(route('catalog-orders.load-to-pos', $order->id));

        $this->assertDatabaseHas('carts', [
            'hold_id' => 'CATALOG-'.$order->order_number,
            'catalog_order_id' => $order->id,
        ]);

        // Manual status update to completed is rejected (must be completed via POS checkout)
        $failResponse = $this->actingAs($admin)->post(route('catalog-orders.status', $order->id), [
            'status' => CatalogOrder::STATUS_COMPLETED,
        ]);
        $failResponse->assertSessionHasErrors(['status']);

        // Cancelling the order clears the held cart
        $this->actingAs($admin)->post(route('catalog-orders.cancel', $order->id), [
            'reason' => 'Pelanggan membatalkan pesanan',
        ]);

        $this->assertDatabaseMissing('carts', [
            'hold_id' => 'CATALOG-'.$order->order_number,
        ]);
    }

    public function test_checking_out_catalog_order_in_pos_completes_order_without_double_stock_deduction(): void
    {
        $admin = User::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $admin->assignRole('super-admin');

        CashierShift::create([
            'user_id' => $admin->id,
            'warehouse_id' => $this->warehouse->id,
            'starting_cash' => 100000,
            'status' => 'open',
            'opened_by' => $admin->id,
            'opened_at' => now(),
        ]);

        // Initial warehouse stock is 50
        $this->assertEquals(50, ProductWarehouse::where('product_id', $this->product->id)->where('warehouse_id', $this->warehouse->id)->value('stock'));

        // Customer orders 2 qty
        $order = CatalogOrder::create([
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Rian Online',
            'customer_phone' => '081299990000',
            'delivery_method' => 'pickup',
            'subtotal' => 10000,
            'grand_total' => 10000,
            'status' => CatalogOrder::STATUS_SUBMITTED,
        ]);
        $order->items()->create([
            'product_id' => $this->product->id,
            'product_title' => $this->product->title,
            'qty' => 2,
            'price' => 5000,
            'subtotal' => 10000,
        ]);

        // Cashier confirms order -> stock drops from 50 to 48
        $this->actingAs($admin)->post(route('catalog-orders.confirm', $order->id));
        $this->assertEquals(48, ProductWarehouse::where('product_id', $this->product->id)->where('warehouse_id', $this->warehouse->id)->value('stock'));

        // Cashier clicks "Ke POS"
        $this->actingAs($admin)->post(route('catalog-orders.load-to-pos', $order->id));

        // Cashier resumes the held cart in POS
        $this->actingAs($admin)->post(route('transactions.resume', 'CATALOG-'.$order->order_number));

        // Cashier completes checkout in POS
        $response = $this->actingAs($admin)->post(route('transactions.store'), [
            'grand_total' => 10000,
            'cash' => 10000,
            'change' => 0,
        ]);

        $order->refresh();
        $this->assertEquals(CatalogOrder::STATUS_COMPLETED, $order->status);
        $this->assertNotNull($order->transaction_id);

        $transaction = Transaction::latest('id')->first();
        $this->assertNotNull($transaction->customer_id);
        $this->assertEquals('Rian Online', $transaction->customer->name);

        // Stock must still be 48 (NOT decremented again to 46)
        $this->assertEquals(48, ProductWarehouse::where('product_id', $this->product->id)->where('warehouse_id', $this->warehouse->id)->value('stock'));
    }

    public function test_customer_can_order_with_uom_and_conversion_factor_affects_stock_on_confirm_and_cancel(): void
    {
        $baseUnit = Unit::firstOrCreate(['code' => 'PCS'], ['name' => 'Pcs', 'symbol' => 'pcs']);
        $boxUnit = Unit::firstOrCreate(['code' => 'BOX'], ['name' => 'Box', 'symbol' => 'box']);

        ProductUnit::create([
            'product_id' => $this->product->id,
            'unit_id' => $baseUnit->id,
            'is_base' => true,
            'conversion_factor' => 1,
            'buy_price' => 2000,
            'sell_price' => 5000,
        ]);

        ProductUnit::create([
            'product_id' => $this->product->id,
            'unit_id' => $boxUnit->id,
            'is_base' => false,
            'conversion_factor' => 10,
            'buy_price' => 18000,
            'sell_price' => 45000,
        ]);

        // 1. Stock validation fails if ordering more than available base stock
        // Available stock is 50. 6 boxes = 60 pcs -> should fail
        $failPayload = [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Budi Wholesale',
            'customer_phone' => '081234567899',
            'delivery_method' => 'pickup',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'unit_id' => $boxUnit->id,
                    'qty' => 6,
                ],
            ],
        ];
        $response = $this->postJson(route('catalog.checkout'), $failPayload);
        $response->assertStatus(422);

        // 2. Order 2 boxes (20 pcs base qty) successfully
        $orderPayload = [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Budi Wholesale',
            'customer_phone' => '081234567899',
            'delivery_method' => 'pickup',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'unit_id' => $boxUnit->id,
                    'qty' => 2,
                ],
            ],
        ];
        $response = $this->postJson(route('catalog.checkout'), $orderPayload);
        $response->assertOk();
        $orderId = $response->json('order.id');

        $this->assertDatabaseHas('catalog_order_items', [
            'catalog_order_id' => $orderId,
            'product_id' => $this->product->id,
            'unit_id' => $boxUnit->id,
            'qty' => 2,
            'price' => 45000,
            'subtotal' => 90000,
            'conversion_factor' => 10,
        ]);

        // 3. Confirm order: stock must be deducted by (2 * 10) = 20 base units
        $admin = User::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $admin->assignRole('super-admin');

        $this->actingAs($admin)->post(route('catalog-orders.confirm', $orderId));

        // Initial 50 - 20 = 30
        $this->assertEquals(30, ProductWarehouse::where('product_id', $this->product->id)->where('warehouse_id', $this->warehouse->id)->value('stock'));

        // 4. Cancel order: stock must be restored by (2 * 10) = 20 base units
        $this->actingAs($admin)->post(route('catalog-orders.cancel', $orderId), [
            'reason' => 'Customer requested cancellation',
        ]);

        // Restored to 50
        $this->assertEquals(50, ProductWarehouse::where('product_id', $this->product->id)->where('warehouse_id', $this->warehouse->id)->value('stock'));
    }

    public function test_catalog_order_transaction_appears_in_sales_report_and_can_be_filtered_by_source(): void
    {
        $admin = User::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $admin->assignRole('super-admin');

        CashierShift::create([
            'user_id' => $admin->id,
            'warehouse_id' => $this->warehouse->id,
            'starting_cash' => 100000,
            'status' => 'open',
            'opened_by' => $admin->id,
            'opened_at' => now(),
        ]);

        // 1. Create and checkout catalog order via POS
        $order = CatalogOrder::create([
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Online Customer',
            'customer_phone' => '081233334444',
            'delivery_method' => 'pickup',
            'subtotal' => 10000,
            'grand_total' => 10000,
            'status' => CatalogOrder::STATUS_SUBMITTED,
        ]);
        $order->items()->create([
            'product_id' => $this->product->id,
            'product_title' => $this->product->title,
            'qty' => 2,
            'price' => 5000,
            'subtotal' => 10000,
        ]);

        $this->actingAs($admin)->post(route('catalog-orders.confirm', $order->id));
        $this->actingAs($admin)->post(route('catalog-orders.load-to-pos', $order->id));
        $this->actingAs($admin)->post(route('transactions.resume', 'CATALOG-'.$order->order_number));
        $this->actingAs($admin)->post(route('transactions.store'), [
            'grand_total' => 10000,
            'cash' => 10000,
            'change' => 0,
        ]);

        // 2. Create a normal walk-in transaction directly
        $walkinTrx = Transaction::create([
            'cashier_id' => $admin->id,
            'warehouse_id' => $this->warehouse->id,
            'invoice' => 'TRX-WALKIN-1',
            'cash' => 5000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 5000,
        ]);

        // 3. Test Sales Report without filter: contains both
        $responseAll = $this->actingAs($admin)->get(route('reports.sales.index'));
        $responseAll->assertOk();
        $responseAll->assertInertia(
            fn (Assert $page) => $page
                ->component('Dashboard/Reports/Sales')
                ->has('transactions.data', 2)
        );

        // 4. Filter by catalog source: only the catalog order transaction
        $responseCatalog = $this->actingAs($admin)->get(route('reports.sales.index', ['order_source' => 'catalog']));
        $responseCatalog->assertOk();
        $responseCatalog->assertInertia(
            fn (Assert $page) => $page
                ->component('Dashboard/Reports/Sales')
                ->has('transactions.data', 1)
                ->where('transactions.data.0.catalog_order.order_number', $order->order_number)
        );

        // 5. Filter by direct pos source: only the walk-in transaction
        $responsePos = $this->actingAs($admin)->get(route('reports.sales.index', ['order_source' => 'pos']));
        $responsePos->assertOk();
        $responsePos->assertInertia(
            fn (Assert $page) => $page
                ->component('Dashboard/Reports/Sales')
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice', 'TRX-WALKIN-1')
        );
    }
}
