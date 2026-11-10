<?php

namespace Tests\Unit\Services;

use App\Models\Product;
use App\Models\Setting;
use App\Services\RajaOngkirService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RajaOngkirServiceTest extends TestCase
{
    use RefreshDatabase;

    protected RajaOngkirService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(RajaOngkirService::class);
        Cache::flush();
    }

    public function test_api_key_and_enabled_status(): void
    {
        Setting::set('rajaongkir_api_key', 'test_api_key_123');
        Setting::set('rajaongkir_is_active', '1');

        $this->assertTrue($this->service->hasApiKey());
        $this->assertEquals('test_api_key_123', $this->service->getApiKey());
        $this->assertTrue($this->service->isEnabled());

        Setting::set('rajaongkir_is_active', '0');
        $this->assertFalse($this->service->isEnabled());
    }

    public function test_search_destinations_with_mocked_http(): void
    {
        Setting::set('rajaongkir_api_key', 'test_key');

        Http::fake([
            '*/destination/domestic-destination*' => Http::response([
                'meta' => ['message' => 'Success', 'code' => 200, 'status' => 'success'],
                'data' => [
                    [
                        'id' => 4866,
                        'label' => 'BATUNUNGGAL, BANDUNG KIDUL, BANDUNG, JAWA BARAT, 40266',
                        'province_name' => 'JAWA BARAT',
                        'city_name' => 'BANDUNG',
                        'district_name' => 'BANDUNG KIDUL',
                        'subdistrict_name' => 'BATUNUNGGAL',
                        'zip_code' => '40266',
                    ],
                ],
            ], 200),
        ]);

        $results = $this->service->searchDestinations('bandung');

        $this->assertCount(1, $results);
        $this->assertEquals(4866, $results[0]['id']);
        $this->assertEquals('BANDUNG', $results[0]['city_name']);

        // Check short query returns empty without calling HTTP
        $emptyResults = $this->service->searchDestinations('ba');
        $this->assertEmpty($emptyResults);
    }

    public function test_calculate_cost_single_courier(): void
    {
        Setting::set('rajaongkir_api_key', 'test_key');

        Http::fake([
            '*/calculate/domestic-cost*' => Http::response([
                'meta' => ['message' => 'Success', 'code' => 200, 'status' => 'success'],
                'data' => [
                    [
                        'name' => 'Jalur Nugraha Ekakurir (JNE)',
                        'code' => 'jne',
                        'service' => 'REG',
                        'description' => 'Layanan Reguler',
                        'cost' => 12000,
                        'etd' => '1-2 day',
                    ],
                ],
            ], 200),
        ]);

        $options = $this->service->calculateCost(17593, 4866, 1000, 'jne');

        $this->assertCount(1, $options);
        $this->assertEquals('REG', $options[0]['service']);
        $this->assertEquals(12000, $options[0]['cost']);
        $this->assertEquals('jne', $options[0]['code']);
    }

    public function test_calculate_all_couriers_in_parallel(): void
    {
        Setting::set('rajaongkir_api_key', 'test_key');

        Http::fake([
            '*/calculate/domestic-cost*' => Http::sequence()
                ->push([
                    'meta' => ['status' => 'success'],
                    'data' => [
                        ['service' => 'REG', 'cost' => 15000, 'etd' => '2-3 hari', 'description' => 'Reguler'],
                    ],
                ])
                ->push([
                    'meta' => ['status' => 'success'],
                    'data' => [
                        ['service' => 'EZ', 'cost' => 10000, 'etd' => '1-2 hari', 'description' => 'Reguler J&T'],
                    ],
                ]),
        ]);

        $results = $this->service->calculateAllCouriers(17593, 4866, 1000, ['jne', 'jnt']);

        $this->assertNotEmpty($results);
        // Ensure sorted by cost ascending (10000 before 15000)
        $this->assertEquals(10000, $results[0]['cost']);
        $this->assertEquals('jnt', $results[0]['courier_code']);
    }

    public function test_calculate_cart_weight(): void
    {
        // Remember critical gotcha: test Product::create should have tax_rate=0
        $productA = new Product([
            'title' => 'Product A',
            'weight' => 500,
        ]);
        $productB = new Product([
            'title' => 'Product B',
            'weight' => 0, // Fallback to default
        ]);

        $items = [
            (object) ['qty' => 2, 'product' => $productA], // 2 * 500 = 1000
            (object) ['qty' => 1, 'product' => $productB], // 1 * 1000 (default) = 1000
        ];

        $totalWeight = $this->service->calculateCartWeight($items);

        $this->assertEquals(2000, $totalWeight);
    }

    public function test_test_connection_success_and_failure(): void
    {
        Http::fake([
            '*/destination/domestic-destination*' => Http::response([
                'meta' => ['message' => 'Success', 'code' => 200, 'status' => 'success'],
                'data' => [['id' => 1, 'label' => 'Sample Destination']],
            ], 200),
        ]);

        $successRes = $this->service->testConnection('valid_key');
        $this->assertTrue($successRes['success']);

        // Empty key test
        $emptyRes = $this->service->testConnection('');
        $this->assertFalse($emptyRes['success']);
    }
}
