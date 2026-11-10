import React from "react";
import {
    IconX,
    IconTrash,
    IconPlus,
    IconMinus,
    IconShoppingCart,
    IconArrowRight,
    IconPhotoOff,
} from "@tabler/icons-react";
import { formatRupiah } from "@/Utils/whatsappOrder";

export default function CatalogCartTray({
    isOpen = false,
    onClose = () => {},
    cart = [],
    onUpdateQty = () => {},
    onRemoveItem = () => {},
    onClearCart = () => {},
    onProceedToCheckout = () => {},
    isStoreOpen = true,
}) {
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => {
        const p = item.final_price || item.sell_price || 0;
        return sum + p * item.qty;
    }, 0);

    return (
        <div className={`fixed inset-0 z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${
                    isOpen ? "opacity-100" : "opacity-0"
                }`}
                onClick={onClose}
            />

            {/* Slide-over Panel from Right */}
            <div
                className={`fixed inset-y-0 right-0 max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-in-out border-l border-karima-brand/10 dark:border-stone-800 ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-karima-brand/10 dark:border-stone-800 flex items-center justify-between">
                    <div>
                        <h2 className="font-serif text-2xl text-karima-brand dark:text-stone-100 font-medium tracking-tight">
                            Keranjang Belanja
                        </h2>
                        <p className="text-xxs uppercase tracking-[0.25em] text-karima-accent dark:text-stone-400 font-medium mt-0.5">
                            {totalItems} {totalItems === 1 ? "Item" : "Items"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-karima-ink/40 hover:text-karima-brand dark:hover:text-white transition-colors cursor-pointer"
                    >
                        <IconX size={22} />
                    </button>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20 text-stone-400">
                            <IconShoppingCart size={48} strokeWidth={1.5} className="mb-3 opacity-40" />
                            <p className="font-serif text-xl text-karima-brand/60 dark:text-stone-400">
                                Keranjang Anda masih kosong
                            </p>
                            <p className="text-xxs uppercase tracking-wider text-stone-400 mt-1">
                                Temukan busana dan koleksi pilihan Anda
                            </p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-6 px-6 py-2.5 border border-karima-brand/30 text-karima-brand dark:text-stone-200 text-xxs uppercase tracking-[0.2em] font-semibold rounded hover:bg-karima-base/30 transition-all cursor-pointer"
                            >
                                Mulai Belanja
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-karima-brand/10 dark:divide-stone-800">
                            {cart.map((item) => {
                                const price = item.final_price || item.sell_price || 0;
                                const originalPrice = item.sell_price || price;
                                const hasDiscount = originalPrice > price;

                                return (
                                    <div key={item.cart_key || item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                                        {/* Thumbnail */}
                                        <div className="w-20 aspect-[2/3] bg-stone-100 dark:bg-slate-800 rounded overflow-hidden shrink-0 border border-karima-brand/10 dark:border-stone-800 flex items-center justify-center">
                                            {item.image ? (
                                                <img
                                                    src={item.image}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover object-top"
                                                />
                                            ) : (
                                                <IconPhotoOff size={22} className="text-stone-400" />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 flex flex-col justify-between min-w-0">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="font-serif text-sm font-medium text-karima-brand dark:text-stone-100 line-clamp-2">
                                                        {item.title}
                                                    </h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemoveItem(item.cart_key || item.id)}
                                                        className="text-stone-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                                                        title="Hapus dari keranjang"
                                                    >
                                                        <IconTrash size={16} />
                                                    </button>
                                                </div>

                                                {/* Variant or UOM detail */}
                                                <div className="flex flex-wrap gap-1.5 mt-1 text-xxs uppercase tracking-wider text-karima-ink/50 dark:text-stone-400">
                                                    {item.unit_name && (
                                                        <span>Kemasan: {item.unit_name}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Price and Stepper Row */}
                                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-karima-brand/5 dark:border-stone-800/60">
                                                <div>
                                                    <div className="font-serif text-sm font-bold text-karima-brand dark:text-stone-100">
                                                        {formatRupiah(price)}
                                                    </div>
                                                    {hasDiscount && (
                                                        <div className="text-[10px] text-stone-400 line-through">
                                                            {formatRupiah(originalPrice)}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Stepper */}
                                                <div className="flex items-center border border-karima-brand/20 dark:border-stone-700 rounded bg-stone-50 dark:bg-slate-800 h-7">
                                                    <button
                                                        type="button"
                                                        onClick={() => onUpdateQty(item.cart_key || item.id, item.qty - 1)}
                                                        className="w-7 h-full flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-karima-brand cursor-pointer"
                                                    >
                                                        <IconMinus size={12} />
                                                    </button>
                                                    <span className="w-7 text-center font-serif text-xs font-bold text-karima-brand dark:text-white">
                                                        {item.qty}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => onUpdateQty(item.cart_key || item.id, item.qty + 1)}
                                                        className="w-7 h-full flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-karima-brand cursor-pointer"
                                                    >
                                                        <IconPlus size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer / Subtotal & Checkout */}
                {cart.length > 0 && (
                    <div className="p-5 sm:p-6 border-t border-karima-brand/10 dark:border-stone-800 bg-karima-base/20 dark:bg-slate-950/60 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xxs uppercase tracking-[0.25em] text-karima-ink/60 dark:text-stone-400 font-semibold">
                                Subtotal
                            </span>
                            <span className="font-serif text-xl font-bold text-karima-brand dark:text-stone-100">
                                {formatRupiah(subtotal)}
                            </span>
                        </div>
                        <p className="text-[11px] text-karima-ink/40 dark:text-stone-500">
                            Biaya pengiriman dan metode pembayaran dipilih pada tahap berikutnya.
                        </p>

                        <div className="pt-2 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClearCart}
                                className="px-3 py-3 text-stone-400 hover:text-rose-600 text-xxs uppercase tracking-wider font-semibold rounded hover:bg-black/5 transition-colors cursor-pointer"
                                title="Kosongkan keranjang"
                            >
                                Kosongkan
                            </button>
                            <button
                                type="button"
                                disabled={!isStoreOpen}
                                onClick={() => {
                                    onClose();
                                    onProceedToCheckout();
                                }}
                                className={`flex-1 py-3.5 px-6 rounded flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-xs font-semibold shadow-sm transition-all ${
                                    !isStoreOpen
                                        ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                                        : "bg-karima-brand hover:bg-karima-accent text-white cursor-pointer active:scale-[0.99]"
                                }`}
                            >
                                <span>Lanjut ke Pemesanan</span>
                                <IconArrowRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

