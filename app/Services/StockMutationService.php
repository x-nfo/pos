<?php

namespace App\Services;

use App\Models\DineOrder;
use App\Models\GoodsReceiving;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\SalesReturn;
use App\Models\StockMutation;
use App\Models\StockOpname;
use App\Models\SupplierReturn;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class StockMutationService
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function recordInitialStock(Product $product, ?int $userId = null, ?int $warehouseId = null, ?int $qty = null): ?StockMutation
    {
        $initialStock = $qty !== null ? (int) $qty : (int) $product->stock;

        if ($initialStock <= 0) {
            return null;
        }

        $mutation = StockMutation::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouseId,
            'reference_type' => 'product_create',
            'reference_id' => $product->id,
            'mutation_type' => 'in',
            'qty' => $initialStock,
            'stock_before' => 0,
            'stock_after' => $initialStock,
            'notes' => 'Initial stock saat produk dibuat.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Initial stock produk dicatat.',
            before: [
                'product_id' => $product->id,
                'stock_before' => 0,
                'stock_after' => 0,
                'difference' => 0,
                'reason' => 'Initial stock saat produk dibuat.',
                'reference' => 'product:'.$product->id,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => 0,
                'stock_after' => $initialStock,
                'difference' => $initialStock,
                'reason' => 'Initial stock saat produk dibuat.',
                'reference' => 'product:'.$product->id,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'reference_type' => $mutation->reference_type,
                'reference_id' => $mutation->reference_id,
                'mutation_type' => $mutation->mutation_type,
                'qty' => (int) $mutation->qty,
            ],
        );

        return $mutation;
    }

    public function recordStockOpnameAdjustment(
        Product $product,
        StockOpname $stockOpname,
        int $stockBefore,
        int $stockAfter,
        ?string $reason,
        ?int $userId = null
    ): ?StockMutation {
        if ($stockBefore === $stockAfter) {
            return null;
        }

        $mutation = StockMutation::create([
            'product_id' => $product->id,
            'warehouse_id' => $stockOpname->warehouse_id,
            'reference_type' => 'stock_opname',
            'reference_id' => $stockOpname->id,
            'mutation_type' => 'adjustment',
            'qty' => abs($stockAfter - $stockBefore),
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $reason ?: 'Adjustment dari stock opname.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok produk disesuaikan melalui stock opname.',
            before: [
                'product_id' => $product->id,
                'warehouse_id' => $stockOpname->warehouse_id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reason' => $reason,
                'reference' => $stockOpname->code,
            ],
            after: [
                'product_id' => $product->id,
                'warehouse_id' => $stockOpname->warehouse_id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reason' => $reason ?: 'Adjustment dari stock opname.',
                'reference' => $stockOpname->code,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'stock_opname_id' => $stockOpname->id,
                'stock_opname_code' => $stockOpname->code,
                'warehouse_id' => $stockOpname->warehouse_id,
                'mutation_type' => $mutation->mutation_type,
                'qty' => (int) $mutation->qty,
            ],
        );

        return $mutation;
    }

    public function recordSalesReturnRestock(
        Product $product,
        SalesReturn $salesReturn,
        int $stockBefore,
        int $stockAfter,
        ?string $reason,
        ?int $userId = null
    ): ?StockMutation {
        if ($stockBefore === $stockAfter) {
            return null;
        }

        $mutation = StockMutation::create([
            'product_id' => $product->id,
            'reference_type' => 'sales_return',
            'reference_id' => $salesReturn->id,
            'mutation_type' => 'in',
            'qty' => abs($stockAfter - $stockBefore),
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $reason ?: 'Restock dari retur penjualan.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok produk bertambah dari restock retur penjualan.',
            before: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reason' => $reason,
                'reference' => $salesReturn->code,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reason' => $reason ?: 'Restock dari retur penjualan.',
                'reference' => $salesReturn->code,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'sales_return_id' => $salesReturn->id,
                'sales_return_code' => $salesReturn->code,
                'mutation_type' => $mutation->mutation_type,
                'qty' => (int) $mutation->qty,
            ],
        );

        return $mutation;
    }

    public function recordSalesReturnExchangeOut(
        Product $product,
        SalesReturn $salesReturn,
        int $qty,
        int $stockBefore,
        int $stockAfter,
        ?int $warehouseId = null,
        ?string $notes = null,
        ?int $userId = null
    ): StockMutation {
        $mutation = StockMutation::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouseId,
            'reference_type' => 'sales_return_exchange',
            'reference_id' => $salesReturn->id,
            'mutation_type' => 'out',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes ?: 'Barang pengganti retur penjualan '.$salesReturn->code,
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok keluar sebagai barang pengganti retur '.$salesReturn->code,
            before: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reference' => $salesReturn->code,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reference' => $salesReturn->code,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'sales_return_id' => $salesReturn->id,
                'sales_return_code' => $salesReturn->code,
                'mutation_type' => $mutation->mutation_type,
                'qty' => $qty,
            ],
        );

        return $mutation;
    }

    public function recordPurchaseInbound(
        Product $product,
        GoodsReceiving $goodsReceiving,
        int $qty,
        int $stockBefore,
        int $stockAfter,
        ?string $notes = null,
        ?int $userId = null
    ): StockMutation {
        $mutation = StockMutation::create([
            'product_id' => $product->id,
            'reference_type' => 'goods_receiving',
            'reference_id' => $goodsReceiving->id,
            'mutation_type' => 'in',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes ?: 'Stok masuk dari penerimaan barang.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok masuk dari penerimaan barang '.$goodsReceiving->document_number,
            before: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reference' => $goodsReceiving->document_number,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reference' => $goodsReceiving->document_number,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'goods_receiving_id' => $goodsReceiving->id,
                'document_number' => $goodsReceiving->document_number,
                'mutation_type' => $mutation->mutation_type,
                'qty' => $qty,
            ],
        );

        return $mutation;
    }

    public function recordSupplierReturnOut(
        Product $product,
        SupplierReturn $supplierReturn,
        int $qty,
        int $stockBefore,
        int $stockAfter,
        ?string $notes = null,
        ?int $userId = null
    ): StockMutation {
        $mutation = StockMutation::create([
            'product_id' => $product->id,
            'reference_type' => 'supplier_return',
            'reference_id' => $supplierReturn->id,
            'mutation_type' => 'out',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes ?: 'Retur barang ke supplier.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok keluar dari retur supplier '.$supplierReturn->document_number,
            before: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reference' => $supplierReturn->document_number,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reference' => $supplierReturn->document_number,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'supplier_return_id' => $supplierReturn->id,
                'document_number' => $supplierReturn->document_number,
                'mutation_type' => $mutation->mutation_type,
                'qty' => $qty,
            ],
        );

        return $mutation;
    }

    public function recordSaleOut(
        Product $product,
        Transaction $transaction,
        int $qty,
        int $stockBefore,
        int $stockAfter,
        ?int $warehouseId = null,
        ?string $notes = null,
        ?int $userId = null
    ): StockMutation {
        return StockMutation::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouseId,
            'reference_type' => 'transaction',
            'reference_id' => $transaction->id,
            'mutation_type' => 'out',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes ?: 'Penjualan kasir transaksi '.$transaction->invoice,
            'created_by' => $userId,
        ]);
    }

    public function recordDineOrderOut(
        Product $product,
        DineOrder $order,
        int $qty,
        int $stockBefore,
        int $stockAfter,
        ?int $warehouseId = null,
        ?string $notes = null,
        ?int $userId = null
    ): StockMutation {
        return StockMutation::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouseId,
            'reference_type' => 'dine_order',
            'reference_id' => $order->id,
            'mutation_type' => 'out',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes ?: 'Stok keluar dari pesanan meja #'.$order->table_id,
            'created_by' => $userId,
        ]);
    }

    public function recordTransactionRestock(
        Product $product,
        Transaction $transaction,
        int $qty,
        int $stockBefore,
        int $stockAfter,
        ?int $warehouseId = null,
        ?string $notes = null,
        ?int $userId = null
    ): StockMutation {
        $mutation = StockMutation::create([
            'product_id' => $product->id,
            'warehouse_id' => $warehouseId,
            'reference_type' => 'transaction_restock',
            'reference_id' => $transaction->id,
            'mutation_type' => 'in',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes ?: 'Restock otomatis dari transaksi batal/expired '.$transaction->invoice,
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok masuk (restock) dari transaksi batal/expired '.$transaction->invoice,
            before: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reference' => $transaction->invoice,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reference' => $transaction->invoice,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'transaction_id' => $transaction->id,
                'invoice' => $transaction->invoice,
                'mutation_type' => $mutation->mutation_type,
                'qty' => $qty,
            ],
        );

        return $mutation;
    }

    /**
     * Kembalikan stok gudang jika transaksi QRIS / Payment Gateway berakhir expired / cancelled.
     */
    public function restockTransaction(Transaction $transaction, ?string $reason = 'expired', ?int $userId = null): bool
    {
        return DB::transaction(function () use ($transaction, $reason, $userId) {
            $lockedTransaction = Transaction::where('id', $transaction->id)->lockForUpdate()->first();

            if (! $lockedTransaction) {
                return false;
            }

            // Check idempotency: jangan restock jika sudah pernah direstock
            $alreadyRestocked = StockMutation::where('reference_type', 'transaction_restock')
                ->where('reference_id', $lockedTransaction->id)
                ->exists();

            if ($alreadyRestocked) {
                return false;
            }

            $warehouseId = $lockedTransaction->warehouse_id;
            $lockedTransaction->loadMissing(['details.product.components']);

            foreach ($lockedTransaction->details as $detail) {
                $product = $detail->product;
                if (! $product) {
                    continue;
                }

                if ($product->is_composite) {
                    $product->loadMissing('components');
                    foreach ($product->components as $component) {
                        $componentModel = Product::where('id', $component->id)->lockForUpdate()->first();
                        if (! $componentModel) {
                            continue;
                        }

                        $componentQty = (int) round((float) $component->pivot->qty * $detail->qty);
                        $stockBefore = (int) $componentModel->stock;
                        $stockAfter = $stockBefore + $componentQty;

                        $componentModel->increment('stock', $componentQty);

                        if ($warehouseId) {
                            ProductWarehouse::firstOrCreate(
                                ['product_id' => $componentModel->id, 'warehouse_id' => $warehouseId],
                                ['stock' => 0]
                            )->increment('stock', $componentQty);
                        }

                        $this->recordTransactionRestock(
                            product: $componentModel,
                            transaction: $lockedTransaction,
                            qty: $componentQty,
                            stockBefore: $stockBefore,
                            stockAfter: $stockAfter,
                            warehouseId: $warehouseId,
                            notes: "Restock otomatis ({$reason}) untuk komponen {$componentModel->title} pada transaksi {$lockedTransaction->invoice}",
                            userId: $userId
                        );
                    }
                } else {
                    $productModel = Product::where('id', $product->id)->lockForUpdate()->first();
                    if (! $productModel) {
                        continue;
                    }

                    $baseQty = (int) round($detail->qty * (float) ($detail->conversion_factor ?? 1));
                    $stockBefore = (int) $productModel->stock;
                    $stockAfter = $stockBefore + $baseQty;

                    $productModel->increment('stock', $baseQty);

                    if ($warehouseId) {
                        ProductWarehouse::firstOrCreate(
                            ['product_id' => $productModel->id, 'warehouse_id' => $warehouseId],
                            ['stock' => 0]
                        )->increment('stock', $baseQty);
                    }

                    $this->recordTransactionRestock(
                        product: $productModel,
                        transaction: $lockedTransaction,
                        qty: $baseQty,
                        stockBefore: $stockBefore,
                        stockAfter: $stockAfter,
                        warehouseId: $warehouseId,
                        notes: "Restock otomatis ({$reason}) transaksi {$lockedTransaction->invoice}",
                        userId: $userId
                    );
                }
            }

            $this->auditLogService->log(
                event: 'transaction.auto_restocked',
                module: 'transactions',
                auditable: $lockedTransaction,
                description: "Stok gudang dikembalikan otomatis karena transaksi {$lockedTransaction->invoice} berakhir {$reason}.",
                before: [
                    'invoice' => $lockedTransaction->invoice,
                    'payment_status' => $lockedTransaction->payment_status,
                ],
                after: [
                    'invoice' => $lockedTransaction->invoice,
                    'payment_status' => $lockedTransaction->payment_status,
                    'restocked' => true,
                    'reason' => $reason,
                ],
                meta: [
                    'transaction_id' => $lockedTransaction->id,
                    'invoice' => $lockedTransaction->invoice,
                    'warehouse_id' => $warehouseId,
                    'reason' => $reason,
                ]
            );

            return true;
        });
    }
}
