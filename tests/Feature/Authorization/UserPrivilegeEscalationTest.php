<?php

namespace Tests\Feature\Authorization;

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UserPrivilegeEscalationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;

    private User $manager;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            UserSeeder::class,
        ]);

        $this->superAdmin = User::where('email', 'admin@mail.com')->first();

        // Create manager with users management permissions but not super-admin
        $this->manager = User::create([
            'name' => 'Manager User',
            'email' => 'manager@mail.com',
            'password' => Hash::make('password'),
        ]);
        $this->manager->forceFill(['email_verified_at' => now()])->save();
        $this->manager->givePermissionTo([
            'dashboard-access',
            'users-access',
            'users-create',
            'users-update',
            'users-delete',
            'roles-access',
        ]);

        // Create regular staff
        $this->staff = User::create([
            'name' => 'Staff Regular',
            'email' => 'staff@mail.com',
            'password' => Hash::make('password'),
        ]);
        $this->staff->forceFill(['email_verified_at' => now()])->save();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_non_super_admin_cannot_access_edit_super_admin_page(): void
    {
        $response = $this->actingAs($this->manager)
            ->get(route('users.edit', $this->superAdmin->id));

        $response->assertForbidden();
    }

    public function test_non_super_admin_cannot_update_super_admin_user(): void
    {
        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('users.update', $this->superAdmin->id), [
                'name' => 'Hacked Admin',
                'email' => 'admin@mail.com',
                'selectedRoles' => ['cashier'],
            ]);

        $response->assertForbidden();

        $this->superAdmin->refresh();
        $this->assertNotEquals('Hacked Admin', $this->superAdmin->name);
        $this->assertTrue($this->superAdmin->hasRole('super-admin'));
    }

    public function test_non_super_admin_cannot_create_user_with_super_admin_role(): void
    {
        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('users.store'), [
                'name' => 'Rogue Super Admin',
                'email' => 'rogue@mail.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'selectedRoles' => ['super-admin'],
            ]);

        $response->assertSessionHasErrors('selectedRoles');
        $this->assertDatabaseMissing('users', ['email' => 'rogue@mail.com']);
    }

    public function test_non_super_admin_cannot_grant_super_admin_role_to_existing_user(): void
    {
        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('users.update', $this->staff->id), [
                'name' => $this->staff->name,
                'email' => $this->staff->email,
                'selectedRoles' => ['super-admin'],
            ]);

        $response->assertSessionHasErrors('selectedRoles');
        $this->staff->refresh();
        $this->assertFalse($this->staff->hasRole('super-admin'));
    }

    public function test_non_super_admin_only_sees_assignable_roles_on_create_and_edit_page(): void
    {
        $responseCreate = $this->actingAs($this->manager)
            ->get(route('users.create'));

        $responseCreate->assertOk();
        $responseCreate->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Users/Create')
            ->has('roles')
            ->where('roles', fn ($roles) => ! collect($roles)->pluck('name')->contains('payment-settings-update')
                && ! collect($roles)->pluck('name')->contains('branding-settings-access')
                && ! collect($roles)->pluck('name')->contains('super-admin')
            )
        );

        $responseEdit = $this->actingAs($this->manager)
            ->get(route('users.edit', $this->staff->id));

        $responseEdit->assertOk();
        $responseEdit->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Users/Edit')
            ->has('roles')
            ->where('roles', fn ($roles) => ! collect($roles)->pluck('name')->contains('payment-settings-update')
                && ! collect($roles)->pluck('name')->contains('branding-settings-access')
                && ! collect($roles)->pluck('name')->contains('super-admin')
            )
        );
    }

    public function test_non_super_admin_cannot_assign_roles_with_unowned_permissions_on_create(): void
    {
        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('users.store'), [
                'name' => 'Escalated User',
                'email' => 'escalated@mail.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'selectedRoles' => ['payment-settings-update'],
            ]);

        $response->assertSessionHasErrors('selectedRoles');
        $this->assertDatabaseMissing('users', ['email' => 'escalated@mail.com']);
    }

    public function test_non_super_admin_cannot_assign_roles_with_unowned_permissions_on_update(): void
    {
        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('users.update', $this->staff->id), [
                'name' => $this->staff->name,
                'email' => $this->staff->email,
                'selectedRoles' => ['branding-settings-access'],
            ]);

        $response->assertSessionHasErrors('selectedRoles');
        $this->staff->refresh();
        $this->assertFalse($this->staff->hasRole('branding-settings-access'));
    }

    public function test_non_super_admin_cannot_delete_super_admin_user(): void
    {
        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->delete(route('users.destroy', $this->superAdmin->id));

        $response->assertForbidden();
        $this->assertDatabaseHas('users', ['id' => $this->superAdmin->id]);
    }

    public function test_user_cannot_delete_own_account(): void
    {
        $response = $this->actingAs($this->manager)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->delete(route('users.destroy', $this->manager->id));

        $response->assertSessionHas('error');
        $this->assertDatabaseHas('users', ['id' => $this->manager->id]);
    }

    public function test_cannot_delete_the_last_super_admin(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->delete(route('users.destroy', $this->superAdmin->id));

        $this->assertDatabaseHas('users', ['id' => $this->superAdmin->id]);
    }

    public function test_cannot_revoke_super_admin_role_from_the_last_super_admin(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('users.update', $this->superAdmin->id), [
                'name' => $this->superAdmin->name,
                'email' => $this->superAdmin->email,
                'selectedRoles' => ['cashier'],
            ]);

        $response->assertSessionHasErrors('selectedRoles');
        $this->superAdmin->refresh();
        $this->assertTrue($this->superAdmin->hasRole('super-admin'));
    }

    public function test_super_admin_can_manage_other_users_normally(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->put(route('users.update', $this->staff->id), [
                'name' => 'Staff Updated',
                'email' => $this->staff->email,
                'selectedRoles' => ['cashier'],
            ]);

        $response->assertRedirect();
        $this->staff->refresh();
        $this->assertEquals('Staff Updated', $this->staff->name);
        $this->assertTrue($this->staff->hasRole('cashier'));
    }
}
