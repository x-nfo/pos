<?php

namespace Tests\Feature\Transactions;

use App\Models\Cart;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerVoucher;
use App\Models\LoyaltySetting;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Profit;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CheckoutServiceTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private CashierShift $shift;
    private Warehouse $warehouse;
    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $this->cashier   = $this->makeCashier();
        $this->warehouse = Warehouse::firstOrCreate(['code' => 'CHK-WH'], ['name' => 'Checkout Warehouse']);
        $this->shift     = $this->openShift($this->cashier, $this->warehouse);
        $this->category  = Category::create([
            'name'        => 'Checkout Category',
            'description' => 'Test',
            'image'       => 'cat.png',
        ]);

        Setting::set('tax_default_rate', '0.00'); // disable tax by default for simpler assertions
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function makeCashier(): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);
        return $user;
    }

    private function openShift(User $cashier, Warehouse $warehouse): CashierShift
    {
        return CashierShift::create([
            'user_id'      => $cashier->id,
            'opened_by'    => $cashier->id,
            'opened_at'    => now(),
            'opening_cash' => 0,
            'expected_cash'=> 0,
            'status'       => 'open',
            'warehouse_id' => $warehouse->id,
        ]);
    }

    private function makeProduct(int $sellPrice = 10000, int $buyPrice = 5000, int $stock = 50): Product
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'title'       => 'Product ' . Str::random(4),
            'barcode'     => 'BC-' . Str::upper(Str::random(8)),
            'sku'         => 'SK-' . Str::upper(Str::random(8)),
            'description' => 'Test',
            'image'       => 'test.png',
            'sell_price'  => $sellPrice,
            'buy_price'   => $buyPrice,
            'tax_rate'    => 0,
        ]);
        ProductWarehouse::create([
            'product_id'   => $product->id,
            'warehouse_id' => $this->warehouse->id,
            'stock'        => $stock,
        ]);
        return $product;
    }

    private function addToCart(Product $product, int $qty = 1): Cart
    {
        return Cart::create([
            'warehouse_id' => $this->warehouse->id,
            'cashier_id'   => $this->cashier->id,
            'product_id'   => $product->id,
            'qty'          => $qty,
            'price'        => $product->sell_price * $qty,
        ]);
    }

    private function checkout(array $override = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->cashier)->post(route('transactions.store'), array_merge([
            'customer_id' => null,
            'discount'    => 0,
            'grand_total' => 0,
            'cash'        => 0,
            'change'      => 0,
        ], $override));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Grand total & change
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_cash_checkout_sets_correct_grand_total_and_change(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $this->addToCart($product, qty: 3); // 30000

        $this->checkout([
            'grand_total' => 30000,
            'cash'        => 50000,
            'change'      => 20000,
        ])->assertRedirect();

        $tx = Transaction::latest('id')->first();

        $this->assertSame(30000, $tx->grand_total);
        $this->assertSame(50000, $tx->cash);
        $this->assertSame(20000, $tx->change);
        $this->assertSame('paid', $tx->payment_status);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Profit calculation — base (no discount)
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_checkout_records_correct_profit(): void
    {
        // sell 10000, buy 5000 → margin 5000 per unit
        $product = $this->makeProduct(sellPrice: 10000, buyPrice: 5000);
        $this->addToCart($product, qty: 2); // revenue 20000, buy 10000 → profit 10000

        $this->checkout([
            'grand_total' => 20000,
            'cash'        => 20000,
        ])->assertRedirect();

        $tx = Transaction::latest('id')->first();
        $profit = Profit::where('transaction_id', $tx->id)->sum('total');

        $this->assertSame(10000, (int) $profit);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Profit calculation — with manual discount (Issue #1 fix validation)
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_checkout_with_manual_discount_reduces_profit(): void
    {
        // sell 20000, buy 5000
        $product = $this->makeProduct(sellPrice: 20000, buyPrice: 5000);
        $this->addToCart($product, qty: 1);

        // manual discount 5000 → netSell = 15000, profit = 15000 - 5000 = 10000
        $grandTotal = 15000;
        $this->checkout([
            'discount'    => 5000,
            'grand_total' => $grandTotal,
            'cash'        => $grandTotal,
        ])->assertRedirect();

        $tx = Transaction::latest('id')->first();
        $profit = Profit::where('transaction_id', $tx->id)->sum('total');

        $this->assertSame(10000, (int) $profit);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Stock deduction
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_checkout_deducts_correct_stock(): void
    {
        $product = $this->makeProduct(sellPrice: 10000, stock: 20);
        $this->addToCart($product, qty: 5);

        $this->checkout([
            'grand_total' => 50000,
            'cash'        => 50000,
        ])->assertRedirect();

        $pivot = ProductWarehouse::where([
            'product_id'   => $product->id,
            'warehouse_id' => $this->warehouse->id,
        ])->first();

        $this->assertSame(15, (int) $pivot->stock); // 20 - 5 = 15
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Stock validation — oversell prevention
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_checkout_fails_when_stock_is_insufficient(): void
    {
        $product = $this->makeProduct(sellPrice: 10000, stock: 3);
        $this->addToCart($product, qty: 3); // just enough initially

        // Simulate stock dropped to 1 before checkout
        ProductWarehouse::where('product_id', $product->id)->update(['stock' => 1]);

        $response = $this->checkout([
            'grand_total' => 30000,
            'cash'        => 30000,
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('transactions', 0); // no transaction created
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Pay later (receivable created)
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_pay_later_checkout_creates_receivable(): void
    {
        $customer = Customer::create([
            'name'    => 'Pelanggan Kredit',
            'no_telp' => '08121111111',
            'address' => 'Jl. Test',
        ]);

        $product = $this->makeProduct(sellPrice: 50000);
        $this->addToCart($product, qty: 1);

        $this->checkout([
            'customer_id'    => $customer->id,
            'grand_total'    => 50000,
            'cash'           => 0,
            'pay_later'      => true,
            'due_date'       => now()->addDays(30)->format('Y-m-d'),
        ])->assertRedirect();

        $tx = Transaction::latest('id')->first();
        $this->assertNotNull($tx);
        $this->assertSame('unpaid', $tx->payment_status);
        $this->assertSame('pay_later', $tx->payment_method);

        $this->assertDatabaseHas('receivables', [
            'transaction_id' => $tx->id,
            'customer_id'    => $customer->id,
            'total'          => 50000,
            'paid'           => 0,
            'status'         => 'unpaid',
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Transaction settled scope — pending not included in revenue
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_settled_scope_excludes_pending_gateway_transactions(): void
    {
        // Create one paid and one pending transaction directly
        Transaction::create([
            'cashier_id'     => $this->cashier->id,
            'cashier_shift_id' => $this->shift->id,
            'warehouse_id'   => $this->warehouse->id,
            'invoice'        => 'INV-PAID-001',
            'cash'           => 100000,
            'change'         => 0,
            'discount'       => 0,
            'grand_total'    => 100000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        Transaction::create([
            'cashier_id'     => $this->cashier->id,
            'cashier_shift_id' => $this->shift->id,
            'warehouse_id'   => $this->warehouse->id,
            'invoice'        => 'INV-PEND-001',
            'cash'           => 0,
            'change'         => 0,
            'discount'       => 0,
            'grand_total'    => 50000,
            'payment_method' => 'midtrans',
            'payment_status' => 'pending', // not paid yet
        ]);

        // settled() should only include the paid one
        $revenue = Transaction::settled()->sum('grand_total');
        $count   = Transaction::settled()->count();

        $this->assertSame(100000, (int) $revenue);
        $this->assertSame(1, $count);
    }

    /** @test */
    public function test_settled_scope_includes_pay_later_transactions(): void
    {
        Transaction::create([
            'cashier_id'     => $this->cashier->id,
            'cashier_shift_id' => $this->shift->id,
            'warehouse_id'   => $this->warehouse->id,
            'invoice'        => 'INV-PAYLATER-001',
            'cash'           => 0,
            'change'         => 0,
            'discount'       => 0,
            'grand_total'    => 75000,
            'payment_method' => 'pay_later',
            'payment_status' => 'unpaid',
        ]);

        // pay_later should be included because the sale happened
        $revenue = Transaction::settled()->sum('grand_total');

        $this->assertSame(75000, (int) $revenue);
    }
}
