<?php

namespace App\Http\Controllers\Apps;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\PaymentSetting;
use App\Models\Setting;
use App\Services\AuditLogService;
use App\Services\Payments\QrislyGateway;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class PaymentSettingController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function edit()
    {
        $setting = PaymentSetting::firstOrCreate([], [
            'default_gateway' => 'cash',
        ]);

        $midtransWebhookUrl = route('webhooks.midtrans');
        $xenditWebhookUrl = route('webhooks.xendit');
        $qrislyWebhookUrl = route('webhooks.qrisly');
        $appUrl = (string) config('app.url');
        $webhookWarnings = [];

        if (blank($appUrl)) {
            $webhookWarnings[] = 'APP_URL belum diatur. Webhook URL yang dihasilkan bisa tidak valid untuk payment gateway.';
        } elseif ($this->isLocalAppUrl($appUrl)) {
            $webhookWarnings[] = 'APP_URL masih mengarah ke localhost atau 127.0.0.1. Payment gateway membutuhkan URL publik yang bisa diakses dari internet.';
        }

        if ($setting->xendit_enabled && ! $setting->secretConfigured('xendit_callback_token')) {
            $webhookWarnings[] = 'Xendit aktif tetapi callback token belum diisi. Webhook Xendit akan ditolak sampai token tersedia.';
        }

        if ($setting->qrisly_enabled && ! $setting->secretConfigured('qrisly_api_key')) {
            $webhookWarnings[] = 'QRISLY aktif tetapi API Key belum diisi. Pembayaran QRIS akan gagal sampai API Key tersedia.';
        }

        if ($setting->qrisly_enabled && blank($setting->resolvedQrislyQrisId())) {
            $webhookWarnings[] = 'QRISLY aktif tetapi QRIS ID belum diatur. Silakan unggah QRIS toko atau masukkan QRIS ID.';
        }

        if (collect($setting->paymentSettingSources())->contains(fn (array $source) => $source['source'] === 'env')) {
            $this->auditLogService->log(
                event: 'security.payment_secret_source_overridden',
                module: 'security',
                auditable: $setting,
                description: 'Konfigurasi payment memakai env override untuk secret sensitif.',
                meta: [
                    'severity' => 'info',
                    'sources' => collect($setting->paymentSettingSources())
                        ->filter(fn (array $source) => $source['source'] === 'env')
                        ->keys()
                        ->values()
                        ->all(),
                ],
            );
        }

        return Inertia::render('Dashboard/Settings/Payment', [
            'setting' => [
                'default_gateway' => $setting->default_gateway,
                'bank_transfer_enabled' => (bool) $setting->bank_transfer_enabled,
                'midtrans_enabled' => (bool) $setting->midtrans_enabled,
                'midtrans_client_key' => $setting->midtrans_client_key,
                'midtrans_production' => (bool) $setting->midtrans_production,
                'xendit_enabled' => (bool) $setting->xendit_enabled,
                'xendit_public_key' => $setting->xendit_public_key,
                'xendit_production' => (bool) $setting->xendit_production,
                'qrisly_enabled' => (bool) $setting->qrisly_enabled,
                'qrisly_qris_id' => $setting->qrisly_qris_id,
                'qrisly_production' => (bool) $setting->qrisly_production,
                'qrisly_use_unique_amount' => (bool) $setting->qrisly_use_unique_amount,
                'receivable_approval_threshold' => (float) Setting::get('receivable_approval_threshold', 1000000),
            ],
            'paymentSettingSources' => $setting->paymentSettingSources(),
            'supportedGateways' => [
                ['value' => 'cash', 'label' => 'Tunai'],
                ['value' => PaymentSetting::GATEWAY_BANK_TRANSFER, 'label' => 'Transfer Bank'],
                ['value' => PaymentSetting::GATEWAY_MIDTRANS, 'label' => 'Midtrans'],
                ['value' => PaymentSetting::GATEWAY_XENDIT, 'label' => 'Xendit'],
                ['value' => PaymentSetting::GATEWAY_QRISLY, 'label' => 'QRIS (QRISLY)'],
            ],
            'webhookUrls' => [
                'midtrans' => $midtransWebhookUrl,
                'xendit' => $xenditWebhookUrl,
                'qrisly' => $qrislyWebhookUrl,
            ],
            'webhookWarnings' => $webhookWarnings,
        ]);
    }

    public function update(Request $request)
    {
        $setting = PaymentSetting::firstOrCreate([], [
            'default_gateway' => 'cash',
        ]);
        $beforeState = $setting->replicate();

        $data = $request->validate([
            'default_gateway' => [
                'required',
                Rule::in([
                    'cash',
                    PaymentSetting::GATEWAY_BANK_TRANSFER,
                    PaymentSetting::GATEWAY_MIDTRANS,
                    PaymentSetting::GATEWAY_XENDIT,
                    PaymentSetting::GATEWAY_QRISLY,
                ]),
            ],
            'bank_transfer_enabled' => ['boolean'],
            'midtrans_enabled' => ['boolean'],
            'midtrans_server_key' => ['nullable', 'string'],
            'midtrans_client_key' => ['nullable', 'string'],
            'midtrans_production' => ['boolean'],
            'xendit_enabled' => ['boolean'],
            'xendit_secret_key' => ['nullable', 'string'],
            'xendit_public_key' => ['nullable', 'string'],
            'xendit_callback_token' => ['nullable', 'string', 'max:255'],
            'xendit_production' => ['boolean'],
            'qrisly_enabled' => ['boolean'],
            'qrisly_api_key' => ['nullable', 'string'],
            'qrisly_qris_id' => ['nullable', 'string', 'max:255'],
            'qrisly_production' => ['boolean'],
            'qrisly_use_unique_amount' => ['boolean'],
            'receivable_approval_threshold' => ['nullable', 'numeric', 'min:0'],
        ]);

        $midtransEnabled = (bool) ($data['midtrans_enabled'] ?? false);
        $xenditEnabled = (bool) ($data['xendit_enabled'] ?? false);
        $qrislyEnabled = (bool) ($data['qrisly_enabled'] ?? false);

        $midtransServerKeyInput = $data['midtrans_server_key'] ?? null;
        $xenditSecretKeyInput = $data['xendit_secret_key'] ?? null;
        $xenditCallbackTokenInput = $data['xendit_callback_token'] ?? null;
        $qrislyApiKeyInput = $data['qrisly_api_key'] ?? null;

        $resolvedMidtransServerKey = $setting->secretManagedByEnvironment('midtrans_server_key')
            ? $setting->resolvedSecret('midtrans_server_key')
            : ($midtransServerKeyInput ?: $setting->getAttributeValue('midtrans_server_key'));
        $resolvedXenditSecretKey = $setting->secretManagedByEnvironment('xendit_secret_key')
            ? $setting->resolvedSecret('xendit_secret_key')
            : ($xenditSecretKeyInput ?: $setting->getAttributeValue('xendit_secret_key'));
        $resolvedXenditCallbackToken = $setting->secretManagedByEnvironment('xendit_callback_token')
            ? $setting->resolvedSecret('xendit_callback_token')
            : ($xenditCallbackTokenInput ?: $setting->getAttributeValue('xendit_callback_token'));
        $resolvedQrislyApiKey = $setting->secretManagedByEnvironment('qrisly_api_key')
            ? $setting->resolvedSecret('qrisly_api_key')
            : ($qrislyApiKeyInput ?: $setting->getAttributeValue('qrisly_api_key'));

        if ($midtransEnabled && (blank($resolvedMidtransServerKey) || empty($data['midtrans_client_key'] ?? null))) {
            return back()->withErrors([
                'midtrans_server_key' => 'Server key dan Client key Midtrans wajib diisi saat mengaktifkan Midtrans.',
            ])->withInput();
        }

        if ($xenditEnabled && blank($resolvedXenditSecretKey)) {
            return back()->withErrors([
                'xendit_secret_key' => 'Secret key Xendit wajib diisi saat mengaktifkan Xendit.',
            ])->withInput();
        }

        if ($xenditEnabled && blank($resolvedXenditCallbackToken)) {
            return back()->withErrors([
                'xendit_callback_token' => 'Callback token Xendit wajib diisi saat mengaktifkan Xendit.',
            ])->withInput();
        }

        if ($qrislyEnabled && blank($resolvedQrislyApiKey)) {
            return back()->withErrors([
                'qrisly_api_key' => 'API Key QRISLY wajib diisi saat mengaktifkan QRISLY.',
            ])->withInput();
        }

        $resolvedQrislyQrisId = $data['qrisly_qris_id'] ?? $setting->resolvedQrislyQrisId();
        if ($qrislyEnabled && blank($resolvedQrislyQrisId)) {
            return back()->withErrors([
                'qrisly_qris_id' => 'QRIS ID wajib diisi atau diunggah saat mengaktifkan QRISLY.',
            ])->withInput();
        }

        if (
            $data['default_gateway'] !== 'cash'
            && ! (($data['default_gateway'] === PaymentSetting::GATEWAY_MIDTRANS && $midtransEnabled)
                || ($data['default_gateway'] === PaymentSetting::GATEWAY_XENDIT && $xenditEnabled)
                || ($data['default_gateway'] === PaymentSetting::GATEWAY_QRISLY && $qrislyEnabled)
                || ($data['default_gateway'] === PaymentSetting::GATEWAY_BANK_TRANSFER && (bool) ($data['bank_transfer_enabled'] ?? false)))
        ) {
            return back()->withErrors([
                'default_gateway' => 'Gateway default harus dalam kondisi aktif.',
            ])->withInput();
        }

        $setting->update([
            'default_gateway' => $data['default_gateway'],
            'bank_transfer_enabled' => (bool) ($data['bank_transfer_enabled'] ?? false),
            'midtrans_enabled' => $midtransEnabled,
            'midtrans_server_key' => $setting->secretManagedByEnvironment('midtrans_server_key')
                ? $setting->getRawOriginal('midtrans_server_key')
                : ($midtransServerKeyInput ?: $setting->getAttributeValue('midtrans_server_key')),
            'midtrans_client_key' => $data['midtrans_client_key'] ?? $setting->midtrans_client_key,
            'midtrans_production' => (bool) ($data['midtrans_production'] ?? false),
            'xendit_enabled' => $xenditEnabled,
            'xendit_secret_key' => $setting->secretManagedByEnvironment('xendit_secret_key')
                ? $setting->getRawOriginal('xendit_secret_key')
                : ($xenditSecretKeyInput ?: $setting->getAttributeValue('xendit_secret_key')),
            'xendit_public_key' => $data['xendit_public_key'] ?? $setting->xendit_public_key,
            'xendit_callback_token' => $setting->secretManagedByEnvironment('xendit_callback_token')
                ? $setting->getRawOriginal('xendit_callback_token')
                : ($xenditCallbackTokenInput ?: $setting->getAttributeValue('xendit_callback_token')),
            'xendit_production' => (bool) ($data['xendit_production'] ?? false),
            'qrisly_enabled' => $qrislyEnabled,
            'qrisly_api_key' => $setting->secretManagedByEnvironment('qrisly_api_key')
                ? $setting->getRawOriginal('qrisly_api_key')
                : ($qrislyApiKeyInput ?: $setting->getAttributeValue('qrisly_api_key')),
            'qrisly_qris_id' => $data['qrisly_qris_id'] ?? $setting->qrisly_qris_id,
            'qrisly_production' => (bool) ($data['qrisly_production'] ?? false),
            'qrisly_use_unique_amount' => (bool) ($data['qrisly_use_unique_amount'] ?? true),
        ]);

        if (array_key_exists('receivable_approval_threshold', $data) && $data['receivable_approval_threshold'] !== null) {
            Setting::set(
                'receivable_approval_threshold',
                $data['receivable_approval_threshold'],
                'Batas nominal pelunasan piutang yang membutuhkan approval'
            );
        }

        $this->auditLogService->log(
            event: 'payment.setting.updated',
            module: 'payment_settings',
            auditable: $setting,
            description: 'Konfigurasi payment gateway diperbarui.',
            before: [
                'default_gateway' => $beforeState->default_gateway,
                'bank_transfer_enabled' => (bool) $beforeState->bank_transfer_enabled,
                'midtrans_enabled' => (bool) $beforeState->midtrans_enabled,
                'midtrans_production' => (bool) $beforeState->midtrans_production,
                'xendit_enabled' => (bool) $beforeState->xendit_enabled,
                'xendit_production' => (bool) $beforeState->xendit_production,
                'qrisly_enabled' => (bool) $beforeState->qrisly_enabled,
                'qrisly_production' => (bool) $beforeState->qrisly_production,
                'qrisly_use_unique_amount' => (bool) $beforeState->qrisly_use_unique_amount,
                'midtrans_server_key' => filled($beforeState->midtrans_server_key) ? 'configured' : 'empty',
                'midtrans_client_key' => filled($beforeState->midtrans_client_key) ? 'configured' : 'empty',
                'xendit_secret_key' => filled($beforeState->xendit_secret_key) ? 'configured' : 'empty',
                'xendit_public_key' => filled($beforeState->xendit_public_key) ? 'configured' : 'empty',
                'xendit_callback_token' => filled($beforeState->xendit_callback_token) ? 'configured' : 'empty',
                'qrisly_api_key' => filled($beforeState->qrisly_api_key) ? 'configured' : 'empty',
                'qrisly_qris_id' => filled($beforeState->qrisly_qris_id) ? 'configured' : 'empty',
            ],
            after: [
                'default_gateway' => $setting->default_gateway,
                'bank_transfer_enabled' => (bool) $setting->bank_transfer_enabled,
                'midtrans_enabled' => (bool) $setting->midtrans_enabled,
                'midtrans_production' => (bool) $setting->midtrans_production,
                'xendit_enabled' => (bool) $setting->xendit_enabled,
                'xendit_production' => (bool) $setting->xendit_production,
                'qrisly_enabled' => (bool) $setting->qrisly_enabled,
                'qrisly_production' => (bool) $setting->qrisly_production,
                'qrisly_use_unique_amount' => (bool) $setting->qrisly_use_unique_amount,
                'midtrans_server_key' => $this->auditLogService->credentialState($beforeState->midtrans_server_key, $setting->midtrans_server_key),
                'midtrans_client_key' => $this->auditLogService->credentialState($beforeState->midtrans_client_key, $setting->midtrans_client_key),
                'xendit_secret_key' => $this->auditLogService->credentialState($beforeState->xendit_secret_key, $setting->xendit_secret_key),
                'xendit_public_key' => $this->auditLogService->credentialState($beforeState->xendit_public_key, $setting->xendit_public_key),
                'xendit_callback_token' => $this->auditLogService->credentialState($beforeState->xendit_callback_token, $setting->xendit_callback_token),
                'qrisly_api_key' => $this->auditLogService->credentialState($beforeState->qrisly_api_key, $setting->qrisly_api_key),
                'qrisly_qris_id' => filled($setting->qrisly_qris_id) ? 'configured' : 'empty',
            ],
        );

        if (collect($setting->paymentSettingSources())->contains(fn (array $source) => $source['source'] === 'env')) {
            $this->auditLogService->log(
                event: 'security.payment_secret_source_overridden',
                module: 'security',
                auditable: $setting,
                description: 'Perubahan payment settings tetap tunduk pada env override untuk secret sensitif.',
                meta: [
                    'severity' => 'info',
                    'sources' => collect($setting->paymentSettingSources())
                        ->filter(fn (array $source) => $source['source'] === 'env')
                        ->keys()
                        ->values()
                        ->all(),
                ],
            );
        }

        return redirect()
            ->route('settings.payments.edit')
            ->with('success', 'Konfigurasi payment gateway berhasil disimpan.');
    }

    public function uploadQris(Request $request, QrislyGateway $qrislyGateway)
    {
        $request->validate([
            'qris_image' => ['required', 'image', 'mimes:png,jpg,jpeg', 'max:5120'],
            'name' => ['nullable', 'string', 'max:100'],
        ]);

        $setting = PaymentSetting::firstOrCreate([]);
        $apiKey = $setting->resolvedSecret('qrisly_api_key') ?: $request->input('api_key');

        if (blank($apiKey)) {
            return back()->withErrors([
                'qris_image' => 'API Key QRISLY belum diatur. Masukkan API Key terlebih dahulu.',
            ]);
        }

        $config = [
            'api_key' => $apiKey,
            'is_production' => (bool) $request->input('is_production', $setting->qrisly_production),
        ];

        $name = $request->input('name') ?: (config('app.name', 'Store').' QRIS');

        try {
            $result = $qrislyGateway->uploadQris($request->file('qris_image'), $name, $config);

            if (empty($result['qris_id'])) {
                return back()->withErrors(['qris_image' => 'Respon QRISLY tidak mengembalikan qris_id.']);
            }

            $setting->update([
                'qrisly_qris_id' => (string) $result['qris_id'],
            ]);

            return back()->with('success', 'QRIS berhasil diunggah dan tervalidasi! QRIS ID: '.$result['qris_id']);
        } catch (PaymentGatewayException $e) {
            return back()->withErrors(['qris_image' => $e->getMessage()]);
        }
    }

    private function isLocalAppUrl(string $appUrl): bool
    {
        $host = parse_url($appUrl, PHP_URL_HOST);

        return in_array($host, ['localhost', '127.0.0.1'], true)
            || str_ends_with((string) $host, '.test');
    }
}
