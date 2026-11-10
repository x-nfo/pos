<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RajaOngkirService
{
    public const DEFAULT_BASE_URL = 'https://rajaongkir.komerce.id/api/v1';

    public const DEFAULT_WEIGHT = 1000; // in grams

    public const CACHE_TTL_DESTINATION = 86400; // 24 hours

    public const CACHE_TTL_COST = 1800; // 30 minutes

    public const HTTP_TIMEOUT_SECONDS = 10;

    public const HTTP_MAX_RETRIES = 2;

    public const SUPPORTED_COURIERS = [
        'jne' => [
            'code' => 'jne',
            'name' => 'JNE Express',
            'description' => 'Jalur Nugraha Ekakurir',
        ],
        'jnt' => [
            'code' => 'jnt',
            'name' => 'J&T Express',
            'description' => 'J&T Express Indonesia',
        ],
        'sicepat' => [
            'code' => 'sicepat',
            'name' => 'SiCepat',
            'description' => 'SiCepat Ekspres',
        ],
        'pos' => [
            'code' => 'pos',
            'name' => 'POS Indonesia',
            'description' => 'PT Pos Indonesia',
        ],
        'tiki' => [
            'code' => 'tiki',
            'name' => 'TIKI',
            'description' => 'Titipan Kilat',
        ],
        'anteraja' => [
            'code' => 'anteraja',
            'name' => 'AnterAja',
            'description' => 'AnterAja Logistics',
        ],
        'ninja' => [
            'code' => 'ninja',
            'name' => 'Ninja Express',
            'description' => 'Ninja Van Indonesia',
        ],
        'lion' => [
            'code' => 'lion',
            'name' => 'Lion Parcel',
            'description' => 'Lion Parcel Indonesia',
        ],
        'idexpress' => [
            'code' => 'idexpress',
            'name' => 'ID Express',
            'description' => 'ID Express Logistics',
        ],
        'wahana' => [
            'code' => 'wahana',
            'name' => 'Wahana',
            'description' => 'Wahana Prestasi Logistik',
        ],
        'sap' => [
            'code' => 'sap',
            'name' => 'SAP Express',
            'description' => 'SAP Express Courier',
        ],
    ];

    /**
     * Check if API key is configured
     */
    public function hasApiKey(): bool
    {
        return ! empty($this->getApiKey());
    }

    /**
     * Check if RajaOngkir feature is enabled
     */
    public function isEnabled(): bool
    {
        return Setting::getBool('rajaongkir_is_active', true) && $this->hasApiKey();
    }

    /**
     * Get API key
     */
    public function getApiKey(): ?string
    {
        $dbKey = Setting::get('rajaongkir_api_key');
        if (! empty($dbKey)) {
            return trim($dbKey);
        }

        return config('services.rajaongkir.api_key');
    }

    /**
     * Get API Base URL
     */
    public function getBaseUrl(): string
    {
        $url = Setting::get('rajaongkir_base_url', config('services.rajaongkir.base_url', self::DEFAULT_BASE_URL));

        return rtrim($url ?: self::DEFAULT_BASE_URL, '/');
    }

    /**
     * Get default origin ID
     */
    public function getDefaultOriginId(): ?int
    {
        $originId = Setting::get('rajaongkir_origin_id', config('services.rajaongkir.origin_id'));

        return $originId ? (int) $originId : null;
    }

    /**
     * Get default origin label
     */
    public function getDefaultOriginLabel(): ?string
    {
        return Setting::get('rajaongkir_origin_label', config('services.rajaongkir.origin_label', ''));
    }

    /**
     * Get default weight in grams
     */
    public function getDefaultWeight(): int
    {
        $weight = Setting::getInt('rajaongkir_default_weight', config('services.rajaongkir.default_weight', self::DEFAULT_WEIGHT));

        return $weight > 0 ? $weight : self::DEFAULT_WEIGHT;
    }

    /**
     * Get list of enabled couriers
     *
     * @return array<int, array{code: string, name: string, description: string}>
     */
    public function getEnabledCouriers(): array
    {
        $settingCouriers = Setting::get('rajaongkir_couriers', config('services.rajaongkir.enabled_couriers', 'jne,jnt,sicepat,pos,tiki,anteraja'));

        $codes = array_filter(array_map('trim', explode(',', strtolower((string) $settingCouriers))));

        $result = [];
        foreach ($codes as $code) {
            if (isset(self::SUPPORTED_COURIERS[$code])) {
                $result[] = self::SUPPORTED_COURIERS[$code];
            }
        }

        if (empty($result)) {
            $result = array_values(array_intersect_key(
                self::SUPPORTED_COURIERS,
                array_flip(['jne', 'jnt', 'sicepat'])
            ));
        }

        return $result;
    }

    /**
     * Get all supported couriers
     */
    public function getAllSupportedCouriers(): array
    {
        return array_values(self::SUPPORTED_COURIERS);
    }

    /**
     * Search domestic destinations (city, district, subdistrict, postal code)
     *
     * @return array<int, array{
     *     id: int,
     *     label: string,
     *     province_name: string,
     *     city_name: string,
     *     district_name: string,
     *     subdistrict_name: string,
     *     zip_code: string
     * }>
     */
    public function searchDestinations(string $search, int $limit = 10, int $offset = 0): array
    {
        $normalized = trim($search);
        if (mb_strlen($normalized) < 3) {
            return [];
        }

        if (! $this->hasApiKey()) {
            return [];
        }

        $limit = max(1, min(50, $limit));
        $offset = max(0, $offset);
        $cacheKey = 'rajaongkir:dest:'.md5(strtolower($normalized)).":{$limit}:{$offset}";

        return Cache::remember($cacheKey, self::CACHE_TTL_DESTINATION, function () use ($normalized, $limit, $offset) {
            try {
                $response = Http::withHeaders([
                    'key' => $this->getApiKey(),
                ])
                    ->timeout(self::HTTP_TIMEOUT_SECONDS)
                    ->retry(self::HTTP_MAX_RETRIES, 200, throw: false)
                    ->get("{$this->getBaseUrl()}/destination/domestic-destination", [
                        'search' => $normalized,
                        'limit' => $limit,
                        'offset' => $offset,
                    ]);

                if (! $response->successful()) {
                    Log::warning('RajaOngkir search destination failed', [
                        'status' => $response->status(),
                        'search' => $normalized,
                        'body' => $response->json(),
                    ]);

                    return [];
                }

                $json = $response->json();
                $data = $json['data'] ?? [];

                if (! is_array($data)) {
                    return [];
                }

                return array_map(function ($item) {
                    return [
                        'id' => (int) ($item['id'] ?? 0),
                        'label' => (string) ($item['label'] ?? ''),
                        'province_name' => (string) ($item['province_name'] ?? ''),
                        'city_name' => (string) ($item['city_name'] ?? ''),
                        'district_name' => (string) ($item['district_name'] ?? ''),
                        'subdistrict_name' => (string) ($item['subdistrict_name'] ?? ''),
                        'zip_code' => (string) ($item['zip_code'] ?? ''),
                    ];
                }, $data);
            } catch (\Throwable $e) {
                Log::error('RajaOngkir search destination exception: '.$e->getMessage(), [
                    'search' => $normalized,
                ]);

                return [];
            }
        });
    }

    /**
     * Calculate shipping cost for a single courier
     *
     * @return array<int, array{
     *     name: string,
     *     code: string,
     *     service: string,
     *     description: string,
     *     cost: int,
     *     etd: string
     * }>
     */
    public function calculateCost(int $origin, int $destination, int $weight, string $courier): array
    {
        if (! $this->hasApiKey()) {
            return [];
        }

        $courier = strtolower(trim($courier));
        $weight = max(1, $weight);
        $cacheKey = "rajaongkir:cost:{$origin}:{$destination}:{$weight}:{$courier}";

        return Cache::remember($cacheKey, self::CACHE_TTL_COST, function () use ($origin, $destination, $weight, $courier) {
            try {
                $response = Http::withHeaders([
                    'key' => $this->getApiKey(),
                ])
                    ->asForm()
                    ->timeout(self::HTTP_TIMEOUT_SECONDS)
                    ->retry(self::HTTP_MAX_RETRIES, 200, throw: false)
                    ->post("{$this->getBaseUrl()}/calculate/domestic-cost", [
                        'origin' => $origin,
                        'destination' => $destination,
                        'weight' => $weight,
                        'courier' => $courier,
                    ]);

                if (! $response->successful()) {
                    Log::warning("RajaOngkir calculate cost failed for {$courier}", [
                        'status' => $response->status(),
                        'origin' => $origin,
                        'destination' => $destination,
                        'weight' => $weight,
                        'response' => $response->json(),
                    ]);

                    return [];
                }

                $json = $response->json();
                $data = $json['data'] ?? [];

                if (! is_array($data)) {
                    return [];
                }

                $courierMeta = self::SUPPORTED_COURIERS[$courier] ?? null;

                return array_map(function ($item) use ($courier, $courierMeta) {
                    return [
                        'name' => (string) ($courierMeta['name'] ?? $item['name'] ?? strtoupper($courier)),
                        'code' => $courier,
                        'service' => (string) ($item['service'] ?? ''),
                        'description' => (string) ($item['description'] ?? ''),
                        'cost' => (int) ($item['cost'] ?? 0),
                        'etd' => (string) ($item['etd'] ?? ''),
                    ];
                }, $data);
            } catch (\Throwable $e) {
                Log::error("RajaOngkir calculate cost exception for {$courier}: ".$e->getMessage());

                return [];
            }
        });
    }

    /**
     * Calculate shipping costs for multiple couriers in parallel using HTTP pool
     *
     * @param  array<int, string>|null  $courierCodes  Optional custom couriers list
     * @return array<int, array{
     *     id: string,
     *     courier_code: string,
     *     courier_name: string,
     *     service: string,
     *     description: string,
     *     cost: int,
     *     etd: string
     * }>
     */
    public function calculateAllCouriers(int $origin, int $destination, int $weight, ?array $courierCodes = null): array
    {
        if (! $this->hasApiKey()) {
            return [];
        }

        $weight = max(1, $weight);

        if (empty($courierCodes)) {
            $enabled = $this->getEnabledCouriers();
            $courierCodes = array_column($enabled, 'code');
        } else {
            $courierCodes = array_map('strtolower', array_map('trim', $courierCodes));
        }

        $results = [];
        $uncachedCouriers = [];

        // Check cache first for each courier
        foreach ($courierCodes as $code) {
            $cacheKey = "rajaongkir:cost:{$origin}:{$destination}:{$weight}:{$code}";
            if (Cache::has($cacheKey)) {
                $cached = Cache::get($cacheKey);
                if (is_array($cached)) {
                    foreach ($cached as $item) {
                        $results[] = $this->formatShippingOption($code, $item);
                    }
                }
            } else {
                $uncachedCouriers[] = $code;
            }
        }

        // Fetch uncached couriers in parallel
        if (! empty($uncachedCouriers)) {
            $apiKey = $this->getApiKey();
            $baseUrl = $this->getBaseUrl();

            try {
                $responses = Http::pool(function (Pool $pool) use ($uncachedCouriers, $origin, $destination, $weight, $apiKey, $baseUrl) {
                    $requests = [];
                    foreach ($uncachedCouriers as $code) {
                        $requests[$code] = $pool->as($code)
                            ->withHeaders(['key' => $apiKey])
                            ->asForm()
                            ->timeout(self::HTTP_TIMEOUT_SECONDS)
                            ->post("{$baseUrl}/calculate/domestic-cost", [
                                'origin' => $origin,
                                'destination' => $destination,
                                'weight' => $weight,
                                'courier' => $code,
                            ]);
                    }

                    return $requests;
                });

                foreach ($uncachedCouriers as $code) {
                    $response = $responses[$code] ?? null;

                    if ($response instanceof Response && $response->successful()) {
                        $json = $response->json();
                        $data = $json['data'] ?? [];

                        if (is_array($data)) {
                            $courierMeta = self::SUPPORTED_COURIERS[$code] ?? null;
                            $normalized = array_map(function ($item) use ($code, $courierMeta) {
                                return [
                                    'name' => (string) ($courierMeta['name'] ?? $item['name'] ?? strtoupper($code)),
                                    'code' => $code,
                                    'service' => (string) ($item['service'] ?? ''),
                                    'description' => (string) ($item['description'] ?? ''),
                                    'cost' => (int) ($item['cost'] ?? 0),
                                    'etd' => (string) ($item['etd'] ?? ''),
                                ];
                            }, $data);

                            // Store in cache
                            $cacheKey = "rajaongkir:cost:{$origin}:{$destination}:{$weight}:{$code}";
                            Cache::put($cacheKey, $normalized, self::CACHE_TTL_COST);

                            foreach ($normalized as $item) {
                                $results[] = $this->formatShippingOption($code, $item);
                            }
                        }
                    } else {
                        Log::warning("RajaOngkir pool failed for {$code}", [
                            'status' => $response instanceof Response ? $response->status() : null,
                            'error' => $response instanceof \Throwable ? $response->getMessage() : null,
                        ]);
                    }
                }
            } catch (\Throwable $e) {
                Log::error('RajaOngkir pool exception: '.$e->getMessage());
            }
        }

        // Sort ascending by cost
        usort($results, fn ($a, $b) => $a['cost'] <=> $b['cost']);

        return $results;
    }

    /**
     * Helper to format a shipping option result
     */
    protected function formatShippingOption(string $courierCode, array $item): array
    {
        $courierMeta = self::SUPPORTED_COURIERS[$courierCode] ?? null;
        $courierName = $courierMeta['name'] ?? ($item['name'] ?? strtoupper($courierCode));
        $service = $item['service'] ?? '';

        $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower("{$courierCode}-{$service}"));

        return [
            'id' => trim((string) $slug, '-'),
            'courier_code' => $courierCode,
            'courier_name' => $courierName,
            'service' => $service,
            'description' => $item['description'] ?? '',
            'cost' => (int) ($item['cost'] ?? 0),
            'etd' => $item['etd'] ?? '',
        ];
    }

    /**
     * Calculate total weight from cart / order items
     *
     * @param  iterable  $items  Collection or array of items with product relationship or weight
     */
    public function calculateCartWeight(iterable $items): int
    {
        $totalWeight = 0;
        $defaultWeight = $this->getDefaultWeight();

        foreach ($items as $item) {
            $qty = (int) ($item->qty ?? $item['qty'] ?? 1);
            $product = $item->product ?? null;

            $itemWeight = 0;
            if ($product && isset($product->weight) && (int) $product->weight > 0) {
                $itemWeight = (int) $product->weight;
            } elseif (is_array($item) && isset($item['weight']) && (int) $item['weight'] > 0) {
                $itemWeight = (int) $item['weight'];
            } elseif (is_object($item) && isset($item->weight) && (int) $item->weight > 0) {
                $itemWeight = (int) $item->weight;
            } else {
                $itemWeight = $defaultWeight;
            }

            $totalWeight += ($itemWeight * max(1, $qty));
        }

        return max(1, $totalWeight);
    }

    /**
     * Test connection to RajaOngkir API
     *
     * @return array{success: bool, message: string, data?: mixed}
     */
    public function testConnection(?string $apiKey = null, ?string $baseUrl = null): array
    {
        $key = $apiKey ?: $this->getApiKey();
        if (empty($key)) {
            return [
                'success' => false,
                'message' => 'API Key RajaOngkir belum diisi.',
            ];
        }

        $url = rtrim($baseUrl ?: $this->getBaseUrl(), '/');

        try {
            $response = Http::withHeaders([
                'key' => $key,
            ])
                ->timeout(self::HTTP_TIMEOUT_SECONDS)
                ->get("{$url}/destination/domestic-destination", [
                    'search' => 'bandung',
                    'limit' => 2,
                ]);

            if ($response->successful()) {
                $json = $response->json();
                $count = count($json['data'] ?? []);

                return [
                    'success' => true,
                    'message' => "Koneksi berhasil! RajaOngkir API aktif ({$count} destinasi sample ditemukan).",
                    'data' => $json['data'] ?? [],
                ];
            }

            $status = $response->status();
            $meta = $response->json('meta.message') ?: $response->body();

            return [
                'success' => false,
                'message' => "Koneksi gagal (HTTP {$status}): {$meta}",
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'Gagal menghubungi server RajaOngkir: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Clear all RajaOngkir cached data
     */
    public function clearCache(): void
    {
        // Flush rajaongkir tag if available, or invalidate keys
        try {
            Cache::flush();
        } catch (\Throwable) {
            // Ignore if flush not supported
        }
    }
}
