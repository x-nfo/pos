<?php

namespace Tests\Feature\Payables;

use App\Models\BankAccount;
use App\Models\Category;
use App\Models\Payable;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\GoodsReceivingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PayableTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'payables-access',
            'payables-pay',
            'suppliers-access',
            'goods-receivings-access',
            'goods-receivings-create',
            'purchase-orders-access',
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
            'buy_price' => 50000,
            'sell_price' => 75000,
            'stock' => $stock,
            'tax_rate' => 0,
        ]);
    }

    public function test_unauthorized_user_cannot_access_payables(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($user)
            ->get(route('payables.index'))
            ->assertForbidden();
    }

    public function test_authorized_user_can_view_payables_and_filter_by_invoice_or_vendor_invoice(): void
    {
        $user = $this->createUserWithPermissions(['payables-access']);
        $supplier = Supplier::create(['name' => 'Supplier A', 'phone' => '08123456789']);

        $payable1 = Payable::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-20260830-0001',
            'vendor_invoice_number' => 'INV-SUPP-8888',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->addDays(14),
            'status' => 'unpaid',
        ]);

        $payable2 = Payable::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-20260830-0002',
            'vendor_invoice_number' => 'INV-SUPP-9999',
            'total' => 500000,
            'paid' => 500000,
            'due_date' => now()->addDays(7),
            'status' => 'paid',
        ]);

        $response = $this->actingAs($user)
            ->get(route('payables.index', ['invoice' => '8888']));

        $response->assertOk();
    }

    public function test_authorized_user_can_create_manual_payable_with_vendor_invoice(): void
    {
        $user = $this->createUserWithPermissions(['payables-access']);
        $supplier = Supplier::create(['name' => 'PT Makmur Jaya', 'phone' => '08111222333']);

        $response = $this->actingAs($user)
            ->post(route('payables.store'), [
                'supplier_id' => $supplier->id,
                'document_number' => 'PAY-20260830-MANUAL',
                'vendor_invoice_number' => 'FAKTUR-MJ-100',
                'total' => 2500000,
                'due_date' => now()->addDays(30)->format('Y-m-d'),
                'note' => 'Hutang bahan baku manual',
            ]);

        $response->assertRedirect(route('payables.index'));

        $this->assertDatabaseHas('payables', [
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-20260830-MANUAL',
            'vendor_invoice_number' => 'FAKTUR-MJ-100',
            'total' => 2500000,
            'paid' => 0,
            'status' => 'unpaid',
        ]);
    }

    public function test_authorized_user_can_make_partial_and_full_payment(): void
    {
        $user = $this->createUserWithPermissions([
            'payables-access',
            'payables-pay',
        ]);

        $bank = BankAccount::create([
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_name' => 'Toko Utama',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $supplier = Supplier::create(['name' => 'Supplier Sejahtera']);
        $payable = Payable::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-20260830-0010',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->addDays(15),
            'status' => 'unpaid',
        ]);

        // Cicilan 1: Rp 400.000 via transfer bank
        $response1 = $this->actingAs($user)
            ->post(route('payables.pay', $payable), [
                'amount' => 400000,
                'paid_at' => now()->format('Y-m-d'),
                'method' => 'bank_transfer',
                'bank_account_id' => $bank->id,
                'note' => 'Cicilan pertama',
            ]);

        $response1->assertRedirect(route('payables.show', $payable));

        $payable->refresh();
        $this->assertEquals(400000, $payable->paid);
        $this->assertEquals(600000, $payable->remaining);
        $this->assertEquals('partial', $payable->status);

        // Cicilan 2: Pelunasan Rp 600.000 via tunai
        $response2 = $this->actingAs($user)
            ->post(route('payables.pay', $payable), [
                'amount' => 600000,
                'paid_at' => now()->format('Y-m-d'),
                'method' => 'cash',
                'note' => 'Pelunasan',
            ]);

        $response2->assertRedirect(route('payables.show', $payable));

        $payable->refresh();
        $this->assertEquals(1000000, $payable->paid);
        $this->assertEquals(0, $payable->remaining);
        $this->assertEquals('paid', $payable->status);

        $this->assertCount(2, $payable->payments);
    }

    public function test_payment_rejects_amount_greater_than_remaining(): void
    {
        $user = $this->createUserWithPermissions([
            'payables-access',
            'payables-pay',
        ]);

        $supplier = Supplier::create(['name' => 'Supplier Test']);
        $payable = Payable::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-20260830-OVER',
            'total' => 500000,
            'paid' => 0,
            'due_date' => now()->addDays(15),
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($user)
            ->post(route('payables.pay', $payable), [
                'amount' => 600000,
                'paid_at' => now()->format('Y-m-d'),
                'method' => 'cash',
            ]);

        $response->assertSessionHas('error');

        $payable->refresh();
        $this->assertEquals(0, $payable->paid);
        $this->assertEquals('unpaid', $payable->status);
    }

    public function test_supplier_statement_endpoint_returns_accurate_aging_summary(): void
    {
        $user = $this->createUserWithPermissions(['payables-access']);
        $supplier = Supplier::create(['name' => 'PT Sumber Rezeki']);

        Payable::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-STMT-01',
            'total' => 1500000,
            'paid' => 500000,
            'due_date' => now()->addDays(10),
            'status' => 'partial',
        ]);

        $response = $this->actingAs($user)
            ->getJson(route('payables.supplier-statement', ['supplier_id' => $supplier->id]));

        $response->assertOk()
            ->assertJsonStructure([
                'supplier',
                'payables',
                'aging_summary',
                'total_outstanding',
            ]);

        $this->assertEquals(1000000, $response->json('total_outstanding'));
    }

    public function test_partial_goods_receiving_accumulates_total_and_preserves_paid_amount(): void
    {
        $user = $this->createUserWithPermissions([
            'payables-access',
            'payables-pay',
            'goods-receivings-access',
            'goods-receivings-create',
            'purchase-orders-access',
        ]);

        $product = $this->createProduct(10);
        $supplier = Supplier::create(['name' => 'Supplier Bertahap']);
        $warehouse = Warehouse::create([
            'code' => 'GUD-01',
            'name' => 'Gudang 1',
            'type' => 'main',
            'is_active' => true,
        ]);

        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 10,
        ]);

        // PO dengan pesan 10 item @ Rp 50.000 = Rp 500.000
        $po = PurchaseOrder::create([
            'supplier_id' => $supplier->id,
            'warehouse_id' => $warehouse->id,
            'document_number' => 'PO-20260830-PARTIAL',
            'status' => 'ordered',
            'created_by' => $user->id,
            'ordered_at' => now(),
        ]);

        $poItem = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'qty_ordered' => 10,
            'qty_received' => 0,
            'unit_price' => 50000,
        ]);

        $grService = app(GoodsReceivingService::class);

        // Penerimaan Tahap 1: 4 item (@ 50.000 = 200.000)
        $gr1 = $grService->receive($po, [
            [
                'purchase_order_item_id' => $poItem->id,
                'qty_received' => 4,
            ],
        ], 'Penerimaan Parsial 1', $user->id);

        $payable = Payable::where('purchase_order_id', $po->id)->first();
        $this->assertNotNull($payable);
        $this->assertEquals(200000, $payable->total);
        $this->assertEquals(0, $payable->paid);
        $this->assertEquals('unpaid', $payable->status);

        // Kasir membayar cicilan Rp 150.000 untuk tagihan tahap 1
        $this->actingAs($user)->post(route('payables.pay', $payable), [
            'amount' => 150000,
            'paid_at' => now()->format('Y-m-d'),
            'method' => 'cash',
            'note' => 'Bayar tahap 1',
        ]);

        $payable->refresh();
        $this->assertEquals(150000, $payable->paid);
        $this->assertEquals(50000, $payable->remaining);
        $this->assertEquals('partial', $payable->status);

        // Penerimaan Tahap 2: Sisa 6 item (@ 50.000 = 300.000 -> total PO received = 500.000)
        $po->refresh();
        $gr2 = $grService->receive($po, [
            [
                'purchase_order_item_id' => $poItem->id,
                'qty_received' => 6,
            ],
        ], 'Penerimaan Parsial 2 (Selesai)', $user->id);

        $payable->refresh();
        // Total akumulatif harus 500.000
        $this->assertEquals(500000, $payable->total);
        // Nilai yang sudah dibayar Rp 150.000 TIDAK boleh ter-reset ke 0!
        $this->assertEquals(150000, $payable->paid);
        // Sisa harus Rp 350.000
        $this->assertEquals(350000, $payable->remaining);
        $this->assertEquals('partial', $payable->status);
    }

    public function test_payable_pdf_download_succeeds(): void
    {
        $user = $this->createUserWithPermissions(['payables-access']);
        $supplier = Supplier::create(['name' => 'Supplier PDF']);
        $payable = Payable::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-PDF-001',
            'vendor_invoice_number' => 'INV-PDF-123',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->addDays(14),
            'status' => 'unpaid',
        ]);

        $response = $this->actingAs($user)
            ->get(route('pdf.payables.show', $payable));

        $response->assertOk();
    }

    public function test_authorized_user_can_delete_payment_and_restore_balance(): void
    {
        $user = $this->createUserWithPermissions([
            'payables-access',
            'payables-pay',
        ]);

        $supplier = Supplier::create(['name' => 'Supplier Koreksi']);
        $payable = Payable::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-KOR-01',
            'total' => 1000000,
            'paid' => 0,
            'due_date' => now()->addDays(15),
            'status' => 'unpaid',
        ]);

        // Bayar cicilan 1: Rp 132.000
        $this->actingAs($user)->post(route('payables.pay', $payable), [
            'amount' => 132000,
            'paid_at' => now()->format('Y-m-d'),
            'method' => 'cash',
        ]);

        // Bayar cicilan 2 (salah input): Rp 88
        $this->actingAs($user)->post(route('payables.pay', $payable), [
            'amount' => 88,
            'paid_at' => now()->format('Y-m-d'),
            'method' => 'cash',
        ]);

        $payable->refresh();
        $this->assertEquals(132088, $payable->paid);
        $this->assertCount(2, $payable->payments);

        $wrongPayment = $payable->payments()->where('amount', 88)->first();
        $this->assertNotNull($wrongPayment);

        // Hapus pembayaran Rp 88 dengan password valid
        $response = $this->actingAs($user)
            ->delete(route('payables.payments.destroy', [$payable, $wrongPayment]), [
                'password' => 'password',
            ]);

        $response->assertRedirect(route('payables.show', $payable));

        $payable->refresh();
        $this->assertEquals(132000, $payable->paid);
        $this->assertEquals(868000, $payable->remaining);
        $this->assertEquals('partial', $payable->status);
        $this->assertCount(1, $payable->payments);
        $this->assertDatabaseMissing('payable_payments', ['id' => $wrongPayment->id]);

        // Hapus pembayaran cicilan 1: Rp 132.000 -> status harus kembali unpaid
        $payment1 = $payable->payments()->first();
        $this->actingAs($user)->delete(route('payables.payments.destroy', [$payable, $payment1]), [
            'password' => 'password',
        ]);

        $payable->refresh();
        $this->assertEquals(0, $payable->paid);
        $this->assertEquals(1000000, $payable->remaining);
        $this->assertEquals('unpaid', $payable->status);
        $this->assertCount(0, $payable->payments);
    }

    public function test_delete_payment_fails_with_invalid_password(): void
    {
        $user = $this->createUserWithPermissions([
            'payables-access',
            'payables-pay',
        ]);

        $supplier = Supplier::create(['name' => 'Supplier Salah Pass']);
        $payable = Payable::create([
            'supplier_id' => $supplier->id,
            'document_number' => 'PAY-PASS-01',
            'total' => 500000,
            'paid' => 200000,
            'due_date' => now()->addDays(15),
            'status' => 'partial',
        ]);

        $payment = $payable->payments()->create([
            'paid_at' => now(),
            'amount' => 200000,
            'method' => 'cash',
            'user_id' => $user->id,
        ]);

        // Coba hapus dengan password salah
        $response = $this->actingAs($user)
            ->delete(route('payables.payments.destroy', [$payable, $payment]), [
                'password' => 'wrongpassword123',
            ]);

        $response->assertSessionHas('error', 'Password yang Anda masukkan salah.');

        $payable->refresh();
        $this->assertEquals(200000, $payable->paid);
        $this->assertCount(1, $payable->payments);
        $this->assertDatabaseHas('payable_payments', ['id' => $payment->id]);
    }
}
