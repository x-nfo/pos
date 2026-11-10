<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\CatalogOrder;
use App\Models\Customer;
use App\Models\CustomerVoucher;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CatalogOrderService
{
    public function __construct(
        private readonly PricingService $pricingService,
        private readonly StockMutationService $stockMutationService,
        private readonly AuditLogService $auditLogService,
        private readonly UnitConversionService $unitConversionService,
    ) {}

    /**
     * Create a new catalog order from public submission
     */
    public function createOrder(array $data): CatalogOrder
    {
        return DB::transaction(function () use ($data) {
            $warehouseId = $data['warehouse_id'] ?? Warehouse::defaultId();
            $itemsData = collect($data['items'] ?? []);

            if ($itemsData->isEmpty()) {
                throw ValidationException::withMessages([
                    'items' => 'Keranjang belanja masih kosong.',
                ]);
            }

            // Anti-spam protection: maximum 3 submitted orders within last 24 hours per phone number
            $phone = trim((string) ($data['customer_phone'] ?? ''));
            if (! empty($phone)) {
                $cleanDigits = preg_replace('/[^0-9]/', '', $phone);
                if (strlen($cleanDigits) >= 8) {
                    $tail = substr($cleanDigits, -8);
                    $pendingCount = CatalogOrder::where('status', CatalogOrder::STATUS_SUBMITTED)
                        ->where('created_at', '>=', now()->subHours(24))
                        ->where(function ($q) use ($cleanDigits, $tail) {
                            $q->where('customer_phone', 'like', "%{$tail}")
                                ->orWhere('customer_phone', $cleanDigits);
                        })
                        ->count();

                    if ($pendingCount >= 3) {
                        throw ValidationException::withMessages([
                            'customer_phone' => 'Anda masih memiliki 3 pesanan yang sedang menunggu konfirmasi kasir. Mohon tunggu konfirmasi pesanan sebelumnya atau hubungi kasir via WhatsApp sebelum membuat pesanan baru.',
                        ]);
                    }
                }
            }

            $productIds = $itemsData->pluck('product_id')->unique()->filter()->values();
            $products = Product::with(['units', 'warehouses'])
                ->whereIn('id', $productIds)
                ->whereHas('warehouses', fn ($w) => $w->where('product_warehouse.warehouse_id', $warehouseId))
                ->get();

            if ($products->count() !== $productIds->count()) {
                throw ValidationException::withMessages([
                    'items' => 'Beberapa produk tidak tersedia pada cabang yang dipilih.',
                ]);
            }

            $pricingBadges = $this->pricingService->previewProducts($products, null);

            $subtotal = 0;
            $orderItems = [];

            foreach ($itemsData as $item) {
                $product = $products->firstWhere('id', $item['product_id']);
                if (! $product) {
                    continue;
                }

                if ($product->has_variants) {
                    throw ValidationException::withMessages([
                        'items' => "Produk {$product->title} memiliki varian warna/ukuran. Silakan pilih varian spesifik.",
                    ]);
                }

                $branchStock = (int) ($product->warehouses->firstWhere('id', $warehouseId)?->pivot->stock ?? 0);
                $qty = (int) ($item['qty'] ?? 1);

                if ($qty <= 0) {
                    continue;
                }

                // Resolve selected unit
                $unitId = ! empty($item['unit_id']) ? (int) $item['unit_id'] : null;
                $unit = null;
                if ($unitId) {
                    $unit = $product->units->firstWhere('id', $unitId);
                }
                if (! $unit) {
                    $unit = $product->baseUnit() ?: $product->units->first();
                }

                $conversionFactor = $unit ? (float) ($unit->pivot->conversion_factor ?? 1) : 1.0;
                $baseQty = (int) round($qty * $conversionFactor);
                if ($baseQty <= 0) {
                    $baseQty = 1;
                }

                if ($branchStock <= 0) {
                    throw ValidationException::withMessages([
                        'items' => "Produk {$product->title} sedang habis (Sold Out).",
                    ]);
                }

                if ($branchStock < $baseQty) {
                    $unitLabel = $unit ? ($unit->name ?: $unit->symbol) : 'satuan';
                    throw ValidationException::withMessages([
                        'items' => "Stok {$product->title} tidak mencukupi untuk pemesanan {$qty} {$unitLabel} (tersedia {$branchStock} unit dasar).",
                    ]);
                }

                $pricing = $pricingBadges->get($product->id);
                $originalProductPrice = (int) $product->sell_price;
                $finalProductPrice = (int) ($pricing['final_price'] ?? $originalProductPrice);

                $unitSellPrice = $unit
                    ? $this->unitConversionService->getSellPrice($product, $unit->id)
                    : $originalProductPrice;

                if ($originalProductPrice > 0 && $finalProductPrice < $originalProductPrice) {
                    $discountRate = ($originalProductPrice - $finalProductPrice) / $originalProductPrice;
                    $unitPrice = (int) round($unitSellPrice * (1 - $discountRate));
                } else {
                    $unitPrice = $unitSellPrice;
                }

                $itemSubtotal = $unitPrice * $qty;
                $subtotal += $itemSubtotal;

                $orderItems[] = [
                    'product_id' => $product->id,
                    'product_title' => $product->title,
                    'unit_id' => $unit?->id,
                    'conversion_factor' => $conversionFactor,
                    'qty' => $qty,
                    'price' => $unitPrice,
                    'subtotal' => $itemSubtotal,
                    'note' => $item['note'] ?? null,
                ];
            }

            if (empty($orderItems)) {
                throw ValidationException::withMessages([
                    'items' => 'Tidak ada item valid dalam pesanan.',
                ]);
            }

            // Calculate coupon discount if coupon_code is provided
            $couponCode = trim((string) ($data['coupon_code'] ?? ''));
            $discountAmount = 0;
            $appliedVoucher = null;

            if (! empty($couponCode)) {
                $voucher = CustomerVoucher::where('code', $couponCode)
                    ->orWhereRaw('UPPER(code) = ?', [strtoupper($couponCode)])
                    ->first();

                if ($voucher) {
                    $now = now();
                    $isTimeValid = (! $voucher->starts_at || $voucher->starts_at->lte($now)) &&
                                   (! $voucher->expires_at || $voucher->expires_at->gte($now));
                    $isQuotaValid = $voucher->usage_limit === null || $voucher->times_used < $voucher->usage_limit;
                    $isNotUsed = ! $voucher->is_used;
                    $isMinOrderMet = $subtotal >= (int) $voucher->minimum_order;

                    if ($voucher->is_active && $isTimeValid && $isQuotaValid && $isNotUsed && $isMinOrderMet) {
                        $canApply = true;
                        if ($voucher->customer_id) {
                            $phone = trim((string) ($data['customer_phone'] ?? ''));
                            $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
                            $custPhone = preg_replace('/[^0-9]/', '', (string) $voucher->customer?->no_telp);
                            if (empty($cleanPhone) || empty($custPhone) || (
                                ! str_ends_with($cleanPhone, substr($custPhone, -8)) &&
                                ! str_ends_with($custPhone, substr($cleanPhone, -8))
                            )) {
                                $canApply = false;
                            }
                        }

                        if ($canApply) {
                            $discountAmount = $voucher->calculateDiscount($subtotal);
                            $appliedVoucher = $voucher;
                        }
                    }
                }
            }

            $shippingCost = (int) ($data['shipping_cost'] ?? 0);
            $grandTotal = max(0, $subtotal - $discountAmount) + $shippingCost;

            $customer = $this->findOrCreateCustomer(
                $data['customer_name'],
                $data['customer_phone'] ?? null,
                $data['delivery_address'] ?? null
            );
            $customerId = $customer?->id ?? ($data['customer_id'] ?? null);

            $order = CatalogOrder::create([
                'warehouse_id' => $warehouseId,
                'customer_id' => $customerId,
                'customer_name' => $this->sanitizePlainText($data['customer_name']),
                'customer_phone' => $this->sanitizePlainText($data['customer_phone'] ?? ''),
                'delivery_method' => $data['delivery_method'] ?? CatalogOrder::DELIVERY_PICKUP,
                'delivery_address' => $data['delivery_method'] === CatalogOrder::DELIVERY_SHIPPING ? $this->sanitizePlainText($data['delivery_address'] ?? '') : null,
                'shipping_courier' => ! empty($data['shipping_courier']) ? $this->sanitizePlainText($data['shipping_courier']) : null,
                'shipping_service' => ! empty($data['shipping_service']) ? $this->sanitizePlainText($data['shipping_service']) : null,
                'shipping_etd' => ! empty($data['shipping_etd']) ? $this->sanitizePlainText($data['shipping_etd']) : null,
                'shipping_weight' => isset($data['shipping_weight']) ? (int) $data['shipping_weight'] : null,
                'shipping_destination_id' => isset($data['shipping_destination_id']) ? (int) $data['shipping_destination_id'] : null,
                'shipping_destination_label' => ! empty($data['shipping_destination_label']) ? $this->sanitizePlainText($data['shipping_destination_label']) : null,
                'notes' => $this->sanitizePlainText($data['notes'] ?? ''),
                'subtotal' => $subtotal,
                'customer_voucher_id' => $appliedVoucher?->id,
                'coupon_code' => $appliedVoucher?->code ?? (! empty($couponCode) && $discountAmount > 0 ? strtoupper((string) $this->sanitizePlainText($couponCode)) : null),
                'discount_amount' => $discountAmount,
                'shipping_cost' => $shippingCost,
                'grand_total' => $grandTotal,
                'payment_method' => $data['payment_method'] ?? 'bank_transfer',
                'bank_account_id' => ! empty($data['bank_account_id']) ? (int) $data['bank_account_id'] : null,
                'payment_proof' => $data['payment_proof'] ?? null,
                'payment_proof_uploaded_at' => $data['payment_proof_uploaded_at'] ?? (! empty($data['payment_proof']) ? now() : null),
                'status' => CatalogOrder::STATUS_SUBMITTED,
            ]);

            foreach ($orderItems as $item) {
                if (isset($item['note'])) {
                    $item['note'] = $this->sanitizePlainText($item['note']);
                }
                $order->items()->create($item);
            }

            if ($appliedVoucher) {
                $appliedVoucher->increment('times_used');
                if ($appliedVoucher->customer_id) {
                    $appliedVoucher->update([
                        'is_used' => true,
                        'used_at' => now(),
                    ]);
                }
            }

            $this->auditLogService->log(
                event: 'catalog_order.created',
                module: 'catalog',
                auditable: $order,
                description: "Pesanan online baru {$order->order_number} dibuat oleh {$order->customer_name}",
            );

            return $order->load(['items.product', 'warehouse', 'bankAccount', 'customerVoucher']);
        });
    }

    /**
     * Update payment proof for an existing order
     */
    public function updatePaymentProof(CatalogOrder $order, string $filePath, ?int $bankAccountId = null): CatalogOrder
    {
        $oldPath = $order->payment_proof;
        $disk = config('filesystems.payment_proof_disk', 'local');

        // Best practice e-commerce: Hapus file lama jika customer mengunggah ulang bukti transfer
        if ($oldPath && $oldPath !== $filePath) {
            if (Storage::disk($disk)->exists($oldPath)) {
                Storage::disk($disk)->delete($oldPath);
            } elseif (Storage::disk('public')->exists($oldPath)) {
                Storage::disk('public')->delete($oldPath);
            }
        }

        $order->update([
            'payment_proof' => $filePath,
            'payment_proof_uploaded_at' => now(),
            'bank_account_id' => $bankAccountId ?: $order->bank_account_id,
        ]);

        $this->auditLogService->log(
            event: 'catalog_order.payment_proof_uploaded',
            module: 'catalog',
            auditable: $order,
            description: "Bukti transfer diunggah untuk pesanan {$order->order_number}",
        );

        return $order->load(['items.product', 'warehouse', 'bankAccount']);
    }

    /**
     * Confirm/accept an order and deduct warehouse stock
     */
    public function confirmOrder(CatalogOrder $order, int $userId): void
    {
        if ($order->status !== CatalogOrder::STATUS_SUBMITTED) {
            throw new \RuntimeException('Hanya pesanan berstatus Menunggu yang dapat dikonfirmasi.');
        }

        DB::transaction(function () use ($order, $userId) {
            $warehouseId = $order->warehouse_id;

            foreach ($order->items as $item) {
                $product = $item->product;
                if (! $product) {
                    continue;
                }

                $factor = (float) ($item->conversion_factor ?: 1);
                $qtyOut = (int) round($item->qty * $factor);
                if ($qtyOut <= 0) {
                    $qtyOut = 1;
                }

                $pw = ProductWarehouse::where('product_id', $product->id)
                    ->where('warehouse_id', $warehouseId)
                    ->lockForUpdate()
                    ->first();

                $stockBefore = (int) ($pw?->stock ?? 0);
                $stockAfter = $stockBefore - $qtyOut;

                if ($pw) {
                    $pw->decrement('stock', $qtyOut);
                }

                $this->stockMutationService->recordCatalogOrderOut(
                    product: $product,
                    order: $order,
                    qty: $qtyOut,
                    stockBefore: $stockBefore,
                    stockAfter: $stockAfter,
                    warehouseId: $warehouseId,
                    notes: "Pesanan online {$order->order_number} ({$order->customer_name})",
                    userId: $userId
                );
            }

            $customerId = $order->customer_id;
            if (! $customerId && ! empty($order->customer_name)) {
                $customer = $this->findOrCreateCustomer(
                    $order->customer_name,
                    $order->customer_phone,
                    $order->delivery_address
                );
                $customerId = $customer?->id;
            }

            $order->update([
                'status' => CatalogOrder::STATUS_CONFIRMED,
                'customer_id' => $customerId,
                'cashier_id' => $userId,
                'confirmed_at' => now(),
            ]);

            $this->auditLogService->log(
                event: 'catalog_order.confirmed',
                module: 'catalog',
                auditable: $order,
                description: "Pesanan online {$order->order_number} dikonfirmasi oleh pengguna #{$userId}",
            );
        });
    }

    /**
     * Update order status
     */
    public function updateStatus(CatalogOrder $order, string $status, ?string $reason = null, ?int $userId = null): void
    {
        if ($status === CatalogOrder::STATUS_CONFIRMED) {
            $this->confirmOrder($order, $userId ?? auth()->id() ?? 1);

            return;
        }

        if ($status === CatalogOrder::STATUS_CANCELLED) {
            $this->cancelOrder($order, $reason ?? 'Dibatalkan oleh staf', $userId);

            return;
        }

        if ($status === CatalogOrder::STATUS_COMPLETED && ! $order->transaction_id) {
            throw new \RuntimeException('Pesanan online hanya dapat diselesaikan melalui transaksi kasir POS.');
        }

        $updates = ['status' => $status];
        if ($status === CatalogOrder::STATUS_COMPLETED) {
            $updates['completed_at'] = now();

            // Clear any held cart in POS for this order
            Cart::where('hold_id', 'CATALOG-'.$order->order_number)
                ->orWhere('catalog_order_id', $order->id)
                ->delete();
        }

        $order->update($updates);

        $this->auditLogService->log(
            event: 'catalog_order.status_updated',
            module: 'catalog',
            auditable: $order,
            description: "Status pesanan online {$order->order_number} diubah menjadi {$status}",
        );
    }

    /**
     * Cancel an order and restore stock if it was previously confirmed
     */
    public function cancelOrder(CatalogOrder $order, string $reason, ?int $userId = null): void
    {
        if ($order->status === CatalogOrder::STATUS_CANCELLED) {
            return;
        }

        DB::transaction(function () use ($order, $reason, $userId) {
            $wasDeducted = in_array($order->status, [
                CatalogOrder::STATUS_CONFIRMED,
                CatalogOrder::STATUS_PROCESSING,
                CatalogOrder::STATUS_READY,
            ]);

            if ($wasDeducted) {
                $warehouseId = $order->warehouse_id;

                foreach ($order->items as $item) {
                    $product = $item->product;
                    if (! $product) {
                        continue;
                    }

                    $factor = (float) ($item->conversion_factor ?: 1);
                    $qtyIn = (int) round($item->qty * $factor);
                    if ($qtyIn <= 0) {
                        $qtyIn = 1;
                    }

                    $pw = ProductWarehouse::where('product_id', $product->id)
                        ->where('warehouse_id', $warehouseId)
                        ->lockForUpdate()
                        ->first();

                    $stockBefore = (int) ($pw?->stock ?? 0);
                    $stockAfter = $stockBefore + $qtyIn;

                    if ($pw) {
                        $pw->increment('stock', $qtyIn);
                    }

                    $this->stockMutationService->recordCatalogOrderRestore(
                        product: $product,
                        order: $order,
                        qty: $qtyIn,
                        stockBefore: $stockBefore,
                        stockAfter: $stockAfter,
                        warehouseId: $warehouseId,
                        notes: "Pengembalian stok pesanan online dibatalkan {$order->order_number}: {$reason}",
                        userId: $userId
                    );
                }
            }

            // Clear any held cart in POS for this order
            Cart::where('hold_id', 'CATALOG-'.$order->order_number)
                ->orWhere('catalog_order_id', $order->id)
                ->delete();

            // Restore coupon usage if order had a coupon
            if ($order->customer_voucher_id) {
                $voucher = CustomerVoucher::find($order->customer_voucher_id);
                if ($voucher) {
                    if ($voucher->times_used > 0) {
                        $voucher->decrement('times_used');
                    }
                    if ($voucher->customer_id) {
                        $voucher->update([
                            'is_used' => false,
                            'used_at' => null,
                        ]);
                    }
                }
            }

            $order->update([
                'status' => CatalogOrder::STATUS_CANCELLED,
                'cancellation_reason' => $reason,
                'cancelled_at' => now(),
            ]);

            $this->auditLogService->log(
                event: 'catalog_order.cancelled',
                module: 'catalog',
                auditable: $order,
                description: "Pesanan online {$order->order_number} dibatalkan: {$reason}",
            );
        });
    }

    /**
     * Load catalog order items into Cashier POS cart as a held basket
     */
    public function loadToPosCart(CatalogOrder $order, int $userId): string
    {
        return DB::transaction(function () use ($order, $userId) {
            $holdId = 'CATALOG-'.$order->order_number;
            $holdLabel = "Online: {$order->order_number} ({$order->customer_name})";

            // Clean any existing held items for this specific order
            Cart::where('cashier_id', $userId)
                ->where(function ($q) use ($holdId, $order) {
                    $q->where('hold_id', $holdId)
                        ->orWhere('catalog_order_id', $order->id);
                })
                ->delete();

            if (! $order->customer_id && ! empty($order->customer_name)) {
                $customer = $this->findOrCreateCustomer(
                    $order->customer_name,
                    $order->customer_phone,
                    $order->delivery_address
                );
                if ($customer) {
                    $order->update(['customer_id' => $customer->id]);
                    $order->setRelation('customer', $customer);
                }
            }

            foreach ($order->items as $item) {
                Cart::create([
                    'cashier_id' => $userId,
                    'warehouse_id' => $order->warehouse_id,
                    'product_id' => $item->product_id,
                    'unit_id' => $item->unit_id,
                    'conversion_factor' => $item->conversion_factor ?: 1,
                    'qty' => $item->qty,
                    'price' => $item->subtotal,
                    'hold_id' => $holdId,
                    'hold_label' => $holdLabel,
                    'held_at' => now(),
                    'catalog_order_id' => $order->id,
                ]);
            }

            return $holdId;
        });
    }

    /**
     * Find existing customer by phone or name, or register a new customer in CRM
     */
    public function findOrCreateCustomer(string $name, ?string $phone, ?string $address = null): ?Customer
    {
        $cleanPhone = preg_replace('/[^0-9]/', '', (string) $phone);
        $trimmedName = $this->sanitizePlainText($name) ?: '';

        if (! $cleanPhone && empty($trimmedName)) {
            return null;
        }

        $formattedPhone = $cleanPhone;
        if ($formattedPhone && str_starts_with($formattedPhone, '0')) {
            $formattedPhone = '62'.substr($formattedPhone, 1);
        } elseif ($formattedPhone && str_starts_with($formattedPhone, '8')) {
            $formattedPhone = '62'.$formattedPhone;
        }

        $localPhone = ($formattedPhone && str_starts_with($formattedPhone, '62')) ? '0'.substr($formattedPhone, 2) : $cleanPhone;

        $phoneVariations = array_unique(array_filter([$formattedPhone, $localPhone, $cleanPhone]));

        $customer = null;
        if (! empty($phoneVariations)) {
            $customer = Customer::whereIn('no_telp', $phoneVariations)->first();
        }

        if (! $customer && ! empty($trimmedName)) {
            $customer = Customer::where('name', $trimmedName)->first();
        }

        if ($customer) {
            // Update address if missing on existing customer
            $cleanAddress = $this->sanitizePlainText($address);
            if ((empty($customer->address) || $customer->address === '-') && ! empty($cleanAddress)) {
                $customer->update(['address' => $cleanAddress]);
            }

            return $customer;
        }

        return Customer::create([
            'name' => $trimmedName ?: 'Pelanggan Online',
            'no_telp' => (int) ($formattedPhone ?: ($cleanPhone ?: 0)),
            'address' => $this->sanitizePlainText($address) ?: '-',
        ]);
    }

    /**
     * Sanitize user text input by stripping tags, scripts, styles, control characters, and null bytes
     */
    public function sanitizePlainText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        // Strip script, style, and iframe blocks completely including inner content
        $cleaned = preg_replace('#<script\b[^>]*>(.*?)</script>#is', '', $value);
        $cleaned = preg_replace('#<style\b[^>]*>(.*?)</style>#is', '', (string) $cleaned);
        $cleaned = preg_replace('#<iframe\b[^>]*>(.*?)</iframe>#is', '', (string) $cleaned);

        // Strip any remaining HTML tags
        $cleaned = strip_tags((string) $cleaned);

        // Normalize multiple spaces/newlines and strip null bytes
        $cleaned = str_replace("\0", '', (string) $cleaned);
        $cleaned = preg_replace("/[\r\n]{3,}/", "\n\n", (string) $cleaned);

        return trim((string) $cleaned);
    }
}
