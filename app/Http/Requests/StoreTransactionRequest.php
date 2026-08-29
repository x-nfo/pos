<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreTransactionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'customer_voucher_id' => ['nullable', 'integer', 'exists:customer_vouchers,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'shipping_cost' => ['nullable', 'numeric', 'min:0'],
            'redeem_points' => ['nullable', 'numeric', 'min:0'],
            'cash' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string'],
            'payment_gateway' => ['nullable', 'string'],
            'pay_later' => ['nullable', 'boolean'],
            'due_date' => [
                'nullable',
                'date',
                function ($attribute, $value, $fail) {
                    $isPayLater = $this->boolean('pay_later') || $this->input('payment_method') === 'pay_later';
                    if ($isPayLater && blank($value)) {
                        $fail('Tanggal jatuh tempo wajib diisi untuk nota barang.');
                    }
                },
            ],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'customer_npwp' => ['nullable', 'string', 'max:50'],
        ];
    }

    /**
     * Custom messages
     */
    public function messages(): array
    {
        return [
            'due_date.required_if' => 'Tanggal jatuh tempo wajib diisi untuk nota barang.',
            'customer_id.exists' => 'Pelanggan tidak valid.',
            'customer_voucher_id.exists' => 'Voucher tidak valid.',
            'bank_account_id.exists' => 'Akun bank tidak valid.',
        ];
    }
}
