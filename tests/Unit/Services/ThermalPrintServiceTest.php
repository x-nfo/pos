<?php

namespace Tests\Unit\Services;

use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\ThermalPrintService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ThermalPrintServiceTest extends TestCase
{
    use RefreshDatabase;

    private ThermalPrintService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(ThermalPrintService::class);
    }

    public function test_generate_whatsapp_receipt_text_includes_details_and_public_link(): void
    {
        Setting::set('store_name', 'Toko Berkah');
        Setting::set('store_address', 'Jl. Merdeka No. 10');
        Setting::set('store_phone', '08123456789');

        $user = User::factory()->create(['name' => 'Kasir Utama']);
        $warehouse = Warehouse::create([
            'name' => 'Gudang Utama',
            'code' => 'GDG-01',
            'is_active' => true,
        ]);
        $shift = CashierShift::create([
            'user_id' => $user->id,
            'opened_by' => $user->id,
            'warehouse_id' => $warehouse->id,
            'opening_cash' => 100000,
            'opened_at' => now(),
            'status' => 'open',
        ]);
        $customer = Customer::create([
            'name' => 'Budi Santoso',
            'no_telp' => '081299998888',
            'address' => 'Jl. Sudirman No. 1',
        ]);
        $category = Category::create(['name' => 'Minuman', 'description' => 'Minuman']);
        $product = Product::create([
            'category_id' => $category->id,
            'barcode' => '899999999',
            'title' => 'Es Kopi Susu',
            'description' => 'Es Kopi Susu Mantap',
            'image' => 'products/sample.jpg',
            'buy_price' => 10000,
            'sell_price' => 18000,
            'stock' => 50,
            'tax_rate' => 0,
        ]);
        $defaultWarehouse = Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse']);
        ProductWarehouse::updateOrCreate(['product_id' => $product->id, 'warehouse_id' => $defaultWarehouse->id], ['stock' => 50]);

        $transaction = Transaction::create([
            'warehouse_id' => Warehouse::firstOrCreate(['code' => 'MAIN-TEST'], ['name' => 'Main Test Warehouse'])->id,
            'cashier_id' => $user->id,
            'cashier_shift_id' => $shift->id,
            'warehouse_id' => $warehouse->id,
            'customer_id' => $customer->id,
            'invoice' => 'TRX-20260828-0001',
            'cash' => 50000,
            'change' => 14000,
            'discount' => 0,
            'grand_total' => 36000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $transaction->details()->create([
            'product_id' => $product->id,
            'qty' => 2,
            'base_unit_price' => 18000,
            'unit_price' => 18000,
            'price' => 36000,
        ]);

        $text = $this->service->generateWhatsappReceiptText($transaction);

        $this->assertStringContainsString('STRUK PEMBELIAN', $text);
        $this->assertStringContainsString('TOKO BERKAH', $text);
        $this->assertStringContainsString('TRX-20260828-0001', $text);
        $this->assertStringContainsString('Kasir Utama', $text);
        $this->assertStringContainsString('Budi Santoso', $text);
        $this->assertStringContainsString('Es Kopi Susu', $text);
        $this->assertStringContainsString('2 pcs x Rp 18.000 = Rp 36.000', $text);
        $this->assertStringContainsString('TOTAL     : Rp 36.000', $text);
        $this->assertStringContainsString('Bayar     : Rp 50.000', $text);
        $this->assertStringContainsString('Kembali   : Rp 14.000', $text);
        $this->assertStringContainsString('Lihat Nota Online:', $text);
        $this->assertStringContainsString(route('transactions.public', 'TRX-20260828-0001', true), $text);
    }
}
