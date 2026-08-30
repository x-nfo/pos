<?php

namespace App\Http\Controllers;

use App\Http\Requests\RoleRequest;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $isSuperAdmin = (bool) $request->user()?->isSuperAdmin();

        // get all role data
        $roles = Role::query()
            ->with('permissions')
            ->when(request()->search, fn ($query) => $query->where('name', 'like', '%'.request()->search.'%'))
            ->select('id', 'name')
            ->latest()
            ->paginate(7)
            ->withQueryString();

        // get all permission data (non-super-admin can only assign permissions they already have)
        $permissions = $isSuperAdmin
            ? Permission::query()
                ->select('id', 'name')
                ->orderBy('name')
                ->get()
            : $request->user()
                ->getAllPermissions()
                ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name])
                ->sortBy('name')
                ->values();

        // render view
        return Inertia::render('Dashboard/Roles/Index', [
            'roles' => $roles,
            'permissions' => $permissions,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(RoleRequest $request)
    {
        // create new role data
        $role = Role::create(['name' => $request->name]);

        // give permissions to role
        if (! empty($request->selectedPermission)) {
            $role->givePermissionTo($request->selectedPermission);
        }

        $this->auditLogService->log(
            event: 'role.created',
            module: 'roles',
            auditable: $role,
            description: 'Role baru dibuat.',
            after: [
                'name' => $role->name,
                'permissions' => $this->auditLogService->permissionNames($request->selectedPermission ?? []),
            ],
        );

        // render view
        return back();
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(RoleRequest $request, Role $role)
    {
        if ($role->name === 'super-admin') {
            abort(403, 'Role Super Admin adalah role sistem yang dilindungi dan tidak dapat diubah.');
        }

        $beforePermissions = $role->permissions()->pluck('name')->all();
        $before = [
            'name' => $role->name,
            'permissions' => array_values($beforePermissions),
        ];

        // update role data
        $role->update(['name' => $request->name]);

        // sync role permissions
        $role->syncPermissions($request->selectedPermission ?? []);

        $afterPermissions = $this->auditLogService->permissionNames($request->selectedPermission ?? []);

        $this->auditLogService->log(
            event: 'role.updated',
            module: 'roles',
            auditable: $role,
            description: 'Role diperbarui.',
            before: $before,
            after: [
                'name' => $role->fresh()->name,
                'permissions' => array_values($afterPermissions),
            ],
        );

        if ($beforePermissions !== $afterPermissions) {
            $this->auditLogService->log(
                event: 'role.permission_changed',
                module: 'roles',
                auditable: $role,
                description: 'Permission role diperbarui.',
                before: ['permissions' => array_values($beforePermissions)],
                after: ['permissions' => array_values($afterPermissions)],
            );
        }

        // render view
        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Role $role)
    {
        if ($role->name === 'super-admin') {
            abort(403, 'Role Super Admin adalah role sistem yang dilindungi dan tidak dapat dihapus.');
        }

        $before = [
            'name' => $role->name,
            'permissions' => $role->permissions()->pluck('name')->all(),
        ];

        // delete role data
        $role->delete();

        $this->auditLogService->log(
            event: 'role.deleted',
            module: 'roles',
            auditable: $role,
            description: 'Role dihapus.',
            before: $before,
        );

        // render view
        return back();
    }
}
