<?php

namespace Tests\Feature\Security;

use App\Models\PaymentSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PhaseTwoSecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_secrets_are_encrypted_at_rest(): void
    {
        $setting = PaymentSetting::create([
            'default_gateway' => 'cash',
            'midtrans_server_key' => 'server-secret',
            'midtrans_client_key' => 'client-key',
            'xendit_secret_key' => 'xendit-secret',
            'xendit_public_key' => 'public-key',
            'xendit_callback_token' => 'callback-secret',
        ]);

        $raw = DB::table('payment_settings')->where('id', $setting->id)->first();

        $this->assertNotSame('server-secret', $raw->midtrans_server_key);
        $this->assertNotSame('client-key', $raw->midtrans_client_key);
        $this->assertNotSame('xendit-secret', $raw->xendit_secret_key);
        $this->assertNotSame('public-key', $raw->xendit_public_key);
        $this->assertNotSame('callback-secret', $raw->xendit_callback_token);
    }

    public function test_payment_settings_page_does_not_expose_plaintext_secrets(): void
    {
        Permission::firstOrCreate(['name' => 'payment-settings-access', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->givePermissionTo('payment-settings-access');

        PaymentSetting::create([
            'default_gateway' => 'cash',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-secret',
            'midtrans_client_key' => 'client-key',
            'xendit_enabled' => true,
            'xendit_secret_key' => 'xendit-secret',
            'xendit_callback_token' => 'callback-secret',
            'xendit_public_key' => 'public-key',
        ]);

        $response = $this->actingAs($user)->get(route('settings.payments.edit'));

        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Settings/Payment')
            ->missing('setting.midtrans_server_key')
            ->missing('setting.midtrans_client_key')
            ->missing('setting.xendit_secret_key')
            ->missing('setting.xendit_public_key')
            ->missing('setting.xendit_callback_token')
            ->where('paymentSettingSources.midtrans_server_key.configured', true)
            ->where('paymentSettingSources.midtrans_client_key.configured', true)
            ->where('paymentSettingSources.xendit_secret_key.configured', true)
            ->where('paymentSettingSources.xendit_public_key.configured', true)
        );
    }

    public function test_env_override_takes_precedence_over_database_secret(): void
    {
        config()->set('services.midtrans.server_key', 'env-server-key');
        config()->set('services.midtrans.client_key', 'env-client-key');
        config()->set('services.xendit.secret_key', 'env-xendit-secret');
        config()->set('services.xendit.public_key', 'env-public-key');
        config()->set('services.xendit.callback_token', 'env-callback-token');

        $setting = PaymentSetting::create([
            'default_gateway' => 'cash',
            'midtrans_server_key' => 'database-server-key',
            'midtrans_client_key' => 'database-client-key',
            'xendit_secret_key' => 'database-xendit-secret',
            'xendit_public_key' => 'database-public-key',
            'xendit_callback_token' => 'database-callback-token',
        ]);

        $this->assertSame('env-server-key', $setting->midtransConfig()['server_key']);
        $this->assertSame('env-client-key', $setting->midtransConfig()['client_key']);
        $this->assertSame('env-xendit-secret', $setting->xenditConfig()['secret_key']);
        $this->assertSame('env-public-key', $setting->xenditConfig()['public_key']);
        $this->assertSame('env-callback-token', $setting->xenditConfig()['callback_token']);
        $this->assertSame('env', $setting->paymentSettingSources()['midtrans_server_key']['source']);
        $this->assertSame('env', $setting->paymentSettingSources()['midtrans_client_key']['source']);
    }

    public function test_updating_payment_settings_preserves_existing_keys_when_blank(): void
    {
        Permission::firstOrCreate(['name' => 'payment-settings-access', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'payment-settings-update', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->givePermissionTo(['payment-settings-access', 'payment-settings-update']);

        $setting = PaymentSetting::create([
            'default_gateway' => 'cash',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'initial-server-key',
            'midtrans_client_key' => 'initial-client-key',
            'xendit_enabled' => false,
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($user)
            ->put(route('settings.payments.update'), [
                'default_gateway' => 'cash',
                'bank_transfer_enabled' => false,
                'midtrans_enabled' => true,
                'midtrans_server_key' => '',
                'midtrans_client_key' => '',
                'midtrans_production' => false,
                'xendit_enabled' => false,
                'qrisly_enabled' => false,
            ]);

        $response->assertRedirect(route('settings.payments.edit'));
        $setting->refresh();

        $this->assertSame('initial-server-key', $setting->resolvedSecret('midtrans_server_key'));
        $this->assertSame('initial-client-key', $setting->resolvedSecret('midtrans_client_key'));
    }
}
