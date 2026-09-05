<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSalesReturnRequest;
use App\Http\Requests\UpdateSalesReturnRequest;
use App\Models\CustomerCredit;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Profit;
use App\Models\SalesReturn;
use App\Models\SalesReturnExchangeItem;
use App\Models\SalesReturnItem;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\Unit;
use App\Services\AuditLogService;
use App\Services\CashierShiftService;
use App\Services\StockMutationService;
use App\Services\ThermalPrintService;
use App\Services\UnitConversionService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SalesReturnController extends Controller
{
    public function __construct(
        private readonly StockMutationService $stockMutationService,
        private readonly CashierShiftService $cashierShiftService,
        private readonly AuditLogService $auditLogService,
        private readonly ThermalPrintService $thermalPrintService,
        private readonly UnitConversionService $unitConversionService
    ) {}

    public function index(Request $request): Response
    {
        $this->ensureSalesReturnTablesExist();

        $filters = [
            'code' => $request->input('code'),
            'invoice' => $request->input('invoice'),
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'return_type' => $request->input('return_type'),
        ];

        $user = $request->user();
        $salesReturns = SalesReturn::query()
            ->with(['transaction:id,invoice,payment_method,payment_status,warehouse_id', 'customer:id,name', 'cashier:id,name'])
            ->when($user && ! $user->isHQ(), function (Builder $query) use ($user) {
                $query->where(function (Builder $sub) use ($user) {
                    $sub->where('warehouse_id', $user->warehouse_id)
                        ->orWhere('cashier_id', $user->id)
                        ->orWhereHas('transaction', fn (Builder $b) => $b->where('warehouse_id', $user->warehouse_id));
                });
            })
            ->when($filters['code'], fn (Builder $query, $code) => $query->where('code', 'like', '%'.$code.'%'))
            ->when($filters['invoice'], function (Builder $query, $invoice) {
                $query->whereHas('transaction', fn (Builder $builder) => $builder->where('invoice', 'like', '%'.$invoice.'%'));
            })
            ->when($filters['date_from'], fn (Builder $query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'], fn (Builder $query, $date) => $query->whereDate('created_at', '<=', $date))
            ->when($filters['return_type'], fn (Builder $query, $returnType) => $query->where('return_type', $returnType))
            ->withCount(['items', 'exchangeItems'])
            ->latest()
            ->paginate($this->perPage())->withQueryString();

        return Inertia::render('Dashboard/SalesReturns/Index', [
            'salesReturns' => $salesReturns,
            'filters' => $filters,
        ]);
    }

    public function create(Request $request, Transaction $transaction): Response|RedirectResponse
    {
        $this->ensureSalesReturnTablesExist();

        $transaction = $this->resolveAccessibleTransaction($request, $transaction->id);

        if (! $this->transactionHasReturnableItems($transaction)) {
            return to_route('transactions.history')->with('error', 'Seluruh item transaksi ini sudah habis diretur.');
        }

        return Inertia::render('Dashboard/SalesReturns/Create', [
            'transaction' => $this->transformTransactionForEditor($transaction),
            'availableProducts' => $this->getAvailableProducts($transaction->warehouse_id),
        ]);
    }

    public function store(StoreSalesReturnRequest $request, Transaction $transaction): RedirectResponse
    {
        $this->ensureSalesReturnTablesExist();

        $transaction = $this->resolveAccessibleTransaction($request, $transaction->id);
        $payload = $this->prepareDraftPayload($transaction, $request->validated());

        $salesReturn = DB::transaction(function () use ($request, $transaction, $payload) {
            $salesReturn = SalesReturn::create([
                'code' => $this->generateCode(),
                'warehouse_id' => $request->user()?->warehouse_id ?? $transaction->warehouse_id,
                'transaction_id' => $transaction->id,
                'customer_id' => $transaction->customer_id,
                'cashier_id' => $request->user()?->id,
                'status' => 'draft',
                'return_type' => $payload['return_type'],
                'refund_amount' => $payload['refund_amount'],
                'credited_amount' => $payload['credited_amount'],
                'total_return_amount' => $payload['total_return_amount'],
                'exchange_amount' => $payload['exchange_amount'] ?? 0,
                'difference_amount' => $payload['difference_amount'] ?? 0,
                'exchange_payment_method' => $payload['exchange_payment_method'] ?? null,
                'exchange_cash' => $payload['exchange_cash'] ?? 0,
                'exchange_change' => $payload['exchange_change'] ?? 0,
                'notes' => $payload['notes'],
            ]);

            $salesReturn->items()->createMany($payload['items']);

            if ($payload['return_type'] === 'product_exchange' && ! empty($payload['exchange_items'])) {
                $salesReturn->exchangeItems()->createMany($payload['exchange_items']);
            }

            return $salesReturn;
        });

        $salesReturn->load(['items.product', 'exchangeItems.product']);
        $this->auditLogService->log(
            event: 'sales_return.created',
            module: 'sales_returns',
            auditable: $salesReturn,
            description: 'Draft retur penjualan dibuat.',
            after: $this->salesReturnAuditPayload($salesReturn),
        );

        if ($request->input('action') === 'complete') {
            abort_unless($request->user()->can('sales-returns-complete'), 403);
            $this->executeCompletion($request, $salesReturn);

            return to_route('sales-returns.show', $salesReturn)->with('success', 'Retur penjualan berhasil diselesaikan.');
        }

        return to_route('sales-returns.show', $salesReturn)->with('success', 'Draft retur penjualan berhasil dibuat.');
    }

    public function show(Request $request, SalesReturn $salesReturn): Response
    {
        $this->ensureSalesReturnTablesExist();

        $salesReturn = $this->resolveAccessibleSalesReturn($request, $salesReturn->id);
        $warehouseId = $salesReturn->warehouse_id ?: $salesReturn->transaction?->warehouse_id;

        return Inertia::render('Dashboard/SalesReturns/Show', [
            'salesReturn' => $this->transformSalesReturn($salesReturn),
            'transaction' => $this->transformTransactionForEditor($salesReturn->transaction, $salesReturn),
            'availableProducts' => $this->getAvailableProducts($warehouseId),
        ]);
    }

    public function update(UpdateSalesReturnRequest $request, SalesReturn $salesReturn): RedirectResponse
    {
        $this->ensureSalesReturnTablesExist();

        $salesReturn = $this->resolveAccessibleSalesReturn($request, $salesReturn->id);
        $this->ensureDraft($salesReturn);
        $before = $this->salesReturnAuditPayload($salesReturn);

        $payload = $this->prepareDraftPayload($salesReturn->transaction, $request->validated(), $salesReturn->id);

        DB::transaction(function () use ($salesReturn, $payload) {
            $salesReturn->update([
                'return_type' => $payload['return_type'],
                'refund_amount' => $payload['refund_amount'],
                'credited_amount' => $payload['credited_amount'],
                'total_return_amount' => $payload['total_return_amount'],
                'exchange_amount' => $payload['exchange_amount'] ?? 0,
                'difference_amount' => $payload['difference_amount'] ?? 0,
                'exchange_payment_method' => $payload['exchange_payment_method'] ?? null,
                'exchange_cash' => $payload['exchange_cash'] ?? 0,
                'exchange_change' => $payload['exchange_change'] ?? 0,
                'notes' => $payload['notes'],
            ]);

            $salesReturn->items()->delete();
            $salesReturn->items()->createMany($payload['items']);

            $salesReturn->exchangeItems()->delete();
            if ($payload['return_type'] === 'product_exchange' && ! empty($payload['exchange_items'])) {
                $salesReturn->exchangeItems()->createMany($payload['exchange_items']);
            }
        });

        $salesReturn->refresh();
        $salesReturn->load(['items.product', 'exchangeItems.product']);
        $this->auditLogService->log(
            event: 'sales_return.updated',
            module: 'sales_returns',
            auditable: $salesReturn,
            description: 'Draft retur penjualan diperbarui.',
            before: $before,
            after: $this->salesReturnAuditPayload($salesReturn),
        );

        if ($request->input('action') === 'complete') {
            abort_unless($request->user()->can('sales-returns-complete'), 403);
            $this->executeCompletion($request, $salesReturn);

            return back()->with('success', 'Retur penjualan berhasil diselesaikan.');
        }

        return back()->with('success', 'Draft retur penjualan berhasil diperbarui.');
    }

    public function complete(Request $request, SalesReturn $salesReturn): RedirectResponse
    {
        $this->ensureSalesReturnTablesExist();

        $salesReturn = $this->resolveAccessibleSalesReturn($request, $salesReturn->id);
        $this->ensureDraft($salesReturn);

        $this->executeCompletion($request, $salesReturn);

        return back()->with('success', 'Retur penjualan berhasil diselesaikan.');
    }

    private function executeCompletion(Request $request, SalesReturn $salesReturn): void
    {
        $before = $this->salesReturnAuditPayload($salesReturn);

        DB::transaction(function () use ($request, $salesReturn) {
            $activeShift = $this->cashierShiftService->requireActiveShiftForUser(
                $request->user()->id,
                lockForUpdate: true
            );

            $salesReturn->load([
                'transaction.receivable',
                'items.product',
                'items.transactionDetail',
                'exchangeItems.product',
            ]);

            if ($salesReturn->items->isEmpty()) {
                throw ValidationException::withMessages([
                    'sales_return' => 'Draft retur belum memiliki item.',
                ]);
            }

            if ($salesReturn->return_type === 'product_exchange' && $salesReturn->exchangeItems->isEmpty()) {
                throw ValidationException::withMessages([
                    'sales_return' => 'Tukar barang wajib memilih minimal satu barang pengganti.',
                ]);
            }

            $returnedQtyMap = $this->getCompletedReturnedQtyMap(
                $salesReturn->transaction_id,
                excludeSalesReturnId: $salesReturn->id,
            );

            foreach ($salesReturn->items as $item) {
                $detail = $item->transactionDetail;

                if (! $detail || $item->qty_return < 1) {
                    throw ValidationException::withMessages([
                        'sales_return' => 'Seluruh item retur harus memiliki kuantitas minimal 1.',
                    ]);
                }

                $returnedBefore = (int) ($returnedQtyMap[$detail->id] ?? 0);
                $remainingQty = (int) $detail->qty - $returnedBefore;

                if ($item->qty_return > $remainingQty) {
                    throw ValidationException::withMessages([
                        'sales_return' => 'Ada item retur yang melebihi sisa qty yang bisa diretur.',
                    ]);
                }
            }

            $returnWarehouseId = $salesReturn->warehouse_id ?: $salesReturn->transaction->warehouse_id;

            // Restock returned items
            foreach ($salesReturn->items as $item) {
                $detail = $item->transactionDetail;
                $conversionFactor = (float) ($detail?->conversion_factor ?: 1);
                $baseQtyReturn = (int) round((float) $item->qty_return * $conversionFactor);

                if ($item->restock_to_inventory && $item->product) {
                    $product = $item->product()->lockForUpdate()->first();

                    if ($product) {
                        $stockBefore = (int) $product->stock;
                        $stockAfter = $stockBefore + $baseQtyReturn;

                        // Restock to return warehouse
                        if ($returnWarehouseId) {
                            $pivot = ProductWarehouse::firstOrCreate([
                                'product_id' => $product->id,
                                'warehouse_id' => $returnWarehouseId,
                            ], ['stock' => 0]);
                            $pivot->increment('stock', $baseQtyReturn);
                        }

                        $this->stockMutationService->recordSalesReturnRestock(
                            product: $product,
                            salesReturn: $salesReturn,
                            stockBefore: $stockBefore,
                            stockAfter: $stockAfter,
                            reason: $item->return_reason,
                            userId: $request->user()?->id,
                        );
                    }
                }

                if ($item->product && $detail) {
                    $unitBuyPrice = $detail->unit_id
                        ? $this->unitConversionService->getBuyPrice($item->product, $detail->unit_id)
                        : (int) round($item->product->buy_price * $conversionFactor);

                    $margin = ((int) $detail->price - $unitBuyPrice) * (int) $item->qty_return;

                    Profit::create([
                        'transaction_id' => $salesReturn->transaction_id,
                        'total' => -$margin,
                    ]);
                }
            }

            // Deduct exchange replacement items stock
            if ($salesReturn->return_type === 'product_exchange') {
                foreach ($salesReturn->exchangeItems as $exchangeItem) {
                    $product = $exchangeItem->product()->lockForUpdate()->first();

                    if (! $product) {
                        throw ValidationException::withMessages([
                            'sales_return' => 'Produk pengganti tidak ditemukan.',
                        ]);
                    }

                    $conversionFactor = (float) ($exchangeItem->conversion_factor ?: 1);
                    $requiredBaseStock = (int) round((float) $exchangeItem->qty * $conversionFactor);

                    $availableStock = $returnWarehouseId
                        ? (int) ($product->warehouses()->where('warehouse_id', $returnWarehouseId)->lockForUpdate()->first()?->pivot->stock ?? 0)
                        : (int) $product->stock;

                    if ($availableStock < $requiredBaseStock) {
                        throw ValidationException::withMessages([
                            'sales_return' => "Stok produk pengganti {$product->title} tidak mencukupi (Dibutuhkan: {$requiredBaseStock}, Tersedia: {$availableStock}).",
                        ]);
                    }

                    $stockBefore = (int) $product->stock;
                    $stockAfter = $stockBefore - $requiredBaseStock;

                    if ($returnWarehouseId) {
                        $pivot = ProductWarehouse::firstOrCreate([
                            'product_id' => $product->id,
                            'warehouse_id' => $returnWarehouseId,
                        ], ['stock' => 0]);
                        $pivot->decrement('stock', $requiredBaseStock);
                    }

                    $unitLabel = $exchangeItem->unit?->name ?? 'unit';
                    $this->stockMutationService->recordSalesReturnExchangeOut(
                        product: $product,
                        salesReturn: $salesReturn,
                        qty: $requiredBaseStock,
                        stockBefore: $stockBefore,
                        stockAfter: $stockAfter,
                        warehouseId: $returnWarehouseId,
                        notes: 'Barang pengganti retur penjualan '.$salesReturn->code.' ('.$exchangeItem->qty.' '.$unitLabel.')',
                        userId: $request->user()?->id,
                    );

                    $exchangeBuyPrice = $exchangeItem->unit_id
                        ? $this->unitConversionService->getBuyPrice($product, $exchangeItem->unit_id)
                        : (int) round(($product->buy_price ?? 0) * $conversionFactor);
                    $exchangeMargin = ((int) $exchangeItem->unit_price - $exchangeBuyPrice) * (int) $exchangeItem->qty;

                    Profit::create([
                        'transaction_id' => $salesReturn->transaction_id,
                        'total' => $exchangeMargin,
                    ]);
                }
            }

            $salesReturn->loadMissing('transaction.receivable');
            $settlement = $this->calculateSettlement(
                $salesReturn->transaction,
                (int) $salesReturn->total_return_amount,
                $salesReturn->return_type,
                (int) $salesReturn->exchange_amount,
                (int) $salesReturn->difference_amount,
                $salesReturn->exchange_payment_method,
                (int) $salesReturn->exchange_cash,
                (int) $salesReturn->exchange_change
            );

            $salesReturn->update([
                'cashier_shift_id' => $activeShift->id,
                'warehouse_id' => $returnWarehouseId,
                'return_type' => $settlement['return_type'],
                'refund_amount' => $settlement['refund_amount'],
                'credited_amount' => $settlement['credited_amount'],
                'exchange_amount' => $settlement['exchange_amount'],
                'difference_amount' => $settlement['difference_amount'],
                'exchange_payment_method' => $settlement['exchange_payment_method'],
                'exchange_cash' => $settlement['exchange_cash'],
                'exchange_change' => $settlement['exchange_change'],
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            if ($salesReturn->transaction->payment_method === 'pay_later' && $salesReturn->transaction->receivable) {
                $receivable = $salesReturn->transaction->receivable()->lockForUpdate()->first();

                if ($receivable && $settlement['receivable_total_after'] !== null) {
                    $receivable->update([
                        'total' => $settlement['receivable_total_after'],
                        'status' => $this->determineReceivableStatus(
                            total: $settlement['receivable_total_after'],
                            paid: (int) $receivable->paid,
                            dueDate: $receivable->due_date,
                        ),
                    ]);
                }
            }

            if (
                $salesReturn->customer_id
                && $salesReturn->credited_amount > 0
            ) {
                CustomerCredit::create([
                    'customer_id' => $salesReturn->customer_id,
                    'sales_return_id' => $salesReturn->id,
                    'amount' => $salesReturn->credited_amount,
                    'balance' => $salesReturn->credited_amount,
                    'notes' => 'Saldo toko dari retur penjualan '.$salesReturn->code,
                ]);
            }
        });

        $salesReturn->refresh();
        $salesReturn->load(['items.product', 'exchangeItems.product']);
        $this->auditLogService->log(
            event: 'sales_return.completed',
            module: 'sales_returns',
            auditable: $salesReturn,
            description: 'Retur penjualan diselesaikan.',
            before: $before,
            after: $this->salesReturnAuditPayload($salesReturn),
        );
    }

    public function print(Request $request, SalesReturn $salesReturn)
    {
        $this->ensureSalesReturnTablesExist();
        $salesReturn = $this->resolveAccessibleSalesReturn($request, $salesReturn->id);

        $defaultPaperSize = Setting::get('printer_paper_size', '58mm');
        $autoPrint = Setting::getBool('printer_auto_print', false);
        $autoPrintDriver = Setting::get('printer_driver', 'browser');

        $enabledButtons = [
            'bluetooth' => Setting::getBool('printer_enable_bluetooth', true),
            'webusb' => Setting::getBool('printer_enable_webusb', true),
            'server' => Setting::getBool('printer_enable_server', true),
        ];

        return Inertia::render('Dashboard/SalesReturns/Print', [
            'salesReturn' => $salesReturn,
            'defaultPaperSize' => $defaultPaperSize,
            'autoPrint' => $autoPrint,
            'autoPrintDriver' => $autoPrintDriver,
            'enabledButtons' => $enabledButtons,
        ]);
    }

    public function directPrint(Request $request, SalesReturn $salesReturn)
    {
        $this->ensureSalesReturnTablesExist();
        $salesReturn = $this->resolveAccessibleSalesReturn($request, $salesReturn->id);

        $success = $this->thermalPrintService->printSalesReturnDirectToCups($salesReturn);

        if ($success) {
            return response()->json([
                'success' => true,
                'message' => 'Struk retur berhasil dicetak langsung ke printer EPPOS!',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Gagal mencetak struk langsung. Pastikan printer terhubung.',
        ], 500);
    }

    public function receipt(Request $request, SalesReturn $salesReturn)
    {
        $this->ensureSalesReturnTablesExist();
        $salesReturn = $this->resolveAccessibleSalesReturn($request, $salesReturn->id);
        $paperSize = $request->query('size', Setting::get('printer_paper_size', '58mm'));
        $html = $this->thermalPrintService->generateSalesReturnReceiptHtml($salesReturn, $paperSize);

        return response($html)->header('Content-Type', 'text/html');
    }

    private function getAvailableProducts(?int $warehouseId = null): Collection
    {
        return Product::query()
            ->select('id', 'barcode', 'sku', 'title', 'sell_price', 'buy_price')
            ->with(['units'])
            ->when($warehouseId, function ($q) use ($warehouseId) {
                $q->with(['warehouses' => fn ($w) => $w->where('warehouses.id', $warehouseId)]);
            })
            ->orderBy('title')
            ->get()
            ->map(function (Product $p) use ($warehouseId) {
                $baseUnit = $p->baseUnit() ?: $p->units->first();
                $units = $p->units->map(function ($u) use ($p) {
                    $isBase = (bool) ($u->pivot->is_base ?? false);
                    $factor = (float) ($u->pivot->conversion_factor ?? 1);
                    $sellPrice = (int) ($u->pivot->sell_price ?? $p->sell_price);
                    $buyPrice = (int) ($u->pivot->buy_price ?? $p->buy_price);

                    return [
                        'id' => $u->id,
                        'name' => $u->name,
                        'code' => $u->code,
                        'symbol' => $u->symbol,
                        'is_base' => $isBase,
                        'conversion_factor' => $factor,
                        'sell_price' => $sellPrice,
                        'buy_price' => $buyPrice,
                    ];
                })->values()->all();

                if (empty($units)) {
                    $units = [
                        [
                            'id' => null,
                            'name' => 'Pieces',
                            'code' => 'PCS',
                            'symbol' => 'pcs',
                            'is_base' => true,
                            'conversion_factor' => 1.0,
                            'sell_price' => (int) $p->sell_price,
                            'buy_price' => (int) $p->buy_price,
                        ],
                    ];
                }

                return [
                    'id' => $p->id,
                    'title' => $p->title,
                    'barcode' => $p->barcode,
                    'sku' => $p->sku,
                    'unit_id' => $baseUnit?->id,
                    'unit_name' => $baseUnit?->name ?? 'Pieces',
                    'unit_code' => $baseUnit?->code ?? 'PCS',
                    'sell_price' => (int) $p->sell_price,
                    'buy_price' => (int) $p->buy_price,
                    'stock' => $warehouseId
                        ? (int) ($p->warehouses->first()?->pivot->stock ?? 0)
                        : (int) $p->stock,
                    'units' => $units,
                ];
            });
    }

    private function salesReturnAuditPayload(SalesReturn $salesReturn): array
    {
        return [
            'code' => $salesReturn->code,
            'status' => $salesReturn->status,
            'return_type' => $salesReturn->return_type,
            'refund_amount' => (int) $salesReturn->refund_amount,
            'credited_amount' => (int) $salesReturn->credited_amount,
            'total_return_amount' => (int) $salesReturn->total_return_amount,
            'exchange_amount' => (int) $salesReturn->exchange_amount,
            'difference_amount' => (int) $salesReturn->difference_amount,
            'exchange_payment_method' => $salesReturn->exchange_payment_method,
            'exchange_cash' => (int) $salesReturn->exchange_cash,
            'exchange_change' => (int) $salesReturn->exchange_change,
            'transaction_id' => (int) $salesReturn->transaction_id,
            'items_summary' => $salesReturn->items->map(fn (SalesReturnItem $item) => [
                'product_id' => $item->product_id,
                'product_title' => $item->product?->title,
                'qty_return' => (int) $item->qty_return,
                'subtotal_return' => (int) $item->subtotal_return,
                'restock_to_inventory' => (bool) $item->restock_to_inventory,
            ])->values()->all(),
            'exchange_items_summary' => $salesReturn->exchangeItems->map(fn (SalesReturnExchangeItem $item) => [
                'product_id' => $item->product_id,
                'product_title' => $item->product?->title,
                'qty' => (int) $item->qty,
                'unit_price' => (int) $item->unit_price,
                'subtotal' => (int) $item->subtotal,
            ])->values()->all(),
        ];
    }

    private function resolveAccessibleTransaction(Request $request, int $transactionId): Transaction
    {
        $user = $request->user();

        return Transaction::query()
            ->with([
                'cashier:id,name',
                'customer:id,name',
                'receivable',
                'details.product:id,title,barcode,sku,buy_price',
                'details.product.units',
                'details.unit',
                'details.salesReturnItems.salesReturn:id,status',
            ])
            ->when($user && ! $user->isHQ(), function (Builder $query) use ($user) {
                $query->where(function (Builder $sub) use ($user) {
                    $sub->where('warehouse_id', $user->warehouse_id)
                        ->orWhere('cashier_id', $user->id);
                });
            })
            ->findOrFail($transactionId);
    }

    private function resolveAccessibleSalesReturn(Request $request, int $salesReturnId): SalesReturn
    {
        $user = $request->user();

        return SalesReturn::query()
            ->with([
                'warehouse:id,code,name,address,phone,type',
                'customer:id,name',
                'cashier:id,name',
                'transaction.warehouse:id,code,name,address,phone,type',
                'transaction.cashier:id,name',
                'transaction.customer:id,name',
                'transaction.receivable',
                'transaction.details.product:id,title,barcode,sku,buy_price',
                'transaction.details.product.units',
                'transaction.details.unit',
                'transaction.details.salesReturnItems.salesReturn:id,status',
                'items.product:id,title,barcode,sku,buy_price',
                'items.product.units',
                'items.transactionDetail:id,transaction_id,product_id,qty,price,unit_id,conversion_factor',
                'items.transactionDetail.unit',
                'exchangeItems.product:id,title,barcode,sku,buy_price,sell_price',
                'exchangeItems.product.units',
            ])
            ->when($user && ! $user->isHQ(), function (Builder $query) use ($user) {
                $query->where(function (Builder $sub) use ($user) {
                    $sub->where('warehouse_id', $user->warehouse_id)
                        ->orWhere('cashier_id', $user->id)
                        ->orWhereHas('transaction', fn (Builder $b) => $b->where('warehouse_id', $user->warehouse_id));
                });
            })
            ->findOrFail($salesReturnId);
    }

    private function resolveDetailUnit(TransactionDetail $detail): ?Unit
    {
        if ($detail->unit) {
            return $detail->unit;
        }

        if ($detail->unit_id) {
            $unit = Unit::find($detail->unit_id);
            if ($unit) {
                return $unit;
            }
        }

        $product = $detail->product;
        if (! $product) {
            return null;
        }

        if (! empty($detail->conversion_factor) && (float) $detail->conversion_factor > 1) {
            $matchingUnit = $product->units->first(function ($u) use ($detail) {
                return abs((float) ($u->pivot->conversion_factor ?? 1) - (float) $detail->conversion_factor) < 0.001;
            });
            if ($matchingUnit) {
                return $matchingUnit;
            }
        }

        $unitPrice = $detail->qty > 0 ? (int) round($detail->price / $detail->qty) : (int) $detail->price;
        if ($unitPrice > 0) {
            $matchingByPrice = $product->units->first(function ($u) use ($unitPrice) {
                return (int) ($u->pivot->sell_price ?? 0) === $unitPrice;
            });
            if ($matchingByPrice) {
                return $matchingByPrice;
            }
        }

        return $product->baseUnit() ?: $product->units->first();
    }

    private function transformTransactionForEditor(Transaction $transaction, ?SalesReturn $salesReturn = null): array
    {
        $draftItems = collect($salesReturn?->items ?? [])
            ->keyBy('transaction_detail_id');

        return [
            'id' => $transaction->id,
            'invoice' => $transaction->invoice,
            'created_at' => $transaction->getRawOriginal('created_at')
                ? Carbon::parse($transaction->getRawOriginal('created_at'))->toISOString()
                : null,
            'cashier' => $transaction->cashier ? [
                'id' => $transaction->cashier->id,
                'name' => $transaction->cashier->name,
            ] : null,
            'customer' => $transaction->customer ? [
                'id' => $transaction->customer->id,
                'name' => $transaction->customer->name,
            ] : null,
            'grand_total' => (int) $transaction->grand_total,
            'payment_method' => $transaction->payment_method,
            'payment_status' => $transaction->payment_status,
            'receivable' => $transaction->receivable ? [
                'id' => $transaction->receivable->id,
                'total' => (int) $transaction->receivable->total,
                'paid' => (int) $transaction->receivable->paid,
                'status' => $transaction->receivable->status,
                'remaining' => (int) $transaction->receivable->remaining,
            ] : null,
            'details' => $transaction->details->map(function (TransactionDetail $detail) use ($draftItems) {
                $completedReturnedQty = (int) $detail->salesReturnItems
                    ->filter(fn (SalesReturnItem $item) => $item->salesReturn?->status === 'completed')
                    ->sum('qty_return');

                $draftItem = $draftItems->get($detail->id);
                $qtySold = (int) $detail->qty;
                $unit = $this->resolveDetailUnit($detail);
                $unitName = $unit?->name ?? $unit?->code ?? 'Pcs';

                return [
                    'id' => $detail->id,
                    'product_id' => $detail->product_id,
                    'product' => $detail->product ? [
                        'id' => $detail->product->id,
                        'title' => $detail->product->title,
                        'barcode' => $detail->product->barcode,
                        'sku' => $detail->product->sku,
                        'unit_name' => $unitName,
                    ] : null,
                    'unit_name' => $unitName,
                    'unit_code' => $unit?->code ?? 'PCS',
                    'qty' => $qtySold,
                    'price' => (int) $detail->price,
                    'returned_completed_qty' => $completedReturnedQty,
                    'remaining_returnable_qty' => max(0, $qtySold - $completedReturnedQty),
                    'draft_item' => $draftItem ? [
                        'qty_return' => (int) $draftItem->qty_return,
                        'return_reason' => $draftItem->return_reason,
                        'restock_to_inventory' => (bool) $draftItem->restock_to_inventory,
                        'subtotal' => (int) $draftItem->subtotal,
                    ] : null,
                ];
            })->values(),
        ];
    }

    private function transformSalesReturn(SalesReturn $salesReturn): array
    {
        return [
            'id' => $salesReturn->id,
            'code' => $salesReturn->code,
            'status' => $salesReturn->status,
            'return_type' => $salesReturn->return_type,
            'refund_amount' => (int) $salesReturn->refund_amount,
            'credited_amount' => (int) $salesReturn->credited_amount,
            'total_return_amount' => (int) $salesReturn->total_return_amount,
            'exchange_amount' => (int) $salesReturn->exchange_amount,
            'difference_amount' => (int) $salesReturn->difference_amount,
            'exchange_payment_method' => $salesReturn->exchange_payment_method,
            'exchange_cash' => (int) $salesReturn->exchange_cash,
            'exchange_change' => (int) $salesReturn->exchange_change,
            'notes' => $salesReturn->notes,
            'created_at' => optional($salesReturn->created_at)?->toISOString(),
            'completed_at' => optional($salesReturn->completed_at)?->toISOString(),
            'cashier' => $salesReturn->cashier ? [
                'id' => $salesReturn->cashier->id,
                'name' => $salesReturn->cashier->name,
            ] : null,
            'customer' => $salesReturn->customer ? [
                'id' => $salesReturn->customer->id,
                'name' => $salesReturn->customer->name,
            ] : null,
            'transaction' => [
                'id' => $salesReturn->transaction?->id,
                'invoice' => $salesReturn->transaction?->invoice,
            ],
            'items' => $salesReturn->items->map(function (SalesReturnItem $item) {
                $unit = $item->transactionDetail ? $this->resolveDetailUnit($item->transactionDetail) : ($item->product?->baseUnit() ?: $item->product?->units->first());
                $unitName = $unit?->name ?? $unit?->code ?? 'Pcs';

                return [
                    'id' => $item->id,
                    'transaction_detail_id' => $item->transaction_detail_id,
                    'product' => $item->product ? [
                        'id' => $item->product->id,
                        'title' => $item->product->title,
                        'barcode' => $item->product->barcode,
                        'sku' => $item->product->sku,
                        'unit_name' => $unitName,
                    ] : null,
                    'unit_name' => $unitName,
                    'unit_code' => $unit?->code ?? 'PCS',
                    'qty_sold' => (int) $item->qty_sold,
                    'qty_returned_before' => (int) $item->qty_returned_before,
                    'qty_return' => (int) $item->qty_return,
                    'unit_price' => (int) $item->unit_price,
                    'subtotal' => (int) $item->subtotal,
                    'return_reason' => $item->return_reason,
                    'restock_to_inventory' => (bool) $item->restock_to_inventory,
                ];
            })->values(),
            'exchange_items' => $salesReturn->exchangeItems->map(function (SalesReturnExchangeItem $item) {
                $product = $item->product;
                $unit = $item->unit ?: ($item->unit_id && $product ? $product->units->firstWhere('id', $item->unit_id) : ($product?->baseUnit() ?: $product?->units->first()));
                $unitName = $unit?->name ?? $unit?->code ?? 'Pieces';

                $productUnits = $product ? $product->units->map(fn ($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'code' => $u->code,
                    'symbol' => $u->symbol,
                    'is_base' => (bool) ($u->pivot->is_base ?? false),
                    'conversion_factor' => (float) ($u->pivot->conversion_factor ?? 1),
                    'sell_price' => (int) ($u->pivot->sell_price ?? $product->sell_price),
                    'buy_price' => (int) ($u->pivot->buy_price ?? $product->buy_price),
                ])->values()->all() : [];

                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'unit_id' => $item->unit_id ?: $unit?->id,
                    'conversion_factor' => (float) ($item->conversion_factor ?: 1),
                    'product' => $product ? [
                        'id' => $product->id,
                        'title' => $product->title,
                        'barcode' => $product->barcode,
                        'sku' => $product->sku,
                        'sell_price' => (int) $product->sell_price,
                        'unit_name' => $unitName,
                        'units' => $productUnits,
                    ] : null,
                    'unit_name' => $unitName,
                    'unit_code' => $unit?->code ?? 'PCS',
                    'qty' => (int) $item->qty,
                    'unit_price' => (int) $item->unit_price,
                    'subtotal' => (int) $item->subtotal,
                ];
            })->values(),
        ];
    }

    private function transactionHasReturnableItems(Transaction $transaction): bool
    {
        return $transaction->details->contains(function (TransactionDetail $detail) {
            $completedReturnedQty = (int) $detail->salesReturnItems
                ->filter(fn (SalesReturnItem $item) => $item->salesReturn?->status === 'completed')
                ->sum('qty_return');

            return $completedReturnedQty < (int) $detail->qty;
        });
    }

    private function prepareDraftPayload(Transaction $transaction, array $validated, ?int $excludeSalesReturnId = null): array
    {
        $details = $transaction->details->keyBy('id');
        $returnedQtyMap = $this->getCompletedReturnedQtyMap($transaction->id, $excludeSalesReturnId);

        $returnType = $validated['return_type'];

        if (! $transaction->customer_id && $returnType === 'store_credit') {
            $returnType = 'refund_cash';
        }

        $items = collect($validated['items'])
            ->map(function (array $item) use ($details, $returnedQtyMap) {
                $detail = $details->get((int) $item['transaction_detail_id']);

                if (! $detail) {
                    throw ValidationException::withMessages([
                        'items' => 'Ada item retur yang tidak cocok dengan transaksi asal.',
                    ]);
                }

                $qtyReturn = (int) ($item['qty_return'] ?? 0);

                if ($qtyReturn < 1) {
                    return null;
                }

                $qtyReturnedBefore = (int) ($returnedQtyMap[$detail->id] ?? 0);
                $remainingQty = (int) $detail->qty - $qtyReturnedBefore;

                if ($qtyReturn > $remainingQty) {
                    throw ValidationException::withMessages([
                        'items' => 'Qty retur melebihi sisa qty yang bisa diretur.',
                    ]);
                }

                if (blank($item['return_reason'] ?? null)) {
                    throw ValidationException::withMessages([
                        'items' => 'Alasan retur wajib diisi untuk setiap item yang diretur.',
                    ]);
                }

                return [
                    'transaction_detail_id' => $detail->id,
                    'product_id' => $detail->product_id,
                    'qty_sold' => (int) $detail->qty,
                    'qty_returned_before' => $qtyReturnedBefore,
                    'qty_return' => $qtyReturn,
                    'unit_price' => (int) $detail->price,
                    'subtotal' => $qtyReturn * (int) $detail->price,
                    'return_reason' => trim($item['return_reason']),
                    'restock_to_inventory' => (bool) ($item['restock_to_inventory'] ?? true),
                ];
            })
            ->filter()
            ->values();

        if ($items->isEmpty()) {
            throw ValidationException::withMessages([
                'items' => 'Pilih minimal satu item retur dengan qty lebih dari 0.',
            ]);
        }

        $totalReturnAmount = (int) $items->sum('subtotal');

        $exchangeItems = collect();
        $exchangeAmount = 0;
        $diffAmount = 0;
        $exchangePaymentMethod = $validated['exchange_payment_method'] ?? null;
        $exchangeCash = (int) ($validated['exchange_cash'] ?? 0);
        $exchangeChange = (int) ($validated['exchange_change'] ?? 0);

        if ($returnType === 'product_exchange') {
            $rawExchangeItems = $validated['exchange_items'] ?? [];
            $productIds = collect($rawExchangeItems)->pluck('product_id')->filter()->unique();
            $products = Product::with('units')->whereIn('id', $productIds)->get()->keyBy('id');

            $exchangeItems = collect($rawExchangeItems)->map(function ($eItem) use ($products) {
                $pId = (int) ($eItem['product_id'] ?? 0);
                $product = $products->get($pId);
                $qty = max(0, (int) ($eItem['qty'] ?? 0));
                if (! $product || $qty < 1) {
                    return null;
                }

                $requestedUnitId = ! empty($eItem['unit_id']) ? (int) $eItem['unit_id'] : null;
                $matchedUnit = $requestedUnitId ? $product->units->firstWhere('id', $requestedUnitId) : null;
                $unit = $matchedUnit ?: $product->baseUnit() ?: $product->units->first();

                $unitId = $unit?->id;
                $conversionFactor = (float) ($unit?->pivot->conversion_factor ?? 1);
                $unitPrice = $unit && isset($unit->pivot->sell_price) && (int) $unit->pivot->sell_price > 0
                    ? (int) $unit->pivot->sell_price
                    : (int) ($eItem['unit_price'] ?? $product->sell_price);

                return [
                    'product_id' => $product->id,
                    'unit_id' => $unitId,
                    'conversion_factor' => $conversionFactor,
                    'qty' => $qty,
                    'unit_price' => $unitPrice,
                    'subtotal' => $qty * $unitPrice,
                ];
            })->filter()->values();

            if ($exchangeItems->isEmpty()) {
                throw ValidationException::withMessages([
                    'exchange_items' => 'Pilih minimal satu produk pengganti untuk tukar barang.',
                ]);
            }

            $exchangeAmount = (int) $exchangeItems->sum('subtotal');
            $diffAmount = $exchangeAmount - $totalReturnAmount;

            if ($diffAmount > 0) {
                if (empty($exchangePaymentMethod)) {
                    $exchangePaymentMethod = 'cash';
                }
                if ($exchangePaymentMethod === 'cash') {
                    $exchangeCash = max($diffAmount, $exchangeCash);
                    $exchangeChange = max(0, $exchangeCash - $diffAmount);
                } else {
                    $exchangeCash = $diffAmount;
                    $exchangeChange = 0;
                }
            } else {
                $exchangeCash = 0;
                $exchangeChange = 0;
            }
        }

        $settlement = $this->calculateSettlement(
            $transaction,
            $totalReturnAmount,
            $returnType,
            $exchangeAmount,
            $diffAmount,
            $exchangePaymentMethod,
            $exchangeCash,
            $exchangeChange
        );

        return [
            'return_type' => $settlement['return_type'],
            'notes' => $validated['notes'] ?? null,
            'refund_amount' => $settlement['refund_amount'],
            'credited_amount' => $settlement['credited_amount'],
            'total_return_amount' => $totalReturnAmount,
            'exchange_amount' => $settlement['exchange_amount'],
            'difference_amount' => $settlement['difference_amount'],
            'exchange_payment_method' => $settlement['exchange_payment_method'],
            'exchange_cash' => $settlement['exchange_cash'],
            'exchange_change' => $settlement['exchange_change'],
            'items' => $items->all(),
            'exchange_items' => $exchangeItems->all(),
        ];
    }

    private function calculateSettlement(
        Transaction $transaction,
        int $totalReturnAmount,
        string $returnType,
        int $exchangeAmount = 0,
        int $differenceAmount = 0,
        ?string $exchangePaymentMethod = null,
        int $exchangeCash = 0,
        int $exchangeChange = 0
    ): array {
        if ($returnType === 'product_exchange') {
            $diff = $exchangeAmount - $totalReturnAmount;
            $refundAmount = 0;
            $creditedAmount = 0;

            if ($diff < 0) {
                $overpaid = abs($diff);
                if ($transaction->customer_id && $exchangePaymentMethod === 'store_credit') {
                    $creditedAmount = $overpaid;
                } else {
                    $refundAmount = $overpaid;
                }
            }

            return [
                'return_type' => 'product_exchange',
                'refund_amount' => $refundAmount,
                'credited_amount' => $creditedAmount,
                'exchange_amount' => $exchangeAmount,
                'difference_amount' => $diff,
                'exchange_payment_method' => $exchangePaymentMethod,
                'exchange_cash' => $exchangeCash,
                'exchange_change' => $exchangeChange,
                'receivable_total_after' => null,
            ];
        }

        $resolvedReturnType = ! $transaction->customer_id && $returnType === 'store_credit'
            ? 'refund_cash'
            : $returnType;

        $refundAmount = 0;
        $creditedAmount = 0;
        $receivableTotalAfter = null;

        if ($transaction->payment_method === 'pay_later' && $transaction->receivable) {
            $currentTotal = (int) $transaction->receivable->total;
            $paid = (int) $transaction->receivable->paid;
            $receivableTotalAfter = max(0, $currentTotal - $totalReturnAmount);
            $settlementAmount = max(0, $paid - $receivableTotalAfter);

            if ($resolvedReturnType === 'store_credit') {
                $creditedAmount = $settlementAmount;
            } else {
                $refundAmount = $settlementAmount;
            }
        } elseif ($transaction->payment_status === 'paid') {
            if ($resolvedReturnType === 'store_credit') {
                $creditedAmount = $totalReturnAmount;
            } else {
                $refundAmount = $totalReturnAmount;
            }
        }

        return [
            'return_type' => $resolvedReturnType,
            'refund_amount' => $refundAmount,
            'credited_amount' => $creditedAmount,
            'exchange_amount' => 0,
            'difference_amount' => 0,
            'exchange_payment_method' => null,
            'exchange_cash' => 0,
            'exchange_change' => 0,
            'receivable_total_after' => $receivableTotalAfter,
        ];
    }

    private function determineReceivableStatus(int $total, int $paid, $dueDate): string
    {
        if ($paid >= $total) {
            return 'paid';
        }

        if ($paid > 0) {
            return 'partial';
        }

        if ($dueDate && now()->startOfDay()->gt($dueDate->copy()->startOfDay())) {
            return 'overdue';
        }

        return 'unpaid';
    }

    private function getCompletedReturnedQtyMap(int $transactionId, ?int $excludeSalesReturnId = null): Collection
    {
        return SalesReturnItem::query()
            ->selectRaw('transaction_detail_id, COALESCE(SUM(qty_return), 0) as total_qty')
            ->whereHas('salesReturn', function (Builder $query) use ($transactionId, $excludeSalesReturnId) {
                $query->where('transaction_id', $transactionId)
                    ->where('status', 'completed');

                if ($excludeSalesReturnId) {
                    $query->where('id', '!=', $excludeSalesReturnId);
                }
            })
            ->groupBy('transaction_detail_id')
            ->pluck('total_qty', 'transaction_detail_id');
    }

    private function ensureDraft(SalesReturn $salesReturn): void
    {
        if (! $salesReturn->isDraft()) {
            throw ValidationException::withMessages([
                'sales_return' => 'Retur penjualan yang sudah selesai tidak dapat diubah lagi.',
            ]);
        }
    }

    private function ensureSalesReturnTablesExist(): void
    {
        if (! Schema::hasTable('sales_returns') || ! Schema::hasTable('sales_return_items')) {
            abort(503, 'Fitur retur penjualan belum siap. Jalankan migrasi database terlebih dahulu.');
        }
    }

    private function generateCode(): string
    {
        do {
            $code = 'SR-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
        } while (SalesReturn::where('code', $code)->exists());

        return $code;
    }
}
