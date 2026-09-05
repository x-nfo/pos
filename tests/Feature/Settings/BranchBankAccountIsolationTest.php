<?php

namespace Tests\Feature\Settings;

use App\Models\BankAccount;
use App\Models\Cart;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Payable;
use App\Models\PaymentSetting;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Receivable;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BranchBankAccountIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouseA;

    protected Warehouse $warehouseB;

    protected BankAccount $globalBank;

    protected BankAccount $bankA;

    protected BankAccount $bankB;

    protected BankAccount $inactiveBankA;

    protected User $admin;

    protected User $cashierA;

    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->warehouseA = Warehouse::create([
            'code' => 'WHA',
            'name' => 'Cabang Surabaya',
            'type' => 'branch',
            'address' => 'Jl. Surabaya No. 1',
            'is_active' => true,
        ]);

        $this->warehouseB = Warehouse::create([
            'code' => 'WHB',
            'name' => 'Cabang Malang',
            'type' => 'branch',
            'address' => 'Jl. Malang No. 2',
            'is_active' => true,
        ]);

        $this->globalBank = BankAccount::create([
            'warehouse_id' => null,
            'bank_name' => 'BCA Pusat',
            'account_number' => '1000000001',
            'account_name' => 'PT Rekasir Pusat',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $this->bankA = BankAccount::create([
            'warehouse_id' => $this->warehouseA->id,
            'bank_name' => 'Mandiri Surabaya',
            'account_number' => '2000000002',
            'account_name' => 'Rekasir Cabang Sby',
            'is_active' => true,
            'sort_order' => 2,
        ]);

        $this->bankB = BankAccount::create([
            'warehouse_id' => $this->warehouseB->id,
            'bank_name' => 'BRI Malang',
            'account_number' => '3000000003',
            'account_name' => 'Rekasir Cabang Malang',
            'is_active' => true,
            'sort_order' => 3,
        ]);

        $this->inactiveBankA = BankAccount::create([
            'warehouse_id' => $this->warehouseA->id,
            'bank_name' => 'BNI Sby Nonaktif',
            'account_number' => '4000000004',
            'account_name' => 'Rekasir Sby Inactive',
            'is_active' => false,
            'sort_order' => 4,
        ]);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('super-admin');

        $this->cashierA = User::factory()->create([
            'warehouse_id' => $this->warehouseA->id,
        ]);
        $this->cashierA->assignRole('cashier');

        PaymentSetting::create([
            'default_gateway' => 'cash',
            'bank_transfer_enabled' => true,
        ]);

        $category = Category::create([
            'name' => 'General',
            'description' => 'General Category',
        ]);

        $this->product = Product::create([
            'title' => 'Barang Uji',
            'barcode' => 'BARANG01',
            'category_id' => $category->id,
            'buy_price' => 10000,
            'sell_price' => 15000,
            'tax_rate' => 0,
        ]);

        $this->product->warehouses()->attach($this->warehouseA->id, ['stock' => 50]);
        $this->product->warehouses()->attach($this->warehouseB->id, ['stock' => 50]);
    }

    public function test_cashier_in_pos_only_receives_global_and_own_branch_bank_accounts(): void
    {
        CashierShift::create([
            'user_id' => $this->cashierA->id,
            'opened_by' => $this->cashierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => CashierShift::STATUS_OPEN,
        ]);

        $response = $this->actingAs($this->cashierA)
            ->get(route('transactions.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Transactions/Index')
            ->has('bankAccounts', 2)
            ->where('bankAccounts.0.id', $this->globalBank->id)
            ->where('bankAccounts.1.id', $this->bankA->id)
        );
    }

    public function test_cashier_cannot_checkout_using_bank_account_from_another_branch(): void
    {
        CashierShift::create([
            'user_id' => $this->cashierA->id,
            'opened_by' => $this->cashierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => CashierShift::STATUS_OPEN,
        ]);

        Cart::create([
            'cashier_id' => $this->cashierA->id,
            'product_id' => $this->product->id,
            'qty' => 1,
            'price' => 15000,
        ]);

        $response = $this->actingAs($this->cashierA)
            ->post(route('transactions.store'), [
                'payment_method' => 'bank_transfer',
                'payment_gateway' => 'bank_transfer',
                'bank_account_id' => $this->bankB->id, // Bank belongs to Warehouse B!
                'cash' => 0,
            ]);

        $response->assertSessionHasErrors('bank_account_id');
        $this->assertEquals(0, Transaction::count());
    }

    public function test_cashier_can_checkout_using_own_branch_or_global_bank_account(): void
    {
        $shift = CashierShift::create([
            'user_id' => $this->cashierA->id,
            'opened_by' => $this->cashierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => CashierShift::STATUS_OPEN,
        ]);

        // Checkout with branch bank account
        Cart::create([
            'cashier_id' => $this->cashierA->id,
            'product_id' => $this->product->id,
            'qty' => 1,
            'price' => 15000,
        ]);

        $response = $this->actingAs($this->cashierA)
            ->post(route('transactions.store'), [
                'payment_method' => 'bank_transfer',
                'payment_gateway' => 'bank_transfer',
                'bank_account_id' => $this->bankA->id,
                'cash' => 0,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('transactions', [
            'cashier_id' => $this->cashierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'bank_account_id' => $this->bankA->id,
            'payment_method' => 'bank_transfer',
        ]);

        // Checkout with global bank account
        Cart::create([
            'cashier_id' => $this->cashierA->id,
            'product_id' => $this->product->id,
            'qty' => 1,
            'price' => 15000,
        ]);

        $response2 = $this->actingAs($this->cashierA)
            ->post(route('transactions.store'), [
                'payment_method' => 'bank_transfer',
                'payment_gateway' => 'bank_transfer',
                'bank_account_id' => $this->globalBank->id,
                'cash' => 0,
            ]);

        $response2->assertRedirect();
        $this->assertDatabaseHas('transactions', [
            'cashier_id' => $this->cashierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'bank_account_id' => $this->globalBank->id,
            'payment_method' => 'bank_transfer',
        ]);
    }

    public function test_admin_can_manage_bank_accounts_with_warehouse(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('settings.bank-accounts.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Settings/BankAccounts')
            ->has('bankAccounts', 4)
            ->has('warehouses', 2)
        );

        // Create with warehouse
        $createResponse = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->post(route('settings.bank-accounts.store'), [
                'warehouse_id' => $this->warehouseA->id,
                'bank_name' => 'BSI Surabaya',
                'account_number' => '5000000005',
                'account_name' => 'BSI Cabang Sby',
                'is_active' => true,
            ]);

        $createResponse->assertRedirect(route('settings.bank-accounts.index'));
        $this->assertDatabaseHas('bank_accounts', [
            'bank_name' => 'BSI Surabaya',
            'warehouse_id' => $this->warehouseA->id,
        ]);

        $newBank = BankAccount::where('bank_name', 'BSI Surabaya')->firstOrFail();

        // Update to global (warehouse_id = null)
        $updateResponse = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->put(route('settings.bank-accounts.update', $newBank->id), [
                'warehouse_id' => null,
                'bank_name' => 'BSI Nasional',
                'account_number' => '5000000005',
                'account_name' => 'BSI Pusat',
                'is_active' => true,
            ]);

        $updateResponse->assertRedirect(route('settings.bank-accounts.index'));
        $this->assertDatabaseHas('bank_accounts', [
            'id' => $newBank->id,
            'bank_name' => 'BSI Nasional',
            'warehouse_id' => null,
        ]);
    }

    public function test_receivables_and_payables_scope_bank_accounts_by_warehouse(): void
    {
        $customer = Customer::create([
            'name' => 'Customer Sby',
            'no_telp' => '08123456789',
            'address' => 'Jl. Surabaya No. 10',
        ]);

        $shift = CashierShift::create([
            'user_id' => $this->cashierA->id,
            'opened_by' => $this->cashierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => CashierShift::STATUS_OPEN,
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $this->cashierA->id,
            'cashier_shift_id' => $shift->id,
            'warehouse_id' => $this->warehouseA->id,
            'customer_id' => $customer->id,
            'invoice' => 'TRX-SBY-001',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 50000,
            'payment_method' => 'pay_later',
            'payment_status' => 'unpaid',
        ]);

        $receivable = Receivable::create([
            'transaction_id' => $transaction->id,
            'customer_id' => $customer->id,
            'invoice' => $transaction->invoice,
            'total' => 50000,
            'nominal' => 0,
            'remaining' => 50000,
            'status' => 'unpaid',
            'due_date' => now()->addDays(7),
        ]);

        // Access receivable show as admin
        $receivableResponse = $this->actingAs($this->admin)
            ->get(route('receivables.show', $receivable->id));

        $receivableResponse->assertOk();
        $receivableResponse->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Receivables/Show')
            ->has('bankAccounts', 2)
            ->where('bankAccounts.0.id', $this->globalBank->id)
            ->where('bankAccounts.1.id', $this->bankA->id)
        );

        // Test payable show
        $supplier = Supplier::create([
            'name' => 'Supplier Malang',
            'phone' => '08987654321',
            'address' => 'Jl. Malang',
        ]);

        $po = PurchaseOrder::create([
            'document_number' => 'PO-WHB-001',
            'supplier_id' => $supplier->id,
            'warehouse_id' => $this->warehouseB->id,
            'user_id' => $this->admin->id,
            'total_amount' => 100000,
            'status' => 'approved',
        ]);

        $payable = Payable::create([
            'purchase_order_id' => $po->id,
            'warehouse_id' => $this->warehouseB->id,
            'supplier_id' => $supplier->id,
            'document_number' => 'AP-WHB-001',
            'total' => 100000,
            'paid' => 0,
            'status' => 'unpaid',
            'due_date' => now()->addDays(14),
        ]);

        $payableResponse = $this->actingAs($this->admin)
            ->get(route('payables.show', $payable->id));

        $payableResponse->assertOk();
        $payableResponse->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Payables/Show')
            ->has('bankAccounts', 2)
            ->where('bankAccounts.0.id', $this->globalBank->id)
            ->where('bankAccounts.1.id', $this->bankB->id)
        );
    }
}
