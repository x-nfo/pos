<?php

namespace Tests\Feature\DineIn;

use App\Models\DineArea;
use App\Models\DiningTable;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class DineInManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'dine-tables-access',
            'dine-tables-create',
            'dine-tables-update',
            'dine-tables-delete',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo($permissions);

        return $user;
    }

    public function test_unauthorized_user_cannot_access_dine_areas_and_tables(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($user)
            ->get(route('dine-areas.index'))
            ->assertForbidden();

        $this->actingAs($user)
            ->get(route('dine-tables.index'))
            ->assertForbidden();
    }

    public function test_authorized_user_can_manage_dine_areas(): void
    {
        $user = $this->createUserWithPermissions([
            'dine-tables-access',
            'dine-tables-create',
            'dine-tables-update',
            'dine-tables-delete',
        ]);

        // Create Area
        $response = $this->actingAs($user)
            ->post(route('dine-areas.store'), [
                'name' => 'Outdoor Garden',
                'sort_order' => 1,
                'is_active' => true,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('dine_areas', [
            'name' => 'Outdoor Garden',
            'is_active' => true,
        ]);

        $area = DineArea::first();

        // Update Area
        $this->actingAs($user)
            ->put(route('dine-areas.update', $area), [
                'name' => 'Outdoor Garden VIP',
                'sort_order' => 2,
                'is_active' => true,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('dine_areas', [
            'id' => $area->id,
            'name' => 'Outdoor Garden VIP',
        ]);

        // Delete Area
        $this->actingAs($user)
            ->delete(route('dine-areas.destroy', $area))
            ->assertRedirect();

        $this->assertDatabaseMissing('dine_areas', [
            'id' => $area->id,
        ]);
    }

    public function test_authorized_user_can_manage_dine_tables(): void
    {
        $user = $this->createUserWithPermissions([
            'dine-tables-access',
            'dine-tables-create',
            'dine-tables-update',
            'dine-tables-delete',
        ]);

        $area = DineArea::create([
            'name' => 'Indoor AC',
            'sort_order' => 1,
            'is_active' => true,
        ]);

        // Create Table
        $response = $this->actingAs($user)
            ->post(route('dine-tables.store'), [
                'dine_area_id' => $area->id,
                'name' => 'Meja 01',
                'capacity' => 4,
                'shape' => 'square',
                'sort_order' => 1,
                'is_active' => true,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('dine_tables', [
            'dine_area_id' => $area->id,
            'name' => 'Meja 01',
            'capacity' => 4,
        ]);

        $table = DiningTable::first();
        $this->assertNotNull($table->token);

        // Update Table
        $this->actingAs($user)
            ->patch(route('dine-tables.update', $table), [
                'name' => 'Meja 01 VIP',
                'capacity' => 6,
                'shape' => 'square',
                'is_active' => true,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('dine_tables', [
            'id' => $table->id,
            'name' => 'Meja 01 VIP',
            'capacity' => 6,
        ]);

        // Delete Table
        $this->actingAs($user)
            ->delete(route('dine-tables.destroy', $table))
            ->assertRedirect();

        $this->assertDatabaseMissing('dine_tables', [
            'id' => $table->id,
        ]);
    }
}
