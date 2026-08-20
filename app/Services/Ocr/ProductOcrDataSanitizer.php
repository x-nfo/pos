<?php

namespace App\Services\Ocr;

use Illuminate\Support\Str;

class ProductOcrDataSanitizer
{
    /**
     * Bersihkan dan standarisasi string harga menjadi integer (dalam Rupiah).
     */
    public static function sanitizePrice(mixed $value, int $default = 0): int
    {
        if ($value === null || $value === '') {
            return $default;
        }

        if (is_numeric($value)) {
            return max(0, (int) round((float) $value));
        }

        // Hapus simbol mata uang Rp, spasi, titik ribuan, atau koma desimal
        $clean = preg_replace('/[^0-9.,]/', '', (string) $value);

        if (empty($clean)) {
            return $default;
        }

        // Tangani format Indonesia "15.000,00" atau internasional "15,000.00"
        if (str_contains($clean, '.') && str_contains($clean, ',')) {
            if (strrpos($clean, ',') > strrpos($clean, '.')) {
                // Indonesia: titik = ribuan, koma = desimal
                $clean = str_replace('.', '', $clean);
                $clean = str_replace(',', '.', $clean);
            } else {
                // US: koma = ribuan, titik = desimal
                $clean = str_replace(',', '', $clean);
            }
        } elseif (str_contains($clean, '.')) {
            // Jika ada titik, biasanya pemisah ribuan di IDR jika ada 3 digit di belakangnya (mis: 25.000)
            $parts = explode('.', $clean);
            if (count($parts) > 1 && strlen(end($parts)) === 3) {
                $clean = str_replace('.', '', $clean);
            }
        } elseif (str_contains($clean, ',')) {
            $parts = explode(',', $clean);
            if (count($parts) > 1 && strlen(end($parts)) === 3) {
                $clean = str_replace(',', '', $clean);
            } else {
                $clean = str_replace(',', '.', $clean);
            }
        }

        $numeric = (float) $clean;

        return max(0, (int) round($numeric));
    }

    /**
     * Bersihkan barcode (hanya angka dan karakter valid).
     */
    public static function sanitizeBarcode(?string $barcode): ?string
    {
        if ($barcode === null) {
            return null;
        }

        $clean = trim($barcode);
        // Hapus strip dan spasi pemisah barcode
        $clean = str_replace(['-', ' '], '', $clean);
        $clean = preg_replace('/[^A-Za-z0-9]/', '', $clean);

        return $clean !== '' ? $clean : null;
    }


    /**
     * Standarisasi nama satuan produk ke format umum (PCS, DUS, PACK, BTL, dsb).
     */
    public static function sanitizeUnit(?string $unit): string
    {
        if (! $unit) {
            return 'PCS';
        }

        $u = strtoupper(trim($unit));

        $map = [
            'PC' => 'PCS',
            'PIECE' => 'PCS',
            'PIECES' => 'PCS',
            'BUAH' => 'PCS',
            'BH' => 'PCS',
            'BIJI' => 'PCS',
            'BTL' => 'BOTOL',
            'BOTTLE' => 'BOTOL',
            'PK' => 'PACK',
            'PAK' => 'PACK',
            'BKS' => 'BUNGKUS',
            'RCG' => 'RENCENG',
            'RC' => 'RENCENG',
            'STRIP' => 'STRIP',
            'TAB' => 'TABLET',
            'BOX' => 'DUS',
            'KARTON' => 'DUS',
            'CTN' => 'DUS',
            'KG' => 'KG',
            'KILOGRAM' => 'KG',
            'GR' => 'GRAM',
            'G' => 'GRAM',
            'ML' => 'ML',
            'LTR' => 'LITER',
            'L' => 'LITER',
        ];

        return $map[$u] ?? (strlen($u) <= 10 ? $u : 'PCS');
    }

    /**
     * Format nama produk agar rapi (Title Case / Capitalize).
     */
    public static function sanitizeTitle(?string $title): string
    {
        if (! $title) {
            return 'Produk Tanpa Nama';
        }

        $clean = preg_replace('/\s+/', ' ', trim($title));

        // Jika huruf besar semua (ALL CAPS khas nota kasir), ubah ke Title Case
        if (mb_strtoupper($clean) === $clean && strlen($clean) > 4) {
            $clean = Str::title(mb_strtolower($clean));
        }

        return $clean;
    }

    /**
     * Sanitasi data single product hasil ekstraksi OCR.
     */
    public static function sanitizeSingleProduct(array $data, float $defaultMargin = 20.0): array
    {
        $title = self::sanitizeTitle($data['title'] ?? null);
        $barcode = self::sanitizeBarcode($data['barcode'] ?? null);
        $sku = self::sanitizeBarcode($data['sku'] ?? null);
        $buyPrice = self::sanitizePrice($data['buy_price'] ?? 0);
        $sellPrice = self::sanitizePrice($data['sell_price'] ?? 0);

        if ($sellPrice <= 0 && $buyPrice > 0) {
            $sellPrice = (int) round($buyPrice * (1 + ($defaultMargin / 100)));
        }

        return [
            'title' => $title,
            'barcode' => $barcode,
            'sku' => $sku,
            'buy_price' => $buyPrice,
            'sell_price' => $sellPrice,
            'unit' => self::sanitizeUnit($data['unit'] ?? 'PCS'),
            'category_suggestion' => trim((string) ($data['category_suggestion'] ?? 'Makanan & Minuman')),
            'description' => trim((string) ($data['description'] ?? $title)),
            'confidence' => (float) ($data['confidence'] ?? 0.9),
        ];
    }

    /**
     * Sanitasi data faktur/invoice multi-item hasil ekstraksi OCR.
     */
    public static function sanitizeInvoice(array $data, float $defaultMargin = 20.0): array
    {
        $rawItems = is_array($data['items'] ?? null) ? $data['items'] : [];
        $sanitizedItems = [];

        foreach ($rawItems as $item) {
            $title = self::sanitizeTitle($item['title'] ?? '');
            if (empty($title) || $title === 'Produk Tanpa Nama') {
                continue;
            }

            $qty = max(1, (int) round((float) ($item['qty'] ?? 1)));
            $buyPrice = self::sanitizePrice($item['buy_price'] ?? 0);
            $subtotal = self::sanitizePrice($item['subtotal'] ?? ($qty * $buyPrice));

            $sellPrice = isset($item['sell_price']) && $item['sell_price'] > 0
                ? self::sanitizePrice($item['sell_price'])
                : (int) round($buyPrice * (1 + ($defaultMargin / 100)));

            $sanitizedItems[] = [
                'title' => $title,
                'barcode' => self::sanitizeBarcode($item['barcode'] ?? null),
                'sku' => self::sanitizeBarcode($item['sku'] ?? null),
                'qty' => $qty,
                'buy_price' => $buyPrice,
                'sell_price' => $sellPrice,
                'unit' => self::sanitizeUnit($item['unit'] ?? 'PCS'),
                'subtotal' => $subtotal,
                'category_suggestion' => trim((string) ($item['category_suggestion'] ?? 'Makanan & Minuman')),
            ];
        }

        return [
            'invoice_number' => ! empty($data['invoice_number']) ? trim((string) $data['invoice_number']) : null,
            'supplier_name' => ! empty($data['supplier_name']) ? trim((string) $data['supplier_name']) : null,
            'invoice_date' => ! empty($data['invoice_date']) ? trim((string) $data['invoice_date']) : now()->toDateString(),
            'total_amount' => self::sanitizePrice($data['total_amount'] ?? 0),
            'items' => $sanitizedItems,
        ];
    }
}

