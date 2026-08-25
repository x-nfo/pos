<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerVoucher;
use App\Models\DiscountApprovalLog;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Receivable;
use App\Models\Transaction;
use App\Services\CashierShiftService;
use App\Services\LoyaltyService;
use App\Services\PricingService;
use App\Services\StockMutationService;
use App\Services\UnitConversionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TransactionSyncController extends Controller
{
    public function __construct(
        protected CashierShiftService $cashierShiftService,
        protected PricingService $pricingService,
        protected LoyaltyService $loyaltyService,
        protected UnitConversionService $unitConversionService,
        protected StockMutationService $stockMutationService
    ) {}

    /**
     * Sync single offline transaction.
     */
    public function sync(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_tx_id' => 'required|string',
            'created_at' => 'nullable|string',
            'customer_id' => 'nullable|integer|exists:customers,id',
            'discount' => 'nullable|numeric|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'redeem_points' => 'nullable|numeric|min:0',
            'customer_voucher_id' => 'nullable|integer|exists:customer_vouchers,id',
            'grand_total' => 'nullable|numeric|min:0',
            'cash' => 'nullable|numeric|min:0',
            'payment_gateway' => 'nullable|string',
            'pay_later' => 'nullable|boolean',
            'due_date' => 'nullable|date',
            'bank_account_id' => 'nullable|integer|exists:bank_accounts,id',
            'customer_npwp' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.qty' => 'required|numeric|min:1',
            'items.*.unit_id' => 'nullable|integer',
            'items.*.conversion_factor' => 'nullable|numeric',
            'items.*.unit_price' => 'nullable|numeric',
            'items.*.price' => 'nullable|numeric',
            'items.*.discount_total' => 'nullable|numeric',
        ]);

        $clientTxId = $validated['client_tx_id'];
        $offlineRef = 'offline:'.$clientTxId;

        // Idempotency check: if transaction already synced, return success immediately
        $existing = Transaction::where('payment_reference', $offlineRef)->first();
        if ($existing) {
            return response()->json([
                'success' => true,
                'idempotent' => true,
                'message' => 'Transaksi offline sudah tersinkronkan sebelumnya.',
                'invoice' => $existing->invoice,
                'transaction_id' => $existing->id,
            ]);
        }

        $activeShift = $this->cashierShiftService->requireActiveShiftForUser(
            auth()->id(),
            lockForUpdate: true
        );

        $isPayLater = (bool) ($validated['pay_later'] ?? false);
        $paymentGateway = $isPayLater ? null : ($validated['payment_gateway'] ?? null);
        if ($paymentGateway) {
            $paymentGateway = strtolower($paymentGateway);
        }

        $isCashPayment = (empty($paymentGateway) || $paymentGateway === 'cash') && ! $isPayLater;
        $manualDiscount = max(0, (int) ($validated['discount'] ?? 0));
        $shippingCost = max(0, (int) ($validated['shipping_cost'] ?? 0));
        $requestedRedeemPoints = max(0, (int) ($validated['redeem_points'] ?? 0));
        $customer = ! empty($validated['customer_id'])
            ? Customer::find($validated['customer_id'])
            : null;
        $voucher = ! empty($validated['customer_voucher_id'])
            ? CustomerVoucher::find($validated['customer_voucher_id'])
            : null;

        $length = 10;
        $random = '';
        for ($i = 0; $i < $length; $i++) {
            $random .= rand(0, 1) ? rand(0, 9) : chr(rand(ord('a'), ord('z')));
        }
        $invoice = 'TRX-'.Str::upper($random);

        $transaction = DB::transaction(function () use (
            $validated,
            $activeShift,
            $invoice,
            $offlineRef,
            $isCashPayment,
            $isPayLater,
            $paymentGateway,
            $manualDiscount,
            $shippingCost,
            $requestedRedeemPoints,
            $customer,
            $voucher
        ) {
            // Process items and calculate totals
            $items = $validated['items'];
            $lineItems = [];
            $subtotal = 0;

            foreach ($items as $item) {
                $product = Product::find($item['product_id']);
                if (! $product) {
                    continue;
                }

                $qty = (float) $item['qty'];
                $unitId = (int) ($item['unit_id'] ?? ($product->baseUnit()?->id ?? 1));
                $conversionFactor = (float) ($item['conversion_factor'] ?? 1);
                $unitPrice = isset($item['unit_price']) ? (int) $item['unit_price'] : (int) $product->sell_price;
                $linePrice = isset($item['price']) ? (int) $item['price'] : (int) ($unitPrice * $qty);
                $lineDiscount = (int) ($item['discount_total'] ?? 0);

                $subtotal += $linePrice;

                $unitSellPrice = $unitId && $product
                    ? $this->unitConversionService->getSellPrice($product, $unitId)
                    : (int) ($product->sell_price * ($conversionFactor ?: 1));

                $lineItems[] = [
                    'product' => $product,
                    'product_id' => $product->id,
                    'unit_id' => $unitId,
                    'conversion_factor' => $conversionFactor,
                    'qty' => $qty,
                    'base_unit_price' => $unitSellPrice,
                    'unit_price' => $unitPrice,
                    'price' => $linePrice,
                    'discount_total' => $lineDiscount,
                ];
            }

            $subtotalAfterPromo = max(0, $subtotal);
            $grandTotal = max(0, (int) ($validated['grand_total'] ?? ($subtotalAfterPromo - $manualDiscount + $shippingCost)));
            $cashAmount = $isCashPayment ? max(0, (int) ($validated['cash'] ?? $grandTotal)) : 0;
            $changeAmount = $isCashPayment ? max(0, $cashAmount - $grandTotal) : 0;

            $transaction = Transaction::create([
                'cashier_id' => auth()->id(),
                'cashier_shift_id' => $activeShift->id,
                'warehouse_id' => $activeShift->warehouse_id,
                'customer_id' => $customer?->id,
                'invoice' => $invoice,
                'cash' => $cashAmount,
                'change' => $changeAmount,
                'discount' => $manualDiscount,
                'loyalty_points_redeemed' => $requestedRedeemPoints,
                'loyalty_discount_total' => 0,
                'customer_voucher_discount' => 0,
                'customer_voucher_code' => $voucher?->code,
                'customer_voucher_name' => $voucher?->name,
                'shipping_cost' => $shippingCost,
                'grand_total' => $grandTotal,
                'payment_method' => $isPayLater ? 'pay_later' : ($paymentGateway ?: 'cash'),
                'payment_status' => $isCashPayment ? 'paid' : ($isPayLater ? 'unpaid' : 'pending'),
                'payment_reference' => $offlineRef,
                'bank_account_id' => $paymentGateway === 'bank_transfer' ? ($validated['bank_account_id'] ?? null) : null,
                'customer_npwp' => $validated['customer_npwp'] ?? null,
            ]);

            foreach ($lineItems as $lineItem) {
                $transaction->details()->create([
                    'transaction_id' => $transaction->id,
                    'product_id' => $lineItem['product_id'],
                    'unit_id' => $lineItem['unit_id'],
                    'conversion_factor' => $lineItem['conversion_factor'],
                    'qty' => $lineItem['qty'],
                    'base_unit_price' => $lineItem['base_unit_price'],
                    'unit_price' => $lineItem['unit_price'],
                    'price' => $lineItem['price'],
                    'discount_total' => $lineItem['discount_total'],
                ]);

                $product = $lineItem['product'];
                $unitBuyPrice = $lineItem['unit_id'] && $product
                    ? $this->unitConversionService->getBuyPrice($product, (int) $lineItem['unit_id'])
                    : (int) ($product->buy_price * ($lineItem['conversion_factor'] ?: 1));
                $totalBuyPrice = $unitBuyPrice * $lineItem['qty'];
                $lineShare = $subtotalAfterPromo > 0 ? $lineItem['price'] / $subtotalAfterPromo : 0;
                $allocatedManualDiscount = (int) round($manualDiscount * $lineShare);
                $netSellPrice = max(0, $lineItem['price'] - $allocatedManualDiscount);
                $profits = $netSellPrice - $totalBuyPrice;

                $transaction->profits()->create([
                    'transaction_id' => $transaction->id,
                    'total' => $profits,
                ]);

                // Option A: Decrement stock directly (allowing negative stock if offline sale exceeded current DB stock)
                if ($product->is_composite) {
                    $product->load('components');
                    foreach ($product->components as $component) {
                        $componentQty = (int) round((float) $component->pivot->qty * $lineItem['qty']);
                        $stockBefore = (int) $component->stock;
                        $stockAfter = $stockBefore - $componentQty;

                        ProductWarehouse::where([
                            'product_id' => $component->id,
                            'warehouse_id' => $activeShift->warehouse_id,
                        ])->decrement('stock', $componentQty);
                        $component->decrement('stock', $componentQty);

                        $this->stockMutationService->recordSaleOut(
                            product: $component,
                            transaction: $transaction,
                            qty: $componentQty,
                            stockBefore: $stockBefore,
                            stockAfter: $stockAfter,
                            warehouseId: $activeShift->warehouse_id,
                            notes: 'Komponen '.$component->title.' untuk bundle '.$product->title.' pada sync transaksi '.$transaction->invoice,
                            userId: auth()->id()
                        );
                    }
                } else {
                    $baseQty = (int) round($lineItem['qty'] * (float) $lineItem['conversion_factor']);
                    $stockBefore = (int) $product->stock;
                    $stockAfter = $stockBefore - $baseQty;

                    ProductWarehouse::where([
                        'product_id' => $product->id,
                        'warehouse_id' => $activeShift->warehouse_id,
                    ])->decrement('stock', $baseQty);
                    $product->decrement('stock', $baseQty);

                    $this->stockMutationService->recordSaleOut(
                        product: $product,
                        transaction: $transaction,
                        qty: $baseQty,
                        stockBefore: $stockBefore,
                        stockAfter: $stockAfter,
                        warehouseId: $activeShift->warehouse_id,
                        notes: 'Sync offline penjualan transaksi '.$transaction->invoice,
                        userId: auth()->id()
                    );
                }
            }

            if ($isPayLater) {
                Receivable::create([
                    'customer_id' => $customer?->id,
                    'transaction_id' => $transaction->id,
                    'invoice' => $invoice,
                    'total' => $grandTotal,
                    'paid' => 0,
                    'due_date' => $validated['due_date'] ?? null,
                    'status' => 'unpaid',
                ]);
            }

            return $transaction;
        });

        // Check if discount needs approval
        if ($transaction->discount > 0 && $transaction->needsDiscountApproval()) {
            $transaction->update([
                'discount_approval_status' => 'pending',
                'payment_status' => 'pending_approval',
            ]);

            DiscountApprovalLog::create([
                'transaction_id' => $transaction->id,
                'cashier_id' => auth()->id(),
                'requested_discount' => $manualDiscount,
                'status' => 'pending',
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Transaksi offline berhasil disinkronkan.',
            'invoice' => $transaction->invoice,
            'transaction_id' => $transaction->id,
        ]);
    }
}
