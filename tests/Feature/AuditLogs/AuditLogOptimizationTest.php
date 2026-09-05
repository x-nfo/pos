<?php

namespace Tests\Feature\AuditLogs;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockMutation;
use App\Models\Transaction;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\StockMutationService;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class AuditLogOptimizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate([
            'name' => 'audit-logs-access',
            'guard_name' => 'web',
        ]);
    }

    public function test_audit_log_model_prunes_records_older_than_retention_days(): void
    {
        Config::set('audit.retention_days', 90);

        // Record older than 90 days
        $oldLog = AuditLog::create([
            'event' => 'old.event',
            'module' => 'test',
            'description' => 'Old audit log',
            'created_at' => now()->subDays(95),
        ]);

        // Record within 90 days
        $recentLog = AuditLog::create([
            'event' => 'recent.event',
            'module' => 'test',
            'description' => 'Recent audit log',
            'created_at' => now()->subDays(10),
        ]);

        Artisan::call('model:prune', [
            '--model' => [AuditLog::class],
        ]);

        $this->assertDatabaseMissing('audit_logs', ['id' => $oldLog->id]);
        $this->assertDatabaseHas('audit_logs', ['id' => $recentLog->id]);
    }

    public function test_audit_log_service_is_fail_safe_when_creation_fails(): void
    {
        Log::shouldReceive('warning')
            ->once()
            ->withArgs(function ($message, $context) {
                return str_contains($message, 'Failed to record audit log')
                    && ($context['event'] ?? null) === 'test.event'
                    && ($context['module'] ?? null) === 'test';
            });

        // Mock AuditLog model or pass an invalid non-serializable object that triggers exception
        $service = new AuditLogService;

        // Pass a mock or trigger exception by mocking or invalid data
        // Here we can pass a malformed object or test directly by passing an object that fails in create
        // Let's create an anonymous class that throws on getMorphClass
        $failingModel = new class extends Product
        {
            public function getMorphClass()
            {
                throw new \RuntimeException('Database disk full simulation');
            }
        };

        $result = $service->log(
            event: 'test.event',
            module: 'test',
            auditable: $failingModel,
            description: 'Testing fail-safe resilience'
        );

        $this->assertInstanceOf(AuditLog::class, $result);
        $this->assertFalse($result->exists);
    }

    public function test_record_sale_out_creates_stock_mutation_without_duplicate_audit_log(): void
    {
        $user = User::factory()->create();
        $category = Category::create([
            'name' => 'Kategori Test',
            'description' => 'Desc',
            'image' => 'cat.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'prod.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(6)),
            'sku' => 'SKU-'.Str::upper(Str::random(6)),
            'title' => 'Produk Penjualan',
            'description' => 'Desc',
            'buy_price' => 10000,
            'sell_price' => 15000,
            'stock' => 20,
            'tax_rate' => 0,
        ]);

        $transaction = Transaction::create([
            'cashier_id' => $user->id,
            'invoice' => 'TRX-TEST-001',
            'cash' => 15000,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => 15000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $initialAuditCount = AuditLog::count();

        $mutationService = app(StockMutationService::class);
        $mutation = $mutationService->recordSaleOut(
            product: $product,
            transaction: $transaction,
            qty: 2,
            stockBefore: 20,
            stockAfter: 18,
            warehouseId: null,
            notes: 'Test sale out',
            userId: $user->id
        );

        // Verify StockMutation is created properly
        $this->assertInstanceOf(StockMutation::class, $mutation);
        $this->assertDatabaseHas('stock_mutations', [
            'id' => $mutation->id,
            'product_id' => $product->id,
            'reference_type' => 'transaction',
            'reference_id' => $transaction->id,
            'mutation_type' => 'out',
            'qty' => 2,
            'stock_before' => 20,
            'stock_after' => 18,
        ]);

        // Verify NO duplicate audit log was created for routine sale
        $this->assertSame($initialAuditCount, AuditLog::count());
    }

    public function test_audit_log_index_uses_date_range_and_caches_filter_dropdowns(): void
    {
        Cache::flush();

        $user = User::factory()->create();
        $user->givePermissionTo('audit-logs-access');

        AuditLog::create([
            'user_id' => $user->id,
            'event' => 'custom.event',
            'module' => 'custom_module',
            'target_label' => 'Target A',
            'description' => 'Desc A',
            'created_at' => now()->parse('2026-06-15 10:00:00'),
        ]);

        AuditLog::create([
            'user_id' => $user->id,
            'event' => 'other.event',
            'module' => 'other_module',
            'target_label' => 'Target B',
            'description' => 'Desc B',
            'created_at' => now()->parse('2026-06-20 15:00:00'),
        ]);

        // Query with date range matching only the first record
        $this->actingAs($user)
            ->get(route('audit-logs.index', [
                'date_from' => '2026-06-14',
                'date_to' => '2026-06-16',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/AuditLogs/Index')
                ->has('auditLogs.data', 1)
                ->where('auditLogs.data.0.event', 'custom.event'));

        // Verify cache keys exist
        $this->assertTrue(Cache::has('audit_log_modules'));
        $this->assertTrue(Cache::has('audit_log_events'));
    }

    public function test_console_schedule_has_audit_log_prune_command(): void
    {
        $schedule = app(Schedule::class);

        $events = collect($schedule->events());

        $hasPruneEvent = $events->contains(function ($event) {
            return str_contains($event->command, 'model:prune')
                && str_contains($event->command, 'AuditLog');
        });

        $this->assertTrue($hasPruneEvent, 'Schedule does not contain model:prune for AuditLog');
    }
}
