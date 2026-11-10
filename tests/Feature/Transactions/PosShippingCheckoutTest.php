<?php

namespace Tests\Feature\Transactions;

use App\Models\Cart;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PosShippingCheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected User $cashier;

    protected CashierShift $shift;

    protected Warehouse $warehouse;

    protected Category $category;

    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
            'shipping-rates-access',
        ] as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $this->cashier = User::factory()->create();
        $this->cashier->givePermissionTo(['transactions-access', 'cashier-shifts-access', 'shipping-rates-access']);

        $this->warehouse = Warehouse::create([
            'code' => 'WH-POS',
            'name' => 'POS Branch',
            'is_active' => true,
        ]);

        $this->shift = CashierShift::create([
            'user_id' => $this->cashier->id,
            'opened_by' => $this->cashier->id,
            'warehouse_id' => $this->warehouse->id,
            'starting_cash' => 100000,
            'opened_at' => now(),
            'status' => 'open',
        ]);

        $this->category = Category::create([
            'name' => 'Category Shipping',
            'description' => 'Desc',
        ]);

        // AGENTS.md rule: set tax_rate=0 to avoid PPN changing grand_total
        Setting::set('tax_default_rate', '0.00');
        $this->product = Product::create([
            'category_id' => $this->category->id,
            'barcode' => 'SHIP-001',
            'title' => 'Product For Shipping',
            'description' => 'Test',
            'buy_price' => 10000,
            'sell_price' => 20000,
            'stock' => 10,
            'weight' => 500,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create([
            'product_id' => $this->product->id,
            'warehouse_id' => $this->warehouse->id,
            'stock' => 10,
        ]);
    }

    public function test_pos_checkout_saves_rajaongkir_shipping_details(): void
    {
        $customer = Customer::create([
            'name' => 'Budi Santoso',
            'no_telp' => '08123456789',
            'address' => 'Jl. Merdeka No. 10',
            'province_name' => 'JAWA BARAT',
            'regency_name' => 'BANDUNG',
            'district_name' => 'BANDUNG KIDUL',
        ]);

        Cart::create([
            'cashier_id' => $this->cashier->id,
            'product_id' => $this->product->id,
            'qty' => 2,
            'price' => 40000,
            'warehouse_id' => $this->warehouse->id,
        ]);

        $response = $this->actingAs($this->cashier)->post(route('transactions.store'), [
            'customer_id' => $customer->id,
            'cash' => 55000,
            'discount' => 0,
            'shipping_cost' => 15000,
            'shipping_courier' => 'jne',
            'shipping_service' => 'REG',
            'shipping_etd' => '1-2 hari',
            'shipping_weight' => 1000,
            'shipping_destination_id' => 4866,
            'shipping_destination_label' => 'BATUNUNGGAL, BANDUNG KIDUL',
            'shipping_tracking_number' => 'JNE123456789ID',
            'payment_method' => 'cash',
        ]);

        $response->assertRedirect();

        $transaction = Transaction::latest('id')->first();
        $this->assertNotNull($transaction);
        $this->assertEquals(15000, $transaction->shipping_cost);
        $this->assertEquals('jne', $transaction->shipping_courier);
        $this->assertEquals('REG', $transaction->shipping_service);
        $this->assertEquals('1-2 hari', $transaction->shipping_etd);
        $this->assertEquals(1000, $transaction->shipping_weight);
        $this->assertEquals(4866, $transaction->shipping_destination_id);
        $this->assertEquals('BATUNUNGGAL, BANDUNG KIDUL', $transaction->shipping_destination_label);
        $this->assertEquals('JNE123456789ID', $transaction->shipping_tracking_number);
        // grand_total = 40000 (items) + 15000 (shipping) = 55000
        $this->assertEquals(55000, $transaction->grand_total);
    }
}
