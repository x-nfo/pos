<?php

namespace Tests\Feature\Auth;

use App\Models\CashierShift;
use App\Models\Customer;
use App\Models\GoodsReceiving;
use App\Models\Profit;
use App\Models\PurchaseOrder;
use App\Models\Receivable;
use App\Models\StockOpname;
use App\Models\StockTransfer;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BranchIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouseA;

    protected Warehouse $warehouseB;

    protected User $hqUser;

    protected User $branchUserA;

    protected User $branchUserB;

    protected function setUp(): void
    {
        parent::setUp();

        // Create all necessary permissions
        $permissions = [
            'users-access',
            'users-create',
            'users-update',
            'users-delete',
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
            'dashboard-access',
            'reports-access',
            'profits-access',
            'stock-opnames-access',
            'stock-opnames-create',
            'stock-opnames-finalize',
            'stock-transfers-access',
            'stock-transfers-create',
            'stock-transfers-send',
            'stock-transfers-receive',
            'stock-transfers-cancel',
            'purchase-orders-access',
            'purchase-orders-create',
            'purchase-orders-edit',
            'goods-receivings-access',
            'goods-receivings-create',
            'supplier-returns-access',
            'sales-returns-access',
            'products-access',
            'receivables-access',
        ];

        foreach ($permissions as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }

        $superAdminRole = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        $cashierRole = Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);

        $this->warehouseA = Warehouse::create([
            'code' => 'BR-A',
            'name' => 'Branch Jakarta',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $this->warehouseB = Warehouse::create([
            'code' => 'BR-B',
            'name' => 'Branch Surabaya',
            'type' => 'branch',
            'is_active' => true,
        ]);

        // HQ Superadmin (warehouse_id = null)
        $this->hqUser = User::factory()->create([
            'name' => 'HQ Admin',
            'email' => 'hq@example.com',
            'warehouse_id' => null,
        ]);
        $this->hqUser->assignRole($superAdminRole);
        $this->hqUser->givePermissionTo(Permission::all());

        // Branch A User
        $this->branchUserA = User::factory()->create([
            'name' => 'Branch A Cashier',
            'email' => 'branch_a@example.com',
            'warehouse_id' => $this->warehouseA->id,
        ]);
        $this->branchUserA->assignRole($cashierRole);
        $this->branchUserA->givePermissionTo($permissions);

        // Branch B User
        $this->branchUserB = User::factory()->create([
            'name' => 'Branch B Cashier',
            'email' => 'branch_b@example.com',
            'warehouse_id' => $this->warehouseB->id,
        ]);
        $this->branchUserB->assignRole($cashierRole);
        $this->branchUserB->givePermissionTo($permissions);
    }

    public function test_user_is_hq_helper(): void
    {
        $this->assertTrue($this->hqUser->isHQ());
        $this->assertFalse($this->branchUserA->isHQ());
        $this->assertFalse($this->branchUserB->isHQ());
        $this->assertSame($this->warehouseA->id, $this->branchUserA->getAssignedWarehouseId());
    }

    public function test_inertia_shared_auth_contains_hq_and_warehouse_data(): void
    {
        $this->actingAs($this->branchUserA)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('auth.is_hq', false)
                ->where('auth.warehouse.id', $this->warehouseA->id)
                ->where('auth.warehouse.code', 'BR-A')
            );

        $this->actingAs($this->hqUser)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('auth.is_hq', true)
                ->where('auth.warehouse', null)
            );
    }

    public function test_user_management_crud_saves_warehouse_id(): void
    {
        $response = $this->actingAs($this->hqUser)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('users.store'), [
                'name' => 'New Branch Staff',
                'email' => 'staff@example.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'selectedRoles' => ['cashier'],
                'warehouse_id' => $this->warehouseA->id,
            ]);

        $response->assertRedirect(route('users.index'));

        $newUser = User::where('email', 'staff@example.com')->first();
        $this->assertNotNull($newUser);
        $this->assertSame($this->warehouseA->id, $newUser->warehouse_id);
    }

    public function test_branch_user_cannot_open_shift_for_another_warehouse(): void
    {
        $response = $this->actingAs($this->branchUserA)
            ->post(route('cashier-shifts.store'), [
                'warehouse_id' => $this->warehouseB->id,
                'opening_cash' => 100000,
                'notes' => 'Mencoba buka shift cabang B',
            ]);

        $response->assertSessionHasErrors(['warehouse_id']);
        $this->assertDatabaseCount('cashier_shifts', 0);
    }

    public function test_branch_user_opens_shift_locked_to_their_warehouse(): void
    {
        $response = $this->actingAs($this->branchUserA)
            ->post(route('cashier-shifts.store'), [
                'opening_cash' => 100000,
                'notes' => 'Buka shift cabang A',
            ]);

        $shift = CashierShift::first();
        $this->assertNotNull($shift);
        $this->assertSame($this->warehouseA->id, $shift->warehouse_id);
        $this->assertSame($this->branchUserA->id, $shift->user_id);
    }

    public function test_cashier_shift_index_scopes_data_to_user_branch(): void
    {
        // Create shift in Branch A
        CashierShift::create([
            'user_id' => $this->branchUserA->id,
            'opened_by' => $this->branchUserA->id,
            'warehouse_id' => $this->warehouseA->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'status' => 'open',
        ]);

        // Create shift in Branch B
        CashierShift::create([
            'user_id' => $this->branchUserB->id,
            'opened_by' => $this->branchUserB->id,
            'warehouse_id' => $this->warehouseB->id,
            'opened_at' => now(),
            'opening_cash' => 200000,
            'status' => 'open',
        ]);

        // Branch A user should only see Branch A shifts
        $this->actingAs($this->branchUserA)
            ->get(route('cashier-shifts.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/CashierShifts/Index')
                ->has('shifts.data', 1)
                ->where('shifts.data.0.warehouse.id', $this->warehouseA->id)
            );

        // HQ user sees both shifts
        $this->actingAs($this->hqUser)
            ->get(route('cashier-shifts.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/CashierShifts/Index')
                ->has('shifts.data', 2)
            );
    }

    public function test_transaction_history_is_isolated_per_branch(): void
    {
        Transaction::create([
            'invoice' => 'TRX-A-001',
            'cashier_id' => $this->branchUserA->id,
            'warehouse_id' => $this->warehouseA->id,
            'grand_total' => 150000,
            'discount' => 0,
            'cash' => 150000,
            'change' => 0,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        Transaction::create([
            'invoice' => 'TRX-B-001',
            'cashier_id' => $this->branchUserB->id,
            'warehouse_id' => $this->warehouseB->id,
            'grand_total' => 250000,
            'discount' => 0,
            'cash' => 250000,
            'change' => 0,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        // Branch A user sees only TRX-A-001
        $this->actingAs($this->branchUserA)
            ->get(route('transactions.history'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Transactions/History')
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice', 'TRX-A-001')
            );

        // Branch B user sees only TRX-B-001
        $this->actingAs($this->branchUserB)
            ->get(route('transactions.history'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Transactions/History')
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice', 'TRX-B-001')
            );

        // HQ user sees both
        $this->actingAs($this->hqUser)
            ->get(route('transactions.history'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Transactions/History')
                ->has('transactions.data', 2)
            );
    }

    public function test_dashboard_metrics_are_scoped_per_branch(): void
    {
        $trxA = Transaction::create([
            'invoice' => 'TRX-A-002',
            'cashier_id' => $this->branchUserA->id,
            'warehouse_id' => $this->warehouseA->id,
            'grand_total' => 100000,
            'discount' => 0,
            'cash' => 100000,
            'change' => 0,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        Profit::create([
            'transaction_id' => $trxA->id,
            'total' => 25000,
        ]);

        $trxB = Transaction::create([
            'invoice' => 'TRX-B-002',
            'cashier_id' => $this->branchUserB->id,
            'warehouse_id' => $this->warehouseB->id,
            'grand_total' => 300000,
            'discount' => 0,
            'cash' => 300000,
            'change' => 0,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        Profit::create([
            'transaction_id' => $trxB->id,
            'total' => 75000,
        ]);

        // Branch A user dashboard shows total revenue 100000, profit 25000, 1 transaction
        $this->actingAs($this->branchUserA)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Index')
                ->where('isLockedBranch', true)
                ->where('totalRevenue', 100000)
                ->where('totalProfit', 25000)
                ->where('totalTransactions', 1)
            );

        // HQ user dashboard shows combined revenue 400000, profit 100000, 2 transactions
        $this->actingAs($this->hqUser)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Index')
                ->where('isLockedBranch', false)
                ->where('totalRevenue', 400000)
                ->where('totalProfit', 100000)
                ->where('totalTransactions', 2)
            );

        // HQ user can filter dashboard specifically to Branch A
        $this->actingAs($this->hqUser)
            ->get(route('dashboard', ['warehouse_id' => $this->warehouseA->id]))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Index')
                ->where('isLockedBranch', false)
                ->where('selectedWarehouseId', $this->warehouseA->id)
                ->where('totalRevenue', 100000)
                ->where('totalProfit', 25000)
                ->where('totalTransactions', 1)
            );
    }

    public function test_sales_report_is_locked_to_user_branch(): void
    {
        Transaction::create([
            'invoice' => 'TRX-A-003',
            'cashier_id' => $this->branchUserA->id,
            'warehouse_id' => $this->warehouseA->id,
            'grand_total' => 100000,
            'discount' => 0,
            'cash' => 100000,
            'change' => 0,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        Transaction::create([
            'invoice' => 'TRX-B-003',
            'cashier_id' => $this->branchUserB->id,
            'warehouse_id' => $this->warehouseB->id,
            'grand_total' => 200000,
            'discount' => 0,
            'cash' => 200000,
            'change' => 0,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        // Even if branch A user sends warehouse_id = warehouseB in query params, it is forced to warehouseA
        $this->actingAs($this->branchUserA)
            ->get(route('reports.sales.index', ['warehouse_id' => $this->warehouseB->id]))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Reports/Sales')
                ->where('filters.warehouse_id', $this->warehouseA->id)
                ->has('transactions.data', 1)
                ->where('transactions.data.0.invoice', 'TRX-A-003')
                ->where('is_locked_branch', true)
            );
    }

    public function test_stock_opname_authorization_for_branch_user(): void
    {
        $opnameA = StockOpname::create([
            'code' => 'SO-A-001',
            'warehouse_id' => $this->warehouseA->id,
            'status' => 'draft',
            'created_by' => $this->branchUserA->id,
        ]);

        $opnameB = StockOpname::create([
            'code' => 'SO-B-001',
            'warehouse_id' => $this->warehouseB->id,
            'status' => 'draft',
            'created_by' => $this->branchUserB->id,
        ]);

        // Branch User A can view Opname A
        $this->actingAs($this->branchUserA)
            ->get(route('stock-opnames.show', $opnameA))
            ->assertOk();

        // Branch User A is forbidden from viewing Opname B
        $this->actingAs($this->branchUserA)
            ->get(route('stock-opnames.show', $opnameB))
            ->assertForbidden();

        // HQ User can view both
        $this->actingAs($this->hqUser)
            ->get(route('stock-opnames.show', $opnameA))
            ->assertOk();
        $this->actingAs($this->hqUser)
            ->get(route('stock-opnames.show', $opnameB))
            ->assertOk();
    }

    public function test_stock_transfer_isolation_and_cross_branch_access(): void
    {
        $warehouseC = Warehouse::create([
            'code' => 'BR-C',
            'name' => 'Branch Bali',
            'type' => 'branch',
            'is_active' => true,
        ]);

        // Transfer A -> B (involves branch A)
        $transferAB = StockTransfer::create([
            'document_number' => 'DOC-TRF-AB',
            'source_warehouse_id' => $this->warehouseA->id,
            'destination_warehouse_id' => $this->warehouseB->id,
            'status' => 'draft',
            'created_by' => $this->branchUserA->id,
        ]);

        // Transfer B -> C (does NOT involve branch A)
        $transferBC = StockTransfer::create([
            'document_number' => 'DOC-TRF-BC',
            'source_warehouse_id' => $this->warehouseB->id,
            'destination_warehouse_id' => $warehouseC->id,
            'status' => 'draft',
            'created_by' => $this->branchUserB->id,
        ]);

        // Branch A user can view transfer A -> B
        $this->actingAs($this->branchUserA)
            ->get(route('stock-transfers.show', $transferAB))
            ->assertOk();

        // Branch A user CANNOT view transfer B -> C (forbidden 403)
        $this->actingAs($this->branchUserA)
            ->get(route('stock-transfers.show', $transferBC))
            ->assertForbidden();

        // Branch A index only lists transfer involving Branch A
        $this->actingAs($this->branchUserA)
            ->get(route('stock-transfers.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/StockTransfers/Index')
                ->has('transfers.data', 1)
                ->where('transfers.data.0.document_number', 'DOC-TRF-AB')
            );
    }

    public function test_purchase_order_and_goods_receiving_isolation(): void
    {
        $poA = PurchaseOrder::create([
            'document_number' => 'PO-A-001',
            'warehouse_id' => $this->warehouseA->id,
            'status' => 'ordered',
            'subtotal' => 500000,
            'tax_rate' => 0,
            'grand_total' => 500000,
            'created_by' => $this->branchUserA->id,
        ]);

        $poB = PurchaseOrder::create([
            'document_number' => 'PO-B-001',
            'warehouse_id' => $this->warehouseB->id,
            'status' => 'ordered',
            'subtotal' => 700000,
            'tax_rate' => 0,
            'grand_total' => 700000,
            'created_by' => $this->branchUserB->id,
        ]);

        $grA = GoodsReceiving::create([
            'purchase_order_id' => $poA->id,
            'warehouse_id' => $this->warehouseA->id,
            'document_number' => 'GR-A-001',
            'received_at' => now(),
            'received_by' => $this->branchUserA->id,
        ]);

        $grB = GoodsReceiving::create([
            'purchase_order_id' => $poB->id,
            'warehouse_id' => $this->warehouseB->id,
            'document_number' => 'GR-B-001',
            'received_at' => now(),
            'received_by' => $this->branchUserB->id,
        ]);

        // Branch A user index lists only PO-A
        $this->actingAs($this->branchUserA)
            ->get(route('purchase-orders.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/PurchaseOrders/Index')
                ->has('orders.data', 1)
                ->where('orders.data.0.document_number', 'PO-A-001')
            );

        // Branch A user viewing PO-B is forbidden
        $this->actingAs($this->branchUserA)
            ->get(route('purchase-orders.show', $poB))
            ->assertForbidden();

        // Branch A user viewing GR-B is forbidden
        $this->actingAs($this->branchUserA)
            ->get(route('goods-receivings.show', $grB))
            ->assertForbidden();
    }

    public function test_products_and_receivables_are_scoped_to_branch_user(): void
    {
        $this->actingAs($this->branchUserA)
            ->get(route('products.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Products/Index')
                ->where('is_locked_branch', true)
                ->where('filters.warehouse_id', (string) $this->warehouseA->id)
            );

        $customer = Customer::create([
            'name' => 'Test Customer',
            'no_telp' => '081234567890',
            'address' => 'Jl. Test No. 1',
        ]);

        $trxA = Transaction::create([
            'invoice' => 'TRX-REC-A',
            'cashier_id' => $this->branchUserA->id,
            'customer_id' => $customer->id,
            'warehouse_id' => $this->warehouseA->id,
            'grand_total' => 50000,
            'discount' => 0,
            'cash' => 0,
            'change' => 0,
            'payment_method' => 'pay_later',
            'payment_status' => 'pending',
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'transaction_id' => $trxA->id,
            'invoice' => $trxA->invoice,
            'total' => 50000,
            'paid' => 0,
            'due_date' => now()->addDays(7),
            'status' => 'pending',
        ]);

        $trxB = Transaction::create([
            'invoice' => 'TRX-REC-B',
            'cashier_id' => $this->branchUserB->id,
            'customer_id' => $customer->id,
            'warehouse_id' => $this->warehouseB->id,
            'grand_total' => 80000,
            'discount' => 0,
            'cash' => 0,
            'change' => 0,
            'payment_method' => 'pay_later',
            'payment_status' => 'pending',
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'transaction_id' => $trxB->id,
            'invoice' => $trxB->invoice,
            'total' => 80000,
            'paid' => 0,
            'due_date' => now()->addDays(7),
            'status' => 'pending',
        ]);

        // Branch A user only sees Receivable from TRX-REC-A
        $this->actingAs($this->branchUserA)
            ->get(route('receivables.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Receivables/Index')
                ->where('is_locked_branch', true)
                ->has('receivables.data', 1)
                ->where('receivables.data.0.invoice', 'TRX-REC-A')
            );

        // HQ user sees all receivables and can filter by warehouse
        $this->actingAs($this->hqUser)
            ->get(route('receivables.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Receivables/Index')
                ->where('is_locked_branch', false)
                ->has('receivables.data', 2)
            );

        $this->actingAs($this->hqUser)
            ->get(route('receivables.index', ['warehouse_id' => $this->warehouseB->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Receivables/Index')
                ->where('is_locked_branch', false)
                ->has('receivables.data', 1)
                ->where('receivables.data.0.invoice', 'TRX-REC-B')
            );
    }
}
