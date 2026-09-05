<?php

namespace App\Services;

use App\Models\Payable;
use App\Models\Supplier;
use Illuminate\Support\Collection;

class PayableAgingService
{
    public function getAgingSummary(?int $warehouseId = null): Collection
    {
        $query = Payable::where('status', '!=', 'paid');

        if ($warehouseId) {
            $query->where(function ($q) use ($warehouseId) {
                $q->where('warehouse_id', $warehouseId)
                    ->orWhereHas('purchaseOrder', fn ($po) => $po->where('warehouse_id', $warehouseId));
            });
        }

        $payables = $query->get();

        $buckets = ['current', '0-30', '31-60', '61-90', '90+'];

        return collect($buckets)->map(function ($bucket) use ($payables) {
            $filtered = $payables->filter(fn ($p) => $p->aging_bucket === $bucket);

            return [
                'bucket' => $bucket,
                'count' => $filtered->count(),
                'total' => (float) $filtered->sum('total'),
                'paid' => (float) $filtered->sum('paid'),
                'remaining' => (float) $filtered->sum(fn ($p) => max(0, $p->total - $p->paid)),
            ];
        });
    }

    public function getTopSuppliersByPayable(int $limit = 10, ?int $warehouseId = null): Collection
    {
        $payableCondition = function ($q) use ($warehouseId) {
            $q->where('status', '!=', 'paid');
            if ($warehouseId) {
                $q->where(function ($sub) use ($warehouseId) {
                    $sub->where('warehouse_id', $warehouseId)
                        ->orWhereHas('purchaseOrder', fn ($po) => $po->where('warehouse_id', $warehouseId));
                });
            }
        };

        $payableAllCondition = function ($q) use ($warehouseId) {
            if ($warehouseId) {
                $q->where(function ($sub) use ($warehouseId) {
                    $sub->where('warehouse_id', $warehouseId)
                        ->orWhereHas('purchaseOrder', fn ($po) => $po->where('warehouse_id', $warehouseId));
                });
            }
        };

        return Supplier::withSum([
            'payables as total_payable' => $payableCondition,
        ], 'total')
            ->withSum([
                'payables as total_paid' => $payableAllCondition,
            ], 'paid')
            ->orderByRaw('COALESCE(total_payable, 0) DESC')
            ->limit($limit)
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'total_payable' => $s->total_payable ?? 0,
                'total_paid' => $s->total_paid ?? 0,
                'remaining' => max(0, ($s->total_payable ?? 0) - ($s->total_paid ?? 0)),
            ])
            ->filter(fn ($s) => $s['remaining'] > 0)
            ->values();
    }

    public function getDueSoonPayables(int $days = 7, ?int $warehouseId = null): Collection
    {
        $query = Payable::where('status', '!=', 'paid')
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [now()->format('Y-m-d'), now()->addDays($days)->format('Y-m-d')])
            ->with(['supplier:id,name', 'warehouse:id,code,name', 'purchaseOrder.warehouse:id,code,name'])
            ->orderBy('due_date');

        if ($warehouseId) {
            $query->where(function ($q) use ($warehouseId) {
                $q->where('warehouse_id', $warehouseId)
                    ->orWhereHas('purchaseOrder', fn ($po) => $po->where('warehouse_id', $warehouseId));
            });
        }

        return $query->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'document_number' => $p->document_number,
                'supplier_name' => $p->supplier?->name,
                'warehouse_name' => $p->warehouse?->name ?? $p->purchaseOrder?->warehouse?->name,
                'due_date' => $p->due_date?->toDateString(),
                'remaining' => max(0, $p->total - $p->paid),
                'aging_bucket' => $p->aging_bucket,
            ]);
    }
}
