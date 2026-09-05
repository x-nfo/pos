<?php

namespace Tests\Feature\Crm;

use App\Models\Customer;
use App\Models\CustomerCampaign;
use App\Models\CustomerCampaignLog;
use App\Models\CustomerSegment;
use App\Models\Receivable;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CrmCoreTest extends TestCase
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

    public function test_user_can_create_manual_segment_and_assign_it_to_customer(): void
    {
        $user = $this->createUserWithPermissions([
            'customer-segments-create',
            'customers-edit',
        ]);
        $customer = $this->createCustomer([
            'name' => 'Customer Segment Manual',
            'no_telp' => '628111000001',
        ]);

        $this->actingAs($user)
            ->post(route('customer-segments.store'), [
                'name' => 'VIP Offline',
                'type' => CustomerSegment::TYPE_MANUAL,
                'is_active' => true,
                'description' => 'Tag manual untuk pelanggan prioritas.',
            ])
            ->assertRedirect(route('customer-segments.index'));

        $segment = CustomerSegment::query()->where('slug', 'vip-offline')->firstOrFail();

        $this->actingAs($user)
            ->put(route('customers.segments.sync', $customer), [
                'segment_ids' => [$segment->id],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('customer_segment_memberships', [
            'customer_id' => $customer->id,
            'customer_segment_id' => $segment->id,
            'source' => 'manual',
        ]);
    }

    public function test_crm_generate_reminders_command_syncs_auto_segments_and_creates_reminder_campaigns(): void
    {
        $today = now()->startOfDay();
        $inactiveHighSpender = $this->createCustomer([
            'name' => 'High Spender Inactive',
            'no_telp' => '628111000002',
            'loyalty_total_spent' => 2000000,
            'loyalty_transaction_count' => 8,
            'last_purchase_at' => $today->copy()->subDays(31),
        ]);
        $frequentBuyer = $this->createCustomer([
            'name' => 'Frequent Buyer',
            'no_telp' => '628111000003',
            'loyalty_total_spent' => 500000,
            'loyalty_transaction_count' => 7,
            'last_purchase_at' => $today->copy()->subDays(10),
        ]);
        $creditCustomer = $this->createCustomer([
            'name' => 'Credit Customer',
            'no_telp' => '628111000004',
            'loyalty_total_spent' => 700000,
            'loyalty_transaction_count' => 2,
            'last_purchase_at' => $today->copy()->subDays(5),
        ]);
        $dueSoonCustomer = $this->createCustomer([
            'name' => 'Due Soon Customer',
            'no_telp' => '628111000005',
            'loyalty_total_spent' => 300000,
            'loyalty_transaction_count' => 1,
            'last_purchase_at' => $today->copy()->subDays(2),
        ]);

        $overdueReceivable = Receivable::create([
            'customer_id' => $creditCustomer->id,
            'invoice' => 'RCV-OVERDUE-001',
            'total' => 150000,
            'paid' => 0,
            'due_date' => $today->copy()->subDay(),
            'status' => 'unpaid',
        ]);
        $dueSoonReceivable = Receivable::create([
            'customer_id' => $dueSoonCustomer->id,
            'invoice' => 'RCV-DUESOON-001',
            'total' => 175000,
            'paid' => 0,
            'due_date' => $today->copy()->addDays(2),
            'status' => 'unpaid',
        ]);

        $this->artisan('crm:generate-reminders')
            ->assertExitCode(0);

        $highSpender = CustomerSegment::query()->where('slug', 'high_spender')->firstOrFail();
        $frequent = CustomerSegment::query()->where('slug', 'frequent_buyer')->firstOrFail();
        $inactive = CustomerSegment::query()->where('slug', 'inactive_customer')->firstOrFail();
        $credit = CustomerSegment::query()->where('slug', 'credit_customer')->firstOrFail();
        $overdue = CustomerSegment::query()->where('slug', 'overdue_customer')->firstOrFail();

        $this->assertDatabaseHas('customer_segment_memberships', [
            'customer_id' => $inactiveHighSpender->id,
            'customer_segment_id' => $highSpender->id,
            'source' => 'auto',
        ]);
        $this->assertDatabaseHas('customer_segment_memberships', [
            'customer_id' => $inactiveHighSpender->id,
            'customer_segment_id' => $inactive->id,
            'source' => 'auto',
        ]);
        $this->assertDatabaseHas('customer_segment_memberships', [
            'customer_id' => $frequentBuyer->id,
            'customer_segment_id' => $frequent->id,
            'source' => 'auto',
        ]);
        $this->assertDatabaseHas('customer_segment_memberships', [
            'customer_id' => $creditCustomer->id,
            'customer_segment_id' => $credit->id,
            'source' => 'auto',
        ]);
        $this->assertDatabaseHas('customer_segment_memberships', [
            'customer_id' => $creditCustomer->id,
            'customer_segment_id' => $overdue->id,
            'source' => 'auto',
        ]);

        $this->assertDatabaseHas('customer_campaigns', [
            'context_key' => 'due-soon-'.$today->toDateString(),
            'type' => CustomerCampaign::TYPE_DUE_DATE_REMINDER,
        ]);
        $this->assertDatabaseHas('customer_campaigns', [
            'context_key' => 'overdue-'.$today->toDateString(),
            'type' => CustomerCampaign::TYPE_DUE_DATE_REMINDER,
        ]);
        $this->assertDatabaseHas('customer_campaigns', [
            'context_key' => 'repeat-order-'.$today->toDateString(),
            'type' => CustomerCampaign::TYPE_REPEAT_ORDER_REMINDER,
        ]);

        $this->assertDatabaseHas('customer_campaign_logs', [
            'customer_id' => $creditCustomer->id,
            'receivable_id' => $overdueReceivable->id,
            'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
        ]);
        $this->assertDatabaseHas('customer_campaign_logs', [
            'customer_id' => $dueSoonCustomer->id,
            'receivable_id' => $dueSoonReceivable->id,
            'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
        ]);
        $this->assertDatabaseHas('customer_campaign_logs', [
            'customer_id' => $inactiveHighSpender->id,
            'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
        ]);
    }

    public function test_transaction_share_campaign_is_idempotent(): void
    {
        $user = $this->createUserWithPermissions([
            'crm-campaigns-create',
        ]);
        $customer = $this->createCustomer([
            'name' => 'Customer Share Invoice',
            'no_telp' => '628111000006',
        ]);
        $transaction = Transaction::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'cashier_id' => $user->id,
            'customer_id' => $customer->id,
            'invoice' => 'TRX-CRM-001',
            'cash' => 150000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 150000,
        ]);

        $this->actingAs($user)
            ->post(route('transactions.share-campaign', $transaction))
            ->assertRedirect();

        $this->actingAs($user)
            ->post(route('transactions.share-campaign', $transaction))
            ->assertRedirect();

        $this->assertSame(
            1,
            CustomerCampaign::query()
                ->where('context_key', 'invoice-share-transaction-'.$transaction->id)
                ->count()
        );
        $this->assertSame(
            1,
            CustomerCampaignLog::query()
                ->where('transaction_id', $transaction->id)
                ->count()
        );
    }

    public function test_crm_generate_reminders_uses_custom_template_and_replaces_placeholders(): void
    {
        $today = now()->startOfDay();
        Setting::set('store_name', 'Toko Berkah POS');
        Setting::set(
            'wa_template_due_soon',
            'Halo {{customer_name}}, tagihan {{invoice}} sebesar Rp {{remaining}} di {{store_name}} jatuh tempo pada {{due_date}}.'
        );

        $customer = $this->createCustomer([
            'name' => 'Ahmad Subagyo',
            'no_telp' => '628123456789',
        ]);

        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'RCV-TPL-001',
            'total' => 350000,
            'paid' => 100000,
            'due_date' => $today->copy()->addDays(2),
            'status' => 'partial',
        ]);

        $this->artisan('crm:generate-reminders')->assertExitCode(0);

        $log = CustomerCampaignLog::query()
            ->where('receivable_id', $receivable->id)
            ->firstOrFail();

        $expectedMessage = 'Halo Ahmad Subagyo, tagihan RCV-TPL-001 sebesar Rp 250.000 di Toko Berkah POS jatuh tempo pada '.$today->copy()->addDays(2)->format('d/m/Y').'.';
        $this->assertEquals($expectedMessage, $log->payload['message']);
        $this->assertEquals(CustomerCampaignLog::STATUS_READY_TO_SEND, $log->status);
    }

    public function test_crm_generate_reminders_auto_dispatches_via_whatsapp_gateway_when_enabled(): void
    {
        $today = now()->startOfDay();
        Setting::set('wa_service_url', 'http://localhost:3001');
        Setting::set('wa_enabled', '1');
        Setting::set('wa_receivable_reminder_mode', 'auto');
        Setting::set('wa_auto_reminder', '1');

        $mockWhatsApp = \Mockery::mock(WhatsAppService::class);
        $mockWhatsApp->shouldReceive('status')->andReturn(['connected' => true, 'phone' => '628123456789']);
        $mockWhatsApp->shouldReceive('send')
            ->once()
            ->with('6281999888777', \Mockery::type('string'))
            ->andReturn(true);
        $this->app->instance(WhatsAppService::class, $mockWhatsApp);

        $customer = $this->createCustomer([
            'name' => 'Dewi Lestari',
            'no_telp' => '6281999888777',
        ]);

        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'RCV-AUTO-001',
            'total' => 200000,
            'paid' => 0,
            'due_date' => $today->copy()->addDays(1),
            'status' => 'unpaid',
        ]);

        $this->artisan('crm:generate-reminders')->assertExitCode(0);

        $log = CustomerCampaignLog::query()
            ->where('receivable_id', $receivable->id)
            ->firstOrFail();

        $this->assertEquals(CustomerCampaignLog::STATUS_SENT, $log->status);
        $this->assertNotNull($log->sent_at);
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
            'name' => 'Customer CRM',
            'no_telp' => '628111999999',
            'address' => 'Jl. CRM Test',
            'loyalty_total_spent' => 0,
            'loyalty_transaction_count' => 0,
            ...$attributes,
        ]);
    }
}
