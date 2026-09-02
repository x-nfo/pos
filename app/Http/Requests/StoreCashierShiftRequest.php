<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCashierShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $user = $this->user();

        return [
            'opening_cash' => ['required', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'warehouse_id' => [
                'nullable',
                'integer',
                'exists:warehouses,id',
                function ($attribute, $value, $fail) use ($user) {
                    if ($user && ! $user->isHQ() && $value && (int) $value !== (int) $user->warehouse_id) {
                        $fail('Kasir hanya dapat membuka shift di cabang penempatannya.');
                    }
                },
            ],
        ];
    }
}
