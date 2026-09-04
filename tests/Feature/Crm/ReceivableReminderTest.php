<?php

namespace Tests\Feature\Crm;

use App\Jobs\SendWhatsAppCampaignLogJob;
use App\Models\Customer;
use App\Models\CustomerCampaignLog;
use App\Models\Receivable;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ReceivableReminderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'receivables-access',
            'receivables-pay',
            'receivables-approve',
            'crm-campaigns-access',
            'crm-campaigns-create',
            'crm-campaigns-update',
            'crm-campaigns-delete',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_receivable_show_loads_campaign_logs_and_default_reminder_message(): void
    {
        $user = $this->createUserWithPermissions(['receivables-access', 'crm-campaigns-access']);

        $customer = Customer::create([
            'name' => 'Budi Santoso',
            'no_telp' => '081234567890',
            'address' => 'Jl. Merdeka No. 1',
        ]);

        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'RCV-TEST-001',
            'total' => 500000,
            'paid' => 100000,
            'due_date' => now()->addDays(2),
            'status' => 'partial',
        ]);

        $response = $this->actingAs($user)->get(route('receivables.show', $receivable));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Receivables/Show')
            ->has('receivable.campaign_logs')
            ->has('defaultReminderMessage')
            ->where('isOverdue', false)
            ->where('receivable.invoice', 'RCV-TEST-001')
        );
    }

    public function test_share_receivable_with_direct_dispatch_pushes_whatsapp_queue_and_redirects_back(): void
    {
        Queue::fake([SendWhatsAppCampaignLogJob::class]);

        Setting::set('wa_enabled', '1');
        Setting::set('wa_service_url', 'http://localhost:3001');

        $user = $this->createUserWithPermissions(['receivables-access', 'crm-campaigns-create']);

        $customer = Customer::create([
            'name' => 'Siti Nurhaliza',
            'no_telp' => '085712345678',
            'address' => 'Jl. Mawar No. 12',
        ]);

        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'RCV-TEST-002',
            'total' => 750000,
            'paid' => 0,
            'due_date' => now()->subDays(1),
            'status' => 'unpaid',
        ]);

        $customMessage = 'Halo Ibu Siti, mohon konfirmasi tagihan RCV-TEST-002 senilai Rp 750.000.';

        $response = $this->actingAs($user)
            ->from(route('receivables.show', $receivable))
            ->post(route('receivables.share-campaign', $receivable), [
                'direct_dispatch' => true,
                'message' => $customMessage,
            ]);

        $response->assertRedirect(route('receivables.show', $receivable));
        $response->assertSessionHas('success', 'Pesan pengingat piutang berhasil dimasukkan ke antrean pengiriman WhatsApp.');

        Queue::assertPushed(SendWhatsAppCampaignLogJob::class, function (SendWhatsAppCampaignLogJob $job) use ($receivable) {
            return $job->log->receivable_id === $receivable->id;
        });

        $log = CustomerCampaignLog::query()
            ->where('receivable_id', $receivable->id)
            ->firstOrFail();

        $this->assertEquals('6285712345678', $log->payload['phone']);
        $this->assertEquals($customMessage, $log->payload['message']);
        $this->assertStringContainsString('https://wa.me/6285712345678?text=', $log->payload['whatsapp_url']);
    }

    public function test_share_receivable_via_inertia_stays_on_page(): void
    {
        $user = $this->createUserWithPermissions(['receivables-access', 'crm-campaigns-create']);

        $customer = Customer::create([
            'name' => 'Agus Setiawan',
            'no_telp' => '081399887766',
            'address' => 'Jl. Flamboyan No. 5',
        ]);

        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'RCV-TEST-003',
            'total' => 300000,
            'paid' => 0,
            'due_date' => now()->addDays(3),
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($user)
            ->from(route('receivables.show', $receivable))
            ->withHeaders(['X-Inertia' => 'true'])
            ->post(route('receivables.share-campaign', $receivable));

        $response->assertRedirect(route('receivables.show', $receivable));
        $response->assertSessionHas('success', 'Draft pengingat piutang berhasil disiapkan.');
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo($permissions);

        return $user;
    }
}
