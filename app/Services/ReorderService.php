<?php

namespace App\Services;

use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReorderService
{
    /**
     * Ambil produk yang stoknya di bawah atau sama dengan min_stock.
     * Jika $warehouseId diberikan, cek stok spesifik gudang tersebut.
     * Jika $warehouseId null, cek akumulasi stok di semua gudang.
     */
    public function getLowStockProducts(?int $warehouseId = null): Collection
    {
        if ($warehouseId) {
            return Product::query()
                ->where('min_stock', '>', 0)
                ->whereHas('warehouses', function ($q) use ($warehouseId) {
                    $q->where('product_warehouse.warehouse_id', $warehouseId)
                        ->whereColumn('product_warehouse.stock', '<=', 'products.min_stock');
                })
                ->with(['warehouses' => fn ($q) => $q->where('product_warehouse.warehouse_id', $warehouseId)])
                ->orderBy('id')
                ->limit(50)
                ->get();
        }

        // Akumulasi stok multi-gudang (COALESCE jika produk belum memiliki record di product_warehouse)
        $stockSubquery = DB::table('product_warehouse')
            ->selectRaw('product_id, SUM(stock) as total_stock')
            ->groupBy('product_id');

        return Product::query()
            ->where('min_stock', '>', 0)
            ->leftJoinSub($stockSubquery, 'pw_stock', fn ($join) => $join->on('pw_stock.product_id', '=', 'products.id'))
            ->whereRaw('COALESCE(pw_stock.total_stock, 0) <= products.min_stock')
            ->select('products.*')
            ->orderByRaw('COALESCE(pw_stock.total_stock, 0) ASC')
            ->limit(50)
            ->get();
    }

    /**
     * Hitung sisa kuantitas barang yang sedang dalam pemesanan aktif ke supplier
     * (PO status 'ordered' atau 'partial_received') yang belum selesai diterima.
     */
    public function getIncomingPoQty(int $productId, ?int $warehouseId = null): int
    {
        return (int) PurchaseOrderItem::query()
            ->where('product_id', $productId)
            ->whereHas('purchaseOrder', function ($q) use ($warehouseId) {
                $q->whereIn('status', ['ordered', 'partial_received'])
                    ->when($warehouseId, fn ($sub) => $sub->where('warehouse_id', $warehouseId));
            })
            ->sum(DB::raw('CASE WHEN qty_ordered > qty_received THEN (qty_ordered - qty_received) * COALESCE(conversion_factor, 1) ELSE 0 END'));
    }

    /**
     * Hitung saran kuantitas reorder dengan memperhitungkan stok saat ini dan barang yang sedang dalam perjalanan.
     */
    public function calculateSuggestedQty(Product $product, ?int $warehouseId = null, bool $deductIncoming = true): int
    {
        if ($product->max_stock <= 0 || $product->min_stock <= 0) {
            return 0;
        }

        $currentStock = $warehouseId
            ? (int) ($product->warehouses()->where('warehouse_id', $warehouseId)->value('stock') ?? 0)
            : $product->stockTotal();

        $incomingQty = $deductIncoming
            ? $this->getIncomingPoQty($product->id, $warehouseId)
            : 0;

        return max(0, $product->max_stock - ($currentStock + $incomingQty));
    }

    /**
     * Buat draft Purchase Order otomatis dari daftar produk kritis.
     * Mendukung penentuan warehouse_id, supplier_id, dan catatan kustom.
     */
    public function createDraftPurchaseOrder(
        Collection $products,
        int $userId,
        ?int $warehouseId = null,
        ?int $supplierId = null,
        ?string $notes = null
    ): ?PurchaseOrder {
        $poItems = $products
            ->map(function (Product $product) use ($warehouseId) {
                $suggestedQty = $this->calculateSuggestedQty($product, $warehouseId, true);

                if ($suggestedQty <= 0) {
                    return null;
                }

                return [
                    'product_id' => $product->id,
                    'qty_ordered' => $suggestedQty,
                    'unit_price' => $product->buy_price,
                    'conversion_factor' => 1.0,
                ];
            })
            ->filter()
            ->values()
            ->toArray();

        if (empty($poItems)) {
            return null;
        }

        $orderPayload = [
            'notes' => $notes ?: 'Auto-generated from restock suggestion',
            'warehouse_id' => $warehouseId,
            'supplier_id' => $supplierId,
        ];

        return app(PurchaseOrderService::class)->createOrder(
            $orderPayload,
            $poItems,
            $userId
        );
    }

    /**
     * Ringkasan analitik restock untuk kebutuhan dashboard/laporan.
     */
    public function getRestockSummary(?int $warehouseId = null): array
    {
        $lowStockProducts = $this->getLowStockProducts($warehouseId);

        $items = $lowStockProducts->map(function (Product $product) use ($warehouseId) {
            $currentStock = $warehouseId
                ? (int) ($product->warehouses()->where('warehouse_id', $warehouseId)->value('stock') ?? 0)
                : $product->stockTotal();

            $incomingPoQty = $this->getIncomingPoQty($product->id, $warehouseId);
            $suggestedQty = $this->calculateSuggestedQty($product, $warehouseId, true);
            $estimatedCost = $suggestedQty * (int) $product->buy_price;

            // Cari supplier terakhir jika pernah ada PO sebelumnya
            $lastSupplier = PurchaseOrderItem::query()
                ->where('product_id', $product->id)
                ->whereHas('purchaseOrder', fn ($q) => $q->whereNotNull('supplier_id'))
                ->with('purchaseOrder.supplier:id,name')
                ->latest('id')
                ->first()
                ?->purchaseOrder
                ?->supplier;

            return [
                'product_id' => $product->id,
                'title' => $product->title ?? $product->name,
                'sku' => $product->sku,
                'current_stock' => $currentStock,
                'incoming_po_qty' => $incomingPoQty,
                'min_stock' => (int) $product->min_stock,
                'max_stock' => (int) $product->max_stock,
                'suggested_qty' => $suggestedQty,
                'unit_buy_price' => (int) $product->buy_price,
                'estimated_cost' => $estimatedCost,
                'last_supplier_id' => $lastSupplier?->id,
                'last_supplier_name' => $lastSupplier?->name,
            ];
        });

        return [
            'warehouse_id' => $warehouseId,
            'critical_count' => $items->count(),
            'total_suggested_qty' => (int) $items->sum('suggested_qty'),
            'total_estimated_cost' => (int) $items->sum('estimated_cost'),
            'items' => $items->values()->all(),
        ];
    }
}
