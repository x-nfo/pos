<?php

namespace App\Services;

use App\Exceptions\PaymentGatewayException;
use App\Models\Cart;
use App\Models\Customer;
use App\Models\CustomerVoucher;
use App\Models\DiscountApprovalLog;
use App\Models\PaymentSetting;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Receivable;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Services\Payments\PaymentGatewayManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    public function __construct(
        private readonly CashierShiftService $cashierShiftService,
        private readonly PricingService $pricingService,
        private readonly LoyaltyService $loyaltyService,
        private readonly StockMutationService $stockMutationService,
        private readonly DocumentNumberService $documentNumberService,
        private readonly UnitConversionService $unitConversionService,
        private readonly PaymentGatewayManager $paymentGatewayManager,
        private readonly ThermalPrintService $thermalPrintService,
    ) {}

    /**
     * Process checkout for cashier with provided payload.
     *
     * @throws ValidationException
     * @throws PaymentGatewayException
     */
    public function processCheckout(User $cashier, array $payload): Transaction
    {
        $isPayLater = (bool) ($payload['pay_later'] ?? (($payload['payment_method'] ?? '') === 'pay_later'));
        $paymentGateway = $isPayLater
            ? null
            : ($payload['payment_gateway'] ?? ($payload['payment_method'] ?? null));

        if ($paymentGateway) {
            $paymentGateway = strtolower($paymentGateway);
            if ($paymentGateway === 'cash' || $paymentGateway === 'pay_later') {
                $paymentGateway = null;
            }
        }

        $paymentSetting = null;

        if ($isPayLater && blank($payload['due_date'] ?? null)) {
            throw ValidationException::withMessages([
                'due_date' => 'Tanggal jatuh tempo wajib diisi untuk nota barang.',
            ]);
        }

        if ($paymentGateway && $paymentGateway !== 'bank_transfer') {
            $paymentSetting = PaymentSetting::first();

            if (! $paymentSetting || ! $paymentSetting->isGatewayReady($paymentGateway)) {
                throw ValidationException::withMessages([
                    'payment_gateway' => 'Gateway pembayaran belum dikonfigurasi.',
                ]);
            }
        }

        $invoice = $this->documentNumberService->generateTransactionInvoice();
        $isCashPayment = empty($paymentGateway) && ! $isPayLater;
        $manualDiscount = max(0, (int) ($payload['discount'] ?? 0));
        $shippingCost = max(0, (int) ($payload['shipping_cost'] ?? 0));
        $requestedRedeemPoints = max(0, (int) ($payload['redeem_points'] ?? 0));
        $cashAmount = $isCashPayment ? max(0, (int) ($payload['cash'] ?? 0)) : 0;
        $customer = ! empty($payload['customer_id'])
            ? Customer::find($payload['customer_id'])
            : null;
        $voucher = ! empty($payload['customer_voucher_id'])
            ? CustomerVoucher::find($payload['customer_voucher_id'])
            : null;

        $transaction = DB::transaction(function () use (
            $cashier,
            $payload,
            $invoice,
            $cashAmount,
            $paymentGateway,
            $isCashPayment,
            $isPayLater,
            $manualDiscount,
            $shippingCost,
            $requestedRedeemPoints,
            $customer,
            $voucher
        ) {
            $activeShift = $this->cashierShiftService->requireActiveShiftForUser(
                $cashier->id,
                lockForUpdate: true
            );

            $carts = Cart::with('product')
                ->where('cashier_id', $cashier->id)
                ->active()
                ->get();

            if ($carts->isEmpty()) {
                abort(422, 'Keranjang kosong.');
            }

            // Validate stock availability for all products in the cart using lockForUpdate
            $productRequests = [];
            foreach ($carts as $c) {
                if ($c->product->is_composite) {
                    $c->product->load('components');
                    foreach ($c->product->components as $component) {
                        $componentQty = (int) round((float) $component->pivot->qty * $c->qty);
                        if (! isset($productRequests[$component->id])) {
                            $productRequests[$component->id] = 0;
                        }
                        $productRequests[$component->id] += $componentQty;
                    }
                } else {
                    $baseQty = (int) round($c->qty * (float) ($c->conversion_factor ?? 1));
                    if (! isset($productRequests[$c->product_id])) {
                        $productRequests[$c->product_id] = 0;
                    }
                    $productRequests[$c->product_id] += $baseQty;
                }
            }

            foreach ($productRequests as $productId => $totalBaseQty) {
                $product = Product::where('id', $productId)->lockForUpdate()->first();
                if ($product) {
                    $availableStock = $activeShift->warehouse_id
                        ? (int) ($product->warehouses()->where('warehouse_id', $activeShift->warehouse_id)->lockForUpdate()->first()?->pivot->stock ?? 0)
                        : (int) $product->stock;

                    if ($availableStock < $totalBaseQty) {
                        abort(422, "Stok untuk produk {$product->title} tidak mencukupi. Tersedia: {$availableStock}");
                    }
                }
            }

            $pricingPreview = $this->pricingService->previewCart($carts, $customer);
            $checkoutPreview = $this->loyaltyService->previewCheckout($pricingPreview, $customer, [
                'manual_discount' => $manualDiscount,
                'shipping_cost' => $shippingCost,
                'redeem_points' => $requestedRedeemPoints,
                'voucher' => $voucher,
            ]);

            $pricingItems = collect($pricingPreview['items']);
            $subtotalAfterPromo = (int) data_get($pricingPreview, 'summary.subtotal_after_promo', 0);
            $voucherDiscount = (int) data_get($checkoutPreview, 'summary.voucher_discount_total', 0);
            $loyaltyDiscount = (int) data_get($checkoutPreview, 'summary.loyalty_discount_total', 0);
            $appliedManualDiscount = (int) data_get($checkoutPreview, 'summary.manual_discount_total', 0);
            $grandTotal = (int) data_get($checkoutPreview, 'summary.grand_total', 0);
            $changeAmount = $isCashPayment ? max(0, $cashAmount - $grandTotal) : 0;

            $transaction = Transaction::create([
                'cashier_id' => $cashier->id,
                'cashier_shift_id' => $activeShift->id,
                'warehouse_id' => $activeShift->warehouse_id,
                'customer_id' => $payload['customer_id'] ?? null,
                'invoice' => $invoice,
                'cash' => $cashAmount,
                'change' => $changeAmount,
                'discount' => $appliedManualDiscount,
                'loyalty_points_redeemed' => (int) data_get($checkoutPreview, 'summary.applied_redeem_points', 0),
                'loyalty_discount_total' => $loyaltyDiscount,
                'customer_voucher_discount' => $voucherDiscount,
                'customer_voucher_code' => data_get($checkoutPreview, 'voucher.code'),
                'customer_voucher_name' => data_get($checkoutPreview, 'voucher.name'),
                'shipping_cost' => $shippingCost,
                'grand_total' => $grandTotal,
                'payment_method' => $isPayLater ? 'pay_later' : ($paymentGateway ?: 'cash'),
                'payment_status' => $isCashPayment ? 'paid' : ($isPayLater ? 'unpaid' : 'pending'),
                'bank_account_id' => $paymentGateway === 'bank_transfer' ? ($payload['bank_account_id'] ?? null) : null,
                'tax_rate' => data_get($checkoutPreview, 'summary.tax_rate'),
                'tax_total' => data_get($checkoutPreview, 'summary.tax_total', 0),
                'customer_npwp' => $payload['customer_npwp'] ?? null,
            ]);

            foreach ($carts as $cart) {
                $pricingItem = $pricingItems->firstWhere('cart_id', $cart->id);
                $lineTotal = (int) data_get($pricingItem, 'line_total', $cart->price);
                $linePromoDiscount = (int) data_get($pricingItem, 'line_discount_total', 0);
                $fallbackUnitSellPrice = $cart->unit_price ?: ($cart->qty > 0 ? (int) round($cart->price / $cart->qty) : (int) $cart->product->sell_price);
                $baseUnitPrice = (int) data_get($pricingItem, 'base_unit_price', $fallbackUnitSellPrice);
                $unitPrice = (int) data_get($pricingItem, 'effective_unit_price', $baseUnitPrice);

                $transaction->details()->create([
                    'transaction_id' => $transaction->id,
                    'product_id' => $cart->product_id,
                    'unit_id' => $cart->unit_id,
                    'conversion_factor' => $cart->conversion_factor,
                    'qty' => $cart->qty,
                    'base_unit_price' => $baseUnitPrice,
                    'unit_price' => $unitPrice,
                    'price' => $lineTotal,
                    'discount_total' => $linePromoDiscount,
                    'pricing_rule_id' => data_get($pricingItem, 'pricing_rule.id'),
                    'pricing_rule_name' => data_get($pricingItem, 'pricing_rule.name'),
                    'pricing_rule_kind' => data_get($pricingItem, 'pricing_rule.kind'),
                    'pricing_group_key' => data_get($pricingItem, 'pricing_group_key'),
                    'pricing_group_label' => data_get($pricingItem, 'pricing_group_label'),
                ]);

                $unitBuyPrice = $cart->unit_id && $cart->product
                    ? $this->unitConversionService->getBuyPrice($cart->product, $cart->unit_id)
                    : (int) ($cart->product->buy_price * ($cart->conversion_factor ?: 1));
                $totalBuyPrice = $unitBuyPrice * $cart->qty;
                $lineShare = $subtotalAfterPromo > 0 ? $lineTotal / $subtotalAfterPromo : 0;
                $allocatedManualDiscount = (int) round($appliedManualDiscount * $lineShare);
                $netSellPrice = max(0, $lineTotal - $allocatedManualDiscount);
                $profits = $netSellPrice - $totalBuyPrice;

                $transaction->profits()->create([
                    'transaction_id' => $transaction->id,
                    'total' => $profits,
                ]);

                $product = Product::find($cart->product_id);

                if ($product->is_composite) {
                    $product->load('components');
                    foreach ($product->components as $component) {
                        $componentQty = (int) round((float) $component->pivot->qty * $cart->qty);
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
                            notes: 'Komponen '.$component->title.' untuk bundle '.$product->title.' pada transaksi '.$transaction->invoice,
                            userId: $cashier->id
                        );
                    }
                } else {
                    $baseQty = (int) round($cart->qty * (float) ($cart->conversion_factor ?? 1));
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
                        notes: 'Penjualan transaksi '.$transaction->invoice,
                        userId: $cashier->id
                    );
                }
            }

            Cart::where('cashier_id', $cashier->id)->active()->delete();

            $this->loyaltyService->finalizeTransaction($transaction, $customer, $checkoutPreview);

            if ($isPayLater) {
                Receivable::create([
                    'customer_id' => $payload['customer_id'] ?? null,
                    'transaction_id' => $transaction->id,
                    'invoice' => $invoice,
                    'total' => $grandTotal,
                    'paid' => 0,
                    'due_date' => $payload['due_date'] ?? null,
                    'status' => 'unpaid',
                ]);
            }

            return $transaction->fresh(['customer', 'cashier:id,name', 'warehouse:id,code,name']);
        });

        // Check if discount needs approval
        if ($transaction->discount > 0 && $transaction->needsDiscountApproval()) {
            $transaction->update([
                'discount_approval_status' => 'pending',
                'payment_status' => 'pending_approval',
            ]);

            DiscountApprovalLog::create([
                'transaction_id' => $transaction->id,
                'cashier_id' => $cashier->id,
                'requested_discount' => (int) $transaction->discount,
                'status' => 'pending',
            ]);

            return $transaction;
        }

        // Process online payment gateway (Midtrans, Xendit, QRISLY)
        if ($paymentGateway && $paymentGateway !== 'bank_transfer') {
            try {
                $paymentSetting = $paymentSetting ?: PaymentSetting::first();
                $paymentResponse = $this->paymentGatewayManager->createPayment($transaction, $paymentGateway, $paymentSetting);

                $transaction->update([
                    'payment_reference' => $paymentResponse['reference'] ?? null,
                    'payment_url' => $paymentResponse['payment_url'] ?? null,
                ]);
            } catch (PaymentGatewayException $exception) {
                // If called from API, we can either rethrow or let caller inspect
                throw $exception;
            } catch (\Throwable $e) {
                Log::error("Payment gateway error for {$transaction->invoice}: {$e->getMessage()}");
            }
        }

        // Auto print to CUPS if enabled
        if (
            Setting::getBool('printer_auto_print', false)
            && Setting::get('printer_driver', 'browser') === 'server'
            && $transaction->payment_status === 'paid'
        ) {
            try {
                $this->thermalPrintService->printDirectToCups($transaction);
            } catch (\Throwable $e) {
                Log::warning("Auto print failed for {$transaction->invoice}: {$e->getMessage()}");
            }
        }

        return $transaction;
    }
}
