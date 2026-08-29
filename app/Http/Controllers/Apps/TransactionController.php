<?php

namespace App\Http\Controllers\Apps;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTransactionRequest;
use App\Models\BankAccount;
use App\Models\Cart;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerVoucher;
use App\Models\PaymentSetting;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\Warehouse;
use App\Services\AuditLogService;
use App\Services\CashierShiftService;
use App\Services\CheckoutService;
use App\Services\DocumentNumberService;
use App\Services\LoyaltyService;
use App\Services\Payments\PaymentGatewayManager;
use App\Services\PricingService;
use App\Services\StockMutationService;
use App\Services\ThermalPrintService;
use App\Services\UnitConversionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    public function __construct(
        private readonly CashierShiftService $cashierShiftService,
        private readonly AuditLogService $auditLogService,
        private readonly PricingService $pricingService,
        private readonly LoyaltyService $loyaltyService,
        private readonly StockMutationService $stockMutationService,
        private readonly DocumentNumberService $documentNumberService,
        private readonly CheckoutService $checkoutService
    ) {}

    /**
     * index
     *
     * @return Response
     */
    public function index(Request $request)
    {
        $userAgent = (string) $request->header('User-Agent', '');
        $isMobile = (bool) preg_match('/(android|iphone|ipad|ipod|mobile|phone)/i', $userAgent);

        if ($isMobile && ! $request->has('desktop')) {
            return Inertia::render('Dashboard/Transactions/Mobile', $this->getTransactionPageData());
        }

        return Inertia::render('Dashboard/Transactions/Index', $this->getTransactionPageData());
    }

    /**
     * mobile
     *
     * @return Response
     */
    public function mobile()
    {
        return Inertia::render('Dashboard/Transactions/Mobile', $this->getTransactionPageData());
    }

    /**
     * getTransactionPageData
     */
    private function getTransactionPageData(): array
    {
        $userId = auth()->user()->id;
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($userId);
        $warehouseId = $activeShift?->warehouse_id;

        // Get active cart items (not held)
        $carts = Cart::with(['product.category', 'unit'])
            ->where('cashier_id', $userId)
            ->active()
            ->latest()
            ->get();

        $initialPricingPreview = $this->loyaltyService->previewCheckout(
            $this->pricingService->previewCart($carts, null)
        );

        // Get held carts grouped by hold_id
        $heldCarts = Cart::with('product:id,title,sell_price,image')
            ->where('cashier_id', $userId)
            ->held()
            ->get()
            ->groupBy('hold_id')
            ->map(function ($items, $holdId) {
                $first = $items->first();

                return [
                    'hold_id' => $holdId,
                    'label' => $first->hold_label,
                    'held_at' => $first->held_at?->toISOString(),
                    'items_count' => $items->sum('qty'),
                    'total' => $items->sum('price'),
                ];
            })
            ->values();

        // get all customers
        $customers = Customer::latest()->get();

        // get products with stock > 0 in active warehouse
        $products = Product::with(['category:id,name', 'units'])
            ->select('id', 'barcode', 'title', 'description', 'image', 'buy_price', 'sell_price', 'stock', 'category_id')
            ->when($warehouseId, function ($q) use ($warehouseId) {
                $q->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $warehouseId)
                    ->where('product_warehouse.stock', '>', 0));
            }, function ($q) {
                $q->where('stock', '>', 0);
            })
            ->orderBy('title')
            ->get();
        $pricingBadges = $this->pricingService->previewProducts($products, null);
        $products = $products->map(function (Product $product) use ($pricingBadges) {
            $pricing = $pricingBadges->get($product->id);

            $units = $product->units->map(function ($u) use ($product) {
                $isBase = (bool) ($u->pivot->is_base ?? false);
                $factor = (float) ($u->pivot->conversion_factor ?? 1);

                $buyPrice = $isBase
                    ? (int) $product->buy_price
                    : (int) (($u->pivot->buy_price && (int) $u->pivot->buy_price > 0) ? $u->pivot->buy_price : round($product->buy_price * $factor));

                $sellPrice = $isBase
                    ? (int) $product->sell_price
                    : (int) (($u->pivot->sell_price && (int) $u->pivot->sell_price > 0) ? $u->pivot->sell_price : round($product->sell_price * $factor));

                return [
                    'id' => $u->id,
                    'code' => $u->code,
                    'name' => $u->name,
                    'symbol' => $u->symbol,
                    'is_base' => $isBase,
                    'conversion_factor' => $factor,
                    'buy_price' => $buyPrice,
                    'sell_price' => $sellPrice,
                    'barcode' => $u->pivot->barcode ?? null,
                ];
            })->values()->toArray();

            return [
                ...$product->toArray(),
                'units' => $units,
                'pricing_badge' => $pricing && ! empty($pricing['pricing_rule']) ? [
                    'label' => $pricing['pricing_rule']['label'],
                    'promo_price' => $pricing['pricing_rule']['price_context']
                        ? $pricing['effective_unit_price']
                        : null,
                    'base_price' => $pricing['base_unit_price'],
                    'kind' => $pricing['pricing_rule']['kind'],
                ] : null,
            ];
        });

        // get all categories
        $categories = Category::select('id', 'name', 'image')
            ->orderBy('name')
            ->get();

        $paymentSetting = PaymentSetting::first();

        $carts_total = 0;
        foreach ($carts as $cart) {
            $carts_total += $cart->price;
        }

        $defaultGateway = $paymentSetting?->default_gateway ?? 'cash';
        if (
            $defaultGateway !== 'cash'
            && (! $paymentSetting || ! $paymentSetting->isGatewayReady($defaultGateway))
        ) {
            $defaultGateway = 'cash';
        }

        // Get active bank accounts for bank transfer
        $bankAccounts = BankAccount::active()->ordered()->get();

        return [
            'carts' => $carts,
            'carts_total' => $carts_total,
            'heldCarts' => $heldCarts,
            'customers' => $customers,
            'products' => $products,
            'categories' => $categories,
            'initialPricingPreview' => $initialPricingPreview,
            'paymentGateways' => $paymentSetting?->enabledGateways() ?? [],
            'defaultPaymentGateway' => $defaultGateway,
            'bankAccounts' => $bankAccounts,
            'shiftSummary' => $this->cashierShiftService->summarizeForDisplay($activeShift),
            'loyaltyTierOptions' => $this->loyaltyService->tierOptions(),
        ];
    }

    /**
     * searchProduct
     *
     * @param  mixed  $request
     * @return void
     */
    public function searchProduct(Request $request)
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser(auth()->user()->id);
        $warehouseId = $activeShift?->warehouse_id;
        $barcode = (string) $request->barcode;

        $product = Product::with('units')
            ->where(function ($q) use ($barcode) {
                $q->where('barcode', $barcode)
                    ->orWhereHas('units', fn ($uq) => $uq->where('product_units.barcode', $barcode));
            })
            ->whereHas('warehouses', fn ($q) => $q->where('product_warehouse.warehouse_id', $warehouseId))
            ->first();

        if ($product) {
            $pivotStock = $product->warehouses()->where('warehouse_id', $warehouseId)->first()?->pivot->stock ?? 0;
            $matchedUnit = $product->units->firstWhere('pivot.barcode', $barcode);

            return response()->json([
                'success' => true,
                'data' => [
                    ...$product->toArray(),
                    'stock' => $pivotStock,
                    'scanned_unit_id' => $matchedUnit?->id,
                ],
            ]);
        }

        return response()->json([
            'success' => false,
            'data' => null,
        ]);
    }

    public function previewPricing(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'discount' => ['nullable', 'integer', 'min:0'],
            'shipping_cost' => ['nullable', 'integer', 'min:0'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
            'customer_voucher_id' => ['nullable', 'integer', 'exists:customer_vouchers,id'],
        ]);

        $customer = isset($validated['customer_id'])
            ? Customer::find($validated['customer_id'])
            : null;
        $voucher = isset($validated['customer_voucher_id'])
            ? CustomerVoucher::find($validated['customer_voucher_id'])
            : null;

        $carts = Cart::with(['product.category', 'unit'])
            ->where('cashier_id', $request->user()->id)
            ->active()
            ->latest()
            ->get();

        $pricingPreview = $this->pricingService->previewCart($carts, $customer);

        return response()->json([
            'success' => true,
            'data' => $this->loyaltyService->previewCheckout($pricingPreview, $customer, [
                'manual_discount' => (int) ($validated['discount'] ?? 0),
                'shipping_cost' => (int) ($validated['shipping_cost'] ?? 0),
                'redeem_points' => (int) ($validated['redeem_points'] ?? 0),
                'voucher' => $voucher,
            ]),
        ]);
    }

    /**
     * addToCart
     *
     * @param  mixed  $request
     * @return void
     */
    public function addToCart(Request $request)
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser(auth()->user()->id);
        $warehouseId = $activeShift?->warehouse_id;

        $product = Product::whereId($request->product_id)->first();

        if (! $product) {
            return redirect()->back()->with('error', 'Product not found.');
        }

        // Composite: check component stock
        if ($product->is_composite) {
            $product->load('components');
            foreach ($product->components as $component) {
                $needed = (float) $component->pivot->qty * $request->qty;
                $whProduct = $component->warehouses()->where('warehouse_id', $warehouseId)->first();
                $avail = $whProduct?->pivot->stock ?? 0;
                if ($avail < $needed) {
                    return redirect()->back()->with('error', "Stok {$component->title} tidak mencukupi.");
                }
            }
            // Composite price = sum component prices
            $sellPrice = (int) $product->components->sum(fn ($c) => $c->sell_price * (float) $c->pivot->qty);
            $unitId = (int) ($product->baseUnit()?->id ?: 1);
        } else {
            $unitId = (int) ($request->unit_id ?: $product->baseUnit()?->id ?: 1);
            $unitConversion = app(UnitConversionService::class);
            $baseQty = $unitConversion->toBaseUnit($product, $unitId, $request->qty);

            $alreadyInCartBaseQty = Cart::where('cashier_id', auth()->user()->id)
                ->where('product_id', $product->id)
                ->active()
                ->get()
                ->sum(fn ($c) => $unitConversion->toBaseUnit($product, $c->unit_id, $c->qty));

            $availableStock = $warehouseId
                ? (int) ($product->warehouses()->where('warehouse_id', $warehouseId)->first()?->pivot->stock ?? 0)
                : (int) $product->stock;

            if ($availableStock < ($alreadyInCartBaseQty + $baseQty)) {
                return redirect()->back()->with('error', 'Stok tidak mencukupi.');
            }

            $sellPrice = $unitConversion->getSellPrice($product, $unitId);
            $pu = $product->units()->where('unit_id', $unitId)->first();
            $conversionFactor = $pu?->pivot->conversion_factor ?? 1;
        }
        if (! isset($conversionFactor)) {
            $conversionFactor = 1;
        }

        $cart = Cart::with('product')
            ->where('product_id', $request->product_id)
            ->where('unit_id', $unitId)
            ->where('cashier_id', auth()->user()->id)
            ->active()
            ->first();

        if ($cart) {
            $cart->increment('qty', $request->qty);
            $cart->price = $sellPrice * $cart->qty;
            $cart->save();
        } else {
            Cart::create([
                'cashier_id' => auth()->user()->id,
                'warehouse_id' => $warehouseId,
                'product_id' => $request->product_id,
                'unit_id' => $unitId,
                'conversion_factor' => $conversionFactor,
                'qty' => $request->qty,
                'price' => $sellPrice * $request->qty,
            ]);
        }

        return redirect()->back()->with('success', 'Product Added Successfully!.');
    }

    /**
     * destroyCart
     *
     * @param  mixed  $request
     * @return void
     */
    public function destroyCart($cart_id)
    {
        $cart = Cart::with('product')->whereId($cart_id)->first();

        if ($cart) {
            $cart->delete();

            return back()->with('success', 'Item berhasil dihapus');
        } else {
            return back()->with('error', 'Item keranjang tidak ditemukan');
        }
    }

    /**
     * updateCart - Update cart item quantity
     *
     * @param  mixed  $request
     * @param  int  $cart_id
     * @return void
     */
    public function updateCart(Request $request, $cart_id)
    {
        $request->validate([
            'qty' => 'required|integer|min:1',
        ]);

        $activeShift = $this->cashierShiftService->getActiveShiftForUser(auth()->user()->id);
        $warehouseId = $activeShift?->warehouse_id;

        $cart = Cart::with('product')->whereId($cart_id)
            ->where('cashier_id', auth()->user()->id)
            ->first();

        if (! $cart) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cart item not found',
                ], 404);
            }

            return back()->with('error', 'Item keranjang tidak ditemukan');
        }

        $unitConversion = app(UnitConversionService::class);
        $unitId = (int) ($cart->unit_id ?: $cart->product->baseUnit()?->id ?: 1);
        $baseQty = $unitConversion->toBaseUnit($cart->product, $unitId, $request->qty);

        // Check stock availability
        $availableStock = $warehouseId
            ? (int) ($cart->product->warehouses()->where('warehouse_id', $warehouseId)->first()?->pivot->stock ?? 0)
            : (int) $cart->product->stock;

        $otherCartItemsBaseQty = Cart::where('cashier_id', auth()->user()->id)
            ->where('product_id', $cart->product_id)
            ->where('id', '!=', $cart->id)
            ->active()
            ->get()
            ->sum(fn ($c) => $unitConversion->toBaseUnit($cart->product, $c->unit_id, $c->qty));

        if ($availableStock < ($otherCartItemsBaseQty + $baseQty)) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Stok tidak mencukupi. Tersedia: '.$availableStock,
                ], 422);
            }

            return back()->with('error', 'Stok tidak mencukupi. Tersedia: '.$availableStock);
        }

        // Update quantity and price
        $sellPrice = $unitConversion->getSellPrice($cart->product, $unitId);
        $cart->qty = $request->qty;
        $cart->price = $sellPrice * $request->qty;
        $cart->save();

        return back()->with('success', 'Jumlah berhasil diperbarui');
    }

    /**
     * holdCart - Hold current cart items for later
     *
     * @return JsonResponse
     */
    public function holdCart(Request $request)
    {
        $request->validate([
            'label' => 'nullable|string|max:50',
        ]);

        $userId = auth()->user()->id;

        // Get active cart items
        $activeCarts = Cart::where('cashier_id', $userId)
            ->active()
            ->get();

        if ($activeCarts->isEmpty()) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Keranjang kosong, tidak ada yang bisa ditahan',
                ], 422);
            }

            return back()->with('error', 'Keranjang kosong, tidak ada yang bisa ditahan');
        }

        // Generate unique hold ID
        $holdId = 'HOLD-'.strtoupper(uniqid());
        $label = $request->label ?: 'Transaksi '.now()->format('H:i');

        // Mark all active cart items as held
        Cart::where('cashier_id', $userId)
            ->active()
            ->update([
                'hold_id' => $holdId,
                'hold_label' => $label,
                'held_at' => now(),
            ]);

        return back()->with('success', 'Transaksi ditahan: '.$label);
    }

    /**
     * resumeCart - Resume a held cart
     *
     * @param  string  $holdId
     * @return JsonResponse
     */
    public function resumeCart($holdId)
    {
        $userId = auth()->user()->id;

        // Check if there are any active carts (not held)
        $activeCarts = Cart::where('cashier_id', $userId)
            ->active()
            ->count();

        if ($activeCarts > 0) {
            if (request()->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Selesaikan atau tahan transaksi aktif terlebih dahulu',
                ], 422);
            }

            return back()->with('error', 'Selesaikan atau tahan transaksi aktif terlebih dahulu');
        }

        // Get held carts
        $heldCarts = Cart::where('cashier_id', $userId)
            ->forHold($holdId)
            ->get();

        if ($heldCarts->isEmpty()) {
            if (request()->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Transaksi ditahan tidak ditemukan',
                ], 404);
            }

            return back()->with('error', 'Transaksi ditahan tidak ditemukan');
        }

        // Resume by clearing hold info
        Cart::where('cashier_id', $userId)
            ->forHold($holdId)
            ->update([
                'hold_id' => null,
                'hold_label' => null,
                'held_at' => null,
            ]);

        return back()->with('success', 'Transaksi dilanjutkan');
    }

    /**
     * clearHold - Delete a held cart
     *
     * @param  string  $holdId
     * @return JsonResponse
     */
    public function clearHold($holdId)
    {
        $userId = auth()->user()->id;

        $deleted = Cart::where('cashier_id', $userId)
            ->forHold($holdId)
            ->delete();

        if ($deleted === 0) {
            return request()->wantsJson()
                ? response()->json([
                    'success' => false,
                    'message' => 'Transaksi ditahan tidak ditemukan',
                ], 404)
                : back()->with('error', 'Transaksi ditahan tidak ditemukan');
        }

        if (request()->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Transaksi ditahan berhasil dihapus',
            ]);
        }

        return back()->with('success', 'Transaksi ditahan berhasil dihapus');
    }

    /**
     * getHeldCarts - Get all held carts for current user
     *
     * @return JsonResponse
     */
    public function getHeldCarts()
    {
        $userId = auth()->user()->id;

        $heldCarts = Cart::with('product:id,title,sell_price,image')
            ->where('cashier_id', $userId)
            ->held()
            ->get()
            ->groupBy('hold_id')
            ->map(function ($items, $holdId) {
                $first = $items->first();

                return [
                    'hold_id' => $holdId,
                    'label' => $first->hold_label,
                    'held_at' => $first->held_at,
                    'items_count' => $items->sum('qty'),
                    'total' => $items->sum('price'),
                    'items' => $items->map(fn ($item) => [
                        'id' => $item->id,
                        'product' => $item->product,
                        'qty' => $item->qty,
                        'price' => $item->price,
                    ]),
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'held_carts' => $heldCarts,
        ]);
    }

    /**
     * store
     *
     * @return RedirectResponse
     */
    public function store(StoreTransactionRequest $request)
    {
        $userId = auth()->id();
        $lock = Cache::lock("checkout_cashier_{$userId}", 10);

        if (! $lock->get()) {
            return redirect()
                ->route('transactions.index')
                ->with('error', 'Transaksi sedang diproses, mohon tunggu sebentar.');
        }

        try {
            $transaction = $this->checkoutService->processCheckout($request->user(), $request->validated());

            if ($transaction->discount_approval_status === 'pending') {
                return redirect()
                    ->route('transactions.print', $transaction->invoice)
                    ->with('info', 'Transaksi menunggu approval supervisor.');
            }

            return to_route('transactions.print', $transaction->invoice);
        } catch (PaymentGatewayException $exception) {
            return redirect()
                ->route('transactions.print', $transaction->invoice ?? $request->input('invoice'))
                ->with('error', $exception->getMessage());
        } catch (ValidationException $e) {
            $message = collect($e->errors())->flatten()->first() ?: $e->getMessage();

            return redirect()
                ->route('transactions.index')
                ->with('error', $message);
        } finally {
            $lock->release();
        }
    }

    public function print($invoice)
    {
        // get transaction
        $transaction = Transaction::with([
            'details.product',
            'details.unit',
            'details.pricingRule',
            'cashier:id,name',
            'customer:id,name',
            'receivable',
            'bankAccount',
            'discountApprover:id,name',
            'discountApprovalLogs.responder:id,name',
            'paymentConfirmer:id,name',
        ])
            ->where('invoice', $invoice)
            ->firstOrFail();

        $defaultPaperSize = Setting::get('printer_paper_size', '58mm');
        $autoPrint = Setting::getBool('printer_auto_print', false);
        $autoPrintDriver = Setting::get('printer_driver', 'browser');

        $enabledButtons = [
            'bluetooth' => Setting::getBool('printer_enable_bluetooth', true),
            'webusb' => Setting::getBool('printer_enable_webusb', true),
            'server' => Setting::getBool('printer_enable_server', true),
            'pdf_receipt' => Setting::getBool('printer_enable_pdf_receipt', true),
            'pdf_invoice' => Setting::getBool('printer_enable_pdf_invoice', true),
        ];

        return Inertia::render('Dashboard/Transactions/Print', [
            'transaction' => $transaction,
            'defaultPaperSize' => $defaultPaperSize,
            'autoPrint' => $autoPrint,
            'autoPrintDriver' => $autoPrintDriver,
            'enabledButtons' => $enabledButtons,
        ]);
    }

    public function directPrint(string $invoice, ThermalPrintService $thermalPrintService)
    {
        $transaction = Transaction::with(['details.product', 'details.unit', 'cashier', 'customer'])
            ->where('invoice', $invoice)
            ->firstOrFail();

        $success = $thermalPrintService->printDirectToCups($transaction);

        if ($success) {
            return response()->json([
                'success' => true,
                'message' => 'Struk berhasil dicetak langsung ke printer EPPOS!',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Gagal mencetak struk langsung. Pastikan printer terhubung.',
        ], 500);
    }

    public function retryQrisly(string $invoice, PaymentGatewayManager $paymentGatewayManager)
    {
        $transaction = Transaction::where('invoice', $invoice)->firstOrFail();
        $paymentSetting = PaymentSetting::first();

        if (! $paymentSetting || ! $paymentSetting->isGatewayReady(PaymentSetting::GATEWAY_QRISLY)) {
            return back()->with('error', 'Gateway QRISLY belum dikonfigurasi atau belum aktif.');
        }

        try {
            $paymentResponse = $paymentGatewayManager->createPayment($transaction, PaymentSetting::GATEWAY_QRISLY, $paymentSetting);

            $transaction->update([
                'payment_reference' => $paymentResponse['reference'] ?? null,
                'payment_url' => $paymentResponse['payment_url'] ?? null,
            ]);

            return back()->with('success', 'QRIS berhasil dibuat!');
        } catch (PaymentGatewayException $exception) {
            return back()->with('error', $exception->getMessage());
        }
    }

    /**
     * Display transaction history.
     */
    public function history(Request $request)
    {
        $salesReturnTablesReady = Schema::hasTable('sales_returns') && Schema::hasTable('sales_return_items');

        $filters = [
            'invoice' => $request->input('invoice'),
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'warehouse_id' => $request->input('warehouse_id'),
            'payment_status' => $request->input('payment_status'),
            'payment_method' => $request->input('payment_method'),
        ];

        $query = Transaction::query()
            ->with([
                'cashier:id,name',
                'paymentConfirmer:id,name',
                'warehouse:id,code,name',
                'cashierShift:id,opened_at,status',
                'customer:id,name,no_telp',
                'receivable',
                'details.product:id,title',
                'details.unit:id,name,symbol',
            ])
            ->withSum('details as total_items', 'qty')
            ->withSum('profits as total_profit', 'total')
            ->orderByDesc('created_at');

        if ($salesReturnTablesReady) {
            $query->with('details.salesReturnItems.salesReturn:id,status');
        }

        if (! $request->user()->isSuperAdmin()) {
            $query->where('cashier_id', $request->user()->id);
        }

        $query
            ->when($filters['invoice'], function (Builder $builder, $invoice) {
                $builder->where('invoice', 'like', '%'.$invoice.'%');
            })
            ->when($filters['start_date'], function (Builder $builder, $date) {
                $builder->whereDate('created_at', '>=', $date);
            })
            ->when($filters['end_date'], function (Builder $builder, $date) {
                $builder->whereDate('created_at', '<=', $date);
            })
            ->when($filters['warehouse_id'], function (Builder $builder, $warehouseId) {
                $builder->where('warehouse_id', $warehouseId);
            })
            ->when($filters['payment_status'], function (Builder $builder, $status) {
                $builder->where('payment_status', $status);
            })
            ->when($filters['payment_method'], function (Builder $builder, $method) {
                $builder->where('payment_method', $method);
            });

        $transactions = $query->paginate($this->perPage())->withQueryString();
        $warehouses = Warehouse::active()->orderBy('code')->get(['id', 'code', 'name']);
        $transactions->through(function (Transaction $transaction) use ($salesReturnTablesReady) {
            $canCreateSalesReturn = false;

            if ($salesReturnTablesReady) {
                $allReturned = true;

                foreach ($transaction->details as $detail) {
                    $returnedQty = (int) $detail->salesReturnItems
                        ->filter(fn ($item) => $item->salesReturn?->status === 'completed')
                        ->sum('qty_return');

                    if ($returnedQty < (int) $detail->qty) {
                        $allReturned = false;
                        break;
                    }
                }

                $canCreateSalesReturn = $transaction->details->isNotEmpty() && ! $allReturned;
            }

            return [
                ...$transaction->toArray(),
                'can_create_sales_return' => $canCreateSalesReturn,
            ];
        });

        return Inertia::render('Dashboard/Transactions/History', [
            'transactions' => $transactions,
            'filters' => $filters,
            'salesReturnFeatureReady' => $salesReturnTablesReady,
            'warehouses' => $warehouses,
        ]);
    }

    /**
     * Confirm payment for bank transfer transactions
     */
    public function confirmPayment(Transaction $transaction)
    {
        if ($transaction->payment_status === 'paid') {
            return redirect()
                ->back()
                ->with('error', 'Transaksi sudah dibayar.');
        }

        $beforeStatus = $transaction->payment_status;
        $confirmedAt = now();

        $transaction->update([
            'payment_status' => 'paid',
            'payment_confirmed_by' => auth()->id(),
            'payment_confirmed_at' => $confirmedAt,
        ]);

        $this->auditLogService->log(
            event: 'transaction.payment_confirmed',
            module: 'transactions',
            auditable: $transaction,
            description: "Pembayaran untuk invoice {$transaction->invoice} dikonfirmasi.",
            before: [
                'invoice' => $transaction->invoice,
                'payment_method' => $transaction->payment_method,
                'payment_status' => $beforeStatus,
                'bank_account_id' => $transaction->bank_account_id,
            ],
            after: [
                'invoice' => $transaction->invoice,
                'payment_method' => $transaction->payment_method,
                'payment_status' => 'paid',
                'bank_account_id' => $transaction->bank_account_id,
                'payment_confirmed_by' => auth()->id(),
                'payment_confirmed_at' => $confirmedAt->toDateTimeString(),
            ],
            meta: [
                'invoice' => $transaction->invoice,
                'bank_account_id' => $transaction->bank_account_id,
                'payment_confirmed_by' => auth()->id(),
                'payment_confirmed_at' => $confirmedAt->toDateTimeString(),
            ],
        );

        if (Setting::getBool('printer_auto_print', false)) {
            try {
                $transaction->loadMissing(['details.product', 'details.unit', 'cashier', 'customer']);
                $thermalPrintService = app(ThermalPrintService::class);
                $thermalPrintService->printDirectToCups($transaction);
            } catch (\Throwable $e) {
                \Log::warning("Auto print on payment confirmed failed for {$transaction->invoice}: {$e->getMessage()}");
            }
        }

        return redirect()
            ->back()
            ->with('success', "Pembayaran untuk invoice {$transaction->invoice} berhasil dikonfirmasi.");
    }
}
