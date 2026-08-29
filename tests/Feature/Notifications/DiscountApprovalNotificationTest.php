<?php

namespace Tests\Feature\Notifications;

use App\Models\DiscountApprovalLog;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DiscountApprovalNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Permission::findOrCreate('dashboard-access', 'web');
        Permission::findOrCreate('discounts-approve', 'web');
        Permission::findOrCreate('transactions-access', 'web');
    }

    public function test_pending_discount_approval_appears_in_shared_inertia_notifications_for_superadmin(): void
    {
        $superAdminRole = Role::findOrCreate('super-admin', 'web');
        $admin = User::factory()->create();
        $admin->assignRole($superAdminRole);

        $cashier = User::factory()->create(['name' => 'Budi Kasir']);

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => null,
            'invoice' => 'TRX-NOTIF-TEST-001',
            'cash' => 80000,
            'change' => 0,
            'discount' => 20000,
            'grand_total' => 80000,
            'payment_method' => 'cash',
            'payment_status' => 'pending_approval',
            'discount_approval_status' => 'pending',
        ]);

        DiscountApprovalLog::create([
            'transaction_id' => $transaction->id,
            'cashier_id' => $cashier->id,
            'requested_discount' => 20000,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($admin)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingApprovalCount', 1)
            ->has('discountApprovalNotifications', 1)
            ->where('discountApprovalNotifications.0.id', $transaction->id)
            ->where('discountApprovalNotifications.0.invoice', 'TRX-NOTIF-TEST-001')
            ->where('discountApprovalNotifications.0.cashier', 'Budi Kasir')
            ->where('discountApprovalNotifications.0.discount', 20000)
            ->where('discountApprovalNotifications.0.grand_total', 80000)
        );
    }

    public function test_pending_discount_approval_appears_for_user_with_discounts_approve_permission(): void
    {
        $supervisor = User::factory()->create();
        $supervisor->givePermissionTo('dashboard-access');
        $supervisor->givePermissionTo('discounts-approve');

        $cashier = User::factory()->create(['name' => 'Siti Kasir']);

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => null,
            'invoice' => 'TRX-NOTIF-TEST-002',
            'cash' => 50000,
            'change' => 0,
            'discount' => 15000,
            'grand_total' => 50000,
            'payment_method' => 'cash',
            'payment_status' => 'pending_approval',
            'discount_approval_status' => 'pending',
        ]);

        DiscountApprovalLog::create([
            'transaction_id' => $transaction->id,
            'cashier_id' => $cashier->id,
            'requested_discount' => 15000,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($supervisor)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingApprovalCount', 1)
            ->has('discountApprovalNotifications', 1)
            ->where('discountApprovalNotifications.0.invoice', 'TRX-NOTIF-TEST-002')
            ->where('discountApprovalNotifications.0.cashier', 'Siti Kasir')
            ->where('discountApprovalNotifications.0.discount', 15000)
        );
    }

    public function test_user_without_discounts_approve_permission_does_not_receive_discount_approval_notifications(): void
    {
        $cashier = User::factory()->create();
        $cashier->givePermissionTo('dashboard-access');

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => null,
            'invoice' => 'TRX-NOTIF-TEST-003',
            'cash' => 50000,
            'change' => 0,
            'discount' => 15000,
            'grand_total' => 50000,
            'payment_method' => 'cash',
            'payment_status' => 'pending_approval',
            'discount_approval_status' => 'pending',
        ]);

        DiscountApprovalLog::create([
            'transaction_id' => $transaction->id,
            'cashier_id' => $cashier->id,
            'requested_discount' => 15000,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($cashier)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingApprovalCount', 0)
            ->has('discountApprovalNotifications', 0)
        );
    }

    public function test_approving_discount_updates_notification_count_and_status(): void
    {
        $superAdminRole = Role::findOrCreate('super-admin', 'web');
        $admin = User::factory()->create();
        $admin->assignRole($superAdminRole);

        $cashier = User::factory()->create();

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => null,
            'invoice' => 'TRX-NOTIF-TEST-004',
            'cash' => 80000,
            'change' => 0,
            'discount' => 20000,
            'grand_total' => 80000,
            'payment_method' => 'cash',
            'payment_status' => 'pending_approval',
            'discount_approval_status' => 'pending',
        ]);

        DiscountApprovalLog::create([
            'transaction_id' => $transaction->id,
            'cashier_id' => $cashier->id,
            'requested_discount' => 20000,
            'status' => 'pending',
        ]);

        // Approve discount
        $this->actingAs($admin)->post(route('discount-approvals.approve', $transaction->id))
            ->assertRedirect();

        $transaction->refresh();
        $this->assertEquals('approved', $transaction->discount_approval_status);

        // Check shared props after approval
        $response = $this->actingAs($admin)->get(route('dashboard'));
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingApprovalCount', 0)
            ->has('discountApprovalNotifications', 0)
        );
    }
}
