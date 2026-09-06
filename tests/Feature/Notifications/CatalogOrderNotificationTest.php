<?php

namespace Tests\Feature\Notifications;

use App\Models\CatalogOrder;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CatalogOrderNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Permission::findOrCreate('dashboard-access', 'web');
        Permission::findOrCreate('catalog-orders-access', 'web');
        Permission::findOrCreate('catalog-orders-process', 'web');
    }

    public function test_pending_catalog_order_appears_in_shared_inertia_notifications_for_authorized_user(): void
    {
        $role = Role::findOrCreate('admin', 'web');
        $role->givePermissionTo(['dashboard-access', 'catalog-orders-access']);

        $user = User::factory()->create();
        $user->assignRole($role);

        $warehouse = Warehouse::create([
            'code' => 'WHA-01',
            'name' => 'Gudang Pusat',
            'is_active' => true,
        ]);

        $order = CatalogOrder::create([
            'order_number' => 'ORD-TEST-001',
            'warehouse_id' => $warehouse->id,
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'delivery_method' => CatalogOrder::DELIVERY_PICKUP,
            'subtotal' => 150000,
            'shipping_cost' => 0,
            'grand_total' => 150000,
            'status' => CatalogOrder::STATUS_SUBMITTED,
        ]);

        $response = $this->actingAs($user)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingCatalogOrdersCount', 1)
            ->has('catalogOrderNotifications', 1)
            ->where('catalogOrderNotifications.0.id', $order->id)
            ->where('catalogOrderNotifications.0.order_number', 'ORD-TEST-001')
            ->where('catalogOrderNotifications.0.customer_name', 'Budi Santoso')
            ->where('catalogOrderNotifications.0.grand_total', 150000)
            ->where('catalogOrderNotifications.0.delivery_method', CatalogOrder::DELIVERY_PICKUP)
            ->where('catalogOrderNotifications.0.warehouse', 'Gudang Pusat')
        );
    }

    public function test_completed_or_cancelled_order_does_not_appear_in_notifications(): void
    {
        $role = Role::findOrCreate('admin', 'web');
        $role->givePermissionTo(['dashboard-access', 'catalog-orders-access']);

        $user = User::factory()->create();
        $user->assignRole($role);

        $warehouse = Warehouse::create([
            'code' => 'WHA-02',
            'name' => 'Gudang Cabang',
            'is_active' => true,
        ]);

        CatalogOrder::create([
            'order_number' => 'ORD-COMPLETED-01',
            'warehouse_id' => $warehouse->id,
            'customer_name' => 'Pelanggan Selesai',
            'subtotal' => 50000,
            'grand_total' => 50000,
            'status' => CatalogOrder::STATUS_COMPLETED,
        ]);

        CatalogOrder::create([
            'order_number' => 'ORD-CANCELLED-01',
            'warehouse_id' => $warehouse->id,
            'customer_name' => 'Pelanggan Batal',
            'subtotal' => 75000,
            'grand_total' => 75000,
            'status' => CatalogOrder::STATUS_CANCELLED,
        ]);

        $response = $this->actingAs($user)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingCatalogOrdersCount', 0)
            ->where('catalogOrderNotifications', [])
        );
    }

    public function test_user_without_catalog_orders_permission_receives_empty_notifications(): void
    {
        $role = Role::findOrCreate('staff', 'web');
        $role->givePermissionTo(['dashboard-access']);

        $user = User::factory()->create();
        $user->assignRole($role);

        $warehouse = Warehouse::create([
            'code' => 'WHA-03',
            'name' => 'Gudang Retail',
            'is_active' => true,
        ]);

        CatalogOrder::create([
            'order_number' => 'ORD-PENDING-01',
            'warehouse_id' => $warehouse->id,
            'customer_name' => 'Pelanggan Ada',
            'subtotal' => 100000,
            'grand_total' => 100000,
            'status' => CatalogOrder::STATUS_SUBMITTED,
        ]);

        $response = $this->actingAs($user)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingCatalogOrdersCount', 0)
            ->where('catalogOrderNotifications', [])
        );
    }

    public function test_branch_isolation_for_catalog_order_notifications(): void
    {
        $role = Role::findOrCreate('branch-staff', 'web');
        $role->givePermissionTo(['dashboard-access', 'catalog-orders-access']);

        $warehouseA = Warehouse::create([
            'code' => 'BR-A',
            'name' => 'Cabang Jakarta',
            'is_active' => true,
        ]);

        $warehouseB = Warehouse::create([
            'code' => 'BR-B',
            'name' => 'Cabang Bandung',
            'is_active' => true,
        ]);

        $branchUser = User::factory()->create([
            'warehouse_id' => $warehouseA->id,
        ]);
        $branchUser->assignRole($role);

        $orderA = CatalogOrder::create([
            'order_number' => 'ORD-JKT-001',
            'warehouse_id' => $warehouseA->id,
            'customer_name' => 'Customer Jkt',
            'subtotal' => 120000,
            'grand_total' => 120000,
            'status' => CatalogOrder::STATUS_SUBMITTED,
        ]);

        CatalogOrder::create([
            'order_number' => 'ORD-BDG-001',
            'warehouse_id' => $warehouseB->id,
            'customer_name' => 'Customer Bdg',
            'subtotal' => 200000,
            'grand_total' => 200000,
            'status' => CatalogOrder::STATUS_SUBMITTED,
        ]);

        $response = $this->actingAs($branchUser)->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('pendingCatalogOrdersCount', 1)
            ->has('catalogOrderNotifications', 1)
            ->where('catalogOrderNotifications.0.id', $orderA->id)
            ->where('catalogOrderNotifications.0.order_number', 'ORD-JKT-001')
        );
    }
}
