<?php

namespace Tests\Feature\Purchasing;

use App\Models\Category;
use App\Models\GoodsReceiving;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class GoodsReceivingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'goods-receivings-access',
            'goods-receivings-create',
            'purchase-orders-access',
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

        return Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(10)),
            'sku' => 'SKU-'.Str::upper(Str::random(10)),
            'title' => 'Produk Uji '.Str::upper(Str::random(4)),
            'description' => 'Deskripsi produk uji.',
            'buy_price' => 50000,
            'sell_price' => 75000,
            'stock' => $stock,
            'tax_rate' => 0,
        ]);
    }

    public function test_unauthorized_user_cannot_access_goods_receivings(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($user)
            ->get(route('goods-receivings.index'))
            ->assertForbidden();
    }

    public function test_authorized_user_can_receive_goods_and_update_stock_and_payable(): void
    {
        $user = $this->createUserWithPermissions([
            'goods-receivings-access',
            'goods-receivings-create',
            'purchase-orders-access',
        ]);

        $product = $this->createProduct(10);

        $supplier = Supplier::create([
            'name' => 'Kopi Nusantara',
            'phone' => '08111222333',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'GUDANG-KOP',
            'name' => 'Gudang Kopi',
            'type' => 'main',
            'is_active' => true,
        ]);

        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 10,
        ]);

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'document_number' => 'PO-20260817-0099',
            'status' => 'ordered',
            'created_by' => $user->id,
            'ordered_at' => now(),
        ]);

        $poItem = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'qty_ordered' => 20,
            'qty_received' => 0,
            'unit_price' => 50000,
        ]);

        $response = $this->actingAs($user)
            ->post(route('goods-receivings.store'), [
                'purchase_order_id' => $po->id,
                'notes' => 'Penerimaan batch 1',
                'items' => [
                    [
                        'purchase_order_item_id' => $poItem->id,
                        'qty_received' => 20,
                        'batch_number' => 'BATCH-KOP-01',
                        'expired_at' => now()->addYear()->format('Y-m-d'),
                    ],
                ],
            ]);

        $receiving = GoodsReceiving::first();
        $this->assertNotNull($receiving);
        $response->assertRedirect(route('goods-receivings.show', $receiving));

        // PO status should be completed
        $this->assertDatabaseHas('purchase_orders', [
            'id' => $po->id,
            'status' => 'completed',
        ]);

        // PO item qty_received updated
        $this->assertDatabaseHas('purchase_order_items', [
            'id' => $poItem->id,
            'qty_received' => 20,
        ]);

        // Stock in warehouse pivot incremented (10 + 20 = 30)
        $this->assertDatabaseHas('product_warehouse', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 30,
        ]);

        // Payable automatically created
        $this->assertDatabaseHas('payables', [
            'purchase_order_id' => $po->id,
            'supplier_id' => $supplier->id,
            'status' => 'unpaid',
            'total' => 1000000, // 20 * 50000
        ]);

        // Stock mutation recorded
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'reference_type' => 'goods_receiving',
            'reference_id' => $receiving->id,
            'mutation_type' => 'in',
            'qty' => 20,
        ]);
    }

    public function test_authorized_user_can_receive_goods_with_multi_uom_conversion(): void
    {
        $user = $this->createUserWithPermissions([
            'goods-receivings-access',
            'goods-receivings-create',
            'purchase-orders-access',
        ]);

        $product = $this->createProduct(0);

        $boxUnit = Unit::firstOrCreate(
            ['code' => 'KTK'],
            ['name' => 'Kotak', 'symbol' => 'ktk']
        );

        $cartonUnit = Unit::firstOrCreate(
            ['code' => 'DUS'],
            ['name' => 'Dus', 'symbol' => 'dus']
        );

        $product->units()->attach($boxUnit->id, [
            'is_base' => true,
            'conversion_factor' => 1.0000,
            'buy_price' => 22083,
            'sell_price' => 25000,
        ]);

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

        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 0,
        ]);

        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'document_number' => 'PO-20260825-0001',
            'status' => 'ordered',
            'created_by' => $user->id,
            'ordered_at' => now(),
        ]);

        $poItem = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'unit_id' => $cartonUnit->id,
            'conversion_factor' => 12.0000,
            'qty_ordered' => 2, // 2 Dus
            'qty_received' => 0,
            'unit_price' => 265000,
        ]);

        $response = $this->actingAs($user)
            ->post(route('goods-receivings.store'), [
                'purchase_order_id' => $po->id,
                'notes' => 'Penerimaan Susu 2 Dus',
                'items' => [
                    [
                        'purchase_order_item_id' => $poItem->id,
                        'qty_received' => 2,
                    ],
                ],
            ]);

        $receiving = GoodsReceiving::where('purchase_order_id', $po->id)->first();
        $this->assertNotNull($receiving);
        $response->assertRedirect(route('goods-receivings.show', $receiving));

        // Goods receiving item has unit_id and conversion_factor
        $this->assertDatabaseHas('goods_receiving_items', [
            'goods_receiving_id' => $receiving->id,
            'purchase_order_item_id' => $poItem->id,
            'product_id' => $product->id,
            'unit_id' => $cartonUnit->id,
            'conversion_factor' => 12.0000,
            'qty_received' => 2,
        ]);

        // PO item qty_received is 2
        $this->assertDatabaseHas('purchase_order_items', [
            'id' => $poItem->id,
            'qty_received' => 2,
        ]);

        // Stock in warehouse pivot converted: 0 + (2 * 12) = 24
        $this->assertDatabaseHas('product_warehouse', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 24,
        ]);

        // Master stock converted: 0 + (2 * 12) = 24
        $this->assertSame(24, (int) $product->fresh()->stock);

        // Payable automatically created: 2 * 265000 = 530000
        $this->assertDatabaseHas('payables', [
            'purchase_order_id' => $po->id,
            'supplier_id' => $supplier->id,
            'total' => 530000,
        ]);

        // Stock mutation recorded: 24 base units
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'reference_type' => 'goods_receiving',
            'reference_id' => $receiving->id,
            'mutation_type' => 'in',
            'qty' => 24,
            'stock_before' => 0,
            'stock_after' => 24,
        ]);
    }
}
