<?php

namespace App\Services;

use App\Models\GoodsReceiving;
use App\Models\GoodsReceivingItem;
use App\Models\Payable;
use App\Models\ProductBatch;
use App\Models\ProductWarehouse;
use App\Models\PurchaseOrder;
use Illuminate\Support\Facades\DB;

class GoodsReceivingService
{
    public function __construct(
        private readonly StockMutationService $stockMutationService,
        private readonly AuditLogService $auditLogService,
        private readonly DocumentNumberService $documentNumberService
    ) {}

    public function generateDocumentNumber(): string
    {
        return $this->documentNumberService->generateSequentialNumber(
            modelClass: GoodsReceiving::class,
            column: 'document_number',
            prefix: 'GR-'.now()->format('Ymd').'-'
        );
    }

    public function receive(PurchaseOrder $order, array $items, ?string $notes, int $userId): GoodsReceiving
    {
        return $this->documentNumberService->executeWithRetry(function () use ($order, $items, $notes, $userId) {
            return DB::transaction(function () use ($order, $items, $notes, $userId) {
                $receiving = GoodsReceiving::create([
                    'purchase_order_id' => $order->id,
                    'supplier_id' => $order->supplier_id,
                    'warehouse_id' => $order->warehouse_id,
                    'document_number' => $this->generateDocumentNumber(),
                    'notes' => $notes,
                    'received_by' => $userId,
                    'received_at' => now(),
                ]);

                foreach ($items as $item) {
                    $poItem = $order->items()->findOrFail($item['purchase_order_item_id']);
                    $qtyReceived = (int) $item['qty_received'];
                    $conversionFactor = (float) ($poItem->conversion_factor ?: 1.0);
                    $baseQty = (int) round($qtyReceived * $conversionFactor);

                    GoodsReceivingItem::create([
                        'goods_receiving_id' => $receiving->id,
                        'purchase_order_item_id' => $poItem->id,
                        'product_id' => $poItem->product_id,
                        'unit_id' => $poItem->unit_id,
                        'conversion_factor' => $conversionFactor,
                        'qty_received' => $qtyReceived,
                        'notes' => $item['notes'] ?? null,
                    ]);

                    $poItem->increment('qty_received', $qtyReceived);

                    $product = $poItem->product;
                    $stockBefore = (int) $product->stock;
                    $product->increment('stock', $baseQty);
                    $stockAfter = (int) $product->stock;

                    // Increment warehouse pivot stock
                    if ($order->warehouse_id) {
                        $pivot = ProductWarehouse::firstOrCreate([
                            'product_id' => $product->id,
                            'warehouse_id' => $order->warehouse_id,
                        ], ['stock' => 0]);
                        $pivot->increment('stock', $baseQty);
                    }

                    // Create batch record
                    if (! empty($item['batch_number'])) {
                        ProductBatch::create([
                            'product_id' => $product->id,
                            'warehouse_id' => $order->warehouse_id ?? 1,
                            'batch_number' => $item['batch_number'],
                            'expired_at' => $item['expired_at'] ?? null,
                            'received_at' => now(),
                            'stock' => $baseQty,
                        ]);
                    }

                    $this->stockMutationService->recordPurchaseInbound(
                        product: $product,
                        goodsReceiving: $receiving,
                        qty: $baseQty,
                        stockBefore: $stockBefore,
                        stockAfter: $stockAfter,
                        notes: 'Penerimaan dari PO '.$order->document_number,
                        userId: $userId,
                    );
                }

                $this->updateOrderStatus($order);

                if ($receiving->supplier_id) {
                    $this->createOrUpdatePayable($order, $receiving, $userId);
                }

                $this->auditLogService->log(
                    event: 'goods_receiving.created',
                    module: 'purchase',
                    auditable: $receiving,
                    description: 'Barang diterima dari PO '.$order->document_number,
                    after: [
                        'document_number' => $receiving->document_number,
                        'purchase_order_id' => $order->id,
                        'total_items' => count($items),
                    ],
                    meta: ['goods_receiving_id' => $receiving->id],
                );

                return $receiving;
            });
        });
    }

    private function updateOrderStatus(PurchaseOrder $order): void
    {
        $allFullyReceived = $order->items()->whereColumn('qty_received', '<', 'qty_ordered')->doesntExist();

        $status = $allFullyReceived ? 'completed' : 'partial_received';
        $updates = ['status' => $status];

        if ($status === 'completed') {
            $updates['completed_at'] = now();
        }

        $order->update($updates);
    }

    private function createOrUpdatePayable(PurchaseOrder $order, GoodsReceiving $receiving, int $userId): void
    {
        $total = (float) $order->items()->sum(\DB::raw('qty_received * unit_price'));

        if ($total <= 0) {
            $total = (float) $order->items()->sum(\DB::raw('qty_ordered * unit_price'));
        }

        $existingPayable = Payable::where('purchase_order_id', $order->id)->first();
        $paid = $existingPayable ? (float) ($existingPayable->paid ?? 0) : 0.0;
        $dueDate = $existingPayable?->due_date ?? now()->addDays(30);

        $status = $paid >= $total && $total > 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');
        if ($status !== 'paid' && $dueDate && now()->gt($dueDate)) {
            $status = 'overdue';
        }

        $payable = Payable::updateOrCreate(
            ['purchase_order_id' => $order->id],
            [
                'supplier_id' => $order->supplier_id,
                'document_number' => $existingPayable?->document_number ?? $receiving->document_number,
                'total' => $total,
                'paid' => $paid,
                'due_date' => $dueDate,
                'status' => $status,
                'note' => $existingPayable?->note ?? ('Otomatis dari penerimaan PO '.$order->document_number),
            ]
        );

        if ($payable->wasRecentlyCreated) {
            $this->auditLogService->log(
                event: 'payable.created_from_receiving',
                module: 'payable',
                auditable: $payable,
                description: 'Hutang otomatis dari penerimaan PO '.$order->document_number,
                after: [
                    'payable_id' => $payable->id,
                    'supplier_id' => $payable->supplier_id,
                    'total' => $payable->total,
                    'document_number' => $payable->document_number,
                    'purchase_order_id' => $order->id,
                ],
                meta: ['goods_receiving_id' => $receiving->id],
            );
        }
    }
}
