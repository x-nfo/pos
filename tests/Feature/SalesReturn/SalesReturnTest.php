<?php

namespace Tests\Feature\SalesReturn;

use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Receivable;
use App\Models\SalesReturn;
use App\Models\Transaction;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\CashierShiftService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SalesReturnTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_authorized_user_can_create_sales_return_draft_for_cash_transaction(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
        ]);

        [$transaction, $detail] = $this->createTransaction($user);

        $response = $this
            ->actingAs($user)
            ->post(route('sales-returns.store', $transaction), [
                'return_type' => 'refund_cash',
                'notes' => 'Retur karena salah ukuran',
                'items' => [
                    [
                        'transaction_detail_id' => $detail->id,
                        'qty_return' => 1,
                        'return_reason' => 'Salah ukuran',
                        'restock_to_inventory' => true,
                    ],
                ],
            ]);

        $salesReturn = SalesReturn::first();

        $response->assertRedirect(route('sales-returns.show', $salesReturn));
        $this->assertNotNull($salesReturn);
        $this->assertSame('draft', $salesReturn->status);
        $this->assertSame(1, $salesReturn->items()->count());
        $this->assertSame(60000, $salesReturn->total_return_amount);
        $this->assertSame(60000, $salesReturn->refund_amount);
    }

    public function test_authorized_user_can_create_and_complete_cash_refund_sales_return_in_one_step(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
        ]);

        [$transaction, $detail, $product] = $this->createTransaction($user, qty: 1, stock: 5);
        $shift = $this->openShiftFor($user);

        $response = $this
            ->actingAs($user)
            ->post(route('sales-returns.store', $transaction), [
                'return_type' => 'refund_cash',
                'notes' => 'Retur uang tunai langsung selesai',
                'action' => 'complete',
                'items' => [
                    [
                        'transaction_detail_id' => $detail->id,
                        'qty_return' => 1,
                        'return_reason' => 'Barang rusak',
                        'restock_to_inventory' => true,
                    ],
                ],
            ]);

        $salesReturn = SalesReturn::first();

        $response->assertRedirect(route('sales-returns.show', $salesReturn));
        $response->assertSessionHas('success', 'Retur penjualan berhasil diselesaikan.');

        $this->assertNotNull($salesReturn);
        $this->assertSame('completed', $salesReturn->status);
        $this->assertNotNull($salesReturn->completed_at);
        $this->assertSame(60000, $salesReturn->refund_amount);
        $this->assertSame(6, $product->fresh()->stock); // restocked from 5 to 6
    }

    public function test_qty_return_cannot_exceed_remaining_quantity(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
        ]);

        [$transaction, $detail, $product] = $this->createTransaction($user, qty: 2);

        $firstReturn = SalesReturn::create([
            'code' => 'SR-TEST-001',
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $user->id,
            'status' => 'completed',
            'return_type' => 'refund_cash',
            'refund_amount' => 60000,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
            'completed_at' => now(),
        ]);

        $firstReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $product->id,
            'qty_sold' => 2,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Retur pertama',
            'restock_to_inventory' => true,
        ]);

        $response = $this
            ->from(route('sales-returns.create', $transaction))
            ->actingAs($user)
            ->post(route('sales-returns.store', $transaction), [
                'return_type' => 'refund_cash',
                'items' => [
                    [
                        'transaction_detail_id' => $detail->id,
                        'qty_return' => 2,
                        'return_reason' => 'Melebihi sisa',
                        'restock_to_inventory' => true,
                    ],
                ],
            ]);

        $response->assertInvalid(['items']);
        $this->assertDatabaseCount('sales_returns', 1);
    }

    public function test_complete_sales_return_restocks_product_and_creates_mutation(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
        ]);

        [$transaction, $detail, $product] = $this->createTransaction($user, qty: 1, stock: 4);
        $shift = $this->openShiftFor($user);

        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-002',
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $user->id,
            'status' => 'draft',
            'return_type' => 'refund_cash',
            'refund_amount' => 60000,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $product->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Barang dikembalikan',
            'restock_to_inventory' => true,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('sales-returns.complete', $salesReturn));

        $response->assertSessionDoesntHaveErrors();
        $this->assertSame(5, $product->fresh()->stock);
        $this->assertDatabaseHas('sales_returns', [
            'id' => $salesReturn->id,
            'status' => 'completed',
            'refund_amount' => 60000,
            'cashier_shift_id' => $shift->id,
        ]);
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'reference_type' => 'sales_return',
            'reference_id' => $salesReturn->id,
            'mutation_type' => 'in',
            'qty' => 1,
            'stock_before' => 4,
            'stock_after' => 5,
        ]);
        $this->assertDatabaseHas('profits', [
            'transaction_id' => $transaction->id,
            'total' => -15000,
        ]);
    }

    public function test_complete_sales_return_updates_receivable_total_and_creates_credit_on_overpayment(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
        ]);

        [$transaction, $detail, $product, $customer] = $this->createTransaction(
            $user,
            qty: 1,
            stock: 3,
            paymentMethod: 'pay_later',
            paymentStatus: 'paid',
            withReceivable: true
        );
        $shift = $this->openShiftFor($user);

        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-003',
            'transaction_id' => $transaction->id,
            'customer_id' => $customer->id,
            'cashier_id' => $user->id,
            'status' => 'draft',
            'return_type' => 'store_credit',
            'refund_amount' => 0,
            'credited_amount' => 60000,
            'total_return_amount' => 60000,
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $product->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Salah kirim',
            'restock_to_inventory' => true,
        ]);

        $this->actingAs($user)->post(route('sales-returns.complete', $salesReturn));

        $this->assertDatabaseHas('receivables', [
            'transaction_id' => $transaction->id,
            'total' => 0,
            'status' => 'paid',
        ]);
        $this->assertDatabaseHas('customer_credits', [
            'customer_id' => $customer->id,
            'sales_return_id' => $salesReturn->id,
            'amount' => 60000,
            'balance' => 60000,
        ]);
        $this->assertDatabaseHas('sales_returns', [
            'id' => $salesReturn->id,
            'cashier_shift_id' => $shift->id,
        ]);
    }

    public function test_transaction_without_customer_forces_refund_cash(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
        ]);

        [$transaction, $detail] = $this->createTransaction($user, withCustomer: false);

        $this->actingAs($user)->post(route('sales-returns.store', $transaction), [
            'return_type' => 'store_credit',
            'items' => [
                [
                    'transaction_detail_id' => $detail->id,
                    'qty_return' => 1,
                    'return_reason' => 'Barang dibatalkan',
                    'restock_to_inventory' => true,
                ],
            ],
        ]);

        $salesReturn = SalesReturn::first();

        $this->assertSame('refund_cash', $salesReturn->return_type);
    }

    public function test_completed_sales_return_cannot_be_updated(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
        ]);

        [$transaction, $detail, $product] = $this->createTransaction($user);

        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-004',
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $user->id,
            'status' => 'completed',
            'return_type' => 'refund_cash',
            'refund_amount' => 60000,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
            'completed_at' => now(),
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $product->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Tidak jadi beli',
            'restock_to_inventory' => true,
        ]);

        $response = $this
            ->from(route('sales-returns.show', $salesReturn))
            ->actingAs($user)
            ->patch(route('sales-returns.update', $salesReturn), [
                'return_type' => 'refund_cash',
                'items' => [
                    [
                        'transaction_detail_id' => $detail->id,
                        'qty_return' => 1,
                        'return_reason' => 'Ubah alasan',
                        'restock_to_inventory' => true,
                    ],
                ],
            ]);

        $response->assertInvalid(['sales_return']);
    }

    public function test_authorized_user_can_create_sales_return_with_product_exchange_draft(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
        ]);

        [$transaction, $detail, $product] = $this->createTransaction($user);
        $replacementProduct = $this->createProduct(sellPrice: 80000, stock: 5);

        $response = $this
            ->actingAs($user)
            ->post(route('sales-returns.store', $transaction), [
                'return_type' => 'product_exchange',
                'notes' => 'Tukar varian ukuran',
                'items' => [
                    [
                        'transaction_detail_id' => $detail->id,
                        'qty_return' => 1,
                        'return_reason' => 'Tukar ukuran',
                        'restock_to_inventory' => true,
                    ],
                ],
                'exchange_items' => [
                    [
                        'product_id' => $replacementProduct->id,
                        'qty' => 1,
                    ],
                ],
                'exchange_payment_method' => 'cash',
                'exchange_cash' => 20000,
            ]);

        $salesReturn = SalesReturn::first();

        $response->assertRedirect(route('sales-returns.show', $salesReturn));
        $this->assertNotNull($salesReturn);
        $this->assertSame('draft', $salesReturn->status);
        $this->assertSame('product_exchange', $salesReturn->return_type);
        $this->assertSame(60000, $salesReturn->total_return_amount);
        $this->assertSame(80000, $salesReturn->exchange_amount);
        $this->assertSame(20000, $salesReturn->difference_amount);
        $this->assertSame(1, $salesReturn->exchangeItems()->count());
    }

    public function test_complete_sales_return_with_even_exchange_restocks_old_and_deducts_new_product_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
        ]);

        [$transaction, $detail, $oldProduct] = $this->createTransaction($user, qty: 1, stock: 4);
        $newProduct = $this->createProduct(sellPrice: 60000, buyPrice: 45000, stock: 10);
        $shift = $this->openShiftFor($user);

        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-EXCHANGE-001',
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $user->id,
            'status' => 'draft',
            'return_type' => 'product_exchange',
            'refund_amount' => 0,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
            'exchange_amount' => 60000,
            'difference_amount' => 0,
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $oldProduct->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Tukar warna',
            'restock_to_inventory' => true,
        ]);

        $salesReturn->exchangeItems()->create([
            'product_id' => $newProduct->id,
            'qty' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('sales-returns.complete', $salesReturn));

        $response->assertSessionDoesntHaveErrors();

        // Old product restocked from 4 to 5
        $this->assertSame(5, $oldProduct->fresh()->stock);
        // New product deducted from 10 to 9
        $this->assertSame(9, $newProduct->fresh()->stock);

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $oldProduct->id,
            'reference_type' => 'sales_return',
            'reference_id' => $salesReturn->id,
            'mutation_type' => 'in',
            'qty' => 1,
        ]);

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $newProduct->id,
            'reference_type' => 'sales_return_exchange',
            'reference_id' => $salesReturn->id,
            'mutation_type' => 'out',
            'qty' => 1,
        ]);

        $this->assertDatabaseHas('sales_returns', [
            'id' => $salesReturn->id,
            'status' => 'completed',
            'cashier_shift_id' => $shift->id,
        ]);
    }

    public function test_complete_sales_return_exchange_with_additional_cash_payment_updates_shift_cash(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
        ]);

        [$transaction, $detail, $oldProduct] = $this->createTransaction($user, qty: 1, stock: 2);
        $newProduct = $this->createProduct(sellPrice: 90000, stock: 5);
        $shift = $this->openShiftFor($user);

        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-EXCHANGE-002',
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $user->id,
            'status' => 'draft',
            'return_type' => 'product_exchange',
            'refund_amount' => 0,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
            'exchange_amount' => 90000,
            'difference_amount' => 30000,
            'exchange_payment_method' => 'cash',
            'exchange_cash' => 50000,
            'exchange_change' => 20000,
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $oldProduct->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Upgrade item',
            'restock_to_inventory' => true,
        ]);

        $salesReturn->exchangeItems()->create([
            'product_id' => $newProduct->id,
            'qty' => 1,
            'unit_price' => 90000,
            'subtotal' => 90000,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('sales-returns.complete', $salesReturn));

        $response->assertSessionDoesntHaveErrors();

        // Check shift calculation: opening_cash (100k) + cashExchangeIn (30k) = expected cash (130k)
        $summary = app(CashierShiftService::class)->calculateSummary($shift);
        $this->assertSame(130000, $summary['expected_cash']);
    }

    public function test_complete_sales_return_exchange_fails_if_replacement_product_stock_is_insufficient(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
        ]);

        [$transaction, $detail, $oldProduct] = $this->createTransaction($user);
        $newProduct = $this->createProduct(sellPrice: 60000, stock: 0); // Out of stock
        $this->openShiftFor($user);

        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-EXCHANGE-003',
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $user->id,
            'status' => 'draft',
            'return_type' => 'product_exchange',
            'total_return_amount' => 60000,
            'exchange_amount' => 60000,
            'difference_amount' => 0,
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $oldProduct->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Tukar barang',
            'restock_to_inventory' => true,
        ]);

        $salesReturn->exchangeItems()->create([
            'product_id' => $newProduct->id,
            'qty' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('sales-returns.complete', $salesReturn));

        $response->assertInvalid(['sales_return']);
    }

    public function test_complete_sales_return_with_multi_unit_exchange_deducts_converted_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
        ]);

        [$transaction, $detail, $oldProduct] = $this->createTransaction($user, qty: 1, stock: 10);
        $newProduct = $this->createProduct(sellPrice: 10000, stock: 100);
        $boxUnit = Unit::firstOrCreate(
            ['code' => 'BOX'],
            ['name' => 'Box', 'symbol' => 'box']
        );
        $newProduct->units()->attach($boxUnit->id, [
            'is_base' => false,
            'conversion_factor' => 12,
            'buy_price' => 80000,
            'sell_price' => 120000,
        ]);

        $this->openShiftFor($user);

        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-EXCHANGE-MULTI-UOM',
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $user->id,
            'status' => 'draft',
            'return_type' => 'product_exchange',
            'refund_amount' => 0,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
            'exchange_amount' => 120000,
            'difference_amount' => 60000,
            'exchange_payment_method' => 'cash',
            'exchange_cash' => 60000,
            'exchange_change' => 0,
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $oldProduct->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Tukar box',
            'restock_to_inventory' => true,
        ]);

        // Exchange for 1 BOX (which equals 12 base units)
        $salesReturn->exchangeItems()->create([
            'product_id' => $newProduct->id,
            'unit_id' => $boxUnit->id,
            'conversion_factor' => 12,
            'qty' => 1,
            'unit_price' => 120000,
            'subtotal' => 120000,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('sales-returns.complete', $salesReturn));

        $response->assertSessionDoesntHaveErrors();

        // 100 base stock - (1 box * 12) = 88
        $this->assertEquals(88, $newProduct->fresh()->stock);

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $newProduct->id,
            'reference_type' => 'sales_return_exchange',
            'reference_id' => $salesReturn->id,
            'mutation_type' => 'out',
            'qty' => 12,
        ]);
    }

    public function test_sales_return_receipt_is_accessible(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
        ]);

        [$transaction, $detail, $product] = $this->createTransaction($user);

        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-RECEIPT-001',
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $user->id,
            'status' => 'completed',
            'return_type' => 'product_exchange',
            'total_return_amount' => 60000,
            'exchange_amount' => 60000,
            'difference_amount' => 0,
            'completed_at' => now(),
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $product->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Tukar',
            'restock_to_inventory' => true,
        ]);

        $response = $this
            ->actingAs($user)
            ->get(route('sales-returns.receipt', $salesReturn));

        $response->assertOk();
        $response->assertSee('BUKTI TUKAR BARANG');
    }

    public function test_sales_return_print_page_is_accessible(): void
    {
        $user = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
        ]);

        [$transaction, $detail, $product] = $this->createTransaction($user);

        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-PRINT-001',
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $user->id,
            'status' => 'completed',
            'return_type' => 'refund_cash',
            'total_return_amount' => 60000,
            'refund_amount' => 60000,
            'credited_amount' => 0,
            'completed_at' => now(),
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $product->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Retur',
            'restock_to_inventory' => true,
        ]);

        $response = $this
            ->actingAs($user)
            ->get(route('sales-returns.print', $salesReturn));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/SalesReturns/Print')
            ->has('salesReturn')
            ->has('defaultPaperSize')
            ->has('autoPrint')
            ->has('autoPrintDriver')
            ->has('enabledButtons')
        );
    }

    public function test_non_hq_cashier_can_view_sales_return_created_by_themselves_even_if_transaction_warehouse_differs(): void
    {
        $warehouseA = Warehouse::create([
            'code' => 'WH-A',
            'name' => 'Warehouse A',
            'type' => 'main',
            'is_active' => true,
        ]);
        $warehouseB = Warehouse::create([
            'code' => 'WH-B',
            'name' => 'Warehouse B',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $cashier = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
            'sales-returns-create',
        ]);
        $cashier->update(['warehouse_id' => $warehouseB->id]);

        $otherCashier = User::factory()->create(['warehouse_id' => $warehouseA->id]);

        [$transaction, $detail, $product] = $this->createTransaction($otherCashier);
        $transaction->update(['warehouse_id' => $warehouseA->id]);

        // Sales return created by cashier B on a transaction from warehouse A
        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-OWN-01',
            'warehouse_id' => $warehouseB->id,
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $cashier->id,
            'status' => 'draft',
            'return_type' => 'refund_cash',
            'refund_amount' => 60000,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $product->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Retur produk sendiri',
            'restock_to_inventory' => true,
        ]);

        // Non-HQ cashier can access show page
        $response = $this
            ->actingAs($cashier)
            ->get(route('sales-returns.show', $salesReturn));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/SalesReturns/Show')
            ->where('salesReturn.id', $salesReturn->id)
        );

        // Non-HQ cashier can also view it in index
        $indexResponse = $this
            ->actingAs($cashier)
            ->get(route('sales-returns.index'));

        $indexResponse->assertOk();
        $indexResponse->assertInertia(fn ($page) => $page
            ->component('Dashboard/SalesReturns/Index')
            ->has('salesReturns.data', 1)
        );
    }

    public function test_non_hq_cashier_can_access_sales_return_processed_in_their_warehouse(): void
    {
        $warehouseA = Warehouse::create([
            'code' => 'WH-A2',
            'name' => 'Warehouse A2',
            'type' => 'main',
            'is_active' => true,
        ]);
        $warehouseB = Warehouse::create([
            'code' => 'WH-B2',
            'name' => 'Warehouse B2',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $cashierB1 = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
        ]);
        $cashierB1->update(['warehouse_id' => $warehouseB->id]);

        $cashierB2 = User::factory()->create(['warehouse_id' => $warehouseB->id]);

        [$transaction, $detail, $product] = $this->createTransaction($cashierB2);
        $transaction->update(['warehouse_id' => $warehouseB->id]);

        // Sales return created by cashier B2, but in cashier B1's warehouse
        $salesReturn = SalesReturn::create([
            'code' => 'SR-TEST-WH-02',
            'warehouse_id' => $warehouseB->id,
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $cashierB2->id,
            'status' => 'draft',
            'return_type' => 'refund_cash',
            'refund_amount' => 60000,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
        ]);

        $salesReturn->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $product->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Retur sesama cabang',
            'restock_to_inventory' => true,
        ]);

        $response = $this
            ->actingAs($cashierB1)
            ->get(route('sales-returns.show', $salesReturn));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/SalesReturns/Show')
            ->where('salesReturn.id', $salesReturn->id)
        );
    }

    public function test_non_hq_user_cannot_access_sales_return_from_another_branch_not_belonging_to_them(): void
    {
        $warehouseA = Warehouse::create([
            'code' => 'WH-A3',
            'name' => 'Warehouse A3',
            'type' => 'branch',
            'is_active' => true,
        ]);
        $warehouseB = Warehouse::create([
            'code' => 'WH-B3',
            'name' => 'Warehouse B3',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $cashierB = $this->createUserWithPermissions([
            'transactions-access',
            'sales-returns-access',
        ]);
        $cashierB->update(['warehouse_id' => $warehouseB->id]);

        $cashierA = User::factory()->create(['warehouse_id' => $warehouseA->id]);

        [$transaction, $detail, $product] = $this->createTransaction($cashierA);
        $transaction->update(['warehouse_id' => $warehouseA->id]);

        // Sales return at warehouse A by cashier A
        $salesReturnA = SalesReturn::create([
            'code' => 'SR-TEST-FORBID-03',
            'warehouse_id' => $warehouseA->id,
            'transaction_id' => $transaction->id,
            'customer_id' => $transaction->customer_id,
            'cashier_id' => $cashierA->id,
            'status' => 'draft',
            'return_type' => 'refund_cash',
            'refund_amount' => 60000,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
        ]);

        $salesReturnA->items()->create([
            'transaction_detail_id' => $detail->id,
            'product_id' => $product->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Retur cabang lain',
            'restock_to_inventory' => true,
        ]);

        // Attempting to access sales return belonging to warehouse A as user from warehouse B
        $response = $this
            ->actingAs($cashierB)
            ->get(route('sales-returns.show', $salesReturnA));

        $response->assertNotFound();

        // Index should not show it
        $indexResponse = $this
            ->actingAs($cashierB)
            ->get(route('sales-returns.index'));

        $indexResponse->assertOk();
        $indexResponse->assertInertia(fn ($page) => $page
            ->component('Dashboard/SalesReturns/Index')
            ->has('salesReturns.data', 0)
        );
    }

    public function test_super_admin_has_global_access_to_sales_returns_across_warehouses(): void
    {
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);

        $superAdmin = User::factory()->create(['warehouse_id' => null]);
        $superAdmin->assignRole('super-admin');

        $warehouseA = Warehouse::create([
            'code' => 'WH-SA1',
            'name' => 'Branch 1',
            'type' => 'branch',
            'is_active' => true,
        ]);
        $warehouseB = Warehouse::create([
            'code' => 'WH-SA2',
            'name' => 'Branch 2',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $cashierA = User::factory()->create(['warehouse_id' => $warehouseA->id]);
        $cashierB = User::factory()->create(['warehouse_id' => $warehouseB->id]);

        [$transactionA, $detailA, $productA] = $this->createTransaction($cashierA);
        $transactionA->update(['warehouse_id' => $warehouseA->id]);

        [$transactionB, $detailB, $productB] = $this->createTransaction($cashierB);
        $transactionB->update(['warehouse_id' => $warehouseB->id]);

        $returnA = SalesReturn::create([
            'code' => 'SR-SA-01',
            'warehouse_id' => $warehouseA->id,
            'transaction_id' => $transactionA->id,
            'customer_id' => $transactionA->customer_id,
            'cashier_id' => $cashierA->id,
            'status' => 'draft',
            'return_type' => 'refund_cash',
            'refund_amount' => 60000,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
        ]);
        $returnA->items()->create([
            'transaction_detail_id' => $detailA->id,
            'product_id' => $productA->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Retur A',
            'restock_to_inventory' => true,
        ]);

        $returnB = SalesReturn::create([
            'code' => 'SR-SA-02',
            'warehouse_id' => $warehouseB->id,
            'transaction_id' => $transactionB->id,
            'customer_id' => $transactionB->customer_id,
            'cashier_id' => $cashierB->id,
            'status' => 'draft',
            'return_type' => 'refund_cash',
            'refund_amount' => 60000,
            'credited_amount' => 0,
            'total_return_amount' => 60000,
        ]);
        $returnB->items()->create([
            'transaction_detail_id' => $detailB->id,
            'product_id' => $productB->id,
            'qty_sold' => 1,
            'qty_returned_before' => 0,
            'qty_return' => 1,
            'unit_price' => 60000,
            'subtotal' => 60000,
            'return_reason' => 'Retur B',
            'restock_to_inventory' => true,
        ]);

        // Super Admin can access both show pages
        $this->actingAs($superAdmin)
            ->get(route('sales-returns.show', $returnA))
            ->assertOk();

        $this->actingAs($superAdmin)
            ->get(route('sales-returns.show', $returnB))
            ->assertOk();

        // Super Admin sees all returns across branches in index
        $indexResponse = $this->actingAs($superAdmin)
            ->get(route('sales-returns.index'));

        $indexResponse->assertOk();
        $indexResponse->assertInertia(fn ($page) => $page
            ->component('Dashboard/SalesReturns/Index')
            ->has('salesReturns.data', 2)
        );
    }

    private function createProduct(int $sellPrice = 60000, int $buyPrice = 40000, int $stock = 10): Product
    {
        $category = Category::firstOrCreate([
            'name' => 'General Category',
        ], [
            'description' => 'General category',
            'image' => 'category.png',
        ]);

        return Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(10)),
            'sku' => 'SKU-'.Str::upper(Str::random(10)),
            'title' => 'Produk Baru '.Str::upper(Str::random(4)),
            'description' => 'Deskripsi produk.',
            'buy_price' => $buyPrice,
            'sell_price' => $sellPrice,
            'stock' => $stock,
            'tax_rate' => 0,
        ]);
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo($permissions);

        return $user;
    }

    private function createTransaction(
        User $user,
        int $qty = 1,
        int $stock = 10,
        bool $withCustomer = true,
        string $paymentMethod = 'cash',
        string $paymentStatus = 'paid',
        bool $withReceivable = false
    ): array {
        $category = Category::create([
            'name' => 'Kategori '.Str::upper(Str::random(5)),
            'description' => 'Kategori pengujian',
            'image' => 'category.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(10)),
            'sku' => 'SKU-'.Str::upper(Str::random(10)),
            'title' => 'Produk Uji '.Str::upper(Str::random(4)),
            'description' => 'Deskripsi produk uji.',
            'buy_price' => 45000,
            'sell_price' => 60000,
            'stock' => $stock,
            'tax_rate' => 0,
        ]);

        $customer = $withCustomer
            ? Customer::create([
                'name' => 'Customer Test',
                'no_telp' => '08123456789',
                'address' => 'Jalan Test',
            ])
            : null;

        $transaction = Transaction::create([
            'cashier_id' => $user->id,
            'cashier_shift_id' => null,
            'customer_id' => $customer?->id,
            'invoice' => 'TRX-'.Str::upper(Str::random(8)),
            'cash' => 60000 * $qty,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => 60000 * $qty,
            'payment_method' => $paymentMethod,
            'payment_status' => $paymentStatus,
            'payment_reference' => null,
            'payment_url' => null,
            'bank_account_id' => null,
        ]);

        $detail = $transaction->details()->create([
            'product_id' => $product->id,
            'qty' => $qty,
            'price' => 60000,
        ]);

        $transaction->profits()->create([
            'total' => 15000 * $qty,
        ]);

        if ($withReceivable) {
            Receivable::create([
                'customer_id' => $customer?->id,
                'transaction_id' => $transaction->id,
                'invoice' => $transaction->invoice,
                'total' => $transaction->grand_total,
                'paid' => $transaction->grand_total,
                'due_date' => now()->addDays(7),
                'status' => 'paid',
            ]);
        }

        return [$transaction->fresh(['details', 'receivable']), $detail, $product, $customer];
    }

    private function openShiftFor(User $user)
    {
        return CashierShift::create([
            'user_id' => $user->id,
            'opened_by' => $user->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => 'open',
        ]);
    }
}
