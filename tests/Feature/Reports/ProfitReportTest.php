<?php

namespace Tests\Feature\Reports;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
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

class ProfitReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['profits-access', 'reports-access'] as $perm) {
            Permission::firstOrCreate([
                'name' => $perm,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_unauthenticated_user_is_redirected_to_login(): void
    {
        $response = $this->get(route('reports.profits.index'));

        $response->assertRedirect(route('login'));
    }

    public function test_unauthorized_user_cannot_access_profit_report(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('reports.profits.index'));

        $response->assertForbidden();
    }

    public function test_authorized_user_can_access_profit_report_page(): void
    {
        $user = $this->createUserWithProfitAccess();

        $response = $this->actingAs($user)->get(route('reports.profits.index'));

        $response
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Reports/Profit')
                ->has('transactions')
                ->has('summary')
                ->has('filters')
                ->has('cashiers')
                ->has('customers')
                ->has('warehouses')
                ->has('is_locked_branch')
            );
    }

    public function test_profit_report_calculates_summary_metrics_precisely(): void
    {
        $user = $this->createUserWithProfitAccess();
        $category = Category::create([
            'name' => 'Test Category',
            'description' => 'Test',
            'image' => 'category.png',
        ]);
        $customer = Customer::create([
            'name' => 'John Doe',
            'no_telp' => '08123456789',
            'address' => 'Jakarta',
        ]);

        $productA = Product::create([
            'category_id' => $category->id,
            'image' => 'p1.png',
            'barcode' => 'BC-A01',
            'sku' => 'SKU-A01',
            'title' => 'Produk A',
            'description' => 'Produk A',
            'buy_price' => 70000,
            'sell_price' => 100000,
            'stock' => 10,
            'tax_rate' => 0,
        ]);

        $productB = Product::create([
            'category_id' => $category->id,
            'image' => 'p2.png',
            'barcode' => 'BC-B01',
            'sku' => 'SKU-B01',
            'title' => 'Produk B',
            'description' => 'Produk B',
            'buy_price' => 30000,
            'sell_price' => 50000,
            'stock' => 10,
            'tax_rate' => 0,
        ]);

        // Transaction 1: 2x Produk A => Revenue: 200k, HPP: 140k, Profit: 60k
        $this->createTransactionWithLines($user, $customer, [
            ['product' => $productA, 'qty' => 2, 'unit_price' => 100000],
        ]);

        // Transaction 2: 1x Produk B => Revenue: 50k, HPP: 30k, Profit: 20k
        $this->createTransactionWithLines($user, $customer, [
            ['product' => $productB, 'qty' => 1, 'unit_price' => 50000],
        ]);

        $response = $this->actingAs($user)->get(route('reports.profits.index'));

        $response->assertOk();
        $response->assertInertia(function (Assert $page) {
            $props = $page->toArray()['props'];
            $summary = $props['summary'];

            $this->assertSame(2, $summary['orders_count']);
            $this->assertSame(250000, $summary['revenue_total']);
            $this->assertSame(80000, $summary['profit_total']);
            $this->assertSame(3, $summary['items_sold']);
            $this->assertSame(40000, $summary['average_profit']); // 80000 / 2
            $this->assertSame(32.0, (float) $summary['margin']); // (80000 / 250000) * 100 = 32%
            $this->assertSame(60000, $summary['best_profit']);
        });
    }

    public function test_profit_report_reconciles_reduced_profit_when_sales_return_occurs(): void
    {
        $user = $this->createUserWithProfitAccess();
        $category = Category::create([
            'name' => 'Category Return',
            'description' => 'Test',
            'image' => 'category.png',
        ]);
        $customer = Customer::create([
            'name' => 'Jane Smith',
            'no_telp' => '08987654321',
            'address' => 'Bandung',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'p-ret.png',
            'barcode' => 'BC-RET',
            'sku' => 'SKU-RET',
            'title' => 'Produk Retur',
            'description' => 'Produk Retur',
            'buy_price' => 70000,
            'sell_price' => 100000,
            'stock' => 5,
            'tax_rate' => 0,
        ]);

        // 1 Transaction: 1x Produk Retur (Revenue: 100k, Profit: 30k)
        $transaction = $this->createTransactionWithLines($user, $customer, [
            ['product' => $product, 'qty' => 1, 'unit_price' => 100000],
        ]);

        // Simulate sales return completed: margin 30k returned -> negative profit of -30,000 recorded
        $margin = (100000 - 70000) * 1;
        Profit::create([
            'transaction_id' => $transaction->id,
            'total' => -$margin,
        ]);

        $response = $this->actingAs($user)->get(route('reports.profits.index'));

        $response->assertOk();
        $response->assertInertia(function (Assert $page) {
            $props = $page->toArray()['props'];
            $summary = $props['summary'];

            $this->assertSame(1, $summary['orders_count']);
            $this->assertSame(100000, $summary['revenue_total']);
            $this->assertSame(0, $summary['profit_total']); // 30,000 - 30,000 = 0
            $this->assertSame(0.0, (float) $summary['margin']);
        });
    }

    public function test_profit_report_filters_by_date_range_cashier_customer_and_warehouse(): void
    {
        $user = $this->createUserWithProfitAccess();
        $category = Category::create([
            'name' => 'Filter Cat',
            'description' => 'Test',
            'image' => 'cat.png',
        ]);
        $customerA = Customer::create(['name' => 'Cust A', 'no_telp' => '081', 'address' => 'A']);
        $customerB = Customer::create(['name' => 'Cust B', 'no_telp' => '082', 'address' => 'B']);

        $cashierA = User::factory()->create(['name' => 'Cashier A']);
        $cashierB = User::factory()->create(['name' => 'Cashier B']);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'p.png',
            'barcode' => 'BC-FLT',
            'sku' => 'SKU-FLT',
            'title' => 'Produk Filter',
            'description' => 'Filter',
            'buy_price' => 50000,
            'sell_price' => 80000,
            'stock' => 20,
            'tax_rate' => 0,
        ]);

        // Transaction A on 2026-05-01 by Cashier A for Cust A (Profit: 30k)
        $trxA = $this->createTransactionWithLines($cashierA, $customerA, [
            ['product' => $product, 'qty' => 1, 'unit_price' => 80000],
        ], Carbon::parse('2026-05-01 10:00:00'));

        // Transaction B on 2026-05-05 by Cashier B for Cust B (Profit: 60k)
        $trxB = $this->createTransactionWithLines($cashierB, $customerB, [
            ['product' => $product, 'qty' => 2, 'unit_price' => 80000],
        ], Carbon::parse('2026-05-05 14:00:00'));

        // Filter by Date Range (only 2026-05-05)
        $resDate = $this->actingAs($user)->get(route('reports.profits.index', [
            'start_date' => '2026-05-05',
            'end_date' => '2026-05-05',
        ]));
        $resDate->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('summary.orders_count', 1)
            ->where('summary.profit_total', 60000)
            ->where('summary.revenue_total', 160000)
        );

        // Filter by Cashier (only Cashier A)
        $resCashier = $this->actingAs($user)->get(route('reports.profits.index', [
            'cashier_id' => $cashierA->id,
        ]));
        $resCashier->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('summary.orders_count', 1)
            ->where('summary.profit_total', 30000)
        );

        // Filter by Customer (only Customer B)
        $resCust = $this->actingAs($user)->get(route('reports.profits.index', [
            'customer_id' => $customerB->id,
        ]));
        $resCust->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('summary.orders_count', 1)
            ->where('summary.profit_total', 60000)
        );
    }

    public function test_branch_locked_user_only_sees_profit_report_for_assigned_warehouse(): void
    {
        $warehouseA = Warehouse::create(['name' => 'Cabang Jakarta', 'code' => 'JKT', 'status' => 'active']);
        $warehouseB = Warehouse::create(['name' => 'Cabang Surabaya', 'code' => 'SBY', 'status' => 'active']);

        $branchUser = User::factory()->create([
            'warehouse_id' => $warehouseA->id,
        ]);
        $branchUser->givePermissionTo('profits-access');

        $category = Category::create([
            'name' => 'Branch Cat',
            'description' => 'Test',
            'image' => 'cat.png',
        ]);
        $customer = Customer::create(['name' => 'Cust Branch', 'no_telp' => '0812', 'address' => 'Branch']);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'p.png',
            'barcode' => 'BC-BR',
            'sku' => 'SKU-BR',
            'title' => 'Produk Branch',
            'description' => 'Branch',
            'buy_price' => 50000,
            'sell_price' => 100000,
            'stock' => 20,
            'tax_rate' => 0,
        ]);

        // Transaction in Warehouse A (Profit: 50k)
        $this->createTransactionWithLines($branchUser, $customer, [
            ['product' => $product, 'qty' => 1, 'unit_price' => 100000],
        ], warehouseId: $warehouseA->id);

        // Transaction in Warehouse B (Profit: 100k)
        $this->createTransactionWithLines($branchUser, $customer, [
            ['product' => $product, 'qty' => 2, 'unit_price' => 100000],
        ], warehouseId: $warehouseB->id);

        // Branch user (locked to Warehouse A) visits profit report
        $response = $this->actingAs($branchUser)->get(route('reports.profits.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('is_locked_branch', true)
            ->where('summary.orders_count', 1)
            ->where('summary.profit_total', 50000)
            ->where('summary.revenue_total', 100000)
        );
    }

    private function createUserWithProfitAccess(): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo('profits-access');

        return $user;
    }

    private function createTransactionWithLines(
        User $cashier,
        Customer $customer,
        array $lines,
        ?Carbon $createdAt = null,
        ?int $warehouseId = null
    ): Transaction {
        $grandTotal = 0;
        foreach ($lines as $l) {
            $grandTotal += ($l['unit_price'] ?? $l['product']->sell_price) * $l['qty'];
        }

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => $customer->id,
            'warehouse_id' => $warehouseId,
            'invoice' => 'TRX-'.Str::upper(Str::random(8)),
            'cash' => $grandTotal,
            'change' => 0,
            'discount' => 0,
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
                'total' => $lineTotal - ((int) $product->buy_price * $qty),
            ]);

            if ($createdAt) {
                $detail->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->saveQuietly();
                $profit->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->saveQuietly();
            }
        }

        return $transaction;
    }
}
