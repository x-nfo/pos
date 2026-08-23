import React, { useState } from "react";
import {
    IconShoppingCart,
    IconTrash,
    IconMinus,
    IconPlus,
    IconArrowLeft,
    IconTag,
    IconSparkles,
    IconCheck,
    IconChevronDown,
    IconChevronUp,
    IconReceipt,
    IconUser,
    IconPlus as IconAddCustomer,
} from "@tabler/icons-react";
import { getProductImageUrl } from "@/Utils/imageUrl";
import CustomerSelect, { WALK_IN_CUSTOMER } from "../CustomerSelect";
import HeldTransactions, { HoldButton } from "../HeldTransactions";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export default function MobileCartSheet({
    carts = [],
    pricingItemsByCartId = {},
    pricingPreview = {},
    customers = [],
    selectedCustomer = WALK_IN_CUSTOMER,
    onSelectCustomer,
    loyaltyTierOptions = [],
    heldCarts = [],
    onHoldCart,
    isHolding,
    onUpdateQty,
    onRemoveFromCart,
    discountInput,
    onDiscountChange,
    shippingInput,
    onShippingChange,
    redeemPointsInput,
    onRedeemPointsChange,
    selectedVoucherId,
    onVoucherChange,
    payLater,
    onPayLaterChange,
    dueDate,
    onDueDateChange,
    onProceedToPayment,
    onClose,
}) {
    const [showDiscounts, setShowDiscounts] = useState(false);
    const [editingQtyId, setEditingQtyId] = useState(null);
    const [tempQtyInput, setTempQtyInput] = useState("");

    const localCartsTotal = carts.reduce(
        (sum, item) => sum + Number(item.price || 0),
        0
    );

    const summary = pricingPreview?.summary || {};
    const baseSubtotal = Number(
        summary?.base_subtotal ?? summary?.subtotal ?? localCartsTotal
    );
    const promoDiscount = Number(
        summary?.promo_discount ?? summary?.promo_discount_total ?? 0
    );
    const voucherDiscount = Number(
        summary?.voucher_discount ?? summary?.voucher_discount_total ?? 0
    );
    const loyaltyDiscount = Number(
        summary?.loyalty_discount ?? summary?.loyalty_discount_total ?? 0
    );
    const discount = Number(
        discountInput || summary?.manual_discount_total || 0
    );
    const shipping = Number(
        shippingInput || summary?.shipping_cost || 0
    );
    const taxTotal = Number(summary?.tax_total ?? 0);
    const totalDiscount = promoDiscount + voucherDiscount + loyaltyDiscount + discount;
    const payable = Number(
        summary?.payable ??
            summary?.grand_total ??
            Math.max(
                0,
                baseSubtotal - totalDiscount + shipping + taxTotal
            )
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Cart Header */}
            <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 shadow-xs">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition-transform"
                    >
                        <IconArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            Keranjang Belanja
                        </h2>
                        <p className="text-[10px] text-slate-500 font-semibold">
                            {carts.length} jenis item
                        </p>
                    </div>
                </div>

                {carts.length > 0 && (
                    <HoldButton
                        hasItems={carts.length > 0}
                        onHold={onHoldCart}
                        isHolding={isHolding}
                    />
                )}
            </div>

            {/* Scrollable Items & Controls */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-24">
                {/* Customer Selector Card */}
                <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
                    <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                            Pelanggan
                        </span>
                    </div>
                    <CustomerSelect
                        customers={customers}
                        selected={selectedCustomer}
                        onSelect={onSelectCustomer}
                        placeholder="Cari atau pilih pelanggan..."
                        tierOptions={loyaltyTierOptions}
                    />
                </div>

                {/* Held Carts Notification */}
                {heldCarts.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-2xl border border-amber-200 dark:border-amber-900/50">
                        <HeldTransactions
                            heldCarts={heldCarts}
                            hasActiveCart={carts.length > 0}
                        />
                    </div>
                )}

                {/* Cart Items List */}
                {carts.length > 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                        {carts.map((item) => {
                            const pricingItem = pricingItemsByCartId[item.id];
                            const effectiveUnitPrice = Number(
                                pricingItem?.effective_unit_price ??
                                    item.product?.sell_price ??
                                    0
                            );
                            const effectiveLineTotal = Number(
                                pricingItem?.line_total ?? item.price ?? 0
                            );
                            const baseUnitPrice = Number(
                                pricingItem?.base_unit_price ??
                                    item.product?.sell_price ??
                                    0
                            );
                            const pricingRule = pricingItem?.pricing_rule;

                            return (
                                <div key={item.id} className="p-3">
                                    <div className="flex items-start gap-2.5">
                                        {/* Image */}
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-100 dark:border-slate-800">
                                            <img
                                                src={getProductImageUrl(
                                                    item.product?.image,
                                                    true
                                                )}
                                                alt={item.product?.title || "Produk"}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.src =
                                                        "/images/product-placeholder.svg";
                                                }}
                                            />
                                        </div>

                                        {/* Product Details */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight">
                                                {item.product?.title || "Produk"}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {pricingRule &&
                                                    effectiveUnitPrice < baseUnitPrice && (
                                                        <span className="text-[10px] text-slate-400 line-through">
                                                            {formatPrice(baseUnitPrice)}
                                                        </span>
                                                    )}
                                                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                                    {formatPrice(effectiveUnitPrice)}
                                                </span>
                                            </div>
                                            {pricingRule && (
                                                <span className="inline-block mt-0.5 text-[9px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1 py-0.2 rounded">
                                                    {pricingRule.name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Line Total */}
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs font-black text-slate-900 dark:text-white">
                                                {formatPrice(effectiveLineTotal)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Row: Stepper & Delete */}
                                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                                        <button
                                            type="button"
                                            onClick={() => onRemoveFromCart(item.id)}
                                            className="h-8 px-2 rounded-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-transform"
                                        >
                                            <IconTrash size={13} />
                                            <span>Hapus</span>
                                        </button>

                                        {/* Stepper with Direct Numeric Input */}
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200/80 dark:border-slate-700/80">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onUpdateQty(
                                                        item.id,
                                                        Math.max(1, item.qty - 1)
                                                    )
                                                }
                                                disabled={item.qty <= 1}
                                                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-center disabled:opacity-30 shadow-xs active:scale-90 transition-transform font-black"
                                            >
                                                <IconMinus size={14} />
                                            </button>

                                            {/* Direct Numeric Input (Opens Device Numpad) */}
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={
                                                    editingQtyId === item.id
                                                        ? tempQtyInput
                                                        : item.qty
                                                }
                                                onFocus={(e) => {
                                                    setEditingQtyId(item.id);
                                                    setTempQtyInput(String(item.qty));
                                                    e.target.select();
                                                }}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^\d]/g, "");
                                                    setTempQtyInput(val);
                                                }}
                                                onBlur={() => {
                                                    const finalVal = parseInt(tempQtyInput, 10);
                                                    if (!isNaN(finalVal) && finalVal >= 1) {
                                                        onUpdateQty(item.id, finalVal);
                                                    }
                                                    setEditingQtyId(null);
                                                    setTempQtyInput("");
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.target.blur();
                                                    }
                                                }}
                                                className="w-12 h-8 text-center text-xs font-black text-slate-900 dark:text-white bg-transparent border-0 focus:ring-1 focus:ring-primary-500 rounded-md p-0"
                                                title="Ketik jumlah langsung"
                                            />

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onUpdateQty(
                                                        item.id,
                                                        item.qty + 1
                                                    )
                                                }
                                                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-xs active:scale-90 transition-transform font-black"
                                            >
                                                <IconPlus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-xs">
                        <IconShoppingCart
                            size={44}
                            strokeWidth={1.5}
                            className="mx-auto text-slate-300 dark:text-slate-600 mb-2"
                        />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Keranjang Belanja Kosong
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            Pilih produk dari katalog kasir untuk memulai transaksi
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-3.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-transform"
                        >
                            + Tambah Produk
                        </button>
                    </div>
                )}

                {/* Collapsible Discounts & Extra Options */}
                {carts.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
                        <button
                            type="button"
                            onClick={() => setShowDiscounts(!showDiscounts)}
                            className="w-full p-3 flex items-center justify-between text-left active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <IconTag size={15} className="text-primary-500" />
                                <span>Diskon, Voucher & Ongkir</span>
                                {totalDiscount > 0 || shipping > 0 ? (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                ) : null}
                            </div>
                            {showDiscounts ? (
                                <IconChevronUp size={16} className="text-slate-400" />
                            ) : (
                                <IconChevronDown size={16} className="text-slate-400" />
                            )}
                        </button>

                        {showDiscounts && (
                            <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-2.5 mt-1">
                                {/* Loyalty Redeem Points */}
                                {selectedCustomer?.is_loyalty_member && (
                                    <div className="p-2.5 bg-primary-50 dark:bg-primary-950/40 rounded-xl border border-primary-200 dark:border-primary-800">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[11px] font-bold text-primary-700 dark:text-primary-300 flex items-center gap-1">
                                                <IconSparkles size={13} />
                                                Member Tier {selectedCustomer.loyalty_tier}
                                            </span>
                                            <span className="text-[10px] font-semibold text-primary-600 dark:text-primary-400">
                                                Saldo: {summary?.available_loyalty_points ?? 0} poin
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={redeemPointsInput}
                                            onChange={(e) =>
                                                onRedeemPointsChange(
                                                    e.target.value.replace(/[^\d]/g, "")
                                                )
                                            }
                                            placeholder={`Redeem maks ${summary?.available_loyalty_points ?? 0} poin`}
                                            className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                        />
                                    </div>
                                )}

                                {/* Customer Voucher */}
                                {selectedCustomer?.is_loyalty_member &&
                                    (pricingPreview?.eligible_vouchers || []).length > 0 && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                Voucher Pelanggan
                                            </label>
                                            <select
                                                value={selectedVoucherId}
                                                onChange={(e) => onVoucherChange(e.target.value)}
                                                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                            >
                                                <option value="">Tanpa voucher</option>
                                                {(pricingPreview?.eligible_vouchers || []).map((v) => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.code} - {v.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                {/* Manual Discount */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Diskon Manual (Rp)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                            Rp
                                        </span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={discountInput}
                                            onChange={(e) =>
                                                onDiscountChange(
                                                    e.target.value.replace(/[^\d]/g, "")
                                                )
                                            }
                                            placeholder="0"
                                            className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Shipping Cost */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Ongkos Kirim (Rp)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                            Rp
                                        </span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={shippingInput}
                                            onChange={(e) =>
                                                onShippingChange(
                                                    e.target.value.replace(/[^\d]/g, "")
                                                )
                                            }
                                            placeholder="0"
                                            className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Receipt Breakdown Card */}
                {carts.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-500">
                            <span>Subtotal Dasar</span>
                            <span className="font-semibold">{formatPrice(baseSubtotal)}</span>
                        </div>
                        {promoDiscount > 0 && (
                            <div className="flex justify-between text-emerald-600">
                                <span>Promo Otomatis</span>
                                <span className="font-semibold">-{formatPrice(promoDiscount)}</span>
                            </div>
                        )}
                        {voucherDiscount > 0 && (
                            <div className="flex justify-between text-primary-600">
                                <span>Voucher</span>
                                <span className="font-semibold">-{formatPrice(voucherDiscount)}</span>
                            </div>
                        )}
                        {loyaltyDiscount > 0 && (
                            <div className="flex justify-between text-primary-600">
                                <span>Redeem Poin</span>
                                <span className="font-semibold">-{formatPrice(loyaltyDiscount)}</span>
                            </div>
                        )}
                        {discount > 0 && (
                            <div className="flex justify-between text-rose-500">
                                <span>Diskon Manual</span>
                                <span className="font-semibold">-{formatPrice(discount)}</span>
                            </div>
                        )}
                        {shipping > 0 && (
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Ongkos Kirim</span>
                                <span className="font-semibold">+{formatPrice(shipping)}</span>
                            </div>
                        )}
                        {taxTotal > 0 && (
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>PPN</span>
                                <span className="font-semibold">+{formatPrice(taxTotal)}</span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline font-black text-sm text-slate-900 dark:text-white">
                            <span>Total Akhir</span>
                            <span className="text-base text-primary-600 dark:text-primary-400">
                                {formatPrice(payable)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Bottom Action */}
            {carts.length > 0 && (
                <div className="fixed bottom-0 inset-x-0 p-3 pb-safe bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 shadow-lg z-30">
                    <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-500 font-semibold uppercase">
                                Total Bayar
                            </p>
                            <p className="text-base font-black text-slate-900 dark:text-white truncate">
                                {formatPrice(payable)}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onProceedToPayment}
                            className="h-12 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                        >
                            <span>Bayar Sekarang</span>
                            <IconCheck size={18} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
