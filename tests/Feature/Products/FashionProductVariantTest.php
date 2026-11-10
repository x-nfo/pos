<?php

namespace Tests\Feature\Products;

use App\Models\Cart;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockOpname;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\CashierShiftService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class FashionProductVariantTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_fashion_master_product_and_variants(): void
    {
        $category = Category::create([
            'name' => 'Kaos & T-Shirt',
            'image' => 'categories/tshirt.png',
            'description' => 'Kategori Pakaian Kaos',
        ]);

        // 1. Create Master Product (Artikel)
        $masterProduct = Product::create([
            'category_id' => $category->id,
            'title' => 'Oversized Heavyweight T-Shirt',
            'image' => 'products/oversized-tshirt.png',
            'barcode' => 'ART-OVS-001',
            'sku' => 'ART-OVS-001',
            'description' => 'Kaos Katun 24s dengan potongan oversized',
            'buy_price' => 50000,
            'sell_price' => 125000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $this->assertTrue($masterProduct->isParent());
        $this->assertFalse($masterProduct->isVariant());
        $this->assertCount(0, $masterProduct->variants);

        // 2. Create Variant A: Hitam - M
        $variantBlackM = Product::create([
            'parent_id' => $masterProduct->id,
            'category_id' => $category->id,
            'title' => 'Oversized Heavyweight T-Shirt - Hitam M',
            'image' => 'products/oversized-black.png',
            'barcode' => 'OVS-BLK-M',
            'sku' => 'OVS-BLK-M',
            'description' => 'Varian Hitam M',
            'buy_price' => 50000,
            'sell_price' => 125000,
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => [
                'color_name' => 'Hitam',
                'color_hex' => '#000000',
                'size' => 'M',
            ],
        ]);

        // 3. Create Variant B: Sage Green - XL
        $variantSageXL = Product::create([
            'parent_id' => $masterProduct->id,
            'category_id' => $category->id,
            'title' => 'Oversized Heavyweight T-Shirt - Sage Green XL',
            'image' => 'products/oversized-sage.png',
            'barcode' => 'OVS-SGE-XL',
            'sku' => 'OVS-SGE-XL',
            'description' => 'Varian Sage Green XL',
            'buy_price' => 50000,
            'sell_price' => 135000, // Harga khusus ukuran besar
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => [
                'color_name' => 'Sage Green',
                'color_hex' => '#84a98c',
                'size' => 'XL',
            ],
        ]);

        // Assertions
        $this->assertTrue($variantBlackM->isVariant());
        $this->assertSame('Hitam - M', $variantBlackM->variant_label);
        $this->assertSame('Sage Green - XL', $variantSageXL->variant_label);
        $this->assertSame($masterProduct->id, $variantBlackM->parent->id);

        $freshMaster = $masterProduct->fresh();
        $this->assertCount(2, $freshMaster->variants);
        $this->assertSame('OVS-BLK-M', $freshMaster->variants->first()->barcode);
    }

    public function test_can_store_product_with_matrix_variants_via_controller(): void
    {
        $role = Role::create(['name' => 'admin']);
        $permission = Permission::create(['name' => 'products-create']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $warehouse = Warehouse::create([
            'code' => 'PST',
            'name' => 'Gudang Pusat',
            'type' => 'main',
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Kemeja Formal',
            'image' => 'categories/shirt.png',
            'description' => 'Kemeja Fashion',
        ]);

        $payload = [
            'has_variants' => true,
            'title' => 'Kemeja Katun Oxford Slim Fit',
            'category_id' => $category->id,
            'description' => 'Kemeja Oxford Katun',
            'buy_price' => 80000,
            'sell_price' => 199000,
            'barcode' => 'KMJ-OXF-001',
            'sku' => 'KMJ-OXF-001',
            'variants' => [
                [
                    'color_name' => 'Putih',
                    'color_hex' => '#ffffff',
                    'size' => 'M',
                    'barcode' => 'KMJ-OXF-WHT-M',
                    'sku' => 'KMJ-OXF-WHT-M',
                    'buy_price' => 80000,
                    'sell_price' => 199000,
                    'stock' => 15,
                ],
                [
                    'color_name' => 'Putih',
                    'color_hex' => '#ffffff',
                    'size' => 'L',
                    'barcode' => 'KMJ-OXF-WHT-L',
                    'sku' => 'KMJ-OXF-WHT-L',
                    'buy_price' => 80000,
                    'sell_price' => 199000,
                    'stock' => 20,
                ],
                [
                    'color_name' => 'Navy',
                    'color_hex' => '#000080',
                    'size' => 'XL',
                    'barcode' => 'KMJ-OXF-NVY-XL',
                    'sku' => 'KMJ-OXF-NVY-XL',
                    'buy_price' => 85000,
                    'sell_price' => 209000,
                    'stock' => 10,
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('products.store'), $payload);
        $response->assertRedirect(route('products.index'));

        $master = Product::where('sku', 'KMJ-OXF-001')->first();
        $this->assertNotNull($master);
        $this->assertTrue($master->has_variants);
        $this->assertNull($master->parent_id);
        $this->assertEquals(45, $master->stock); // 15 + 20 + 10

        $this->assertCount(3, $master->variants);
        $this->assertDatabaseHas('products', [
            'parent_id' => $master->id,
            'barcode' => 'KMJ-OXF-NVY-XL',
            'sell_price' => 209000,
        ]);

        $variantNavy = Product::where('barcode', 'KMJ-OXF-NVY-XL')->first();
        $this->assertNotNull($variantNavy);
        $this->assertEquals(10, $variantNavy->stock);
        $this->assertSame('Navy - XL', $variantNavy->variant_label);
    }

    public function test_public_catalog_returns_parent_products_with_variants_and_attributes(): void
    {
        $warehouse = Warehouse::create([
            'code' => 'PST',
            'name' => 'Toko Fashion Utama',
            'type' => 'main',
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Koleksi Lebaran',
            'image' => 'categories/lebaran.png',
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Gamis Silk Premium',
            'barcode' => 'GMS-SLK-001',
            'sku' => 'GMS-SLK-001',
            'buy_price' => 150000,
            'sell_price' => 350000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variantSage = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Gamis Silk Premium - Sage L',
            'barcode' => 'GMS-SLK-SGE-L',
            'sku' => 'GMS-SLK-SGE-L',
            'buy_price' => 150000,
            'sell_price' => 350000,
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => [
                'warna' => 'Sage Green',
                'color_hex' => '#9caf88',
                'ukuran' => 'L',
            ],
        ]);

        $variantSage->warehouses()->attach($warehouse->id, ['stock' => 8]);

        $response = $this->get(route('catalog.index'));
        $response->assertOk();

        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Catalog')
            ->has('products.data', 1)
            ->where('products.data.0.title', 'Gamis Silk Premium')
            ->where('products.data.0.has_variants', true)
            ->where('products.data.0.stock', 8)
            ->has('products.data.0.variants', 1)
            ->where('products.data.0.variants.0.barcode', 'GMS-SLK-SGE-L')
            ->where('products.data.0.variants.0.variant_attributes.warna', 'Sage Green')
        );
    }

    public function test_pos_search_product_by_hangtag_barcode_returns_variant_directly(): void
    {
        $role = Role::create(['name' => 'kasir']);
        $permission = Permission::create(['name' => 'transactions-access']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('kasir');

        $warehouse = Warehouse::create([
            'code' => 'TKO',
            'name' => 'Toko Kasir',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Denim',
            'image' => 'categories/denim.png',
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Selvedge Jeans 14oz',
            'barcode' => 'JNS-SLV-001',
            'sku' => 'JNS-SLV-001',
            'buy_price' => 200000,
            'sell_price' => 450000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variant32 = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Selvedge Jeans 14oz - Indigo 32',
            'barcode' => 'JNS-SLV-IDG-32',
            'sku' => 'JNS-SLV-IDG-32',
            'buy_price' => 200000,
            'sell_price' => 450000,
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => [
                'warna' => 'Indigo Deep Blue',
                'color_hex' => '#1b2a47',
                'ukuran' => '32',
            ],
        ]);

        $variant32->warehouses()->attach($warehouse->id, ['stock' => 5]);

        // Open shift for cashier in this warehouse
        app(CashierShiftService::class)->openShift($user, $user, 100000, null, $warehouse->id);

        $response = $this->actingAs($user)->postJson(route('transactions.searchProduct'), [
            'barcode' => 'JNS-SLV-IDG-32',
        ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'data' => [
                'id' => $variant32->id,
                'barcode' => 'JNS-SLV-IDG-32',
                'stock' => 5,
            ],
        ]);
    }

    public function test_pos_search_product_by_master_barcode_returns_master_with_aggregated_stock_and_variants(): void
    {
        $role = Role::create(['name' => 'kasir']);
        $permission = Permission::create(['name' => 'transactions-access']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('kasir');

        $warehouse = Warehouse::create([
            'code' => 'TKO2',
            'name' => 'Toko Kasir 2',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Jaket & Outerwear',
            'image' => 'categories/jacket.png',
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Varsity Jacket Vintage',
            'barcode' => 'JKT-VRS-001',
            'sku' => 'JKT-VRS-001',
            'buy_price' => 250000,
            'sell_price' => 550000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variantM = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Varsity Jacket Vintage - Forest Green M',
            'barcode' => 'JKT-VRS-GRN-M',
            'sku' => 'JKT-VRS-GRN-M',
            'buy_price' => 250000,
            'sell_price' => 550000,
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => [
                'color_name' => 'Forest Green',
                'color_hex' => '#1b4d3e',
                'size' => 'M',
            ],
        ]);
        $variantM->warehouses()->attach($warehouse->id, ['stock' => 7]);

        $variantL = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Varsity Jacket Vintage - Forest Green L',
            'barcode' => 'JKT-VRS-GRN-L',
            'sku' => 'JKT-VRS-GRN-L',
            'buy_price' => 250000,
            'sell_price' => 550000,
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => [
                'color_name' => 'Forest Green',
                'color_hex' => '#1b4d3e',
                'size' => 'L',
            ],
        ]);
        $variantL->warehouses()->attach($warehouse->id, ['stock' => 3]);

        app(CashierShiftService::class)->openShift($user, $user, 100000, null, $warehouse->id);

        $response = $this->actingAs($user)->postJson(route('transactions.searchProduct'), [
            'barcode' => 'JKT-VRS-001',
        ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'data' => [
                'id' => $master->id,
                'barcode' => 'JKT-VRS-001',
                'has_variants' => true,
                'stock' => 10, // 7 + 3
            ],
        ]);
        $this->assertCount(2, $response->json('data.variants'));
    }

    public function test_can_store_product_with_variant_images_per_color_and_row_override(): void
    {
        Storage::fake('local');

        $role = Role::create(['name' => 'admin']);
        $permission = Permission::create(['name' => 'products-create']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $category = Category::create([
            'name' => 'Polo Shirt',
            'image' => 'categories/polo.png',
        ]);

        $masterImage = UploadedFile::fake()->image('master.jpg');
        $redColorImage = UploadedFile::fake()->image('red-color.jpg');
        $customRowImage = UploadedFile::fake()->image('custom-red-xl.jpg');

        $payload = [
            'has_variants' => true,
            'title' => 'Polo Shirt Premium Pique',
            'category_id' => $category->id,
            'buy_price' => 70000,
            'sell_price' => 150000,
            'barcode' => 'POLO-PIQ-001',
            'sku' => 'POLO-PIQ-001',
            'image' => $masterImage,
            'color_images' => [
                'Merah' => $redColorImage,
            ],
            'variants' => [
                [
                    // Row 0: Merah M -> should inherit Merah color image
                    'color_name' => 'Merah',
                    'color_hex' => '#ef4444',
                    'size' => 'M',
                    'barcode' => 'POLO-RED-M',
                    'sku' => 'POLO-RED-M',
                    'buy_price' => 70000,
                    'sell_price' => 150000,
                    'stock' => 10,
                ],
                [
                    // Row 1: Merah XL -> has custom row override image
                    'color_name' => 'Merah',
                    'color_hex' => '#ef4444',
                    'size' => 'XL',
                    'barcode' => 'POLO-RED-XL',
                    'sku' => 'POLO-RED-XL',
                    'buy_price' => 70000,
                    'sell_price' => 150000,
                    'stock' => 5,
                    'image' => $customRowImage,
                ],
                [
                    // Row 2: Hitam L -> no color image, should fallback to master product image
                    'color_name' => 'Hitam',
                    'color_hex' => '#000000',
                    'size' => 'L',
                    'barcode' => 'POLO-BLK-L',
                    'sku' => 'POLO-BLK-L',
                    'buy_price' => 70000,
                    'sell_price' => 150000,
                    'stock' => 8,
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('products.store'), $payload);
        $response->assertRedirect(route('products.index'));

        $master = Product::where('sku', 'POLO-PIQ-001')->first();
        $this->assertNotNull($master);

        $variantRedM = Product::where('barcode', 'POLO-RED-M')->first();
        $variantRedXL = Product::where('barcode', 'POLO-RED-XL')->first();
        $variantBlkL = Product::where('barcode', 'POLO-BLK-L')->first();

        $this->assertNotNull($variantRedM);
        $this->assertNotNull($variantRedXL);
        $this->assertNotNull($variantBlkL);

        // Raw filenames stored on disk
        $rawMasterImage = $master->getRawOriginal('image');
        $rawRedMImage = $variantRedM->getRawOriginal('image');
        $rawRedXLImage = $variantRedXL->getRawOriginal('image');
        $rawBlkLImage = $variantBlkL->getRawOriginal('image');

        // Merah M inherits color image
        $this->assertSame($redColorImage->hashName(), $rawRedMImage);
        Storage::disk('local')->assertExists('public/products/'.$rawRedMImage);

        // Merah XL uses row override image
        $this->assertSame($customRowImage->hashName(), $rawRedXLImage);
        Storage::disk('local')->assertExists('public/products/'.$rawRedXLImage);

        // Hitam L falls back to master image
        $this->assertSame($rawMasterImage, $rawBlkLImage);
        Storage::disk('local')->assertExists('public/products/'.$rawMasterImage);
    }

    public function test_can_update_product_variants_and_images(): void
    {
        Storage::fake('local');

        $role = Role::create(['name' => 'admin']);
        $permission = Permission::create(['name' => 'products-edit']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $category = Category::create([
            'name' => 'Jaket',
            'image' => 'categories/jacket.png',
        ]);

        Warehouse::create([
            'code' => 'PST',
            'name' => 'Gudang Pusat',
            'type' => 'main',
            'is_active' => true,
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Hoodie Zipper Fleece',
            'barcode' => 'JKT-HD-001',
            'sku' => 'JKT-HD-001',
            'buy_price' => 120000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variantM = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Hoodie Zipper Fleece - Navy M',
            'barcode' => 'JKT-HD-NVY-M',
            'sku' => 'JKT-HD-NVY-M',
            'buy_price' => 120000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 10,
            'variant_attributes' => [
                'color_name' => 'Navy',
                'color_hex' => '#000080',
                'size' => 'M',
            ],
        ]);

        $newNavyImage = UploadedFile::fake()->image('navy-hoodie.jpg');

        $updatePayload = [
            'title' => 'Hoodie Zipper Fleece Updated',
            'category_id' => $category->id,
            'buy_price' => 125000,
            'sell_price' => 260000,
            'has_variants' => true,
            'variants' => [
                [
                    'id' => $variantM->id,
                    'color_name' => 'Navy',
                    'color_hex' => '#000080',
                    'size' => 'M',
                    'barcode' => 'JKT-HD-NVY-M',
                    'sku' => 'JKT-HD-NVY-M',
                    'buy_price' => 125000,
                    'sell_price' => 260000,
                    'stock' => 15,
                    'image' => $newNavyImage,
                ],
                [
                    // New variant added on update
                    'color_name' => 'Navy',
                    'color_hex' => '#000080',
                    'size' => 'L',
                    'barcode' => 'JKT-HD-NVY-L',
                    'sku' => 'JKT-HD-NVY-L',
                    'buy_price' => 125000,
                    'sell_price' => 260000,
                    'stock' => 20,
                ],
            ],
        ];

        $response = $this->actingAs($user)->put(route('products.update', $master->id), $updatePayload);
        $response->assertRedirect(route('products.index'));

        $freshMaster = $master->fresh();
        $this->assertEquals(35, $freshMaster->stock); // 15 + 20
        $this->assertCount(2, $freshMaster->variants);

        $freshVariantM = $variantM->fresh();
        $this->assertEquals(15, $freshVariantM->stock);
        $this->assertSame($newNavyImage->hashName(), $freshVariantM->getRawOriginal('image'));
        Storage::disk('local')->assertExists('public/products/'.$newNavyImage->hashName());
    }

    public function test_can_update_product_via_post_method_spoofing_without_files(): void
    {
        $role = Role::create(['name' => 'admin']);
        $permission = Permission::create(['name' => 'products-edit']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $category = Category::create([
            'name' => 'Kemeja Formal',
            'image' => 'categories/shirt.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'title' => 'Kemeja Katun Polos',
            'barcode' => 'KMJ-KTN-001',
            'sku' => 'KMJ-KTN-001',
            'buy_price' => 80000,
            'sell_price' => 150000,
            'tax_rate' => 0,
            'has_variants' => false,
        ]);

        // Simulates browser form submit with forceFormData: true and _method: PUT
        $response = $this->actingAs($user)->post(route('products.update', $product->id), [
            '_method' => 'PUT',
            'has_variants' => '0',
            'barcode' => 'KMJ-KTN-001',
            'sku' => 'KMJ-KTN-001',
            'title' => 'Kemeja Katun Polos Premium',
            'category_id' => $category->id,
            'buy_price' => 85000,
            'sell_price' => 165000,
            'min_stock' => 5,
            'max_stock' => 50,
        ]);

        $response->assertRedirect(route('products.index'));

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'title' => 'Kemeja Katun Polos Premium',
            'buy_price' => 85000,
            'sell_price' => 165000,
            'has_variants' => 0,
        ]);
    }

    public function test_products_index_includes_variant_images(): void
    {
        $role = Role::create(['name' => 'admin']);
        $permission = Permission::create(['name' => 'products-access']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $category = Category::create([
            'name' => 'Aksesoris',
            'image' => 'categories/acc.png',
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Topi Baseball Cap',
            'barcode' => 'TOP-BBL-001',
            'sku' => 'TOP-BBL-001',
            'buy_price' => 30000,
            'sell_price' => 65000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Topi Baseball Cap - Hitam',
            'image' => 'cap-black.jpg',
            'barcode' => 'TOP-BBL-BLK',
            'sku' => 'TOP-BBL-BLK',
            'buy_price' => 30000,
            'sell_price' => 65000,
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => [
                'color_name' => 'Hitam',
                'size' => 'All Size',
            ],
        ]);

        $response = $this->actingAs($user)->get(route('products.index'));
        $response->assertOk();

        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Dashboard/Products/Index')
            ->has('products.data', 1)
            ->where('products.data.0.has_variants', true)
            ->has('products.data.0.variants', 1)
            ->where('products.data.0.variants.0.barcode', 'TOP-BBL-BLK')
            ->where('products.data.0.variants.0.image', asset('/storage/products/cap-black.jpg'))
        );
    }

    public function test_updating_variants_reuses_existing_variant_and_soft_deletes_removed_with_history(): void
    {
        $role = Role::create(['name' => 'admin']);
        $permission = Permission::create(['name' => 'products-edit']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $category = Category::create([
            'name' => 'Gamis',
            'image' => 'categories/gamis.png',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'PST',
            'name' => 'Gudang Pusat',
            'type' => 'main',
            'is_active' => true,
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Abaya Premium Silk',
            'barcode' => 'ABY-001',
            'sku' => 'ABY-001',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variantXL = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Abaya Premium Silk - Hitam XL',
            'barcode' => 'ABY-HIT-XL',
            'sku' => 'ABY-HIT-XL',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 50,
            'variant_attributes' => [
                'color_name' => 'Hitam',
                'color_hex' => '#000000',
                'size' => 'XL',
            ],
        ]);

        // Fake a cart item to simulate historical relation on variantXL
        Cart::create([
            'cashier_id' => $user->id,
            'warehouse_id' => $warehouse->id,
            'product_id' => $variantXL->id,
            'qty' => 1,
            'price' => 250000,
        ]);
        $this->assertTrue($variantXL->fresh()->hasHistoricalRelations());

        // Update 1: Re-submit matrix without sending explicit 'id', but with same Hitam XL
        // Should reuse $variantXL instead of creating a second Hitam XL
        $payload1 = [
            'title' => 'Abaya Premium Silk',
            'category_id' => $category->id,
            'buy_price' => 100000,
            'sell_price' => 250000,
            'has_variants' => true,
            'variants' => [
                [
                    // Notice 'id' is omitted, barcode is supplied
                    'color_name' => 'Hitam',
                    'color_hex' => '#000000',
                    'size' => 'XL',
                    'barcode' => 'ABY-HIT-XL',
                    'sku' => 'ABY-HIT-XL',
                    'stock' => 45,
                ],
                [
                    'color_name' => 'Hitam',
                    'color_hex' => '#000000',
                    'size' => 'L',
                    'barcode' => 'ABY-HIT-L',
                    'sku' => 'ABY-HIT-L',
                    'stock' => 20,
                ],
            ],
        ];

        $response = $this->actingAs($user)->put(route('products.update', $master->id), $payload1);
        $response->assertRedirect(route('products.index'));

        // Should have exactly 2 active variants (Hitam XL and Hitam L), NOT 3!
        $activeVariants = Product::where('parent_id', $master->id)->get();
        $this->assertCount(2, $activeVariants);
        $this->assertSame($variantXL->id, $activeVariants->firstWhere('title', 'Abaya Premium Silk - Hitam XL')->id);
        $this->assertEquals(45, $activeVariants->firstWhere('title', 'Abaya Premium Silk - Hitam XL')->stock);

        // Update 2: Now remove Hitam XL completely from the matrix.
        // Because it has a cart, it should be soft-deleted and its stock zeroed out, NOT kept as active duplicate.
        $payload2 = [
            'title' => 'Abaya Premium Silk',
            'category_id' => $category->id,
            'buy_price' => 100000,
            'sell_price' => 250000,
            'has_variants' => true,
            'variants' => [
                [
                    'color_name' => 'Hitam',
                    'color_hex' => '#000000',
                    'size' => 'L',
                    'barcode' => 'ABY-HIT-L',
                    'sku' => 'ABY-HIT-L',
                    'stock' => 20,
                ],
            ],
        ];

        $response2 = $this->actingAs($user)->put(route('products.update', $master->id), $payload2);
        $response2->assertRedirect(route('products.index'));

        $remainingActive = Product::where('parent_id', $master->id)->get();
        $this->assertCount(1, $remainingActive);
        $this->assertSame('Abaya Premium Silk - Hitam L', $remainingActive->first()->title);

        // $variantXL must now be soft-deleted
        $this->assertSoftDeleted('products', ['id' => $variantXL->id]);
    }

    public function test_updating_product_variant_photos_via_color_images_applies_to_matching_variants(): void
    {
        Storage::fake('local');

        $role = Role::create(['name' => 'admin']);
        $permission = Permission::create(['name' => 'products-edit']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $category = Category::create([
            'name' => 'Gamis',
            'image' => 'categories/gamis.png',
        ]);

        Warehouse::create([
            'code' => 'PST',
            'name' => 'Gudang Pusat',
            'type' => 'main',
            'is_active' => true,
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Abaya Silk',
            'barcode' => 'ABY-002',
            'sku' => 'ABY-002',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variantHitamS = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Abaya Silk - Hitam S',
            'barcode' => 'ABY-HIT-S',
            'sku' => 'ABY-HIT-S',
            'image' => 'old-hitam.jpg',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 10,
            'variant_attributes' => ['color_name' => 'Hitam', 'color_hex' => '#000000', 'size' => 'S'],
        ]);

        $variantHitamM = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Abaya Silk - Hitam M',
            'barcode' => 'ABY-HIT-M',
            'sku' => 'ABY-HIT-M',
            'image' => 'old-hitam.jpg',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 15,
            'variant_attributes' => ['color_name' => 'Hitam', 'color_hex' => '#000000', 'size' => 'M'],
        ]);

        $variantNavyL = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Abaya Silk - Navy L',
            'barcode' => 'ABY-NVY-L',
            'sku' => 'ABY-NVY-L',
            'image' => 'saved-navy.jpg',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 20,
            'variant_attributes' => ['color_name' => 'Navy', 'color_hex' => '#000080', 'size' => 'L'],
        ]);

        $newHitamImage = UploadedFile::fake()->image('new-hitam.jpg');

        $updatePayload = [
            'title' => 'Abaya Silk Updated',
            'category_id' => $category->id,
            'buy_price' => 100000,
            'sell_price' => 250000,
            'has_variants' => true,
            'color_images' => [
                'Hitam' => $newHitamImage,
                'Navy' => $variantNavyL->image, // existing URL string
            ],
            'variants' => [
                [
                    'id' => $variantHitamS->id,
                    'color_name' => 'Hitam',
                    'color_hex' => '#000000',
                    'size' => 'S',
                    'barcode' => 'ABY-HIT-S',
                    'sku' => 'ABY-HIT-S',
                    'stock' => 10,
                    'image' => $variantHitamS->image, // pre-populated old image URL
                    'has_row_override' => false,
                ],
                [
                    'id' => $variantHitamM->id,
                    'color_name' => 'Hitam',
                    'color_hex' => '#000000',
                    'size' => 'M',
                    'barcode' => 'ABY-HIT-M',
                    'sku' => 'ABY-HIT-M',
                    'stock' => 15,
                    'image' => $variantHitamM->image,
                    'has_row_override' => false,
                ],
                [
                    'id' => $variantNavyL->id,
                    'color_name' => 'Navy',
                    'color_hex' => '#000080',
                    'size' => 'L',
                    'barcode' => 'ABY-NVY-L',
                    'sku' => 'ABY-NVY-L',
                    'stock' => 20,
                    'image' => $variantNavyL->image,
                    'has_row_override' => false,
                ],
            ],
        ];

        $response = $this->actingAs($user)->put(route('products.update', $master->id), $updatePayload);
        $response->assertRedirect(route('products.index'));

        // Hitam variants must receive the newly uploaded image hashname, not keep old-hitam.jpg
        $this->assertSame($newHitamImage->hashName(), $variantHitamS->fresh()->getRawOriginal('image'));
        $this->assertSame($newHitamImage->hashName(), $variantHitamM->fresh()->getRawOriginal('image'));
        Storage::disk('local')->assertExists('public/products/'.$newHitamImage->hashName());

        // Navy variant must preserve saved-navy.jpg
        $this->assertSame('saved-navy.jpg', $variantNavyL->fresh()->getRawOriginal('image'));
    }

    public function test_updating_product_variant_with_row_override_persists_row_specific_photo(): void
    {
        Storage::fake('local');

        $role = Role::create(['name' => 'admin']);
        $permission = Permission::create(['name' => 'products-edit']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $category = Category::create([
            'name' => 'Gamis',
            'image' => 'categories/gamis.png',
        ]);

        Warehouse::create([
            'code' => 'PST',
            'name' => 'Gudang Pusat',
            'type' => 'main',
            'is_active' => true,
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Abaya Silk Special',
            'barcode' => 'ABY-003',
            'sku' => 'ABY-003',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variantS = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Abaya Silk Special - Hitam S',
            'barcode' => 'ABY-SP-HIT-S',
            'sku' => 'ABY-SP-HIT-S',
            'image' => 'old-hitam.jpg',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 10,
            'variant_attributes' => ['color_name' => 'Hitam', 'color_hex' => '#000000', 'size' => 'S'],
        ]);

        $variantM = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Abaya Silk Special - Hitam M',
            'barcode' => 'ABY-SP-HIT-M',
            'sku' => 'ABY-SP-HIT-M',
            'image' => 'old-hitam.jpg',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 15,
            'variant_attributes' => ['color_name' => 'Hitam', 'color_hex' => '#000000', 'size' => 'M'],
        ]);

        $colorHitamImage = UploadedFile::fake()->image('color-hitam.jpg');
        $rowSpecialImage = UploadedFile::fake()->image('special-row-s.jpg');

        $updatePayload = [
            'title' => 'Abaya Silk Special Updated',
            'category_id' => $category->id,
            'buy_price' => 100000,
            'sell_price' => 250000,
            'has_variants' => true,
            'color_images' => [
                'Hitam' => $colorHitamImage,
            ],
            'variants' => [
                [
                    'id' => $variantS->id,
                    'color_name' => 'Hitam',
                    'color_hex' => '#000000',
                    'size' => 'S',
                    'barcode' => 'ABY-SP-HIT-S',
                    'sku' => 'ABY-SP-HIT-S',
                    'stock' => 10,
                    'image' => $rowSpecialImage, // row override file
                    'has_row_override' => true,
                ],
                [
                    'id' => $variantM->id,
                    'color_name' => 'Hitam',
                    'color_hex' => '#000000',
                    'size' => 'M',
                    'barcode' => 'ABY-SP-HIT-M',
                    'sku' => 'ABY-SP-HIT-M',
                    'stock' => 15,
                    'has_row_override' => false,
                ],
            ],
        ];

        $response = $this->actingAs($user)->put(route('products.update', $master->id), $updatePayload);
        $response->assertRedirect(route('products.index'));

        // S has row override
        $this->assertSame($rowSpecialImage->hashName(), $variantS->fresh()->getRawOriginal('image'));
        Storage::disk('local')->assertExists('public/products/'.$rowSpecialImage->hashName());

        // M inherits color image
        $this->assertSame($colorHitamImage->hashName(), $variantM->fresh()->getRawOriginal('image'));
        Storage::disk('local')->assertExists('public/products/'.$colorHitamImage->hashName());
    }

    public function test_edit_screen_passes_color_images_and_row_override_flags(): void
    {
        $role = Role::create(['name' => 'admin']);
        $permission = Permission::create(['name' => 'products-edit']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $category = Category::create([
            'name' => 'Gamis',
            'image' => 'categories/gamis.png',
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Abaya Silk In Edit',
            'barcode' => 'ABY-004',
            'sku' => 'ABY-004',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Abaya Silk In Edit - Hitam S',
            'barcode' => 'ABY-EDIT-HIT-S',
            'sku' => 'ABY-EDIT-HIT-S',
            'image' => 'color-hitam.jpg',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 10,
            'variant_attributes' => ['color_name' => 'Hitam', 'color_hex' => '#000000', 'size' => 'S'],
        ]);

        Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Abaya Silk In Edit - Hitam M',
            'barcode' => 'ABY-EDIT-HIT-M',
            'sku' => 'ABY-EDIT-HIT-M',
            'image' => 'custom-override.jpg',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 15,
            'variant_attributes' => ['color_name' => 'Hitam', 'color_hex' => '#000000', 'size' => 'M'],
        ]);

        $response = $this->actingAs($user)->get(route('products.edit', $master->id));
        $response->assertOk();

        $productProp = $response->viewData('page')['props']['product'];
        $this->assertNotEmpty($productProp['color_images']);
        $this->assertArrayHasKey('Hitam', $productProp['color_images']);

        $variantsData = $productProp['variants_data'];
        $this->assertCount(2, $variantsData);
        $variantSData = collect($variantsData)->firstWhere('size', 'S');
        $variantMData = collect($variantsData)->firstWhere('size', 'M');

        $this->assertFalse($variantSData['has_row_override']);
        $this->assertTrue($variantMData['has_row_override']);
    }

    public function test_products_index_and_edit_aggregate_variant_stocks_when_filtered_by_warehouse(): void
    {
        $role = Role::create(['name' => 'admin']);
        $permissionAccess = Permission::create(['name' => 'products-access']);
        $permissionEdit = Permission::create(['name' => 'products-edit']);
        $role->givePermissionTo([$permissionAccess, $permissionEdit]);
        $user = User::factory()->create();
        $user->assignRole('admin');

        $whA = Warehouse::create(['code' => 'WHA', 'name' => 'Cabang Jakarta', 'type' => 'branch', 'is_active' => true]);
        $whB = Warehouse::create(['code' => 'WHB', 'name' => 'Cabang Bandung', 'type' => 'branch', 'is_active' => true]);

        $category = Category::create([
            'name' => 'Hoodie',
            'image' => 'categories/hoodie.png',
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Boxy Fit Heavyweight Hoodie',
            'barcode' => 'HD-BOX-001',
            'sku' => 'HD-BOX-001',
            'buy_price' => 150000,
            'sell_price' => 350000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $varHitam = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Boxy Fit Heavyweight Hoodie - Hitam M',
            'barcode' => 'HD-BOX-HIT-M',
            'sku' => 'HD-BOX-HIT-M',
            'buy_price' => 150000,
            'sell_price' => 350000,
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => ['color_name' => 'Hitam', 'color_hex' => '#000000', 'size' => 'M'],
        ]);
        $varHitam->warehouses()->attach($whA->id, ['stock' => 5]);
        $varHitam->warehouses()->attach($whB->id, ['stock' => 0]);

        $varAbu = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Boxy Fit Heavyweight Hoodie - Abu L',
            'barcode' => 'HD-BOX-ABU-L',
            'sku' => 'HD-BOX-ABU-L',
            'buy_price' => 150000,
            'sell_price' => 350000,
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => ['color_name' => 'Abu', 'color_hex' => '#888888', 'size' => 'L'],
        ]);
        $varAbu->warehouses()->attach($whA->id, ['stock' => 10]);
        $varAbu->warehouses()->attach($whB->id, ['stock' => 3]);

        // 1. Index when filtered by Cabang Jakarta (whA)
        $responseA = $this->actingAs($user)->get(route('products.index', ['warehouse_id' => $whA->id]));
        $responseA->assertOk();

        $pagePropsA = $responseA->viewData('page')['props'];
        $productInList = collect($pagePropsA['products']['data'])->firstWhere('id', $master->id);
        $this->assertNotNull($productInList, 'Master product must appear when filtering by warehouse.');
        $this->assertEquals(15, $productInList['stock']); // 5 + 10 in whA
        $this->assertEquals(18, $productInList['total_stock']); // 15 (whA) + 3 (whB)

        // 2. Edit screen of master product aggregates total stock and warehouses
        $responseEdit = $this->actingAs($user)->get(route('products.edit', $master->id));
        $responseEdit->assertOk();
        $editProduct = $responseEdit->viewData('page')['props']['product'];
        $this->assertEquals(18, $editProduct['stock']);
        $this->assertNotEmpty($editProduct['warehouses']);
        $whAPivot = collect($editProduct['warehouses'])->firstWhere('id', $whA->id);
        $this->assertEquals(15, $whAPivot->pivot->stock);
    }

    public function test_cannot_add_master_product_with_variants_to_cart(): void
    {
        $role = Role::create(['name' => 'kasir']);
        $permission = Permission::create(['name' => 'transactions-access']);
        $role->givePermissionTo($permission);
        $user = User::factory()->create();
        $user->assignRole('kasir');

        $wh = Warehouse::create(['code' => 'TK1', 'name' => 'Toko 1', 'type' => 'branch', 'is_active' => true]);

        $category = Category::create([
            'name' => 'Cardigan',
            'image' => 'categories/cardigan.png',
        ]);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Knit Cardigan Premium',
            'barcode' => 'CDG-001',
            'sku' => 'CDG-001',
            'buy_price' => 100000,
            'sell_price' => 200000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        app(CashierShiftService::class)->openShift($user, $user, 100000, null, $wh->id);

        $response = $this->actingAs($user)->post(route('transactions.addToCart'), [
            'product_id' => $master->id,
            'qty' => 1,
        ]);

        $response->assertSessionHas('error');
        $this->assertDatabaseMissing('carts', [
            'cashier_id' => $user->id,
            'product_id' => $master->id,
        ]);
    }

    public function test_master_product_with_variants_is_excluded_from_stock_opname(): void
    {
        $role = Role::create(['name' => 'inventory-staff']);
        $role->givePermissionTo([
            Permission::create(['name' => 'stock-opnames-access']),
            Permission::create(['name' => 'stock-opnames-create']),
        ]);
        $user = User::factory()->create();
        $user->assignRole('inventory-staff');

        $wh = Warehouse::create(['code' => 'GD1', 'name' => 'Gudang Pusat', 'type' => 'warehouse', 'is_active' => true]);
        $category = Category::create(['name' => 'Celana Chino', 'image' => 'categories/chino.png']);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Celana Chino Slim Fit',
            'barcode' => 'CHN-SLM-001',
            'sku' => 'CHN-SLM-001',
            'buy_price' => 80000,
            'sell_price' => 175000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variant = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Celana Chino Slim Fit - Khaki 30',
            'barcode' => 'CHN-KHK-30',
            'sku' => 'CHN-KHK-30',
            'buy_price' => 80000,
            'sell_price' => 175000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 10,
        ]);
        $variant->warehouses()->sync([$wh->id => ['stock' => 10]]);

        $opname = StockOpname::create([
            'warehouse_id' => $wh->id,
            'code' => 'SO-TEST-001',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        // 1. Search available products should only return variant, not master
        $response = $this->actingAs($user)->get(route('stock-opnames.show', [
            'stockOpname' => $opname->id,
            'product_search' => 'Chino',
        ]));
        $response->assertOk();
        $available = $response->viewData('page')['props']['availableProducts'];
        $productIds = collect($available)->pluck('id');
        $this->assertTrue($productIds->contains($variant->id));
        $this->assertFalse($productIds->contains($master->id));

        // 2. Direct storeItem with master product must fail validation
        $responseAddMaster = $this->actingAs($user)->post(route('stock-opnames.items.store', $opname->id), [
            'product_id' => $master->id,
        ]);
        $responseAddMaster->assertSessionHasErrors('product_id');

        // 3. Populate items should only populate variant, never master product
        $responsePopulate = $this->actingAs($user)->post(route('stock-opnames.populate', $opname->id), [
            'category_id' => $category->id,
        ]);
        $responsePopulate->assertSessionHas('success');
        $this->assertDatabaseHas('stock_opname_items', [
            'stock_opname_id' => $opname->id,
            'product_id' => $variant->id,
        ]);
        $this->assertDatabaseMissing('stock_opname_items', [
            'stock_opname_id' => $opname->id,
            'product_id' => $master->id,
        ]);
    }

    public function test_master_product_with_variants_is_excluded_from_purchase_orders(): void
    {
        $role = Role::create(['name' => 'purchasing-staff']);
        $role->givePermissionTo([
            Permission::create(['name' => 'purchase-orders-access']),
            Permission::create(['name' => 'purchase-orders-create']),
        ]);
        $user = User::factory()->create();
        $user->assignRole('purchasing-staff');

        $wh = Warehouse::create(['code' => 'GD2', 'name' => 'Gudang 2', 'type' => 'warehouse', 'is_active' => true]);
        $supplier = Supplier::create(['name' => 'Konveksi Bandung', 'phone' => '08123456789']);
        $category = Category::create(['name' => 'Kemeja Formal', 'image' => 'categories/kemeja.png']);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Kemeja Katun Oxford',
            'barcode' => 'KMJ-OXF-001',
            'sku' => 'KMJ-OXF-001',
            'buy_price' => 70000,
            'sell_price' => 150000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variant = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Kemeja Katun Oxford - Putih M',
            'barcode' => 'KMJ-WHT-M',
            'sku' => 'KMJ-WHT-M',
            'buy_price' => 70000,
            'sell_price' => 150000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 5,
        ]);

        // 1. Create page products listing excludes master product
        $response = $this->actingAs($user)->get(route('purchase-orders.create'));
        $response->assertOk();
        $productsList = $response->viewData('page')['props']['products'];
        $productIds = collect($productsList)->pluck('id');
        $this->assertTrue($productIds->contains($variant->id));
        $this->assertFalse($productIds->contains($master->id));

        // 2. Submitting PO with master product must be rejected by validation
        $responseStore = $this->actingAs($user)->post(route('purchase-orders.store'), [
            'supplier_id' => $supplier->id,
            'warehouse_id' => $wh->id,
            'items' => [
                [
                    'product_id' => $master->id,
                    'qty_ordered' => 10,
                    'unit_price' => 70000,
                ],
            ],
        ]);
        $responseStore->assertSessionHasErrors('items');
    }

    public function test_master_product_with_variants_is_excluded_from_stock_transfers(): void
    {
        $role = Role::create(['name' => 'warehouse-staff']);
        $role->givePermissionTo([
            Permission::create(['name' => 'stock-transfers-access']),
            Permission::create(['name' => 'stock-transfers-create']),
        ]);
        $user = User::factory()->create();
        $user->assignRole('warehouse-staff');

        $whSource = Warehouse::create(['code' => 'SRC', 'name' => 'Gudang Asal', 'type' => 'warehouse', 'is_active' => true]);
        $whDest = Warehouse::create(['code' => 'DST', 'name' => 'Gudang Tujuan', 'type' => 'branch', 'is_active' => true]);
        $category = Category::create(['name' => 'Jaket', 'image' => 'categories/jaket.png']);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Jaket Bomber Taslan',
            'barcode' => 'JKT-BMB-001',
            'sku' => 'JKT-BMB-001',
            'buy_price' => 90000,
            'sell_price' => 200000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variant = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Jaket Bomber Taslan - Hitam XL',
            'barcode' => 'JKT-BLK-XL',
            'sku' => 'JKT-BLK-XL',
            'buy_price' => 90000,
            'sell_price' => 200000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 10,
        ]);

        // 1. Create page products listing excludes master product
        $response = $this->actingAs($user)->get(route('stock-transfers.create'));
        $response->assertOk();
        $productsList = $response->viewData('page')['props']['products'];
        $productIds = collect($productsList)->pluck('id');
        $this->assertTrue($productIds->contains($variant->id));
        $this->assertFalse($productIds->contains($master->id));

        // 2. Submitting Transfer with master product must fail validation
        $responseStore = $this->actingAs($user)->post(route('stock-transfers.store'), [
            'source_warehouse_id' => $whSource->id,
            'destination_warehouse_id' => $whDest->id,
            'items' => [
                [
                    'product_id' => $master->id,
                    'qty' => 2,
                ],
            ],
        ]);
        $responseStore->assertSessionHasErrors('items');
    }

    public function test_master_product_with_variants_is_excluded_from_supplier_returns(): void
    {
        $role = Role::create(['name' => 'returns-staff']);
        $role->givePermissionTo([
            Permission::create(['name' => 'supplier-returns-access']),
            Permission::create(['name' => 'supplier-returns-create']),
        ]);
        $user = User::factory()->create();
        $user->assignRole('returns-staff');

        $wh = Warehouse::create(['code' => 'RET-WH', 'name' => 'Gudang Retur', 'type' => 'warehouse', 'is_active' => true]);
        $supplier = Supplier::create(['name' => 'Vendor Garmen', 'phone' => '08987654321']);
        $category = Category::create(['name' => 'Aksesoris', 'image' => 'categories/acc.png']);

        $master = Product::create([
            'category_id' => $category->id,
            'title' => 'Topi Snapback Cotton',
            'barcode' => 'HAT-SNP-001',
            'sku' => 'HAT-SNP-001',
            'buy_price' => 30000,
            'sell_price' => 65000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variant = Product::create([
            'parent_id' => $master->id,
            'category_id' => $category->id,
            'title' => 'Topi Snapback Cotton - Merah Allsize',
            'barcode' => 'HAT-RED-ALL',
            'sku' => 'HAT-RED-ALL',
            'buy_price' => 30000,
            'sell_price' => 65000,
            'tax_rate' => 0,
            'has_variants' => false,
            'stock' => 5,
        ]);

        // 1. Create page products listing excludes master product
        $response = $this->actingAs($user)->get(route('supplier-returns.create'));
        $response->assertOk();
        $productsList = $response->viewData('page')['props']['products'];
        $productIds = collect($productsList)->pluck('id');
        $this->assertTrue($productIds->contains($variant->id));
        $this->assertFalse($productIds->contains($master->id));

        // 2. Submitting Supplier Return with master product must fail validation
        $responseStore = $this->actingAs($user)->post(route('supplier-returns.store'), [
            'supplier_id' => $supplier->id,
            'warehouse_id' => $wh->id,
            'items' => [
                [
                    'product_id' => $master->id,
                    'qty_returned' => 1,
                ],
            ],
        ]);
        $responseStore->assertSessionHasErrors('items');
    }

    public function test_can_set_and_update_variant_display_type_per_product(): void
    {
        $role = Role::firstOrCreate(['name' => 'admin']);
        $p1 = Permission::firstOrCreate(['name' => 'products-access']);
        $p2 = Permission::firstOrCreate(['name' => 'products-create']);
        $p3 = Permission::firstOrCreate(['name' => 'products-edit']);
        $role->syncPermissions([$p1, $p2, $p3]);
        $user = User::factory()->create();
        $user->assignRole($role);

        $category = Category::create([
            'name' => 'Dress Muslim',
            'image' => 'categories/dress.png',
        ]);

        $wh = Warehouse::create([
            'code' => 'WH-TEST',
            'name' => 'Warehouse Test',
            'type' => 'warehouse',
            'is_active' => true,
        ]);

        // 1. Store product with variant_display_type = 'image' (Foto Baju Saja)
        $storeResponse = $this->actingAs($user)->post(route('products.store'), [
            'category_id' => $category->id,
            'title' => 'Gamis Silk Premium',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'has_variants' => true,
            'variant_display_type' => 'image',
            'variants' => [
                [
                    'color_name' => 'Maroon',
                    'color_hex' => '#800000',
                    'size' => 'M',
                    'barcode' => 'GMS-MRN-M',
                    'sku' => 'GMS-MRN-M',
                    'stock' => 10,
                ],
                [
                    'color_name' => 'Sage Green',
                    'color_hex' => '#9CAF88',
                    'size' => 'M',
                    'barcode' => 'GMS-SGE-M',
                    'sku' => 'GMS-SGE-M',
                    'stock' => 10,
                ],
            ],
        ]);

        $storeResponse->assertRedirect(route('products.index'));

        $product = Product::where('title', 'Gamis Silk Premium')->first();
        $this->assertNotNull($product);
        $this->assertEquals('image', $product->variant_display_type);

        // 2. Check public catalog formatting contains variant_display_type
        $publicDetailResponse = $this->get(route('catalog.product.show', $product->id));
        $publicDetailResponse->assertOk();
        $pageProps = $publicDetailResponse->viewData('page')['props'];
        $this->assertEquals('image', $pageProps['product']['variant_display_type']);

        // 3. Update product with variant_display_type = 'color' (Lingkaran Warna Saja)
        $updateResponse = $this->actingAs($user)->put(route('products.update', $product->id), [
            'category_id' => $category->id,
            'title' => 'Gamis Silk Premium Updated',
            'buy_price' => 100000,
            'sell_price' => 250000,
            'has_variants' => true,
            'variant_display_type' => 'color',
            'variants' => [
                [
                    'id' => $product->variants[0]->id,
                    'color_name' => 'Maroon',
                    'color_hex' => '#800000',
                    'size' => 'M',
                    'barcode' => 'GMS-MRN-M',
                    'sku' => 'GMS-MRN-M',
                    'stock' => 10,
                ],
            ],
        ]);

        $updateResponse->assertRedirect(route('products.index'));
        $product->refresh();
        $this->assertEquals('color', $product->variant_display_type);
    }
}
