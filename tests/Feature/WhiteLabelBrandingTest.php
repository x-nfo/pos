<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Services\BrandingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class WhiteLabelBrandingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate(['name' => 'dashboard-access', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'store-settings-access', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'store-settings-update', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'branding-settings-access', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'branding-settings-update', 'guard_name' => 'web']);
        $superAdminRole = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        $superAdminRole->syncPermissions(Permission::all());
    }

    public function test_branding_settings_page_can_be_rendered(): void
    {
        $user = User::factory()->create();
        $user->assignRole('super-admin');
        $user->givePermissionTo('branding-settings-access');

        $response = $this->actingAs($user)->get(route('settings.branding'));

        $response->assertOk();
    }

    public function test_branding_settings_can_be_updated(): void
    {
        $user = User::factory()->create();
        $user->assignRole('super-admin');
        $user->givePermissionTo('branding-settings-update');

        $payload = [
            'app_name' => 'RetailPro Suite',
            'app_tagline' => 'Enterprise Point of Sales',
            'theme_primary_color' => '#059669',
            'theme_accent_color' => '#10b981',
            'app_footer_text' => '© 2026 RetailPro Inc.',
            'app_powered_by_show' => true,
            'app_powered_by_text' => 'Powered by AgencyTech',
            'app_powered_by_url' => 'https://agencytech.id',
            'landing_page_mode' => 'direct_login',
        ];

        $response = $this->actingAs($user)->post(route('settings.branding.update'), $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->assertSame('RetailPro Suite', Setting::get('app_name'));
        $this->assertSame('#059669', Setting::get('theme_primary_color'));
        $this->assertSame('direct_login', Setting::get('landing_page_mode'));
    }

    public function test_manifest_returns_dynamic_branding_json(): void
    {
        Setting::set('app_name', 'SuperPOS');
        Setting::set('theme_primary_color', '#0284c7');

        $response = $this->get(route('manifest'));

        $response->assertOk();
        $response->assertJsonPath('name', 'SuperPOS');
        $response->assertJsonPath('theme_color', '#0284c7');
    }

    public function test_direct_login_mode_redirects_root_to_login(): void
    {
        Setting::set('landing_page_mode', 'direct_login');

        $response = $this->get('/');

        $response->assertRedirect(route('login'));
    }

    public function test_branding_service_generates_valid_css_variables(): void
    {
        Setting::set('theme_primary_color', '#4f46e5');

        $service = app(BrandingService::class);
        $css = $service->generateCssVariables();

        $this->assertStringContainsString('--color-primary-50:', $css);
        $this->assertStringContainsString('--color-primary-600: 79 70 229;', $css);
        $this->assertStringContainsString('--color-accent-600:', $css);
    }
}
