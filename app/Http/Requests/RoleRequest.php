<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class RoleRequest extends FormRequest
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
     * @return array<string, ValidationRule|array|string>
     */
    public function rules(): array
    {
        $role = $this->route('role');
        $roleId = $role instanceof Role ? $role->id : $role;

        return [
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('roles', 'name')->ignore($roleId),
                Rule::notIn(['super-admin']),
            ],
            'selectedPermission' => [
                'nullable',
                'array',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (! empty($value) && is_array($value) && ! $this->user()?->isSuperAdmin()) {
                        $userPermissionIds = $this->user()->getAllPermissions()->pluck('id')->all();
                        $unauthorizedIds = array_diff($value, $userPermissionIds);
                        if (! empty($unauthorizedIds)) {
                            $fail('Anda hanya dapat memberikan hak akses yang Anda miliki.');
                        }
                    }
                },
            ],
            'selectedPermission.*' => ['nullable'],
        ];
    }
}
