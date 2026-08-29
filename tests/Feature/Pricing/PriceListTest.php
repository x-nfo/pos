<?php

namespace Tests\Feature\Pricing;

use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerSegment;
use App\Models\PriceList;
use App\Models\PriceListItem;
use App\Models\Product;
use App\Models\User;
use App\Services\PriceListService;
use App\Services\PricingService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PriceListTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $cashier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([PermissionSeeder::class, RoleSeeder::class]);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('super-admin');

        $this->cashier = User::factory()->create();
        $this->cashier->assignRole('cashier');
    }

    public function test_guest_cannot_access_price_lists(): void
    {
        $response = $this->get(route('price-lists.index'));
        $response->assertRedirect(route('login'));
    }

    public function test_user_without_permission_cannot_access_price_lists(): void
    {
        $response = $this->actingAs($this->cashier)->get(route('price-lists.index'));
        $response->assertForbidden();
    }

    public function test_authorized_user_can_view_price_lists(): void
    {
        PriceList::create([
            'name' => 'Wholesale VIP',
            'slug' => 'wholesale-vip',
            'customer_scope' => 'all',
            'is_active' => true,
            'priority' => 10,
        ]);

        $response = $this->actingAs($this->admin)->get(route('price-lists.index'));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Settings/PriceLists')
            ->has('priceLists', 1)
            ->has('customerSegments')
        );
    }

    public function test_authorized_user_can_create_price_list_with_step_up_confirmation(): void
    {
        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->post(route('price-lists.store'), [
                'name' => 'Grosir Resto',
                'slug' => 'grosir-resto',
                'customer_scope' => 'registered',
                'is_active' => true,
                'priority' => 5,
                'notes' => 'Khusus resto mitra',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('price_lists', [
            'name' => 'Grosir Resto',
            'slug' => 'grosir-resto',
            'customer_scope' => 'registered',
            'is_active' => true,
            'priority' => 5,
        ]);
    }

    public function test_authorized_user_can_create_price_list_with_customer_segment(): void
    {
        $segment = CustomerSegment::create([
            'name' => 'Distributor Besar',
            'slug' => 'distributor-besar',
            'type' => CustomerSegment::TYPE_MANUAL,
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->post(route('price-lists.store'), [
                'name' => 'Harga Distributor',
                'slug' => 'harga-distributor',
                'customer_scope' => 'segment',
                'customer_segment_id' => $segment->id,
                'is_active' => true,
                'priority' => 20,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('price_lists', [
            'name' => 'Harga Distributor',
            'customer_scope' => 'segment',
            'customer_segment_id' => $segment->id,
        ]);
    }

    public function test_authorized_user_can_update_price_list(): void
    {
        $priceList = PriceList::create([
            'name' => 'Harga Lama',
            'slug' => 'harga-lama',
            'customer_scope' => 'all',
            'is_active' => true,
            'priority' => 0,
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->put(route('price-lists.update', $priceList->id), [
                'name' => 'Harga Baru',
                'slug' => 'harga-lama',
                'customer_scope' => 'member',
                'is_active' => false,
                'priority' => 15,
                'notes' => 'Diperbarui',
            ]);

        $response->assertRedirect();
        $priceList->refresh();

        $this->assertEquals('Harga Baru', $priceList->name);
        $this->assertEquals('member', $priceList->customer_scope);
        $this->assertFalse($priceList->is_active);
        $this->assertEquals(15, $priceList->priority);
    }

    public function test_authorized_user_can_delete_price_list(): void
    {
        $priceList = PriceList::create([
            'name' => 'Untuk Dihapus',
            'slug' => 'hapus-ini',
            'customer_scope' => 'all',
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->delete(route('price-lists.destroy', $priceList->id));

        $response->assertRedirect();
        $this->assertDatabaseMissing('price_lists', ['id' => $priceList->id]);
    }

    private function createProduct(array $overrides = []): Product
    {
        $category = Category::create([
            'name' => 'Kategori '.uniqid(),
            'description' => 'Deskripsi kategori',
            'image' => 'category.png',
        ]);

        return Product::create(array_merge([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BR-'.uniqid(),
            'sku' => 'SKU-'.uniqid(),
            'title' => 'Produk Uji '.uniqid(),
            'description' => 'Deskripsi produk uji',
            'buy_price' => 10000,
            'sell_price' => 20000,
            'stock' => 50,
            'tax_rate' => 0,
        ], $overrides));
    }

    public function test_authorized_user_can_view_price_list_items_page(): void
    {
        $product = $this->createProduct([
            'title' => 'Tepung Terigu 1kg',
            'buy_price' => 8000,
            'sell_price' => 12000,
        ]);

        $priceList = PriceList::create([
            'name' => 'Wholesale Terigu',
            'slug' => 'wholesale-terigu',
            'customer_scope' => 'all',
        ]);

        PriceListItem::create([
            'price_list_id' => $priceList->id,
            'product_id' => $product->id,
            'price' => 10500,
        ]);

        $response = $this->actingAs($this->admin)->get(route('price-lists.show', $priceList->id));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Settings/PriceListItems')
            ->has('priceList')
            ->has('products')
            ->has('categories')
        );
    }

    public function test_authorized_user_can_update_single_price_list_item(): void
    {
        $product = $this->createProduct([
            'title' => 'Minyak Goreng 2L',
            'buy_price' => 25000,
            'sell_price' => 32000,
        ]);

        $priceList = PriceList::create([
            'name' => 'Harga Grosir Sembako',
            'slug' => 'grosir-sembako',
            'customer_scope' => 'all',
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->post(route('price-lists.items.update', $priceList->id), [
                'product_id' => $product->id,
                'price' => 29000,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('price_list_items', [
            'price_list_id' => $priceList->id,
            'product_id' => $product->id,
            'price' => 29000,
        ]);
    }

    public function test_authorized_user_can_delete_single_price_list_item(): void
    {
        $product = $this->createProduct([
            'title' => 'Gula Pasir 1kg',
            'buy_price' => 14000,
            'sell_price' => 17500,
        ]);

        $priceList = PriceList::create([
            'name' => 'Harga Grosir',
            'slug' => 'harga-grosir',
            'customer_scope' => 'all',
        ]);

        PriceListItem::create([
            'price_list_id' => $priceList->id,
            'product_id' => $product->id,
            'price' => 16000,
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->delete(route('price-lists.items.destroy', [$priceList->id, $product->id]));

        $response->assertRedirect();
        $this->assertDatabaseMissing('price_list_items', [
            'price_list_id' => $priceList->id,
            'product_id' => $product->id,
        ]);
    }

    public function test_authorized_user_can_bulk_update_price_list_items(): void
    {
        $p1 = $this->createProduct([
            'title' => 'Produk A',
            'buy_price' => 10000,
            'sell_price' => 15000,
        ]);
        $p2 = $this->createProduct([
            'title' => 'Produk B',
            'buy_price' => 20000,
            'sell_price' => 30000,
        ]);

        $priceList = PriceList::create([
            'name' => 'Harga Grosir Toko',
            'slug' => 'grosir-toko',
            'customer_scope' => 'all',
        ]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->post(route('price-lists.items.bulk-update', $priceList->id), [
                'items' => [
                    ['product_id' => $p1->id, 'price' => 13500],
                    ['product_id' => $p2->id, 'price' => 27000],
                ],
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('price_list_items', [
            'price_list_id' => $priceList->id,
            'product_id' => $p1->id,
            'price' => 13500,
        ]);
        $this->assertDatabaseHas('price_list_items', [
            'price_list_id' => $priceList->id,
            'product_id' => $p2->id,
            'price' => 27000,
        ]);
    }

    public function test_authorized_user_can_bulk_destroy_price_list_items(): void
    {
        $p1 = $this->createProduct([
            'title' => 'Produk 1',
            'buy_price' => 5000,
            'sell_price' => 10000,
        ]);
        $p2 = $this->createProduct([
            'title' => 'Produk 2',
            'buy_price' => 6000,
            'sell_price' => 12000,
        ]);

        $priceList = PriceList::create([
            'name' => 'Price List Uji',
            'slug' => 'pl-uji',
            'customer_scope' => 'all',
        ]);

        PriceListItem::create(['price_list_id' => $priceList->id, 'product_id' => $p1->id, 'price' => 8500]);
        PriceListItem::create(['price_list_id' => $priceList->id, 'product_id' => $p2->id, 'price' => 10000]);

        $response = $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($this->admin)
            ->delete(route('price-lists.items.bulk-destroy', $priceList->id), [
                'product_ids' => [$p1->id, $p2->id],
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();
        $this->assertDatabaseMissing('price_list_items', ['price_list_id' => $priceList->id, 'product_id' => $p1->id]);
        $this->assertDatabaseMissing('price_list_items', ['price_list_id' => $priceList->id, 'product_id' => $p2->id]);
    }

    public function test_pricing_service_and_price_list_service_resolve_correct_pricing(): void
    {
        $product = $this->createProduct([
            'title' => 'Kopi Robusta 250g',
            'buy_price' => 20000,
            'sell_price' => 35000,
        ]);

        // Price list 1: General (priority 0) -> 32.000
        $generalList = PriceList::create([
            'name' => 'Harga Umum Promo',
            'slug' => 'umum-promo',
            'customer_scope' => 'all',
            'is_active' => true,
            'priority' => 0,
        ]);
        PriceListItem::create([
            'price_list_id' => $generalList->id,
            'product_id' => $product->id,
            'price' => 32000,
        ]);

        // Price list 2: Member (priority 10) -> 28.000
        $memberList = PriceList::create([
            'name' => 'Harga Khusus Member',
            'slug' => 'member-khusus',
            'customer_scope' => 'member',
            'is_active' => true,
            'priority' => 10,
        ]);
        PriceListItem::create([
            'price_list_id' => $memberList->id,
            'product_id' => $product->id,
            'price' => 28000,
        ]);

        $priceListService = app(PriceListService::class);
        $pricingService = app(PricingService::class);

        // 1. Walk-in / non-member customer -> matches General (32.000)
        $walkInList = $priceListService->getApplicablePriceList(null);
        $this->assertNotNull($walkInList);
        $this->assertEquals($generalList->id, $walkInList->id);
        $calculated = $pricingService->calculateProductPrice($product, 1, null);
        $this->assertEquals(32000, $calculated['base_unit_price']);

        // 2. Member customer -> matches Member list because priority 10 > 0 (28.000)
        $memberCustomer = Customer::create([
            'name' => 'Budi Member',
            'no_telp' => '08123456789',
            'address' => 'Jl. Mawar',
            'is_loyalty_member' => true,
        ]);

        $applicableForMember = $priceListService->getApplicablePriceList($memberCustomer);
        $this->assertNotNull($applicableForMember);
        $this->assertEquals($memberList->id, $applicableForMember->id);
        $calculatedMember = $pricingService->calculateProductPrice($product, 1, $memberCustomer);
        $this->assertEquals(28000, $calculatedMember['base_unit_price']);
    }
}
