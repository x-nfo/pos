<?php

namespace Tests\Feature\Transactions;

use App\Models\Cart;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\ThermalPrintService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BranchDynamicReceiptTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Warehouse $branchWarehouse;

    private Transaction $transaction;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            PermissionSeeder::class,
            RoleSeeder::class,
        ]);

        Setting::set('store_name', 'Rekasir Pusat');
        Setting::set('store_address', 'Jl. Jenderal Sudirman No. 1, Jakarta Pusat');
        Setting::set('store_phone', '021-5551234');

        $this->admin = User::factory()->create([
            'name' => 'Admin POS',
            'email' => 'admin_test@mail.com',
        ]);
        $this->admin->assignRole('super-admin');

        $this->branchWarehouse = Warehouse::create([
            'name' => 'Cabang Bandung',
            'code' => 'BDG-01',
            'type' => 'branch',
            'address' => 'Jl. Asia Afrika No. 88, Bandung',
            'phone' => '022-7778899',
            'is_active' => true,
        ]);

        $shift = CashierShift::create([
            'user_id' => $this->admin->id,
            'opened_by' => $this->admin->id,
            'warehouse_id' => $this->branchWarehouse->id,
            'opening_cash' => 100000,
            'opened_at' => now(),
            'status' => 'open',
        ]);

        $customer = Customer::create([
            'name' => 'Pelanggan Bandung',
            'no_telp' => '081234567890',
            'address' => 'Jl. Braga No. 10',
        ]);

        $category = Category::create(['name' => 'Makanan', 'description' => 'Makanan']);
        $product = Product::create([
            'category_id' => $category->id,
            'barcode' => '88880001',
            'title' => 'Roti Bakar Bandung',
            'description' => 'Roti Bakar Spesial',
            'image' => 'products/sample.jpg',
            'buy_price' => 10000,
            'sell_price' => 20000,
            'stock' => 50,
            'tax_rate' => 0,
        ]);

        $this->transaction = Transaction::create([
            'cashier_id' => $this->admin->id,
            'cashier_shift_id' => $shift->id,
            'warehouse_id' => $this->branchWarehouse->id,
            'customer_id' => $customer->id,
            'invoice' => 'TRX-BDG-2026-0001',
            'cash' => 50000,
            'change' => 10000,
            'discount' => 0,
            'grand_total' => 40000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $this->transaction->details()->create([
            'product_id' => $product->id,
            'qty' => 2,
            'base_unit_price' => 20000,
            'unit_price' => 20000,
            'price' => 40000,
        ]);
    }

    public function test_print_page_receives_branch_warehouse_relationship(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('transactions.print', $this->transaction->invoice));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Transactions/Print')
            ->has('transaction.warehouse')
            ->where('transaction.warehouse.name', 'Cabang Bandung')
            ->where('transaction.warehouse.address', 'Jl. Asia Afrika No. 88, Bandung')
            ->where('transaction.warehouse.phone', '022-7778899')
        );
    }

    public function test_thermal_print_service_uses_branch_warehouse_details(): void
    {
        $service = app(ThermalPrintService::class);

        $receiptText = $service->generateReceiptText($this->transaction, '80mm');
        $this->assertStringContainsString('Jl. Asia Afrika No. 88, Bandung', $receiptText);
        $this->assertStringContainsString('022-7778899', $receiptText);

        $whatsappText = $service->generateWhatsappReceiptText($this->transaction);
        $this->assertStringContainsString('Jl. Asia Afrika No. 88, Bandung', $whatsappText);
        $this->assertStringContainsString('022-7778899', $whatsappText);
    }

    public function test_fallback_to_global_store_settings_when_branch_address_is_empty(): void
    {
        $this->branchWarehouse->update([
            'address' => null,
            'phone' => null,
        ]);

        $service = app(ThermalPrintService::class);

        $receiptText = $service->generateReceiptText($this->transaction->fresh(), '80mm');
        $this->assertStringContainsString('Jl. Jenderal Sudirman No. 1, Jakarta Pusat', $receiptText);
        $this->assertStringContainsString('021-5551234', $receiptText);
    }

    public function test_document_controller_renders_receipt_pdf_with_branch_warehouse_address(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('pdf.transactions.receipt', ['invoice' => $this->transaction->invoice, 'size' => '80']));

        $response->assertOk();
        $this->assertEquals('application/pdf', $response->headers->get('content-type'));
    }

    public function test_document_controller_renders_invoice_pdf_with_branch_warehouse_address(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('pdf.transactions.invoice', $this->transaction->invoice));

        $response->assertOk();
        $this->assertEquals('application/pdf', $response->headers->get('content-type'));
    }

    public function test_thermal_receipt_wordwraps_long_branch_address_on_58mm(): void
    {
        $longAddress = 'Jl. Kaliurang KM 14.5 No. 99, Sleman, Daerah Istimewa Yogyakarta';
        $this->branchWarehouse->update([
            'address' => $longAddress,
        ]);

        $service = app(ThermalPrintService::class);
        $receipt58 = $service->generateReceiptText($this->transaction->fresh(), '58mm');

        // On 58mm ($maxWidth = 32), without wrapping it would be cut off at 32 chars.
        // With word-wrapping, words like 'Yogyakarta' and 'Sleman' are preserved in the text output.
        $this->assertStringContainsString('Yogyakarta', $receipt58);
        $this->assertStringContainsString('Kaliurang', $receipt58);
    }

    public function test_main_warehouse_type_preserves_store_brand_name(): void
    {
        $mainWarehouse = Warehouse::create([
            'name' => 'Gudang Utama',
            'code' => 'GDG-MAIN',
            'type' => 'main',
            'address' => 'Jl. Pusat No. 1',
            'is_active' => true,
        ]);

        $service = app(ThermalPrintService::class);
        $profile = $service->resolveStoreProfile($mainWarehouse);

        // For main warehouse, it should preserve store brand name 'Rekasir Pusat'
        $this->assertEquals('Rekasir Pusat', $profile['name']);
        $this->assertEquals('Jl. Pusat No. 1', $profile['address']);
    }

    public function test_sanitizes_belum_diisi_placeholders(): void
    {
        $this->branchWarehouse->update([
            'address' => 'Belum diisi',
            'phone' => 'Belum diisi',
        ]);
        Setting::set('store_address', 'Belum diisi');
        Setting::set('store_phone', 'Belum diisi');

        $service = app(ThermalPrintService::class);
        $profile = $service->resolveStoreProfile($this->branchWarehouse);

        $this->assertEquals('', $profile['address']);
        $this->assertEquals('', $profile['phone']);

        $receiptText = $service->generateReceiptText($this->transaction->fresh(), '80mm');
        $this->assertStringNotContainsString('Belum diisi', $receiptText);
        $this->assertStringNotContainsString('Telp: Belum diisi', $receiptText);
    }

    public function test_public_portal_loads_branch_warehouse_relationship(): void
    {
        $response = $this->get(route('portal.transaction', [
            'invoice' => $this->transaction->invoice,
            'token' => $this->transaction->access_token,
        ]));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Public/TransactionDetail')
            ->has('transaction.warehouse')
            ->where('transaction.warehouse.name', 'Cabang Bandung')
            ->where('transaction.warehouse.address', 'Jl. Asia Afrika No. 88, Bandung')
            ->where('transaction.warehouse.phone', '022-7778899')
        );
    }

    public function test_receipt_uses_cashier_placement_warehouse_when_transaction_warehouse_id_is_null(): void
    {
        $cashier = User::factory()->create([
            'name' => 'Kasir Cabang',
            'email' => 'kasir_cabang@mail.com',
            'warehouse_id' => $this->branchWarehouse->id,
        ]);

        $this->transaction->update([
            'warehouse_id' => null,
            'cashier_id' => $cashier->id,
        ]);

        $service = app(ThermalPrintService::class);
        $receiptText = $service->generateReceiptText($this->transaction->fresh(), '80mm');

        $this->assertStringContainsStringIgnoringCase('Cabang Bandung', $receiptText);
        $this->assertStringContainsString('Jl. Asia Afrika No. 88, Bandung', $receiptText);
        $this->assertStringContainsString('022-7778899', $receiptText);

        $whatsappText = $service->generateWhatsappReceiptText($this->transaction->fresh());
        $this->assertStringContainsStringIgnoringCase('Cabang Bandung', $whatsappText);
        $this->assertStringContainsString('Jl. Asia Afrika No. 88, Bandung', $whatsappText);

        $response = $this->actingAs($this->admin)
            ->get(route('transactions.print', $this->transaction->invoice));
        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard/Transactions/Print')
            ->has('transaction.cashier.warehouse')
            ->where('transaction.cashier.warehouse.name', 'Cabang Bandung')
            ->where('transaction.cashier.warehouse.address', 'Jl. Asia Afrika No. 88, Bandung')
        );
    }

    public function test_checkout_automatically_inherits_cashier_warehouse_placement_when_shift_has_no_warehouse(): void
    {
        $cashier = User::factory()->create([
            'name' => 'Kasir Baru',
            'email' => 'kasir_baru@mail.com',
            'warehouse_id' => $this->branchWarehouse->id,
        ]);
        $cashier->assignRole('cashier');

        $shift = CashierShift::create([
            'user_id' => $cashier->id,
            'opened_by' => $cashier->id,
            'warehouse_id' => null, // shift unintentionally opened without warehouse_id
            'opening_cash' => 50000,
            'opened_at' => now(),
            'status' => 'open',
        ]);

        $product = Product::first();
        $product->warehouses()->syncWithoutDetaching([$this->branchWarehouse->id => ['stock' => 50]]);
        Cart::create([
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => $product->sell_price,
        ]);

        $response = $this->actingAs($cashier)->post(route('transactions.store'), [
            'customer_id' => null,
            'discount' => 0,
            'grand_total' => $product->sell_price,
            'cash' => $product->sell_price,
            'change' => 0,
        ]);

        $transaction = Transaction::latest('id')->first();
        $this->assertEquals($this->branchWarehouse->id, $transaction->warehouse_id);
        $this->assertEquals($this->branchWarehouse->id, $shift->fresh()->warehouse_id);
    }
}
