<?php

namespace Tests\Feature\Transactions;

use App\Models\BankAccount;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\ThermalPrintService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class BankTransferConfirmationTest extends TestCase
{
    use RefreshDatabase;

    public function test_bank_transfer_payment_confirmation_records_confirmer_and_timestamp(): void
    {
        $user = User::factory()->create();
        Permission::firstOrCreate(['name' => 'transactions-confirm-payment', 'guard_name' => 'web']);
        $user->givePermissionTo('transactions-confirm-payment');

        $bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_name' => 'PT Toko Retail',
            'account_number' => '1234567890',
            'is_active' => true,
        ]);

        $transaction = Transaction::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'cashier_id' => $user->id,
            'customer_id' => null,
            'invoice' => 'TRX-'.Str::upper(Str::random(8)),
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => 150000,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'pending',
            'bank_account_id' => $bankAccount->id,
        ]);

        // Check thermal and WA receipt when pending
        $printService = app(ThermalPrintService::class);
        $receiptText = $printService->generateReceiptText($transaction);
        $this->assertStringContainsString('*** BELUM LUNAS ***', $receiptText);
        $this->assertStringContainsString('BCA', $receiptText);

        $waText = $printService->generateWhatsappReceiptText($transaction);
        $this->assertStringContainsString('BELUM LUNAS', $waText);
        $this->assertStringContainsString('Petunjuk Transfer', $waText);

        // Confirm payment
        $response = $this->withSession($this->recentlyConfirmedSession())
            ->actingAs($user)
            ->patch(route('transactions.confirm-payment', $transaction));

        $response->assertRedirect();

        $transaction->refresh();
        $this->assertEquals('paid', $transaction->payment_status);
        $this->assertEquals($user->id, $transaction->payment_confirmed_by);
        $this->assertNotNull($transaction->payment_confirmed_at);
        $this->assertEquals($user->name, $transaction->paymentConfirmer->name);

        // Check thermal and WA receipt when paid
        $receiptPaidText = $printService->generateReceiptText($transaction);
        $this->assertStringContainsString('LUNAS', $receiptPaidText);
        $this->assertStringNotContainsString('*** BELUM LUNAS ***', $receiptPaidText);

        $waPaidText = $printService->generateWhatsappReceiptText($transaction);
        $this->assertStringContainsString('STRUK PEMBELIAN (LUNAS)', $waPaidText);
        $this->assertStringContainsString('Status    : LUNAS', $waPaidText);
    }

    public function test_receipt_and_invoice_pdf_views_format_bank_transfer_cleanly_without_raw_values(): void
    {
        $user = User::factory()->create();
        $bankAccount = BankAccount::create([
            'bank_name' => 'BCA',
            'account_name' => 'PT Toko Retail',
            'account_number' => '1234567890',
            'is_active' => true,
        ]);

        $pendingTx = Transaction::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'cashier_id' => $user->id,
            'customer_id' => null,
            'invoice' => 'TRX-TEST-PENDING',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => 6500,
            'payment_method' => 'bank_transfer',
            'payment_status' => 'pending',
            'bank_account_id' => $bankAccount->id,
        ]);
        $pendingTx->load(['details.product', 'details.unit', 'cashier', 'customer', 'bankAccount', 'warehouse']);

        $storeProfile = [
            'name' => 'Rekasir',
            'logo' => null,
            'logo_data' => null,
            'address' => 'Jl. Raya Ciangsana No. 007',
            'phone' => '087885611594',
            'email' => 'admin@rekasir.site',
            'website' => 'https://rekasir.site',
        ];

        // 58mm pending
        $html58Pending = view('pdf.receipt_58', [
            'transaction' => $pendingTx,
            'store' => $storeProfile,
            'barcode' => '',
        ])->render();

        $this->assertStringNotContainsString('Bayar (BANK_TRANSFER) Rp 0', $html58Pending);
        $this->assertStringNotContainsString('(BANK_TRANSFER)', $html58Pending);
        $this->assertStringContainsString('Transfer Bank', $html58Pending);
        $this->assertStringContainsString('*** BELUM LUNAS ***', $html58Pending);
        $this->assertStringContainsString('1234567890', $html58Pending);

        // 80mm pending
        $html80Pending = view('pdf.receipt_80', [
            'transaction' => $pendingTx,
            'store' => $storeProfile,
            'barcode' => '',
            'locale' => 'id',
        ])->render();

        $this->assertStringNotContainsString('Bayar (BANK_TRANSFER) Rp 0', $html80Pending);
        $this->assertStringNotContainsString('(BANK_TRANSFER)', $html80Pending);
        $this->assertStringContainsString('Transfer Bank', $html80Pending);
        $this->assertStringContainsString('*** BELUM LUNAS ***', $html80Pending);
        $this->assertStringContainsString('1234567890', $html80Pending);

        // Invoice pending
        $htmlInvoicePending = view('pdf.invoice', [
            'transaction' => $pendingTx,
            'store' => $storeProfile,
            'barcode' => '',
        ])->render();

        $this->assertStringNotContainsString('bank_transfer', $htmlInvoicePending);
        $this->assertStringContainsString('Transfer Bank', $htmlInvoicePending);
        $this->assertStringContainsString('Belum Dikonfirmasi', $htmlInvoicePending);
        $this->assertStringContainsString('1234567890', $htmlInvoicePending);

        // Paid transaction
        $pendingTx->update(['payment_status' => 'paid']);
        $pendingTx->refresh();
        $pendingTx->load(['details.product', 'details.unit', 'cashier', 'customer', 'bankAccount', 'warehouse']);

        // 58mm paid
        $html58Paid = view('pdf.receipt_58', [
            'transaction' => $pendingTx,
            'store' => $storeProfile,
            'barcode' => '',
        ])->render();

        $this->assertStringNotContainsString('Bayar (BANK_TRANSFER) Rp 0', $html58Paid);
        $this->assertStringContainsString('Transfer Bank', $html58Paid);
        $this->assertStringContainsString('LUNAS', $html58Paid);
        $this->assertStringNotContainsString('*** BELUM LUNAS ***', $html58Paid);

        // 80mm paid
        $html80Paid = view('pdf.receipt_80', [
            'transaction' => $pendingTx,
            'store' => $storeProfile,
            'barcode' => '',
            'locale' => 'id',
        ])->render();

        $this->assertStringNotContainsString('Bayar (BANK_TRANSFER) Rp 0', $html80Paid);
        $this->assertStringContainsString('Transfer Bank', $html80Paid);
        $this->assertStringContainsString('LUNAS', $html80Paid);
        $this->assertStringNotContainsString('*** BELUM LUNAS ***', $html80Paid);
    }
}
