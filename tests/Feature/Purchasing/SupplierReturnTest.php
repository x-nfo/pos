<?php

namespace Tests\Feature\Purchasing;

use App\Models\Category;
use App\Models\Payable;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Supplier;
use App\Models\SupplierReturn;
use App\Models\SupplierReturnItem;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class SupplierReturnTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'supplier-returns-access',
            'supplier-returns-create',
            'supplier-returns-update',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->givePermissionTo($permissions);

        return $user;
    }

    private function createProduct(int $stock = 10): Product
    {
        $category = Category::create([
            'name' => 'Kategori '.Str::upper(Str::random(5)),
            'description' => 'Kategori pengujian',
            'image' => 'category.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(10)),
            'sku' => 'SKU-'.Str::upper(Str::random(10)),
            'title' => 'Produk Uji '.Str::upper(Str::random(4)),
            'description' => 'Deskripsi produk uji.',
            'buy_price' => 1500,
            'sell_price' => 2000,
            'stock' => $stock,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $product->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => $stock]);

        return $product;
    }

    public function test_unauthorized_user_cannot_access_supplier_returns(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($user)
            ->get(route('supplier-returns.index'))
            ->assertForbidden();
    }

    public function test_authorized_user_can_create_supplier_return_draft(): void
    {
        $user = $this->createUserWithPermissions([
            'supplier-returns-access',
            'supplier-returns-create',
        ]);

        $supplier = Supplier::create([
            'name' => 'PT Supplier Utama',
            'phone' => '08999888777',
        ]);

        $product = $this->createProduct(100);

        $response = $this->actingAs($user)
            ->post(route('supplier-returns.store'), [
                'supplier_id' => $supplier->id,
                'notes' => 'Barang rusak saat pengiriman',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty_returned' => 10,
                        'unit_price' => 1500,
                        'reason' => 'damaged',
                    ],
                ],
            ]);

        $return = SupplierReturn::first();
        $this->assertNotNull($return);
        $response->assertRedirect(route('supplier-returns.show', $return));

        $this->assertDatabaseHas('supplier_returns', [
            'supplier_id' => $supplier->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $this->assertDatabaseHas('supplier_return_items', [
            'supplier_return_id' => $return->id,
            'product_id' => $product->id,
            'qty_returned' => 10,
        ]);
    }

    /**
     * TC-SUPRET-02: Retur Melebihi Stok Gudang Saat Ini (Saat Pembuatan Draft)
     * Coba retur 50 Pcs padahal sisa stok di gudang hanya 30 Pcs (sebagian sudah terjual).
     * Ditolak dengan notifikasi stok fisik tidak mencukupi untuk diretur ke supplier.
     */
    public function test_user_cannot_create_supplier_return_when_qty_exceeds_available_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'supplier-returns-access',
            'supplier-returns-create',
        ]);

        $supplier = Supplier::create([
            'name' => 'PT Sumber Makmur',
            'phone' => '08123456789',
        ]);

        // Sisa stok di gudang hanya 30 pcs
        $product = $this->createProduct(30);

        // Coba retur 50 pcs (melebihi stok yang tersedia)
        $response = $this->actingAs($user)
            ->post(route('supplier-returns.store'), [
                'supplier_id' => $supplier->id,
                'notes' => 'Retur barang ke supplier melebihi stok',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty_returned' => 50,
                        'unit_price' => 1500,
                        'reason' => 'damaged',
                    ],
                ],
            ]);

        $response->assertSessionHasErrors('items');
        $this->assertDatabaseCount('supplier_returns', 0);
        $this->assertEquals(30, $product->fresh()->stock);
    }

    /**
     * TC-SUPRET-02: Retur Melebihi Stok Gudang Saat Ini (Saat Penyelesaian Retur / Complete)
     * Draft dibuat saat stok masih cukup (50 Pcs), lalu stok berkurang menjadi 30 Pcs karena penjualan.
     * Saat klik Complete, aksi ditolak karena sisa stok tidak mencukupi.
     */
    public function test_user_cannot_complete_supplier_return_when_stock_becomes_insufficient(): void
    {
        $user = $this->createUserWithPermissions([
            'supplier-returns-access',
            'supplier-returns-update',
        ]);

        $supplier = Supplier::create([
            'name' => 'PT Mitra Sejati',
            'phone' => '08555444333',
        ]);

        $product = $this->createProduct(50);

        $return = SupplierReturn::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'SR-20260902-0001',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        SupplierReturnItem::create([
            'supplier_return_id' => $return->id,
            'product_id' => $product->id,
            'qty_returned' => 50,
            'unit_price' => 1500,
            'reason' => 'damaged',
        ]);

        // Stok produk berkurang menjadi 30 (misal sebagian sudah terjual di kasir)
        ProductWarehouse::where('product_id', $product->id)->update(['stock' => 30]);

        // Eksekusi complete retur 50 pcs
        $response = $this->actingAs($user)
            ->post(route('supplier-returns.complete', $return));

        $response->assertSessionHasErrors('return');

        // Status retur tetap draft dan stok tidak berubah
        $this->assertEquals('draft', $return->fresh()->status);
        $this->assertEquals(30, $product->fresh()->stock);
    }

    /**
     * TC-SUPRET-02: Retur Melebihi Stok Gudang Cabang (Warehouse-scoped Stock)
     */
    public function test_user_cannot_return_more_than_warehouse_specific_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'supplier-returns-access',
            'supplier-returns-create',
        ]);

        $supplier = Supplier::create([
            'name' => 'PT Distributor Jaya',
            'phone' => '08777888999',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'WH-CABANG-1',
            'name' => 'Gudang Cabang 1',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $product = $this->createProduct(100);

        // Di cabang ini hanya ada stok 30 pcs
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 30,
        ]);

        $response = $this->actingAs($user)
            ->post(route('supplier-returns.store'), [
                'supplier_id' => $supplier->id,
                'warehouse_id' => $warehouse->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty_returned' => 50,
                        'unit_price' => 1500,
                    ],
                ],
            ]);

        $response->assertSessionHasErrors('items');
        $this->assertDatabaseCount('supplier_returns', 0);
    }

    /**
     * TC-SUPRET-01: Retur Barang ke Supplier (Positive Flow)
     * Buat retur 10 Pcs, klik "Complete".
     * Stok gudang terpotong -10 Pcs; saldo hutang ke supplier otomatis berkurang.
     */
    public function test_authorized_user_can_complete_supplier_return_with_items_and_deduct_stock_and_payables(): void
    {
        $user = $this->createUserWithPermissions([
            'supplier-returns-access',
            'supplier-returns-update',
        ]);

        $supplier = Supplier::create([
            'name' => 'PT Supplier Utama',
            'phone' => '08999888777',
        ]);

        $product = $this->createProduct(50);

        $payable = Payable::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-20260902-0001',
            'total' => 2000000,
            'paid' => 0,
            'due_date' => now()->addDays(30),
            'status' => 'unpaid',
        ]);

        $return = SupplierReturn::create([
            'supplier_id' => $supplier->id,
            'payable_id' => $payable->id,
            'document_number' => 'SR-20260902-0002',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        SupplierReturnItem::create([
            'supplier_return_id' => $return->id,
            'product_id' => $product->id,
            'qty_returned' => 10,
            'unit_price' => 50000, // 10 * 50,000 = 500,000
            'reason' => 'Barang cacat pabrik',
        ]);

        $response = $this->actingAs($user)
            ->post(route('supplier-returns.complete', $return));

        $response->assertRedirect(route('supplier-returns.show', $return));

        // Status retur selesai
        $this->assertDatabaseHas('supplier_returns', [
            'id' => $return->id,
            'status' => 'completed',
        ]);

        // Stok produk terpotong 10 pcs (50 - 10 = 40)
        $this->assertEquals(40, $product->fresh()->stock);

        // Hutang berkurang 500,000 (2,000,000 - 500,000 = 1,500,000)
        $this->assertEquals(1500000, $payable->fresh()->total);

        // Mutasi stok tercatat
        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'reference_type' => 'supplier_return',
            'reference_id' => $return->id,
            'mutation_type' => 'out',
            'qty' => 10,
            'stock_before' => 50,
            'stock_after' => 40,
        ]);
    }

    public function test_authorized_user_can_cancel_supplier_return(): void
    {
        $user = $this->createUserWithPermissions([
            'supplier-returns-access',
            'supplier-returns-update',
        ]);

        $supplier = Supplier::create([
            'name' => 'PT Supplier Utama',
            'phone' => '08999888777',
        ]);

        $return = SupplierReturn::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'SR-20260902-0003',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->post(route('supplier-returns.cancel', $return));

        $response->assertRedirect(route('supplier-returns.index'));
        $this->assertDatabaseHas('supplier_returns', [
            'id' => $return->id,
            'status' => 'cancelled',
        ]);
    }
}
