<?php

namespace Tests\Feature\Transactions;

use App\Models\DiscountApprovalLog;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DiscountApprovalVisibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    public function test_cashier_can_view_pending_discount_approval_on_print_page(): void
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => null,
            'invoice' => 'TRX-PENDING-DISC-001',
            'cash' => 50000,
            'change' => 0,
            'discount' => 50000,
            'grand_total' => 50000,
            'payment_method' => 'cash',
            'payment_status' => 'pending_approval',
            'discount_approval_status' => 'pending',
        ]);

        DiscountApprovalLog::create([
            'transaction_id' => $transaction->id,
            'cashier_id' => $cashier->id,
            'requested_discount' => 50000,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($cashier)->get(route('transactions.print', $transaction->invoice));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Transactions/Print')
                ->where('transaction.discount_approval_status', 'pending')
                ->where('transaction.payment_status', 'pending_approval')
                ->where('transaction.discount', 50000)
            );
    }

    public function test_supervisor_can_approve_discount_and_print_page_shows_approver(): void
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $supervisor = User::factory()->create(['name' => 'Supervisor Budi']);
        $supervisor->assignRole('super-admin');

        $transaction = Transaction::create([
            'cashier_id' => $cashier->id,
            'customer_id' => null,
            'invoice' => 'TRX-PENDING-DISC-002',
            'cash' => 50000,
            'change' => 0,
            'discount' => 50000,
            'grand_total' => 50000,
            'payment_method' => 'cash',
            'payment_status' => 'pending_approval',
            'discount_approval_status' => 'pending',
        ]);

        DiscountApprovalLog::create([
            'transaction_id' => $transaction->id,
            'cashier_id' => $cashier->id,
            'requested_discount' => 50000,
            'status' => 'pending',
        ]);

        // Supervisor approves the transaction
        $approveResponse = $this->actingAs($supervisor)->post(route('discount-approvals.approve', $transaction->id));
        $approveResponse->assertRedirect();

        $transaction->refresh();
        $this->assertEquals('approved', $transaction->discount_approval_status);
        $this->assertEquals('paid', $transaction->payment_status);
        $this->assertEquals($supervisor->id, $transaction->discount_approved_by);

        // Verify print page shows approver
        $response = $this->actingAs($cashier)->get(route('transactions.print', $transaction->invoice));
        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Transactions/Print')
                ->where('transaction.discount_approval_status', 'approved')
                ->where('transaction.payment_status', 'paid')
                ->where('transaction.discount_approver.name', 'Supervisor Budi')
            );
    }
}
