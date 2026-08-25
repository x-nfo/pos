<?php

namespace Tests\Feature\Transactions;

use App\Models\AuditLog;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\StockMutation;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class TransactionSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate([
            'name' => 'transactions-access',
            'guard_name' => 'web',
        ]);
        Permission::firstOrCreate([
            'name' => 'cashier-shifts-access',
            'guard_name' => 'web',
        ]);
    }

    public function test_guest_cannot_sync_offline_transactions(): void
    {
        $response = $this->postJson(route('transactions.sync-offline'), [
            'client_tx_id' => (string) Str::uuid(),
            'items' => [],
        ]);

        $response->assertUnauthorized();
    }

    public function test_cashier_can_sync_offline_transaction_successfully(): void
    {
        $cashier = $this->createCashier();
        $warehouse = Warehouse::create([
            'code' => 'WH-'.Str::upper(Str::random(4)),
            'name' => 'Toko Utama',
            'type' => 'main',
            'address' => 'Jl. Pengujian No. 1',
            'is_active' => true,
        ]);
        $shift = $this->openShiftFor($cashier, $warehouse->id);

        $customer = Customer::create([
            'name' => 'Offline Customer',
            'no_telp' => 6281234567,
            'address' => 'Jl. Offline',
        ]);

        $product = $this->createProduct($warehouse->id, initialStock: 20);

        $clientTxId = (string) Str::uuid();
        $qty = 3;
        $unitPrice = $product->sell_price;
        $linePrice = $unitPrice * $qty;
        $discount = 5000;
        $grandTotal = $linePrice - $discount;

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.sync-offline'), [
                'client_tx_id' => $clientTxId,
                'customer_id' => $customer->id,
                'discount' => $discount,
                'shipping_cost' => 0,
                'grand_total' => $grandTotal,
                'cash' => $grandTotal,
                'payment_gateway' => 'cash',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty' => $qty,
                        'unit_price' => $unitPrice,
                        'price' => $linePrice,
                        'conversion_factor' => 1,
                    ],
                ],
            ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'message' => 'Transaksi offline berhasil disinkronkan.',
        ]);

        $transaction = Transaction::with(['details', 'profits'])->latest('id')->first();
        $this->assertNotNull($transaction);
        $this->assertSame('offline:'.$clientTxId, $transaction->payment_reference);
        $this->assertSame($customer->id, $transaction->customer_id);
        $this->assertSame($grandTotal, (int) $transaction->grand_total);
        $this->assertSame('paid', $transaction->payment_status);

        // Verify detail
        $this->assertSame(1, $transaction->details->count());
        $detail = $transaction->details->first();
        $this->assertSame($product->id, $detail->product_id);
        $this->assertSame($qty, (int) $detail->qty);
        $this->assertSame($linePrice, (int) $detail->price);

        // Verify stock deducted
        $product->refresh();
        $this->assertSame(17, (int) $product->stock);

        $whPivot = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
        ])->first();
        $this->assertSame(17, (int) $whPivot->stock);
    }

    public function test_offline_sync_is_idempotent(): void
    {
        $cashier = $this->createCashier();
        $warehouse = Warehouse::create([
            'code' => 'WH-'.Str::upper(Str::random(4)),
            'name' => 'Toko Utama',
            'type' => 'main',
            'address' => 'Jl. Pengujian No. 1',
            'is_active' => true,
        ]);
        $this->openShiftFor($cashier, $warehouse->id);

        $product = $this->createProduct($warehouse->id, initialStock: 10);
        $clientTxId = (string) Str::uuid();

        $payload = [
            'client_tx_id' => $clientTxId,
            'discount' => 0,
            'grand_total' => $product->sell_price,
            'cash' => $product->sell_price,
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                    'unit_price' => $product->sell_price,
                    'price' => $product->sell_price,
                    'conversion_factor' => 1,
                ],
            ],
        ];

        // First sync
        $response1 = $this->actingAs($cashier)->postJson(route('transactions.sync-offline'), $payload);
        $response1->assertOk();

        // Second sync with identical client_tx_id
        $response2 = $this->actingAs($cashier)->postJson(route('transactions.sync-offline'), $payload);
        $response2->assertOk();
        $response2->assertJson([
            'success' => true,
            'idempotent' => true,
        ]);

        // Stock should only be deducted once (10 - 1 = 9)
        $this->assertSame(1, Transaction::count());
        $product->refresh();
        $this->assertSame(9, (int) $product->stock);
    }

    public function test_offline_sync_when_sold_qty_exceeds_stock_records_negative_stock_and_audit_log(): void
    {
        $cashier = $this->createCashier();
        $warehouse = Warehouse::create([
            'code' => 'WH-'.Str::upper(Str::random(4)),
            'name' => 'Toko Utama',
            'type' => 'main',
            'address' => 'Jl. Pengujian No. 1',
            'is_active' => true,
        ]);
        $this->openShiftFor($cashier, $warehouse->id);

        // Product in server database only has 2 items in stock
        $product = $this->createProduct($warehouse->id, initialStock: 2);
        $clientTxId = (string) Str::uuid();

        // Cashier sold 5 items in offline mode
        $qty = 5;
        $unitPrice = $product->sell_price;
        $linePrice = $unitPrice * $qty;

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.sync-offline'), [
                'client_tx_id' => $clientTxId,
                'discount' => 0,
                'shipping_cost' => 0,
                'grand_total' => $linePrice,
                'cash' => $linePrice,
                'payment_gateway' => 'cash',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty' => $qty,
                        'unit_price' => $unitPrice,
                        'price' => $linePrice,
                        'conversion_factor' => 1,
                    ],
                ],
            ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'has_negative_stock' => true,
            'stock_warnings' => [
                [
                    'product_id' => $product->id,
                    'product_title' => $product->title,
                    'stock_before' => 2,
                    'stock_after' => -3,
                    'deficit' => 3,
                    'message' => 'Stok mengalami selisih minus akibat sinkronisasi offline',
                ],
            ],
        ]);

        // Server stock becomes negative (-3)
        $product->refresh();
        $this->assertSame(-3, (int) $product->stock);

        $whPivot = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
        ])->first();
        $this->assertSame(-3, (int) $whPivot->stock);

        $transaction = Transaction::where('payment_reference', 'offline:'.$clientTxId)->first();
        $this->assertNotNull($transaction);

        // Stock mutation recorded with negative stock and informative note
        $mutation = StockMutation::where('reference_type', 'transaction')
            ->where('reference_id', $transaction->id)
            ->where('product_id', $product->id)
            ->first();
        $this->assertNotNull($mutation);
        $this->assertSame(2, (int) $mutation->stock_before);
        $this->assertSame(-3, (int) $mutation->stock_after);
        $this->assertStringContainsString('Stok mengalami selisih minus (-3)', $mutation->notes);

        // Audit log created with event 'stock.offline_negative_sync'
        $auditLog = AuditLog::where('event', 'stock.offline_negative_sync')
            ->where('auditable_type', Product::class)
            ->where('auditable_id', $product->id)
            ->first();
        $this->assertNotNull($auditLog);
        $this->assertStringContainsString('Stok mengalami selisih minus akibat sinkronisasi offline', $auditLog->description);
        $this->assertSame(-3, $auditLog->after['stock_after']);
        $this->assertTrue($auditLog->meta['is_negative_stock']);
    }

    protected function createCashier(): User
    {
        $user = User::factory()->create([
            'name' => 'Kasir Offline',
            'email' => 'kasir-offline-'.Str::random(6).'@example.com',
        ]);
        $user->givePermissionTo('transactions-access');
        $user->givePermissionTo('cashier-shifts-access');

        return $user;
    }

    protected function openShiftFor(User $cashier, ?int $warehouseId = null): CashierShift
    {
        return CashierShift::create([
            'user_id' => $cashier->id,
            'warehouse_id' => $warehouseId,
            'opened_by' => $cashier->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => 'open',
        ]);
    }

    protected function createProduct(int $warehouseId, int $initialStock = 25): Product
    {
        $category = Category::create([
            'name' => 'Sembako',
            'description' => 'Kategori pengujian',
            'image' => 'category.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(10)),
            'title' => 'Produk Offline Uji',
            'description' => 'Deskripsi produk uji.',
            'buy_price' => 45000,
            'sell_price' => 60000,
            'stock' => $initialStock,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouseId,
            'stock' => $initialStock,
        ]);

        return $product;
    }
}
