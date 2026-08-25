<?php

namespace Tests\Feature\Authorization;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            UserSeeder::class,
        ]);

        $this->admin = User::where('email', 'admin@mail.com')->first();
        $this->cashier = User::where('email', 'kasir@mail.com')->first();
    }

    public function test_authorized_user_can_view_roles_index(): void
    {
        $response = $this->actingAs($this->admin)->get(route('roles.index'));

        $response->assertOk();
    }

    public function test_unauthorized_user_cannot_view_roles_index(): void
    {
        $response = $this->actingAs($this->cashier)->get(route('roles.index'));

        $response->assertForbidden();
    }

    public function test_authorized_user_can_create_role_with_permissions(): void
    {
        $permission = Permission::firstOrCreate(['name' => 'products-access', 'guard_name' => 'web']);

        $response = $this->actingAs($this->admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('roles.store'), [
                'name' => 'supervisor',
                'selectedPermission' => [$permission->id],
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('roles', [
            'name' => 'supervisor',
        ]);

        $createdRole = Role::findByName('supervisor', 'web');
        $this->assertTrue($createdRole->hasPermissionTo('products-access'));

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'role.created',
            'module' => 'roles',
        ]);
    }

    public function test_authorized_user_can_update_role_and_sync_permissions(): void
    {
        $perm1 = Permission::firstOrCreate(['name' => 'products-access', 'guard_name' => 'web']);
        $perm2 = Permission::firstOrCreate(['name' => 'categories-access', 'guard_name' => 'web']);

        $role = Role::create(['name' => 'staff-gudang', 'guard_name' => 'web']);
        $role->givePermissionTo($perm1);

        $response = $this->actingAs($this->admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('roles.update', $role->id), [
                'name' => 'staff-warehouse',
                'selectedPermission' => [$perm2->id],
            ]);

        $response->assertRedirect();

        $role->refresh();
        $this->assertEquals('staff-warehouse', $role->name);
        $this->assertFalse($role->hasPermissionTo('products-access'));
        $this->assertTrue($role->hasPermissionTo('categories-access'));

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'role.updated',
            'module' => 'roles',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'role.permission_changed',
            'module' => 'roles',
        ]);
    }

    public function test_updating_role_without_changing_permissions_logs_only_update(): void
    {
        $perm = Permission::firstOrCreate(['name' => 'products-access', 'guard_name' => 'web']);
        $role = Role::create(['name' => 'staff-lama', 'guard_name' => 'web']);
        $role->givePermissionTo($perm);

        AuditLog::query()->delete();

        $response = $this->actingAs($this->admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('roles.update', $role->id), [
                'name' => 'staff-baru',
                'selectedPermission' => [$perm->id],
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'role.updated',
        ]);
        $this->assertDatabaseMissing('audit_logs', [
            'event' => 'role.permission_changed',
        ]);
    }

    public function test_authorized_user_can_delete_role(): void
    {
        $role = Role::create(['name' => 'temporary-role', 'guard_name' => 'web']);

        $response = $this->actingAs($this->admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->delete(route('roles.destroy', $role->id));

        $response->assertRedirect();

        $this->assertDatabaseMissing('roles', [
            'name' => 'temporary-role',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'role.deleted',
            'module' => 'roles',
        ]);
    }

    public function test_role_validation_requires_name_and_unique_rule(): void
    {
        $response = $this->actingAs($this->admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('roles.store'), [
                'name' => '',
            ]);

        $response->assertSessionHasErrors('name');

        $role = Role::create(['name' => 'custom-role', 'guard_name' => 'web']);

        $responseDuplicate = $this->actingAs($this->admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('roles.store'), [
                'name' => 'custom-role',
            ]);

        $responseDuplicate->assertSessionHasErrors('name');
    }
}
