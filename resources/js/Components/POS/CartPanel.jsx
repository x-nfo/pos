import React, { useState } from "react";
import {
    IconTrash,
    IconMinus,
    IconPlus,
    IconShoppingCart,
} from "@tabler/icons-react";
import { getProductImageUrl } from "@/Utils/imageUrl";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

// Single Cart Item
function CartItem({ item, onUpdateQty, onRemove, isRemoving }) {
    const [editingQty, setEditingQty] = useState(false);
    const [tempQty, setTempQty] = useState("");

    // Note: item.price from backend is already the total (sell_price * qty)
    const quantity = Number(item.qty || 0);
    const itemPrice = Number(item.price || 0);
    const unitPrice =
        Number(item.product?.sell_price || 0) || itemPrice / quantity || 0;
    const subtotal = itemPrice; // Already calculated total from backend

    return (
        <div
            className={`
            group flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50
            border border-transparent hover:border-slate-200 dark:hover:border-slate-700
            transition-all duration-200 animate-slide-up
            ${isRemoving ? "opacity-50 scale-95" : ""}
        `}
        >
            {/* Product Image */}
            <div className="w-14 h-14 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                <img
                    src={getProductImageUrl(item.product?.image, true)}
                    alt={item.product?.title || "Produk"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        e.currentTarget.src = "/images/product-placeholder.svg";
                    }}
                />
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {item.product?.title || "Produk"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatPrice(unitPrice)} × {item.qty}
                </p>
                <p className="text-sm font-semibold text-primary-600 dark:text-primary-400 mt-1">
                    {formatPrice(subtotal)}
                </p>
            </div>

            {/* Quantity Controls */}
            <div className="flex flex-col items-end justify-between">
                {/* Remove Button */}
                <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    disabled={isRemoving}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/50 transition-colors opacity-0 group-hover:opacity-100"
                >
                    <IconTrash size={16} />
                </button>

                {/* Qty Stepper with Direct Keyboard Numeric Input */}
                <div className="flex items-center bg-slate-200/80 dark:bg-slate-700/80 rounded-lg p-0.5 border border-slate-300/80 dark:border-slate-600/80">
                    <button
                        type="button"
                        onClick={() =>
                            onUpdateQty(item.id, Math.max(1, item.qty - 1))
                        }
                        disabled={item.qty <= 1}
                        className="w-6 h-6 rounded-md bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-30 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-500 active:scale-95 transition-all"
                        title="Kurangi kuantitas"
                    >
                        <IconMinus size={12} strokeWidth={2.5} />
                    </button>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editingQty ? tempQty : item.qty}
                        onFocus={(e) => {
                            setEditingQty(true);
                            setTempQty(String(item.qty));
                            e.target.select();
                        }}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^\d]/g, "");
                            setTempQty(val);
                        }}
                        onBlur={() => {
                            const finalVal = parseInt(tempQty, 10);
                            if (!isNaN(finalVal) && finalVal >= 1) {
                                onUpdateQty(item.id, finalVal);
                            }
                            setEditingQty(false);
                            setTempQty("");
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.target.blur();
                            } else if (e.key === "Escape") {
                                setEditingQty(false);
                                setTempQty("");
                                e.target.blur();
                            }
                        }}
                        className="w-9 h-6 text-center text-xs font-bold text-slate-900 dark:text-white bg-transparent border-0 focus:ring-1 focus:ring-primary-500 rounded p-0"
                        title="Ketik jumlah langsung"
                    />
                    <button
                        type="button"
                        onClick={() => onUpdateQty(item.id, item.qty + 1)}
                        className="w-6 h-6 rounded-md bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs hover:bg-slate-50 dark:hover:bg-slate-500 active:scale-95 transition-all"
                        title="Tambah kuantitas"
                    >
                        <IconPlus size={12} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Empty Cart State
function EmptyCart() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <IconShoppingCart
                    size={32}
                    className="text-slate-400 dark:text-slate-600"
                />
            </div>
            <h3 className="text-base font-medium text-slate-600 dark:text-slate-400">
                Keranjang Kosong
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Klik produk untuk menambahkan
            </p>
        </div>
    );
}

// Main CartPanel Component
export default function CartPanel({
    items = [],
    onUpdateQty,
    onRemove,
    removingItemId,
    className = "",
}) {
    const totalItems = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    // Note: item.price from backend is already sell_price * qty
    const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0), 0);

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <IconShoppingCart
                        size={20}
                        className="text-slate-600 dark:text-slate-400"
                    />
                    <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                        Keranjang
                    </h2>
                </div>
                {totalItems > 0 && (
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 rounded-full">
                        {totalItems} item
                    </span>
                )}
            </div>

            {/* Cart Items */}
            {items.length > 0 ? (
                <div
                    className="flex-1 overflow-y-auto p-3 space-y-2"
                    style={{ maxHeight: "300px", minHeight: "150px" }}
                >
                    {items.map((item) => (
                        <CartItem
                            key={item.id}
                            item={item}
                            onUpdateQty={onUpdateQty}
                            onRemove={onRemove}
                            isRemoving={removingItemId === item.id}
                        />
                    ))}
                </div>
            ) : (
                <EmptyCart />
            )}

            {/* Subtotal */}
            {items.length > 0 && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            Subtotal
                        </span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatPrice(subtotal)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// Export sub-components
CartPanel.Item = CartItem;
CartPanel.Empty = EmptyCart;
