<?php

namespace Tests\Feature\Purchasing;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PurchaseOrderTest extends TestCase
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

    private function createProduct(int $stock = 10): Product
    {
        $category = Category::create([
            'name' => 'Kategori '.Str::upper(Str::random(5)),
            'description' => 'Kategori pengujian',
            'image' => 'category.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(10)),
            'sku' => 'SKU-'.Str::upper(Str::random(10)),
            'title' => 'Produk Uji '.Str::upper(Str::random(4)),
            'description' => 'Deskripsi produk uji.',
            'buy_price' => 45000,
            'sell_price' => 60000,
            'stock' => $stock,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $product->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => $stock]);

        return $product;
    }

    public function test_unauthorized_user_cannot_access_purchase_orders(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($user)
            ->get(route('purchase-orders.index'))
            ->assertForbidden();
    }

    public function test_authorized_user_can_view_purchase_orders_index(): void
    {
        $user = $this->createUserWithPermissions(['purchase-orders-access']);

        $this->actingAs($user)
            ->get(route('purchase-orders.index'))
            ->assertOk();
    }

    public function test_authorized_user_can_create_purchase_order_draft(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
            'purchase-orders-create',
        ]);

        $product = $this->createProduct(50);

        $supplier = Supplier::create([
            'name' => 'PT Pangan Makmur',
            'phone' => '08123456789',
            'address' => 'Jakarta',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'GUDANG-1',
            'name' => 'Gudang Utama',
            'type' => 'main',
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)
            ->post(route('purchase-orders.store'), [
                'supplier_id' => $supplier->id,
                'warehouse_id' => $warehouse->id,
                'notes' => 'PO Pembelian Rutin',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty_ordered' => 20,
                        'unit_price' => 9500,
                    ],
                ],
            ]);

        $po = PurchaseOrder::first();
        $this->assertNotNull($po);
        $response->assertRedirect(route('purchase-orders.show', $po));

        $this->assertDatabaseHas('purchase_orders', [
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $this->assertDatabaseHas('purchase_order_items', [
            'product_id' => $product->id,
            'qty_ordered' => 20,
            'unit_price' => 9500,
        ]);
    }

    public function test_authorized_user_can_create_purchase_order_with_multi_uom(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
            'purchase-orders-create',
        ]);

        $product = $this->createProduct();

        $cartonUnit = Unit::firstOrCreate(
            ['code' => 'DUS'],
            ['name' => 'Dus', 'symbol' => 'dus']
        );

        $product->units()->attach($cartonUnit->id, [
            'is_base' => false,
            'conversion_factor' => 12.0000,
            'buy_price' => 265000,
            'sell_price' => 295000,
        ]);

        $supplier = Supplier::create([
            'name' => 'Supplier Susu',
            'phone' => '08123456789',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'GUDANG-UTAMA',
            'name' => 'Gudang Utama',
            'type' => 'main',
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)
            ->post(route('purchase-orders.store'), [
                'supplier_id' => $supplier->id,
                'warehouse_id' => $warehouse->id,
                'document_number' => 'PO-20260825-0010',
                'notes' => 'PO Pembelian Susu Dus',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'unit_id' => $cartonUnit->id,
                        'conversion_factor' => 12.0000,
                        'qty_ordered' => 5,
                        'unit_price' => 265000,
                    ],
                ],
            ]);

        $po = PurchaseOrder::where('document_number', 'PO-20260825-0010')->first();
        $this->assertNotNull($po);
        $response->assertRedirect(route('purchase-orders.show', $po));

        $this->assertDatabaseHas('purchase_order_items', [
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'unit_id' => $cartonUnit->id,
            'conversion_factor' => 12.0000,
            'qty_ordered' => 5,
            'unit_price' => 265000,
        ]);
    }

    public function test_authorized_user_can_place_order(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
            'purchase-orders-update',
        ]);

        $supplier = Supplier::create([
            'name' => 'PT Pangan Sejahtera',
            'phone' => '08123456780',
        ]);

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PO-20260817-0001',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->post(route('purchase-orders.place', $po));

        $response->assertRedirect();
        $this->assertDatabaseHas('purchase_orders', [
            'id' => $po->id,
            'status' => 'ordered',
        ]);
    }

    public function test_authorized_user_can_cancel_order(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
            'purchase-orders-update',
        ]);

        $supplier = Supplier::create([
            'name' => 'PT Pangan Sejahtera',
            'phone' => '08123456780',
        ]);

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PO-20260817-0002',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->post(route('purchase-orders.cancel', $po));

        $response->assertRedirect();
        $this->assertDatabaseHas('purchase_orders', [
            'id' => $po->id,
            'status' => 'cancelled',
        ]);
    }

    public function test_authorized_user_can_access_edit_page_for_draft_po(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
            'purchase-orders-update',
        ]);

        $supplier = Supplier::create([
            'name' => 'PT Pangan Sejahtera',
            'phone' => '08123456780',
        ]);

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PO-20260817-0003',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->get(route('purchase-orders.edit', $po));

        $response->assertOk();
    }

    public function test_authorized_user_can_update_draft_purchase_order(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
            'purchase-orders-update',
        ]);

        $supplier1 = Supplier::create(['name' => 'Supplier A', 'phone' => '0811111111']);
        $supplier2 = Supplier::create(['name' => 'Supplier B', 'phone' => '0822222222']);

        $product1 = $this->createProduct(20);
        $product2 = $this->createProduct(30);

        $warehouse = Warehouse::create([
            'code' => 'GUDANG-A',
            'name' => 'Gudang A',
            'type' => 'main',
            'is_active' => true,
        ]);

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier1->id,
            'warehouse_id' => $warehouse->id,
            'document_number' => 'PO-20260817-0004',
            'status' => 'draft',
            'notes' => 'Catatan awal',
            'created_by' => $user->id,
        ]);

        $po->items()->create([
            'product_id' => $product1->id,
            'qty_ordered' => 10,
            'qty_received' => 0,
            'unit_price' => 50000,
        ]);

        $response = $this->actingAs($user)
            ->put(route('purchase-orders.update', $po), [
                'supplier_id' => $supplier2->id,
                'warehouse_id' => $warehouse->id,
                'document_number' => 'PO-20260817-0004-REV',
                'notes' => 'Catatan revisi',
                'items' => [
                    [
                        'product_id' => $product2->id,
                        'qty_ordered' => 15,
                        'unit_price' => 55000,
                    ],
                ],
            ]);

        $response->assertRedirect(route('purchase-orders.show', $po));

        $this->assertDatabaseHas('purchase_orders', [
            'id' => $po->id,
            'supplier_id' => $supplier2->id,
            'document_number' => 'PO-20260817-0004-REV',
            'notes' => 'Catatan revisi',
            'status' => 'draft',
        ]);

        $this->assertDatabaseMissing('purchase_order_items', [
            'purchase_order_id' => $po->id,
            'product_id' => $product1->id,
        ]);

        $this->assertDatabaseHas('purchase_order_items', [
            'purchase_order_id' => $po->id,
            'product_id' => $product2->id,
            'qty_ordered' => 15,
            'unit_price' => 55000,
        ]);
    }

    public function test_user_cannot_edit_non_draft_purchase_order(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
            'purchase-orders-update',
        ]);

        $supplier = Supplier::create(['name' => 'Supplier C', 'phone' => '0833333333']);

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PO-20260817-0005',
            'status' => 'ordered',
            'created_by' => $user->id,
        ]);

        // GET edit should redirect with error
        $response = $this->actingAs($user)
            ->get(route('purchase-orders.edit', $po));

        $response->assertRedirect(route('purchase-orders.show', $po));
        $response->assertSessionHas('error');

        // PUT update should also redirect with error
        $updateResponse = $this->actingAs($user)
            ->put(route('purchase-orders.update', $po), [
                'supplier_id' => $supplier->id,
                'items' => [
                    ['product_id' => 1, 'qty_ordered' => 5, 'unit_price' => 10000],
                ],
            ]);

        $updateResponse->assertRedirect(route('purchase-orders.show', $po));
        $updateResponse->assertSessionHas('error');
    }

    public function test_authorized_user_can_access_print_purchase_order(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
        ]);

        $supplier = Supplier::create(['name' => 'Supplier Print', 'phone' => '081299998888']);
        $product = $this->createProduct();

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PO-20260817-PRINT',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $po->items()->create([
            'product_id' => $product->id,
            'qty_ordered' => 10,
            'unit_price' => 12000,
            'conversion_factor' => 1,
        ]);

        $response = $this->actingAs($user)
            ->get(route('purchase-orders.print', $po));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/PurchaseOrders/Print')
            ->has('order')
            ->where('order.document_number', 'PO-20260817-PRINT')
        );
    }

    public function test_authorized_user_can_download_purchase_order_pdf(): void
    {
        $user = $this->createUserWithPermissions([
            'purchase-orders-access',
        ]);

        $supplier = Supplier::create(['name' => 'Supplier PDF Test', 'phone' => '081211112222']);
        $product = $this->createProduct();

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PO-20260817-PDF',
            'status' => 'ordered',
            'created_by' => $user->id,
        ]);

        $po->items()->create([
            'product_id' => $product->id,
            'qty_ordered' => 5,
            'unit_price' => 25000,
            'conversion_factor' => 1,
        ]);

        $response = $this->actingAs($user)
            ->get(route('pdf.purchase-orders.show', $po->document_number));

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
    }

    public function test_public_user_can_access_purchase_order_pdf_without_login(): void
    {
        $supplier = Supplier::create(['name' => 'Supplier Public Share', 'phone' => '081233334444']);
        $product = $this->createProduct();

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PO-20260817-PUBLIC',
            'status' => 'ordered',
        ]);

        $po->items()->create([
            'product_id' => $product->id,
            'qty_ordered' => 8,
            'unit_price' => 15000,
            'conversion_factor' => 1,
        ]);

        // Access without actingAs (guest)
        $response = $this->get(route('purchase-orders.public', $po->document_number));

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
    }
}
