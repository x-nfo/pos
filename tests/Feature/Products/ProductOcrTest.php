<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Setting;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ProductOcrTest extends TestCase
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

        // Pastikan setting OCR memakai mock driver untuk testing
        Setting::set('ocr_provider', 'mock');
        Setting::set('ocr_enabled', '1');
    }

    public function test_user_can_scan_single_product_via_ocr(): void
    {
        Category::create([
            'image' => '',
            'name' => 'Makanan & Minuman',
            'description' => 'Kategori Makanan',
        ]);

        $file = UploadedFile::fake()->image('snack.jpg');

        $response = $this->postJson(route('products.ocr.scan-single'), [
            'image' => $file,
        ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Indomie Goreng Spesial 85g',
                    'barcode' => '089686010924',
                    'buy_price' => 3000,
                    'sell_price' => 3500,
                ],
            ]);
    }

    public function test_scan_single_product_matches_existing_product_in_database(): void
    {
        $cat = Category::create([
            'image' => '',
            'name' => 'Makanan & Minuman',
            'description' => 'Kategori Makanan',
        ]);

        $product = \App\Models\Product::create([
            'image' => 'default.png',
            'barcode' => '89686010924', // Tanpa leading zero
            'title' => 'Indomie Goreng Spesial',
            'description' => 'Indomie Goreng Rasa Spesial',
            'category_id' => $cat->id,
            'buy_price' => 2800,
            'sell_price' => 3500,
            'stock' => 50,
            'tax_rate' => 0,
        ]);



        $file = UploadedFile::fake()->image('snack.jpg');

        $response = $this->postJson(route('products.ocr.scan-single'), [
            'image' => $file,
        ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $product->id,
                    'is_existing' => true,
                    'existing_product' => [
                        'id' => $product->id,
                        'title' => 'Indomie Goreng Spesial',
                    ],
                ],
            ]);
    }

    public function test_user_can_scan_invoice_via_ocr(): void

    {
        Category::create([
            'image' => '',
            'name' => 'Makanan & Minuman',
            'description' => 'Kategori Makanan',
        ]);

        $file = UploadedFile::fake()->image('invoice.jpg');

        $response = $this->postJson(route('products.ocr.scan-invoice'), [
            'image' => $file,
        ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'invoice_number' => 'INV-2026-001',
            ])
            ->assertJsonStructure([
                'items' => [
                    '*' => ['title', 'barcode', 'qty', 'buy_price', 'sell_price', 'subtotal'],
                ],
            ]);
    }

    public function test_user_can_batch_store_ocr_products(): void
    {
        $category = Category::create([
            'image' => '',
            'name' => 'Minuman',
            'description' => 'Kategori Minuman',
        ]);

        Warehouse::create([
            'code' => 'WH-TEST',
            'name' => 'Gudang Tes',
            'is_active' => true,
        ]);

        $items = [
            [
                'title' => 'Teh Botol Sosro 350ml',
                'barcode' => '8991234567890',
                'sku' => 'PRD-SOSRO-350',
                'category_id' => $category->id,
                'buy_price' => 3000,
                'sell_price' => 4500,
                'qty' => 24,
                'unit' => 'BOTOL',
                'action' => 'create_new',
            ],
        ];

        $response = $this->postJson(route('products.ocr.batch-store'), [
            'items' => $items,
        ]);

        $response->assertCreated()
            ->assertJson([
                'success' => true,
                'created_count' => 1,
            ]);

        $this->assertDatabaseHas('products', [
            'barcode' => '8991234567890',
            'title' => 'Teh Botol Sosro 350ml',
            'stock' => 24,
        ]);
    }

    public function test_user_can_test_ai_connection(): void
    {
        $response = $this->postJson(route('products.ocr.test-connection'));

        $response->assertOk()
            ->assertJson([
                'success' => true,
            ]);

        // Uji dengan parameter dinamis mock
        $dynamicResponse = $this->postJson(route('products.ocr.test-connection'), [
            'provider' => 'mock',
        ]);
        $dynamicResponse->assertOk()
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_user_can_access_and_update_ocr_settings(): void
    {
        $response = $this->get(route('settings.ocr'));
        $response->assertOk();

        $updateResponse = $this->post(route('settings.ocr.update'), [
            'ocr_enabled' => true,
            'ocr_provider' => 'openai',
            'ocr_gemini_api_key' => 'AIzaSyDummyKeyForTest12345',
            'ocr_gemini_model' => 'gemini-flash-lite-latest',
            'ocr_openai_api_key' => 'sk-proj-dummy-openai-key',
            'ocr_openai_model' => 'gpt-4o-mini',
            'ocr_openrouter_api_key' => 'sk-or-v1-dummy-openrouter-key',
            'ocr_openrouter_model' => 'openai/gpt-4o-mini',
            'ocr_openrouter_base_url' => 'https://openrouter.ai/api/v1/chat/completions',
            'ocr_default_margin_percentage' => 25.0,
            'ocr_auto_match_catalog' => true,
        ]);

        $updateResponse->assertRedirect();

        $this->assertEquals('openai', Setting::get('ocr_provider'));
        $this->assertEquals('sk-proj-dummy-openai-key', Setting::get('ocr_openai_api_key'));
        $this->assertEquals('gpt-4o-mini', Setting::get('ocr_openai_model'));
        $this->assertEquals('sk-or-v1-dummy-openrouter-key', Setting::get('ocr_openrouter_api_key'));
        $this->assertEquals('25', Setting::get('ocr_default_margin_percentage'));
    }
}

