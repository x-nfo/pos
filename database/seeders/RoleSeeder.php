<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    // Refactor the RoleSeeder to improve readability and avoid repetitive code
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->normalizeLegacyPermissionRole();

        $this->createRoleWithPermissions('users-access', '%users%');
        $this->createRoleWithPermissions('roles-access', '%roles%');
        $this->createRoleWithPermissions('permissions-access', '%permissions%');
        $this->createRoleWithPermissions('categories-access', '%categories%');
        $this->createRoleWithPermissions('products-access', '%products%');
        $this->createRoleWithPermissions('pricing-rules-access', '%pricing-rules%');
        $this->createRoleWithPermissions('customers-access', '%customers%');
        $this->createRoleWithPermissions('customer-vouchers-access', '%customer-vouchers%');
        $this->createRoleWithPermissions('customer-segments-access', '%customer-segments%');
        $this->createRoleWithPermissions('crm-campaigns-access', '%crm-campaigns%');
        $this->createRoleWithPermissions('crm-reminders-access', '%crm-reminders%');
        $this->createRoleWithPermissions('transactions-access', '%transactions%');
        $this->createRoleWithPermissions('transactions-confirm-payment', 'transactions-confirm-payment');
        $this->createRoleWithPermissions('receivables-access', '%receivables%');
        $this->createRoleWithPermissions('receivables-approve', 'receivables-approve');
        $this->createRoleWithPermissions('payables-access', '%payables%');
        $this->createRoleWithPermissions('suppliers-access', '%suppliers%');
        $this->createRoleWithPermissions('reports-access', '%reports%');
        $this->createRoleWithPermissions('profits-access', '%profits%');
        $this->createRoleWithPermissions('payment-settings-access', '%payment-settings%');
        $this->createRoleWithPermissions('payment-settings-update', 'payment-settings-update');
        $this->createRoleWithPermissions('stock-opnames-access', '%stock-opnames%');
        $this->createRoleWithPermissions('stock-mutations-access', '%stock-mutations%');
        $this->createRoleWithPermissions('sales-returns-access', '%sales-returns%');
        $this->createRoleWithPermissions('cashier-shifts-access', '%cashier-shifts%');
        $this->createRoleWithPermissions('audit-logs-access', '%audit-logs%');
        $this->createRoleWithPermissions('purchase-orders-access', '%purchase-orders%');
        $this->createRoleWithPermissions('goods-receivings-access', '%goods-receivings%');
        $this->createRoleWithPermissions('supplier-returns-access', '%supplier-returns%');
        $this->createRoleWithPermissions('stock-transfers-access', '%stock-transfers%');
        $this->createRoleWithPermissions('products-import', '%products-import%');
        $this->createRoleWithPermissions('products-export', '%products-export%');
        $this->createRoleWithPermissions('customers-import', '%customers-import%');
        $this->createRoleWithPermissions('customers-export', '%customers-export%');
        $this->createRoleWithPermissions('discounts-approve', 'discounts-approve');
        $this->createRoleWithPermissions('price-lists-access', '%price-lists%');
        $this->createRoleWithPermissions('warehouses-access', '%warehouses%');

        $this->createRoleWithPermissions('dine-tables-access', '%dine-tables%');
        $this->createRoleWithPermissions('dine-orders-access', '%dine-orders%');

        $this->createRoleWithPermissions('store-settings-access', '%store-settings%');
        $this->createRoleWithPermissions('printer-settings-access', '%printer-settings%');
        $this->createRoleWithPermissions('loyalty-settings-access', '%loyalty-settings%');
        $this->createRoleWithPermissions('target-settings-access', '%target-settings%');

        $superAdminRole = Role::firstOrCreate(['name' => 'super-admin']);
        $superAdminRole->syncPermissions(Permission::all());

        // 1. Manager Role (Store / Operations Manager)
        $managerRole = Role::firstOrCreate(['name' => 'store-manager']);
        $managerPermissions = Permission::whereIn('name', [
            'dashboard-access',
            'transactions-access',
            'transactions-confirm-payment',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
            'cashier-shifts-force-close',
            'discounts-approve',
            'products-access',
            'categories-access',
            'pricing-rules-access',
            'price-lists-access',
            'customers-access',
            'customers-create',
            'customers-edit',
            'customer-vouchers-access',
            'customer-segments-access',
            'reports-access',
            'profits-access',
            'stock-opnames-access',
            'stock-opnames-create',
            'stock-opnames-finalize',
            'stock-mutations-access',
            'sales-returns-access',
            'sales-returns-create',
            'sales-returns-complete',
            'receivables-access',
            'receivables-pay',
            'receivables-approve',
            'payables-access',
            'payables-pay',
            'suppliers-access',
            'dine-tables-access',
            'dine-orders-access',
            'dine-orders-process',
        ])->get();
        $managerRole->syncPermissions($managerPermissions);

        // 2. Cashier Role (POS Checkout & Daily Sales)
        $cashierRole = Role::firstOrCreate(['name' => 'cashier']);
        $cashierPermissions = Permission::whereIn('name', [
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
            'customers-access',
            'customers-create',
            'receivables-access',
            'receivables-pay',
            'sales-returns-access',
            'sales-returns-create',
            'dine-orders-access',
            'dine-orders-process',
        ])->get();
        $cashierRole->syncPermissions($cashierPermissions);

        // 3. Warehouse Staff Role (Procurement & Inventory)
        $warehouseRole = Role::firstOrCreate(['name' => 'warehouse-staff']);
        $warehousePermissions = Permission::whereIn('name', [
            'purchase-orders-access',
            'purchase-orders-create',
            'purchase-orders-update',
            'goods-receivings-access',
            'goods-receivings-create',
            'supplier-returns-access',
            'supplier-returns-create',
            'supplier-returns-update',
            'stock-transfers-access',
            'stock-transfers-create',
            'stock-transfers-send',
            'stock-transfers-receive',
            'stock-transfers-cancel',
            'stock-mutations-access',
            'stock-opnames-access',
            'stock-opnames-create',
            'products-access',
            'warehouses-access',
            'suppliers-access',
        ])->get();
        $warehouseRole->syncPermissions($warehousePermissions);

        // 4. Finance Staff Role (Accounts Receivable, Payable, & Profit Reports)
        $financeRole = Role::firstOrCreate(['name' => 'finance-staff']);
        $financePermissions = Permission::whereIn('name', [
            'receivables-access',
            'receivables-pay',
            'receivables-approve',
            'payables-access',
            'payables-pay',
            'suppliers-access',
            'reports-access',
            'profits-access',
            'payment-settings-access',
        ])->get();
        $financeRole->syncPermissions($financePermissions);

        // 5. Kitchen Staff Role (Dine-In Kitchen Display Orders)
        $kitchenRole = Role::firstOrCreate(['name' => 'kitchen-staff']);
        $kitchenPermissions = Permission::whereIn('name', [
            'dine-tables-access',
            'dine-orders-access',
            'dine-orders-process',
        ])->get();
        $kitchenRole->syncPermissions($kitchenPermissions);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function normalizeLegacyPermissionRole(): void
    {
        $legacyRole = Role::where('name', 'permission-access')->first();

        if (! $legacyRole) {
            return;
        }

        $finalRole = Role::firstOrCreate([
            'name' => 'permissions-access',
            'guard_name' => $legacyRole->guard_name,
        ]);

        if (DB::getSchemaBuilder()->hasTable('model_has_roles')) {
            DB::table('model_has_roles')
                ->where('role_id', $legacyRole->id)
                ->update(['role_id' => $finalRole->id]);
        }

        if (DB::getSchemaBuilder()->hasTable('role_has_permissions')) {
            DB::table('role_has_permissions')
                ->where('role_id', $legacyRole->id)
                ->update(['role_id' => $finalRole->id]);
        }

        $legacyRole->delete();
    }

    private function createRoleWithPermissions($roleName, $permissionNamePattern)
    {
        $permissions = Permission::where('name', 'like', $permissionNamePattern)->get();
        $role = Role::firstOrCreate(['name' => $roleName]);
        $role->syncPermissions($permissions);
    }
}
