<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\ProductReference;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCatalogLookupTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class, UserSeeder::class]);
        $this->admin = User::role('super-admin')->first() ?? User::where('email', 'arya@gmail.com')->first() ?? User::first();
        $this->admin->markEmailAsVerified();
        $this->actingAs($this->admin);
    }

    public function test_can_lookup_product_by_barcode_from_reference_catalog(): void
    {
        Category::create([
            'image' => 'cat.png',
            'name' => 'Minuman',
            'description' => 'Kategori Minuman',
        ]);

        ProductReference::create([
            'barcode' => '8992780020038',
            'sku' => '20008',
            'name' => '2TANG AIR MINERAL 600ML',
            'category_name' => 'MINUMAN',
            'unit' => 'BOTOL',
            'buy_price' => 2000,
            'sell_price' => 3500,
            'supplier_name' => '2TANG OFFICIAL',
        ]);

        $response = $this->getJson(route('products.lookup-catalog', ['barcode' => '8992780020038']));

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'data' => [
                    'barcode' => '8992780020038',
                    'sku' => '20008',
                    'title' => '2TANG AIR MINERAL 600ML',
                    'unit' => 'BOTOL',
                    'buy_price' => 2000,
                    'sell_price' => 3500,
                ],
            ]);

        $data = $response->json('data');
        $this->assertNotNull($data['category_id']);
    }

    public function test_lookup_returns_404_when_barcode_not_in_reference_catalog(): void
    {
        $response = $this->getJson(route('products.lookup-catalog', ['barcode' => 'NONEXISTENT999']));

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_can_search_product_references_by_keyword(): void
    {
        ProductReference::create([
            'barcode' => '8999909007147',
            'sku' => '20021',
            'name' => '234 KERETEK',
            'category_name' => 'ROKOK',
            'unit' => 'BUNGKUS',
            'buy_price' => 11000,
            'sell_price' => 12000,
        ]);

        ProductReference::create([
            'barcode' => '8992753282401',
            'sku' => '10001',
            'name' => '123 BENDERA COKLAT 300G',
            'category_name' => 'SUSU',
            'unit' => 'PCs',
            'buy_price' => 19000,
            'sell_price' => 20000,
        ]);

        $response = $this->getJson(route('products.lookup-catalog', ['search' => 'BENDERA']));

        $response->assertOk()
            ->assertJson([
                'success' => true,
            ]);

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('123 BENDERA COKLAT 300G', $data[0]['title']);
    }
}
