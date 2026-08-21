<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use App\Models\Transaction;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

class QrislyGateway
{
    public const SANDBOX_BASE_URL = 'https://api-sandbox.collaborator.komerce.id/user';

    public const PRODUCTION_BASE_URL = 'https://api.collaborator.komerce.id/user';

    public function createCharge(Transaction $transaction, array $config): array
    {
        if (! ($config['enabled'] ?? false)) {
            throw new PaymentGatewayException('QRISLY tidak aktif atau belum dikonfigurasi.');
        }

        if (empty($config['api_key'])) {
            throw new PaymentGatewayException('API Key QRISLY belum dikonfigurasi.');
        }

        if (empty($config['qris_id'])) {
            throw new PaymentGatewayException('QRIS ID belum diatur. Silakan upload QRIS toko di pengaturan pembayaran.');
        }

        $baseUrl = ($config['is_production'] ?? false)
            ? self::PRODUCTION_BASE_URL
            : self::SANDBOX_BASE_URL;

        $amount = (int) $transaction->grand_total;

        if ($amount < 1000) {
            throw new PaymentGatewayException('Nominal transaksi QRIS minimal Rp 1.000.');
        }

        $payload = [
            'qris_id' => is_numeric($config['qris_id']) ? (int) $config['qris_id'] : $config['qris_id'],
            'amount' => $amount,
            'output_type' => 'string',
            'unique_amount' => (bool) ($config['use_unique_amount'] ?? true),
        ];

        $response = Http::withHeaders([
            'X-API-Key' => $config['api_key'],
            'Accept' => 'application/json',
        ])->post("{$baseUrl}/api/v1/qrisly/generate-qris", $payload);

        if ($response->failed() || $response->json('success') === false || $response->json('meta.status') === 'error') {
            $rawMsg = $response->json('message')
                ?: $response->json('meta.message')
                ?: $response->json('details.suggestion')
                ?: $response->body();

            if (is_string($rawMsg) && str_contains(strtolower($rawMsg), 'insufficient balance')) {
                $errorMessage = 'Saldo akun QRISLY / Komerce tidak mencukupi (biaya Rp 100/generate QRIS). Silakan top-up saldo di dashboard Komerce / RajaOngkir.';
            } else {
                $errorMessage = is_string($rawMsg) ? $rawMsg : json_encode($rawMsg);
            }

            throw new PaymentGatewayException('QRISLY: '.$errorMessage);
        }

        $data = $response->json('data', []);
        $historyId = $data['history_id'] ?? null;
        $qrisString = $data['qris_string'] ?? null;

        return [
            'reference' => $historyId ? (string) $historyId : $transaction->invoice,
            'payment_url' => $qrisString,
            'qris_string' => $qrisString,
            'original_amount' => $data['original_amount'] ?? $amount,
            'final_amount' => $data['final_amount'] ?? $amount,
            'expiry_time' => $data['expiry_time'] ?? null,
            'raw' => $response->json(),
        ];
    }

    public function checkStatus(int|string $historyId, array $config): array
    {
        $baseUrl = ($config['is_production'] ?? false)
            ? self::PRODUCTION_BASE_URL
            : self::SANDBOX_BASE_URL;

        $response = Http::withHeaders([
            'X-API-Key' => $config['api_key'] ?? '',
            'Accept' => 'application/json',
        ])->get("{$baseUrl}/api/v1/qrisly/payment-status/{$historyId}");

        if ($response->failed()) {
            throw new PaymentGatewayException(
                'Gagal mengecek status QRISLY: '.$response->json('message', $response->body())
            );
        }

        return $response->json();
    }

    public function uploadQris(UploadedFile $file, string $name, array $config): array
    {
        if (empty($config['api_key'])) {
            throw new PaymentGatewayException('API Key QRISLY belum diatur.');
        }

        $baseUrl = ($config['is_production'] ?? false)
            ? self::PRODUCTION_BASE_URL
            : self::SANDBOX_BASE_URL;

        $response = Http::withHeaders([
            'X-API-Key' => $config['api_key'],
            'Accept' => 'application/json',
        ])->attach(
            'qris_image',
            file_get_contents($file->getRealPath()),
            $file->getClientOriginalName()
        )->post("{$baseUrl}/api/v1/qrisly/upload-qris", [
            'name' => $name,
        ]);

        if ($response->failed() || $response->json('success') === false) {
            $errorMsg = $response->json('message') ?: $response->body();
            throw new PaymentGatewayException('Gagal upload QRIS ke QRISLY: '.$errorMsg);
        }

        return $response->json('data', []);
    }
}
