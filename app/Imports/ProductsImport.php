<?php

namespace App\Imports;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductWarehouse;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Row;

class ProductsImport implements OnEachRow, WithChunkReading, WithHeadingRow, WithValidation
{
    private int $rowCount = 0;

    public function __construct(private int $warehouseId) {}

    public function prepareForValidation(array $data, int $index): array
    {
        if (isset($data['barcode'])) {
            $data['barcode'] = trim((string) $data['barcode']);
        }
        if (isset($data['sku'])) {
            $sku = trim((string) $data['sku']);
            $data['sku'] = $sku !== '' ? $sku : ($data['barcode'] ?? null);
        } else {
            $data['sku'] = $data['barcode'] ?? null;
        }

        return $data;
    }

    public function onRow(Row $row)
    {
        $data = $row->toArray();

        $barcode = trim((string) ($data['barcode'] ?? ''));
        if ($barcode === '') {
            return;
        }

        $this->rowCount++;

        $categoryName = trim((string) ($data['kategori'] ?? '')) ?: 'Umum';
        $category = Category::firstOrCreate(
            ['name' => $categoryName],
            ['description' => '', 'image' => 'default.png']
        );

        $sku = trim((string) ($data['sku'] ?? ''));
        if ($sku === '') {
            $sku = $barcode;
        }

        $title = trim((string) ($data['nama'] ?? ''));
        $description = trim((string) ($data['deskripsi'] ?? ''));

        $buyPrice = isset($data['harga_beli']) && is_numeric($data['harga_beli']) ? (int) $data['harga_beli'] : 0;
        $sellPrice = isset($data['harga_jual']) && is_numeric($data['harga_jual']) ? (int) $data['harga_jual'] : 0;
        $stock = isset($data['stok']) && is_numeric($data['stok']) ? (int) $data['stok'] : 0;
        $minStock = isset($data['min_stok']) && is_numeric($data['min_stok']) ? (int) $data['min_stok'] : 0;
        $maxStock = isset($data['max_stok']) && is_numeric($data['max_stok']) ? (int) $data['max_stok'] : 0;

        $taxType = in_array(strtolower((string) ($data['tipe_pajak'] ?? '')), ['inclusive', 'exclusive', 'non_taxable'])
            ? strtolower((string) $data['tipe_pajak'])
            : 'exclusive';

        $taxRate = isset($data['tarif_pajak']) && is_numeric($data['tarif_pajak'])
            ? (float) $data['tarif_pajak']
            : null;

        $product = Product::create([
            'image' => '',
            'barcode' => $barcode,
            'sku' => $sku,
            'title' => $title,
            'description' => $description,
            'category_id' => $category->id,
            'buy_price' => $buyPrice,
            'sell_price' => $sellPrice,
            'stock' => $stock,
            'min_stock' => $minStock,
            'max_stock' => $maxStock,
            'tax_type' => $taxType,
            'tax_rate' => $taxRate,
        ]);

        if ($stock > 0) {
            ProductWarehouse::create([
                'product_id' => $product->id,
                'warehouse_id' => $this->warehouseId,
                'stock' => $stock,
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'barcode' => ['required', 'string', 'max:100', 'unique:products,barcode'],
            'sku' => ['nullable', 'string', 'max:100', 'unique:products,sku'],
            'nama' => ['required', 'string', 'max:255'],
            'harga_beli' => ['nullable', 'numeric', 'min:0'],
            'harga_jual' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function customValidationMessages(): array
    {
        return [
            'barcode.required' => 'Barcode wajib diisi.',
            'barcode.unique' => 'Barcode sudah terdaftar di database.',
            'sku.unique' => 'SKU sudah digunakan di database.',
            'nama.required' => 'Nama produk wajib diisi.',
        ];
    }

    public function chunkSize(): int
    {
        return 100;
    }

    public function getRowCount(): int
    {
        return $this->rowCount;
    }
}
