<?php

namespace Tests\Feature\Settings;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ShippingSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'shipping-settings-access',
            'shipping-settings-update',
            'dashboard-access',
        ] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }
    }

    protected function createAdminUser(): User
    {
        $role = Role::firstOrCreate(['name' => 'admin']);
        $role->syncPermissions([
            'shipping-settings-access',
            'shipping-settings-update',
            'dashboard-access',
        ]);

        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_admin_can_access_shipping_settings_page(): void
    {
        $admin = $this->createAdminUser();

        Setting::set('rajaongkir_api_key', 'mock_api_key_456');
        Setting::set('rajaongkir_origin_id', '17593');
        Setting::set('rajaongkir_origin_label', 'BANDUNG');
        Setting::set('rajaongkir_is_active', '1');

        $response = $this->actingAs($admin)->get(route('settings.shipping.edit'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Settings/Shipping')
                ->where('settings.rajaongkir_origin_id', '17593')
                ->where('settings.rajaongkir_origin_label', 'BANDUNG')
                ->where('settings.rajaongkir_is_active', true)
            );
    }

    public function test_admin_can_update_shipping_settings(): void
    {
        $admin = $this->createAdminUser();

        $response = $this->actingAs($admin)->post(route('settings.shipping.update'), [
            'rajaongkir_is_active' => true,
            'rajaongkir_api_key' => 'new_secret_key_789',
            'rajaongkir_base_url' => 'https://rajaongkir.komerce.id/api/v1',
            'rajaongkir_origin_id' => 4866,
            'rajaongkir_origin_label' => 'BATUNUNGGAL, BANDUNG',
            'rajaongkir_couriers' => 'jne,jnt,sicepat',
            'rajaongkir_default_weight' => 1500,
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertEquals('new_secret_key_789', Setting::get('rajaongkir_api_key'));
        $this->assertEquals('4866', Setting::get('rajaongkir_origin_id'));
        $this->assertEquals('BATUNUNGGAL, BANDUNG', Setting::get('rajaongkir_origin_label'));
        $this->assertEquals('jne,jnt,sicepat', Setting::get('rajaongkir_couriers'));
        $this->assertEquals('1500', Setting::get('rajaongkir_default_weight'));
        $this->assertTrue(Setting::getBool('rajaongkir_is_active'));
    }

    public function test_admin_can_test_api_connection(): void
    {
        $admin = $this->createAdminUser();

        Http::fake([
            '*/destination/domestic-destination*' => Http::response([
                'meta' => ['message' => 'Success', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 1, 'label' => 'Sample Destination']],
            ], 200),
        ]);

        $response = $this->actingAs($admin)->postJson(route('settings.shipping.test'), [
            'api_key' => 'valid_key',
            'base_url' => 'https://rajaongkir.komerce.id/api/v1',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_admin_can_clear_shipping_cache(): void
    {
        $admin = $this->createAdminUser();

        $response = $this->actingAs($admin)->postJson(route('settings.shipping.clear-cache'));

        $response->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_unauthorized_user_cannot_access_shipping_settings(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('settings.shipping.edit'));
        $response->assertForbidden();
    }
}
