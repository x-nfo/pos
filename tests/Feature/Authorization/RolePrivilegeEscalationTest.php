<?php

namespace Tests\Feature\Authorization;

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class RolePrivilegeEscalationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            UserSeeder::class,
        ]);

        $this->superAdmin = User::where('email', 'admin@mail.com')->first();

        // Create manager with role management permissions but limited business permissions
        $this->manager = User::create([
            'name' => 'Manager Role Admin',
            'email' => 'role_manager@mail.com',
            'password' => Hash::make('password'),
        ]);
        $this->manager->forceFill(['email_verified_at' => now()])->save();
        $this->manager->givePermissionTo([
            'dashboard-access',
            'roles-access',
            'roles-create',
            'roles-update',
            'roles-delete',
            'products-access',
            'categories-access',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_super_admin_role_cannot_be_updated(): void
    {
        $superAdminRole = Role::findByName('super-admin', 'web');

        $response = $this->actingAs($this->superAdmin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('roles.update', $superAdminRole->id), [
                'name' => 'renamed-super-admin',
                'selectedPermission' => [],
            ]);

        $response->assertForbidden();

        $superAdminRole->refresh();
        $this->assertEquals('super-admin', $superAdminRole->name);
    }

    public function test_super_admin_role_cannot_be_deleted(): void
    {
        $superAdminRole = Role::findByName('super-admin', 'web');

        $response = $this->actingAs($this->superAdmin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->delete(route('roles.destroy', $superAdminRole->id));

        $response->assertForbidden();

        $this->assertDatabaseHas('roles', ['name' => 'super-admin']);
    }

    public function test_cannot_create_role_with_super_admin_name(): void
    {
        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('roles.store'), [
                'name' => 'super-admin',
                'selectedPermission' => [],
            ]);

        $response->assertSessionHasErrors('name');
    }

    public function test_non_super_admin_cannot_assign_unowned_permissions_on_create(): void
    {
        $unownedPermission = Permission::where('name', 'payment-settings-update')->first();

        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('roles.store'), [
                'name' => 'custom-finance',
                'selectedPermission' => [$unownedPermission->id],
            ]);

        $response->assertSessionHasErrors('selectedPermission');
        $this->assertDatabaseMissing('roles', ['name' => 'custom-finance']);
    }

    public function test_non_super_admin_cannot_assign_unowned_permissions_on_update(): void
    {
        $ownedPermission = Permission::where('name', 'products-access')->first();
        $unownedPermission = Permission::where('name', 'payment-settings-update')->first();

        $role = Role::create(['name' => 'inventory-staff', 'guard_name' => 'web']);
        $role->givePermissionTo($ownedPermission);

        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('roles.update', $role->id), [
                'name' => 'inventory-staff',
                'selectedPermission' => [$unownedPermission->id],
            ]);

        $response->assertSessionHasErrors('selectedPermission');
    }

    public function test_non_super_admin_can_create_role_with_owned_permissions(): void
    {
        $ownedPermission = Permission::where('name', 'products-access')->first();

        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('roles.store'), [
                'name' => 'catalog-editor',
                'selectedPermission' => [$ownedPermission->id],
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('roles', ['name' => 'catalog-editor']);
        $createdRole = Role::findByName('catalog-editor', 'web');
        $this->assertTrue($createdRole->hasPermissionTo('products-access'));
    }

    public function test_super_admin_can_create_role_with_any_permissions(): void
    {
        $permission = Permission::where('name', 'payment-settings-update')->first();

        $response = $this->actingAs($this->superAdmin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('roles.store'), [
                'name' => 'payment-officer',
                'selectedPermission' => [$permission->id],
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('roles', ['name' => 'payment-officer']);
    }
}
