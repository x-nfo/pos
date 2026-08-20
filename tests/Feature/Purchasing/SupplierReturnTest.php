<?php

namespace Tests\Feature\Purchasing;

use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\SupplierReturn;
use App\Models\User;
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

        return Product::create([
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

    public function test_authorized_user_can_complete_and_cancel_supplier_return(): void
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
            'document_number' => 'SR-20260817-0001',
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        // Complete return
        $response = $this->actingAs($user)
            ->post(route('supplier-returns.complete', $return));

        $response->assertRedirect(route('supplier-returns.show', $return));
        $this->assertDatabaseHas('supplier_returns', [
            'id' => $return->id,
            'status' => 'completed',
        ]);
    }
}
