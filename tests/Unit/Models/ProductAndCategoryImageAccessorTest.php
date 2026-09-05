<?php

namespace Tests\Unit\Models;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductAndCategoryImageAccessorTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_image_accessor_returns_null_when_empty_or_null(): void
    {
        $category = Category::create([
            'name' => 'Snack',
            'description' => 'Kategori Snack',
            'image' => '',
        ]);

        $productWithEmptyImage = Product::create([
            'barcode' => '111111111111',
            'sku' => 'PRD-EMPTY-IMG',
            'title' => 'Product Empty Image',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 10,
            'image' => '',
            'description' => 'Test',
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $productWithEmptyImage->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 10]);

        $this->assertNull($productWithEmptyImage->image);
    }

    public function test_product_image_accessor_resolves_filename_and_full_url(): void
    {
        $category = Category::create([
            'name' => 'Beverage',
            'description' => 'Kategori Minuman',
            'image' => 'cat-beverage.jpg',
        ]);

        $productWithFilename = Product::create([
            'barcode' => '222222222222',
            'sku' => 'PRD-FILENAME-IMG',
            'title' => 'Product Filename Image',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 10,
            'image' => 'sample-product.jpg',
            'description' => 'Test',
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $productWithFilename->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 10]);

        $this->assertStringContainsString('/storage/products/sample-product.jpg', $productWithFilename->image);

        $productWithFullUrl = Product::create([
            'barcode' => '333333333333',
            'sku' => 'PRD-FULLURL-IMG',
            'title' => 'Product Full URL Image',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 10,
            'image' => 'https://images.unsplash.com/photo-example.jpg',
            'description' => 'Test',
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $productWithFullUrl->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 10]);

        $this->assertSame('https://images.unsplash.com/photo-example.jpg', $productWithFullUrl->image);
    }

    public function test_category_image_accessor_returns_null_when_empty_and_resolves_filename(): void
    {
        $categoryEmpty = Category::create([
            'name' => 'Empty Cat',
            'description' => 'No image',
            'image' => '',
        ]);

        $this->assertNull($categoryEmpty->image);

        $categoryWithImage = Category::create([
            'name' => 'Image Cat',
            'description' => 'Has image',
            'image' => 'cat.png',
        ]);

        $this->assertStringContainsString('/storage/category/cat.png', $categoryWithImage->image);
    }
}
