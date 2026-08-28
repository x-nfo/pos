<?php

namespace Tests\Feature\Transactions;

use App\Models\BankAccount;
use App\Models\Transaction;
use App\Models\User;
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
}
