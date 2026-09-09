<?php

namespace Tests\Feature\Pricing;

use App\Models\Cart;
use App\Models\Category;
use App\Models\PricingRule;
use App\Models\PricingRuleQtyBreak;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PricingServiceTest extends TestCase
{
    use RefreshDatabase;

    private PricingService $service;

    private Warehouse $warehouse;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(PricingService::class);
        $this->warehouse = Warehouse::firstOrCreate(['code' => 'MAIN'], ['name' => 'Main Warehouse']);
        $this->category = Category::create([
            'name' => 'Test Category',
            'description' => 'Test',
            'image' => 'test.png',
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper
    // ──────────────────────────────────────────────────────────────────────────

    private function makeProduct(int $sellPrice = 10000, int $buyPrice = 5000): Product
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'title' => 'Produk '.Str::random(4),
            'barcode' => 'BC-'.Str::upper(Str::random(8)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'description' => 'Test',
            'image' => 'test.png',
            'sell_price' => $sellPrice,
            'buy_price' => $buyPrice,
            'tax_rate' => 0,
        ]);
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouse->id,
            'stock' => 100,
        ]);

        return $product;
    }

    private function makeCart(Product $product, int $qty = 1, ?User $cashier = null): Cart
    {
        $cashier = $cashier ?? User::factory()->create();

        return Cart::create([
            'warehouse_id' => $this->warehouse->id,
            'cashier_id' => $cashier->id,
            'product_id' => $product->id,
            'qty' => $qty,
            'price' => $product->sell_price * $qty,
        ]);
    }

    private function makeRule(array $attrs = []): PricingRule
    {
        return PricingRule::create(array_merge([
            'name' => 'Rule '.Str::random(4),
            'kind' => PricingRule::KIND_STANDARD_DISCOUNT,
            'is_active' => true,
            'priority' => 100,
            'target_type' => 'all',
            'customer_scope' => 'all',
            'discount_type' => 'percentage',
            'discount_value' => 10,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHour(),
        ], $attrs));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Base pricing — no promo
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_no_active_rule_returns_base_sell_price(): void
    {
        $product = $this->makeProduct(sellPrice: 15000);
        $cart = $this->makeCart($product, qty: 2);

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        $this->assertSame(30000, $item['line_base_total']);   // 15000 × 2
        $this->assertSame(0, $item['line_discount_total']);
        $this->assertSame(30000, $item['line_total']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Standard discount — percentage
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_standard_discount_percentage_applied_correctly(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $cart = $this->makeCart($product, qty: 2);

        // 10% off → discount = round(20000 * 10/100) = 2000
        $this->makeRule([
            'target_type' => 'product',
            'product_id' => $product->id,
            'discount_type' => 'percentage',
            'discount_value' => 10,
        ]);

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        $this->assertSame(2000, $item['line_discount_total']);
        $this->assertSame(18000, $item['line_total']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Standard discount — fixed amount per unit
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_standard_discount_fixed_amount_applied_correctly(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $cart = $this->makeCart($product, qty: 3);

        // Rp 1000 off per unit → discount = 1000 × 3 = 3000
        $this->makeRule([
            'target_type' => 'product',
            'product_id' => $product->id,
            'discount_type' => 'fixed_amount',
            'discount_value' => 1000,
        ]);

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        $this->assertSame(3000, $item['line_discount_total']);
        $this->assertSame(27000, $item['line_total']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Standard discount — fixed price
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_standard_discount_fixed_price_applied_correctly(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $cart = $this->makeCart($product, qty: 2);

        // fixed price Rp 8000/unit → lineTotal = 16000, discount = 20000 - 16000 = 4000
        $this->makeRule([
            'target_type' => 'product',
            'product_id' => $product->id,
            'discount_type' => 'fixed_price',
            'discount_value' => 8000,
        ]);

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        $this->assertSame(4000, $item['line_discount_total']);
        $this->assertSame(16000, $item['line_total']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Discount cannot exceed line total — negative price prevention
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_discount_cannot_exceed_line_total(): void
    {
        $product = $this->makeProduct(sellPrice: 1000);
        $cart = $this->makeCart($product, qty: 1);

        // Fixed discount Rp 5000 on a Rp 1000 product — should be clamped
        $this->makeRule([
            'target_type' => 'product',
            'product_id' => $product->id,
            'discount_type' => 'fixed_amount',
            'discount_value' => 5000,
        ]);

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        $this->assertGreaterThanOrEqual(0, $item['line_total']);
        $this->assertLessThanOrEqual(1000, $item['line_discount_total']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Qty break
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_qty_break_tier_activates_when_qty_meets_threshold(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $rule = $this->makeRule([
            'target_type' => 'product',
            'product_id' => $product->id,
            'kind' => PricingRule::KIND_QTY_BREAK,
            'discount_type' => 'percentage',
            'discount_value' => 0,
        ]);

        // Tier: buy >= 5 → 10% off
        PricingRuleQtyBreak::create([
            'pricing_rule_id' => $rule->id,
            'min_qty' => 5,
            'discount_type' => 'percentage',
            'discount_value' => 10,
        ]);

        $cart = $this->makeCart($product, qty: 5);

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        // 10000 × 5 = 50000 base, 10% off = 5000 discount
        $this->assertSame(5000, $item['line_discount_total']);
        $this->assertSame(45000, $item['line_total']);
    }

    /** @test */
    public function test_qty_break_does_not_apply_below_threshold(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $rule = $this->makeRule([
            'target_type' => 'product',
            'product_id' => $product->id,
            'kind' => PricingRule::KIND_QTY_BREAK,
            'discount_type' => 'percentage',
            'discount_value' => 0,
        ]);

        PricingRuleQtyBreak::create([
            'pricing_rule_id' => $rule->id,
            'min_qty' => 5,
            'discount_type' => 'percentage',
            'discount_value' => 10,
        ]);

        $cart = $this->makeCart($product, qty: 3); // below threshold

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        $this->assertSame(0, $item['line_discount_total']);
        $this->assertSame(30000, $item['line_total']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Summary totals
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function test_preview_summary_reflects_correct_totals(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $cashier = User::factory()->create();
        $cart1 = $this->makeCart($product, qty: 2, cashier: $cashier);
        $cart2 = $this->makeCart($product, qty: 3, cashier: $cashier);

        // 10% off
        $this->makeRule([
            'target_type' => 'product',
            'product_id' => $product->id,
            'discount_type' => 'percentage',
            'discount_value' => 10,
        ]);

        $preview = $this->service->previewCart([$cart1, $cart2]);
        $summary = $preview['summary'];

        // base = 20000 + 30000 = 50000; discount = 5000; after = 45000
        $this->assertSame(50000, $summary['base_subtotal']);
        $this->assertSame(5000, $summary['promo_discount_total']);
        $this->assertSame(45000, $summary['subtotal_after_promo']);
    }

    /** @test */
    public function test_inactive_rule_is_not_applied(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $cart = $this->makeCart($product, qty: 2);

        $this->makeRule([
            'is_active' => false,
            'target_type' => 'product',
            'product_id' => $product->id,
            'discount_type' => 'percentage',
            'discount_value' => 50,
        ]);

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        $this->assertSame(0, $item['line_discount_total']);
        $this->assertSame(20000, $item['line_total']);
    }

    /** @test */
    public function test_expired_rule_is_not_applied(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $cart = $this->makeCart($product, qty: 1);

        $this->makeRule([
            'target_type' => 'product',
            'product_id' => $product->id,
            'starts_at' => now()->subDays(10),
            'ends_at' => now()->subDay(), // expired yesterday
            'discount_type' => 'percentage',
            'discount_value' => 50,
        ]);

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        $this->assertSame(0, $item['line_discount_total']);
        $this->assertSame(10000, $item['line_total']);
    }

    /** @test */
    public function test_category_scoped_rule_applies_to_product_in_category(): void
    {
        $product = $this->makeProduct(sellPrice: 10000);
        $cart = $this->makeCart($product, qty: 1);

        $this->makeRule([
            'target_type' => 'category',
            'category_id' => $this->category->id,
            'discount_type' => 'percentage',
            'discount_value' => 20,
        ]);

        $preview = $this->service->previewCart([$cart]);
        $item = collect($preview['items'])->first();

        $this->assertSame(2000, $item['line_discount_total']);
        $this->assertSame(8000, $item['line_total']);
    }
}
