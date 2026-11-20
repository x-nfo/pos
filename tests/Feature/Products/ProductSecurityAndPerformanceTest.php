<?php

namespace Tests\Feature\Products;

use App\Exports\ProductsExport;
use App\Models\Category;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProductSecurityAndPerformanceTest extends TestCase
{
    use RefreshDatabase;

    private User $adminUser;

    private Category $category;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'products-create', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'products-access', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'products-edit', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'products-delete', 'guard_name' => 'web']);
        $adminRole->givePermissionTo(['products-create', 'products-access', 'products-edit', 'products-delete']);

        $this->adminUser = User::factory()->create();
        $this->adminUser->assignRole($adminRole);

        $this->category = Category::create([
            'name' => 'Kategori Pakaian',
            'image' => '',
            'description' => 'Kategori untuk testing',
        ]);

        $this->warehouse = Warehouse::firstOrCreate(
            ['code' => 'MAIN-WH'],
            ['name' => 'Gudang Utama', 'is_active' => true]
        );
    }

    private function createProductWithStock(string $title, string $barcode, int $stock = 15): Product
    {
        $product = Product::create([
            'title' => $title,
            'barcode' => $barcode,
            'sku' => 'SKU-'.$barcode,
            'image' => '',
            'description' => 'Deskripsi '.$title,
            'category_id' => $this->category->id,
            'buy_price' => 50000,
            'sell_price' => 75000,
            'tax_rate' => 0,
            'min_stock' => 5,
            'max_stock' => 100,
            'has_variants' => false,
        ]);

        ProductWarehouse::updateOrCreate(
            ['product_id' => $product->id, 'warehouse_id' => $this->warehouse->id],
            ['stock' => $stock]
        );

        return $product;
    }

    public function test_product_export_avoids_n_plus_one_queries(): void
    {
        // Create 15 products
        for ($i = 1; $i <= 15; $i++) {
            $this->createProductWithStock("Produk Export {$i}", "EXP-{$i}", 10 + $i);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        $export = new ProductsExport;
        $collection = $export->collection();

        foreach ($collection as $product) {
            $row = $export->map($product);
            $this->assertNotEmpty($row);
            $this->assertGreaterThan(0, $row[7]); // Stock column
        }

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // 1. SELECT * FROM products
        // 2. SELECT * FROM categories WHERE id IN (...)
        // 3. SELECT * FROM warehouses INNER JOIN product_warehouse WHERE product_id IN (...)
        // 4. SELECT * FROM products (variants) WHERE parent_id IN (...)
        // 5. Variants warehouses
        // Total should be <= 6 queries regardless of having 15 products (NOT 15+ individual warehouse queries)
        $this->assertLessThanOrEqual(6, count($queries), 'ProductsExport should not trigger N+1 queries when mapping stock');
    }

    public function test_api_products_index_avoids_n_plus_one_queries(): void
    {
        Sanctum::actingAs($this->adminUser);

        // Create 20 products
        for ($i = 1; $i <= 20; $i++) {
            $this->createProductWithStock("API Produk {$i}", "API-{$i}", 20);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->getJson('/api/v1/products?per_page=15');
        $response->assertOk();

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Product queries must be batch loaded: count, select products, categories in (...), warehouses in (...), variants in (...)
        // Filter out framework cache / rate limit queries to check pure database model query efficiency
        $productQueries = array_filter($queries, function ($q) {
            $sql = strtolower($q['query']);

            return str_contains($sql, 'products') || str_contains($sql, 'product_warehouse') || str_contains($sql, 'categories');
        });

        // Exactly 5 bounded queries for 15 products (NOT 15+ N+1 queries)
        $this->assertLessThanOrEqual(6, count($productQueries), 'GET /api/v1/products must not trigger N+1 queries on stock calculation');
    }

    public function test_product_resource_hides_buy_price_for_cashier_token(): void
    {
        $cashierRole = Role::firstOrCreate(['name' => 'kasir', 'guard_name' => 'web']);
        $cashier = User::factory()->create();
        $cashier->assignRole($cashierRole);

        $product = $this->createProductWithStock('Produk Kasir', 'KSR-001', 10);

        // Kasir token with transactions-access ability but no profits-access or products-edit
        Sanctum::actingAs($cashier, ['transactions-access', 'pos-access']);

        $response = $this->getJson('/api/v1/products');
        $response->assertOk();

        $data = $response->json('data.0');
        $this->assertEquals('Produk Kasir', $data['title']);
        $this->assertEquals(75000, $data['sell_price']);
        $this->assertArrayNotHasKey('buy_price', $data, 'Cashier token should not be exposed to internal buy_price (HPP)');
    }

    public function test_store_product_rejects_spoofed_file_with_invalid_mime_type(): void
    {
        $this->actingAs($this->adminUser);

        // Disguised file with .jpg extension but text/plain mime type
        $fakeFile = UploadedFile::fake()->create('malicious.jpg', 10, 'text/plain');

        $response = $this->post(route('products.store'), [
            'title' => 'Produk Exploit',
            'barcode' => 'EXP-999',
            'category_id' => $this->category->id,
            'buy_price' => 10000,
            'sell_price' => 20000,
            'stock' => 5,
            'gallery_images' => [$fakeFile],
        ]);

        $response->assertSessionHasErrors('gallery_images.0');
    }

    public function test_public_product_detail_batches_related_products_pricing(): void
    {
        $mainProduct = $this->createProductWithStock('Produk Utama', 'MAIN-001', 10);

        // 4 related products in same category
        for ($i = 1; $i <= 4; $i++) {
            $this->createProductWithStock("Produk Terkait {$i}", "REL-{$i}", 10);
        }

        // Create active pricing rule
        PricingRule::create([
            'name' => 'Diskon Spesial',
            'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
            'discount_type' => 'percentage',
            'discount_value' => 10,
            'priority' => 10,
            'is_active' => true,
            'customer_scope' => 'all',
            'product_scope' => 'all',
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->get(route('catalog.product.show', $mainProduct->id));
        $response->assertOk();

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Count pricing_rules queries. Previously, formatProduct called previewProducts on each of the 4 related products,
        // firing PricingRule query 4+ times. Now it must be queried in a batch (<= 2 times for main + related).
        $pricingRuleQueries = array_filter($queries, function ($q) {
            return str_contains(strtolower($q['query']), 'pricing_rules');
        });

        $this->assertLessThanOrEqual(2, count($pricingRuleQueries), 'Public catalog show should batch pricing calculations for related products');
    }
}
