<?php

namespace Tests\Unit\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\ReorderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReorderServiceTest extends TestCase
{
    use RefreshDatabase;

    private ReorderService $service;

    private Warehouse $warehouse1;

    private Warehouse $warehouse2;

    private User $user;

    private Supplier $supplier;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(ReorderService::class);

        $this->warehouse1 = Warehouse::create([
            'code' => 'HQ',
            'name' => 'Gudang Pusat',
            'type' => 'main',
            'is_active' => true,
        ]);

        $this->warehouse2 = Warehouse::create([
            'code' => 'BR-01',
            'name' => 'Cabang Barat',
            'type' => 'branch',
            'is_active' => true,
        ]);

        $this->user = User::factory()->create();

        $this->supplier = Supplier::create([
            'name' => 'PT Sumber Pangan Sejahtera',
            'phone' => '08123456789',
        ]);

        $this->category = Category::create([
            'name' => 'General',
        ]);
    }

    public function test_get_low_stock_products_by_warehouse(): void
    {
        $category = Category::create(['name' => 'Snack']);

        // Produk A: Stok 5 di WH1 (Kritis karena min_stock 10)
        $productA = Product::create([
            'category_id' => $category->id,
            'barcode' => 'SNK-001',
            'sku' => 'SKU-A',
            'title' => 'Keripik Kentang',
            'buy_price' => 5000,
            'sell_price' => 8000,
            'stock' => 5,
            'min_stock' => 10,
            'max_stock' => 50,
            'tax_rate' => 0,
        ]);
        ProductWarehouse::create(['product_id' => $productA->id, 'warehouse_id' => $this->warehouse1->id, 'stock' => 5]);

        // Produk B: Stok 25 di WH1 (Aman karena min_stock 10)
        $productB = Product::create([
            'category_id' => $category->id,
            'barcode' => 'SNK-002',
            'sku' => 'SKU-B',
            'title' => 'Biskuit Coklat',
            'buy_price' => 4000,
            'sell_price' => 6000,
            'stock' => 25,
            'min_stock' => 10,
            'max_stock' => 50,
            'tax_rate' => 0,
        ]);
        ProductWarehouse::create(['product_id' => $productB->id, 'warehouse_id' => $this->warehouse1->id, 'stock' => 25]);

        $lowStock = $this->service->getLowStockProducts($this->warehouse1->id);

        $this->assertCount(1, $lowStock);
        $this->assertSame($productA->id, $lowStock->first()->id);
    }

    public function test_get_low_stock_products_global_without_warehouse_id(): void
    {
        $category = Category::create(['name' => 'Minuman']);

        // Produk dengan stok 0 di semua gudang (kritis)
        $product = Product::create([
            'category_id' => $category->id,
            'barcode' => 'MNM-001',
            'sku' => 'SKU-MNM',
            'title' => 'Jus Mangga',
            'buy_price' => 7000,
            'sell_price' => 10000,
            'stock' => 0,
            'min_stock' => 15,
            'max_stock' => 60,
            'tax_rate' => 0,
        ]);
        ProductWarehouse::create(['product_id' => $product->id, 'warehouse_id' => $this->warehouse1->id, 'stock' => 0]);

        $lowStock = $this->service->getLowStockProducts(null);

        $this->assertNotEmpty($lowStock);
        $this->assertTrue($lowStock->contains('id', $product->id));
    }

    public function test_incoming_po_qty_calculation(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'barcode' => 'PO-PRD-01',
            'sku' => 'SKU-INC',
            'title' => 'Susu UHT',
            'buy_price' => 10000,
            'sell_price' => 14000,
            'stock' => 10,
            'min_stock' => 20,
            'max_stock' => 100,
            'tax_rate' => 0,
        ]);

        // PO 1: Status ordered (Pesan 50, belum terima)
        $po1 = PurchaseOrder::create([
            'document_number' => 'PO-TEST-001',
            'warehouse_id' => $this->warehouse1->id,
            'supplier_id' => $this->supplier->id,
            'status' => 'ordered',
            'created_by' => $this->user->id,
        ]);
        PurchaseOrderItem::create([
            'purchase_order_id' => $po1->id,
            'product_id' => $product->id,
            'qty_ordered' => 50,
            'qty_received' => 0,
            'unit_price' => 10000,
        ]);

        // PO 2: Status partial_received (Pesan 30, sudah terima 10 => sisa 20)
        $po2 = PurchaseOrder::create([
            'document_number' => 'PO-TEST-002',
            'warehouse_id' => $this->warehouse1->id,
            'supplier_id' => $this->supplier->id,
            'status' => 'partial_received',
            'created_by' => $this->user->id,
        ]);
        PurchaseOrderItem::create([
            'purchase_order_id' => $po2->id,
            'product_id' => $product->id,
            'qty_ordered' => 30,
            'qty_received' => 10,
            'unit_price' => 10000,
        ]);

        // PO 3: Status completed (Pesan 20, sudah selesai => tidak boleh dihitung lagi)
        $po3 = PurchaseOrder::create([
            'document_number' => 'PO-TEST-003',
            'warehouse_id' => $this->warehouse1->id,
            'supplier_id' => $this->supplier->id,
            'status' => 'completed',
            'created_by' => $this->user->id,
        ]);
        PurchaseOrderItem::create([
            'purchase_order_id' => $po3->id,
            'product_id' => $product->id,
            'qty_ordered' => 20,
            'qty_received' => 20,
            'unit_price' => 10000,
        ]);

        // Total incoming = 50 (PO 1) + 20 (PO 2) = 70 pcs
        $incoming = $this->service->getIncomingPoQty($product->id, $this->warehouse1->id);
        $this->assertSame(70, $incoming);
    }

    public function test_suggested_order_qty_deducts_incoming_po_to_prevent_double_order(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'barcode' => 'TEST-DED-01',
            'sku' => 'SKU-DED',
            'title' => 'Kopi Bubuk',
            'buy_price' => 15000,
            'sell_price' => 22000,
            'stock' => 10,
            'min_stock' => 20,
            'max_stock' => 100,
            'tax_rate' => 0,
        ]);
        ProductWarehouse::create(['product_id' => $product->id, 'warehouse_id' => $this->warehouse1->id, 'stock' => 10]);

        // Tanpa incoming PO: Butuh = 100 - 10 = 90 pcs
        $suggestedWithoutIncoming = $this->service->calculateSuggestedQty($product, $this->warehouse1->id, deductIncoming: false);
        $this->assertSame(90, $suggestedWithoutIncoming);

        // Buat PO berjalan sebanyak 60 pcs
        $po = PurchaseOrder::create([
            'document_number' => 'PO-TEST-ORDERED',
            'warehouse_id' => $this->warehouse1->id,
            'supplier_id' => $this->supplier->id,
            'status' => 'ordered',
            'created_by' => $this->user->id,
        ]);
        PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'qty_ordered' => 60,
            'qty_received' => 0,
            'unit_price' => 15000,
        ]);

        // Dengan incoming PO (60 pcs): Butuh = 100 - (10 stok fisik + 60 incoming) = 30 pcs
        $suggestedWithIncoming = $this->service->calculateSuggestedQty($product, $this->warehouse1->id, deductIncoming: true);
        $this->assertSame(30, $suggestedWithIncoming);

        // Uji method pada Product model langsung
        $this->assertSame(30, $product->suggestedOrderQty($this->warehouse1->id, true));
    }

    public function test_create_draft_purchase_order_sets_warehouse_and_supplier(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'barcode' => 'AUTO-PO-01',
            'sku' => 'SKU-AUTO',
            'title' => 'Beras Premium 5kg',
            'buy_price' => 65000,
            'sell_price' => 75000,
            'stock' => 5,
            'min_stock' => 20,
            'max_stock' => 50,
            'tax_rate' => 0,
        ]);
        ProductWarehouse::create(['product_id' => $product->id, 'warehouse_id' => $this->warehouse2->id, 'stock' => 5]);

        $draftPo = $this->service->createDraftPurchaseOrder(
            collect([$product]),
            $this->user->id,
            warehouseId: $this->warehouse2->id,
            supplierId: $this->supplier->id,
            notes: 'Restock otomatis Cabang Barat'
        );

        $this->assertNotNull($draftPo);
        $this->assertSame('draft', $draftPo->status);
        $this->assertSame($this->warehouse2->id, $draftPo->warehouse_id);
        $this->assertSame($this->supplier->id, $draftPo->supplier_id);
        $this->assertStringContainsString('PO-BR01-', $draftPo->document_number);
        $this->assertSame('Restock otomatis Cabang Barat', $draftPo->notes);

        $this->assertCount(1, $draftPo->items);
        $item = $draftPo->items->first();
        $this->assertSame(45, (int) $item->qty_ordered); // 50 - 5 = 45 pcs
        $this->assertSame(65000, (int) $item->unit_price);
    }

    public function test_get_restock_summary_returns_accurate_financial_metrics(): void
    {
        $product = Product::create([
            'category_id' => $this->category->id,
            'barcode' => 'SUM-PRD-01',
            'sku' => 'SKU-SUM',
            'title' => 'Minyak Goreng 2L',
            'buy_price' => 30000,
            'sell_price' => 38000,
            'stock' => 10,
            'min_stock' => 30,
            'max_stock' => 80,
            'tax_rate' => 0,
        ]);
        ProductWarehouse::create(['product_id' => $product->id, 'warehouse_id' => $this->warehouse1->id, 'stock' => 10]);

        $summary = $this->service->getRestockSummary($this->warehouse1->id);

        $this->assertSame(1, $summary['critical_count']);
        $this->assertSame(70, $summary['total_suggested_qty']); // 80 - 10 = 70 pcs
        $this->assertSame(2100000, $summary['total_estimated_cost']); // 70 x 30.000 = Rp 2.100.000
    }
}
