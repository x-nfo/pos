<?php

namespace Tests\Feature\Inventory;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class StockOpnameTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Warehouse::firstOrCreate(
            ['code' => 'MAIN-TEST'],
            ['name' => 'Main Test Warehouse', 'type' => 'main', 'is_active' => true]
        );

        foreach ([
            'stock-opnames-access',
            'stock-opnames-create',
            'stock-opnames-finalize',
            'stock-mutations-access',
            'products-create',
            'products-edit',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_authorized_user_can_create_stock_opname_draft(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('stock-opnames.store'), [
                'notes' => 'Opname bulanan gudang depan',
            ]);

        $stockOpname = StockOpname::first();

        $response->assertRedirect(route('stock-opnames.show', $stockOpname));
        $this->assertNotNull($stockOpname);
        $this->assertSame('draft', $stockOpname->status);
        $this->assertSame('Opname bulanan gudang depan', $stockOpname->notes);
        $this->assertSame($user->id, $stockOpname->created_by);
        $this->assertStringStartsWith('SO-', $stockOpname->code);
    }

    public function test_duplicate_product_cannot_be_added_twice_to_same_stock_opname(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
        ]);
        $product = $this->createProduct(18);
        $stockOpname = StockOpname::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'code' => 'SO-TEST-001',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $this->actingAs($user)->post(route('stock-opnames.items.store', $stockOpname), [
            'product_id' => $product->id,
        ]);

        $response = $this
            ->from(route('stock-opnames.show', $stockOpname))
            ->actingAs($user)
            ->post(route('stock-opnames.items.store', $stockOpname), [
                'product_id' => $product->id,
            ]);

        $response->assertInvalid(['product_id']);
        $this->assertDatabaseCount('stock_opname_items', 1);
    }

    public function test_updating_stock_opname_item_calculates_difference(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
        ]);
        $product = $this->createProduct(10);
        $stockOpname = StockOpname::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'code' => 'SO-TEST-002',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);
        $item = StockOpnameItem::create([
            'stock_opname_id' => $stockOpname->id,
            'product_id' => $product->id,
            'system_stock' => $product->stock,
        ]);

        $response = $this
            ->actingAs($user)
            ->patch(route('stock-opnames.items.update', [$stockOpname, $item]), [
                'physical_stock' => 7,
                'adjustment_reason' => 'Barang rusak',
            ]);

        $response->assertSessionDoesntHaveErrors();
        $item->refresh();

        $this->assertSame(7, $item->physical_stock);
        $this->assertSame(-3, $item->difference);
        $this->assertSame('Barang rusak', $item->adjustment_reason);
    }

    public function test_finalize_updates_product_stock_and_creates_mutation(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
            'stock-opnames-finalize',
        ]);
        $product = $this->createProduct(12);
        $stockOpname = StockOpname::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'code' => 'SO-TEST-003',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        StockOpnameItem::create([
            'stock_opname_id' => $stockOpname->id,
            'product_id' => $product->id,
            'system_stock' => $product->stock,
            'physical_stock' => 8,
            'difference' => -4,
            'adjustment_reason' => 'Selisih hitung fisik',
        ]);

        $response = $this
            ->from(route('stock-opnames.show', $stockOpname))
            ->actingAs($user)
            ->post(route('stock-opnames.finalize', $stockOpname));

        $response->assertRedirect(route('stock-opnames.show', $stockOpname));

        $this->assertSame(8, $product->fresh()->stock);
        $this->assertDatabaseHas('stock_opnames', [
            'id' => $stockOpname->id,
            'status' => 'finalized',
            'finalized_by' => $user->id,
        ]);
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'reference_type' => 'stock_opname',
            'reference_id' => $stockOpname->id,
            'mutation_type' => 'adjustment',
            'qty' => 4,
            'stock_before' => 12,
            'stock_after' => 8,
        ]);
    }

    public function test_finalize_rejects_difference_without_reason(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
            'stock-opnames-finalize',
        ]);
        $product = $this->createProduct(12);
        $stockOpname = StockOpname::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'code' => 'SO-TEST-004',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        StockOpnameItem::create([
            'stock_opname_id' => $stockOpname->id,
            'product_id' => $product->id,
            'system_stock' => $product->stock,
            'physical_stock' => 10,
            'difference' => -2,
            'adjustment_reason' => null,
        ]);

        $response = $this
            ->from(route('stock-opnames.show', $stockOpname))
            ->actingAs($user)
            ->post(route('stock-opnames.finalize', $stockOpname));

        $response->assertInvalid(['finalize']);
        $this->assertSame(12, $product->fresh()->stock);
        $this->assertDatabaseMissing('stock_mutations', [
            'reference_type' => 'stock_opname',
            'reference_id' => $stockOpname->id,
        ]);
    }

    public function test_finalized_session_cannot_be_updated(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
        ]);
        $product = $this->createProduct(9);
        $stockOpname = StockOpname::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'code' => 'SO-TEST-005',
            'status' => 'finalized',
            'created_by' => $user->id,
            'finalized_by' => $user->id,
            'finalized_at' => now(),
        ]);
        $item = StockOpnameItem::create([
            'stock_opname_id' => $stockOpname->id,
            'product_id' => $product->id,
            'system_stock' => $product->stock,
        ]);

        $response = $this
            ->from(route('stock-opnames.show', $stockOpname))
            ->actingAs($user)
            ->patch(route('stock-opnames.items.update', [$stockOpname, $item]), [
                'physical_stock' => 7,
            ]);

        $response->assertInvalid(['stock_opname']);
        $this->assertNull($item->fresh()->physical_stock);
    }

    public function test_product_update_does_not_change_stock_directly(): void
    {
        $user = $this->createUserWithPermissions(['products-edit']);
        $product = $this->createProduct(20);

        $response = $this
            ->actingAs($user)
            ->put(route('products.update', $product), [
                'barcode' => $product->barcode,
                'sku' => $product->sku,
                'title' => 'Produk Revisi',
                'description' => $product->description,
                'category_id' => $product->category_id,
                'buy_price' => $product->buy_price,
                'sell_price' => $product->sell_price,
                'stock' => 999,
            ]);

        $response->assertRedirect(route('products.index'));
        $product->refresh();

        $this->assertSame('Produk Revisi', $product->title);
        $this->assertSame(20, $product->stock);
    }

    public function test_product_create_generates_initial_stock_mutation(): void
    {
        Storage::fake('local');

        $user = $this->createUserWithPermissions(['products-create']);
        $category = Category::create([
            'name' => 'Minuman',
            'description' => 'Kategori minuman',
            'image' => 'minuman.png',
        ]);

        $warehouseId = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse', 'is_active' => true])->id;

        $response = $this
            ->actingAs($user)
            ->post(route('products.store'), [
                'image' => UploadedFile::fake()->image('product.png'),
                'barcode' => 'BRCD-'.Str::upper(Str::random(8)),
                'sku' => 'SKU-'.Str::upper(Str::random(8)),
                'title' => 'Produk Baru',
                'description' => 'Deskripsi produk baru',
                'category_id' => $category->id,
                'buy_price' => 10000,
                'sell_price' => 15000,
                'stock' => 15,
            ]);

        $product = Product::latest('id')->first();

        $response->assertRedirect(route('products.index'));
        $this->assertNotNull($product);
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'reference_type' => 'product_create',
            'reference_id' => $product->id,
            'mutation_type' => 'in',
            'qty' => 15,
            'stock_before' => 0,
            'stock_after' => 15,
            'created_by' => $user->id,
        ]);
    }

    public function test_add_product_to_stock_opname_uses_fallback_when_warehouse_pivot_missing(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
        ]);
        $warehouse = Warehouse::create([
            'code' => 'TK-TEST',
            'name' => 'Toko Uji',
            'type' => 'branch',
            'is_active' => true,
        ]);
        $product = $this->createProduct(25);
        $stockOpname = StockOpname::create([
            'code' => 'SO-WH-001',
            'warehouse_id' => $warehouse->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        // Product has no pivot in product_warehouse initially
        $this->assertDatabaseMissing('product_warehouse', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('stock-opnames.items.store', $stockOpname), [
                'product_id' => $product->id,
            ]);

        $response->assertSessionDoesntHaveErrors();

        // Check system_stock was populated from product stock (25) and pivot created
        $item = StockOpnameItem::where('stock_opname_id', $stockOpname->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($item);
        $this->assertSame(25, $item->system_stock);
        $this->assertDatabaseHas('product_warehouse', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 25,
        ]);
    }

    public function test_finalize_stock_opname_updates_product_warehouse_pivot(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
            'stock-opnames-finalize',
        ]);
        $warehouse = Warehouse::create([
            'code' => 'TK-TEST2',
            'name' => 'Toko Uji 2',
            'type' => 'branch',
            'is_active' => true,
        ]);
        $product = $this->createProduct(20);
        $product->warehouses()->syncWithoutDetaching([$warehouse->id => ['stock' => 20]]);
        $stockOpname = StockOpname::create([
            'code' => 'SO-WH-002',
            'warehouse_id' => $warehouse->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        StockOpnameItem::create([
            'stock_opname_id' => $stockOpname->id,
            'product_id' => $product->id,
            'system_stock' => 20,
            'physical_stock' => 15,
            'difference' => -5,
            'adjustment_reason' => 'Barang rusak',
        ]);

        $response = $this
            ->from(route('stock-opnames.show', $stockOpname))
            ->actingAs($user)
            ->post(route('stock-opnames.finalize', $stockOpname));

        $response->assertRedirect(route('stock-opnames.show', $stockOpname));

        $this->assertDatabaseHas('product_warehouse', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 15,
        ]);
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'stock_opname',
            'reference_id' => $stockOpname->id,
            'mutation_type' => 'adjustment',
            'qty' => 5,
            'stock_before' => 20,
            'stock_after' => 15,
        ]);
    }

    public function test_populate_items_adds_all_products_to_draft_stock_opname(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
        ]);
        $warehouse = Warehouse::create([
            'code' => 'WH-POP',
            'name' => 'Gudang Populate',
            'type' => 'warehouse',
            'is_active' => true,
        ]);
        $product1 = $this->createProduct(30);
        $product2 = $this->createProduct(40);

        $stockOpname = StockOpname::create([
            'code' => 'SO-POP-001',
            'warehouse_id' => $warehouse->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $response = $this
            ->from(route('stock-opnames.show', $stockOpname))
            ->actingAs($user)
            ->post(route('stock-opnames.populate', $stockOpname));

        $response->assertRedirect(route('stock-opnames.show', $stockOpname));
        $this->assertDatabaseCount('stock_opname_items', 2);
        $this->assertDatabaseHas('stock_opname_items', [
            'stock_opname_id' => $stockOpname->id,
            'product_id' => $product1->id,
            'system_stock' => 30,
        ]);
        $this->assertDatabaseHas('stock_opname_items', [
            'stock_opname_id' => $stockOpname->id,
            'product_id' => $product2->id,
            'system_stock' => 40,
        ]);
    }

    public function test_populate_items_with_category_filter(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-opnames-access',
            'stock-opnames-create',
        ]);
        $cat1 = Category::create([
            'name' => 'Kategori Khusus 1',
            'description' => 'Desc',
            'image' => 'cat1.png',
        ]);
        $cat2 = Category::create([
            'name' => 'Kategori Khusus 2',
            'description' => 'Desc',
            'image' => 'cat2.png',
        ]);

        $product1 = Product::create([
            'category_id' => $cat1->id,
            'image' => 'p1.png',
            'barcode' => 'BC111',
            'sku' => 'SKU111',
            'title' => 'Produk Cat 1',
            'description' => 'Deskripsi 1',
            'buy_price' => 10000,
            'sell_price' => 12000,
            'stock' => 10,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $product1->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 10]);

        $product2 = Product::create([
            'category_id' => $cat2->id,
            'image' => 'p2.png',
            'barcode' => 'BC222',
            'sku' => 'SKU222',
            'title' => 'Produk Cat 2',
            'description' => 'Deskripsi 2',
            'buy_price' => 20000,
            'sell_price' => 25000,
            'stock' => 20,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $product2->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 20]);

        $stockOpname = StockOpname::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'code' => 'SO-POP-CAT',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $response = $this
            ->from(route('stock-opnames.show', $stockOpname))
            ->actingAs($user)
            ->post(route('stock-opnames.populate', $stockOpname), [
                'category_id' => $cat1->id,
            ]);

        $response->assertRedirect(route('stock-opnames.show', $stockOpname));
        $this->assertDatabaseCount('stock_opname_items', 1);
        $this->assertDatabaseHas('stock_opname_items', [
            'stock_opname_id' => $stockOpname->id,
            'product_id' => $product1->id,
            'system_stock' => 10,
        ]);
        $this->assertDatabaseMissing('stock_opname_items', [
            'stock_opname_id' => $stockOpname->id,
            'product_id' => $product2->id,
        ]);
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create();
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

        return $product;
    }
}
