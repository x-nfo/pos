<?php

namespace Tests\Unit\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Warehouse;
use App\Services\AuditLogService;
use App\Services\Ocr\Drivers\MockVisionDriver;
use App\Services\Ocr\OcrService;
use App\Services\Ocr\ProductOcrDataSanitizer;
use App\Services\ProductCatalogService;
use App\Services\StockMutationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class OcrServiceTest extends TestCase
{
    use RefreshDatabase;

    protected OcrService $ocrService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ocrService = new OcrService(
            app(ProductCatalogService::class),
            app(StockMutationService::class),
            app(AuditLogService::class)
        );

        $this->ocrService->setDriver(new MockVisionDriver);
    }

    public function test_sanitizer_cleans_prices_correctly(): void
    {
        $this->assertEquals(15000, ProductOcrDataSanitizer::sanitizePrice('Rp 15.000'));
        $this->assertEquals(250000, ProductOcrDataSanitizer::sanitizePrice('Rp 250,000.00'));
        $this->assertEquals(12500, ProductOcrDataSanitizer::sanitizePrice('12.500,00'));
        $this->assertEquals(0, ProductOcrDataSanitizer::sanitizePrice('gratis'));
        $this->assertEquals(5000, ProductOcrDataSanitizer::sanitizePrice(5000));
    }

    public function test_sanitizer_cleans_units_and_barcodes(): void
    {
        $this->assertEquals('PCS', ProductOcrDataSanitizer::sanitizeUnit('pc'));
        $this->assertEquals('PCS', ProductOcrDataSanitizer::sanitizeUnit('PIECES'));
        $this->assertEquals('BOTOL', ProductOcrDataSanitizer::sanitizeUnit('btl'));
        $this->assertEquals('RENCENG', ProductOcrDataSanitizer::sanitizeUnit('rcg'));
        $this->assertEquals('DUS', ProductOcrDataSanitizer::sanitizeUnit('box'));

        $this->assertEquals('8992780020038', ProductOcrDataSanitizer::sanitizeBarcode(' 899-2780020038 '));
        $this->assertNull(ProductOcrDataSanitizer::sanitizeBarcode('   '));
    }

    public function test_can_scan_single_product_with_mock_driver(): void
    {
        Category::create([
            'image' => '',
            'name' => 'Makanan & Minuman',
            'description' => 'Kategori Makanan',
        ]);

        $dummyFile = UploadedFile::fake()->image('product.jpg');

        $result = $this->ocrService->scanSingleProduct($dummyFile);

        $this->assertTrue($result['success']);
        $this->assertEquals('Indomie Goreng Spesial 85g', $result['data']['title']);
        $this->assertEquals('089686010924', $result['data']['barcode']);
        $this->assertEquals(3000, $result['data']['buy_price']);
        $this->assertEquals(3500, $result['data']['sell_price']);
        $this->assertNotNull($result['data']['category_id']);
    }

    public function test_can_scan_invoice_with_mock_driver(): void
    {
        Category::create([
            'image' => '',
            'name' => 'Makanan & Minuman',
            'description' => 'Kategori Makanan',
        ]);

        $dummyFile = UploadedFile::fake()->image('invoice.jpg');

        $result = $this->ocrService->scanInvoice($dummyFile);

        $this->assertTrue($result['success']);
        $this->assertEquals('INV-2026-001', $result['invoice_number']);
        $this->assertEquals('PT Sumber Alfaria Grosir', $result['supplier_name']);
        $this->assertCount(2, $result['items']);
        $this->assertEquals('Indomie Goreng Spesial 85g', $result['items'][0]['title']);
    }

    public function test_can_batch_store_invoice_products(): void
    {
        $category = Category::create([
            'image' => '',
            'name' => 'Sembako',
            'description' => 'Kategori Sembako',
        ]);

        Warehouse::create([
            'code' => 'WH-01',
            'name' => 'Gudang Utama',
            'is_active' => true,
        ]);

        $items = [
            [
                'title' => 'Minyak Goreng Sania 2L',
                'barcode' => '8991001002003',
                'sku' => 'PRD-SN-2L',
                'category_id' => $category->id,
                'buy_price' => 32000,
                'sell_price' => 36000,
                'qty' => 12,
                'unit' => 'POUCH',
                'action' => 'create_new',
            ],
            [
                'title' => 'Beras Pandan Wangi 5kg',
                'barcode' => '8991001005009',
                'sku' => 'PRD-BRS-5KG',
                'category_id' => $category->id,
                'buy_price' => 75000,
                'sell_price' => 85000,
                'qty' => 5,
                'unit' => 'KARUNG',
                'action' => 'create_new',
            ],
        ];

        $response = $this->ocrService->batchStoreInvoiceProducts($items);

        $this->assertTrue($response['success']);
        $this->assertEquals(2, $response['created_count']);

        $this->assertDatabaseHas('products', [
            'barcode' => '8991001002003',
            'title' => 'Minyak Goreng Sania 2L',
            'stock' => 12,
        ]);

        $this->assertDatabaseHas('products', [
            'barcode' => '8991001005009',
            'title' => 'Beras Pandan Wangi 5kg',
            'stock' => 5,
        ]);
    }
}
