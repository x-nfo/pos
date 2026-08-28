<?php

namespace Tests\Feature\Settings;

use App\Models\Cart;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\DiscountApprovalLog;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DiscountApprovalSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    public function test_super_admin_can_view_discount_approval_settings_in_payments_page(): void
    {
        Setting::set('discount_approval_threshold', '50000');
        Setting::set('discount_approval_percent_threshold', '15');
        Setting::set('discount_approval_timeout', '600');

        $superAdmin = User::factory()->create();
        $superAdmin->assignRole('super-admin');

        $response = $this->actingAs($superAdmin)->get(route('settings.payments.edit'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Settings/Payment')
                ->where('setting.discount_approval_threshold', 50000)
                ->where('setting.discount_approval_percent_threshold', 15)
                ->where('setting.discount_approval_timeout', 600)
            );
    }

    public function test_super_admin_can_update_discount_approval_settings(): void
    {
        $superAdmin = User::factory()->create();
        $superAdmin->assignRole('super-admin');

        $response = $this
            ->actingAs($superAdmin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('settings.payments.update'), [
                'default_gateway' => 'cash',
                'discount_approval_threshold' => 75000,
                'discount_approval_percent_threshold' => 20,
                'discount_approval_timeout' => 450,
                'receivable_approval_threshold' => 500000,
            ]);

        $response->assertRedirect();
        $this->assertEquals(75000, (float) Setting::get('discount_approval_threshold'));
        $this->assertEquals(20, (float) Setting::get('discount_approval_percent_threshold'));
        $this->assertEquals(450, (int) Setting::get('discount_approval_timeout'));
    }

    public function test_pos_transaction_with_discount_above_threshold_requires_approval(): void
    {
        Setting::set('discount_approval_threshold', '50000');
        Setting::set('tax_default_rate', '0');

        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        CashierShift::create([
            'user_id' => $cashier->id,
            'opened_by' => $cashier->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => 'open',
        ]);

        $category = Category::create([
            'name' => 'General',
            'description' => 'General',
            'image' => 'category.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'TEST123456',
            'title' => 'Sample Item',
            'description' => 'Sample description',
            'buy_price' => 50000,
            'sell_price' => 100000,
            'stock' => 10,
            'min_stock' => 1,
            'unit' => 'pcs',
            'tax_rate' => 0,
        ]);

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => 100000,
        ]);

        $response = $this->actingAs($cashier)->post(route('transactions.store'), [
            'discount' => 60000, // Diskon 60.000 > Threshold 50.000
            'grand_total' => 40000,
            'cash' => 40000,
            'change' => 0,
            'customer_id' => null,
        ]);

        $transaction = Transaction::latest('id')->first();
        $this->assertNotNull($transaction);
        $this->assertEquals('pending', $transaction->discount_approval_status);
        $this->assertEquals('pending_approval', $transaction->payment_status);

        $log = DiscountApprovalLog::where('transaction_id', $transaction->id)->first();
        $this->assertNotNull($log);
        $this->assertEquals('pending', $log->status);
        $this->assertEquals(60000, $log->requested_discount);

        $response->assertRedirect(route('transactions.print', $transaction->invoice));
    }

    public function test_pos_transaction_with_discount_below_threshold_does_not_require_approval(): void
    {
        Setting::set('discount_approval_threshold', '50000');
        Setting::set('tax_default_rate', '0');

        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        CashierShift::create([
            'user_id' => $cashier->id,
            'opened_by' => $cashier->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => 'open',
        ]);

        $category = Category::create([
            'name' => 'General',
            'description' => 'General',
            'image' => 'category.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'TEST654321',
            'title' => 'Sample Item 2',
            'description' => 'Sample description',
            'buy_price' => 50000,
            'sell_price' => 100000,
            'stock' => 10,
            'min_stock' => 1,
            'unit' => 'pcs',
            'tax_rate' => 0,
        ]);

        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => 100000,
        ]);

        $response = $this->actingAs($cashier)->post(route('transactions.store'), [
            'discount' => 20000, // Diskon 20.000 < Threshold 50.000
            'grand_total' => 80000,
            'cash' => 80000,
            'change' => 0,
            'customer_id' => null,
        ]);

        $transaction = Transaction::latest('id')->first();
        $this->assertNotNull($transaction);
        $this->assertNull($transaction->discount_approval_status);
        $this->assertEquals('paid', $transaction->payment_status);
    }

    public function test_supervisor_can_approve_and_deny_pending_discount(): void
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $admin = User::factory()->create();
        $admin->assignRole('super-admin');

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => null,
            'invoice' => 'TRX-APPROVAL-TEST-001',
            'cash' => 40000,
            'change' => 0,
            'discount' => 60000,
            'grand_total' => 40000,
            'payment_method' => 'cash',
            'payment_status' => 'pending_approval',
            'discount_approval_status' => 'pending',
        ]);

        DiscountApprovalLog::create([
            'transaction_id' => $transaction->id,
            'cashier_id' => $cashier->id,
            'requested_discount' => 60000,
            'status' => 'pending',
        ]);

        // Test Supervisor pending list
        $this->actingAs($admin)->get(route('discount-approvals.pending'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/DiscountApprovals')
                ->has('pendingTransactions', 1)
            );

        // Test Approve
        $this->actingAs($admin)->post(route('discount-approvals.approve', $transaction->id))
            ->assertRedirect();

        $transaction->refresh();
        $this->assertEquals('approved', $transaction->discount_approval_status);
        $this->assertEquals('paid', $transaction->payment_status);
        $this->assertEquals($admin->id, $transaction->discount_approved_by);
    }
}
