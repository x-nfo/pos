<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\CashierShiftService;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            ->has('products', 1)
            ->where('products.0.title', 'Gamis Silk Premium')
            ->where('products.0.has_variants', true)
            ->where('products.0.stock', 8)
            ->has('products.0.variants', 1)
            ->where('products.0.variants.0.barcode', 'GMS-SLK-SGE-L')
            ->where('products.0.variants.0.variant_attributes.warna', 'Sage Green')
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
}
