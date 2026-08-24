<?php

namespace Tests\Feature\Inventory;

use App\Models\Cart;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\DineOrder;
use App\Models\DineOrderItem;
use App\Models\DiningTable;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\StockMutation;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\DineOrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class StockMutationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
            'stock-mutations-access',
            'stock-opnames-access',
            'stock-opnames-create',
            'stock-opnames-finalize',
            'products-create',
            'products-edit',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_pos_checkout_creates_out_stock_mutation(): void
    {
        $cashier = $this->createCashier();
        $warehouse = Warehouse::create([
            'code' => 'GUD-01',
            'name' => 'Gudang Utama',
            'is_active' => true,
        ]);
        $shift = $this->openShiftFor($cashier, $warehouse->id);

        $product = $this->createProduct(['stock' => 50]);
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 50,
        ]);

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => 3,
            'price' => $product->sell_price,
            'warehouse_id' => $warehouse->id,
        ]);

        $response = $this
            ->actingAs($cashier)
            ->post(route('transactions.store'), [
                'customer_id' => null,
                'discount' => 0,
                'grand_total' => 3 * $product->sell_price,
                'cash' => 3 * $product->sell_price,
                'change' => 0,
            ]);

        $transaction = Transaction::latest('id')->first();
        $this->assertNotNull($transaction);
        $response->assertRedirect(route('transactions.print', $transaction->invoice));

        $this->assertEquals(47, $product->fresh()->stock);

        $mutation = StockMutation::where('reference_type', 'transaction')
            ->where('reference_id', $transaction->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($mutation, 'StockMutation was not created for transaction checkout.');
        $this->assertSame('out', $mutation->mutation_type);
        $this->assertSame(3, $mutation->qty);
        $this->assertSame(50, $mutation->stock_before);
        $this->assertSame(47, $mutation->stock_after);
        $this->assertSame($warehouse->id, $mutation->warehouse_id);
        $this->assertSame($cashier->id, $mutation->created_by);
    }

    public function test_composite_product_checkout_creates_component_mutations(): void
    {
        $cashier = $this->createCashier();
        $warehouse = Warehouse::create([
            'code' => 'GUD-BNDL',
            'name' => 'Gudang Bundle',
            'is_active' => true,
        ]);
        $shift = $this->openShiftFor($cashier, $warehouse->id);

        $componentA = $this->createProduct(['title' => 'Komponen A', 'stock' => 20]);
        $componentB = $this->createProduct(['title' => 'Komponen B', 'stock' => 30]);

        ProductWarehouse::create([
            'product_id' => $componentA->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 20,
        ]);
        ProductWarehouse::create([
            'product_id' => $componentB->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 30,
        ]);

        $bundle = $this->createProduct(['title' => 'Paket Hemat', 'stock' => 10, 'is_composite' => true]);
        $bundle->components()->attach([
            $componentA->id => ['qty' => 2],
            $componentB->id => ['qty' => 1],
        ]);

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $bundle->id,
            'qty' => 2,
            'price' => $bundle->sell_price,
            'warehouse_id' => $warehouse->id,
        ]);

        $response = $this
            ->actingAs($cashier)
            ->post(route('transactions.store'), [
                'customer_id' => null,
                'discount' => 0,
                'grand_total' => 2 * $bundle->sell_price,
                'cash' => 2 * $bundle->sell_price,
                'change' => 0,
            ]);

        $transaction = Transaction::latest('id')->first();
        $this->assertNotNull($transaction);

        // Component A: 2 bundle * 2 qty = 4 deducted
        $this->assertEquals(16, $componentA->fresh()->stock);
        $mutationA = StockMutation::where('reference_type', 'transaction')
            ->where('reference_id', $transaction->id)
            ->where('product_id', $componentA->id)
            ->first();
        $this->assertNotNull($mutationA);
        $this->assertSame(4, $mutationA->qty);
        $this->assertSame('out', $mutationA->mutation_type);
        $this->assertSame(20, $mutationA->stock_before);
        $this->assertSame(16, $mutationA->stock_after);

        // Component B: 2 bundle * 1 qty = 2 deducted
        $this->assertEquals(28, $componentB->fresh()->stock);
        $mutationB = StockMutation::where('reference_type', 'transaction')
            ->where('reference_id', $transaction->id)
            ->where('product_id', $componentB->id)
            ->first();
        $this->assertNotNull($mutationB);
        $this->assertSame(2, $mutationB->qty);
        $this->assertSame('out', $mutationB->mutation_type);
    }

    public function test_offline_sync_records_stock_mutation(): void
    {
        $cashier = $this->createCashier();
        $warehouse = Warehouse::create([
            'code' => 'GUD-SYNC',
            'name' => 'Gudang Sync',
            'is_active' => true,
        ]);
        $shift = $this->openShiftFor($cashier, $warehouse->id);

        $product = $this->createProduct(['stock' => 15]);

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.sync-offline'), [
                'client_tx_id' => (string) Str::uuid(),
                'grand_total' => 60000,
                'cash' => 60000,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty' => 2,
                        'price' => 30000,
                        'conversion_factor' => 1,
                    ],
                ],
            ]);

        $response->assertOk();
        $this->assertEquals(13, $product->fresh()->stock);

        $transaction = Transaction::latest('id')->first();
        $mutation = StockMutation::where('reference_type', 'transaction')
            ->where('reference_id', $transaction->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($mutation);
        $this->assertSame('out', $mutation->mutation_type);
        $this->assertSame(2, $mutation->qty);
        $this->assertSame(15, $mutation->stock_before);
        $this->assertSame(13, $mutation->stock_after);
    }

    public function test_dine_order_accept_records_stock_mutation(): void
    {
        $cashier = $this->createCashier();
        $warehouse = Warehouse::create([
            'code' => 'GUD-DINE',
            'name' => 'Gudang Resto',
            'is_active' => true,
        ]);
        $shift = $this->openShiftFor($cashier, $warehouse->id);

        $product = $this->createProduct(['stock' => 40]);
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 40,
        ]);

        $table = DiningTable::create([
            'name' => 'Meja 01',
            'token' => Str::random(10),
            'capacity' => 4,
            'is_active' => true,
        ]);

        $order = DineOrder::create([
            'dine_table_id' => $table->id,
            'cashier_id' => $cashier->id,
            'access_token' => Str::random(32),
            'status' => DineOrder::STATUS_SUBMITTED,
            'subtotal' => 60000,
        ]);

        DineOrderItem::create([
            'dine_order_id' => $order->id,
            'product_id' => $product->id,
            'qty' => 3,
            'price' => 20000,
        ]);

        $this->actingAs($cashier);
        $orderService = app(DineOrderService::class);
        $orderService->accept($order);

        $this->assertSame(DineOrder::STATUS_ACCEPTED, $order->fresh()->status);
        $this->assertEquals(37, $product->fresh()->stock);

        $mutation = StockMutation::where('reference_type', 'dine_order')
            ->where('reference_id', $order->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($mutation);
        $this->assertSame('out', $mutation->mutation_type);
        $this->assertSame(3, $mutation->qty);
        $this->assertSame(40, $mutation->stock_before);
        $this->assertSame(37, $mutation->stock_after);
        $this->assertSame($warehouse->id, $mutation->warehouse_id);
    }

    protected function createCashier(): User
    {
        $cashier = User::factory()->create([
            'email' => 'cashier-mutation@test.com',
            'password' => bcrypt('password'),
        ]);

        $cashier->givePermissionTo([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
            'stock-mutations-access',
            'stock-opnames-access',
            'stock-opnames-create',
            'stock-opnames-finalize',
            'products-create',
            'products-edit',
        ]);

        return $cashier;
    }

    protected function openShiftFor(User $cashier, ?int $warehouseId = null): CashierShift
    {
        return CashierShift::create([
            'user_id' => $cashier->id,
            'opened_by' => $cashier->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => 'open',
            'warehouse_id' => $warehouseId,
        ]);
    }

    protected function createProduct(array $overrides = []): Product
    {
        $category = Category::firstOrCreate([
            'name' => 'General',
        ], [
            'description' => 'General Category',
            'image' => 'category.png',
        ]);

        return Product::create(array_merge([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(8)),
            'title' => 'Produk Test',
            'description' => 'Deskripsi produk test.',
            'buy_price' => 10000,
            'sell_price' => 20000,
            'stock' => 10,
            'tax_rate' => 0,
        ], $overrides));
    }
}
