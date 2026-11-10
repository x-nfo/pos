<?php

namespace Tests\Feature\Shipping;

use App\Models\Setting;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RajaOngkirControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['shipping-rates-access', 'transactions-access', 'dashboard-access'] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }
    }

    protected function createCashierUser(): User
    {
        $role = Role::firstOrCreate(['name' => 'cashier']);
        $role->syncPermissions(['shipping-rates-access', 'transactions-access']);

        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_cashier_can_search_destinations(): void
    {
        $cashier = $this->createCashierUser();
        Setting::set('rajaongkir_api_key', 'test_key');

        Http::fake([
            '*/destination/domestic-destination*' => Http::response([
                'meta' => ['message' => 'Success', 'code' => 200, 'status' => 'success'],
                'data' => [
                    [
                        'id' => 4866,
                        'label' => 'BATUNUNGGAL, BANDUNG KIDUL, BANDUNG, JAWA BARAT, 40266',
                        'province_name' => 'JAWA BARAT',
                        'city_name' => 'BANDUNG',
                        'district_name' => 'BANDUNG KIDUL',
                        'subdistrict_name' => 'BATUNUNGGAL',
                        'zip_code' => '40266',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($cashier)->getJson(route('shipping.rajaongkir.destinations', [
            'search' => 'bandung',
        ]));

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 4866);
    }

    public function test_cashier_can_calculate_shipping_rates(): void
    {
        $cashier = $this->createCashierUser();
        Setting::set('rajaongkir_api_key', 'test_key');
        Setting::set('rajaongkir_origin_id', '17593');

        Http::fake([
            '*/calculate/domestic-cost*' => Http::response([
                'meta' => ['message' => 'Success', 'code' => 200, 'status' => 'success'],
                'data' => [
                    [
                        'name' => 'JNE Express',
                        'code' => 'jne',
                        'service' => 'REG',
                        'description' => 'Layanan Reguler',
                        'cost' => 12000,
                        'etd' => '1-2 day',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($cashier)->postJson(route('shipping.rajaongkir.calculate'), [
            'destination_id' => 4866,
            'weight' => 1000,
            'courier' => 'jne',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('options.0.courier_code', 'jne')
            ->assertJsonPath('options.0.cost', 12000);
    }

    public function test_info_endpoint_returns_warehouse_origin(): void
    {
        $warehouse = Warehouse::create([
            'code' => 'WH-BDO',
            'name' => 'Gudang Bandung',
            'type' => 'warehouse',
            'address' => 'Jl. Asia Afrika',
            'rajaongkir_origin_id' => 4866,
            'rajaongkir_origin_label' => 'BATUNUNGGAL, BANDUNG',
            'is_active' => true,
        ]);

        $cashier = $this->createCashierUser();
        $cashier->update(['warehouse_id' => $warehouse->id]);

        Setting::set('rajaongkir_api_key', 'test_key');

        $response = $this->actingAs($cashier)->getJson(route('shipping.rajaongkir.info'));

        $response->assertOk()
            ->assertJsonPath('origin_id', 4866)
            ->assertJsonPath('origin_label', 'BATUNUNGGAL, BANDUNG');
    }

    public function test_shipping_calculator_page_can_be_rendered(): void
    {
        $cashier = $this->createCashierUser();
        Setting::set('rajaongkir_api_key', 'test_key');
        Setting::set('rajaongkir_origin_id', '17593');

        $response = $this->actingAs($cashier)->get(route('shipping.calculator'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Shipping/Calculator')
                ->where('isConfigured', true)
                ->where('defaultOrigin.id', 17593)
            );
    }
}
