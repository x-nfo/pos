<?php

namespace Tests\Feature\Settings;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class WhatsappSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['whatsapp-settings-access', 'whatsapp-settings-update', 'crm-campaigns-access', 'crm-campaigns-update', 'dashboard-access'] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_admin_can_access_whatsapp_settings_page(): void
    {
        $admin = $this->createAdminUser();

        Setting::set('wa_service_url', 'http://localhost:3001');
        Setting::set('wa_enabled', '1');

        $response = $this->actingAs($admin)->get(route('settings.whatsapp'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Settings/Whatsapp')
                ->where('settings.wa_service_url', 'http://localhost:3001')
                ->where('settings.wa_enabled', true)
            );
    }

    public function test_admin_can_update_whatsapp_settings(): void
    {
        $admin = $this->createAdminUser();

        $response = $this->actingAs($admin)
            ->post(route('settings.whatsapp.update'), [
                'wa_service_url' => 'http://127.0.0.1:3001',
                'wa_enabled' => true,
            ]);

        $response->assertRedirect();

        $this->assertEquals('http://127.0.0.1:3001', Setting::get('wa_service_url'));
        $this->assertTrue(Setting::getBool('wa_enabled'));
    }

    public function test_admin_can_access_and_update_automation_settings(): void
    {
        $admin = $this->createAdminUser();

        $response = $this->actingAs($admin)->get(route('crm-campaigns.index'));
        $response->assertOk();

        $updateResponse = $this->actingAs($admin)
            ->post(route('crm-campaigns.automation.update'), [
                'wa_auto_invoice' => true,
                'wa_receivable_reminder_mode' => 'auto',
                'wa_reminder_schedule_time' => '08:30',
                'wa_template_due_soon' => 'Pengingat {{customer_name}}, tagihan {{invoice}} sebesar Rp {{remaining}} jatuh tempo {{due_date}}.',
                'wa_template_overdue' => 'Pemberitahuan {{customer_name}}, tagihan {{invoice}} telah melewati jatuh tempo {{due_date}}.',
            ]);

        $updateResponse->assertRedirect();

        $this->assertTrue(Setting::getBool('wa_auto_invoice'));
        $this->assertTrue(Setting::getBool('wa_auto_reminder'));
        $this->assertEquals('auto', Setting::get('wa_receivable_reminder_mode'));
        $this->assertEquals('08:30', Setting::get('wa_reminder_schedule_time'));
        $this->assertEquals(
            'Pengingat {{customer_name}}, tagihan {{invoice}} sebesar Rp {{remaining}} jatuh tempo {{due_date}}.',
            Setting::get('wa_template_due_soon')
        );
        $this->assertEquals(
            'Pemberitahuan {{customer_name}}, tagihan {{invoice}} telah melewati jatuh tempo {{due_date}}.',
            Setting::get('wa_template_overdue')
        );
    }

    public function test_admin_can_switch_reminder_mode_to_manual(): void
    {
        $admin = $this->createAdminUser();

        $response = $this->actingAs($admin)
            ->post(route('crm-campaigns.automation.update'), [
                'wa_receivable_reminder_mode' => 'manual',
                'wa_template_due_soon' => 'Template due soon',
                'wa_template_overdue' => 'Template overdue',
            ]);

        $response->assertRedirect();

        $this->assertEquals('manual', Setting::get('wa_receivable_reminder_mode'));
        $this->assertFalse(Setting::getBool('wa_auto_reminder'));
    }

    private function createAdminUser(): User
    {
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->givePermissionTo(['whatsapp-settings-access', 'whatsapp-settings-update', 'crm-campaigns-access', 'crm-campaigns-update', 'dashboard-access']);

        $admin = User::factory()->create();
        $admin->assignRole($adminRole);

        return $admin;
    }
}
