<?php

namespace Tests\Feature\Payables;

use App\Models\BankAccount;
use App\Models\Payable;
use App\Models\PayablePayment;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\PayableAgingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PayableMultiBranchTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouseA;

    protected Warehouse $warehouseB;

    protected User $cashier;

    protected User $managerA;

    protected User $managerB;

    protected User $hqUser;

    protected Supplier $supplierA;

    protected Supplier $supplierB;

    protected BankAccount $bankAccount;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'payables-access',
            'payables-pay',
            'transactions-access',
            'cashier-shifts-access',
        ] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $superAdminRole = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        $superAdminRole->syncPermissions(Permission::all());

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

        // Cashier (no payables-access permission)
        $this->cashier = User::factory()->create([
            'warehouse_id' => $this->warehouseA->id,
        ]);
        $this->cashier->givePermissionTo(['transactions-access', 'cashier-shifts-access']);

        // Manager A at Warehouse A
        $this->managerA = User::factory()->create([
            'warehouse_id' => $this->warehouseA->id,
            'password' => bcrypt('password123'),
        ]);
        $this->managerA->givePermissionTo(['payables-access', 'payables-pay']);

        // Manager B at Warehouse B
        $this->managerB = User::factory()->create([
            'warehouse_id' => $this->warehouseB->id,
            'password' => bcrypt('password123'),
        ]);
        $this->managerB->givePermissionTo(['payables-access', 'payables-pay']);

        // HQ User (no warehouse_id)
        $this->hqUser = User::factory()->create([
            'warehouse_id' => null,
            'password' => bcrypt('password123'),
        ]);
        $this->hqUser->assignRole('super-admin');

        $this->supplierA = Supplier::create([
            'name' => 'PT Sumber Makmur',
            'phone' => '08123456789',
        ]);

        $this->supplierB = Supplier::create([
            'name' => 'CV Berkah Bersama',
            'phone' => '08987654321',
        ]);

        $this->bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'Toko Anda',
            'is_active' => true,
        ]);
    }

    public function test_cashier_without_payables_permission_receives_empty_notifications(): void
    {
        // Create due soon payable
        Payable::create([
            'supplier_id' => $this->supplierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'document_number' => 'PAY-WHA-001',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->addDay(),
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($this->cashier)->get(route('dashboard'));

        $response->assertInertia(fn (Assert $page) => $page
            ->where('payableNotifications', [])
            ->where('payableAgingSummary', null)
        );
    }

    public function test_branch_manager_only_sees_own_branch_payable_notifications(): void
    {
        // Payable Branch A
        $payableA = Payable::create([
            'supplier_id' => $this->supplierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'document_number' => 'PAY-WHA-001',
            'total' => 1500000,
            'paid' => 0,
            'due_date' => now()->addDay(),
            'status' => 'unpaid',
        ]);

        // Payable Branch B
        Payable::create([
            'supplier_id' => $this->supplierB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'PAY-WHB-001',
            'total' => 3000000,
            'paid' => 0,
            'due_date' => now()->addDay(),
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($this->managerA)->get(route('dashboard'));

        $response->assertInertia(fn (Assert $page) => $page
            ->has('payableNotifications', 1)
            ->where('payableNotifications.0.id', $payableA->id)
            ->where('payableNotifications.0.document_number', 'PAY-WHA-001')
            ->where('payableNotifications.0.supplier_name', 'PT Sumber Makmur')
        );
    }

    public function test_hq_user_sees_all_branches_payable_notifications_with_branch_labels(): void
    {
        Payable::create([
            'supplier_id' => $this->supplierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'document_number' => 'PAY-WHA-001',
            'total' => 1500000,
            'paid' => 0,
            'due_date' => now()->addDay(),
            'status' => 'unpaid',
        ]);

        Payable::create([
            'supplier_id' => $this->supplierB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'PAY-WHB-001',
            'total' => 3000000,
            'paid' => 0,
            'due_date' => now()->addDays(2),
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($this->hqUser)->get(route('dashboard'));

        $response->assertInertia(fn (Assert $page) => $page
            ->has('payableNotifications', 2)
            ->where('payableNotifications.0.warehouse_name', 'Cabang Surabaya')
            ->where('payableNotifications.1.warehouse_name', 'Cabang Malang')
        );
    }

    public function test_branch_manager_cannot_view_payable_of_another_branch(): void
    {
        $payableB = Payable::create([
            'supplier_id' => $this->supplierB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'PAY-WHB-001',
            'total' => 2000000,
            'paid' => 0,
            'due_date' => now()->addDays(10),
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($this->managerA)->get(route('payables.show', $payableB));

        $response->assertStatus(403);
    }

    public function test_branch_manager_cannot_pay_payable_of_another_branch(): void
    {
        $payableB = Payable::create([
            'supplier_id' => $this->supplierB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'PAY-WHB-001',
            'total' => 2000000,
            'paid' => 0,
            'due_date' => now()->addDays(10),
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($this->managerA)->post(route('payables.pay', $payableB), [
            'amount' => 500000,
            'paid_at' => now()->toDateString(),
            'method' => 'cash',
        ]);

        $response->assertStatus(403);
        $this->assertEquals(0, $payableB->fresh()->paid);
    }

    public function test_branch_manager_can_view_and_pay_own_branch_payable(): void
    {
        $payableA = Payable::create([
            'supplier_id' => $this->supplierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'document_number' => 'PAY-WHA-001',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->addDays(5),
            'status' => 'unpaid',
        ]);

        // View
        $viewResponse = $this->actingAs($this->managerA)->get(route('payables.show', $payableA));
        $viewResponse->assertOk();

        // Pay
        $payResponse = $this->actingAs($this->managerA)->post(route('payables.pay', $payableA), [
            'amount' => 600000,
            'paid_at' => now()->toDateString(),
            'method' => 'cash',
        ]);

        $payResponse->assertRedirect(route('payables.show', $payableA));
        $this->assertEquals(600000, $payableA->fresh()->paid);
        $this->assertEquals('partial', $payableA->fresh()->status);
    }

    public function test_branch_manager_cannot_delete_payment_of_another_branch(): void
    {
        $payableB = Payable::create([
            'supplier_id' => $this->supplierB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'PAY-WHB-001',
            'total' => 1000000,
            'paid' => 500000,
            'due_date' => now()->addDays(5),
            'status' => 'partial',
        ]);

        $paymentB = PayablePayment::create([
            'payable_id' => $payableB->id,
            'amount' => 500000,
            'paid_at' => now()->toDateString(),
            'method' => 'cash',
            'user_id' => $this->managerB->id,
        ]);

        $response = $this->actingAs($this->managerA)->delete(route('payables.payments.destroy', [$payableB, $paymentB]), [
            'password' => 'password123',
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseHas('payable_payments', ['id' => $paymentB->id]);
    }

    public function test_hq_user_can_view_and_pay_any_branch_payable(): void
    {
        $payableB = Payable::create([
            'supplier_id' => $this->supplierB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'PAY-WHB-001',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->addDays(5),
            'status' => 'unpaid',
        ]);

        $viewResponse = $this->actingAs($this->hqUser)->get(route('payables.show', $payableB));
        $viewResponse->assertOk();

        $payResponse = $this->actingAs($this->hqUser)->post(route('payables.pay', $payableB), [
            'amount' => 1000000,
            'paid_at' => now()->toDateString(),
            'method' => 'bank_transfer',
            'bank_account_id' => $this->bankAccount->id,
        ]);

        $payResponse->assertRedirect(route('payables.show', $payableB));
        $this->assertEquals(1000000, $payableB->fresh()->paid);
        $this->assertEquals('paid', $payableB->fresh()->status);
    }

    public function test_manual_payable_by_branch_manager_automatically_assigns_branch_warehouse(): void
    {
        $response = $this->actingAs($this->managerA)->post(route('payables.store'), [
            'supplier_id' => $this->supplierA->id,
            'total' => 750000,
            'due_date' => now()->addDays(14)->toDateString(),
            'note' => 'Hutang operasional cabang Surabaya',
        ]);

        $response->assertRedirect(route('payables.index'));

        $this->assertDatabaseHas('payables', [
            'supplier_id' => $this->supplierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'total' => 750000,
        ]);
    }

    public function test_payable_with_purchase_order_inherits_warehouse_in_scoping(): void
    {
        $poA = PurchaseOrder::create([
            'supplier_id' => $this->supplierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'document_number' => 'PO-WHA-001',
            'order_date' => now()->toDateString(),
            'expected_delivery_date' => now()->addDays(7)->toDateString(),
            'status' => 'approved',
            'created_by' => $this->managerA->id,
        ]);

        $payablePO = Payable::create([
            'supplier_id' => $this->supplierA->id,
            'purchase_order_id' => $poA->id,
            'warehouse_id' => null, // null direct warehouse, but linked via purchase order
            'document_number' => 'PAY-PO-001',
            'total' => 2500000,
            'paid' => 0,
            'due_date' => now()->addDays(2),
            'status' => 'unpaid',
        ]);

        // Manager A should see it because it belongs to Warehouse A
        $responseA = $this->actingAs($this->managerA)->get(route('dashboard'));
        $responseA->assertInertia(fn (Assert $page) => $page
            ->has('payableNotifications', 1)
            ->where('payableNotifications.0.id', $payablePO->id)
        );

        // Manager B should NOT see it
        $responseB = $this->actingAs($this->managerB)->get(route('dashboard'));
        $responseB->assertInertia(fn (Assert $page) => $page
            ->where('payableNotifications', [])
        );
    }

    public function test_payable_aging_summary_is_scoped_by_branch(): void
    {
        // Overdue in Warehouse A
        Payable::create([
            'supplier_id' => $this->supplierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'document_number' => 'PAY-WHA-OLD',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->subDays(10),
            'status' => 'overdue',
        ]);

        // Overdue in Warehouse B
        Payable::create([
            'supplier_id' => $this->supplierB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'PAY-WHB-OLD',
            'total' => 5000000,
            'paid' => 0,
            'due_date' => now()->subDays(10),
            'status' => 'overdue',
        ]);

        $service = new PayableAgingService;

        $summaryA = $service->getAgingSummary($this->warehouseA->id);
        $overdueA = $summaryA->firstWhere('bucket', '0-30');
        $this->assertEquals(1000000, $overdueA['remaining']);

        $summaryB = $service->getAgingSummary($this->warehouseB->id);
        $overdueB = $summaryB->firstWhere('bucket', '0-30');
        $this->assertEquals(5000000, $overdueB['remaining']);

        $summaryHQ = $service->getAgingSummary(null);
        $overdueHQ = $summaryHQ->firstWhere('bucket', '0-30');
        $this->assertEquals(6000000, $overdueHQ['remaining']);
    }

    public function test_branch_manager_only_sees_own_branch_payables_on_index_page(): void
    {
        $payableA = Payable::create([
            'supplier_id' => $this->supplierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'document_number' => 'PAY-WHA-IDX',
            'total' => 1000000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $payableB = Payable::create([
            'supplier_id' => $this->supplierB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'PAY-WHB-IDX',
            'total' => 2000000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($this->managerA)->get(route('payables.index'));

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Payables/Index')
            ->has('payables.data', 1)
            ->where('payables.data.0.id', $payableA->id)
            ->where('warehouses', [])
        );
    }

    public function test_hq_user_can_filter_payables_by_warehouse_on_index_page(): void
    {
        $payableA = Payable::create([
            'supplier_id' => $this->supplierA->id,
            'warehouse_id' => $this->warehouseA->id,
            'document_number' => 'PAY-WHA-HQ',
            'total' => 1000000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $payableB = Payable::create([
            'supplier_id' => $this->supplierB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'PAY-WHB-HQ',
            'total' => 2000000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        // Unfiltered (all branches)
        $allResponse = $this->actingAs($this->hqUser)->get(route('payables.index'));
        $allResponse->assertInertia(fn (Assert $page) => $page
            ->has('payables.data', 2)
            ->has('warehouses', 2)
        );

        // Filtered to Warehouse A
        $filteredResponse = $this->actingAs($this->hqUser)->get(route('payables.index', ['warehouse_id' => $this->warehouseA->id]));
        $filteredResponse->assertInertia(fn (Assert $page) => $page
            ->has('payables.data', 1)
            ->where('payables.data.0.id', $payableA->id)
        );
    }
}
