<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProductStockLimitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Permission::findOrCreate('products-index', 'web');
        Permission::findOrCreate('products-create', 'web');
        Permission::findOrCreate('products-edit', 'web');
        Permission::findOrCreate('products-delete', 'web');
        Permission::findOrCreate('transactions-access', 'web');
    }

    public function test_can_create_product_with_min_and_max_stock(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['products-index', 'products-create']);

        $category = Category::create([
            'name' => 'Snack',
            'description' => 'Makanan ringan',
            'image' => 'snack.jpg',
        ]);

        $payload = [
            'barcode' => '899999900001',
            'sku' => 'SNK-001',
            'title' => 'Keripik Singkong',
            'description' => 'Keripik singkong gurih',
            'category_id' => $category->id,
            'buy_price' => 5000,
            'sell_price' => 8000,
            'stock' => 50,
            'min_stock' => 10,
            'max_stock' => 100,
        ];

        $response = $this->actingAs($user)->post(route('products.store'), $payload);

        $response->assertRedirect(route('products.index'));

        $this->assertDatabaseHas('products', [
            'barcode' => '899999900001',
            'title' => 'Keripik Singkong',
            'min_stock' => 10,
            'max_stock' => 100,
        ]);

        $product = Product::where('barcode', '899999900001')->first();
        $this->assertSame(10, $product->min_stock);
        $this->assertSame(100, $product->max_stock);
    }

    public function test_can_update_product_min_and_max_stock(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['products-index', 'products-edit']);

        $category = Category::create([
            'name' => 'Snack',
            'description' => 'Makanan ringan',
            'image' => 'snack.jpg',
        ]);

        $product = Product::create([
            'image' => 'default.png',
            'barcode' => '899999900002',
            'sku' => 'SNK-002',
            'title' => 'Biskuit Coklat',
            'description' => 'Biskuit rasa coklat',
            'category_id' => $category->id,
            'buy_price' => 4000,
            'sell_price' => 6000,
            'stock' => 20,
            'min_stock' => 5,
            'max_stock' => 50,
            'tax_rate' => 0,
        ]);

        $updatePayload = [
            'barcode' => '899999900002',
            'sku' => 'SNK-002',
            'title' => 'Biskuit Coklat Super',
            'description' => 'Biskuit rasa coklat nikmat',
            'category_id' => $category->id,
            'buy_price' => 4500,
            'sell_price' => 7000,
            'min_stock' => 15,
            'max_stock' => 80,
        ];

        $response = $this->actingAs($user)->put(route('products.update', $product->id), $updatePayload);

        $response->assertRedirect(route('products.index'));

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'title' => 'Biskuit Coklat Super',
            'min_stock' => 15,
            'max_stock' => 80,
        ]);
    }

    public function test_product_low_stock_and_suggested_order_qty_methods(): void
    {
        $category = Category::create([
            'name' => 'Sembako',
            'description' => 'Sembako',
            'image' => 'sembako.jpg',
        ]);

        $product = Product::create([
            'image' => 'default.png',
            'barcode' => '899999900003',
            'sku' => 'SBK-001',
            'title' => 'Beras Pandan Wangi 5kg',
            'description' => 'Beras premium',
            'category_id' => $category->id,
            'buy_price' => 65000,
            'sell_price' => 75000,
            'stock' => 5,
            'min_stock' => 10,
            'max_stock' => 50,
            'tax_rate' => 0,
        ]);

        $this->assertTrue($product->isLowStock());
        $this->assertSame(45, $product->suggestedOrderQty()); // 50 - 5 = 45

        // If stock is above min_stock
        $product->update(['stock' => 20]);
        $this->assertFalse($product->isLowStock());
        $this->assertSame(30, $product->suggestedOrderQty()); // 50 - 20 = 30
    }
}
