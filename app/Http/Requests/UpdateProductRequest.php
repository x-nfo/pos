<?php

namespace App\Http\Requests;

use App\Models\Product;
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
            'barcode' => ['required', 'string', 'max:100', Rule::unique('products', 'barcode')->ignore($productId)],
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
            'units.*.unit_id' => ['required_with:units', 'exists:units,id'],
            'units.*.is_base' => ['nullable', 'boolean'],
            'units.*.conversion_factor' => ['nullable', 'numeric', 'min:0.0001'],
            'units.*.buy_price' => ['nullable', 'numeric', 'min:0'],
            'units.*.sell_price' => ['nullable', 'numeric', 'min:0'],
            'units.*.barcode' => ['nullable', 'string', 'max:100'],
            'units.*.sku_suffix' => ['nullable', 'string', 'max:20'],
        ];
    }
}
