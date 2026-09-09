<?php

namespace Tests\Feature\Transactions;

use App\Models\AuditLog;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Receivable;
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
                    'product_title' => 'Produk Offline Uji',
                    'stock_before' => 2,
                    'stock_after' => -3,
                    'deficit' => 3,
                    'warehouse_name' => 'Toko Utama',
                    'message' => 'Stok mengalami selisih minus akibat sinkronisasi offline di Toko Utama',
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

    public function test_offline_sync_creates_warehouse_pivot_and_records_negative_stock_if_missing(): void
    {
        $cashier = $this->createCashier();
        // Create an active warehouse where the cashier works
        $warehouse = Warehouse::create([
            'code' => 'WH-'.Str::upper(Str::random(4)),
            'name' => 'Toko Cabang Baru',
            'type' => 'branch',
            'address' => 'Jl. Cabang Baru',
            'is_active' => true,
        ]);
        $this->openShiftFor($cashier, $warehouse->id);

        // Create a product with stock in another warehouse (e.g. WH ID 1) but NOT in the cashier's warehouse
        $otherWarehouse = Warehouse::create([
            'code' => 'HQ-'.Str::upper(Str::random(4)),
            'name' => 'HQ',
            'type' => 'main',
            'address' => 'Jl. HQ',
            'is_active' => true,
        ]);

        $product = $this->createProduct($otherWarehouse->id, initialStock: 50);

        // Ensure no pivot row exists for the cashier's warehouse
        $this->assertNull(ProductWarehouse::where('product_id', $product->id)->where('warehouse_id', $warehouse->id)->first());

        $clientTxId = (string) Str::uuid();
        $qty = 60;
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
        ]);

        // Server stock should be deducted (50 - 60 = -10)
        $product->refresh();
        $this->assertSame(-10, (int) $product->stock);

        // Warehouse pivot should be created and set to -60
        $whPivot = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
        ])->first();

        $this->assertNotNull($whPivot, 'Pivot table was not created');
        $this->assertSame(-60, (int) $whPivot->stock);

        // Audit log created with event 'stock.offline_negative_sync'
        $auditLog = AuditLog::where('event', 'stock.offline_negative_sync')
            ->where('auditable_type', Product::class)
            ->where('auditable_id', $product->id)
            ->first();
        $this->assertNotNull($auditLog);
    }

    public function test_offline_sync_with_composite_product_deducts_component_stock(): void
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

        $comp1 = $this->createProduct($warehouse->id, initialStock: 50);
        $comp2 = $this->createProduct($warehouse->id, initialStock: 30);

        $category = Category::first();
        $bundleProduct = Product::create([
            'category_id' => $category->id,
            'image' => 'bundle.png',
            'barcode' => 'BNDL-'.Str::upper(Str::random(8)),
            'title' => 'Paket Hemat Bundle',
            'description' => 'Paket promo',
            'buy_price' => 20000,
            'sell_price' => 35000,
            'stock' => 0,
            'is_composite' => true,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $bundleProduct->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 0]);

        $bundleProduct->components()->attach([
            $comp1->id => ['qty' => 2], // 2 pcs comp1
            $comp2->id => ['qty' => 1], // 1 pc comp2
        ]);

        $clientTxId = (string) Str::uuid();
        $soldQty = 3; // 3 bundles -> 6 comp1, 3 comp2
        $linePrice = $bundleProduct->sell_price * $soldQty;

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
                        'product_id' => $bundleProduct->id,
                        'qty' => $soldQty,
                        'unit_price' => $bundleProduct->sell_price,
                        'price' => $linePrice,
                        'conversion_factor' => 1,
                    ],
                ],
            ]);

        $response->assertOk();
        $response->assertJson(['success' => true]);

        // Component 1: 50 - (3 * 2) = 44
        $comp1->refresh();
        $this->assertSame(44, (int) $comp1->stock);

        // Component 2: 30 - (3 * 1) = 27
        $comp2->refresh();
        $this->assertSame(27, (int) $comp2->stock);
    }

    public function test_offline_sync_with_pay_later_creates_receivable(): void
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

        $customer = Customer::create([
            'name' => 'Pelanggan Piutang',
            'no_telp' => 6289876543,
            'address' => 'Jl. Piutang',
        ]);

        $product = $this->createProduct($warehouse->id, initialStock: 10);
        $clientTxId = (string) Str::uuid();
        $dueDate = now()->addDays(14)->format('Y-m-d');

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.sync-offline'), [
                'client_tx_id' => $clientTxId,
                'customer_id' => $customer->id,
                'discount' => 0,
                'shipping_cost' => 0,
                'grand_total' => $product->sell_price,
                'cash' => 0,
                'pay_later' => true,
                'due_date' => $dueDate,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty' => 1,
                        'unit_price' => $product->sell_price,
                        'price' => $product->sell_price,
                        'conversion_factor' => 1,
                    ],
                ],
            ]);

        $response->assertOk();
        $response->assertJson(['success' => true]);

        $transaction = Transaction::where('payment_reference', 'offline:'.$clientTxId)->first();
        $this->assertNotNull($transaction);
        $this->assertSame('unpaid', $transaction->payment_status);

        $receivable = Receivable::where('transaction_id', $transaction->id)->first();
        $this->assertNotNull($receivable);
        $this->assertSame($customer->id, $receivable->customer_id);
        $this->assertSame($product->sell_price, (int) $receivable->total);
        $this->assertSame($dueDate, $receivable->due_date->format('Y-m-d'));
    }

    public function test_manifest_pwa_endpoint_returns_valid_configuration(): void
    {
        $response = $this->get('/manifest.json');
        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/manifest+json');

        $json = $response->json();
        $this->assertArrayHasKey('name', $json);
        $this->assertArrayHasKey('start_url', $json);
        $this->assertArrayHasKey('display', $json);
        $this->assertArrayHasKey('icons', $json);
        $this->assertSame('standalone', $json['display']);
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
        if (is_null($warehouseId)) {
            $warehouseId = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id;
        }

        return CashierShift::create([
            'user_id'      => $cashier->id,
            'warehouse_id' => $warehouseId,
            'opened_by'    => $cashier->id,
            'opened_at'    => now(),
            'opening_cash' => 100000,
            'expected_cash'=> 100000,
            'status'       => 'open',
        ]);
    }

    protected function createProduct(int $warehouseId, int $initialStock = 25): Product
    {
        $category = Category::create([
            'name'        => 'Sembako',
            'description' => 'Kategori pengujian',
            'image'       => 'category.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image'       => 'product.png',
            'barcode'     => 'BRCD-'.Str::upper(Str::random(10)),
            'title'       => 'Produk Offline Uji',
            'description' => 'Deskripsi produk uji.',
            'buy_price'   => 45000,
            'sell_price'  => 60000,
            'stock'       => $initialStock,
            'tax_rate'    => 0,
        ]);

        ProductWarehouse::create([
            'product_id'   => $product->id,
            'warehouse_id' => $warehouseId,
            'stock'        => $initialStock,
        ]);

        return $product;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Issue #8 — Profit allocation with voucher/loyalty in offline sync
    // ──────────────────────────────────────────────────────────────────────────

    public function test_offline_sync_profit_includes_voucher_discount_allocation(): void
    {
        // sell 60000, buy 45000 → margin 15000
        // voucher discount 10000 → netSell = 50000 → profit should be 50000 - 45000 = 5000
        // Before fix: profit was 60000 - 45000 = 15000 (over-stated by 10000)
        $cashier   = $this->createCashier();
        $warehouse = Warehouse::create(['code' => 'WH-'.Str::upper(Str::random(4)), 'name' => 'Voucher WH', 'is_active' => true]);
        $this->openShiftFor($cashier, $warehouse->id);
        $product = $this->createProduct($warehouse->id, initialStock: 10);

        $linePrice      = 60000;   // sell_price × 1
        $voucherDiscount = 10000;
        $grandTotal     = $linePrice - $voucherDiscount; // 50000

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.sync-offline'), [
                'client_tx_id'         => (string) Str::uuid(),
                'grand_total'          => $grandTotal,
                'cash'                 => $grandTotal,
                'payment_gateway'      => 'cash',
                'voucher_discount_total' => $voucherDiscount,
                'loyalty_discount_total' => 0,
                'items' => [[
                    'product_id'        => $product->id,
                    'qty'               => 1,
                    'unit_price'        => $linePrice,
                    'price'             => $linePrice,
                    'conversion_factor' => 1,
                ]],
            ]);

        $response->assertOk()->assertJson(['success' => true]);

        $transaction = Transaction::with('profits')->latest('id')->first();
        $this->assertNotNull($transaction);
        $this->assertSame($voucherDiscount, (int) $transaction->customer_voucher_discount);

        $totalProfit = $transaction->profits->sum('total');
        // netSell = 60000 - 10000 = 50000; profit = 50000 - 45000 = 5000
        $this->assertSame(5000, (int) $totalProfit);
    }

    public function test_offline_sync_profit_includes_loyalty_discount_allocation(): void
    {
        // sell 60000, buy 45000
        // loyalty discount 6000 → netSell = 54000 → profit = 54000 - 45000 = 9000
        // Before fix: profit was 60000 - 45000 = 15000 (over-stated by 6000)
        $cashier   = $this->createCashier();
        $warehouse = Warehouse::create(['code' => 'WH-'.Str::upper(Str::random(4)), 'name' => 'Loyalty WH', 'is_active' => true]);
        $this->openShiftFor($cashier, $warehouse->id);
        $product = $this->createProduct($warehouse->id, initialStock: 10);

        $linePrice      = 60000;
        $loyaltyDiscount = 6000;
        $grandTotal     = $linePrice - $loyaltyDiscount; // 54000

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.sync-offline'), [
                'client_tx_id'          => (string) Str::uuid(),
                'grand_total'           => $grandTotal,
                'cash'                  => $grandTotal,
                'payment_gateway'       => 'cash',
                'voucher_discount_total' => 0,
                'loyalty_discount_total' => $loyaltyDiscount,
                'items' => [[
                    'product_id'        => $product->id,
                    'qty'               => 1,
                    'unit_price'        => $linePrice,
                    'price'             => $linePrice,
                    'conversion_factor' => 1,
                ]],
            ]);

        $response->assertOk()->assertJson(['success' => true]);

        $transaction = Transaction::with('profits')->latest('id')->first();
        $this->assertNotNull($transaction);
        $this->assertSame($loyaltyDiscount, (int) $transaction->loyalty_discount_total);

        $totalProfit = $transaction->profits->sum('total');
        // netSell = 60000 - 6000 = 54000; profit = 54000 - 45000 = 9000
        $this->assertSame(9000, (int) $totalProfit);
    }

    public function test_offline_sync_without_discount_fields_still_works(): void
    {
        // Backward compatibility — old clients not sending voucher/loyalty fields
        $cashier   = $this->createCashier();
        $warehouse = Warehouse::create(['code' => 'WH-'.Str::upper(Str::random(4)), 'name' => 'BW WH', 'is_active' => true]);
        $this->openShiftFor($cashier, $warehouse->id);
        $product = $this->createProduct($warehouse->id, initialStock: 5);

        $linePrice  = 60000;
        $grandTotal = $linePrice;

        $response = $this
            ->actingAs($cashier)
            ->postJson(route('transactions.sync-offline'), [
                'client_tx_id'   => (string) Str::uuid(),
                'grand_total'    => $grandTotal,
                'cash'           => $grandTotal,
                'payment_gateway'=> 'cash',
                // intentionally omit voucher_discount_total and loyalty_discount_total
                'items' => [[
                    'product_id'        => $product->id,
                    'qty'               => 1,
                    'unit_price'        => $linePrice,
                    'price'             => $linePrice,
                    'conversion_factor' => 1,
                ]],
            ]);

        $response->assertOk()->assertJson(['success' => true]);

        $transaction = Transaction::with('profits')->latest('id')->first();
        $this->assertNotNull($transaction);

        $totalProfit = $transaction->profits->sum('total');
        // sell 60000, buy 45000, no discount → profit = 15000
        $this->assertSame(15000, (int) $totalProfit);
    }
}
