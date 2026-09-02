<?php

namespace App\Http\Controllers;

use App\Http\Requests\UserRequest;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // get all users data
        $users = User::query()
            ->with(['roles', 'warehouse:id,code,name'])
            ->when(request()->search, fn ($query) => $query->where('name', 'like', '%'.request()->search.'%'))
            ->select('id', 'name', 'avatar', 'email', 'warehouse_id')
            ->latest()
            ->paginate(7)
            ->withQueryString();

        // render view
        return Inertia::render('Dashboard/Users/Index', [
            'users' => $users,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request)
    {
        // get assignable role data (filter unowned permissions/super-admin for non-super-admin users)
        $roles = $this->getAssignableRoles($request->user());
        $warehouses = Warehouse::active()->orderBy('sort_order')->orderBy('code')->get(['id', 'code', 'name']);

        // render view
        return Inertia::render('Dashboard/Users/Create', [
            'roles' => $roles,
            'warehouses' => $warehouses,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(UserRequest $request)
    {
        $avatarPath = null;

        if ($request->file('avatar')) {
            $avatarPath = $request->file('avatar')->store('avatars', 'public');
        }

        // create new user data
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => bcrypt($request->password),
            'avatar' => $avatarPath,
            'warehouse_id' => $request->warehouse_id,
        ]);

        // assign role to user
        $user->assignRole($request->selectedRoles);

        $this->auditLogService->log(
            event: 'user.created',
            module: 'users',
            auditable: $user,
            description: 'Pengguna baru dibuat.',
            after: $this->userPayload(
                $user,
                $this->auditLogService->roleNames($request->selectedRoles),
                $avatarPath !== null
            ),
        );

        // render view
        return to_route('users.index');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Request $request, User $user)
    {
        $currentUser = $request->user();
        if ($user->isSuperAdmin() && ! $currentUser?->isSuperAdmin()) {
            abort(403, 'Anda tidak memiliki wewenang untuk mengedit akun Super Admin.');
        }

        // get assignable role data (filter unowned permissions/super-admin for non-super-admin users)
        $roles = $this->getAssignableRoles($currentUser);
        $warehouses = Warehouse::active()->orderBy('sort_order')->orderBy('code')->get(['id', 'code', 'name']);

        // load relationship
        $user->load([
            'roles' => fn ($query) => $query->select('id', 'name'),
            'roles.permissions' => fn ($query) => $query->select('id', 'name'),
            'warehouse:id,code,name',
        ]);

        // render view
        return Inertia::render('Dashboard/Users/Edit', [
            'roles' => $roles,
            'user' => $user,
            'warehouses' => $warehouses,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UserRequest $request, User $user)
    {
        $currentUser = $request->user();
        if ($user->isSuperAdmin() && ! $currentUser?->isSuperAdmin()) {
            abort(403, 'Anda tidak memiliki wewenang untuk memperbarui akun Super Admin.');
        }

        // Prevent removing the super-admin role from the last remaining super-admin
        if ($user->isSuperAdmin() && ! in_array('super-admin', $request->selectedRoles, true)) {
            $superAdminCount = User::role('super-admin')->count();
            if ($superAdminCount <= 1) {
                return back()->withErrors([
                    'selectedRoles' => 'Tidak dapat mencabut role Super Admin dari akun Super Admin terakhir di sistem.',
                ]);
            }
        }

        $beforeRoles = $user->roles()->pluck('name')->all();
        $before = $this->userPayload($user, $beforeRoles, false);
        $avatarPath = $user->getRawOriginal('avatar');
        $avatarChanged = false;

        if ($request->file('avatar')) {
            if ($avatarPath) {
                Storage::disk('public')->delete($avatarPath);
            }

            $avatarPath = $request->file('avatar')->store('avatars', 'public');
            $avatarChanged = true;
        }

        // check if user send request password
        if ($request->password) {
            // update user data password
            $user->update([
                'password' => bcrypt($request->password),
            ]);
        }

        // update user data name, email, avatar, warehouse_id
        $user->update([
            'name' => $request->name,
            'email' => $request->email,
            'avatar' => $avatarPath,
            'warehouse_id' => $request->warehouse_id,
        ]);

        // assign role to user
        $user->syncRoles($request->selectedRoles);

        $afterRoles = $this->auditLogService->roleNames($request->selectedRoles);
        $after = $this->userPayload($user->fresh(), $afterRoles, $avatarChanged);

        $this->auditLogService->log(
            event: 'user.updated',
            module: 'users',
            auditable: $user,
            description: 'Data pengguna diperbarui.',
            before: $before,
            after: $after,
        );

        if ($beforeRoles !== $afterRoles) {
            $this->auditLogService->log(
                event: 'user.role_changed',
                module: 'users',
                auditable: $user,
                description: 'Role pengguna diperbarui.',
                before: ['roles' => array_values($beforeRoles)],
                after: ['roles' => array_values($afterRoles)],
            );
        }

        // render view
        return to_route('users.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, $id)
    {
        $currentUserId = $request->user()?->id;
        $isSuperAdmin = (bool) $request->user()?->isSuperAdmin();
        $ids = array_values(array_filter(explode(',', (string) $id)));

        if (in_array((string) $currentUserId, array_map('strval', $ids), true)) {
            return back()->with('error', 'Anda tidak dapat menghapus akun Anda sendiri.');
        }

        $users = User::query()->with('roles')->whereIn('id', $ids)->get();

        $hasSuperAdminTarget = $users->contains(fn (User $u) => $u->isSuperAdmin());
        if ($hasSuperAdminTarget && ! $isSuperAdmin) {
            abort(403, 'Anda tidak memiliki wewenang untuk menghapus akun Super Admin.');
        }

        if ($hasSuperAdminTarget) {
            $allSuperAdminIds = User::role('super-admin')->pluck('id')->all();
            $deletedSuperAdminIds = $users->filter(fn (User $u) => $u->isSuperAdmin())->pluck('id')->all();
            $remainingSuperAdmins = array_diff($allSuperAdminIds, $deletedSuperAdminIds);

            if (empty($remainingSuperAdmins)) {
                return back()->with('error', 'Tidak dapat menghapus semua akun Super Admin. Minimal harus tersisa 1 akun Super Admin.');
            }
        }

        foreach ($users as $user) {
            $this->auditLogService->log(
                event: 'user.deleted',
                module: 'users',
                auditable: $user,
                description: 'Pengguna dihapus.',
                before: $this->userPayload($user, $user->roles->pluck('name')->all(), false),
            );
        }

        User::whereIn('id', $ids)->delete();

        // render view
        return back();
    }

    private function userPayload(User $user, array $roles, bool $avatarChanged): array
    {
        return [
            'name' => $user->name,
            'email' => $user->email,
            'warehouse_id' => $user->warehouse_id,
            'avatar_changed' => $avatarChanged,
            'roles' => array_values($roles),
        ];
    }

    private function getAssignableRoles(?User $currentUser)
    {
        if ($currentUser?->isSuperAdmin()) {
            return Role::query()
                ->select('id', 'name')
                ->orderBy('name')
                ->get();
        }

        $userPermissionNames = $currentUser ? $currentUser->getAllPermissions()->pluck('name')->all() : [];

        return Role::query()
            ->with('permissions:id,name')
            ->where('name', '!=', 'super-admin')
            ->get()
            ->filter(function ($role) use ($userPermissionNames) {
                $rolePermissions = $role->permissions->pluck('name')->all();

                return empty(array_diff($rolePermissions, $userPermissionNames));
            })
            ->map(fn ($r) => ['id' => $r->id, 'name' => $r->name])
            ->sortBy('name')
            ->values();
    }
}
