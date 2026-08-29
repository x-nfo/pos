<?php

namespace Tests\Feature\Notifications;

use App\Models\BankAccount;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BankPaymentNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Permission::findOrCreate('dashboard-access', 'web');
        Permission::findOrCreate('transactions-confirm-payment', 'web');
        Permission::findOrCreate('transactions-access', 'web');
    }

    public function test_pending_bank_payment_appears_in_shared_inertia_notifications_for_superadmin(): void
    {
        $superAdminRole = Role::findOrCreate('super-admin', 'web');
        $admin = User::factory()->create();
        $admin->assignRole($superAdminRole);

        $cashier = User::factory()->create(['name' => 'Budi Kasir']);
        $customer = Customer::create([
            'name' => 'Pak Joko',
            'no_telp' => '08123456789',
            'address' => 'Jl. Merdeka 10',
        ]);

        $bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_name' => 'PT Toko Retail',
            'account_number' => '1234567890',
            'is_active' => true,
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => $customer->id,
            'invoice' => 'TRX-BANK-001',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 250000,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'pending',
            'bank_account_id' => $bankAccount->id,
        ]);

        $response = $this->actingAs($admin)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingBankPaymentCount', 1)
            ->has('bankPaymentNotifications', 1)
            ->where('bankPaymentNotifications.0.id', $transaction->id)
            ->where('bankPaymentNotifications.0.invoice', 'TRX-BANK-001')
            ->where('bankPaymentNotifications.0.cashier', 'Budi Kasir')
            ->where('bankPaymentNotifications.0.customer', 'Pak Joko')
            ->where('bankPaymentNotifications.0.bank_name', 'BCA')
            ->where('bankPaymentNotifications.0.account_number', '1234567890')
            ->where('bankPaymentNotifications.0.account_name', 'PT Toko Retail')
            ->where('bankPaymentNotifications.0.grand_total', 250000)
        );
    }

    public function test_pending_bank_payment_appears_for_user_with_confirm_payment_permission(): void
    {
        $supervisor = User::factory()->create();
        $supervisor->givePermissionTo('dashboard-access');
        $supervisor->givePermissionTo('transactions-confirm-payment');

        $cashier = User::factory()->create(['name' => 'Siti Kasir']);

        $bankAccount = BankAccount::create([
            'bank_name' => 'Mandiri',
            'account_name' => 'Toko Sentosa',
            'account_number' => '9876543210',
            'is_active' => true,
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => null,
            'invoice' => 'TRX-BANK-002',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 175000,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'pending',
            'bank_account_id' => $bankAccount->id,
        ]);

        $response = $this->actingAs($supervisor)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingBankPaymentCount', 1)
            ->has('bankPaymentNotifications', 1)
            ->where('bankPaymentNotifications.0.invoice', 'TRX-BANK-002')
            ->where('bankPaymentNotifications.0.cashier', 'Siti Kasir')
            ->where('bankPaymentNotifications.0.bank_name', 'Mandiri')
            ->where('bankPaymentNotifications.0.grand_total', 175000)
        );
    }

    public function test_user_without_confirm_payment_permission_does_not_receive_bank_payment_notifications(): void
    {
        $cashier = User::factory()->create();
        $cashier->givePermissionTo('dashboard-access');

        $bankAccount = BankAccount::create([
            'bank_name' => 'BRI',
            'account_name' => 'Toko Anda',
            'account_number' => '5555555555',
            'is_active' => true,
        ]);

        Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => null,
            'invoice' => 'TRX-BANK-003',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 120000,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'pending',
            'bank_account_id' => $bankAccount->id,
        ]);

        $response = $this->actingAs($cashier)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingBankPaymentCount', 0)
            ->has('bankPaymentNotifications', 0)
        );
    }

    public function test_paid_or_non_bank_transactions_do_not_appear_in_bank_payment_notifications(): void
    {
        $superAdminRole = Role::findOrCreate('super-admin', 'web');
        $admin = User::factory()->create();
        $admin->assignRole($superAdminRole);

        $bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_name' => 'Toko Anda',
            'account_number' => '1234567890',
            'is_active' => true,
        ]);

        // Already paid bank transfer
        Transaction::create([
            'cashier_id' => $admin->id,
            'customer_id' => null,
            'invoice' => 'TRX-BANK-PAID',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 100000,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'paid',
            'bank_account_id' => $bankAccount->id,
        ]);

        // Cash transaction
        Transaction::create([
            'cashier_id' => $admin->id,
            'customer_id' => null,
            'invoice' => 'TRX-CASH-001',
            'cash' => 50000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 50000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $response = $this->actingAs($admin)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingBankPaymentCount', 0)
            ->has('bankPaymentNotifications', 0)
        );
    }

    public function test_confirming_bank_payment_updates_notification_count_and_status(): void
    {
        $superAdminRole = Role::findOrCreate('super-admin', 'web');
        $admin = User::factory()->create();
        $admin->assignRole($superAdminRole);

        $bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_name' => 'PT Toko Retail',
            'account_number' => '1234567890',
            'is_active' => true,
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $admin->id,
            'customer_id' => null,
            'invoice' => 'TRX-BANK-CONFIRM',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 300000,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'pending',
            'bank_account_id' => $bankAccount->id,
        ]);

        // Check before confirmation
        $responseBefore = $this->actingAs($admin)->get(route('dashboard'));
        $responseBefore->assertInertia(fn (Assert $page) => $page
            ->where('pendingBankPaymentCount', 1)
            ->has('bankPaymentNotifications', 1)
        );

        // Confirm payment with active step_up session
        $this->withSession($this->recentlyConfirmedSession())
            ->actingAs($admin)
            ->patch(route('transactions.confirm-payment', $transaction))
            ->assertRedirect();

        $transaction->refresh();
        $this->assertEquals('paid', $transaction->payment_status);
        $this->assertEquals($admin->id, $transaction->payment_confirmed_by);

        // Check after confirmation
        $responseAfter = $this->actingAs($admin)->get(route('dashboard'));
        $responseAfter->assertInertia(fn (Assert $page) => $page
            ->where('pendingBankPaymentCount', 0)
            ->has('bankPaymentNotifications', 0)
        );
    }
}
