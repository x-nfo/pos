<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicCatalogShippingTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouse;

    protected Category $category;

    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        Setting::set('tax_default_rate', '0.00');
        Setting::set('rajaongkir_api_key', 'test-api-key');
        Setting::set('rajaongkir_couriers', 'jne');
        Setting::set('rajaongkir_default_origin_id', '17593');

        $this->warehouse = Warehouse::create([
            'name' => 'Toko Pusat',
            'code' => 'PST01',
            'is_active' => true,
            'is_default' => true,
            'catalog_delivery_enabled' => true,
            'catalog_pickup_enabled' => true,
            'open_time' => '00:00',
            'close_time' => '23:59',
            'rajaongkir_origin_id' => '17593',
            'rajaongkir_origin_label' => 'Kebayoran Baru, Jakarta Selatan',
        ]);

        $this->category = Category::create([
            'name' => 'Pakaian Pria',
            'description' => 'Koleksi busana pria',
        ]);

        $this->product = Product::create([
            'category_id' => $this->category->id,
            'barcode' => 'SHIRT-001',
            'title' => 'Kemeja Katun Putih',
            'description' => 'Kemeja katun premium',
            'buy_price' => 75000,
            'sell_price' => 150000,
            'stock' => 20,
            'weight' => 350,
            'tax_rate' => 0,
        ]);
    }

    public function test_can_search_shipping_destinations_via_public_catalog(): void
    {
        Http::fake([
            'https://rajaongkir.komerce.id/api/v1/destination/domestic-destination*' => Http::response([
                'meta' => ['code' => 200, 'status' => 'success'],
                'data' => [
                    [
                        'id' => 1234,
                        'label' => 'Kebayoran Baru, Jakarta Selatan, DKI Jakarta',
                        'subdistrict_name' => 'Kebayoran Baru',
                        'district_name' => 'Kebayoran Baru',
                        'city_name' => 'Jakarta Selatan',
                        'province_name' => 'DKI Jakarta',
                        'zip_code' => '12110',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->getJson(route('catalog.shipping.destinations', [
            'search' => 'Kebayoran',
        ]));

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 1234)
            ->assertJsonPath('data.0.label', 'Kebayoran Baru, Jakarta Selatan, DKI Jakarta');
    }

    public function test_can_calculate_shipping_rates_for_public_catalog(): void
    {
        Http::fake([
            'https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost' => Http::response([
                'meta' => ['code' => 200, 'status' => 'success'],
                'data' => [
                    [
                        'name' => 'Jalur Nugraha Ekakurir (JNE)',
                        'code' => 'jne',
                        'service' => 'REG',
                        'description' => 'Layanan Reguler',
                        'cost' => 12000,
                        'etd' => '1-2',
                    ],
                    [
                        'name' => 'SiCepat Express',
                        'code' => 'sicepat',
                        'service' => 'SIUNT',
                        'description' => 'SiUntung',
                        'cost' => 11000,
                        'etd' => '1-3',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->postJson(route('catalog.shipping.calculate'), [
            'destination_id' => 1234,
            'warehouse_id' => $this->warehouse->id,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'qty' => 2, // 2 * 350g = 700g
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('weight', 700)
            ->assertJsonCount(2, 'rates')
            ->assertJsonPath('rates.0.cost', 11000)
            ->assertJsonPath('rates.1.cost', 12000);
    }

    public function test_can_checkout_catalog_order_with_shipping_details(): void
    {
        $response = $this->postJson(route('catalog.checkout'), [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '081234567890',
            'delivery_method' => 'delivery',
            'delivery_address' => 'Jl. Senopati No. 45, Kebayoran Baru',
            'shipping_cost' => 12000,
            'shipping_courier' => 'jne',
            'shipping_service' => 'REG',
            'shipping_etd' => '1-2',
            'shipping_weight' => 700,
            'shipping_destination_id' => 1234,
            'shipping_destination_label' => 'Kebayoran Baru, Jakarta Selatan, DKI Jakarta',
            'notes' => 'Tolong bubble wrap yang tebal',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'qty' => 2,
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'order' => [
                    'id',
                    'order_number',
                    'access_token',
                    'status',
                    'shipping_cost',
                    'shipping_courier',
                    'shipping_service',
                    'shipping_etd',
                    'shipping_weight',
                    'shipping_destination_id',
                    'shipping_destination_label',
                ],
            ]);

        $orderData = $response->json('order');

        // Subtotal = 2 * 150.000 = 300.000. Grand total = 300.000 + 12.000 = 312.000
        $this->assertDatabaseHas('catalog_orders', [
            'id' => $orderData['id'],
            'order_number' => $orderData['order_number'],
            'customer_name' => 'Budi Santoso',
            'delivery_method' => 'delivery',
            'subtotal' => 300000,
            'shipping_cost' => 12000,
            'grand_total' => 312000,
            'shipping_courier' => 'jne',
            'shipping_service' => 'REG',
            'shipping_etd' => '1-2',
            'shipping_weight' => 700,
            'shipping_destination_id' => 1234,
            'shipping_destination_label' => 'Kebayoran Baru, Jakarta Selatan, DKI Jakarta',
        ]);
    }

    public function test_catalog_order_status_page_displays_shipping_information(): void
    {
        $response = $this->postJson(route('catalog.checkout'), [
            'warehouse_id' => $this->warehouse->id,
            'customer_name' => 'Siti Rahma',
            'customer_phone' => '08987654321',
            'delivery_method' => 'delivery',
            'delivery_address' => 'Jl. Gandaria No. 10',
            'shipping_cost' => 15000,
            'shipping_courier' => 'sicepat',
            'shipping_service' => 'BEST',
            'shipping_etd' => '1',
            'shipping_weight' => 350,
            'shipping_destination_id' => 5678,
            'shipping_destination_label' => 'Kebayoran Lama, Jakarta Selatan',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'qty' => 1,
                ],
            ],
        ]);

        $accessToken = $response->json('order.access_token');

        $statusResponse = $this->get(route('catalog.order.status', $accessToken));

        $statusResponse->assertOk();
        $statusResponse->assertInertia(fn (Assert $page) => $page
            ->component('Public/CatalogOrderStatus')
            ->where('order.shipping_courier', 'sicepat')
            ->where('order.shipping_service', 'BEST')
            ->where('order.shipping_cost', 15000)
            ->where('order.shipping_etd', '1')
            ->where('order.shipping_destination_label', 'Kebayoran Lama, Jakarta Selatan')
            ->where('order.grand_total', 165000)
        );
    }
}
