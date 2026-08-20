<?php

namespace App\Services\Ocr\Drivers;

use App\Services\Ocr\Contracts\OcrVisionDriverInterface;
use Illuminate\Http\UploadedFile;

class MockVisionDriver implements OcrVisionDriverInterface
{
    private array $customSingleProductResponse = [];

    private array $customInvoiceResponse = [];

    public function setMockSingleProduct(array $response): self
    {
        $this->customSingleProductResponse = $response;

        return $this;
    }

    public function setMockInvoice(array $response): self
    {
        $this->customInvoiceResponse = $response;

        return $this;
    }

    public function extractSingleProduct(UploadedFile|string $image, array $options = []): array
    {
        if (! empty($this->customSingleProductResponse)) {
            return $this->customSingleProductResponse;
        }

        return [
            'title' => 'Indomie Goreng Spesial 85g',
            'barcode' => '089686010924',
            'sku' => 'PRD-INDOMIE-001',
            'buy_price' => 3000,
            'sell_price' => 3500,
            'unit' => 'PCS',
            'category_suggestion' => 'Makanan & Minuman',
            'description' => 'Mi Instan Rasa Goreng Spesial 85 gram',
            'raw_text' => 'Mock single product OCR output',
            'confidence' => 0.98,
        ];
    }

    public function extractInvoiceItems(UploadedFile|string $image, array $options = []): array
    {
        if (! empty($this->customInvoiceResponse)) {
            return $this->customInvoiceResponse;
        }

        return [
            'invoice_number' => 'INV-2026-001',
            'supplier_name' => 'PT Sumber Alfaria Grosir',
            'invoice_date' => now()->toDateString(),
            'total_amount' => 150000,
            'items' => [
                [
                    'title' => 'Indomie Goreng Spesial 85g',
                    'barcode' => '089686010924',
                    'sku' => 'INDOM-01',
                    'qty' => 40,
                    'buy_price' => 2800,
                    'sell_price' => 3500,
                    'unit' => 'PCS',
                    'subtotal' => 112000,
                    'category_suggestion' => 'Makanan & Minuman',
                ],
                [
                    'title' => 'Kopi Kapal Api Special Mix 10x24g',
                    'barcode' => '8992780020038',
                    'sku' => 'KPL-01',
                    'qty' => 10,
                    'buy_price' => 12000,
                    'sell_price' => 15000,
                    'unit' => 'RENCENG',
                    'subtotal' => 120000,
                    'category_suggestion' => 'Makanan & Minuman',
                ],
            ],
        ];
    }

    public function testConnection(): array
    {
        return [
            'success' => true,
            'message' => 'Koneksi Mock AI Vision berhasil (Mode Pengujian).',
            'model' => 'mock-vision',
        ];
    }
}
