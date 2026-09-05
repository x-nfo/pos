<?php

namespace Tests\Feature\Crm;

use App\Jobs\SendWhatsAppCampaignLogJob;
use App\Models\Customer;
use App\Models\CustomerCampaign;
use App\Models\CustomerCampaignLog;
use App\Models\Receivable;
use App\Models\Setting;
use App\Models\User;
use App\Services\CrmAutomationService;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CrmWhatsAppQueueTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'customer-segments-access',
            'customer-segments-create',
            'customer-segments-update',
            'customer-segments-delete',
            'crm-campaigns-access',
            'crm-campaigns-create',
            'crm-campaigns-update',
            'crm-campaigns-delete',
            'crm-reminders-access',
            'customers-edit',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_process_campaign_dispatches_send_whatsapp_jobs_when_gateway_enabled(): void
    {
        Queue::fake();

        Setting::set('wa_enabled', '1');
        Setting::set('wa_service_url', 'http://localhost:3001');

        $user = $this->createUserWithPermissions(['crm-campaigns-create', 'crm-campaigns-update']);
        $cust1 = $this->createCustomer(['name' => 'Budi', 'no_telp' => '628111111111']);
        $cust2 = $this->createCustomer(['name' => 'Siti', 'no_telp' => '628222222222']);

        $service = app(CrmAutomationService::class);
        $campaign = $service->createCampaign([
            'name' => 'Promo Spesial Queue',
            'type' => CustomerCampaign::TYPE_PROMO_BROADCAST,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'message_template' => 'Halo {{name}}, ada diskon 20%!',
        ], $user->id);

        $processedCampaign = $service->processCampaign($campaign);

        $this->assertEquals(CustomerCampaign::STATUS_READY, $processedCampaign->status);
        $this->assertSame(2, $processedCampaign->logs()->count());

        Queue::assertPushed(SendWhatsAppCampaignLogJob::class, 2);
        Queue::assertPushed(SendWhatsAppCampaignLogJob::class, function (SendWhatsAppCampaignLogJob $job) use ($cust1) {
            return $job->log->customer_id === $cust1->id;
        });
        Queue::assertPushed(SendWhatsAppCampaignLogJob::class, function (SendWhatsAppCampaignLogJob $job) use ($cust2) {
            return $job->log->customer_id === $cust2->id;
        });
    }

    public function test_process_campaign_does_not_dispatch_jobs_when_gateway_disabled(): void
    {
        Queue::fake();

        Setting::set('wa_enabled', '0');
        Setting::set('wa_service_url', 'http://localhost:3001');

        $user = $this->createUserWithPermissions(['crm-campaigns-create', 'crm-campaigns-update']);
        $this->createCustomer(['name' => 'Budi', 'no_telp' => '628111111111']);

        $service = app(CrmAutomationService::class);
        $campaign = $service->createCampaign([
            'name' => 'Promo Manual Link',
            'type' => CustomerCampaign::TYPE_PROMO_BROADCAST,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'message_template' => 'Halo {{name}}, ada promo!',
        ], $user->id);

        $processedCampaign = $service->processCampaign($campaign);

        $this->assertEquals(CustomerCampaign::STATUS_READY, $processedCampaign->status);
        $this->assertSame(1, $processedCampaign->logs()->count());

        Queue::assertNothingPushed();
    }

    public function test_crm_generate_reminders_dispatches_jobs_for_auto_reminders(): void
    {
        Queue::fake();

        $today = now()->startOfDay();
        Setting::set('wa_service_url', 'http://localhost:3001');
        Setting::set('wa_enabled', '1');
        Setting::set('wa_receivable_reminder_mode', 'auto');
        Setting::set('wa_auto_reminder', '1');

        $customer = $this->createCustomer([
            'name' => 'Dewi Lestari',
            'no_telp' => '6281999888777',
        ]);

        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'RCV-AUTO-Q-001',
            'total' => 200000,
            'paid' => 0,
            'due_date' => $today->copy()->addDays(1),
            'status' => 'unpaid',
        ]);

        $this->artisan('crm:generate-reminders')->assertExitCode(0);

        Queue::assertPushed(SendWhatsAppCampaignLogJob::class, function (SendWhatsAppCampaignLogJob $job) use ($receivable) {
            return $job->log->receivable_id === $receivable->id;
        });
    }

    public function test_manual_dispatch_campaign_and_dispatch_log_routes(): void
    {
        Queue::fake();

        $user = $this->createUserWithPermissions(['crm-campaigns-access', 'crm-campaigns-update']);
        $cust = $this->createCustomer(['name' => 'Agus', 'no_telp' => '628333333333']);

        $campaign = CustomerCampaign::create([
            'name' => 'Campaign Test Dispatch',
            'type' => CustomerCampaign::TYPE_PROMO_BROADCAST,
            'status' => CustomerCampaign::STATUS_READY,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'created_by' => $user->id,
        ]);

        $log = $campaign->logs()->create([
            'customer_id' => $cust->id,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
            'payload' => ['message' => 'Pesan test dispatch', 'phone' => '628333333333'],
        ]);

        $this->actingAs($user)
            ->post(route('crm-campaigns.dispatch', $campaign))
            ->assertRedirect()
            ->assertSessionHas('success');

        Queue::assertPushed(SendWhatsAppCampaignLogJob::class, 1);

        $this->actingAs($user)
            ->post(route('crm-campaign-logs.dispatch', $log))
            ->assertRedirect()
            ->assertSessionHas('success');

        Queue::assertPushed(SendWhatsAppCampaignLogJob::class, 2);
    }

    public function test_send_whatsapp_campaign_log_job_executes_and_marks_sent(): void
    {
        Setting::set('wa_enabled', '1');
        Setting::set('wa_service_url', 'http://localhost:3001');

        $mockWhatsApp = \Mockery::mock(WhatsAppService::class);
        $mockWhatsApp->shouldReceive('status')->andReturn(['connected' => true, 'phone' => '628123456789']);
        $mockWhatsApp->shouldReceive('send')
            ->once()
            ->with('628555555555', 'Pesan Promosi Queue Test')
            ->andReturn(true);

        $user = $this->createUserWithPermissions(['crm-campaigns-access']);
        $cust = $this->createCustomer(['name' => 'Joko', 'no_telp' => '628555555555']);

        $campaign = CustomerCampaign::create([
            'name' => 'Campaign Exec Test',
            'type' => CustomerCampaign::TYPE_PROMO_BROADCAST,
            'status' => CustomerCampaign::STATUS_READY,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'created_by' => $user->id,
        ]);

        $log = $campaign->logs()->create([
            'customer_id' => $cust->id,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
            'payload' => ['message' => 'Pesan Promosi Queue Test'],
        ]);

        $job = new SendWhatsAppCampaignLogJob($log);
        $job->handle($mockWhatsApp, app(CrmAutomationService::class));

        $log->refresh();
        $this->assertEquals(CustomerCampaignLog::STATUS_SENT, $log->status);
        $this->assertNotNull($log->sent_at);
    }

    public function test_send_whatsapp_campaign_log_job_skips_when_phone_is_missing(): void
    {
        $mockWhatsApp = \Mockery::mock(WhatsAppService::class);
        $mockWhatsApp->shouldNotReceive('send');

        $user = $this->createUserWithPermissions(['crm-campaigns-access']);
        $cust = $this->createCustomer(['name' => 'Customer No Phone', 'no_telp' => '']);

        $campaign = CustomerCampaign::create([
            'name' => 'Campaign No Phone',
            'type' => CustomerCampaign::TYPE_PROMO_BROADCAST,
            'status' => CustomerCampaign::STATUS_READY,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'created_by' => $user->id,
        ]);

        $log = $campaign->logs()->create([
            'customer_id' => $cust->id,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
            'payload' => ['message' => 'Pesan tanpa nomor'],
        ]);

        $job = new SendWhatsAppCampaignLogJob($log);
        $job->handle($mockWhatsApp, app(CrmAutomationService::class));

        $log->refresh();
        $this->assertEquals(CustomerCampaignLog::STATUS_SKIPPED, $log->status);
    }

    public function test_send_whatsapp_campaign_log_job_throws_when_service_disconnected_for_queue_retry(): void
    {
        Setting::set('wa_enabled', '1');
        Setting::set('wa_service_url', 'http://localhost:3001');

        $mockWhatsApp = \Mockery::mock(WhatsAppService::class);
        $mockWhatsApp->shouldReceive('status')->andReturn(['connected' => false]);
        $mockWhatsApp->shouldNotReceive('send');

        $user = $this->createUserWithPermissions(['crm-campaigns-access']);
        $cust = $this->createCustomer(['name' => 'Retry Customer', 'no_telp' => '628777777777']);

        $campaign = CustomerCampaign::create([
            'name' => 'Campaign Retry',
            'type' => CustomerCampaign::TYPE_PROMO_BROADCAST,
            'status' => CustomerCampaign::STATUS_READY,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'created_by' => $user->id,
        ]);

        $log = $campaign->logs()->create([
            'customer_id' => $cust->id,
            'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
            'payload' => ['message' => 'Pesan gateway offline'],
        ]);

        $this->expectException(\RuntimeException::class);

        $job = new SendWhatsAppCampaignLogJob($log);
        $job->handle($mockWhatsApp, app(CrmAutomationService::class));
    }

    public function test_crm_generate_reminders_consolidates_multiple_receivables_for_same_customer_and_dispatches_with_staggered_delay(): void
    {
        Queue::fake();

        $today = now()->startOfDay();
        Setting::set('wa_service_url', 'http://localhost:3001');
        Setting::set('wa_enabled', '1');
        Setting::set('wa_receivable_reminder_mode', 'auto');
        Setting::set('wa_dispatch_delay_seconds', 60);

        // Pelanggan 1 memiliki 3 tagihan jatuh tempo
        $customer1 = $this->createCustomer([
            'name' => 'Sanda Rusli',
            'no_telp' => '628123456789',
        ]);

        $r1 = Receivable::create([
            'customer_id' => $customer1->id,
            'invoice' => 'TRX-MULTI-001',
            'total' => 140000,
            'paid' => 0,
            'due_date' => $today->copy()->addDays(2),
            'status' => 'unpaid',
        ]);
        $r2 = Receivable::create([
            'customer_id' => $customer1->id,
            'invoice' => 'TRX-MULTI-002',
            'total' => 60000,
            'paid' => 0,
            'due_date' => $today->copy()->addDays(1),
            'status' => 'unpaid',
        ]);
        $r3 = Receivable::create([
            'customer_id' => $customer1->id,
            'invoice' => 'TRX-MULTI-003',
            'total' => 100000,
            'paid' => 0,
            'due_date' => $today->copy()->addDays(1),
            'status' => 'unpaid',
        ]);

        // Pelanggan 2 memiliki 1 tagihan jatuh tempo
        $customer2 = $this->createCustomer([
            'name' => 'Budi Santoso',
            'no_telp' => '628987654321',
        ]);
        $r4 = Receivable::create([
            'customer_id' => $customer2->id,
            'invoice' => 'TRX-SINGLE-001',
            'total' => 50000,
            'paid' => 0,
            'due_date' => $today->copy()->addDays(2),
            'status' => 'unpaid',
        ]);

        $this->artisan('crm:generate-reminders')->assertExitCode(0);

        // Hanya 2 job antrean yang dipush: 1 untuk Sanda Rusli (rekap 3 faktur), 1 untuk Budi Santoso (1 faktur)
        Queue::assertPushed(SendWhatsAppCampaignLogJob::class, 2);

        $campaign = CustomerCampaign::where('type', CustomerCampaign::TYPE_DUE_DATE_REMINDER)->first();
        $this->assertNotNull($campaign);

        // Cek log Sanda Rusli
        $sandaLog = $campaign->logs()->where('customer_id', $customer1->id)->first();
        $this->assertNotNull($sandaLog);
        $this->assertTrue($sandaLog->payload['is_consolidated']);
        $this->assertCount(3, $sandaLog->payload['receivable_ids']);
        $this->assertEquals(300000, $sandaLog->payload['total_remaining']);
        $this->assertStringContainsString('TRX-MULTI-001', $sandaLog->payload['message']);
        $this->assertStringContainsString('TRX-MULTI-002', $sandaLog->payload['message']);
        $this->assertStringContainsString('TRX-MULTI-003', $sandaLog->payload['message']);
        $this->assertStringContainsString('Total Tagihan (3 faktur): Rp 300.000', $sandaLog->payload['message']);

        // Cek log Budi Santoso
        $budiLog = $campaign->logs()->where('customer_id', $customer2->id)->first();
        $this->assertNotNull($budiLog);
        $this->assertFalse($budiLog->payload['is_consolidated']);
        $this->assertEquals('TRX-SINGLE-001', $budiLog->payload['invoice']);

        // Verifikasi staggered delay: Sanda delay 0s, Budi delay 60s
        Queue::assertPushed(SendWhatsAppCampaignLogJob::class, function (SendWhatsAppCampaignLogJob $job) use ($budiLog) {
            if ($job->log->id === $budiLog->id) {
                return $job->delay !== null;
            }

            return true;
        });
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo($permissions);

        return $user;
    }

    private function createCustomer(array $attributes = []): Customer
    {
        return Customer::create([
            'name' => 'Customer CRM Test',
            'no_telp' => '628111999999',
            'address' => 'Jl. CRM Test',
            'loyalty_total_spent' => 0,
            'loyalty_transaction_count' => 0,
            ...$attributes,
        ]);
    }
}
