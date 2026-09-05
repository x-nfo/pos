<?php

namespace Tests\Feature\Notifications;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class StockNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Permission::findOrCreate('products-access', 'web');
    }

    public function test_low_stock_product_appears_in_shared_inertia_notifications(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('products-access');

        $category = Category::create([
            'name' => 'Snack',
            'description' => 'Makanan ringan',
            'image' => 'snack.jpg',
        ]);

        $product = Product::create([
            'image' => 'product.jpg',
            'barcode' => '899999900010',
            'sku' => 'SNK-010',
            'title' => 'Keripik Tempe',
            'description' => 'Keripik tempe',
            'category_id' => $category->id,
            'buy_price' => 5000,
            'sell_price' => 8000,
            'stock' => 3,
            'min_stock' => 5,
            'tax_rate' => 0,
        ]);

        $warehouse = Warehouse::factory()->create(['name' => 'Toko Utama']);
        $product->warehouses()->attach($warehouse->id, ['stock' => 3]);

        $response = $this->actingAs($user)->get(route('products.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->has('lowStockNotifications', 1)
            ->where('lowStockNotifications.0.id', $product->id)
            ->where('lowStockNotifications.0.title', 'Keripik Tempe')
            ->where('lowStockNotifications.0.stock', 3)
            ->where('lowStockNotifications.0.min_stock', 5)
            ->where('lowStockNotifications.0.warehouse', 'Toko Utama')
        );
    }

    public function test_can_mark_single_low_stock_notification_as_read(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('products-access');

        $category = Category::create([
            'name' => 'Snack',
            'description' => 'Makanan ringan',
            'image' => 'snack.jpg',
        ]);

        $product = Product::create([
            'image' => 'product.jpg',
            'barcode' => '899999900011',
            'sku' => 'SNK-011',
            'title' => 'Keripik Pisang',
            'description' => 'Keripik pisang',
            'category_id' => $category->id,
            'buy_price' => 5000,
            'sell_price' => 8000,
            'stock' => 2,
            'min_stock' => 5,
            'tax_rate' => 0,
        ]);

        $warehouse = Warehouse::factory()->create(['name' => 'Toko Utama']);
        $product->warehouses()->attach($warehouse->id, ['stock' => 2]);

        $response = $this->actingAs($user)->post(route('notifications.stock.read'), [
            'product_id' => $product->id,
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('product_notification_reads', [
            'user_id' => $user->id,
            'product_id' => $product->id,
        ]);

        // After marked as read, it should no longer appear
        $indexResponse = $this->actingAs($user)->get(route('products.index'));
        $indexResponse->assertInertia(fn ($page) => $page
            ->has('lowStockNotifications', 0)
        );
    }

    public function test_can_mark_all_low_stock_notifications_as_read(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('products-access');

        $category = Category::create([
            'name' => 'Snack',
            'description' => 'Makanan ringan',
            'image' => 'snack.jpg',
        ]);

        $product1 = Product::create([
            'image' => 'p1.jpg',
            'barcode' => '899999900012',
            'sku' => 'SNK-012',
            'title' => 'Produk A',
            'description' => 'Produk A',
            'category_id' => $category->id,
            'buy_price' => 5000,
            'sell_price' => 8000,
            'stock' => 2,
            'min_stock' => 5,
            'tax_rate' => 0,
        ]);

        $product2 = Product::create([
            'image' => 'p2.jpg',
            'barcode' => '899999900013',
            'sku' => 'SNK-013',
            'title' => 'Produk B',
            'description' => 'Produk B',
            'category_id' => $category->id,
            'buy_price' => 5000,
            'sell_price' => 8000,
            'stock' => 0,
            'min_stock' => 10,
            'tax_rate' => 0,
        ]);

        $warehouse = Warehouse::factory()->create(['name' => 'Toko Utama']);
        $product1->warehouses()->attach($warehouse->id, ['stock' => 2]);
        $product2->warehouses()->attach($warehouse->id, ['stock' => 0]);

        $response = $this->actingAs($user)->post(route('notifications.stock.readAll'));

        $response->assertRedirect();

        $this->assertDatabaseHas('product_notification_reads', [
            'user_id' => $user->id,
            'product_id' => $product1->id,
        ]);
        $this->assertDatabaseHas('product_notification_reads', [
            'user_id' => $user->id,
            'product_id' => $product2->id,
        ]);

        $indexResponse = $this->actingAs($user)->get(route('products.index'));
        $indexResponse->assertInertia(fn ($page) => $page
            ->has('lowStockNotifications', 0)
        );
    }

    public function test_zero_stock_product_appears_even_if_min_stock_is_zero(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('products-access');

        $category = Category::create([
            'name' => 'Snack',
            'description' => 'Makanan ringan',
            'image' => 'snack.jpg',
        ]);

        $product = Product::create([
            'image' => 'p3.jpg',
            'barcode' => '899999900014',
            'sku' => 'SNK-014',
            'title' => 'Produk Habis Total',
            'description' => 'Produk habis',
            'category_id' => $category->id,
            'buy_price' => 5000,
            'sell_price' => 8000,
            'stock' => 0,
            'min_stock' => 0,
            'tax_rate' => 0,
        ]);

        $warehouse = Warehouse::factory()->create(['name' => 'Toko Utama']);
        $product->warehouses()->attach($warehouse->id, ['stock' => 0]);

        $response = $this->actingAs($user)->get(route('products.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->has('lowStockNotifications', 1)
            ->where('lowStockNotifications.0.id', $product->id)
            ->where('lowStockNotifications.0.title', 'Produk Habis Total')
            ->where('lowStockNotifications.0.stock', 0)
            ->where('lowStockNotifications.0.warehouse', 'Toko Utama')
        );
    }
}
