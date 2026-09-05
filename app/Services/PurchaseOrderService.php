<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;

class PurchaseOrderService
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly DocumentNumberService $documentNumberService
    ) {}

    public function generateDocumentNumber(Warehouse|int|string|null $warehouse = null): string
    {
        $branchCode = $this->documentNumberService->formatBranchCode($warehouse);
        $prefix = 'PO-'.$branchCode.'-'.now()->format('Ymd').'-';

        return $this->documentNumberService->generateSequentialNumber(
            modelClass: PurchaseOrder::class,
            column: 'document_number',
            prefix: $prefix
        );
    }

    public function createOrder(array $data, array $items, int $userId): PurchaseOrder
    {
        return $this->documentNumberService->executeWithRetry(function () use ($data, $items, $userId) {
            return DB::transaction(function () use ($data, $items, $userId) {
                $order = PurchaseOrder::create([
                    'supplier_id' => $data['supplier_id'] ?? null,
                    'warehouse_id' => $data['warehouse_id'] ?? null,
                    'document_number' => $data['document_number'] ?? $this->generateDocumentNumber($data['warehouse_id'] ?? null),
                    'status' => 'draft',
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $userId,
                ]);

                foreach ($items as $item) {
                    PurchaseOrderItem::create([
                        'purchase_order_id' => $order->id,
                        'product_id' => $item['product_id'],
                        'unit_id' => $item['unit_id'] ?? null,
                        'conversion_factor' => $item['conversion_factor'] ?? 1.0,
                        'qty_ordered' => $item['qty_ordered'],
                        'qty_received' => 0,
                        'unit_price' => $item['unit_price'],
                    ]);
                }

                $this->auditLogService->log(
                    event: 'purchase_order.created',
                    module: 'purchase',
                    auditable: $order,
                    description: 'Purchase order '.$order->document_number.' dibuat.',
                    after: [
                        'document_number' => $order->document_number,
                        'supplier_id' => $order->supplier_id,
                        'status' => 'draft',
                        'total_items' => count($items),
                    ],
                    meta: ['purchase_order_id' => $order->id],
                );

                return $order;
            });
        });
    }

    public function placeOrder(PurchaseOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $before = $order->replicate();

            $order->update([
                'status' => 'ordered',
                'ordered_at' => now(),
            ]);

            $this->auditLogService->log(
                event: 'purchase_order.ordered',
                module: 'purchase',
                auditable: $order,
                description: 'Purchase order '.$order->document_number.' dipesan ke supplier.',
                before: ['status' => $before->status],
                after: ['status' => 'ordered'],
                meta: ['purchase_order_id' => $order->id],
            );
        });
    }

    public function cancelOrder(PurchaseOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $before = $order->replicate();

            $order->update([
                'status' => 'cancelled',
            ]);

            $this->auditLogService->log(
                event: 'purchase_order.cancelled',
                module: 'purchase',
                auditable: $order,
                description: 'Purchase order '.$order->document_number.' dibatalkan.',
                before: ['status' => $before->status],
                after: ['status' => 'cancelled'],
                meta: ['purchase_order_id' => $order->id],
            );
        });
    }

    public function updateOrder(PurchaseOrder $order, array $data, array $items, int $userId): PurchaseOrder
    {
        if ($order->status !== 'draft') {
            throw new \DomainException('Hanya PO dengan status draft yang dapat diperbarui.');
        }

        return DB::transaction(function () use ($order, $data, $items) {
            $before = $order->replicate();
            $beforeItemsCount = $order->items()->count();

            $order->update([
                'supplier_id' => $data['supplier_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'] ?? null,
                'document_number' => $data['document_number'] ?? $order->document_number,
                'notes' => $data['notes'] ?? null,
            ]);

            $order->items()->delete();

            foreach ($items as $item) {
                PurchaseOrderItem::create([
                    'purchase_order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'unit_id' => $item['unit_id'] ?? null,
                    'conversion_factor' => $item['conversion_factor'] ?? 1.0,
                    'qty_ordered' => $item['qty_ordered'],
                    'qty_received' => 0,
                    'unit_price' => $item['unit_price'],
                ]);
            }

            $this->auditLogService->log(
                event: 'purchase_order.updated',
                module: 'purchase',
                auditable: $order,
                description: 'Purchase order '.$order->document_number.' diperbarui.',
                before: [
                    'supplier_id' => $before->supplier_id,
                    'warehouse_id' => $before->warehouse_id,
                    'notes' => $before->notes,
                    'total_items' => $beforeItemsCount,
                ],
                after: [
                    'supplier_id' => $order->supplier_id,
                    'warehouse_id' => $order->warehouse_id,
                    'notes' => $order->notes,
                    'total_items' => count($items),
                ],
                meta: ['purchase_order_id' => $order->id],
            );

            return $order;
        });
    }
}
