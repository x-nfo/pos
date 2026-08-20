<?php

namespace App\Services;

use App\Models\ProductReference;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ProductCatalogService
{
    /**
     * Cari produk di katalog referensi berdasarkan barcode.
     */
    public function lookupByBarcode(string $barcode): ?array
    {
        $cleanBarcode = trim($barcode);
        if ($cleanBarcode === '') {
            return null;
        }

        // Cari exact match atau fallback trim leading zeroes jika ada
        $reference = ProductReference::query()
            ->where('barcode', $cleanBarcode)
            ->first();

        if (! $reference) {
            // Coba cari jika barcode diawali 0 atau tanpa 0
            $altBarcode = str_starts_with($cleanBarcode, '0')
                ? ltrim($cleanBarcode, '0')
                : '0'.$cleanBarcode;

            $reference = ProductReference::query()
                ->where('barcode', $altBarcode)
                ->first();
        }

        if (! $reference) {
            return null;
        }

        return [
            'barcode' => $reference->barcode,
            'sku' => $reference->sku,
            'title' => $reference->name,
            'category_name' => $reference->category_name,
            'unit' => $reference->unit ?? 'PCS',
            'buy_price' => (float) $reference->buy_price,
            'sell_price' => (float) $reference->sell_price,
            'supplier_name' => $reference->supplier_name,
        ];
    }

    /**
     * Cari produk di katalog referensi berdasarkan keyword nama atau barcode.
     */
    public function search(string $query, int $limit = 10): array
    {
        $keyword = trim($query);
        if ($keyword === '') {
            return [];
        }

        return ProductReference::query()
            ->where(function ($q) use ($keyword) {
                $q->where('barcode', 'like', "%{$keyword}%")
                    ->orWhere('sku', 'like', "%{$keyword}%")
                    ->orWhere('name', 'like', "%{$keyword}%");
            })
            ->limit($limit)
            ->get()
            ->map(function (ProductReference $ref) {
                return [
                    'barcode' => $ref->barcode,
                    'sku' => $ref->sku,
                    'title' => $ref->name,
                    'category_name' => $ref->category_name,
                    'unit' => $ref->unit ?? 'PCS',
                    'buy_price' => (float) $ref->buy_price,
                    'sell_price' => (float) $ref->sell_price,
                    'supplier_name' => $ref->supplier_name,
                ];
            })
            ->toArray();
    }

    /**
     * Sinkronisasi data katalog dari Google Sheet CSV.
     *
     * @param  string|null  $url
     * @param  callable|null  $progressCallback  function(int $processed, int $total)
     * @return array
     */
    public function syncFromGoogleSheet(?string $url = null, ?callable $progressCallback = null): array
    {
        $csvUrl = $url ?: config('services.catalog.google_sheet_csv_url');
        if (! $csvUrl) {
            throw new \InvalidArgumentException('Google Sheet CSV URL belum dikonfigurasi.');
        }

        Log::info("Memulai sinkronisasi katalog produk dari Google Sheet: {$csvUrl}");

        $tempFile = tempnam(sys_get_temp_dir(), 'pos_catalog_');
        $fp = fopen($tempFile, 'w+');

        // Unduh CSV via stream/cURL untuk hemat memory
        $ch = curl_init($csvUrl);
        curl_setopt($ch, CURLOPT_FILE, $fp);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 180);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        fclose($fp);

        if ($httpCode !== 200) {
            @unlink($tempFile);
            throw new \RuntimeException("Gagal mengunduh file Google Sheet (HTTP Code: {$httpCode}). Pastikan Google Sheet sudah disetel 'Anyone with the link'.");
        }

        $handle = fopen($tempFile, 'r');
        if (! $handle) {
            @unlink($tempFile);
            throw new \RuntimeException('Gagal membaca file CSV sementara.');
        }

        $header = fgetcsv($handle);
        if (! $header) {
            fclose($handle);
            @unlink($tempFile);
            throw new \RuntimeException('File CSV kosong atau format tidak sesuai.');
        }

        // Petakan indeks kolom
        $headerMap = array_flip(array_map('trim', $header));

        $barcodeIdx = $headerMap['KODE_BARCODE'] ?? null;
        $skuIdx = $headerMap['KODE_BARANG'] ?? null;
        $nameIdx = $headerMap['NAMA'] ?? null;
        $catIdx = $headerMap['KATEGORI'] ?? null;
        $unitIdx = $headerMap['SATUAN_1'] ?? null;
        $hppIdx = $headerMap['HPP'] ?? null;
        $sellPriceIdx = $headerMap['HARGA_TOKO_1'] ?? null;
        $supplierIdx = $headerMap['SUPPLIER'] ?? null;

        if ($nameIdx === null || $barcodeIdx === null) {
            fclose($handle);
            @unlink($tempFile);
            throw new \RuntimeException('Kolom KODE_BARCODE atau NAMA tidak ditemukan di header CSV.');
        }

        $batch = [];
        $batchSize = 500;
        $totalProcessed = 0;
        $now = now()->toDateTimeString();

        // Hapus data referensi lama sebelum import ulang baru
        ProductReference::truncate();

        DB::beginTransaction();

        try {
            while (($row = fgetcsv($handle)) !== false) {
                $barcode = trim($row[$barcodeIdx] ?? '');
                $name = trim($row[$nameIdx] ?? '');

                if ($barcode === '' && $name === '') {
                    continue;
                }

                $sku = $skuIdx !== null ? trim($row[$skuIdx] ?? '') : null;
                $categoryName = $catIdx !== null ? trim($row[$catIdx] ?? '') : null;
                $unit = $unitIdx !== null ? trim($row[$unitIdx] ?? '') : 'PCs';
                $buyPrice = $hppIdx !== null ? (float) str_replace(',', '', $row[$hppIdx] ?? '0') : 0;
                $sellPrice = $sellPriceIdx !== null ? (float) str_replace(',', '', $row[$sellPriceIdx] ?? '0') : 0;
                $supplier = $supplierIdx !== null ? trim($row[$supplierIdx] ?? '') : null;

                $batch[] = [
                    'barcode' => $barcode ?: ($sku ?: 'NO-BARCODE-'.$totalProcessed),
                    'sku' => $sku ?: null,
                    'name' => $name,
                    'category_name' => $categoryName ?: null,
                    'unit' => $unit ?: 'PCs',
                    'buy_price' => max(0, $buyPrice),
                    'sell_price' => max(0, $sellPrice),
                    'supplier_name' => $supplier ?: null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $totalProcessed++;

                if (count($batch) >= $batchSize) {
                    ProductReference::insert($batch);
                    $batch = [];

                    if ($progressCallback) {
                        $progressCallback($totalProcessed);
                    }
                }
            }

            if (! empty($batch)) {
                ProductReference::insert($batch);
                if ($progressCallback) {
                    $progressCallback($totalProcessed);
                }
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            fclose($handle);
            @unlink($tempFile);
            throw $e;
        }

        fclose($handle);
        @unlink($tempFile);

        Log::info("Sinkronisasi katalog produk selesai. Total data: {$totalProcessed}");

        return [
            'success' => true,
            'total_imported' => $totalProcessed,
        ];
    }
}
