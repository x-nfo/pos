<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductCreationBestPracticeTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class, UserSeeder::class]);
        $this->admin = User::role('super-admin')->first() ?? User::where('email', 'admin@mail.com')->first() ?? User::first();
        $this->admin->markEmailAsVerified();
        $this->actingAs($this->admin);
    }

    public function test_product_creation_validates_required_and_typed_fields(): void
    {
        // 1. Missing required fields
        $response = $this->post(route('products.store'), []);
        $response->assertSessionHasErrors(['barcode', 'title', 'category_id', 'buy_price', 'sell_price', 'stock']);

        // 2. Non-existent category_id
        $response = $this->post(route('products.store'), [
            'barcode' => '899999999991',
            'title' => 'Sample Item',
            'category_id' => 999999,
            'buy_price' => 1000,
            'sell_price' => 1500,
            'stock' => 10,
        ]);
        $response->assertSessionHasErrors(['category_id']);

        // 3. Negative prices
        $category = Category::create(['name' => 'Snack', 'description' => 'Snack']);
        $response = $this->post(route('products.store'), [
            'barcode' => '899999999992',
            'title' => 'Sample Item 2',
            'category_id' => $category->id,
            'buy_price' => -500,
            'sell_price' => -100,
            'stock' => 10,
        ]);
        $response->assertSessionHasErrors(['buy_price', 'sell_price']);

        // 4. Invalid file upload (e.g. text file instead of image)
        Storage::fake('public');
        $fakeFile = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');
        $response = $this->post(route('products.store'), [
            'barcode' => '899999999993',
            'title' => 'Sample Item 3',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 1500,
            'stock' => 10,
            'image' => $fakeFile,
        ]);
        $response->assertSessionHasErrors(['image']);
    }

    public function test_product_creation_syncs_initial_stock_to_default_warehouse(): void
    {
        Storage::fake('public');

        $warehouse = Warehouse::create([
            'code' => 'WH-01',
            'name' => 'Gudang Utama',
            'address' => 'Jakarta',
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Minuman',
            'description' => 'Kategori Minuman',
        ]);

        $payload = [
            'barcode' => '899123456789',
            'sku' => 'MNM-001',
            'title' => 'Kopi Susu Gula Aren',
            'description' => 'Minuman segar kekinian',
            'category_id' => $category->id,
            'buy_price' => 8000,
            'sell_price' => 15000,
            'stock' => 50,
            'min_stock' => 10,
            'max_stock' => 100,
        ];

        $response = $this->post(route('products.store'), $payload);
        $response->assertRedirect(route('products.index'));

        $product = Product::where('barcode', '899123456789')->first();
        $this->assertNotNull($product);
        $this->assertEquals(50, $product->stock);

        // Verify synced into product_warehouse pivot
        $this->assertDatabaseHas('product_warehouse', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 50,
        ]);

        // Verify stock mutation created
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'product_create',
            'mutation_type' => 'in',
            'qty' => 50,
            'stock_before' => 0,
            'stock_after' => 50,
        ]);
    }

    public function test_product_update_validates_and_ignores_own_unique_fields(): void
    {
        $category = Category::create(['name' => 'Elektronik', 'description' => 'Elektronik']);

        $product = Product::create([
            'image' => 'mouse.jpg',
            'barcode' => '899555666777',
            'sku' => 'ELK-001',
            'title' => 'Mouse Wireless',
            'description' => 'Deskripsi mouse',
            'category_id' => $category->id,
            'buy_price' => 50000,
            'sell_price' => 75000,
            'stock' => 20,
        ]);

        $payload = [
            'barcode' => '899555666777', // Same barcode
            'sku' => 'ELK-001', // Same sku
            'title' => 'Mouse Wireless Ergonomic Pro',
            'category_id' => $category->id,
            'buy_price' => 55000,
            'sell_price' => 85000,
            'min_stock' => 5,
            'max_stock' => 50,
        ];

        $response = $this->put(route('products.update', $product->id), $payload);
        $response->assertRedirect(route('products.index'));

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'title' => 'Mouse Wireless Ergonomic Pro',
            'buy_price' => 55000,
            'sell_price' => 85000,
        ]);
    }
}
