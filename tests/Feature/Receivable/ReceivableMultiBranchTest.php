<?php

namespace Tests\Feature\Receivable;

use App\Models\Customer;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\CashierShiftService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ReceivableMultiBranchTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouseA;

    protected Warehouse $warehouseB;

    protected User $cashierA;

    protected User $cashierB;

    protected User $managerA;

    protected User $managerB;

    protected User $superAdmin;

    protected Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        // Create required permissions
        foreach ([
            'receivables-access',
            'receivables-pay',
            'receivables-approve',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'transactions-access',
        ] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $superAdminRole = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        $superAdminRole->syncPermissions(Permission::all());

        // Setup Warehouses
        $this->warehouseA = Warehouse::create([
            'code' => 'WHA',
            'name' => 'Cabang Surabaya',
            'status' => 'active',
        ]);

        $this->warehouseB = Warehouse::create([
            'code' => 'WHB',
            'name' => 'Cabang Malang',
            'status' => 'active',
        ]);

        // Cashier A in Warehouse A
        $this->cashierA = User::factory()->create([
            'warehouse_id' => $this->warehouseA->id,
        ]);
        $this->cashierA->givePermissionTo(['receivables-access', 'receivables-pay', 'cashier-shifts-access', 'cashier-shifts-open']);

        // Cashier B in Warehouse B
        $this->cashierB = User::factory()->create([
            'warehouse_id' => $this->warehouseB->id,
        ]);
        $this->cashierB->givePermissionTo(['receivables-access', 'receivables-pay', 'cashier-shifts-access', 'cashier-shifts-open']);

        // Manager A in Warehouse A
        $this->managerA = User::factory()->create([
            'warehouse_id' => $this->warehouseA->id,
        ]);
        $this->managerA->givePermissionTo(['receivables-access', 'receivables-pay', 'receivables-approve']);

        // Manager B in Warehouse B
        $this->managerB = User::factory()->create([
            'warehouse_id' => $this->warehouseB->id,
        ]);
        $this->managerB->givePermissionTo(['receivables-access', 'receivables-pay', 'receivables-approve']);

        // Super Admin (HQ, warehouse_id is null)
        $this->superAdmin = User::factory()->create([
            'warehouse_id' => null,
        ]);
        $this->superAdmin->assignRole('super-admin');

        $this->customer = Customer::create([
            'name' => 'Budi Santoso',
            'no_telp' => '081234567890',
            'address' => 'Jl. Merdeka 10',
        ]);

        Setting::set('receivable_approval_threshold', 1000000);
    }

    protected function createReceivableForWarehouse(Warehouse $warehouse, string $invoice, float $total = 200000): Receivable
    {
        $transaction = Transaction::create([
            'warehouse_id' => $warehouse->id,
            'cashier_id' => $this->cashierA->id,
            'customer_id' => $this->customer->id,
            'invoice' => 'TRX-'.$invoice,
            'grand_total' => $total,
            'discount' => 0,
            'payment_method' => 'credit',
            'payment_status' => 'unpaid',
            'cash' => 0,
            'change' => 0,
        ]);

        return Receivable::create([
            'customer_id' => $this->customer->id,
            'transaction_id' => $transaction->id,
            'invoice' => 'RCV-'.$invoice,
            'total' => $total,
            'paid' => 0,
            'due_date' => now()->addDays(2)->toDateString(),
            'status' => 'unpaid',
        ]);
    }

    public function test_cashier_only_sees_own_branch_receivables_in_header_notifications(): void
    {
        $receivableA = $this->createReceivableForWarehouse($this->warehouseA, 'INV-A');
        $receivableB = $this->createReceivableForWarehouse($this->warehouseB, 'INV-B');

        // Act as Cashier A
        $response = $this->actingAs($this->cashierA)->get(route('receivables.index'));

        $response->assertInertia(fn (Assert $page) => $page
            ->has('receivableNotifications', 1)
            ->where('receivableNotifications.0.id', $receivableA->id)
        );
    }

    public function test_user_without_receivables_permission_receives_empty_notifications(): void
    {
        $this->createReceivableForWarehouse($this->warehouseA, 'INV-A');

        $plainUser = User::factory()->create(['warehouse_id' => $this->warehouseA->id]);

        $response = $this->actingAs($plainUser)->get(route('dashboard'));

        $response->assertInertia(fn (Assert $page) => $page
            ->where('receivableNotifications', [])
        );
    }

    public function test_cashier_cannot_view_receivable_of_another_branch(): void
    {
        $receivableB = $this->createReceivableForWarehouse($this->warehouseB, 'INV-B');

        // Cashier A attempts to view Branch B receivable
        $response = $this->actingAs($this->cashierA)->get(route('receivables.show', $receivableB));

        $response->assertStatus(403);
    }

    public function test_cashier_cannot_pay_receivable_of_another_branch(): void
    {
        $receivableB = $this->createReceivableForWarehouse($this->warehouseB, 'INV-B');

        // Cashier A attempts to submit payment for Branch B receivable
        $response = $this->actingAs($this->cashierA)->post(route('receivables.pay', $receivableB), [
            'amount' => 50000,
            'paid_at' => now()->toDateString(),
            'method' => 'cash',
        ]);

        $response->assertStatus(403);
    }

    public function test_cashier_can_view_and_pay_own_branch_receivable(): void
    {
        $receivableA = $this->createReceivableForWarehouse($this->warehouseA, 'INV-A', 150000);

        // Cashier A can view Branch A receivable
        $this->actingAs($this->cashierA)
            ->get(route('receivables.show', $receivableA))
            ->assertStatus(200);

        // Cashier A pays 50,000 in cash
        $response = $this->actingAs($this->cashierA)
            ->post(route('receivables.pay', $receivableA), [
                'amount' => 50000,
                'paid_at' => now()->toDateString(),
                'method' => 'cash',
            ]);

        $response->assertRedirect(route('receivables.show', $receivableA));

        $this->assertEquals(50000, $receivableA->fresh()->paid);
        $this->assertEquals('partial', $receivableA->fresh()->status);
    }

    public function test_cash_payment_by_cashier_links_to_active_shift_and_updates_expected_cash(): void
    {
        $receivableA = $this->createReceivableForWarehouse($this->warehouseA, 'INV-A', 200000);

        // Open shift for Cashier A
        $shiftService = app(CashierShiftService::class);
        $shift = $shiftService->openShift(
            cashier: $this->cashierA,
            actor: $this->cashierA,
            openingCash: 100000,
            warehouseId: $this->warehouseA->id
        );

        // Cashier A receives cash payment of 75,000 for receivable A
        $this->actingAs($this->cashierA)
            ->post(route('receivables.pay', $receivableA), [
                'amount' => 75000,
                'paid_at' => now()->toDateString(),
                'method' => 'cash',
            ]);

        $payment = ReceivablePayment::where('receivable_id', $receivableA->id)->latest('id')->first();
        $this->assertNotNull($payment);
        $this->assertEquals($shift->id, $payment->cashier_shift_id);
        $this->assertEquals($this->warehouseA->id, $payment->warehouse_id);
        $this->assertEquals('approved', $payment->status);

        // Calculate shift summary
        $summary = $shiftService->calculateSummary($shift);
        $this->assertEquals(75000, $summary['cash_receivable_total']);
        // expected_cash = 100,000 (opening) + 75,000 (receivable cash) = 175,000
        $this->assertEquals(175000, $summary['expected_cash']);
    }

    public function test_branch_manager_cannot_approve_or_reject_payment_of_another_branch(): void
    {
        $receivableB = $this->createReceivableForWarehouse($this->warehouseB, 'INV-B', 3000000);

        // Submit pending payment for Branch B (amount >= threshold 1,000,000 requires approval)
        $payment = ReceivablePayment::create([
            'receivable_id' => $receivableB->id,
            'paid_at' => now()->toDateString(),
            'amount' => 1500000,
            'method' => 'cash',
            'warehouse_id' => $this->warehouseB->id,
            'user_id' => $this->cashierB->id,
            'status' => 'pending',
        ]);

        // Manager A (Branch A) attempts to approve payment of Branch B
        $response = $this->actingAs($this->managerA)
            ->post(route('receivables.payments.approve', $payment));

        $response->assertStatus(403);

        // Manager A attempts to reject payment of Branch B
        $responseReject = $this->actingAs($this->managerA)
            ->post(route('receivables.payments.reject', $payment), [
                'approval_notes' => 'Tolak bayar',
            ]);

        $responseReject->assertStatus(403);

        // But Manager B (Branch B) can approve it
        $this->actingAs($this->managerB)
            ->post(route('receivables.payments.approve', $payment))
            ->assertRedirect();

        $this->assertEquals('approved', $payment->fresh()->status);
    }

    public function test_hq_user_can_access_and_manage_receivables_of_any_branch(): void
    {
        $receivableA = $this->createReceivableForWarehouse($this->warehouseA, 'INV-A');
        $receivableB = $this->createReceivableForWarehouse($this->warehouseB, 'INV-B');

        // HQ user sees both in notifications
        $response = $this->actingAs($this->superAdmin)->get(route('receivables.index'));

        $response->assertInertia(fn (Assert $page) => $page
            ->has('receivableNotifications', 2)
        );

        // HQ user can view both
        $this->actingAs($this->superAdmin)->get(route('receivables.show', $receivableA))->assertStatus(200);
        $this->actingAs($this->superAdmin)->get(route('receivables.show', $receivableB))->assertStatus(200);
    }
}
