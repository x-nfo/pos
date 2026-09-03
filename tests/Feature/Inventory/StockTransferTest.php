<?php

namespace Tests\Feature\Inventory;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\StockMutation;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class StockTransferTest extends TestCase
{
    use RefreshDatabase;

    protected Warehouse $warehouseUtama;

    protected Warehouse $warehouseToko;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'stock-transfers-access',
            'stock-transfers-create',
            'stock-transfers-send',
            'stock-transfers-receive',
            'stock-transfers-cancel',
            'stock-mutations-access',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }

        $this->warehouseUtama = Warehouse::create([
            'code' => 'GUD-UTAMA',
            'name' => 'Gudang Utama',
            'type' => 'main',
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $this->warehouseToko = Warehouse::create([
            'code' => 'GUD-TOKO',
            'name' => 'Gudang Toko',
            'type' => 'branch',
            'is_active' => true,
            'sort_order' => 1,
        ]);
    }

    private function createUserWithPermissions(array $permissions, array $attributes = []): User
    {
        $user = User::factory()->create(array_merge([
            'email_verified_at' => now(),
        ], $attributes));

        $user->givePermissionTo($permissions);

        return $user;
    }

    private function createProduct(int $stock = 10, string $title = 'Kopi Arabika'): Product
    {
        $category = Category::firstOrCreate([
            'name' => 'Bahan Baku',
        ], [
            'description' => 'Kategori bahan baku',
            'image' => 'category.png',
        ]);

        return Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(8)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'title' => $title,
            'description' => 'Deskripsi '.$title,
            'buy_price' => 15000,
            'sell_price' => 25000,
            'stock' => $stock,
            'tax_rate' => 0,
        ]);
    }

    /**
     * TC-WH-05: Transfer Stok Melebihi Saldo Gudang Asal
     * Gudang Utama hanya punya 10 Pcs, coba kirim 20 Pcs.
     * Ditolak dengan pesan "Stok gudang asal tidak mencukupi" (ValidationException).
     */
    public function test_tc_wh_05_cannot_send_transfer_when_source_warehouse_stock_is_insufficient(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-create',
            'stock-transfers-send',
        ]);

        // Gudang Utama hanya punya 10 Pcs
        $product = $this->createProduct(stock: 10, title: 'Kopi Arabika');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
            'stock' => 10,
        ]);

        // Buat transfer draft dengan qty 20 Pcs dari Gudang Utama ke Gudang Toko
        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0001',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'draft',
            'notes' => 'Transfer uji melebihi saldo',
            'created_by' => $user->id,
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'qty' => 20,
        ]);

        // Coba kirim transfer (20 Pcs saat saldo hanya 10 Pcs)
        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.send', $transfer));

        // Ditolak dengan error validasi transfer
        $response->assertSessionHasErrors('transfer');

        $errorMessage = session('errors')->first('transfer');
        $this->assertStringContainsString('Stok Kopi Arabika tidak mencukupi di gudang asal', $errorMessage);
        $this->assertStringContainsString('tersedia: 10', $errorMessage);

        // Verifikasi integritas data: status tetap draft
        $transfer->refresh();
        $this->assertSame('draft', $transfer->status);

        // Stok gudang asal dan stok master produk tidak berubah
        $pwSource = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
        ])->first();
        $this->assertSame(10, $pwSource->stock);
        $this->assertSame(10, $product->fresh()->stock);

        // Tidak ada mutasi stok tercatat
        $this->assertDatabaseMissing('stock_mutations', [
            'reference_type' => 'stock_transfer',
            'reference_id' => $transfer->id,
        ]);

        // Tidak ada log transfer sent
        $this->assertDatabaseMissing('audit_logs', [
            'event' => 'stock_transfer.sent',
            'auditable_id' => $transfer->id,
        ]);
    }

    /**
     * Negative: Coba kirim transfer ketika produk sama sekali belum memiliki record stok di gudang asal.
     */
    public function test_cannot_send_transfer_when_source_warehouse_has_no_stock_record(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-create',
            'stock-transfers-send',
        ]);

        $product = $this->createProduct(stock: 0, title: 'Teh Hijau');

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0002',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'qty' => 5,
        ]);

        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.send', $transfer));

        $response->assertSessionHasErrors('transfer');
        $errorMessage = session('errors')->first('transfer');
        $this->assertStringContainsString('Stok Teh Hijau tidak mencukupi di gudang asal', $errorMessage);
        $this->assertStringContainsString('tersedia: 0', $errorMessage);
    }

    /**
     * TC-WH-01: Buat Transfer Antar Gudang
     * Buat transfer 50 Pcs dari Gudang Utama ke Gudang Toko. Status: Draft.
     * Belum ada stok yang berpindah; draft tersimpan rapi.
     */
    public function test_tc_wh_01_can_create_stock_transfer_draft_without_moving_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-create',
        ]);

        $product = $this->createProduct(stock: 100, title: 'Sirup Vanilla');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
            'stock' => 100,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('stock-transfers.store'), [
                'source_warehouse_id' => $this->warehouseUtama->id,
                'destination_warehouse_id' => $this->warehouseToko->id,
                'notes' => 'Transfer restok mingguan',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty' => 50,
                    ],
                ],
            ]);

        $transfer = StockTransfer::first();
        $this->assertNotNull($transfer);
        $response->assertRedirect(route('stock-transfers.show', $transfer));

        $this->assertSame('draft', $transfer->status);
        $this->assertSame($this->warehouseUtama->id, $transfer->source_warehouse_id);
        $this->assertSame($this->warehouseToko->id, $transfer->destination_warehouse_id);
        $this->assertSame('Transfer restok mingguan', $transfer->notes);
        $this->assertSame($user->id, $transfer->created_by);
        $this->assertCount(1, $transfer->items);
        $this->assertSame(50, $transfer->items->first()->qty);

        // Verifikasi belum ada stok yang berpindah
        $pwSource = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
        ])->first();
        $this->assertSame(100, $pwSource->stock);
        $this->assertSame(100, $product->fresh()->stock);

        // Audit log created
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'stock_transfer.created',
            'auditable_id' => $transfer->id,
        ]);
    }

    /**
     * TC-WH-02: Kirim Barang (Send Transfer)
     * Klik "Kirim" pada transfer draft.
     * Status: in_transit; stok Gudang Utama berkurang 50 Pcs; stok Toko belum bertambah.
     */
    public function test_tc_wh_02_can_send_stock_transfer_and_deducts_source_warehouse_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-create',
            'stock-transfers-send',
        ]);

        $product = $this->createProduct(stock: 100, title: 'Sirup Karamel');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
            'stock' => 100,
        ]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0003',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'qty' => 50,
        ]);

        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.send', $transfer));

        $response->assertSessionHas('success', 'Transfer stok berhasil dikirim.');

        $transfer->refresh();
        $this->assertSame('in_transit', $transfer->status);

        // Stok Gudang Utama berkurang 50 (100 -> 50)
        $pwSource = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
        ])->first();
        $this->assertSame(50, $pwSource->stock);

        // Stok Gudang Toko belum bertambah
        $pwDest = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseToko->id,
        ])->first();
        $this->assertNull($pwDest);

        // Mutasi stok tipe 'out' tercatat untuk Gudang Utama
        $mutation = StockMutation::where('reference_type', 'stock_transfer')
            ->where('reference_id', $transfer->id)
            ->first();

        $this->assertNotNull($mutation);
        $this->assertSame('out', $mutation->mutation_type);
        $this->assertSame(50, $mutation->qty);
        $this->assertSame(100, $mutation->stock_before);
        $this->assertSame(50, $mutation->stock_after);
        $this->assertSame($this->warehouseUtama->id, $mutation->warehouse_id);

        // Audit log sent
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'stock_transfer.sent',
            'auditable_id' => $transfer->id,
        ]);
    }

    /**
     * TC-WH-03: Terima Barang Lengkap (Full Receive)
     * Status: completed; stok Gudang Toko bertambah +50; mutasi in tercatat.
     */
    public function test_tc_wh_03_can_fully_receive_in_transit_stock_transfer(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-receive',
        ]);

        $product = $this->createProduct(stock: 50, title: 'Biji Kopi Robusta');

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0004',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'in_transit',
            'created_by' => $user->id,
        ]);

        $item = StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'qty' => 50,
        ]);

        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.receive', $transfer));

        $response->assertSessionHas('success', 'Transfer stok berhasil diterima.');

        $transfer->refresh();
        $item->refresh();

        $this->assertSame('completed', $transfer->status);
        $this->assertNotNull($transfer->completed_at);
        $this->assertSame(50, $item->received_qty);

        // Stok Gudang Toko bertambah +50
        $pwDest = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseToko->id,
        ])->first();
        $this->assertNotNull($pwDest);
        $this->assertSame(50, $pwDest->stock);

        // Mutasi stok tipe 'in' tercatat untuk Gudang Toko
        $mutation = StockMutation::where('reference_type', 'stock_transfer')
            ->where('reference_id', $transfer->id)
            ->where('mutation_type', 'in')
            ->first();

        $this->assertNotNull($mutation);
        $this->assertSame(50, $mutation->qty);
        $this->assertSame(0, $mutation->stock_before);
        $this->assertSame(50, $mutation->stock_after);
        $this->assertSame($this->warehouseToko->id, $mutation->warehouse_id);

        // Audit log received
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'stock_transfer.received',
            'auditable_id' => $transfer->id,
        ]);
    }

    /**
     * TC-WH-03: Terima Barang Sebagian (Partial Receive)
     * Gudang Toko hanya menerima 45 Pcs (5 Pcs rusak di perjalanan).
     * Stok Gudang Toko bertambah +45; tercatat selisih 5 Pcs di log transfer & mutasi.
     */
    public function test_tc_wh_03_can_partially_receive_stock_transfer_and_records_difference(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-create',
            'stock-transfers-send',
            'stock-transfers-receive',
        ]);

        $product = $this->createProduct(stock: 100, title: 'Kopi Susu Kemasan');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
            'stock' => 100,
        ]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0005',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $item = StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'qty' => 50,
        ]);

        // Kirim 50 Pcs dari Gudang Utama (stok Gudang Utama berkurang 50 -> 50, master berkurang 50 -> 50)
        $this->actingAs($user)->post(route('stock-transfers.send', $transfer));

        // Gudang Toko menerima 45 Pcs (5 Pcs rusak di jalan)
        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.receive', $transfer), [
                'items' => [
                    [
                        'id' => $item->id,
                        'received_qty' => 45,
                        'notes' => '5 Pcs rusak di perjalanan',
                    ],
                ],
            ]);

        $response->assertSessionHas('success', 'Transfer stok berhasil diterima.');

        $transfer->refresh();
        $item->refresh();

        $this->assertSame('completed', $transfer->status);
        $this->assertSame(45, $item->received_qty);
        $this->assertSame('5 Pcs rusak di perjalanan', $item->notes);

        // Stok Gudang Utama tetap 50
        $pwSource = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
        ])->first();
        $this->assertSame(50, $pwSource->stock);

        // Stok Gudang Toko bertambah 45
        $pwDest = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseToko->id,
        ])->first();
        $this->assertNotNull($pwDest);
        $this->assertSame(45, $pwDest->stock);

        // Total master stock menjadi 95 (50 di Gudang Utama + 45 di Gudang Toko, 5 rusak di perjalanan)
        $this->assertSame(95, $product->fresh()->stock);

        // Mutasi stok mencatat 45 masuk dengan catatan selisih 5
        $mutation = StockMutation::where('reference_type', 'stock_transfer')
            ->where('reference_id', $transfer->id)
            ->where('mutation_type', 'in')
            ->first();

        $this->assertNotNull($mutation);
        $this->assertSame(45, $mutation->qty);
        $this->assertSame(0, $mutation->stock_before);
        $this->assertSame(45, $mutation->stock_after);
        $this->assertStringContainsString('Selisih: 5', $mutation->notes);
        $this->assertStringContainsString('5 Pcs rusak di perjalanan', $mutation->notes);
    }

    /**
     * TC-WH-04: Batalkan Transfer yang Sedang In-Transit
     * Admin klik "Cancel Transfer" saat status in_transit.
     * Status cancelled; stok 50 Pcs otomatis dikembalikan ke Gudang Utama dan tercatat mutasi masuk.
     */
    public function test_tc_wh_04_can_cancel_in_transit_stock_transfer_and_restores_source_stock_with_mutation(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-cancel',
        ]);

        $product = $this->createProduct(stock: 50, title: 'Cangkir Kertas');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
            'stock' => 50, // Sebelumnya 100, berkurang 50 saat dikirim
        ]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0006',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'in_transit',
            'created_by' => $user->id,
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'qty' => 50,
        ]);

        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.cancel', $transfer));

        $response->assertSessionHas('success', 'Transfer stok dibatalkan.');

        $transfer->refresh();
        $this->assertSame('cancelled', $transfer->status);

        // Stok 50 Pcs otomatis dikembalikan ke Gudang Utama (50 + 50 = 100)
        $pwSource = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
        ])->first();
        $this->assertSame(100, $pwSource->stock);
        $this->assertSame(100, $product->fresh()->stock);

        // Tercatat mutasi stok pembatalan transfer di gudang asal
        $mutation = StockMutation::where('reference_type', 'stock_transfer')
            ->where('reference_id', $transfer->id)
            ->where('mutation_type', 'in')
            ->first();

        $this->assertNotNull($mutation);
        $this->assertSame(50, $mutation->qty);
        $this->assertSame(50, $mutation->stock_before);
        $this->assertSame(100, $mutation->stock_after);
        $this->assertSame($this->warehouseUtama->id, $mutation->warehouse_id);
        $this->assertStringContainsString('Pembatalan transfer', $mutation->notes);

        // Audit log cancelled
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'stock_transfer.cancelled',
            'auditable_id' => $transfer->id,
        ]);
    }

    /**
     * Verifikasi akurasi saldo mutasi stok ketika gudang tujuan sudah memiliki saldo awal.
     */
    public function test_stock_mutation_balance_accuracy_on_receive_with_existing_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-receive',
        ]);

        // Gudang tujuan sudah memiliki 25 unit
        $product = $this->createProduct(stock: 75, title: 'Sedotan Stainless');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseToko->id,
            'stock' => 25,
        ]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0007',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'in_transit',
            'created_by' => $user->id,
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'qty' => 50,
        ]);

        $this->actingAs($user)->post(route('stock-transfers.receive', $transfer));

        // Saldo gudang tujuan: 25 + 50 = 75
        $pwDest = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseToko->id,
        ])->first();
        $this->assertSame(75, $pwDest->stock);

        // Saldo mutasi mencatat sebelum: 25, sesudah: 75
        $mutation = StockMutation::where('reference_type', 'stock_transfer')
            ->where('reference_id', $transfer->id)
            ->where('mutation_type', 'in')
            ->first();

        $this->assertNotNull($mutation);
        $this->assertSame(50, $mutation->qty);
        $this->assertSame(25, $mutation->stock_before);
        $this->assertSame(75, $mutation->stock_after);
    }

    /**
     * Validasi: Tidak boleh menerima jumlah lebih dari qty yang dikirim.
     */
    public function test_cannot_receive_more_than_sent_qty(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-receive',
        ]);

        $product = $this->createProduct(stock: 50);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0008',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'in_transit',
            'created_by' => $user->id,
        ]);

        $item = StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'qty' => 10,
        ]);

        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.receive', $transfer), [
                'items' => [
                    [
                        'id' => $item->id,
                        'received_qty' => 15,
                    ],
                ],
            ]);

        $response->assertSessionHasErrors('transfer');
        $errorMessage = session('errors')->first('transfer');
        $this->assertStringContainsString('tidak boleh melebihi jumlah kirim', $errorMessage);
    }

    /**
     * Validasi: Tidak boleh membuat transfer dengan gudang asal dan tujuan yang sama.
     */
    public function test_cannot_create_transfer_with_same_source_and_destination_warehouse(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-create',
        ]);

        $product = $this->createProduct(stock: 50);

        $response = $this
            ->actingAs($user)
            ->post(route('stock-transfers.store'), [
                'source_warehouse_id' => $this->warehouseUtama->id,
                'destination_warehouse_id' => $this->warehouseUtama->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'qty' => 5,
                    ],
                ],
            ]);

        $response->assertInvalid(['destination_warehouse_id']);
        $this->assertDatabaseCount('stock_transfers', 0);
    }

    /**
     * Validasi status: Tidak bisa mengirim transfer yang bukan berstatus draft.
     */
    public function test_cannot_send_transfer_that_is_not_draft(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-send',
        ]);

        $product = $this->createProduct(stock: 50);
        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0009',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'in_transit',
            'created_by' => $user->id,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('stock-transfers.send', $transfer));

        $response->assertSessionHasErrors('transfer');
        $errorMessage = session('errors')->first('transfer');
        $this->assertStringContainsString('Hanya transfer dengan status draft yang bisa dikirim', $errorMessage);
    }

    /**
     * Validasi status: Tidak bisa menerima transfer yang bukan berstatus in_transit.
     */
    public function test_cannot_receive_transfer_that_is_not_in_transit(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-receive',
        ]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0010',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('stock-transfers.receive', $transfer));

        $response->assertSessionHasErrors('transfer');
        $errorMessage = session('errors')->first('transfer');
        $this->assertStringContainsString('Hanya transfer dengan status in_transit yang bisa diterima', $errorMessage);
    }

    /**
     * Validasi status: Tidak bisa membatalkan transfer yang sudah completed.
     */
    public function test_cannot_cancel_completed_stock_transfer(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-cancel',
        ]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0011',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'completed',
            'created_by' => $user->id,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('stock-transfers.cancel', $transfer));

        $response->assertSessionHasErrors('transfer');
        $errorMessage = session('errors')->first('transfer');
        $this->assertStringContainsString('Hanya transfer draft atau in_transit yang bisa dibatalkan', $errorMessage);
    }

    /**
     * Hak akses: User tanpa permission tidak dapat mengakses endpoint stock transfer.
     */
    public function test_unauthorized_user_cannot_perform_stock_transfer_actions(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-20260902-0012',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $this->actingAs($user)->get(route('stock-transfers.index'))->assertForbidden();
        $this->actingAs($user)->get(route('stock-transfers.create'))->assertForbidden();
        $this->actingAs($user)->post(route('stock-transfers.store'), [])->assertForbidden();
        $this->actingAs($user)->get(route('stock-transfers.show', $transfer))->assertForbidden();
        $this->actingAs($user)->post(route('stock-transfers.send', $transfer))->assertForbidden();
        $this->actingAs($user)->post(route('stock-transfers.receive', $transfer))->assertForbidden();
        $this->actingAs($user)->post(route('stock-transfers.cancel', $transfer))->assertForbidden();
    }

    /**
     * UOM Test: Dapat membuat draft transfer stok dengan satuan (misal Dus) dan faktor konversi.
     */
    public function test_can_create_stock_transfer_draft_with_uom(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-create',
        ]);

        $unit = Unit::firstOrCreate([
            'code' => 'DUS',
        ], [
            'name' => 'Dus',
            'symbol' => 'dus',
        ]);

        $product = $this->createProduct(stock: 100, title: 'Kopi Sachet Dus');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
            'stock' => 100,
        ]);

        $response = $this
            ->actingAs($user)
            ->post(route('stock-transfers.store'), [
                'source_warehouse_id' => $this->warehouseUtama->id,
                'destination_warehouse_id' => $this->warehouseToko->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'unit_id' => $unit->id,
                        'conversion_factor' => 24,
                        'qty' => 2,
                    ],
                ],
            ]);

        $transfer = StockTransfer::first();
        $this->assertNotNull($transfer);
        $response->assertRedirect(route('stock-transfers.show', $transfer));

        $item = $transfer->items->first();
        $this->assertSame(2, $item->qty);
        $this->assertSame($unit->id, $item->unit_id);
        $this->assertEquals(24.0000, (float) $item->conversion_factor);
        $this->assertSame(48, $item->base_qty);
    }

    /**
     * UOM Test: Pengiriman transfer stok menghitung base quantity (qty * conversion_factor)
     * dan memotong stok gudang asal dalam satuan dasar.
     */
    public function test_send_transfer_with_uom_deducts_correct_base_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-create',
            'stock-transfers-send',
        ]);

        $unit = Unit::firstOrCreate([
            'code' => 'DUS',
        ], [
            'name' => 'Dus',
            'symbol' => 'dus',
        ]);

        $product = $this->createProduct(stock: 50, title: 'Kopi Botol');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
            'stock' => 50,
        ]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-UOM-0001',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'unit_id' => $unit->id,
            'conversion_factor' => 24,
            'qty' => 2, // 2 Dus = 48 unit dasar
        ]);

        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.send', $transfer));

        $response->assertSessionHas('success', 'Transfer stok berhasil dikirim.');

        // Stok asal berkurang 48 (50 -> 2)
        $pwSource = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
        ])->first();
        $this->assertSame(2, $pwSource->stock);
        $this->assertSame(2, $product->fresh()->stock);

        // Mutasi keluar tercatat 48
        $mutation = StockMutation::where('reference_type', 'stock_transfer')
            ->where('reference_id', $transfer->id)
            ->first();
        $this->assertSame(48, $mutation->qty);
        $this->assertStringContainsString('2 Dus', $mutation->notes);
    }

    /**
     * UOM Test: Ditolak jika kuantitas dasar setelah konversi melebihi saldo gudang asal.
     */
    public function test_cannot_send_transfer_when_converted_base_stock_exceeds_source_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-send',
        ]);

        $unit = Unit::firstOrCreate([
            'code' => 'DUS',
        ], [
            'name' => 'Dus',
            'symbol' => 'dus',
        ]);

        // Saldo gudang asal hanya 20 unit dasar
        $product = $this->createProduct(stock: 20, title: 'Kopi Susu');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
            'stock' => 20,
        ]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-UOM-0002',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        // Coba kirim 1 Dus (24 unit dasar) saat saldo hanya 20
        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'unit_id' => $unit->id,
            'conversion_factor' => 24,
            'qty' => 1,
        ]);

        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.send', $transfer));

        $response->assertSessionHasErrors('transfer');
        $errorMessage = session('errors')->first('transfer');
        $this->assertStringContainsString('Stok Kopi Susu tidak mencukupi di gudang asal', $errorMessage);
        $this->assertStringContainsString('tersedia: 20', $errorMessage);
        $this->assertStringContainsString('dibutuhkan: 24', $errorMessage);
    }

    /**
     * UOM Test: Penerimaan transfer stok dengan UOM menambahkan kuantitas dasar ke gudang tujuan.
     */
    public function test_can_receive_stock_transfer_with_uom_and_increments_correct_destination_base_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-receive',
        ]);

        $unit = Unit::firstOrCreate([
            'code' => 'CTN',
        ], [
            'name' => 'Carton',
            'symbol' => 'ctn',
        ]);

        $product = $this->createProduct(stock: 48, title: 'Snack Bar');

        $transfer = StockTransfer::create([
            'document_number' => 'ST-UOM-0003',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'in_transit',
            'created_by' => $user->id,
        ]);

        $item = StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'unit_id' => $unit->id,
            'conversion_factor' => 24,
            'qty' => 2, // 2 Karton = 48 unit dasar
        ]);

        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.receive', $transfer));

        $response->assertSessionHas('success', 'Transfer stok berhasil diterima.');

        // Stok gudang tujuan bertambah 48
        $pwDest = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseToko->id,
        ])->first();
        $this->assertNotNull($pwDest);
        $this->assertSame(48, $pwDest->stock);

        // Mutasi in tercatat 48
        $mutation = StockMutation::where('reference_type', 'stock_transfer')
            ->where('reference_id', $transfer->id)
            ->where('mutation_type', 'in')
            ->first();
        $this->assertNotNull($mutation);
        $this->assertSame(48, $mutation->qty);
        $this->assertStringContainsString('2 Carton', $mutation->notes);
    }

    /**
     * UOM Test: Penerimaan sebagian (partial receive) dengan UOM menghitung selisih dan mutasi secara akurat.
     */
    public function test_partial_receive_with_uom_records_correct_difference_and_base_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-receive',
        ]);

        $unit = Unit::firstOrCreate([
            'code' => 'DUS',
        ], [
            'name' => 'Dus',
            'symbol' => 'dus',
        ]);

        $product = $this->createProduct(stock: 48, title: 'Minuman Kaleng');

        $transfer = StockTransfer::create([
            'document_number' => 'ST-UOM-0004',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'in_transit',
            'created_by' => $user->id,
        ]);

        $item = StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'unit_id' => $unit->id,
            'conversion_factor' => 24,
            'qty' => 2, // 2 Dus = 48 unit
        ]);

        // Terima 1 Dus (1 Dus rusak di jalan)
        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.receive', $transfer), [
                'items' => [
                    [
                        'id' => $item->id,
                        'received_qty' => 1,
                        'notes' => '1 Dus basah di jalan',
                    ],
                ],
            ]);

        $response->assertSessionHas('success', 'Transfer stok berhasil diterima.');

        // Stok gudang tujuan bertambah 1 Dus = 24 unit
        $pwDest = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseToko->id,
        ])->first();
        $this->assertSame(24, $pwDest->stock);

        // Mutasi mencatat 24 unit masuk dengan rincian selisih
        $mutation = StockMutation::where('reference_type', 'stock_transfer')
            ->where('reference_id', $transfer->id)
            ->where('mutation_type', 'in')
            ->first();
        $this->assertNotNull($mutation);
        $this->assertSame(24, $mutation->qty);
        $this->assertStringContainsString('Selisih: 1 Dus [24 unit]', $mutation->notes);
        $this->assertStringContainsString('1 Dus basah di jalan', $mutation->notes);
    }

    /**
     * UOM Test: Pembatalan transfer in-transit dengan UOM mengembalikan saldo dasar ke gudang asal.
     */
    public function test_cancel_in_transit_transfer_with_uom_restores_correct_base_stock(): void
    {
        $user = $this->createUserWithPermissions([
            'stock-transfers-access',
            'stock-transfers-cancel',
        ]);

        $unit = Unit::firstOrCreate([
            'code' => 'DUS',
        ], [
            'name' => 'Dus',
            'symbol' => 'dus',
        ]);

        $product = $this->createProduct(stock: 2, title: 'Cangkir');
        ProductWarehouse::create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
            'stock' => 2, // Sebelumnya 50, berkurang 48 (2 Dus) saat dikirim
        ]);

        $transfer = StockTransfer::create([
            'document_number' => 'ST-UOM-0005',
            'source_warehouse_id' => $this->warehouseUtama->id,
            'destination_warehouse_id' => $this->warehouseToko->id,
            'status' => 'in_transit',
            'created_by' => $user->id,
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'unit_id' => $unit->id,
            'conversion_factor' => 24,
            'qty' => 2, // 48 unit dasar
        ]);

        $response = $this
            ->from(route('stock-transfers.show', $transfer))
            ->actingAs($user)
            ->post(route('stock-transfers.cancel', $transfer));

        $response->assertSessionHas('success', 'Transfer stok dibatalkan.');

        // Saldo dikembalikan 48 unit dasar (2 + 48 = 50)
        $pwSource = ProductWarehouse::where([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouseUtama->id,
        ])->first();
        $this->assertSame(50, $pwSource->stock);
        $this->assertSame(50, $product->fresh()->stock);

        // Mutasi in pengembalian tercatat 48
        $mutation = StockMutation::where('reference_type', 'stock_transfer')
            ->where('reference_id', $transfer->id)
            ->where('mutation_type', 'in')
            ->first();
        $this->assertNotNull($mutation);
        $this->assertSame(48, $mutation->qty);
    }
}
