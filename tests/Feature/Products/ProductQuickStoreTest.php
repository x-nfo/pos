<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProductQuickStoreTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Permission::findOrCreate('products-create', 'web');
        Permission::findOrCreate('transactions-access', 'web');
    }

    public function test_authorized_user_can_quick_store_product(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('transactions-access');

        $category = Category::create([
            'name' => 'Minuman',
            'description' => 'Kategori Minuman',
            'image' => 'category.jpg',
        ]);

        $payload = [
            'barcode' => '8991234567890',
            'title' => 'Teh Botol Sosro 350ml',
            'category_id' => $category->id,
            'buy_price' => 3000,
            'sell_price' => 4500,
            'stock' => 24,
            'description' => 'Teh Botol Sosro kemasan 350ml',
        ];

        $response = $this->actingAs($user)->postJson(route('products.quick-store'), $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'barcode' => '8991234567890',
                    'title' => 'Teh Botol Sosro 350ml',
                    'sell_price' => 4500,
                    'stock' => 24,
                ],
            ]);

        $this->assertDatabaseHas('products', [
            'barcode' => '8991234567890',
            'title' => 'Teh Botol Sosro 350ml',
            'sell_price' => 4500,
        ]);

        $product = Product::where('barcode', '8991234567890')->first();
        $this->assertNotNull($product);
        $this->assertSame(24, (int) $product->stock);
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'mutation_type' => 'in',
            'qty' => 24,
        ]);
    }

    public function test_quick_store_validates_unique_barcode(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('transactions-access');

        $category = Category::create([
            'name' => 'Makanan',
            'description' => 'Kategori Makanan',
            'image' => 'category.jpg',
        ]);

        Product::create([
            'barcode' => '8999999999999',
            'sku' => 'PRD-EXISTING',
            'title' => 'Produk Lama',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 10,
            'image' => '',
            'description' => 'Lama',
        ]);

        $payload = [
            'barcode' => '8999999999999',
            'title' => 'Produk Baru Duplikat',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 5,
        ];

        $response = $this->actingAs($user)->postJson(route('products.quick-store'), $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['barcode']);
    }
}
