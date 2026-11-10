<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\AuditLogService;
use App\Services\RajaOngkirService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ShippingSettingController extends Controller
{
    public function __construct(
        protected RajaOngkirService $rajaOngkirService,
        protected AuditLogService $auditLogService
    ) {}

    /**
     * Render the shipping / RajaOngkir settings page
     */
    public function edit(Request $request): Response
    {
        $rawKey = Setting::get('rajaongkir_api_key', config('services.rajaongkir.api_key', ''));

        $settings = [
            'rajaongkir_is_active' => Setting::getBool('rajaongkir_is_active', true),
            'rajaongkir_api_key' => $rawKey,
            'rajaongkir_base_url' => Setting::get('rajaongkir_base_url', config('services.rajaongkir.base_url', RajaOngkirService::DEFAULT_BASE_URL)),
            'rajaongkir_origin_id' => Setting::get('rajaongkir_origin_id', config('services.rajaongkir.origin_id', '')),
            'rajaongkir_origin_label' => Setting::get('rajaongkir_origin_label', config('services.rajaongkir.origin_label', '')),
            'rajaongkir_couriers' => Setting::get('rajaongkir_couriers', config('services.rajaongkir.enabled_couriers', 'jne,jnt,sicepat,pos,tiki,anteraja')),
            'rajaongkir_default_weight' => Setting::getInt('rajaongkir_default_weight', config('services.rajaongkir.default_weight', RajaOngkirService::DEFAULT_WEIGHT)),
        ];

        return Inertia::render('Dashboard/Settings/Shipping', [
            'settings' => $settings,
            'allCouriers' => $this->rajaOngkirService->getAllSupportedCouriers(),
        ]);
    }

    /**
     * Update shipping settings
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rajaongkir_is_active' => ['required', 'boolean'],
            'rajaongkir_api_key' => ['nullable', 'string', 'max:255'],
            'rajaongkir_base_url' => ['required', 'url', 'max:255'],
            'rajaongkir_origin_id' => ['nullable', 'integer'],
            'rajaongkir_origin_label' => ['nullable', 'string', 'max:255'],
            'rajaongkir_couriers' => ['required', 'string'],
            'rajaongkir_default_weight' => ['required', 'integer', 'min:1', 'max:100000'],
        ]);

        Setting::set('rajaongkir_is_active', $validated['rajaongkir_is_active'] ? '1' : '0', 'Aktifkan fitur cek ongkir RajaOngkir');

        if (isset($validated['rajaongkir_api_key'])) {
            Setting::set('rajaongkir_api_key', trim($validated['rajaongkir_api_key']), 'API Key RajaOngkir (Komerce v1)');
        }

        Setting::set('rajaongkir_base_url', rtrim($validated['rajaongkir_base_url'], '/'), 'Base URL API RajaOngkir');
        Setting::set('rajaongkir_origin_id', $validated['rajaongkir_origin_id'] ?? '', 'Default Origin Destination ID');
        Setting::set('rajaongkir_origin_label', $validated['rajaongkir_origin_label'] ?? '', 'Default Origin Destination Label');
        Setting::set('rajaongkir_couriers', $validated['rajaongkir_couriers'], 'Daftar kurir yang diaktifkan');
        Setting::set('rajaongkir_default_weight', (string) $validated['rajaongkir_default_weight'], 'Berat default dalam gram jika produk tidak memiliki berat');

        $this->rajaOngkirService->clearCache();

        $this->auditLogService->log(
            event: 'update',
            module: 'settings',
            auditable: null,
            description: 'Memperbarui pengaturan pengiriman RajaOngkir',
            after: [
                'origin_id' => $validated['rajaongkir_origin_id'] ?? null,
                'origin_label' => $validated['rajaongkir_origin_label'] ?? null,
                'couriers' => $validated['rajaongkir_couriers'],
            ]
        );

        return back()->with('success', 'Pengaturan pengiriman RajaOngkir berhasil disimpan.');
    }

    /**
     * Test API connection
     */
    public function test(Request $request): JsonResponse
    {
        $apiKey = $request->input('api_key');
        $baseUrl = $request->input('base_url');

        $result = $this->rajaOngkirService->testConnection($apiKey, $baseUrl);

        return response()->json($result);
    }

    /**
     * Clear shipping cache
     */
    public function clearCache(Request $request): JsonResponse
    {
        $this->rajaOngkirService->clearCache();

        return response()->json([
            'success' => true,
            'message' => 'Cache RajaOngkir berhasil dibersihkan.',
        ]);
    }
}
