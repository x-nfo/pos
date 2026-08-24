<?php

namespace App\Services;

use App\Models\CashierShift;
use App\Models\DineOrder;
use App\Models\ProductWarehouse;

class DineOrderService
{
    public function __construct(
        private PricingService $pricingService,
        private StockMutationService $stockMutationService,
    ) {}

    public function accept(DineOrder $order): void
    {
        $order->update(['status' => DineOrder::STATUS_ACCEPTED]);

        $cashierId = $order->cashier_id ?? auth()->id();
        $shift = CashierShift::where('user_id', $cashierId)->open()->first();

        if (! $shift) {
            return;
        }

        $warehouseId = $shift->warehouse_id;

        foreach ($order->items as $item) {
            $product = $item->product;

            if ($product->is_composite) {
                foreach ($product->components as $component) {
                    $componentProduct = $component->componentProduct;
                    $qtyOut = (int) ($item->qty * $component->qty);
                    $stockBefore = (int) $componentProduct->stock;
                    $stockAfter = $stockBefore - $qtyOut;

                    $componentProduct->decrement('stock', $qtyOut);
                    ProductWarehouse::where('product_id', $componentProduct->id)
                        ->where('warehouse_id', $warehouseId)
                        ->decrement('stock', $qtyOut);

                    $this->stockMutationService->recordDineOrderOut(
                        product: $componentProduct,
                        order: $order,
                        qty: $qtyOut,
                        stockBefore: $stockBefore,
                        stockAfter: $stockAfter,
                        warehouseId: $warehouseId,
                        notes: 'Komponen '.$componentProduct->title.' pesanan dine-in order #'.$order->id,
                        userId: $cashierId
                    );
                }
            } else {
                $qtyOut = (int) $item->qty;
                $stockBefore = (int) $product->stock;
                $stockAfter = $stockBefore - $qtyOut;

                $product->decrement('stock', $qtyOut);
                ProductWarehouse::where('product_id', $product->id)
                    ->where('warehouse_id', $warehouseId)
                    ->decrement('stock', $qtyOut);

                $this->stockMutationService->recordDineOrderOut(
                    product: $product,
                    order: $order,
                    qty: $qtyOut,
                    stockBefore: $stockBefore,
                    stockAfter: $stockAfter,
                    warehouseId: $warehouseId,
                    notes: 'Pesanan dine-in order #'.$order->id,
                    userId: $cashierId
                );
            }
        }
    }

    public function reject(DineOrder $order, ?string $reason = null): void
    {
        $order->update([
            'status' => DineOrder::STATUS_REJECTED,
            'notes' => $order->notes
                ? "{$order->notes}\n[Penolakan: {$reason}]"
                : "[Penolakan: {$reason}]",
        ]);
    }
}
