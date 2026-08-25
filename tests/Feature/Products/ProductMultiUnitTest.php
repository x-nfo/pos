<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProductMultiUnitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Permission::findOrCreate('products-access', 'web');
        Permission::findOrCreate('products-create', 'web');
        Permission::findOrCreate('products-edit', 'web');
    }

    public function test_can_create_product_with_multi_units(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $user->givePermissionTo(['products-access', 'products-create']);

        $category = Category::create([
            'name' => 'Makanan',
            'description' => 'Kategori Makanan',
            'image' => 'makanan.jpg',
        ]);

        $pcs = Unit::where('code', 'PCS')->first();
        $box = Unit::where('code', 'BOX')->first();

        $payload = [
            'image' => UploadedFile::fake()->image('snack.jpg'),
            'barcode' => '899888777111',
            'sku' => 'SNK-001',
            'title' => 'Chiki Ball Keju',
            'description' => 'Makanan ringan renyah rasa keju',
            'category_id' => $category->id,
            'buy_price' => 2000,
            'sell_price' => 3000,
            'stock' => 100,
            'units' => [
                [
                    'unit_id' => $pcs->id,
                    'is_base' => true,
                    'conversion_factor' => 1,
                    'buy_price' => 2000,
                    'sell_price' => 3000,
                    'barcode' => '899888777111',
                ],
                [
                    'unit_id' => $box->id,
                    'is_base' => false,
                    'conversion_factor' => 20,
                    'buy_price' => 38000,
                    'sell_price' => 55000,
                    'barcode' => '899888777112',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('products.store'), $payload);
        $response->assertRedirect(route('products.index'));

        $product = Product::where('barcode', '899888777111')->first();
        $this->assertNotNull($product);
        $this->assertEquals(2, $product->units()->count());

        $this->assertDatabaseHas('product_units', [
            'product_id' => $product->id,
            'unit_id' => $pcs->id,
            'is_base' => 1,
            'conversion_factor' => 1.0000,
            'sell_price' => 3000,
        ]);

        $this->assertDatabaseHas('product_units', [
            'product_id' => $product->id,
            'unit_id' => $box->id,
            'is_base' => 0,
            'conversion_factor' => 20.0000,
            'sell_price' => 55000,
            'barcode' => '899888777112',
        ]);
    }

    public function test_can_create_product_without_multi_units(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $user->givePermissionTo(['products-access', 'products-create']);

        $category = Category::create([
            'name' => 'Minuman',
            'description' => 'Kategori Minuman',
            'image' => 'minuman.jpg',
        ]);

        $payload = [
            'image' => UploadedFile::fake()->image('air.jpg'),
            'barcode' => '899000111222',
            'sku' => 'AIR-001',
            'title' => 'Air Mineral 600ml',
            'description' => 'Air mineral higienis',
            'category_id' => $category->id,
            'buy_price' => 1500,
            'sell_price' => 3000,
            'stock' => 50,
            'units' => [],
        ];

        $response = $this->actingAs($user)->post(route('products.store'), $payload);
        $response->assertRedirect(route('products.index'));

        $product = Product::where('barcode', '899000111222')->first();
        $this->assertNotNull($product);
        $this->assertEquals(0, $product->units()->count());
    }

    public function test_can_update_product_units(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['products-access', 'products-edit']);

        $category = Category::create([
            'name' => 'Sembako',
            'description' => 'Kategori Sembako',
            'image' => 'sembako.jpg',
        ]);

        $product = Product::create([
            'image' => 'beras.jpg',
            'barcode' => '899333444555',
            'sku' => 'BRS-001',
            'title' => 'Beras Pandan Wangi 1kg',
            'description' => 'Beras premium',
            'category_id' => $category->id,
            'buy_price' => 12000,
            'sell_price' => 15000,
            'stock' => 50,
        ]);

        $kg = Unit::where('code', 'KG')->first();
        $karton = Unit::where('code', 'KARTON')->first();

        $payload = [
            'barcode' => '899333444555',
            'sku' => 'BRS-001',
            'title' => 'Beras Pandan Wangi 1kg (Updated)',
            'description' => 'Beras premium wangi',
            'category_id' => $category->id,
            'buy_price' => 12000,
            'sell_price' => 15000,
            'units' => [
                [
                    'unit_id' => $kg->id,
                    'is_base' => true,
                    'conversion_factor' => 1,
                    'buy_price' => 12000,
                    'sell_price' => 15000,
                ],
                [
                    'unit_id' => $karton->id,
                    'is_base' => false,
                    'conversion_factor' => 25,
                    'buy_price' => 290000,
                    'sell_price' => 360000,
                ],
            ],
        ];

        $response = $this->actingAs($user)->put(route('products.update', $product->id), $payload);
        $response->assertRedirect(route('products.index'));

        $this->assertEquals(2, $product->fresh()->units()->count());
        $this->assertDatabaseHas('product_units', [
            'product_id' => $product->id,
            'unit_id' => $karton->id,
            'conversion_factor' => 25.0000,
            'sell_price' => 360000,
        ]);
    }

    public function test_base_unit_price_always_syncs_with_product_price(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['products-access', 'products-edit']);

        $category = Category::create([
            'name' => 'Bumbu',
            'description' => 'Kategori Bumbu',
            'image' => 'bumbu.jpg',
        ]);

        $pcs = Unit::where('code', 'PCS')->first();

        $product = Product::create([
            'image' => 'kecap.jpg',
            'barcode' => '899111222333',
            'sku' => 'KCP-001',
            'title' => 'Kecap Asin 133ml',
            'description' => 'Kecap asin botol',
            'category_id' => $category->id,
            'buy_price' => 2000,
            'sell_price' => 2800,
            'stock' => 50,
        ]);

        // Attach initial unit with 2800
        $product->units()->attach($pcs->id, [
            'is_base' => true,
            'conversion_factor' => 1,
            'buy_price' => 2000,
            'sell_price' => 2800,
        ]);

        // Update product price to 7500, even if request payload accidentally has old unit sell_price 2800
        $payload = [
            'barcode' => '899111222333',
            'sku' => 'KCP-001',
            'title' => 'Kecap Asin 133ml',
            'description' => 'Kecap asin botol',
            'category_id' => $category->id,
            'buy_price' => 5000,
            'sell_price' => 7500,
            'units' => [
                [
                    'unit_id' => $pcs->id,
                    'is_base' => true,
                    'conversion_factor' => 1,
                    'buy_price' => 2000, // old value in request
                    'sell_price' => 2800, // old value in request
                ],
            ],
        ];

        $response = $this->actingAs($user)->put(route('products.update', $product->id), $payload);
        $response->assertRedirect(route('products.index'));

        // Base unit price in pivot must be synced with the main product prices (5000 and 7500)
        $this->assertDatabaseHas('product_units', [
            'product_id' => $product->id,
            'unit_id' => $pcs->id,
            'is_base' => 1,
            'buy_price' => 5000,
            'sell_price' => 7500,
        ]);
    }
}
