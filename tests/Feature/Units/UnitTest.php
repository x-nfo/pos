<?php

namespace Tests\Feature\Units;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UnitTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $cashier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class, UserSeeder::class]);
        $this->admin = User::role('super-admin')->first() ?? User::where('email', 'admin@mail.com')->first();
        $this->admin->markEmailAsVerified();

        $this->cashier = User::role('cashier')->first() ?? User::where('email', 'cashier@gmail.com')->first();
        $this->cashier->markEmailAsVerified();
    }

    public function test_guest_cannot_access_units_page(): void
    {
        $response = $this->get(route('units.index'));
        $response->assertRedirect(route('login'));
    }

    public function test_cashier_without_permission_cannot_access_units_page(): void
    {
        $response = $this->actingAs($this->cashier)->get(route('units.index'));
        $response->assertForbidden();
    }

    public function test_admin_can_view_units_page(): void
    {
        $response = $this->actingAs($this->admin)->get(route('units.index'));
        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Dashboard/Units/Index')
                ->has('units.data')
            );
    }

    public function test_admin_can_search_units(): void
    {
        Unit::create(['code' => 'TESTKARTON', 'name' => 'Karton Khusus', 'symbol' => 'ktn']);

        $response = $this->actingAs($this->admin)->get(route('units.index', ['search' => 'TESTKARTON']));
        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Dashboard/Units/Index')
                ->where('units.data.0.code', 'TESTKARTON')
            );
    }

    public function test_admin_can_create_unit(): void
    {
        $payload = [
            'code' => 'pack',
            'name' => 'Pack / Paket',
            'symbol' => 'pak',
        ];

        $response = $this->actingAs($this->admin)->post(route('units.store'), $payload);

        $response->assertRedirect(route('units.index'))
            ->assertSessionHas('success', 'Satuan berhasil ditambahkan.');

        $this->assertDatabaseHas('units', [
            'code' => 'PACK', // verify uppercase mutator
            'name' => 'Pack / Paket',
            'symbol' => 'pak',
        ]);
    }

    public function test_unit_creation_validates_required_and_unique_code(): void
    {
        Unit::create(['code' => 'CUP', 'name' => 'Cup Saji', 'symbol' => 'cup']);

        // Missing fields
        $response = $this->actingAs($this->admin)->post(route('units.store'), []);
        $response->assertSessionHasErrors(['code', 'name', 'symbol']);

        // Duplicate code
        $response = $this->actingAs($this->admin)->post(route('units.store'), [
            'code' => 'cup',
            'name' => 'Cup Minuman',
            'symbol' => 'cp',
        ]);
        $response->assertSessionHasErrors(['code']);
    }

    public function test_admin_can_quick_store_unit_via_ajax(): void
    {
        $payload = [
            'code' => 'PORSI',
            'name' => 'Porsi Makanan',
            'symbol' => 'prs',
        ];

        $response = $this->actingAs($this->admin)->postJson(route('units.quick-store'), $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Satuan berhasil ditambahkan.',
                'data' => [
                    'code' => 'PORSI',
                    'name' => 'Porsi Makanan',
                    'symbol' => 'prs',
                ],
            ]);

        $this->assertDatabaseHas('units', [
            'code' => 'PORSI',
            'name' => 'Porsi Makanan',
            'symbol' => 'prs',
        ]);
    }

    public function test_admin_can_edit_and_update_unit(): void
    {
        $unit = Unit::create(['code' => 'RIM', 'name' => 'Rim Kertas', 'symbol' => 'rim']);

        // Render edit page
        $editResponse = $this->actingAs($this->admin)->get(route('units.edit', $unit->id));
        $editResponse->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Dashboard/Units/Edit')
                ->where('unit.id', $unit->id)
            );

        // Submit update
        $updateResponse = $this->actingAs($this->admin)->put(route('units.update', $unit->id), [
            'code' => 'RIM',
            'name' => 'Rim Kertas 500 Lembar',
            'symbol' => 'rm',
        ]);

        $updateResponse->assertRedirect(route('units.index'))
            ->assertSessionHas('success', 'Satuan berhasil diperbarui.');

        $this->assertDatabaseHas('units', [
            'id' => $unit->id,
            'code' => 'RIM',
            'name' => 'Rim Kertas 500 Lembar',
            'symbol' => 'rm',
        ]);
    }

    public function test_admin_can_delete_unused_unit(): void
    {
        $unit = Unit::create(['code' => 'SAMPLE', 'name' => 'Sample Unit', 'symbol' => 'smp']);

        $response = $this->actingAs($this->admin)->delete(route('units.destroy', $unit->id));

        $response->assertRedirect(route('units.index'))
            ->assertSessionHas('success', 'Satuan berhasil dihapus.');

        $this->assertDatabaseMissing('units', [
            'id' => $unit->id,
        ]);
    }

    public function test_unit_cannot_be_deleted_if_used_by_products(): void
    {
        $unit = Unit::create(['code' => 'LUSIN', 'name' => 'Lusin', 'symbol' => 'lsn']);
        $category = Category::create(['name' => 'Alat Tulis']);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'buku.png',
            'barcode' => '89999990001',
            'title' => 'Buku Tulis',
            'description' => 'Buku Tulis Sidu 38 Lembar',
            'buy_price' => 2000,
            'sell_price' => 3000,
            'stock' => 50,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $product->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 50]);

        // Attach unit to product via product_units
        $product->units()->attach($unit->id, [
            'is_base' => false,
            'conversion_factor' => 12,
            'buy_price' => 24000,
            'sell_price' => 36000,
            'barcode' => '89999990001-LUSIN',
        ]);

        $response = $this->actingAs($this->admin)->delete(route('units.destroy', $unit->id));

        $response->assertSessionHas('error');
        $this->assertDatabaseHas('units', [
            'id' => $unit->id,
        ]);
    }
}
