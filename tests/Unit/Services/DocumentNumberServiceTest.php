<?php

namespace Tests\Unit\Services;

use App\Models\Payable;
use App\Models\PayablePayment;
use App\Models\PurchaseOrder;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\DocumentNumberService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentNumberServiceTest extends TestCase
{
    use RefreshDatabase;

    private DocumentNumberService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(DocumentNumberService::class);
    }

    public function test_can_generate_unique_transaction_invoice(): void
    {
        $invoice1 = $this->service->generateTransactionInvoice();
        $invoice2 = $this->service->generateTransactionInvoice();

        $this->assertStringStartsWith('TRX-', $invoice1);
        $this->assertStringStartsWith('TRX-', $invoice2);
        $this->assertNotEquals($invoice1, $invoice2);
    }

    public function test_generate_sequential_number_increments_properly(): void
    {
        $user = User::factory()->create();
        $today = now()->format('Ymd');
        $prefix = 'PO-'.$today.'-';

        $number1 = $this->service->generateSequentialNumber(PurchaseOrder::class, 'document_number', $prefix);
        $this->assertSame($prefix.'0001', $number1);

        PurchaseOrder::create([
            'document_number' => $number1,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $number2 = $this->service->generateSequentialNumber(PurchaseOrder::class, 'document_number', $prefix);
        $this->assertSame($prefix.'0002', $number2);
    }

    public function test_execute_with_retry_recovers_from_duplicate_entry_exception(): void
    {
        $attempts = 0;

        $result = $this->service->executeWithRetry(function () use (&$attempts) {
            $attempts++;
            if ($attempts === 1) {
                // Simulate Duplicate Entry 1062 / SQLSTATE 23000
                throw new QueryException(
                    'sqlite',
                    'INSERT INTO transactions ...',
                    [],
                    new \Exception('UNIQUE constraint failed: transactions.invoice', 23000)
                );
            }

            return 'success_after_retry';
        }, maxAttempts: 3);

        $this->assertSame('success_after_retry', $result);
        $this->assertSame(2, $attempts);
    }

    public function test_can_generate_voucher_and_member_codes(): void
    {
        $voucherCode = $this->service->generateVoucherCode();
        $this->assertStringStartsWith('VCR-', $voucherCode);

        $memberCode = $this->service->generateMemberCode();
        $this->assertStringStartsWith('MEM-', $memberCode);
    }

    public function test_duplicate_transaction_invoice_is_prevented_by_database_constraint(): void
    {
        $user = User::factory()->create();

        Transaction::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'cashier_id' => $user->id,
            'invoice' => 'TRX-UNIQUE-TEST',
            'cash' => 10000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 10000,
        ]);

        $this->expectException(QueryException::class);

        Transaction::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'cashier_id' => $user->id,
            'invoice' => 'TRX-UNIQUE-TEST',
            'cash' => 10000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 10000,
        ]);
    }

    public function test_format_branch_code_sanitizes_correctly(): void
    {
        $this->assertSame('HQ', $this->service->formatBranchCode(null));
        $this->assertSame('HQ', $this->service->formatBranchCode(''));

        $warehouse = Warehouse::create([
            'code' => 'SBY-01',
            'name' => 'Gudang Surabaya 1',
            'type' => 'branch',
        ]);

        $this->assertSame('SBY01', $this->service->formatBranchCode($warehouse));
        $this->assertSame('SBY01', $this->service->formatBranchCode($warehouse->id));
        $this->assertSame('BDG', $this->service->formatBranchCode('BDG'));
        $this->assertSame('HQ', $this->service->formatBranchCode('---'));
    }

    public function test_can_generate_branch_coded_payable_document_number(): void
    {
        $today = now()->format('Ymd');
        $hqDoc = $this->service->generatePayableDocumentNumber();
        $this->assertSame("AP-HQ-{$today}-0001", $hqDoc);

        $warehouse = Warehouse::create([
            'code' => 'SBY',
            'name' => 'Gudang Surabaya',
            'type' => 'branch',
        ]);

        $branchDoc1 = $this->service->generatePayableDocumentNumber($warehouse);
        $this->assertSame("AP-SBY-{$today}-0001", $branchDoc1);

        Payable::create([
            'document_number' => $branchDoc1,
            'total' => 100000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);

        $branchDoc2 = $this->service->generatePayableDocumentNumber($warehouse);
        $this->assertSame("AP-SBY-{$today}-0002", $branchDoc2);
    }

    public function test_payable_payment_voucher_number_includes_branch_code(): void
    {
        $user = User::factory()->create();
        $warehouse = Warehouse::create([
            'code' => 'BDG',
            'name' => 'Cabang Bandung',
            'type' => 'branch',
        ]);

        $po = PurchaseOrder::create([
            'warehouse_id' => $warehouse->id,
            'document_number' => 'PO-BDG-20260905-0001',
            'status' => 'ordered',
            'created_by' => $user->id,
        ]);

        $payable = Payable::create([
            'purchase_order_id' => $po->id,
            'document_number' => 'AP-BDG-20260905-0001',
            'total' => 200000,
            'paid' => 100000,
            'status' => 'partial',
        ]);

        $payment = PayablePayment::create([
            'payable_id' => $payable->id,
            'paid_at' => '2026-09-05',
            'amount' => 100000,
            'method' => 'cash',
            'user_id' => $user->id,
        ]);

        $expectedVoucher = 'PV-BDG-20260905-'.str_pad((string) $payment->id, 4, '0', STR_PAD_LEFT);
        $this->assertSame($expectedVoucher, $payment->voucher_number);
    }
}
