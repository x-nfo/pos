<?php

namespace Tests\Feature\Settings;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PrinterSettingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_access_printer_settings_page(): void
    {
        $perm = Permission::firstOrCreate(['name' => 'printer-settings-access']);
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->givePermissionTo($perm);
        $admin = User::factory()->create();
        $admin->assignRole($adminRole);

        Setting::set('printer_auto_print', '1');
        Setting::set('printer_paper_size', '58mm');
        Setting::set('printer_driver', 'bluetooth');

        $response = $this->actingAs($admin)->get(route('settings.printer'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Settings/Printer')
                ->where('settings.printer_auto_print', true)
                ->where('settings.printer_paper_size', '58mm')
                ->where('settings.printer_driver', 'bluetooth')
            );
    }

    public function test_admin_can_update_printer_driver_settings(): void
    {
        $perm = Permission::firstOrCreate(['name' => 'printer-settings-update']);
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $adminRole->givePermissionTo($perm);
        $admin = User::factory()->create();
        $admin->assignRole($adminRole);

        $response = $this->actingAs($admin)
            ->post(route('settings.printer.update'), [
                'printer_auto_print' => true,
                'printer_paper_size' => '80mm',
                'printer_driver' => 'bluetooth',
                'printer_enable_bluetooth' => true,
                'printer_enable_webusb' => false,
                'printer_enable_server' => false,
                'printer_enable_pdf_receipt' => true,
                'printer_enable_pdf_invoice' => false,
            ]);

        $response->assertRedirect();

        $this->assertTrue(Setting::getBool('printer_auto_print'));
        $this->assertEquals('80mm', Setting::get('printer_paper_size'));
        $this->assertEquals('bluetooth', Setting::get('printer_driver'));
        $this->assertTrue(Setting::getBool('printer_enable_bluetooth'));
        $this->assertFalse(Setting::getBool('printer_enable_webusb'));
        $this->assertFalse(Setting::getBool('printer_enable_server'));
        $this->assertTrue(Setting::getBool('printer_enable_pdf_receipt'));
        $this->assertFalse(Setting::getBool('printer_enable_pdf_invoice'));
    }
}
