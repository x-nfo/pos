<?php

namespace Tests\Unit\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use App\Models\Transaction;
use App\Models\User;
use App\Services\Payments\QrislyGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class QrislyGatewayTest extends TestCase
{
    use RefreshDatabase;

    private QrislyGateway $gateway;

    protected function setUp(): void
    {
        parent::setUp();
        $this->gateway = new QrislyGateway;
    }

    public function test_create_charge_throws_if_disabled(): void
    {
        $this->expectException(PaymentGatewayException::class);
        $this->expectExceptionMessage('QRISLY tidak aktif atau belum dikonfigurasi.');

        $transaction = $this->createTransaction(10000);
        $this->gateway->createCharge($transaction, ['enabled' => false]);
    }

    public function test_create_charge_throws_if_api_key_missing(): void
    {
        $this->expectException(PaymentGatewayException::class);
        $this->expectExceptionMessage('API Key QRISLY belum dikonfigurasi.');

        $transaction = $this->createTransaction(10000);
        $this->gateway->createCharge($transaction, [
            'enabled' => true,
            'api_key' => '',
            'qris_id' => 'qris-123',
        ]);
    }

    public function test_create_charge_throws_if_qris_id_missing(): void
    {
        $this->expectException(PaymentGatewayException::class);
        $this->expectExceptionMessage('QRIS ID belum diatur.');

        $transaction = $this->createTransaction(10000);
        $this->gateway->createCharge($transaction, [
            'enabled' => true,
            'api_key' => 'secret-api-key',
            'qris_id' => '',
        ]);
    }

    public function test_create_charge_throws_if_amount_less_than_1000(): void
    {
        $this->expectException(PaymentGatewayException::class);
        $this->expectExceptionMessage('Nominal transaksi QRIS minimal Rp 1.000.');

        $transaction = $this->createTransaction(500);
        $this->gateway->createCharge($transaction, [
            'enabled' => true,
            'api_key' => 'secret-api-key',
            'qris_id' => 'qris-123',
        ]);
    }

    public function test_create_charge_success_returns_charge_payload(): void
    {
        Http::fake([
            'https://api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/generate-qris' => Http::response([
                'success' => true,
                'message' => 'Generate QRIS Berhasil',
                'data' => [
                    'history_id' => 1778,
                    'qris_string' => '00020101021226590014ID.LINKAJA.WWW...',
                    'original_amount' => 50000,
                    'final_amount' => 50002,
                    'payment_status' => 'unpaid',
                    'expiry_time' => '2026-08-20 23:59:59',
                ],
            ], 200),
        ]);

        $transaction = $this->createTransaction(50000);
        $result = $this->gateway->createCharge($transaction, [
            'enabled' => true,
            'api_key' => 'test-api-key',
            'qris_id' => 'qris-123',
            'is_production' => false,
            'use_unique_amount' => true,
        ]);

        $this->assertSame('1778', $result['reference']);
        $this->assertSame('00020101021226590014ID.LINKAJA.WWW...', $result['payment_url']);
        $this->assertSame('00020101021226590014ID.LINKAJA.WWW...', $result['qris_string']);
        $this->assertSame(50002, $result['final_amount']);
    }

    public function test_check_status_returns_response_data(): void
    {
        Http::fake([
            'https://api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/payment-status/1778' => Http::response([
                'success' => true,
                'data' => [
                    'qris_history_id' => 1778,
                    'status' => 'paid',
                ],
            ], 200),
        ]);

        $result = $this->gateway->checkStatus(1778, [
            'api_key' => 'test-api-key',
            'is_production' => false,
        ]);

        $this->assertTrue($result['success']);
        $this->assertSame('paid', $result['data']['status']);
    }

    public function test_upload_qris_returns_qris_id(): void
    {
        Http::fake([
            'https://api-sandbox.collaborator.komerce.id/user/api/v1/qrisly/upload-qris' => Http::response([
                'success' => true,
                'message' => 'Upload QRIS Berhasil',
                'data' => [
                    'qris_id' => '9d3f18a2-2bf2-411a-8c90-83395d85c888',
                    'name' => 'Toko POS',
                    'provider' => 'NOBU',
                    'merchant_name' => 'Toko Berkah POS',
                ],
            ], 200),
        ]);

        $file = UploadedFile::fake()->image('qris.png', 400, 400);

        $result = $this->gateway->uploadQris($file, 'Toko POS', [
            'api_key' => 'test-api-key',
            'is_production' => false,
        ]);

        $this->assertSame('9d3f18a2-2bf2-411a-8c90-83395d85c888', $result['qris_id']);
        $this->assertSame('Toko Berkah POS', $result['merchant_name']);
    }

    private function createTransaction(int $amount): Transaction
    {
        return Transaction::create([
            'cashier_id' => User::factory()->create()->id,
            'invoice' => 'TRX-QRISLY-'.uniqid(),
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => $amount,
            'payment_method' => 'qrisly',
            'payment_status' => 'pending',
        ]);
    }
}
