<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicProductDetailTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouse;

    protected Warehouse $branch2;

    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->warehouse = Warehouse::create([
            'name' => 'Butik Pusat',
            'code' => 'PST01',
            'is_active' => true,
            'is_default' => true,
        ]);

        $this->branch2 = Warehouse::create([
            'name' => 'Cabang Selatan',
            'code' => 'SLT01',
            'is_active' => true,
            'is_default' => false,
        ]);

        $this->category = Category::create([
            'name' => 'Gamis Syari',
            'description' => 'Koleksi busana syari premium',
        ]);
    }

    public function test_product_detail_page_can_be_rendered_by_id(): void
    {
        $product = Product::create([
            'title' => 'Abaya Silk Karima',
            'barcode' => 'ABY-001',
            'sku' => 'SKU-ABY-001',
            'category_id' => $this->category->id,
            'buy_price' => 150000,
            'sell_price' => 285000,
            'tax_rate' => 0,
            'description' => 'Abaya sutra elegan dengan jahitan rapi.',
        ]);

        $this->warehouse->products()->attach($product->id, ['stock' => 12]);

        $response = $this->get(route('catalog.product.show', $product->id));

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/ProductDetail')
            ->has('product', fn (Assert $prod) => $prod
                ->where('id', $product->id)
                ->where('title', 'Abaya Silk Karima')
                ->where('barcode', 'ABY-001')
                ->where('sell_price', 285000)
                ->where('stock', 12)
                ->where('category_name', 'Gamis Syari')
                ->etc()
            )
            ->has('store')
            ->has('branches')
            ->has('activeBranch')
            ->has('relatedProducts')
            ->has('bankAccounts')
            ->where('initialVariantId', null)
        );
    }

    public function test_product_detail_page_can_be_resolved_by_barcode(): void
    {
        $product = Product::create([
            'title' => 'Khimar French Khadijah',
            'barcode' => '8991234567890',
            'sku' => 'KHM-FR-01',
            'category_id' => $this->category->id,
            'buy_price' => 80000,
            'sell_price' => 145000,
            'tax_rate' => 0,
        ]);

        $this->warehouse->products()->attach($product->id, ['stock' => 8]);

        $response = $this->get(route('catalog.product.show', '8991234567890'));

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/ProductDetail')
            ->where('product.id', $product->id)
            ->where('product.barcode', '8991234567890')
        );
    }

    public function test_product_detail_page_can_be_resolved_by_sku(): void
    {
        $product = Product::create([
            'title' => 'Cadana Niqab Yaman',
            'barcode' => 'NQB-YM-01',
            'sku' => 'SKU-NIQAB-01',
            'category_id' => $this->category->id,
            'buy_price' => 35000,
            'sell_price' => 65000,
            'tax_rate' => 0,
        ]);

        $this->warehouse->products()->attach($product->id, ['stock' => 20]);

        $response = $this->get(route('catalog.product.show', 'SKU-NIQAB-01'));

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/ProductDetail')
            ->where('product.id', $product->id)
            ->where('product.sku', 'SKU-NIQAB-01')
        );
    }

    public function test_product_detail_returns_404_when_product_not_found(): void
    {
        $response = $this->get(route('catalog.product.show', 'nonexistent-code-999'));

        $response->assertStatus(404);
    }

    public function test_product_detail_resolves_parent_when_variant_id_is_requested(): void
    {
        $parent = Product::create([
            'title' => 'Gamis Aisyah Premium',
            'barcode' => 'GMS-ASY-PARENT',
            'sku' => 'SKU-ASY-PARENT',
            'category_id' => $this->category->id,
            'buy_price' => 200000,
            'sell_price' => 350000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $variant1 = Product::create([
            'parent_id' => $parent->id,
            'title' => 'Gamis Aisyah Premium - Maroon / M',
            'barcode' => 'GMS-ASY-MRN-M',
            'sku' => 'SKU-ASY-MRN-M',
            'category_id' => $this->category->id,
            'buy_price' => 200000,
            'sell_price' => 350000,
            'tax_rate' => 0,
            'variant_attributes' => ['Warna' => 'Maroon', 'Ukuran' => 'M'],
        ]);

        $variant2 = Product::create([
            'parent_id' => $parent->id,
            'title' => 'Gamis Aisyah Premium - Hitam / L',
            'barcode' => 'GMS-ASY-HTM-L',
            'sku' => 'SKU-ASY-HTM-L',
            'category_id' => $this->category->id,
            'buy_price' => 200000,
            'sell_price' => 350000,
            'tax_rate' => 0,
            'variant_attributes' => ['Warna' => 'Hitam', 'Ukuran' => 'L'],
        ]);

        $this->warehouse->products()->attach($variant1->id, ['stock' => 5]);
        $this->warehouse->products()->attach($variant2->id, ['stock' => 3]);

        // Access via variant1 ID
        $response = $this->get(route('catalog.product.show', $variant1->id));

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/ProductDetail')
            ->where('product.id', $parent->id)
            ->where('initialVariantId', $variant1->id)
            ->has('product.variants', 2)
        );
    }

    public function test_product_detail_respects_branch_query_param_for_stock_isolation(): void
    {
        $product = Product::create([
            'title' => 'Pashmina Ceruty Babydoll',
            'barcode' => 'PSH-CRT-01',
            'sku' => 'SKU-PSH-01',
            'category_id' => $this->category->id,
            'buy_price' => 25000,
            'sell_price' => 55000,
            'tax_rate' => 0,
        ]);

        $this->warehouse->products()->attach($product->id, ['stock' => 15]);
        $this->branch2->products()->attach($product->id, ['stock' => 4]);

        // Default warehouse
        $respPusat = $this->get(route('catalog.product.show', $product->id));
        $respPusat->assertStatus(200);
        $respPusat->assertInertia(fn (Assert $page) => $page
            ->where('activeBranch.code', 'PST01')
            ->where('product.stock', 15)
        );

        // Explicit branch2 (SLT01)
        $respSelatan = $this->get(route('catalog.product.show', [
            'product' => $product->id,
            'cabang' => 'SLT01',
        ]));
        $respSelatan->assertStatus(200);
        $respSelatan->assertInertia(fn (Assert $page) => $page
            ->where('activeBranch.code', 'SLT01')
            ->where('product.stock', 4)
        );
    }

    public function test_product_detail_displays_related_products_in_same_category(): void
    {
        $category = Category::create([
            'name' => 'Mukena Traveling',
        ]);

        $prodA = Product::create([
            'title' => 'Mukena Silk Mini Pouch A',
            'barcode' => 'MKN-A',
            'sku' => 'SKU-MKN-A',
            'category_id' => $category->id,
            'buy_price' => 100000,
            'sell_price' => 180000,
            'tax_rate' => 0,
        ]);

        $prodB = Product::create([
            'title' => 'Mukena Parasut Korea B',
            'barcode' => 'MKN-B',
            'sku' => 'SKU-MKN-B',
            'category_id' => $category->id,
            'buy_price' => 70000,
            'sell_price' => 125000,
            'tax_rate' => 0,
        ]);

        $this->warehouse->products()->attach($prodA->id, ['stock' => 5]);
        $this->warehouse->products()->attach($prodB->id, ['stock' => 7]);

        $response = $this->get(route('catalog.product.show', $prodA->id));

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/ProductDetail')
            ->where('product.id', $prodA->id)
            ->has('relatedProducts', 1)
            ->where('relatedProducts.0.id', $prodB->id)
        );
    }
}
