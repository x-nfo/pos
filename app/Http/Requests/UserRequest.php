<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $targetUser = $this->route('user');
        if ($targetUser) {
            $userModel = $targetUser instanceof \App\Models\User ? $targetUser : \App\Models\User::find($targetUser);
            if ($userModel && $userModel->isSuperAdmin() && ! $this->user()?->isSuperAdmin()) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array|string>
     */
    public function rules(): array
    {
        $userId = $this->route('user')?->id ?? null;
        $isCreate = $this->isMethod('post');

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password' => [$isCreate ? 'required' : 'nullable', 'string', 'min:8', 'confirmed'],
            'avatar' => ['nullable', 'image', 'max:2048'],
            'selectedRoles' => [
                'required',
                'array',
                'min:1',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (! is_array($value)) {
                        return;
                    }

                    $currentUser = $this->user();
                    if ($currentUser?->isSuperAdmin()) {
                        return;
                    }

                    if (in_array('super-admin', $value, true)) {
                        $fail('Hanya Super Admin yang dapat menetapkan role Super Admin.');

                        return;
                    }

                    $userPermissionNames = $currentUser ? $currentUser->getAllPermissions()->pluck('name')->all() : [];
                    $selectedRoleModels = \Spatie\Permission\Models\Role::with('permissions:id,name')->whereIn('name', $value)->get();

                    foreach ($selectedRoleModels as $roleModel) {
                        $rolePermissions = $roleModel->permissions->pluck('name')->all();
                        $diff = array_diff($rolePermissions, $userPermissionNames);

                        if (! empty($diff)) {
                            $fail("Anda tidak memiliki wewenang untuk menetapkan group akses '{$roleModel->name}' karena memiliki hak akses di luar wewenang Anda.");

                            return;
                        }
                    }
                },
            ],
            'selectedRoles.*' => ['string'],
        ];
    }
}
