<?php

namespace Tests\Feature\Purchasing;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PurchaseOrderSuggestedQtyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'purchase-orders-access',
            'purchase-orders-create',
            'purchase-orders-update',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo($permissions);

        return $user;
    }

    public function test_purchase_order_create_view_includes_target_restock_and_warehouse_stocks(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
            'purchase-orders-create',
        ]);

        $category = Category::create([
            'name' => 'Mie Instan',
            'description' => 'Kategori mie',
            'image' => 'category.png',
        ]);

        $warehouse1 = Warehouse::create([
            'code' => 'WH-01',
            'name' => 'Gudang Pusat',
            'type' => 'main',
            'is_active' => true,
        ]);

        $warehouse2 = Warehouse::create([
            'code' => 'WH-02',
            'name' => 'Gudang Cabang',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'indomie.png',
            'barcode' => '8998866112233',
            'sku' => 'IND-01',
            'title' => 'Indomie Goreng Spesial',
            'buy_price' => 2800,
            'sell_price' => 3500,
            'stock' => 25,
            'min_stock' => 20,
            'max_stock' => 100,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create(['product_id' => $product->id, 'warehouse_id' => $warehouse1->id, 'stock' => 15]);
        ProductWarehouse::create(['product_id' => $product->id, 'warehouse_id' => $warehouse2->id, 'stock' => 10]);

        $unitDus = Unit::firstOrCreate(
            ['code' => 'DUS'],
            ['name' => 'Dus', 'symbol' => 'dus']
        );

        $product->units()->attach($unitDus->id, [
            'is_base' => false,
            'conversion_factor' => 40,
            'buy_price' => 112000,
            'sell_price' => 140000,
        ]);

        $response = $this->actingAs($user)
            ->get(route('purchase-orders.create'))
            ->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/PurchaseOrders/Create')
            ->has('products', 1)
            ->where('products.0.id', $product->id)
            ->where('products.0.min_stock', 20)
            ->where('products.0.max_stock', 100)
            ->where('products.0.warehouse_stocks.'.$warehouse1->id, 15)
            ->where('products.0.warehouse_stocks.'.$warehouse2->id, 10)
            ->has('products.0.units', 1)
            ->where('products.0.units.0.conversion_factor', 40)
        );
    }

    public function test_purchase_order_edit_view_includes_target_restock_and_warehouse_stocks(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
            'purchase-orders-update',
        ]);

        $category = Category::create([
            'name' => 'Minuman',
            'description' => 'Kategori minuman',
            'image' => 'category.png',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'WH-MAIN',
            'name' => 'Gudang Utama',
            'type' => 'main',
            'is_active' => true,
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'teh.png',
            'barcode' => '8998866998877',
            'sku' => 'TEH-01',
            'title' => 'Teh Botol Kotak',
            'buy_price' => 3000,
            'sell_price' => 4000,
            'stock' => 10,
            'min_stock' => 15,
            'max_stock' => 60,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create(['product_id' => $product->id, 'warehouse_id' => $warehouse->id, 'stock' => 10]);

        $supplier = Supplier::create([
            'name' => 'Supplier Minuman',
            'phone' => '08111222333',
        ]);

        $po = PurchaseOrder::create([
            'document_number' => 'PO-TEST-001',
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'qty_ordered' => 50,
            'qty_received' => 0,
            'unit_price' => 3000,
            'conversion_factor' => 1,
        ]);

        $response = $this->actingAs($user)
            ->get(route('purchase-orders.edit', $po))
            ->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/PurchaseOrders/Edit')
            ->has('products', 1)
            ->where('products.0.min_stock', 15)
            ->where('products.0.max_stock', 60)
            ->where('products.0.warehouse_stocks.'.$warehouse->id, 10)
        );
    }
}
