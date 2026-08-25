<?php

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\PaymentSetting;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\StockMutation;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\TestCase;

class PaymentWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_midtrans_webhook_updates_transaction_status_when_signature_is_valid(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'midtrans',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-key',
            'midtrans_client_key' => 'client-key',
        ]);

        $transaction = $this->createPendingTransaction('midtrans');

        $payload = [
            'order_id' => $transaction->invoice,
            'status_code' => '200',
            'gross_amount' => (string) (int) $transaction->grand_total,
            'transaction_status' => 'settlement',
            'transaction_id' => 'midtrans-tx-001',
        ];
        $payload['signature_key'] = hash(
            'sha512',
            $payload['order_id'].$payload['status_code'].$payload['gross_amount'].'server-key'
        );

        $response = $this->postJson(route('webhooks.midtrans'), $payload);

        $response->assertOk()->assertJson(['status' => 'success']);
        $transaction->refresh();

        $this->assertSame('paid', $transaction->payment_status);
        $this->assertSame('midtrans-tx-001', $transaction->payment_reference);
    }

    public function test_midtrans_webhook_rejects_invalid_signature(): void
    {
        Log::spy();

        PaymentSetting::create([
            'default_gateway' => 'midtrans',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-key',
            'midtrans_client_key' => 'client-key',
        ]);

        $transaction = $this->createPendingTransaction('midtrans');

        $response = $this->postJson(route('webhooks.midtrans'), [
            'order_id' => $transaction->invoice,
            'status_code' => '200',
            'gross_amount' => (string) (int) $transaction->grand_total,
            'transaction_status' => 'settlement',
            'transaction_id' => 'midtrans-tx-001',
            'signature_key' => 'invalid-signature',
        ]);

        $response->assertForbidden();
        $this->assertSame('pending', $transaction->fresh()->payment_status);
        Log::shouldNotHaveReceived('info', function ($message) {
            return $message === 'Midtrans Webhook Received';
        });
        Log::shouldHaveReceived('warning', function ($message, $context = []) {
            return $message === 'Midtrans Webhook: Invalid signature'
                && ! array_key_exists('received', $context)
                && ! array_key_exists('expected', $context)
                && ($context['verification_result'] ?? null) === 'invalid';
        });
    }

    public function test_midtrans_webhook_auto_restocks_inventory_on_expire(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'midtrans',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-key',
            'midtrans_client_key' => 'client-key',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'WH-TEST-01',
            'name' => 'Gudang Utama',
            'address' => 'Jl. Test No. 1',
            'status' => 'active',
        ]);

        $product = $this->createProduct([
            'title' => 'Kopi Susu Gula Aren',
            'barcode' => '8991234567890',
            'sku' => 'KOP-001',
            'buy_price' => 10000,
            'sell_price' => 18000,
            'stock' => 8, // Stock reduced from 10 to 8 on checkout (2 bought)
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 8,
        ]);

        $transaction = $this->createPendingTransaction('midtrans', $warehouse->id);
        $transaction->details()->create([
            'product_id' => $product->id,
            'qty' => 2,
            'conversion_factor' => 1,
            'base_unit_price' => 18000,
            'unit_price' => 18000,
            'price' => 36000,
        ]);

        $payload = [
            'order_id' => $transaction->invoice,
            'status_code' => '200',
            'gross_amount' => (string) (int) $transaction->grand_total,
            'transaction_status' => 'expire',
            'transaction_id' => 'midtrans-tx-expire-001',
        ];
        $payload['signature_key'] = hash(
            'sha512',
            $payload['order_id'].$payload['status_code'].$payload['gross_amount'].'server-key'
        );

        $response = $this->postJson(route('webhooks.midtrans'), $payload);

        $response->assertOk()->assertJson(['status' => 'success']);
        $transaction->refresh();
        $product->refresh();

        $this->assertSame('expired', $transaction->payment_status);
        $this->assertSame(10, (int) $product->stock);

        $pw = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
        ])->first();
        $this->assertSame(10, (int) $pw->stock);

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'transaction_restock',
            'reference_id' => $transaction->id,
            'mutation_type' => 'in',
            'qty' => 2,
            'stock_before' => 8,
            'stock_after' => 10,
        ]);
    }

    public function test_midtrans_webhook_auto_restocks_inventory_on_cancel_or_deny(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'midtrans',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-key',
            'midtrans_client_key' => 'client-key',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'WH-TEST-02',
            'name' => 'Gudang Cabang',
            'address' => 'Jl. Test No. 2',
            'status' => 'active',
        ]);

        $product = $this->createProduct([
            'title' => 'Roti Bakar Keju',
            'barcode' => '8999876543210',
            'sku' => 'ROT-001',
            'buy_price' => 5000,
            'sell_price' => 12000,
            'stock' => 5,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 5,
        ]);

        $transaction = $this->createPendingTransaction('midtrans', $warehouse->id);
        $transaction->details()->create([
            'product_id' => $product->id,
            'qty' => 3,
            'conversion_factor' => 1,
            'base_unit_price' => 12000,
            'unit_price' => 12000,
            'price' => 36000,
        ]);

        $payload = [
            'order_id' => $transaction->invoice,
            'status_code' => '200',
            'gross_amount' => (string) (int) $transaction->grand_total,
            'transaction_status' => 'cancel',
            'transaction_id' => 'midtrans-tx-cancel-001',
        ];
        $payload['signature_key'] = hash(
            'sha512',
            $payload['order_id'].$payload['status_code'].$payload['gross_amount'].'server-key'
        );

        $response = $this->postJson(route('webhooks.midtrans'), $payload);

        $response->assertOk()->assertJson(['status' => 'success']);
        $transaction->refresh();
        $product->refresh();

        $this->assertSame('failed', $transaction->payment_status);
        $this->assertSame(8, (int) $product->stock);

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'transaction_restock',
            'reference_id' => $transaction->id,
            'mutation_type' => 'in',
            'qty' => 3,
        ]);
    }

    public function test_xendit_webhook_updates_transaction_status_when_token_is_valid(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'xendit',
            'xendit_enabled' => true,
            'xendit_secret_key' => 'xendit-secret',
            'xendit_public_key' => 'xendit-public',
            'xendit_callback_token' => 'callback-token',
        ]);

        $transaction = $this->createPendingTransaction('xendit');

        $response = $this->withHeader('X-CALLBACK-TOKEN', 'callback-token')
            ->postJson(route('webhooks.xendit'), [
                'external_id' => $transaction->invoice,
                'status' => 'PAID',
                'id' => 'xendit-invoice-001',
            ]);

        $response->assertOk()->assertJson(['status' => 'success']);
        $transaction->refresh();

        $this->assertSame('paid', $transaction->payment_status);
        $this->assertSame('xendit-invoice-001', $transaction->payment_reference);
    }

    public function test_xendit_webhook_rejects_invalid_callback_token(): void
    {
        Log::spy();

        PaymentSetting::create([
            'default_gateway' => 'xendit',
            'xendit_enabled' => true,
            'xendit_secret_key' => 'xendit-secret',
            'xendit_public_key' => 'xendit-public',
            'xendit_callback_token' => 'callback-token',
        ]);

        $transaction = $this->createPendingTransaction('xendit');

        $response = $this->withHeader('X-CALLBACK-TOKEN', 'wrong-token')
            ->postJson(route('webhooks.xendit'), [
                'external_id' => $transaction->invoice,
                'status' => 'PAID',
                'id' => 'xendit-invoice-001',
            ]);

        $response->assertForbidden();
        $this->assertSame('pending', $transaction->fresh()->payment_status);
        Log::shouldNotHaveReceived('info', function ($message) {
            return $message === 'Xendit Webhook Received';
        });
        Log::shouldHaveReceived('warning', function ($message, $context = []) {
            return $message === 'Xendit Webhook: Invalid callback token'
                && ! array_key_exists('token', $context)
                && ($context['verification_result'] ?? null) === 'invalid';
        });
    }

    public function test_xendit_webhook_auto_restocks_inventory_on_expired(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'xendit',
            'xendit_enabled' => true,
            'xendit_secret_key' => 'xendit-secret',
            'xendit_public_key' => 'xendit-public',
            'xendit_callback_token' => 'callback-token',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'WH-XEN-01',
            'name' => 'Gudang Xendit',
            'address' => 'Jl. Xendit No. 1',
            'status' => 'active',
        ]);

        $product = $this->createProduct([
            'title' => 'Teh Botol Sosro',
            'barcode' => '8993334445556',
            'sku' => 'TEH-001',
            'buy_price' => 3000,
            'sell_price' => 5000,
            'stock' => 15,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 15,
        ]);

        $transaction = $this->createPendingTransaction('xendit', $warehouse->id);
        $transaction->details()->create([
            'product_id' => $product->id,
            'qty' => 5,
            'conversion_factor' => 1,
            'base_unit_price' => 5000,
            'unit_price' => 5000,
            'price' => 25000,
        ]);

        $response = $this->withHeader('X-CALLBACK-TOKEN', 'callback-token')
            ->postJson(route('webhooks.xendit'), [
                'external_id' => $transaction->invoice,
                'status' => 'EXPIRED',
                'id' => 'xendit-inv-exp-001',
            ]);

        $response->assertOk()->assertJson(['status' => 'success']);
        $transaction->refresh();
        $product->refresh();

        $this->assertSame('expired', $transaction->payment_status);
        $this->assertSame(20, (int) $product->stock);

        $pw = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
        ])->first();
        $this->assertSame(20, (int) $pw->stock);

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'transaction_restock',
            'reference_id' => $transaction->id,
            'mutation_type' => 'in',
            'qty' => 5,
        ]);
    }

    public function test_qrisly_webhook_updates_transaction_status_on_payment_success(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'qrisly',
            'qrisly_enabled' => true,
            'qrisly_api_key' => 'qrisly-secret-key',
            'qrisly_qris_id' => 'qris-test-123',
        ]);

        $transaction = $this->createPendingTransaction('qrisly');
        $transaction->update(['payment_reference' => '1778']);

        $response = $this->postJson(route('webhooks.qrisly'), [
            'event' => 'payment.success',
            'timestamp' => '2026-08-20T12:00:00Z',
            'data' => [
                'qris_history_id' => 1778,
                'qris_id' => 'qris-test-123',
                'amount' => 150002,
                'original_amount' => 150000,
                'status' => 'paid',
                'paid_at' => '2026-08-20T12:00:00Z',
                'payment_method' => 'QRIS',
                'payment_provider' => 'BCA',
            ],
        ]);

        $response->assertOk()->assertJson(['success' => true, 'message' => 'Webhook received and processed']);
        $transaction->refresh();

        $this->assertSame('paid', $transaction->payment_status);
        $this->assertSame('1778', $transaction->payment_reference);
    }

    public function test_qrisly_webhook_handles_expired_event_and_restocks_inventory(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'qrisly',
            'qrisly_enabled' => true,
            'qrisly_api_key' => 'qrisly-secret-key',
            'qrisly_qris_id' => 'qris-test-123',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'WH-QRIS-01',
            'name' => 'Gudang QRIS',
            'address' => 'Jl. QRIS No. 1',
            'status' => 'active',
        ]);

        $product = $this->createProduct([
            'title' => 'Mineral Water 600ml',
            'barcode' => '8995556667778',
            'sku' => 'MIN-001',
            'buy_price' => 2000,
            'sell_price' => 4000,
            'stock' => 50,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 50,
        ]);

        $transaction = $this->createPendingTransaction('qrisly', $warehouse->id);
        $transaction->update(['payment_reference' => '1779']);

        $transaction->details()->create([
            'product_id' => $product->id,
            'qty' => 10,
            'conversion_factor' => 1,
            'base_unit_price' => 4000,
            'unit_price' => 4000,
            'price' => 40000,
        ]);

        $response = $this->postJson(route('webhooks.qrisly'), [
            'event' => 'payment.expired',
            'timestamp' => '2026-08-20T12:00:00Z',
            'data' => [
                'qris_history_id' => 1779,
                'status' => 'expired',
            ],
        ]);

        $response->assertOk()->assertJson(['success' => true]);
        $transaction->refresh();
        $product->refresh();

        $this->assertSame('expired', $transaction->payment_status);
        $this->assertSame(60, (int) $product->stock);

        $pw = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
        ])->first();
        $this->assertSame(60, (int) $pw->stock);

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'transaction_restock',
            'reference_id' => $transaction->id,
            'mutation_type' => 'in',
            'qty' => 10,
        ]);
    }

    public function test_composite_product_auto_restocks_components_on_payment_expire(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'midtrans',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-key',
            'midtrans_client_key' => 'client-key',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'WH-COMPOSITE-01',
            'name' => 'Gudang Bundle',
            'address' => 'Jl. Bundle No. 1',
            'status' => 'active',
        ]);

        $componentA = $this->createProduct([
            'title' => 'Espresso Beans',
            'barcode' => '8991111111111',
            'sku' => 'ESP-001',
            'buy_price' => 5000,
            'sell_price' => 10000,
            'stock' => 20,
            'tax_rate' => 0,
        ]);

        $componentB = $this->createProduct([
            'title' => 'Fresh Milk 1L',
            'barcode' => '8992222222222',
            'sku' => 'MLK-001',
            'buy_price' => 8000,
            'sell_price' => 15000,
            'stock' => 10,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create([
            'product_id' => $componentA->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 20,
        ]);

        ProductWarehouse::create([
            'product_id' => $componentB->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 10,
        ]);

        $bundleProduct = $this->createProduct([
            'title' => 'Paket Latte Hemat',
            'barcode' => '8999999999999',
            'sku' => 'BND-001',
            'buy_price' => 13000,
            'sell_price' => 22000,
            'stock' => 0,
            'is_composite' => true,
            'tax_rate' => 0,
        ]);

        $bundleProduct->components()->attach([
            $componentA->id => ['qty' => 2], // 2x Espresso per bundle
            $componentB->id => ['qty' => 1], // 1x Fresh Milk per bundle
        ]);

        $transaction = $this->createPendingTransaction('midtrans', $warehouse->id);
        $transaction->details()->create([
            'product_id' => $bundleProduct->id,
            'qty' => 3, // 3 bundles = 6 Espresso + 3 Fresh Milk
            'conversion_factor' => 1,
            'base_unit_price' => 22000,
            'unit_price' => 22000,
            'price' => 66000,
        ]);

        $payload = [
            'order_id' => $transaction->invoice,
            'status_code' => '200',
            'gross_amount' => (string) (int) $transaction->grand_total,
            'transaction_status' => 'expire',
            'transaction_id' => 'midtrans-tx-composite-001',
        ];
        $payload['signature_key'] = hash(
            'sha512',
            $payload['order_id'].$payload['status_code'].$payload['gross_amount'].'server-key'
        );

        $response = $this->postJson(route('webhooks.midtrans'), $payload);

        $response->assertOk()->assertJson(['status' => 'success']);

        $componentA->refresh();
        $componentB->refresh();

        // 20 + (2 * 3) = 26
        $this->assertSame(26, (int) $componentA->stock);
        // 10 + (1 * 3) = 13
        $this->assertSame(13, (int) $componentB->stock);

        $pwA = ProductWarehouse::where(['product_id' => $componentA->id, 'warehouse_id' => $warehouse->id])->first();
        $this->assertSame(26, (int) $pwA->stock);

        $pwB = ProductWarehouse::where(['product_id' => $componentB->id, 'warehouse_id' => $warehouse->id])->first();
        $this->assertSame(13, (int) $pwB->stock);

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $componentA->id,
            'reference_type' => 'transaction_restock',
            'reference_id' => $transaction->id,
            'qty' => 6,
        ]);

        $this->assertDatabaseHas('stock_mutations', [
            'product_id' => $componentB->id,
            'reference_type' => 'transaction_restock',
            'reference_id' => $transaction->id,
            'qty' => 3,
        ]);
    }

    public function test_webhook_auto_restock_is_idempotent_and_prevents_duplicate_restock(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'midtrans',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-key',
            'midtrans_client_key' => 'client-key',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'WH-IDEMPOTENT-01',
            'name' => 'Gudang Idempotency',
            'address' => 'Jl. Idempotent No. 1',
            'status' => 'active',
        ]);

        $product = $this->createProduct([
            'title' => 'Item Idempotent',
            'barcode' => '8991112223334',
            'sku' => 'IDM-001',
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 10,
            'tax_rate' => 0,
        ]);

        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouse->id,
            'stock' => 10,
        ]);

        $transaction = $this->createPendingTransaction('midtrans', $warehouse->id);
        $transaction->details()->create([
            'product_id' => $product->id,
            'qty' => 4,
            'conversion_factor' => 1,
            'base_unit_price' => 2000,
            'unit_price' => 2000,
            'price' => 8000,
        ]);

        $payload = [
            'order_id' => $transaction->invoice,
            'status_code' => '200',
            'gross_amount' => (string) (int) $transaction->grand_total,
            'transaction_status' => 'expire',
            'transaction_id' => 'midtrans-tx-idempotent-001',
        ];
        $payload['signature_key'] = hash(
            'sha512',
            $payload['order_id'].$payload['status_code'].$payload['gross_amount'].'server-key'
        );

        // First webhook call
        $response1 = $this->postJson(route('webhooks.midtrans'), $payload);
        $response1->assertOk()->assertJson(['status' => 'success']);

        $product->refresh();
        $this->assertSame(14, (int) $product->stock);
        $this->assertSame(1, StockMutation::where('reference_type', 'transaction_restock')->where('reference_id', $transaction->id)->count());

        // Second duplicate webhook call (e.g. gateway retry)
        $response2 = $this->postJson(route('webhooks.midtrans'), $payload);
        $response2->assertOk()->assertJson(['status' => 'success']);

        $product->refresh();
        // Stock must still be 14 (NOT 18!)
        $this->assertSame(14, (int) $product->stock);
        $this->assertSame(1, StockMutation::where('reference_type', 'transaction_restock')->where('reference_id', $transaction->id)->count());
    }

    public function test_webhook_does_not_restock_already_paid_transaction(): void
    {
        PaymentSetting::create([
            'default_gateway' => 'midtrans',
            'midtrans_enabled' => true,
            'midtrans_server_key' => 'server-key',
            'midtrans_client_key' => 'client-key',
        ]);

        $warehouse = Warehouse::create([
            'code' => 'WH-PAID-01',
            'name' => 'Gudang Paid',
            'address' => 'Jl. Paid No. 1',
            'status' => 'active',
        ]);

        $product = $this->createProduct([
            'title' => 'Item Paid',
            'barcode' => '8990001112223',
            'sku' => 'PAD-001',
            'buy_price' => 1000,
            'sell_price' => 2000,
            'stock' => 10,
            'tax_rate' => 0,
        ]);

        $transaction = $this->createPendingTransaction('midtrans', $warehouse->id);
        $transaction->update(['payment_status' => 'paid']);

        $transaction->details()->create([
            'product_id' => $product->id,
            'qty' => 5,
            'conversion_factor' => 1,
            'base_unit_price' => 2000,
            'unit_price' => 2000,
            'price' => 10000,
        ]);

        $payload = [
            'order_id' => $transaction->invoice,
            'status_code' => '200',
            'gross_amount' => (string) (int) $transaction->grand_total,
            'transaction_status' => 'expire',
            'transaction_id' => 'midtrans-tx-paid-expire-001',
        ];
        $payload['signature_key'] = hash(
            'sha512',
            $payload['order_id'].$payload['status_code'].$payload['gross_amount'].'server-key'
        );

        $response = $this->postJson(route('webhooks.midtrans'), $payload);
        $response->assertOk();

        $transaction->refresh();
        $product->refresh();

        $this->assertSame('paid', $transaction->payment_status);
        $this->assertSame(10, (int) $product->stock);
        $this->assertFalse(StockMutation::where('reference_type', 'transaction_restock')->where('reference_id', $transaction->id)->exists());
    }

    private function createProduct(array $attributes = []): Product
    {
        $category = Category::firstOrCreate([
            'name' => 'Default Category',
        ], [
            'description' => 'Default Description',
            'image' => 'default.png',
        ]);

        return Product::create(array_merge([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(8)),
            'title' => 'Produk Test',
            'description' => 'Deskripsi produk test.',
            'buy_price' => 10000,
            'sell_price' => 20000,
            'stock' => 10,
            'tax_rate' => 0,
        ], $attributes));
    }

    private function createPendingTransaction(string $paymentMethod, ?int $warehouseId = null): Transaction
    {
        return Transaction::create([
            'cashier_id' => User::factory()->create()->id,
            'warehouse_id' => $warehouseId,
            'invoice' => 'TRX-WEBHOOK-'.strtoupper($paymentMethod).'-'.uniqid(),
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => 150000,
            'payment_method' => $paymentMethod,
            'payment_status' => 'pending',
        ]);
    }
}
