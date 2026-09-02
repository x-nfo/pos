<?php

namespace App\Services;

use App\Models\ProductWarehouse;
use App\Models\StockMutation;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockTransferService
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly DocumentNumberService $documentNumberService
    ) {}

    public function generateDocumentNumber(): string
    {
        return $this->documentNumberService->generateSequentialNumber(
            modelClass: StockTransfer::class,
            column: 'document_number',
            prefix: 'ST-'.now()->format('Ymd').'-'
        );
    }

    public function createDraft(array $data, array $items, int $userId): StockTransfer
    {
        if ($data['source_warehouse_id'] === $data['destination_warehouse_id']) {
            throw ValidationException::withMessages([
                'destination_warehouse_id' => 'Gudang asal dan tujuan harus berbeda.',
            ]);
        }

        return $this->documentNumberService->executeWithRetry(function () use ($data, $items, $userId) {
            return DB::transaction(function () use ($data, $items, $userId) {
                $transfer = StockTransfer::create([
                    'source_warehouse_id' => $data['source_warehouse_id'],
                    'destination_warehouse_id' => $data['destination_warehouse_id'],
                    'document_number' => $data['document_number'] ?? $this->generateDocumentNumber(),
                    'status' => 'draft',
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $userId,
                ]);

                foreach ($items as $item) {
                    StockTransferItem::create([
                        'stock_transfer_id' => $transfer->id,
                        'product_id' => $item['product_id'],
                        'qty' => $item['qty'],
                    ]);
                }

                $this->auditLogService->log(
                    event: 'stock_transfer.created',
                    module: 'stock',
                    auditable: $transfer,
                    description: 'Transfer stok '.$transfer->document_number.' dibuat.',
                    after: [
                        'document_number' => $transfer->document_number,
                        'source_warehouse_id' => $transfer->source_warehouse_id,
                        'destination_warehouse_id' => $transfer->destination_warehouse_id,
                        'status' => 'draft',
                        'total_items' => count($items),
                    ],
                    meta: ['stock_transfer_id' => $transfer->id],
                );

                return $transfer;
            });
        });
    }

    public function send(StockTransfer $transfer, int $userId): void
    {
        if (! $transfer->isDraft()) {
            throw ValidationException::withMessages([
                'transfer' => 'Hanya transfer dengan status draft yang bisa dikirim.',
            ]);
        }

        DB::transaction(function () use ($transfer, $userId) {
            $transfer->load('items.product');
            $before = $transfer->replicate();

            // Validate stock availability
            foreach ($transfer->items as $item) {
                $wh = ProductWarehouse::where([
                    'product_id' => $item->product_id,
                    'warehouse_id' => $transfer->source_warehouse_id,
                ])->first();

                $available = $wh ? (int) $wh->stock : 0;
                if ($available < $item->qty) {
                    throw ValidationException::withMessages([
                        'transfer' => "Stok {$item->product->title} tidak mencukupi di gudang asal (tersedia: {$available}).",
                    ]);
                }
            }

            // Decrement source warehouse stock
            foreach ($transfer->items as $item) {
                $product = $item->product;
                $pw = ProductWarehouse::where([
                    'product_id' => $item->product_id,
                    'warehouse_id' => $transfer->source_warehouse_id,
                ])->first();
                $stockBefore = $pw ? (int) $pw->stock : 0;
                $stockAfter = max(0, $stockBefore - $item->qty);

                ProductWarehouse::where([
                    'product_id' => $item->product_id,
                    'warehouse_id' => $transfer->source_warehouse_id,
                ])->decrement('stock', $item->qty);

                $product->decrement('stock', $item->qty);

                StockMutation::create([
                    'product_id' => $product->id,
                    'warehouse_id' => $transfer->source_warehouse_id,
                    'reference_type' => 'stock_transfer',
                    'reference_id' => $transfer->id,
                    'mutation_type' => 'out',
                    'qty' => $item->qty,
                    'stock_before' => $stockBefore,
                    'stock_after' => max(0, $stockBefore - $item->qty),
                    'notes' => 'Transfer ke '.$transfer->destinationWarehouse->code,
                    'created_by' => $userId,
                ]);
            }

            $transfer->update([
                'status' => 'in_transit',
            ]);

            $this->auditLogService->log(
                event: 'stock_transfer.sent',
                module: 'stock',
                auditable: $transfer,
                description: 'Transfer stok '.$transfer->document_number.' dikirim.',
                before: ['status' => $before->status],
                after: ['status' => 'in_transit'],
                meta: ['stock_transfer_id' => $transfer->id],
            );
        });
    }

    public function receive(StockTransfer $transfer, int $userId, array $receivedData = []): void
    {
        if (! $transfer->isInTransit()) {
            throw ValidationException::withMessages([
                'transfer' => 'Hanya transfer dengan status in_transit yang bisa diterima.',
            ]);
        }

        DB::transaction(function () use ($transfer, $userId, $receivedData) {
            $transfer->load('items.product');
            $before = $transfer->replicate();

            $receivedMap = [];
            foreach ($receivedData as $entry) {
                if (isset($entry['id'])) {
                    $receivedMap[(int) $entry['id']] = $entry;
                }
            }

            foreach ($transfer->items as $item) {
                $product = $item->product;

                // Determine received_qty (default to sent qty if not provided)
                $entry = $receivedMap[$item->id] ?? null;
                $receivedQty = isset($entry['received_qty']) ? max(0, (int) $entry['received_qty']) : $item->qty;
                $itemNotes = isset($entry['notes']) ? trim((string) $entry['notes']) : null;

                if ($receivedQty > $item->qty) {
                    throw ValidationException::withMessages([
                        'transfer' => "Jumlah diterima untuk {$product->title} tidak boleh melebihi jumlah kirim ({$item->qty}).",
                    ]);
                }

                $item->update([
                    'received_qty' => $receivedQty,
                    'notes' => $itemNotes,
                ]);

                // Increment destination warehouse stock & legacy stock by receivedQty
                if ($receivedQty > 0) {
                    $pwDest = ProductWarehouse::firstOrCreate(
                        ['product_id' => $item->product_id, 'warehouse_id' => $transfer->destination_warehouse_id],
                        ['stock' => 0]
                    );
                    $destStockBefore = (int) $pwDest->stock;
                    $destStockAfter = $destStockBefore + $receivedQty;

                    $pwDest->increment('stock', $receivedQty);
                    $product->increment('stock', $receivedQty);

                    $diff = $item->qty - $receivedQty;
                    $mutationNotes = 'Transfer dari '.$transfer->sourceWarehouse->code;
                    if ($diff > 0) {
                        $mutationNotes .= " (Diterima {$receivedQty}/{$item->qty}, Selisih: {$diff}".($itemNotes ? " - {$itemNotes}" : '').')';
                    }

                    StockMutation::create([
                        'product_id' => $product->id,
                        'warehouse_id' => $transfer->destination_warehouse_id,
                        'reference_type' => 'stock_transfer',
                        'reference_id' => $transfer->id,
                        'mutation_type' => 'in',
                        'qty' => $receivedQty,
                        'stock_before' => $destStockBefore,
                        'stock_after' => $destStockAfter,
                        'notes' => $mutationNotes,
                        'created_by' => $userId,
                    ]);
                }
            }

            $transfer->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            $this->auditLogService->log(
                event: 'stock_transfer.received',
                module: 'stock',
                auditable: $transfer,
                description: 'Transfer stok '.$transfer->document_number.' diterima.',
                before: ['status' => $before->status],
                after: ['status' => 'completed'],
                meta: ['stock_transfer_id' => $transfer->id],
            );
        });
    }

    public function cancel(StockTransfer $transfer, int $userId): void
    {
        if (! in_array($transfer->status, ['draft', 'in_transit'])) {
            throw ValidationException::withMessages([
                'transfer' => 'Hanya transfer draft atau in_transit yang bisa dibatalkan.',
            ]);
        }

        DB::transaction(function () use ($transfer, $userId) {
            $before = $transfer->replicate();
            $returnStock = $transfer->isInTransit();

            // If sent but not received, return stock to source and record mutation
            if ($returnStock) {
                $transfer->load('items.product');

                foreach ($transfer->items as $item) {
                    $pw = ProductWarehouse::firstOrCreate(
                        ['product_id' => $item->product_id, 'warehouse_id' => $transfer->source_warehouse_id],
                        ['stock' => 0]
                    );
                    $stockBefore = (int) $pw->stock;
                    $stockAfter = $stockBefore + $item->qty;

                    $pw->increment('stock', $item->qty);

                    $product = $item->product;
                    $product->increment('stock', $item->qty);

                    StockMutation::create([
                        'product_id' => $product->id,
                        'warehouse_id' => $transfer->source_warehouse_id,
                        'reference_type' => 'stock_transfer',
                        'reference_id' => $transfer->id,
                        'mutation_type' => 'in',
                        'qty' => $item->qty,
                        'stock_before' => $stockBefore,
                        'stock_after' => $stockAfter,
                        'notes' => 'Pembatalan transfer '.$transfer->document_number,
                        'created_by' => $userId,
                    ]);
                }
            }

            $transfer->update(['status' => 'cancelled']);

            $this->auditLogService->log(
                event: 'stock_transfer.cancelled',
                module: 'stock',
                auditable: $transfer,
                description: 'Transfer stok '.$transfer->document_number.' dibatalkan.'.($returnStock ? ' Stok dikembalikan ke gudang asal.' : ''),
                before: ['status' => $before->status],
                after: ['status' => 'cancelled'],
                meta: ['stock_transfer_id' => $transfer->id],
            );
        });
    }
}
