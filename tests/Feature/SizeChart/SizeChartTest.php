<?php

namespace Tests\Feature\SizeChart;

use App\Models\Category;
use App\Models\Product;
use App\Models\SizeChart;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class SizeChartTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Setup permissions
        $permissions = [
            'size-charts-access',
            'size-charts-create',
            'size-charts-edit',
            'size-charts-delete',
            'products-access',
            'products-create',
            'products-edit',
            'categories-access',
        ];

        foreach ($permissions as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'web']);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $adminRole->syncPermissions($permissions);

        $this->admin = User::factory()->create();
        $this->admin->assignRole($adminRole);

        $this->warehouse = Warehouse::create([
            'code' => 'TEST-WH',
            'name' => 'Test Warehouse',
            'type' => 'main',
            'is_active' => true,
            'sort_order' => 1,
        ]);
    }

    public function test_can_list_size_charts(): void
    {
        SizeChart::create([
            'name' => 'Kaos Dewasa',
            'code' => 'TSHIRT-01',
            'apparel_type' => 'tops',
            'default_unit' => 'cm',
            'columns' => [['key' => 'ld', 'label' => 'Lingkar Dada']],
            'measurements' => [['size' => 'M', 'ld' => 100]],
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->admin)->get(route('size-charts.index'));
        $response->assertOk();
    }

    public function test_can_create_size_chart(): void
    {
        $payload = [
            'name' => 'Kemeja Slim Fit',
            'code' => 'SHIRT-SLIM-01',
            'apparel_type' => 'tops',
            'default_unit' => 'cm',
            'columns' => [
                ['key' => 'ld', 'label' => 'Lingkar Dada'],
                ['key' => 'pb', 'label' => 'Panjang Baju'],
            ],
            'measurements' => [
                ['size' => 'S', 'ld' => '94', 'pb' => '68'],
                ['size' => 'M', 'ld' => '98', 'pb' => '70'],
            ],
            'fit_rules' => [
                ['size' => 'S', 'min_height' => 155, 'max_height' => 165, 'min_weight' => 48, 'max_weight' => 56],
                ['size' => 'M', 'min_height' => 165, 'max_height' => 175, 'min_weight' => 57, 'max_weight' => 67],
            ],
            'how_to_measure_notes' => 'Ukur lingkar dada pas.',
            'is_active' => true,
        ];

        $response = $this->actingAs($this->admin)->post(route('size-charts.store'), $payload);

        $response->assertRedirect(route('size-charts.index'));
        $this->assertDatabaseHas('size_charts', [
            'code' => 'SHIRT-SLIM-01',
            'name' => 'Kemeja Slim Fit',
        ]);
    }

    public function test_can_update_size_chart(): void
    {
        $chart = SizeChart::create([
            'name' => 'Original Name',
            'code' => 'CHART-ORIG',
            'apparel_type' => 'bottoms',
            'default_unit' => 'cm',
            'columns' => [['key' => 'lp', 'label' => 'Lingkar Pinggang']],
            'measurements' => [['size' => '28', 'lp' => 74]],
            'is_active' => true,
        ]);

        $payload = [
            'name' => 'Updated Denim Pants',
            'code' => 'CHART-ORIG',
            'apparel_type' => 'bottoms',
            'default_unit' => 'inch',
            'columns' => [
                ['key' => 'lp', 'label' => 'Lingkar Pinggang'],
                ['key' => 'pj', 'label' => 'Panjang Celana'],
            ],
            'measurements' => [
                ['size' => '28', 'lp' => '29', 'pj' => '39'],
            ],
            'fit_rules' => [],
            'is_active' => true,
        ];

        $response = $this->actingAs($this->admin)->put(route('size-charts.update', $chart->id), $payload);

        $response->assertRedirect(route('size-charts.index'));
        $this->assertDatabaseHas('size_charts', [
            'id' => $chart->id,
            'name' => 'Updated Denim Pants',
            'default_unit' => 'inch',
        ]);
    }

    public function test_cannot_delete_size_chart_if_in_use(): void
    {
        $chart = SizeChart::create([
            'name' => 'In Use Chart',
            'code' => 'IN-USE',
            'apparel_type' => 'tops',
            'default_unit' => 'cm',
            'columns' => [['key' => 'ld', 'label' => 'LD']],
            'measurements' => [['size' => 'M', 'ld' => 100]],
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Kaos Polos',
            'size_chart_id' => $chart->id,
        ]);

        $response = $this->actingAs($this->admin)->delete(route('size-charts.destroy', $chart->id));
        $response->assertSessionHas('error');
        $this->assertDatabaseHas('size_charts', ['id' => $chart->id]);
    }

    public function test_size_chart_hierarchy_resolution(): void
    {
        $categoryChart = SizeChart::create([
            'name' => 'Category Chart',
            'code' => 'CAT-CHART',
            'apparel_type' => 'tops',
            'columns' => [['key' => 'ld', 'label' => 'LD']],
            'measurements' => [['size' => 'M', 'ld' => 100]],
            'is_active' => true,
        ]);

        $productChart = SizeChart::create([
            'name' => 'Product Specific Chart',
            'code' => 'PROD-CHART',
            'apparel_type' => 'tops',
            'columns' => [['key' => 'ld', 'label' => 'LD']],
            'measurements' => [['size' => 'M', 'ld' => 105]],
            'is_active' => true,
        ]);

        $category = Category::create([
            'name' => 'Apparel Category',
            'size_chart_id' => $categoryChart->id,
        ]);

        // 1. Product without specific chart inherits category chart
        $prodInherited = Product::create([
            'barcode' => 'PROD-INH-001',
            'title' => 'Inherited Product',
            'category_id' => $category->id,
            'buy_price' => 50000,
            'sell_price' => 80000,
            'tax_rate' => 0,
            'stock' => 10,
        ]);

        $this->assertEquals($categoryChart->id, $prodInherited->resolved_size_chart->id);

        // 2. Product with direct override uses its own chart
        $prodOverride = Product::create([
            'barcode' => 'PROD-OVR-001',
            'title' => 'Override Product',
            'category_id' => $category->id,
            'size_chart_id' => $productChart->id,
            'buy_price' => 60000,
            'sell_price' => 100000,
            'tax_rate' => 0,
            'stock' => 5,
        ]);

        $this->assertEquals($productChart->id, $prodOverride->resolved_size_chart->id);

        // 3. Variant product inherits parent's resolution
        $variant = Product::create([
            'barcode' => 'PROD-OVR-001-RED-M',
            'title' => 'Override Product - Red M',
            'parent_id' => $prodOverride->id,
            'category_id' => $category->id,
            'buy_price' => 60000,
            'sell_price' => 100000,
            'tax_rate' => 0,
            'stock' => 5,
        ]);

        $this->assertEquals($productChart->id, SizeChart::resolveForProduct($variant)->id);
    }
}
