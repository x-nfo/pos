<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Setting;
use App\Models\Warehouse;
use App\Services\CashierShiftService;
use App\Services\RajaOngkirService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class RajaOngkirController extends Controller
{
    public function __construct(
        protected RajaOngkirService $rajaOngkirService,
        protected CashierShiftService $cashierShiftService
    ) {}

    /**
     * Search domestic destinations
     */
    public function searchDestinations(Request $request): JsonResponse
    {
        $search = (string) $request->query('search', '');
        $limit = (int) $request->query('limit', 10);
        $offset = (int) $request->query('offset', 0);

        if (mb_strlen(trim($search)) < 3) {
            return response()->json([
                'success' => true,
                'data' => [],
                'message' => 'Masukkan minimal 3 karakter untuk mencari.',
            ]);
        }

        $destinations = $this->rajaOngkirService->searchDestinations($search, $limit, $offset);

        return response()->json([
            'success' => true,
            'data' => $destinations,
        ]);
    }

    /**
     * Calculate shipping costs
     */
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'destination_id' => ['required', 'integer', 'min:1'],
            'origin_id' => ['nullable', 'integer', 'min:1'],
            'weight' => ['nullable', 'integer', 'min:1'],
            'courier' => ['nullable', 'string'],
            'couriers' => ['nullable', 'array'],
            'couriers.*' => ['string'],
        ]);

        $user = $request->user();
        $originId = $validated['origin_id'] ?? null;

        // Resolve origin: user warehouse -> shift warehouse -> global setting
        if (! $originId) {
            $shift = $user ? $this->cashierShiftService->getActiveShiftForUser($user->id) : null;
            $warehouse = $shift?->warehouse ?: ($user?->warehouse_id ? Warehouse::find($user->warehouse_id) : null);

            $originId = $warehouse?->rajaongkir_origin_id ?: $this->rajaOngkirService->getDefaultOriginId();
        }

        if (! $originId) {
            return response()->json([
                'success' => false,
                'message' => 'Lokasi asal (origin) belum dikonfigurasi. Silakan atur lokasi asal di Pengaturan Toko / Pengiriman.',
                'options' => [],
            ], 422);
        }

        $destinationId = (int) $validated['destination_id'];

        // Determine weight
        $weight = isset($validated['weight']) && (int) $validated['weight'] > 0
            ? (int) $validated['weight']
            : $this->rajaOngkirService->getDefaultWeight();

        // Single courier vs multiple couriers
        $courier = $validated['courier'] ?? null;
        $couriers = $validated['couriers'] ?? null;

        if ($courier && $courier !== 'all') {
            $rawOptions = $this->rajaOngkirService->calculateCost($originId, $destinationId, $weight, $courier);
            $options = [];
            foreach ($rawOptions as $opt) {
                $service = $opt['service'] ?? '';
                $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower("{$courier}-{$service}"));
                $options[] = [
                    'id' => trim((string) $slug, '-'),
                    'courier_code' => $courier,
                    'courier_name' => $opt['name'] ?? strtoupper($courier),
                    'service' => $service,
                    'description' => $opt['description'] ?? '',
                    'cost' => (int) ($opt['cost'] ?? 0),
                    'etd' => $opt['etd'] ?? '',
                ];
            }
        } else {
            $options = $this->rajaOngkirService->calculateAllCouriers($originId, $destinationId, $weight, $couriers);
        }

        return response()->json([
            'success' => true,
            'origin_id' => $originId,
            'destination_id' => $destinationId,
            'weight' => $weight,
            'options' => $options,
        ]);
    }

    /**
     * Get available couriers and origin info for POS client
     */
    public function info(Request $request): JsonResponse
    {
        $user = $request->user();
        $shift = $user ? $this->cashierShiftService->getActiveShiftForUser($user->id) : null;
        $warehouse = $shift?->warehouse ?: ($user?->warehouse_id ? Warehouse::find($user->warehouse_id) : null);

        $originId = $warehouse?->rajaongkir_origin_id ?: $this->rajaOngkirService->getDefaultOriginId();
        $originLabel = $warehouse?->rajaongkir_origin_label ?: $this->rajaOngkirService->getDefaultOriginLabel();

        // Calculate active cart weight if available
        $cartWeight = 0;
        if ($user) {
            $carts = Cart::with('product')
                ->where('cashier_id', $user->id)
                ->whereNull('held_at')
                ->get();
            $cartWeight = $this->rajaOngkirService->calculateCartWeight($carts);
        }

        return response()->json([
            'enabled' => $this->rajaOngkirService->isEnabled(),
            'has_api_key' => $this->rajaOngkirService->hasApiKey(),
            'origin_id' => $originId,
            'origin_label' => $originLabel,
            'default_weight' => $this->rajaOngkirService->getDefaultWeight(),
            'cart_weight' => $cartWeight,
            'couriers' => $this->rajaOngkirService->getEnabledCouriers(),
        ]);
    }

    /**
     * Standalone Cek Ongkir Calculator Page
     */
    public function calculator(Request $request): InertiaResponse
    {
        $user = $request->user();
        $shift = $user ? $this->cashierShiftService->getActiveShiftForUser($user->id) : null;
        $warehouse = $shift?->warehouse ?: ($user?->warehouse_id ? Warehouse::find($user->warehouse_id) : null);

        $originId = $warehouse?->rajaongkir_origin_id ?: $this->rajaOngkirService->getDefaultOriginId();
        $originLabel = $warehouse?->rajaongkir_origin_label ?: $this->rajaOngkirService->getDefaultOriginLabel();

        return Inertia::render('Dashboard/Shipping/Calculator', [
            'isConfigured' => $this->rajaOngkirService->hasApiKey(),
            'defaultOrigin' => [
                'id' => $originId,
                'label' => $originLabel,
            ],
            'defaultWeight' => $this->rajaOngkirService->getDefaultWeight(),
            'couriers' => $this->rajaOngkirService->getEnabledCouriers(),
            'allCouriers' => $this->rajaOngkirService->getAllSupportedCouriers(),
        ]);
    }
}
