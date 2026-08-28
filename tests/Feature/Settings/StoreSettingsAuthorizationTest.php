<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreSettingsAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);
    }

    public function test_super_admin_can_access_all_settings_pages(): void
    {
        $superAdmin = User::factory()->create();
        $superAdmin->assignRole('super-admin');

        $this->actingAs($superAdmin)->get(route('settings.store'))->assertOk();
        $this->actingAs($superAdmin)->get(route('settings.printer'))->assertOk();
        $this->actingAs($superAdmin)->get(route('settings.loyalty'))->assertOk();
        $this->actingAs($superAdmin)->get(route('settings.target'))->assertOk();
    }

    public function test_cashier_cannot_access_settings_pages(): void
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        $this->actingAs($cashier)->get(route('settings.store'))->assertForbidden();
        $this->actingAs($cashier)->get(route('settings.printer'))->assertForbidden();
        $this->actingAs($cashier)->get(route('settings.loyalty'))->assertForbidden();
        $this->actingAs($cashier)->get(route('settings.target'))->assertForbidden();
    }

    public function test_user_with_store_settings_access_can_view_store_identity(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('store-settings-access');

        $this->actingAs($user)->get(route('settings.store'))->assertOk();
        $this->actingAs($user)->get(route('settings.printer'))->assertForbidden();
    }

    public function test_user_with_store_settings_update_can_update_store_profile(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['store-settings-access', 'store-settings-update']);

        $response = $this->actingAs($user)->post(route('settings.store.update'), [
            'store_name' => 'Toko Serba Ada',
            'store_address' => 'Jl. Merdeka No. 45',
            'store_phone' => '081234567890',
            'tax_default_rate' => 11,
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }

    public function test_user_without_store_settings_update_cannot_update_store_profile(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('store-settings-access');

        $response = $this->actingAs($user)->post(route('settings.store.update'), [
            'store_name' => 'Toko Serba Ada',
            'store_address' => 'Jl. Merdeka No. 45',
        ]);

        $response->assertForbidden();
    }

    public function test_printer_settings_authorization(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['printer-settings-access', 'printer-settings-update']);

        $this->actingAs($user)->get(route('settings.printer'))->assertOk();

        $response = $this->actingAs($user)->post(route('settings.printer.update'), [
            'printer_auto_print' => false,
            'printer_paper_size' => '80mm',
            'printer_driver' => 'browser',
            'printer_enable_bluetooth' => true,
            'printer_enable_webusb' => true,
            'printer_enable_server' => false,
            'printer_enable_pdf_receipt' => true,
            'printer_enable_pdf_invoice' => true,
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }

    public function test_loyalty_settings_authorization(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['loyalty-settings-access', 'loyalty-settings-update']);

        $this->actingAs($user)->get(route('settings.loyalty'))->assertOk();

        $response = $this->actingAs($user)->post(route('settings.loyalty.update'), [
            'enable_earn' => true,
            'enable_redeem' => true,
            'earn_rate_amount' => 10000,
            'redeem_point_value' => 100,
            'tiers' => [
                'regular' => 0,
                'silver' => 500,
                'gold' => 1500,
                'platinum' => 3000,
            ],
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }

    public function test_target_settings_authorization(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['target-settings-access', 'target-settings-update']);

        $this->actingAs($user)->get(route('settings.target'))->assertOk();

        $response = $this->actingAs($user)->post(route('settings.target.update'), [
            'monthly_sales_target' => 150000000,
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }
}
