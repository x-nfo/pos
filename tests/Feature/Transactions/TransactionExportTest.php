<?php

namespace Tests\Feature\Transactions;

use App\Exports\TransactionsExport;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class TransactionExportTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected Warehouse $warehouseA;

    protected Warehouse $warehouseB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([PermissionSeeder::class, RoleSeeder::class, UserSeeder::class]);
        $this->admin = User::role('super-admin')->first() ?? User::where('email', 'admin@mail.com')->first();
        $this->admin->markEmailAsVerified();

        $this->warehouseA = Warehouse::firstOrCreate(['code' => 'WH-A'], ['name' => 'Cabang A']);
        $this->warehouseB = Warehouse::firstOrCreate(['code' => 'WH-B'], ['name' => 'Cabang B']);
    }

    public function test_can_download_transactions_export(): void
    {
        Excel::fake();
        $this->actingAs($this->admin);

        $response = $this->get(route('export.transactions'));

        $response->assertSuccessful();
        Excel::assertDownloaded('transaksi.xlsx', function (TransactionsExport $export) {
            return true;
        });
    }

    public function test_export_respects_filters_and_formats_columns(): void
    {
        $customer = Customer::create([
            'name' => 'Budi Santoso',
            'no_telp' => '08123456789',
            'address' => 'Jl. Merdeka No. 1',
        ]);

        $trx1 = Transaction::create([
            'warehouse_id' => $this->warehouseA->id,
            'cashier_id' => $this->admin->id,
            'customer_id' => $customer->id,
            'invoice' => 'TRX-PAID-001',
            'cash' => 100000,
            'change' => 0,
            'discount' => 5000,
            'shipping_cost' => 0,
            'tax_total' => 0,
            'grand_total' => 95000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'created_at' => '2026-09-01 10:00:00',
        ]);

        $trx2 = Transaction::create([
            'warehouse_id' => $this->warehouseB->id,
            'cashier_id' => $this->admin->id,
            'customer_id' => null,
            'invoice' => 'TRX-UNPAID-002',
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 10000,
            'tax_total' => 0,
            'grand_total' => 110000,
            'payment_method' => 'pay_later',
            'payment_status' => 'unpaid',
            'created_at' => '2026-09-03 14:00:00',
        ]);

        $request = Request::create(route('export.transactions'), 'GET', [
            'payment_status' => 'paid',
            'warehouse_id' => $this->warehouseA->id,
        ]);
        $request->setUserResolver(fn () => $this->admin);

        $export = new TransactionsExport($request);
        $collection = $export->collection();

        $this->assertCount(1, $collection);
        $this->assertEquals('TRX-PAID-001', $collection->first()->invoice);

        $headings = $export->headings();
        $this->assertContains('Invoice', $headings);
        $this->assertContains('Cabang / Gudang', $headings);
        $this->assertContains('Metode Pembayaran', $headings);
        $this->assertContains('Status Pembayaran', $headings);
        $this->assertContains('Grand Total', $headings);

        $mapped = $export->map($collection->first());
        $this->assertEquals('TRX-PAID-001', $mapped[0]);
        $this->assertEquals('Cabang A', $mapped[2]);
        $this->assertEquals('Budi Santoso', $mapped[4]);
        $this->assertEquals('Tunai', $mapped[5]);
        $this->assertEquals('Lunas', $mapped[6]);
        $this->assertEquals(95000, $mapped[11]);
    }

    public function test_branch_cashier_scoping_applies_to_export(): void
    {
        $cashier = User::factory()->create([
            'warehouse_id' => $this->warehouseA->id,
        ]);
        $cashier->markEmailAsVerified();
        $cashier->givePermissionTo('transactions-access');

        Transaction::create([
            'warehouse_id' => $this->warehouseA->id,
            'cashier_id' => $cashier->id,
            'invoice' => 'TRX-BRANCH-A',
            'cash' => 50000,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'tax_total' => 0,
            'grand_total' => 50000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        Transaction::create([
            'warehouse_id' => $this->warehouseB->id,
            'cashier_id' => $this->admin->id,
            'invoice' => 'TRX-BRANCH-B',
            'cash' => 50000,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'tax_total' => 0,
            'grand_total' => 50000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
        ]);

        $request = Request::create(route('export.transactions'), 'GET');
        $request->setUserResolver(fn () => $cashier);

        $export = new TransactionsExport($request);
        $collection = $export->collection();

        $invoices = $collection->pluck('invoice')->all();
        $this->assertContains('TRX-BRANCH-A', $invoices);
        $this->assertNotContains('TRX-BRANCH-B', $invoices);
    }
}
