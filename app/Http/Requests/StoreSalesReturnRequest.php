<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSalesReturnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'return_type' => ['required', 'in:refund_cash,store_credit,product_exchange'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.transaction_detail_id' => ['required', 'integer', 'exists:transaction_details,id'],
            'items.*.qty_return' => ['nullable', 'integer', 'min:0'],
            'items.*.return_reason' => ['nullable', 'string', 'max:255'],
            'items.*.restock_to_inventory' => ['nullable', 'boolean'],
            'exchange_items' => ['nullable', 'array'],
            'exchange_items.*.product_id' => ['required_with:exchange_items', 'integer', 'exists:products,id'],
            'exchange_items.*.unit_id' => ['nullable', 'integer', 'exists:units,id'],
            'exchange_items.*.qty' => ['required_with:exchange_items', 'integer', 'min:1'],
            'exchange_payment_method' => ['nullable', 'string', 'in:cash,bank_transfer,qris,edc'],
            'exchange_cash' => ['nullable', 'integer', 'min:0'],
            'exchange_change' => ['nullable', 'integer', 'min:0'],
            'action' => ['nullable', 'string', 'in:draft,complete'],
        ];
    }
}
