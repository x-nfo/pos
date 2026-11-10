<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $productParam = $this->route('product');
        $productId = $productParam instanceof Product ? $productParam->id : (int) $productParam;
        $hasVariants = $this->has('has_variants')
            ? $this->boolean('has_variants')
            : (is_array($this->input('variants')) && count($this->input('variants')) > 0);

        return [
            'has_variants' => ['nullable', 'boolean'],
            'variant_display_type' => ['nullable', 'string', 'in:color,image,pill'],
            'barcode' => [
                $hasVariants ? 'nullable' : 'required',
                'string',
                'max:100',
                Rule::unique('products', 'barcode')->ignore($productId),
                function ($attribute, $value, $fail) use ($productId) {
                    if (! empty($value)) {
                        $barcode = trim($value);
                        if (ProductUnit::where('barcode', $barcode)->where('product_id', '!=', $productId)->exists()) {
                            $fail("Barcode '{$barcode}' sudah digunakan pada satuan produk lain.");
                        }
                    }
                },
            ],
            'sku' => ['nullable', 'string', 'max:100', Rule::unique('products', 'sku')->ignore($productId)],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'size_chart_id' => ['nullable', 'integer', 'exists:size_charts,id'],
            'buy_price' => ['required', 'numeric', 'min:0'],
            'sell_price' => ['required', 'numeric', 'min:0'],
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
            'variants.*.id' => ['nullable', 'integer'],
            'variants.*.size' => ['required_with:variants', 'string', 'max:50'],
            'variants.*.color_name' => ['required_with:variants', 'string', 'max:50'],
            'variants.*.color_hex' => ['nullable', 'string', 'max:20'],
            'variants.*.barcode' => [
                'required_with:variants',
                'string',
                'max:100',
                'distinct',
                function ($attribute, $value, $fail) use ($productId) {
                    if (! empty($value)) {
                        $barcode = trim($value);
                        preg_match('/variants\.(\d+)\.barcode/', $attribute, $matches);
                        $idx = $matches[1] ?? null;
                        $variantId = $idx !== null ? $this->input("variants.{$idx}.id") : null;

                        if (! $variantId && $idx !== null) {
                            $colorName = trim($this->input("variants.{$idx}.color_name") ?? '');
                            $size = trim($this->input("variants.{$idx}.size") ?? '');
                            if (! empty($colorName) && ! empty($size)) {
                                $matched = Product::where('parent_id', $productId)
                                    ->where('variant_attributes->color_name', $colorName)
                                    ->where('variant_attributes->size', $size)
                                    ->first();
                                $variantId = $matched?->id;
                            }
                        }

                        $query = Product::where('barcode', $barcode);
                        if ($variantId) {
                            $query->where('id', '!=', $variantId);
                        } else {
                            $query->where('id', '!=', $productId);
                        }

                        if ($query->exists()) {
                            $fail("Barcode varian '{$barcode}' sudah digunakan.");
                        }
                    }
                },
            ],
            'variants.*.sku' => ['nullable', 'string', 'max:100', 'distinct'],
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
                function ($attribute, $value, $fail) use ($productId) {
                    if (! empty($value)) {
                        $barcode = trim($value);
                        $mainBarcode = trim((string) $this->input('barcode'));

                        if ($barcode !== $mainBarcode) {
                            if (Product::where('barcode', $barcode)->where('id', '!=', $productId)->exists()) {
                                $fail("Barcode '{$barcode}' sudah digunakan oleh produk lain.");

                                return;
                            }
                        }

                        if (ProductUnit::where('barcode', $barcode)->where('product_id', '!=', $productId)->exists()) {
                            $fail("Barcode '{$barcode}' sudah digunakan pada satuan produk lain.");
                        }
                    }
                },
            ],
            'units.*.sku_suffix' => ['nullable', 'string', 'max:20'],
        ];
    }
}
