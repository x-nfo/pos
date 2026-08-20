import React, { useState } from "react";
import {
    IconShoppingBag,
    IconPhoto,
    IconCamera,
    IconX,
    IconSearch,
    IconPlus,
} from "@tabler/icons-react";
import { getProductImageUrl } from "@/Utils/imageUrl";
import BarcodeScanner from "../BarcodeScanner";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

function MobileProductCard({ product, onAddToCart, isAdding }) {
    const hasStock = product.stock > 0;
    const lowStock = product.stock > 0 && product.stock <= 5;
    const promoBadge = product.pricing_badge;
    const promoPrice = Number(promoBadge?.promo_price || 0);
    const basePrice = Number(promoBadge?.base_price || product.sell_price || 0);
    const showPromo = promoBadge && promoPrice > 0 && promoPrice < basePrice;
    const showBadge = Boolean(promoBadge?.label);

    return (
        <div
            onClick={() => hasStock && onAddToCart(product)}
            className={`
                group relative flex flex-col bg-white dark:bg-slate-900
                rounded-2xl border border-slate-200/80 dark:border-slate-800
                overflow-hidden transition-all duration-150 active:scale-[0.97] select-none
                ${
                    hasStock
                        ? "cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md"
                        : "opacity-55 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50"
                }
            `}
        >
            {/* Image & Badges */}
            <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <img
                    src={getProductImageUrl(product.image, true)}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                        e.currentTarget.src = "/images/product-placeholder.svg";
                    }}
                />

                {/* Promo Badge */}
                {showBadge && (
                    <span className="absolute top-1.5 left-1.5 max-w-[85%] truncate rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white shadow-sm">
                        {promoBadge.label}
                    </span>
                )}

                {/* Low Stock Badge */}
                {lowStock && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-500 text-white rounded-md shadow-sm">
                        Sisa {product.stock}
                    </span>
                )}

                {/* Out of stock overlay */}
                {!hasStock && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider rounded-md shadow">
                            Habis
                        </span>
                    </div>
                )}

                {/* Quick Add Button */}
                {hasStock && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(product);
                        }}
                        disabled={isAdding}
                        className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-lg bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                    >
                        {isAdding ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <IconPlus size={16} strokeWidth={2.5} />
                        )}
                    </button>
                )}
            </div>

            {/* Product Meta */}
            <div className="p-2.5 flex-1 flex flex-col justify-between">
                <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
                        {product.title}
                    </h3>
                    {product.barcode && (
                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                            {product.barcode}
                        </p>
                    )}
                </div>

                <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-baseline justify-between">
                    <div>
                        {showPromo && (
                            <p className="text-[10px] text-slate-400 line-through leading-none mb-0.5">
                                {formatPrice(basePrice)}
                            </p>
                        )}
                        <p className="text-xs font-black text-primary-600 dark:text-primary-400 leading-tight">
                            {formatPrice(showPromo ? promoPrice : product.sell_price)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MobileProductGrid({
    products = [],
    categories = [],
    selectedCategory,
    onCategoryChange,
    searchQuery,
    onSearchChange,
    onBarcodeScan,
    isSearching,
    onAddToCart,
    addingProductId,
    searchInputRef,
}) {
    const [showScanner, setShowScanner] = useState(false);

    const normalizedSelectedCategory =
        selectedCategory === null ? null : Number(selectedCategory);

    // Filter products
    const filteredProducts = products.filter((product) => {
        const matchesCategory =
            normalizedSelectedCategory === null ||
            Number(product.category_id) === normalizedSelectedCategory;
        const matchesSearch =
            !searchQuery ||
            product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
            {/* Search & Camera Scan Bar */}
            <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <IconSearch
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Cari produk / barcode..."
                            className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-xs focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            disabled={isSearching}
                        />
                        {searchQuery ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onSearchChange("");
                                    searchInputRef?.current?.focus();
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <IconX size={14} />
                            </button>
                        ) : null}
                    </div>

                    {/* Camera Scan Button */}
                    <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="h-10 px-3 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 flex items-center justify-center gap-1 active:scale-95 transition-transform flex-shrink-0 shadow-xs"
                        aria-label="Scan Barcode Kamera"
                    >
                        <IconCamera size={16} />
                        <span className="text-xs font-bold">Scan</span>
                    </button>
                </div>
            </div>

            {/* Category Chips Bar */}
            <div className="px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-hide flex-shrink-0">
                <div className="flex gap-1.5">
                    <button
                        type="button"
                        onClick={() => onCategoryChange(null)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                            normalizedSelectedCategory === null
                                ? "bg-primary-600 text-white shadow-xs"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750"
                        }`}
                    >
                        Semua ({products.length})
                    </button>
                    {categories.map((cat) => {
                        const isActive =
                            normalizedSelectedCategory === Number(cat.id);
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => onCategoryChange(Number(cat.id))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                                    isActive
                                        ? "bg-primary-600 text-white shadow-xs"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750"
                                }`}
                            >
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-3 pb-28">
                {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                        {filteredProducts.map((product) => (
                            <MobileProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={onAddToCart}
                                isAdding={addingProductId === product.id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                        <IconShoppingBag size={40} strokeWidth={1.5} className="mb-2 opacity-50" />
                        <p className="text-xs font-semibold">
                            {searchQuery ? "Produk tidak ditemukan" : "Tidak ada produk"}
                        </p>
                    </div>
                )}
            </div>

            {/* Fullscreen Camera Barcode Scanner */}
            {showScanner && (
                <BarcodeScanner
                    onScan={(barcode) => {
                        setShowScanner(false);
                        onBarcodeScan(barcode);
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}
