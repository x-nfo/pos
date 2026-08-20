<?php

namespace App\Services\Ocr\Contracts;

use Illuminate\Http\UploadedFile;

interface OcrVisionDriverInterface
{
    /**
     * Ekstraksi single product dari kemasan/label produk.
     *
     * @param  UploadedFile|string  $image  File upload atau path/base64 string
     * @param  array  $options  Pilihan ekstraksi tambahan (misal: prompt context, default category list)
     * @return array [
     *     'title' => ?string,
     *     'barcode' => ?string,
     *     'sku' => ?string,
     *     'buy_price' => ?float,
     *     'sell_price' => ?float,
     *     'unit' => ?string,
     *     'category_suggestion' => ?string,
     *     'description' => ?string,
     *     'raw_text' => ?string,
     *     'confidence' => ?float
     * ]
     */
    public function extractSingleProduct(UploadedFile|string $image, array $options = []): array;

    /**
     * Ekstraksi nota/faktur pembelian (tabel multi-item).
     *
     * @param  UploadedFile|string  $image  File upload atau path/base64 string
     * @param  array  $options  Pilihan ekstraksi tambahan
     * @return array [
     *     'invoice_number' => ?string,
     *     'supplier_name' => ?string,
     *     'invoice_date' => ?string,
     *     'total_amount' => ?float,
     *     'items' => array<int, array{
     *         title: string,
     *         barcode: ?string,
     *         sku: ?string,
     *         qty: int|float,
     *         buy_price: float,
     *         sell_price: ?float,
     *         unit: ?string,
     *         subtotal: ?float,
     *         category_suggestion: ?string
     *     }>
     * ]
     */
    public function extractInvoiceItems(UploadedFile|string $image, array $options = []): array;

    /**
     * Uji coba koneksi / kredensial AI Vision.
     */
    public function testConnection(): array;
}
