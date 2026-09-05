<?php

namespace Tests\Feature\Reports;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Profit;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class SalesReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate([
            'name' => 'reports-access',
            'guard_name' => 'web',
        ]);
    }

    public function test_unauthenticated_user_is_redirected_to_login(): void
    {
        $response = $this->get(route('reports.sales.index'));

        $response->assertRedirect(route('login'));
    }

    public function test_unauthorized_user_cannot_access_sales_report(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('reports.sales.index'));

        $response->assertForbidden();
    }

    public function test_authorized_user_can_access_sales_report_page(): void
    {
        $user = $this->createUserWithReportsAccess();

        $response = $this->actingAs($user)->get(route('reports.sales.index'));

        $response
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Reports/Sales')
                ->has('transactions')
                ->has('summary')
                ->has('filters')
                ->has('cashiers')
                ->has('customers')
                ->has('warehouses')
                ->has('is_locked_branch')
            );
    }

    public function test_sales_report_calculates_summary_metrics_precisely(): void
    {
        $user = $this->createUserWithReportsAccess();
        $category = Category::create([
            'name' => 'Sales Category',
            'description' => 'Test',
            'image' => 'category.png',
        ]);
        $customer = Customer::create([
            'name' => 'Budi Santoso',
            'no_telp' => '08111222333',
            'address' => 'Jakarta Barat',
        ]);

        $productA = Product::create([
            'category_id' => $category->id,
            'image' => 'p1.png',
            'barcode' => 'BRC-S01',
            'sku' => 'SKU-S01',
            'title' => 'Produk S1',
            'description' => 'Produk S1',
            'buy_price' => 25000,
            'sell_price' => 50000,
            'stock' => 20,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $productA->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 20]);

        $productB = Product::create([
            'category_id' => $category->id,
            'image' => 'p2.png',
            'barcode' => 'BRC-S02',
            'sku' => 'SKU-S02',
            'title' => 'Produk S2',
            'description' => 'Produk S2',
            'buy_price' => 40000,
            'sell_price' => 70000,
            'stock' => 15,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $productB->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 15]);

        // Transaction 1: 2x Product A, discount 5k => Grand Total 95k, Profit 45k
        $this->createTransactionWithLines($user, $customer, [
            ['product' => $productA, 'qty' => 2, 'unit_price' => 50000],
        ], discount: 5000);

        // Transaction 2: 1x Product B, discount 0 => Grand Total 70k, Profit 30k
        $this->createTransactionWithLines($user, $customer, [
            ['product' => $productB, 'qty' => 1, 'unit_price' => 70000],
        ], discount: 0);

        $response = $this->actingAs($user)->get(route('reports.sales.index'));

        $response->assertOk();
        $response->assertInertia(function (Assert $page) {
            $props = $page->toArray()['props'];
            $summary = $props['summary'];

            $this->assertSame(2, $summary['orders_count']);
            $this->assertSame(165000, $summary['revenue_total']); // 95k + 70k
            $this->assertSame(5000, $summary['discount_total']);
            $this->assertSame(3, $summary['items_sold']); // 2 + 1
            $this->assertSame(75000, $summary['profit_total']); // 45k + 30k
            $this->assertSame((int) round(165000 / 2), $summary['average_order']);
        });
    }

    public function test_sales_report_reconciles_returns_and_reduced_profit(): void
    {
        $user = $this->createUserWithReportsAccess();
        $category = Category::create([
            'name' => 'Category Return Test',
            'description' => 'Test',
            'image' => 'category.png',
        ]);
        $customer = Customer::create([
            'name' => 'Rina',
            'no_telp' => '08777777777',
            'address' => 'Surabaya',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'p.png',
            'barcode' => 'BRC-RET-01',
            'sku' => 'SKU-RET-01',
            'title' => 'Produk Retur Transaksi',
            'description' => 'Produk Retur',
            'buy_price' => 70000,
            'sell_price' => 100000,
            'stock' => 10,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $product->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 10]);

        // Initial transaction: Rp 100.000, Profit Rp 30.000
        $transaction = $this->createTransactionWithLines($user, $customer, [
            ['product' => $product, 'qty' => 1, 'unit_price' => 100000],
        ]);

        // Simulate return reconciliation: return reduces transaction profit by Rp 30.000
        Profit::create([
            'transaction_id' => $transaction->id,
            'total' => -30000,
        ]);

        $response = $this->actingAs($user)->get(route('reports.sales.index'));

        $response->assertOk();
        $response->assertInertia(function (Assert $page) {
            $props = $page->toArray()['props'];
            $summary = $props['summary'];

            $this->assertSame(1, $summary['orders_count']);
            $this->assertSame(100000, $summary['revenue_total']);
            $this->assertSame(0, $summary['profit_total']); // 30k - 30k = 0
        });
    }

    public function test_sales_report_filters_by_date_range_cashier_customer_and_warehouse(): void
    {
        $user = $this->createUserWithReportsAccess();
        $category = Category::create([
            'name' => 'Filter Cat Sales',
            'description' => 'Test',
            'image' => 'cat.png',
        ]);
        $customerA = Customer::create(['name' => 'Cust A Sales', 'no_telp' => '081', 'address' => 'A']);
        $customerB = Customer::create(['name' => 'Cust B Sales', 'no_telp' => '082', 'address' => 'B']);

        $cashierA = User::factory()->create(['name' => 'Cashier Sales A']);
        $cashierB = User::factory()->create(['name' => 'Cashier Sales B']);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'p.png',
            'barcode' => 'BC-FLT-S',
            'sku' => 'SKU-FLT-S',
            'title' => 'Produk Filter Sales',
            'description' => 'Filter',
            'buy_price' => 30000,
            'sell_price' => 60000,
            'stock' => 30,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $product->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 30]);

        // Transaction A on 2026-06-01
        $this->createTransactionWithLines($cashierA, $customerA, [
            ['product' => $product, 'qty' => 1, 'unit_price' => 60000],
        ], createdAt: Carbon::parse('2026-06-01 09:00:00'));

        // Transaction B on 2026-06-10
        $this->createTransactionWithLines($cashierB, $customerB, [
            ['product' => $product, 'qty' => 3, 'unit_price' => 60000],
        ], createdAt: Carbon::parse('2026-06-10 15:00:00'));

        // Filter by Date Range
        $resDate = $this->actingAs($user)->get(route('reports.sales.index', [
            'start_date' => '2026-06-10',
            'end_date' => '2026-06-10',
        ]));
        $resDate->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('summary.orders_count', 1)
            ->where('summary.revenue_total', 180000)
            ->where('summary.items_sold', 3)
        );

        // Filter by Cashier
        $resCashier = $this->actingAs($user)->get(route('reports.sales.index', [
            'cashier_id' => $cashierA->id,
        ]));
        $resCashier->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('summary.orders_count', 1)
            ->where('summary.revenue_total', 60000)
        );

        // Filter by Customer
        $resCust = $this->actingAs($user)->get(route('reports.sales.index', [
            'customer_id' => $customerB->id,
        ]));
        $resCust->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('summary.orders_count', 1)
            ->where('summary.revenue_total', 180000)
        );
    }

    public function test_branch_locked_user_only_sees_sales_report_for_assigned_warehouse(): void
    {
        $warehouseA = Warehouse::create(['name' => 'Cabang Medan', 'code' => 'MDN', 'status' => 'active']);
        $warehouseB = Warehouse::create(['name' => 'Cabang Bali', 'code' => 'DPS', 'status' => 'active']);

        $branchUser = User::factory()->create([
            'warehouse_id' => $warehouseA->id,
        ]);
        $branchUser->givePermissionTo('reports-access');

        $category = Category::create([
            'name' => 'Branch Cat Sales',
            'description' => 'Test',
            'image' => 'cat.png',
        ]);
        $customer = Customer::create(['name' => 'Cust Branch Sales', 'no_telp' => '08123', 'address' => 'Branch']);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'p.png',
            'barcode' => 'BC-BR-S',
            'sku' => 'SKU-BR-S',
            'title' => 'Produk Branch Sales',
            'description' => 'Branch',
            'buy_price' => 20000,
            'sell_price' => 50000,
            'stock' => 20,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $product->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 20]);

        // Transaction in Warehouse A
        $this->createTransactionWithLines($branchUser, $customer, [
            ['product' => $product, 'qty' => 1, 'unit_price' => 50000],
        ], warehouseId: $warehouseA->id);

        // Transaction in Warehouse B
        $this->createTransactionWithLines($branchUser, $customer, [
            ['product' => $product, 'qty' => 3, 'unit_price' => 50000],
        ], warehouseId: $warehouseB->id);

        $response = $this->actingAs($branchUser)->get(route('reports.sales.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('is_locked_branch', true)
            ->where('summary.orders_count', 1)
            ->where('summary.revenue_total', 50000)
            ->where('summary.items_sold', 1)
        );
    }

    private function createUserWithReportsAccess(): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo('reports-access');

        return $user;
    }

    private function createTransactionWithLines(
        User $cashier,
        Customer $customer,
        array $lines,
        int $discount = 0,
        ?Carbon $createdAt = null,
        ?int $warehouseId = null
    ): Transaction {
        $subtotal = 0;
        foreach ($lines as $l) {
            $subtotal += ($l['unit_price'] ?? $l['product']->sell_price) * $l['qty'];
        }
        $grandTotal = max(0, $subtotal - $discount);

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => $customer->id,
            'warehouse_id' => $warehouseId ?? Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'invoice' => 'TRX-'.Str::upper(Str::random(8)),
            'cash' => $grandTotal,
            'change' => 0,
            'discount' => $discount,
            'shipping_cost' => 0,
            'grand_total' => $grandTotal,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        if ($createdAt) {
            $transaction->forceFill([
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ])->saveQuietly();
        }

        foreach ($lines as $line) {
            $product = $line['product'];
            $qty = $line['qty'];
            $unitPrice = $line['unit_price'] ?? $product->sell_price;
            $lineTotal = $unitPrice * $qty;

            $detail = $transaction->details()->create([
                'product_id' => $product->id,
                'qty' => $qty,
                'base_unit_price' => $product->sell_price,
                'unit_price' => $unitPrice,
                'price' => $lineTotal,
            ]);

            $profit = $transaction->profits()->create([
                'total' => $lineTotal - ((int) $product->buy_price * $qty) - $discount,
            ]);

            if ($createdAt) {
                $detail->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->saveQuietly();
                $profit->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->saveQuietly();
            }
        }

        return $transaction;
    }
}
