<?php

namespace Tests\Feature\MasterData;

use App\Models\Category;
use App\Models\Customer;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\Receivable;
use App\Models\StockMutation;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MasterDataProtectionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
            UserSeeder::class,
        ]);

        $this->admin = User::where('email', 'admin@mail.com')->first();
    }

    public function test_cannot_delete_product_with_transaction_details(): void
    {
        $category = Category::create(['name' => 'Minuman', 'image' => '', 'description' => 'Minuman']);
        $product = Product::create([
            'image' => '',
            'barcode' => 'PRD-PROTECT-1',
            'sku' => 'SKU-PROTECT-1',
            'title' => 'Kopi Susu Historis',
            'description' => 'Kopi Susu',
            'category_id' => $category->id,
            'buy_price' => 5000,
            'sell_price' => 10000,
            'stock' => 0,
            'tax_rate' => 0,
        ]);

        $transaction = Transaction::create([
            'invoice' => 'TRX-PROTECT-001',
            'cashier_id' => $this->admin->id,
            'cash' => 10000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 10000,
        ]);

        TransactionDetail::create([
            'transaction_id' => $transaction->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => 10000,
        ]);

        // Attempt web deletion
        $this->actingAs($this->admin)
            ->from(route('products.index'))
            ->delete(route('products.destroy', $product->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('products', ['id' => $product->id, 'deleted_at' => null]);

        // Attempt API deletion
        Sanctum::actingAs($this->admin);
        $this->deleteJson("/api/v1/products/{$product->id}")
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_cannot_delete_product_with_stock_mutations(): void
    {
        $category = Category::create(['name' => 'Snack', 'image' => '', 'description' => '']);
        $product = Product::create([
            'image' => '',
            'barcode' => 'PRD-STOCK-1',
            'sku' => 'SKU-STOCK-1',
            'title' => 'Keripik Singkong',
            'description' => 'Snack',
            'category_id' => $category->id,
            'buy_price' => 2000,
            'sell_price' => 5000,
            'stock' => 25,
            'tax_rate' => 0,
        ]);

        StockMutation::create([
            'product_id' => $product->id,
            'reference_type' => 'manual',
            'mutation_type' => 'in',
            'qty' => 25,
            'stock_before' => 0,
            'stock_after' => 25,
            'notes' => 'Penyesuaian stok fisik',
            'created_by' => $this->admin->id,
        ]);

        $this->actingAs($this->admin)
            ->from(route('products.index'))
            ->delete(route('products.destroy', $product->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('products', ['id' => $product->id, 'deleted_at' => null]);
    }

    public function test_can_soft_delete_clean_product(): void
    {
        $category = Category::create(['name' => 'Snack', 'image' => '', 'description' => '']);
        $product = Product::create([
            'image' => '',
            'barcode' => 'PRD-CLEAN-1',
            'sku' => 'SKU-CLEAN-1',
            'title' => 'Produk Baru Bersih',
            'description' => 'Deskripsi',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 0,
            'tax_rate' => 0,
        ]);

        $this->actingAs($this->admin)
            ->from(route('products.index'))
            ->delete(route('products.destroy', $product->id))
            ->assertSessionHas('success');

        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertNull(Product::find($product->id));
        $this->assertNotNull(Product::withTrashed()->find($product->id));
    }

    public function test_can_recreate_product_with_same_barcode_after_soft_delete(): void
    {
        $category = Category::create(['name' => 'Snack', 'image' => '', 'description' => '']);
        $product = Product::create([
            'image' => '',
            'barcode' => '089686010824',
            'sku' => 'SKU-SAME-1',
            'title' => 'Produk Awal',
            'description' => 'Deskripsi',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 0,
            'tax_rate' => 0,
        ]);

        // Delete the product
        $this->actingAs($this->admin)
            ->from(route('products.index'))
            ->delete(route('products.destroy', $product->id))
            ->assertSessionHas('success');

        $this->assertSoftDeleted('products', ['id' => $product->id]);

        // Now create a new product with the same barcode
        $response = $this->actingAs($this->admin)
            ->post(route('products.store'), [
                'barcode' => '089686010824',
                'sku' => 'SKU-SAME-1',
                'title' => 'Produk Baru Barcode Sama',
                'description' => 'Deskripsi baru',
                'category_id' => $category->id,
                'buy_price' => 1500,
                'sell_price' => 2500,
                'stock' => 10,
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect(route('products.index'));

        $this->assertDatabaseHas('products', [
            'barcode' => '089686010824',
            'sku' => 'SKU-SAME-1',
            'title' => 'Produk Baru Barcode Sama',
            'deleted_at' => null,
        ]);
    }

    public function test_cannot_delete_category_with_products(): void
    {
        $category = Category::create(['name' => 'Kategori Terkait', 'image' => '', 'description' => '']);
        $product = Product::create([
            'image' => '',
            'barcode' => 'PRD-CAT-1',
            'sku' => 'SKU-CAT-1',
            'title' => 'Produk Dalam Kategori',
            'description' => 'Deskripsi',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 0,
            'tax_rate' => 0,
        ]);

        // Attempt web delete
        $this->actingAs($this->admin)
            ->from(route('categories.index'))
            ->delete(route('categories.destroy', $category->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('categories', ['id' => $category->id, 'deleted_at' => null]);

        // Attempt API delete
        Sanctum::actingAs($this->admin);
        $this->deleteJson("/api/v1/categories/{$category->id}")
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_cannot_delete_category_with_pricing_rules(): void
    {
        $category = Category::create(['name' => 'Kategori Promo', 'image' => '', 'description' => '']);
        PricingRule::create([
            'name' => 'Diskon Kategori Promo',
            'rule_type' => 'discount',
            'target_type' => 'category',
            'category_id' => $category->id,
            'discount_type' => 'percentage',
            'discount_value' => 10,
            'is_active' => true,
        ]);

        $this->actingAs($this->admin)
            ->from(route('categories.index'))
            ->delete(route('categories.destroy', $category->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('categories', ['id' => $category->id, 'deleted_at' => null]);
    }

    public function test_can_soft_delete_empty_category(): void
    {
        $category = Category::create(['name' => 'Kategori Kosong', 'image' => '', 'description' => '']);

        $this->actingAs($this->admin)
            ->from(route('categories.index'))
            ->delete(route('categories.destroy', $category->id))
            ->assertSessionHas('success');

        $this->assertSoftDeleted('categories', ['id' => $category->id]);
        $this->assertNull(Category::find($category->id));
    }

    public function test_cannot_delete_customer_with_transactions(): void
    {
        $customer = Customer::create([
            'name' => 'Pelanggan Setia',
            'no_telp' => '081234567890',
            'address' => 'Jakarta',
            'is_loyalty_member' => false,
        ]);

        Transaction::create([
            'invoice' => 'TRX-CUST-001',
            'customer_id' => $customer->id,
            'cashier_id' => $this->admin->id,
            'cash' => 50000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 50000,
        ]);

        $this->actingAs($this->admin)
            ->from(route('customers.index'))
            ->delete(route('customers.destroy', $customer->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('customers', ['id' => $customer->id, 'deleted_at' => null]);

        Sanctum::actingAs($this->admin);
        $this->deleteJson("/api/v1/customers/{$customer->id}")
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_cannot_delete_customer_with_receivables(): void
    {
        $customer = Customer::create([
            'name' => 'Pelanggan Berhutang',
            'no_telp' => '081234567891',
            'address' => 'Bandung',
            'is_loyalty_member' => false,
        ]);

        Receivable::create([
            'customer_id' => $customer->id,
            'invoice' => 'REC-001',
            'total' => 100000,
            'paid' => 0,
            'status' => 'pending',
            'due_date' => now()->addDays(7),
        ]);

        $this->actingAs($this->admin)
            ->from(route('customers.index'))
            ->delete(route('customers.destroy', $customer->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('customers', ['id' => $customer->id, 'deleted_at' => null]);
    }

    public function test_can_soft_delete_clean_customer(): void
    {
        $customer = Customer::create([
            'name' => 'Pelanggan Baru Bersih',
            'no_telp' => '08999999999',
            'address' => 'Surabaya',
            'is_loyalty_member' => false,
        ]);

        $this->actingAs($this->admin)
            ->from(route('customers.index'))
            ->delete(route('customers.destroy', $customer->id))
            ->assertSessionHas('success');

        $this->assertSoftDeleted('customers', ['id' => $customer->id]);
        $this->assertNull(Customer::find($customer->id));
    }

    public function test_cannot_delete_main_warehouse(): void
    {
        $main = Warehouse::create([
            'code' => 'MAIN-01',
            'name' => 'Gudang Pusat',
            'type' => 'main',
            'is_active' => true,
        ]);

        $this->actingAs($this->admin)
            ->from(route('settings.warehouses.index'))
            ->delete(route('settings.warehouses.destroy', $main->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('warehouses', ['id' => $main->id, 'deleted_at' => null]);
    }

    public function test_cannot_delete_warehouse_with_transactions(): void
    {
        $branch = Warehouse::create([
            'code' => 'BR-01',
            'name' => 'Cabang 1',
            'type' => 'branch',
            'is_active' => true,
        ]);

        Transaction::create([
            'invoice' => 'TRX-WH-001',
            'warehouse_id' => $branch->id,
            'cashier_id' => $this->admin->id,
            'cash' => 20000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 20000,
        ]);

        $this->actingAs($this->admin)
            ->from(route('settings.warehouses.index'))
            ->delete(route('settings.warehouses.destroy', $branch->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('warehouses', ['id' => $branch->id, 'deleted_at' => null]);
    }

    public function test_cannot_delete_warehouse_with_stock_mutations(): void
    {
        $branch = Warehouse::create([
            'code' => 'BR-MUT',
            'name' => 'Cabang Mutasi',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $category = Category::create(['name' => 'Umum', 'image' => '', 'description' => '']);
        $product = Product::create([
            'image' => '',
            'barcode' => 'PRD-MUT-1',
            'sku' => 'SKU-MUT-1',
            'title' => 'Barang Mutasi',
            'description' => '',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 0,
            'tax_rate' => 0,
        ]);

        StockMutation::create([
            'product_id' => $product->id,
            'warehouse_id' => $branch->id,
            'reference_type' => 'manual',
            'mutation_type' => 'in',
            'qty' => 5,
            'stock_before' => 0,
            'stock_after' => 5,
            'notes' => 'Penyesuaian',
            'created_by' => $this->admin->id,
        ]);

        $this->actingAs($this->admin)
            ->from(route('settings.warehouses.index'))
            ->delete(route('settings.warehouses.destroy', $branch->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('warehouses', ['id' => $branch->id, 'deleted_at' => null]);
    }

    public function test_can_soft_delete_empty_unused_warehouse(): void
    {
        $branch = Warehouse::create([
            'code' => 'BR-EMPTY',
            'name' => 'Cabang Kosong',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $this->actingAs($this->admin)
            ->from(route('settings.warehouses.index'))
            ->delete(route('settings.warehouses.destroy', $branch->id))
            ->assertSessionHas('success');

        $this->assertSoftDeleted('warehouses', ['id' => $branch->id]);
        $this->assertNull(Warehouse::find($branch->id));
    }

    public function test_historical_relations_resolve_even_when_master_is_soft_deleted(): void
    {
        $category = Category::create(['name' => 'Minuman', 'image' => '', 'description' => '']);
        $customer = Customer::create(['name' => 'Budi Soft', 'no_telp' => '08777777', 'address' => 'Solo', 'is_loyalty_member' => false]);
        $warehouse = Warehouse::create(['code' => 'WH-HIST', 'name' => 'Gudang Histori', 'type' => 'branch', 'is_active' => true]);

        $product = Product::create([
            'image' => '',
            'barcode' => 'PRD-HIST-1',
            'sku' => 'SKU-HIST-1',
            'title' => 'Es Teh Manis',
            'description' => '',
            'category_id' => $category->id,
            'buy_price' => 1000,
            'sell_price' => 3000,
            'stock' => 0,
            'tax_rate' => 0,
        ]);

        $transaction = Transaction::create([
            'invoice' => 'TRX-HIST-001',
            'customer_id' => $customer->id,
            'warehouse_id' => $warehouse->id,
            'cashier_id' => $this->admin->id,
            'cash' => 3000,
            'change' => 0,
            'discount' => 0,
            'grand_total' => 3000,
        ]);

        $detail = TransactionDetail::create([
            'transaction_id' => $transaction->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => 3000,
        ]);

        // Soft delete directly at DB/model level to simulate archived/soft-deleted records
        $product->delete();
        $customer->delete();
        $warehouse->delete();
        $category->delete();

        // Verify transaction relationships still resolve seamlessly
        $freshTransaction = Transaction::find($transaction->id);
        $this->assertNotNull($freshTransaction->customer);
        $this->assertEquals('Budi Soft', $freshTransaction->customer->name);
        $this->assertNotNull($freshTransaction->warehouse);
        $this->assertEquals('Gudang Histori', $freshTransaction->warehouse->name);

        $freshDetail = TransactionDetail::find($detail->id);
        $this->assertNotNull($freshDetail->product);
        $this->assertEquals('Es Teh Manis', $freshDetail->product->title);
        $this->assertNotNull($freshDetail->product->category);
        $this->assertEquals('Minuman', $freshDetail->product->category->name);
    }
}
