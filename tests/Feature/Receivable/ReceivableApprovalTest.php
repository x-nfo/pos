<?php

namespace Tests\Feature\Receivable;

use App\Models\Customer;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ReceivableApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $cashier;

    protected User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        // Create permissions
        Permission::firstOrCreate(['name' => 'receivables-access', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'receivables-pay', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'receivables-approve', 'guard_name' => 'web']);

        $superAdminRole = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        $superAdminRole->syncPermissions(Permission::all());

        $cashierRole = Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);
        $cashierRole->syncPermissions(['receivables-access', 'receivables-pay']);

        $managerRole = Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'web']);
        $managerRole->syncPermissions(['receivables-access', 'receivables-pay', 'receivables-approve']);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('super-admin');

        $this->cashier = User::factory()->create();
        $this->cashier->assignRole('cashier');

        $this->manager = User::factory()->create();
        $this->manager->assignRole('manager');

        Setting::set('receivable_approval_threshold', 1000000);
    }

    public function test_small_cash_payment_auto_approves_and_updates_balance(): void
    {
        $customer = Customer::create(['name' => 'Budi', 'no_telp' => '08123456789', 'address' => 'Jakarta']);
        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-001',
            'total' => 500000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($this->cashier)->post(route('receivables.pay', $receivable->id), [
            'amount' => 200000,
            'paid_at' => now()->format('Y-m-d'),
            'method' => 'cash',
            'note' => 'Cicilan tunai kecil',
        ]);

        $response->assertRedirect(route('receivables.show', $receivable->id));

        $payment = ReceivablePayment::where('receivable_id', $receivable->id)->first();
        $this->assertNotNull($payment);
        $this->assertEquals('approved', $payment->status);
        $this->assertEquals($this->cashier->id, $payment->approved_by);

        $receivable->refresh();
        $this->assertEquals(200000, $receivable->paid);
        $this->assertEquals('partial', $receivable->status);
    }

    public function test_large_cash_payment_requires_approval_and_does_not_mutate_balance_immediately(): void
    {
        $customer = Customer::create(['name' => 'Budi', 'no_telp' => '08123456789', 'address' => 'Jakarta']);
        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-002',
            'total' => 2000000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        // Pay 1,500,000 (>= 1,000,000 threshold)
        $response = $this->actingAs($this->cashier)->post(route('receivables.pay', $receivable->id), [
            'amount' => 1500000,
            'paid_at' => now()->format('Y-m-d'),
            'method' => 'cash',
            'note' => 'Pembayaran tunai besar',
        ]);

        $response->assertRedirect(route('receivables.show', $receivable->id));

        $payment = ReceivablePayment::where('receivable_id', $receivable->id)->first();
        $this->assertNotNull($payment);
        $this->assertEquals('pending', $payment->status);
        $this->assertNull($payment->approved_by);

        $receivable->refresh();
        $this->assertEquals(0, $receivable->paid); // balance untouched
        $this->assertEquals('unpaid', $receivable->status);
    }

    public function test_non_cash_payment_requires_approval_even_for_small_amounts(): void
    {
        $customer = Customer::create(['name' => 'Budi', 'no_telp' => '08123456789', 'address' => 'Jakarta']);
        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-003',
            'total' => 500000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($this->cashier)->post(route('receivables.pay', $receivable->id), [
            'amount' => 100000,
            'paid_at' => now()->format('Y-m-d'),
            'method' => 'bank_transfer',
            'note' => 'Transfer bank',
        ]);

        $response->assertRedirect(route('receivables.show', $receivable->id));

        $payment = ReceivablePayment::where('receivable_id', $receivable->id)->first();
        $this->assertNotNull($payment);
        $this->assertEquals('pending', $payment->status);

        $receivable->refresh();
        $this->assertEquals(0, $receivable->paid);
    }

    public function test_cashier_cannot_self_approve_payment(): void
    {
        $customer = Customer::create(['name' => 'Budi', 'no_telp' => '08123456789', 'address' => 'Jakarta']);
        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-004',
            'total' => 1000000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $payment = ReceivablePayment::create([
            'receivable_id' => $receivable->id,
            'user_id' => $this->manager->id,
            'amount' => 500000,
            'method' => 'bank_transfer',
            'paid_at' => now(),
            'status' => 'pending',
        ]);

        // Manager tries to approve payment created by themselves
        $response = $this->actingAs($this->manager)->post(route('receivables.payments.approve', $payment->id));
        $response->assertSessionHas('error');

        $payment->refresh();
        $this->assertEquals('pending', $payment->status);
    }

    public function test_manager_can_approve_cashier_pending_payment(): void
    {
        $customer = Customer::create(['name' => 'Budi', 'no_telp' => '08123456789', 'address' => 'Jakarta']);
        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-005',
            'total' => 1000000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $payment = ReceivablePayment::create([
            'receivable_id' => $receivable->id,
            'user_id' => $this->cashier->id,
            'amount' => 1000000,
            'method' => 'bank_transfer',
            'paid_at' => now(),
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->manager)->post(route('receivables.payments.approve', $payment->id), [
            'approval_notes' => 'Mutasi bank terverifikasi',
        ]);

        $response->assertSessionHas('success');

        $payment->refresh();
        $this->assertEquals('approved', $payment->status);
        $this->assertEquals($this->manager->id, $payment->approved_by);
        $this->assertEquals('Mutasi bank terverifikasi', $payment->approval_notes);

        $receivable->refresh();
        $this->assertEquals(1000000, $receivable->paid);
        $this->assertEquals('paid', $receivable->status);
    }

    public function test_manager_can_reject_pending_payment_with_reason(): void
    {
        $customer = Customer::create(['name' => 'Budi', 'no_telp' => '08123456789', 'address' => 'Jakarta']);
        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-006',
            'total' => 1000000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $payment = ReceivablePayment::create([
            'receivable_id' => $receivable->id,
            'user_id' => $this->cashier->id,
            'amount' => 500000,
            'method' => 'bank_transfer',
            'paid_at' => now(),
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->manager)->post(route('receivables.payments.reject', $payment->id), [
            'approval_notes' => 'Bukti transfer buram dan tidak ada di mutasi BCA',
        ]);

        $response->assertSessionHas('success');

        $payment->refresh();
        $this->assertEquals('rejected', $payment->status);
        $this->assertEquals('Bukti transfer buram dan tidak ada di mutasi BCA', $payment->approval_notes);

        $receivable->refresh();
        $this->assertEquals(0, $receivable->paid);
        $this->assertEquals('unpaid', $receivable->status);
    }

    public function test_reject_requires_approval_notes(): void
    {
        $customer = Customer::create(['name' => 'Budi', 'no_telp' => '08123456789', 'address' => 'Jakarta']);
        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'INV-007',
            'total' => 1000000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $payment = ReceivablePayment::create([
            'receivable_id' => $receivable->id,
            'user_id' => $this->cashier->id,
            'amount' => 500000,
            'method' => 'bank_transfer',
            'paid_at' => now(),
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->manager)->post(route('receivables.payments.reject', $payment->id), [
            'approval_notes' => '',
        ]);

        $response->assertSessionHasErrors('approval_notes');
    }

    public function test_receivable_pdf_download_succeeds(): void
    {
        $customer = Customer::create([
            'name' => 'Customer PDF',
            'no_telp' => '081299999999',
            'address' => 'Jakarta',
        ]);
        $receivable = Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'REC-PDF-001',
            'total' => 500000,
            'paid' => 200000,
            'status' => 'partial',
        ]);

        $response = $this->actingAs($this->admin)
            ->get(route('pdf.receivables.show', $receivable));

        $response->assertOk();
    }
}
