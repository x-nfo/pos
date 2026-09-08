<?php

namespace Tests\Unit\Services;

use App\Models\Setting;
use App\Services\TaxService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaxServiceTest extends TestCase
{
    use RefreshDatabase;

    private TaxService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Setting::set('tax_default_rate', '11.00');
        $this->service = app(TaxService::class);
    }

    /** @test */
    public function test_tax_exclusive_calculates_correctly(): void
    {
        $result = $this->service->calculateLineItem(10000, 'exclusive', 11.0);

        $this->assertSame(1100, $result['tax_amount']);
        $this->assertSame(10000, $result['line_total_before_tax']);
        $this->assertSame(11100, $result['line_total_after_tax']);
        $this->assertSame(11.0, $result['tax_rate']);
    }

    /** @test */
    public function test_tax_inclusive_extracts_tax_correctly(): void
    {
        // 11100 inclusive 11%: tax = 11100 - (11100/1.11) = 1100
        $result = $this->service->calculateLineItem(11100, 'inclusive', 11.0);

        $this->assertSame(1100, $result['tax_amount']);
        $this->assertSame(10000, $result['line_total_before_tax']);
        $this->assertSame(11100, $result['line_total_after_tax']);
    }

    /** @test */
    public function test_tax_inclusive_rounds_fractional_result(): void
    {
        // 1000 inclusive 11%: tax = round(1000 - 1000/1.11) = round(99.099) = 99
        $result = $this->service->calculateLineItem(1000, 'inclusive', 11.0);

        $this->assertSame(99, $result['tax_amount']);
        $this->assertSame(901, $result['line_total_before_tax']);
    }

    /** @test */
    public function test_tax_rate_zero_returns_no_tax(): void
    {
        $result = $this->service->calculateLineItem(50000, 'exclusive', 0.0);

        $this->assertSame(0, $result['tax_amount']);
        $this->assertSame(50000, $result['line_total_before_tax']);
        $this->assertSame(50000, $result['line_total_after_tax']);
    }

    /** @test */
    public function test_tax_rate_negative_returns_no_tax(): void
    {
        $result = $this->service->calculateLineItem(50000, 'exclusive', -5.0);

        $this->assertSame(0, $result['tax_amount']);
        $this->assertSame(50000, $result['line_total_after_tax']);
    }

    /** @test */
    public function test_tax_on_zero_amount_returns_zero(): void
    {
        $result = $this->service->calculateLineItem(0, 'exclusive', 11.0);

        $this->assertSame(0, $result['tax_amount']);
        $this->assertSame(0, $result['line_total_after_tax']);
    }

    /** @test */
    public function test_transaction_tax_sums_multiple_items(): void
    {
        $items = [
            ['line_total' => 10000, 'tax_type' => 'exclusive', 'tax_rate' => 11.0],
            ['line_total' => 20000, 'tax_type' => 'exclusive', 'tax_rate' => 11.0],
        ];

        $result = $this->service->calculateTransactionTax($items, 11.0);

        $this->assertSame(3300, $result['tax_total']);
        $this->assertCount(2, $result['items']);
    }

    /** @test */
    public function test_transaction_tax_uses_default_rate_when_item_rate_not_set(): void
    {
        $items = [['line_total' => 10000]];

        $result = $this->service->calculateTransactionTax($items, 11.0);

        $this->assertSame(1100, $result['tax_total']);
    }

    /** @test */
    public function test_transaction_tax_handles_mixed_rates(): void
    {
        $items = [
            ['line_total' => 10000, 'tax_type' => 'exclusive', 'tax_rate' => 11.0],
            ['line_total' => 10000, 'tax_type' => 'exclusive', 'tax_rate' => 0.0],
        ];

        $result = $this->service->calculateTransactionTax($items, 11.0);

        $this->assertSame(1100, $result['tax_total']);
    }

    /** @test */
    public function test_transaction_tax_reflects_effective_rate_from_last_taxed_item(): void
    {
        $items = [
            ['line_total' => 10000, 'tax_type' => 'exclusive', 'tax_rate' => 11.0],
            ['line_total' => 5000,  'tax_type' => 'exclusive', 'tax_rate' => 5.0],
        ];

        $result = $this->service->calculateTransactionTax($items, 11.0);

        $this->assertSame(5.0, $result['tax_rate']);
    }

    /** @test */
    public function test_get_default_rate_reads_from_setting(): void
    {
        Setting::set('tax_default_rate', '5.00');
        $service = app(TaxService::class);

        $this->assertSame(5.0, $service->getDefaultRate());
    }
}
