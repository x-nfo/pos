<?php

namespace App\Services;

use App\Models\GoodsReceiving;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductWarehouse;
use App\Models\SupplierReturn;
use App\Models\SupplierReturnItem;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SupplierReturnService
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly StockMutationService $stockMutationService,
        private readonly DocumentNumberService $documentNumberService
    ) {}

    public function generateDocumentNumber(Warehouse|int|string|null $warehouse = null): string
    {
        $branchCode = $this->documentNumberService->formatBranchCode($warehouse);
        $prefix = 'SR-'.$branchCode.'-'.now()->format('Ymd').'-';

        return $this->documentNumberService->generateSequentialNumber(
            modelClass: SupplierReturn::class,
            column: 'document_number',
            prefix: $prefix
        );
    }

    public function createReturn(array $data, array $items, int $userId): SupplierReturn
    {
        return $this->documentNumberService->executeWithRetry(function () use ($data, $items, $userId) {
            return DB::transaction(function () use ($data, $items, $userId) {
                if (! empty($data['goods_receiving_id'])) {
                    $gr = GoodsReceiving::with('purchaseOrder.payable')->find($data['goods_receiving_id']);
                    if ($gr) {
                        $data['warehouse_id'] = $data['warehouse_id'] ?? $gr->warehouse_id;
                        $data['supplier_id'] = $data['supplier_id'] ?? $gr->supplier_id;
                        $data['payable_id'] = $data['payable_id'] ?? $gr->purchaseOrder?->payable?->id;
                    }
                }

                $warehouseId = $data['warehouse_id'] ?? null;

                foreach ($items as $item) {
                    $product = Product::find($item['product_id']);
                    if ($product) {
                        $conversionFactor = (float) ($item['conversion_factor'] ?? 1.0);
                        $qtyReturned = (int) $item['qty_returned'];
                        $baseQty = (int) round($qtyReturned * ($conversionFactor > 0 ? $conversionFactor : 1.0));

                        $availableStock = $warehouseId
                            ? (int) (ProductWarehouse::where([
                                'product_id' => $product->id,
                                'warehouse_id' => $warehouseId,
                            ])->value('stock') ?? $product->stock)
                            : (int) $product->stock;

                        if ($availableStock < $baseQty) {
                            throw ValidationException::withMessages([
                                'items' => "Stok fisik produk {$product->title} tidak mencukupi untuk diretur ke supplier (tersedia: {$availableStock}).",
                            ]);
                        }
                    }
                }

                $return = SupplierReturn::create([
                    'supplier_id' => $data['supplier_id'] ?? null,
                    'warehouse_id' => $warehouseId,
                    'goods_receiving_id' => $data['goods_receiving_id'] ?? null,
                    'payable_id' => $data['payable_id'] ?? null,
                    'document_number' => $data['document_number'] ?? $this->generateDocumentNumber($warehouseId),
                    'status' => 'draft',
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $userId,
                ]);

                foreach ($items as $item) {
                    SupplierReturnItem::create([
                        'supplier_return_id' => $return->id,
                        'goods_receiving_item_id' => $item['goods_receiving_item_id'] ?? null,
                        'product_id' => $item['product_id'],
                        'unit_id' => $item['unit_id'] ?? null,
                        'conversion_factor' => $item['conversion_factor'] ?? 1.0,
                        'qty_returned' => $item['qty_returned'],
                        'batch_number' => ! empty($item['batch_number']) ? trim($item['batch_number']) : null,
                        'unit_price' => $item['unit_price'] ?? 0,
                        'reason' => $item['reason'] ?? null,
                        'notes' => $item['notes'] ?? null,
                    ]);
                }

                $this->auditLogService->log(
                    event: 'supplier_return.created',
                    module: 'purchase',
                    auditable: $return,
                    description: 'Supplier return '.$return->document_number.' dibuat.',
                    after: [
                        'document_number' => $return->document_number,
                        'supplier_id' => $return->supplier_id,
                        'warehouse_id' => $return->warehouse_id,
                        'status' => 'draft',
                        'total_items' => count($items),
                    ],
                    meta: ['supplier_return_id' => $return->id],
                );

                return $return;
            });
        });
    }

    public function complete(SupplierReturn $return): void
    {
        DB::transaction(function () use ($return) {
            $return->load(['items.product', 'payable', 'goodsReceiving.purchaseOrder.payable']);

            if (! $return->payable_id && $return->goodsReceiving?->purchaseOrder?->payable) {
                $return->payable_id = $return->goodsReceiving->purchaseOrder->payable->id;
                $return->saveQuietly();
                $return->setRelation('payable', $return->goodsReceiving->purchaseOrder->payable);
            }

            foreach ($return->items as $item) {
                $product = $item->product;
                if (! $product) {
                    continue;
                }

                $conversionFactor = (float) ($item->conversion_factor ?: 1.0);
                $baseQty = (int) round($item->qty_returned * $conversionFactor);

                $availableStock = $return->warehouse_id
                    ? (int) (ProductWarehouse::where([
                        'product_id' => $product->id,
                        'warehouse_id' => $return->warehouse_id,
                    ])->value('stock') ?? $product->stock)
                    : (int) $product->stock;

                if ($availableStock < $baseQty) {
                    throw ValidationException::withMessages([
                        'return' => "Stok fisik produk {$product->title} tidak mencukupi untuk diretur ke supplier (tersedia: {$availableStock}).",
                    ]);
                }
            }

            $targetWarehouseId = $return->warehouse_id ?? Warehouse::defaultId();

            foreach ($return->items as $item) {
                $product = $item->product;
                if (! $product) {
                    continue;
                }

                $conversionFactor = (float) ($item->conversion_factor ?: 1.0);
                $baseQty = (int) round($item->qty_returned * $conversionFactor);
                $stockBefore = (int) $product->stock;

                $pivot = ProductWarehouse::firstOrCreate([
                    'product_id' => $product->id,
                    'warehouse_id' => $targetWarehouseId,
                ], ['stock' => 0]);
                $pivot->decrement('stock', $baseQty);

                if (! empty($item->batch_number)) {
                    $batch = ProductBatch::where([
                        'product_id' => $product->id,
                        'warehouse_id' => $targetWarehouseId,
                        'batch_number' => $item->batch_number,
                    ])->first();

                    if ($batch) {
                        $batch->stock = max(0, $batch->stock - $baseQty);
                        $batch->save();
                    }
                }

                $this->stockMutationService->recordSupplierReturnOut(
                    product: $product,
                    supplierReturn: $return,
                    qty: $baseQty,
                    stockBefore: $stockBefore,
                    stockAfter: (int) $product->stock,
                    notes: $item->reason ?? 'Retur barang ke supplier',
                    userId: $return->created_by,
                    batchNumber: $item->batch_number,
                );
            }

            if ($return->payable_id && $return->payable) {
                $returnAmount = (float) $return->items->sum(fn ($i) => $i->qty_returned * $i->unit_price);
                $payable = $return->payable;
                $payable->total = max(0, (float) $payable->total - $returnAmount);
                if ($payable->total <= 0) {
                    $payable->total = 0;
                    $payable->status = 'paid';
                } elseif ($payable->paid > 0) {
                    $payable->status = $payable->paid >= $payable->total ? 'paid' : 'partial';
                }
                $payable->save();
            }

            $return->update([
                'status' => 'completed',
                'returned_at' => now(),
            ]);

            $this->auditLogService->log(
                event: 'supplier_return.completed',
                module: 'purchase',
                auditable: $return,
                description: 'Supplier return '.$return->document_number.' diselesaikan. Stok dikurangi dan hutang dikoreksi.',
                after: ['status' => 'completed'],
                meta: ['supplier_return_id' => $return->id],
            );
        });
    }

    public function cancel(SupplierReturn $return): void
    {
        DB::transaction(function () use ($return) {
            $return->update(['status' => 'cancelled']);

            $this->auditLogService->log(
                event: 'supplier_return.cancelled',
                module: 'purchase',
                auditable: $return,
                description: 'Supplier return '.$return->document_number.' dibatalkan.',
                after: ['status' => 'cancelled'],
                meta: ['supplier_return_id' => $return->id],
            );
        });
    }
}
