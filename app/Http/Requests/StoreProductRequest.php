<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $hasVariants = $this->boolean('has_variants');

        return [
            'has_variants' => ['nullable', 'boolean'],
            'variant_display_type' => ['nullable', 'string', 'in:color,image,pill'],
            'barcode' => [
                $hasVariants ? 'nullable' : 'required',
                'string',
                'max:100',
                'unique:products,barcode',
                function ($attribute, $value, $fail) {
                    if (! empty($value)) {
                        $barcode = trim($value);
                        if (ProductUnit::where('barcode', $barcode)->exists()) {
                            $fail("Barcode '{$barcode}' sudah digunakan pada satuan produk lain.");
                        }
                    }
                },
            ],
            'sku' => ['nullable', 'string', 'max:100', 'unique:products,sku'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'size_chart_id' => ['nullable', 'integer', 'exists:size_charts,id'],
            'buy_price' => ['required', 'numeric', 'min:0'],
            'sell_price' => ['required', 'numeric', 'min:0'],
            'stock' => [$hasVariants ? 'nullable' : 'required_without:warehouse_stocks', 'nullable', 'integer', 'min:0'],
            'warehouse_stocks' => ['nullable', 'array'],
            'min_stock' => ['nullable', 'integer', 'min:0'],
            'max_stock' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:2048'],
            'color_images' => ['nullable', 'array'],
            'color_images.*' => ['nullable', function ($attribute, $value, $fail) {
                if ($value instanceof UploadedFile) {
                    $allowed = ['jpeg', 'png', 'jpg', 'webp'];
                    if (! in_array(strtolower($value->getClientOriginalExtension()), $allowed)) {
                        $fail('Format gambar varian warna harus jpeg, png, jpg, atau webp.');
                    }
                    if ($value->getSize() > 2048 * 1024) {
                        $fail('Ukuran gambar varian warna maksimal 2MB.');
                    }
                }
            }],
            'variants' => ['nullable', 'array'],
            'variants.*.size' => ['required_with:variants', 'string', 'max:50'],
            'variants.*.color_name' => ['required_with:variants', 'string', 'max:50'],
            'variants.*.color_hex' => ['nullable', 'string', 'max:20'],
            'variants.*.barcode' => ['required_with:variants', 'string', 'max:100', 'distinct', 'unique:products,barcode'],
            'variants.*.sku' => ['nullable', 'string', 'max:100', 'distinct', 'unique:products,sku'],
            'variants.*.buy_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.sell_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.stock' => ['nullable', 'integer', 'min:0'],
            'variants.*.image' => ['nullable', function ($attribute, $value, $fail) {
                if ($value instanceof UploadedFile) {
                    $allowed = ['jpeg', 'png', 'jpg', 'webp'];
                    if (! in_array(strtolower($value->getClientOriginalExtension()), $allowed)) {
                        $fail('Format gambar varian harus jpeg, png, jpg, atau webp.');
                    }
                    if ($value->getSize() > 2048 * 1024) {
                        $fail('Ukuran gambar varian maksimal 2MB.');
                    }
                }
            }],
            'units' => ['nullable', 'array'],
            'units.*.unit_id' => ['required_with:units', 'exists:units,id', 'distinct'],
            'units.*.is_base' => ['nullable', 'boolean'],
            'units.*.conversion_factor' => ['nullable', 'numeric', 'min:0.0001'],
            'units.*.buy_price' => ['nullable', 'numeric', 'min:0'],
            'units.*.sell_price' => ['nullable', 'numeric', 'min:0'],
            'units.*.barcode' => [
                'nullable',
                'string',
                'max:100',
                'distinct',
                function ($attribute, $value, $fail) {
                    if (! empty($value)) {
                        $barcode = trim($value);
                        $mainBarcode = trim((string) $this->input('barcode'));

                        if ($barcode !== $mainBarcode) {
                            if (Product::where('barcode', $barcode)->exists()) {
                                $fail("Barcode '{$barcode}' sudah digunakan oleh produk lain.");

                                return;
                            }
                        }

                        if (ProductUnit::where('barcode', $barcode)->exists()) {
                            $fail("Barcode '{$barcode}' sudah digunakan pada satuan produk lain.");
                        }
                    }
                },
            ],
            'units.*.sku_suffix' => ['nullable', 'string', 'max:20'],
        ];
    }
}
