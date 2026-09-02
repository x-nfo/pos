<?php

namespace Tests\Feature\Receivable;

use App\Models\Customer;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ReceivableAgingTest extends TestCase
{
    use RefreshDatabase;

    protected User $userWithAccess;

    protected User $userWithoutAccess;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate(['name' => 'receivables-access', 'guard_name' => 'web']);

        $this->userWithAccess = User::factory()->create(['email_verified_at' => now()]);
        $this->userWithAccess->givePermissionTo('receivables-access');

        $this->userWithoutAccess = User::factory()->create(['email_verified_at' => now()]);
    }

    public function test_guest_cannot_access_receivables_aging_endpoint(): void
    {
        $response = $this->get(route('receivables.aging'));

        $response->assertRedirect(route('login'));
    }

    public function test_unauthorized_user_cannot_access_receivables_aging_endpoint(): void
    {
        $response = $this->actingAs($this->userWithoutAccess)
            ->get(route('receivables.aging'));

        $response->assertForbidden();
    }

    /**
     * TC-REC-04: Analisis Umur Piutang (Aging Buckets)
     * Faktur umur 15 hari, 40 hari, 75 hari, dan 120 hari tampil akurat di bucket 0-30, 31-60, 61-90, dan >90 Hari.
     */
    public function test_tc_rec_04_aging_buckets_analysis_accurately_categorizes_overdue_invoices_at_15_40_75_and_120_days(): void
    {
        $customer = Customer::create([
            'name' => 'PT Pelanggan Utama',
            'no_telp' => '081234567890',
            'address' => 'Jl. Merdeka No. 10',
        ]);

        // 1. Umur 15 hari (Jatuh tempo 15 hari lalu) -> Bucket 0-30 Hari
        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-REC-15D',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->subDays(15)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        // 2. Umur 40 hari (Jatuh tempo 40 hari lalu) -> Bucket 31-60 Hari
        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-REC-40D',
            'total' => 2000000,
            'paid' => 500000,
            'due_date' => now()->subDays(40)->format('Y-m-d'),
            'status' => 'partial',
        ]);

        // 3. Umur 75 hari (Jatuh tempo 75 hari lalu) -> Bucket 61-90 Hari
        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-REC-75D',
            'total' => 3000000,
            'paid' => 1000000,
            'due_date' => now()->subDays(75)->format('Y-m-d'),
            'status' => 'partial',
        ]);

        // 4. Umur 120 hari (Jatuh tempo 120 hari lalu) -> Bucket >90 Hari (90+)
        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-REC-120D',
            'total' => 4000000,
            'paid' => 0,
            'due_date' => now()->subDays(120)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        // 5. Belum Jatuh Tempo (Current)
        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-REC-CURRENT',
            'total' => 500000,
            'paid' => 0,
            'due_date' => now()->addDays(7)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        // 6. Faktur yang sudah Lunas (Paid) -> tidak masuk hitungan aging piutang tertunggak
        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-REC-PAID',
            'total' => 800000,
            'paid' => 800000,
            'due_date' => now()->subDays(50)->format('Y-m-d'),
            'status' => 'paid',
        ]);

        $response = $this->actingAs($this->userWithAccess)
            ->getJson(route('receivables.aging'));

        $response->assertOk()
            ->assertJsonStructure([
                'aging_summary' => [
                    '*' => [
                        'bucket',
                        'count',
                        'total',
                        'paid',
                        'remaining',
                    ],
                ],
                'top_customers',
                'collection_rate' => [
                    'total_receivables_amount',
                    'total_paid_amount',
                    'collection_rate',
                    'paid_count',
                    'total_count',
                ],
            ]);

        $summary = collect($response->json('aging_summary'))->keyBy('bucket');

        // Verifikasi Bucket 'current'
        $this->assertEquals(1, $summary['current']['count']);
        $this->assertEquals(500000, $summary['current']['total']);
        $this->assertEquals(0, $summary['current']['paid']);
        $this->assertEquals(500000, $summary['current']['remaining']);

        // Verifikasi Bucket '0-30' (Faktur 15 hari)
        $this->assertEquals(1, $summary['0-30']['count']);
        $this->assertEquals(1000000, $summary['0-30']['total']);
        $this->assertEquals(0, $summary['0-30']['paid']);
        $this->assertEquals(1000000, $summary['0-30']['remaining']);

        // Verifikasi Bucket '31-60' (Faktur 40 hari)
        $this->assertEquals(1, $summary['31-60']['count']);
        $this->assertEquals(2000000, $summary['31-60']['total']);
        $this->assertEquals(500000, $summary['31-60']['paid']);
        $this->assertEquals(1500000, $summary['31-60']['remaining']);

        // Verifikasi Bucket '61-90' (Faktur 75 hari)
        $this->assertEquals(1, $summary['61-90']['count']);
        $this->assertEquals(3000000, $summary['61-90']['total']);
        $this->assertEquals(1000000, $summary['61-90']['paid']);
        $this->assertEquals(2000000, $summary['61-90']['remaining']);

        // Verifikasi Bucket '90+' (Faktur 120 hari)
        $this->assertEquals(1, $summary['90+']['count']);
        $this->assertEquals(4000000, $summary['90+']['total']);
        $this->assertEquals(0, $summary['90+']['paid']);
        $this->assertEquals(4000000, $summary['90+']['remaining']);

        // Total Sisa Piutang Tertunggak: 500k + 1000k + 1500k + 2000k + 4000k = 9,000,000
        $totalRemaining = collect($summary)->sum('remaining');
        $this->assertEquals(9000000, $totalRemaining);
    }

    public function test_receivable_model_aging_bucket_accessor_evaluates_correctly(): void
    {
        $customer = Customer::create([
            'name' => 'Pelanggan Budi',
            'no_telp' => '081122334455',
            'address' => 'Jl. Mawar No. 12',
        ]);

        $rCurrent = Receivable::make(['status' => 'unpaid', 'due_date' => now()->addDays(5)]);
        $r15 = Receivable::make(['status' => 'unpaid', 'due_date' => now()->subDays(15)]);
        $r40 = Receivable::make(['status' => 'unpaid', 'due_date' => now()->subDays(40)]);
        $r75 = Receivable::make(['status' => 'unpaid', 'due_date' => now()->subDays(75)]);
        $r120 = Receivable::make(['status' => 'unpaid', 'due_date' => now()->subDays(120)]);
        $rPaid = Receivable::make(['status' => 'paid', 'due_date' => now()->subDays(30)]);
        $rNoDue = Receivable::make(['status' => 'unpaid', 'due_date' => null]);

        $this->assertEquals('current', $rCurrent->aging_bucket);
        $this->assertEquals('0-30', $r15->aging_bucket);
        $this->assertEquals('31-60', $r40->aging_bucket);
        $this->assertEquals('61-90', $r75->aging_bucket);
        $this->assertEquals('90+', $r120->aging_bucket);
        $this->assertEquals('paid', $rPaid->aging_bucket);
        $this->assertEquals('no_due_date', $rNoDue->aging_bucket);
    }

    public function test_receivable_by_aging_bucket_scopes_query_accurately(): void
    {
        $customer = Customer::create([
            'name' => 'Pelanggan Toko Makmur',
            'no_telp' => '081999888777',
            'address' => 'Jl. Melati No. 88',
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-SCOPE-CURRENT',
            'total' => 100000,
            'paid' => 0,
            'due_date' => now()->addDays(10)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-SCOPE-15D',
            'total' => 200000,
            'paid' => 0,
            'due_date' => now()->subDays(15)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-SCOPE-40D',
            'total' => 300000,
            'paid' => 0,
            'due_date' => now()->subDays(40)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-SCOPE-75D',
            'total' => 400000,
            'paid' => 0,
            'due_date' => now()->subDays(75)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-SCOPE-120D',
            'total' => 500000,
            'paid' => 0,
            'due_date' => now()->subDays(120)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        $this->assertEquals(1, Receivable::byAgingBucket('current')->count());
        $this->assertEquals(1, Receivable::byAgingBucket('0-30')->count());
        $this->assertEquals(1, Receivable::byAgingBucket('31-60')->count());
        $this->assertEquals(1, Receivable::byAgingBucket('61-90')->count());
        $this->assertEquals(1, Receivable::byAgingBucket('90+')->count());
    }

    public function test_customer_statement_returns_accurate_statement_with_aging_buckets(): void
    {
        $customer = Customer::create([
            'name' => 'PT Surya Kencana',
            'no_telp' => '087788990011',
            'address' => 'Komp. Ruko No. 5',
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-STMT-01',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->subDays(45)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        $r2 = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-STMT-02',
            'total' => 2000000,
            'paid' => 500000,
            'due_date' => now()->addDays(5)->format('Y-m-d'),
            'status' => 'partial',
        ]);

        ReceivablePayment::create([
            'receivable_id' => $r2->id,
            'paid_at' => now()->format('Y-m-d'),
            'amount' => 500000,
            'method' => 'cash',
            'user_id' => $this->userWithAccess->id,
            'status' => 'approved',
            'approved_by' => $this->userWithAccess->id,
            'approved_at' => now(),
        ]);

        $response = $this->actingAs($this->userWithAccess)
            ->getJson(route('receivables.customer-statement', [
                'customer_id' => $customer->id,
            ]));

        $response->assertOk()
            ->assertJsonStructure([
                'customer',
                'receivables' => [
                    '*' => [
                        'id',
                        'invoice',
                        'total',
                        'paid',
                        'due_date',
                        'aging_bucket',
                    ],
                ],
                'total_outstanding',
                'total_paid',
            ]);

        $this->assertEquals(2500000, $response->json('total_outstanding'));
        $this->assertEquals(500000, $response->json('total_paid'));
    }

    public function test_top_customers_by_receivable_and_collection_rate(): void
    {
        $custA = Customer::create([
            'name' => 'PT Pelanggan Besar',
            'no_telp' => '0811111111',
            'address' => 'Gedung A',
        ]);

        $custB = Customer::create([
            'name' => 'CV Pelanggan Kecil',
            'no_telp' => '0822222222',
            'address' => 'Gedung B',
        ]);

        Receivable::create([
            'customer_id' => $custA->id,
            'invoice' => 'INV-TOP-01',
            'total' => 5000000,
            'paid' => 1000000,
            'due_date' => now()->subDays(20)->format('Y-m-d'),
            'status' => 'partial',
        ]);

        Receivable::create([
            'customer_id' => $custB->id,
            'invoice' => 'INV-TOP-02',
            'total' => 2000000,
            'paid' => 500000,
            'due_date' => now()->subDays(10)->format('Y-m-d'),
            'status' => 'partial',
        ]);

        $response = $this->actingAs($this->userWithAccess)
            ->getJson(route('receivables.aging'));

        $response->assertOk();

        $topCustomers = $response->json('top_customers');
        $this->assertNotEmpty($topCustomers);
        $this->assertEquals('PT Pelanggan Besar', $topCustomers[0]['name']);
        $this->assertEquals(4000000, $topCustomers[0]['remaining']);
        $this->assertEquals('CV Pelanggan Kecil', $topCustomers[1]['name']);
        $this->assertEquals(1500000, $topCustomers[1]['remaining']);

        $collectionRate = $response->json('collection_rate');
        $this->assertEquals(7000000, $collectionRate['total_receivables_amount']);
        $this->assertEquals(1500000, $collectionRate['total_paid_amount']);
        // 1.5M / 7M = 21.43%
        $this->assertEquals(21.43, $collectionRate['collection_rate']);
    }

    public function test_aging_dashboard_page_renders_with_receivable_aging_summary(): void
    {
        $customer = Customer::create([
            'name' => 'CV Mitra Sejahtera',
            'no_telp' => '081233445566',
            'address' => 'Kawasan Industri Cikarang Blok B',
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-DASH-01',
            'total' => 1500000,
            'paid' => 0,
            'due_date' => now()->subDays(15)->format('Y-m-d'),
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($this->userWithAccess)
            ->get(route('aging.index'));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Dashboard/Aging/Index')
                ->has('receivableAgingSummary')
            );
    }
}
