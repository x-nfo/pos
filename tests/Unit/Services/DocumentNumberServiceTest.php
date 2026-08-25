<?php

namespace Tests\Unit\Services;

use App\Models\PurchaseOrder;
use App\Models\Transaction;
use App\Models\User;
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
            'cashier_id' => $user->id,
            'invoice' => 'TRX-UNIQUE-TEST',
            'cash' => 10000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 10000,
        ]);

        $this->expectException(QueryException::class);

        Transaction::create([
            'cashier_id' => $user->id,
            'invoice' => 'TRX-UNIQUE-TEST',
            'cash' => 10000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 10000,
        ]);
    }
}
