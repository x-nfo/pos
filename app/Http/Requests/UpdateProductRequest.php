<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Foundation\Http\FormRequest;
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

        return [
            'barcode' => [
                'required',
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
            'buy_price' => ['required', 'numeric', 'min:0'],
            'sell_price' => ['required', 'numeric', 'min:0'],
            'min_stock' => ['nullable', 'integer', 'min:0'],
            'max_stock' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:2048'],
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
