import React, { useState } from "react";
import { Link } from "@inertiajs/react";
import {
    IconX,
    IconHeart,
    IconTrash,
    IconShoppingCart,
    IconPhotoOff,
    IconSparkles,
    IconArrowRight,
    IconCheck,
} from "@tabler/icons-react";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import { formatRupiah } from "@/Utils/whatsappOrder";

export default function CatalogWishlistDrawer({
    isOpen = false,
    onClose = () => {},
    wishlist = [],
    onRemoveItem = () => {},
    onClearWishlist = () => {},
    onAddToCart = () => {},
    onSelectProduct = () => {},
    isStoreOpen = true,
}) {
    const [isMovingAll, setIsMovingAll] = useState(false);

    const handleClearAll = () => {
        if (!wishlist.length) return;
        Swal.fire({
            title: "Kosongkan Wishlist?",
            text: "Semua produk favorit yang tersimpan akan dihapus dari daftar.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Kosongkan",
            cancelButtonText: "Batal",
            customClass: {
                confirmButton:
                    "px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-sm transition-colors",
                cancelButton:
                    "px-4 py-2 bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-300 font-medium rounded-lg text-sm mr-2 transition-colors",
            },
            buttonsStyling: false,
        }).then((result) => {
            if (result.isConfirmed) {
                onClearWishlist(true);
            }
        });
    };

    // Move all in-stock simple products to cart
    const handleMoveAvailableToCart = () => {
        if (!isStoreOpen) {
            toast.error("Maaf, toko sedang tutup saat ini.");
            return;
        }

        const eligibleItems = wishlist.filter(
            (item) => item.stock > 0 && !item.has_variants
        );

        if (eligibleItems.length === 0) {
            toast.error(
                "Tidak ada produk satuan tersedia untuk langsung ditambahkan. Silakan pilih varian atau periksa stok produk.",
                { duration: 4000 }
            );
            return;
        }

        setIsMovingAll(true);
        let addedCount = 0;

        eligibleItems.forEach((item) => {
            onAddToCart(item, 1, false);
            addedCount++;
        });

        setIsMovingAll(false);
        toast.success(
            `${addedCount} produk berhasil ditambahkan ke Keranjang Belanja!`,
            { id: "wishlist-move-all", icon: "🛍️", duration: 4000 }
        );
    };

    return (
        <div
            className={`fixed inset-0 z-50 ${
                isOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
            aria-labelledby="wishlist-drawer-title"
            role="dialog"
            aria-modal="true"
        >
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
                <div className="p-5 sm:p-6 border-b border-karima-brand/10 dark:border-stone-800 flex items-center justify-between bg-karima-base/20 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-500 shadow-xs">
                            <IconHeart size={20} fill="currentColor" />
                        </div>
                        <div>
                            <h2
                                id="wishlist-drawer-title"
                                className="font-serif text-2xl text-karima-brand dark:text-stone-100 font-medium tracking-tight"
                            >
                                Wishlist Saya
                            </h2>
                            <p className="text-xxs uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                                {wishlist.length} {wishlist.length === 1 ? "Item" : "Items"}{" "}
                                Tersimpan
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-karima-ink/40 hover:text-karima-brand dark:hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800"
                        title="Tutup Wishlist"
                        aria-label="Tutup"
                    >
                        <IconX size={22} />
                    </button>
                </div>

                {/* Wishlist Items List */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                    {wishlist.length === 0 ? (
                        /* Empty State */
                        <div className="h-full flex flex-col items-center justify-center text-center py-16 text-stone-400">
                            <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-400 mb-4 shadow-inner">
                                <IconHeart size={40} strokeWidth={1.5} />
                            </div>
                            <h3 className="font-serif text-xl text-karima-brand dark:text-stone-200 font-medium">
                                Wishlist Anda Masih Kosong
                            </h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 max-w-xs leading-relaxed">
                                Sentuh ikon hati pada produk kesukaan Anda untuk
                                menyimpannya di sini dan belanja dengan lebih mudah nanti.
                            </p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-6 px-6 py-2.5 border border-karima-brand text-karima-brand dark:text-stone-200 text-xxs uppercase tracking-[0.25em] font-semibold rounded hover:bg-karima-brand hover:text-white dark:hover:bg-stone-800 transition-all cursor-pointer shadow-xs"
                            >
                                Mulai Jelajahi Produk
                            </button>
                        </div>
                    ) : (
                        /* Populated Items */
                        <div className="divide-y divide-karima-brand/10 dark:divide-stone-800">
                            {wishlist.map((item) => {
                                const isSoldOut = Number(item.stock) <= 0;
                                const price = item.final_price || item.sell_price || 0;
                                const originalPrice = item.sell_price || price;
                                const hasDiscount =
                                    Boolean(item.has_discount) && originalPrice > price;

                                return (
                                    <div
                                        key={item.id}
                                        className="py-4 first:pt-0 last:pb-0 flex gap-4 group"
                                    >
                                        {/* Product Thumbnail */}
                                        <Link
                                            href={`/katalog/produk/${item.id}`}
                                            onClick={onClose}
                                            className="relative w-20 aspect-[2/3] bg-stone-100 dark:bg-slate-800 rounded overflow-hidden shrink-0 border border-karima-brand/10 dark:border-stone-800 block group-hover:shadow-md transition-shadow"
                                        >
                                            {item.image ? (
                                                <img
                                                    src={item.image}
                                                    alt={item.title}
                                                    className={`w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105 ${
                                                        isSoldOut ? "grayscale opacity-60" : ""
                                                    }`}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                                                    <IconPhotoOff size={22} />
                                                </div>
                                            )}

                                            {/* Sold Out badge on thumbnail */}
                                            {isSoldOut && (
                                                <div className="absolute inset-x-0 bottom-0 bg-stone-900/80 text-white text-[8px] font-bold text-center py-0.5 uppercase tracking-wider">
                                                    Habis
                                                </div>
                                            )}
                                        </Link>

                                        {/* Product Details & Actions */}
                                        <div className="flex-1 flex flex-col justify-between min-w-0">
                                            <div>
                                                {/* Category & Remove */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="text-[9px] uppercase tracking-wider text-karima-ink/50 dark:text-stone-400 font-medium">
                                                        {item.category_name || "Koleksi"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onRemoveItem(item.id, true, item.title)
                                                        }
                                                        className="text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 transition-colors cursor-pointer rounded"
                                                        title="Hapus dari wishlist"
                                                        aria-label="Hapus dari wishlist"
                                                    >
                                                        <IconTrash size={15} />
                                                    </button>
                                                </div>

                                                {/* Title */}
                                                <Link
                                                    href={`/katalog/produk/${item.id}`}
                                                    onClick={onClose}
                                                    className="font-serif text-sm font-medium text-karima-brand dark:text-stone-100 hover:text-karima-gold transition-colors line-clamp-2 leading-snug mt-0.5 block"
                                                >
                                                    {item.title}
                                                </Link>

                                                {/* Price Row */}
                                                <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                                                    <span className="text-xs sm:text-sm font-semibold text-karima-brand dark:text-stone-100">
                                                        {formatRupiah(price)}
                                                    </span>
                                                    {hasDiscount && (
                                                        <>
                                                            <span className="text-[10px] text-karima-ink/40 dark:text-stone-500 line-through">
                                                                {formatRupiah(originalPrice)}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400">
                                                                {item.discount_percentage}% OFF
                                                            </span>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Stock Indicator */}
                                                <div className="mt-1">
                                                    {isSoldOut ? (
                                                        <span className="inline-flex items-center text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                                            ● Stok Habis
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                            ● Tersedia ({item.stock} stok)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Button: Add to Cart or Select Variant */}
                                            <div className="mt-3 pt-2 flex items-center gap-2">
                                                {item.has_variants ? (
                                                    <button
                                                        type="button"
                                                        disabled={isSoldOut || !isStoreOpen}
                                                        onClick={() => onSelectProduct(item)}
                                                        className={`flex-1 py-1.5 px-3 rounded text-[11px] font-medium tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all ${
                                                            isSoldOut || !isStoreOpen
                                                                ? "bg-stone-100 dark:bg-stone-800 text-stone-400 cursor-not-allowed border border-stone-200 dark:border-stone-700"
                                                                : "bg-stone-100 dark:bg-slate-800 hover:bg-karima-brand hover:text-white text-karima-brand dark:text-stone-200 border border-karima-brand/20 dark:border-stone-700 cursor-pointer shadow-2xs"
                                                        }`}
                                                    >
                                                        <IconSparkles size={13} />
                                                        <span>Pilih Ukuran / Warna</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isSoldOut || !isStoreOpen}
                                                        onClick={() => {
                                                            onAddToCart(item, 1, true);
                                                        }}
                                                        className={`flex-1 py-1.5 px-3 rounded text-[11px] font-semibold tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all ${
                                                            isSoldOut || !isStoreOpen
                                                                ? "bg-stone-100 dark:bg-stone-800 text-stone-400 cursor-not-allowed border border-stone-200 dark:border-stone-700"
                                                                : "bg-karima-brand hover:bg-karima-accent text-white cursor-pointer shadow-xs active:scale-[0.98]"
                                                        }`}
                                                    >
                                                        <IconShoppingCart size={13} />
                                                        <span>
                                                            {isSoldOut ? "Habis" : "Tambah ke Bag"}
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {wishlist.length > 0 && (
                    <div className="p-4 sm:p-5 border-t border-karima-brand/10 dark:border-stone-800 bg-stone-50/70 dark:bg-slate-900/80 space-y-2.5">
                        {/* Quick Add Available Button */}
                        <button
                            type="button"
                            disabled={isMovingAll || !isStoreOpen}
                            onClick={handleMoveAvailableToCart}
                            className={`w-full py-2.5 px-4 rounded text-xs font-semibold tracking-[0.15em] uppercase flex items-center justify-center gap-2 transition-all ${
                                !isStoreOpen
                                    ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                                    : "bg-karima-brand hover:bg-karima-accent text-white shadow-sm cursor-pointer active:scale-[0.99]"
                            }`}
                        >
                            <IconShoppingCart size={15} />
                            <span>Pindahkan yang Tersedia ke Bag</span>
                        </button>

                        {/* Secondary Actions */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 text-xxs uppercase tracking-wider font-semibold cursor-pointer py-1"
                            >
                                <IconTrash size={13} />
                                <span>Kosongkan Wishlist</span>
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="text-karima-brand dark:text-stone-300 hover:underline inline-flex items-center gap-1 text-xxs uppercase tracking-wider font-semibold cursor-pointer py-1"
                            >
                                <span>Lanjut Belanja</span>
                                <IconArrowRight size={13} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

