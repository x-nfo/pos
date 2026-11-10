import React, { useState, useEffect, useMemo } from "react";
import {
    IconX,
    IconPhotoOff,
    IconPlus,
    IconMinus,
    IconRulerMeasure,
    IconShoppingCart,
    IconHeart,
    IconSparkles,
} from "@tabler/icons-react";
import { formatRupiah } from "@/Utils/whatsappOrder";
import SizeChartModal from "@/Components/Public/SizeChartModal";
import CatalogVariantColorSelector from "@/Components/Public/Catalog/CatalogVariantColorSelector";

const parseVariantAttrs = (variant) => {
    let attrs = variant?.variant_attributes;
    if (typeof attrs === "string") {
        try {
            attrs = JSON.parse(attrs);
        } catch (_) {
            attrs = {};
        }
    }
    return attrs && typeof attrs === "object" ? attrs : {};
};

const getVariantColor = (variant) => {
    const attrs = parseVariantAttrs(variant);
    return attrs.color_name || attrs.warna || "Default";
};

const getVariantColorHex = (variant) => {
    const attrs = parseVariantAttrs(variant);
    return attrs.color_hex || attrs.hex || "#1e293b";
};

const getVariantSize = (variant) => {
    const attrs = parseVariantAttrs(variant);
    return attrs.size || attrs.ukuran || "All";
};

export default function CatalogQuickViewModal({
    product = null,
    onClose = () => { },
    onAddToCart = () => { },
    isWishlisted = false,
    onToggleWishlist = () => { },
    isStoreOpen = true,
}) {
    if (!product) return null;

    const [modalQty, setModalQty] = useState(1);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [showSizeChart, setShowSizeChart] = useState(false);

    const hasVariants = Boolean(product.has_variants) && Array.isArray(product.variants) && product.variants.length > 0;
    const hasMultiUnits = Array.isArray(product.units) && product.units.length > 1;

    // Reset initial variant & unit when product opens
    useEffect(() => {
        const baseU = product.units?.find((u) => u.is_base) || product.units?.[0] || null;
        setSelectedUnit(baseU);

        if (hasVariants) {
            const initVar = product.variants.find((v) => v.stock > 0) || product.variants[0];
            setSelectedVariant(initVar);
            setModalQty(initVar && initVar.stock > 0 ? 1 : 0);
        } else {
            setSelectedVariant(null);
            const factor = Number(baseU?.conversion_factor) || 1;
            const maxUnitStock = factor > 0 ? Math.floor(product.stock / factor) : 0;
            setModalQty(product.stock <= 0 || maxUnitStock <= 0 ? 0 : 1);
        }
    }, [product, hasVariants]);

    // Color options
    const availableColors = useMemo(() => {
        if (!hasVariants) return [];
        const map = new Map();
        product.variants.forEach((v) => {
            const col = getVariantColor(v);
            const hex = getVariantColorHex(v);
            if (!map.has(col)) {
                map.set(col, { name: col, hex, image: v.image || null });
            } else if (!map.get(col).image && v.image) {
                map.set(col, { name: col, hex, image: v.image });
            }
        });
        return Array.from(map.values());
    }, [product, hasVariants]);

    const activeColor = selectedVariant ? getVariantColor(selectedVariant) : (availableColors[0]?.name || "");

    // Sizes for active color
    const availableSizesForColor = useMemo(() => {
        if (!hasVariants || !Array.isArray(product.variants)) return [];
        const sizeMap = new Map();
        product.variants
            .filter((v) => getVariantColor(v) === activeColor)
            .forEach((v) => {
                const sName = getVariantSize(v);
                if (!sizeMap.has(sName)) {
                    sizeMap.set(sName, { ...v, stock: Number(v.stock) || 0 });
                } else {
                    const existing = sizeMap.get(sName);
                    const mergedStock = (existing.stock || 0) + (Number(v.stock) || 0);
                    if ((existing.stock || 0) <= 0 && (Number(v.stock) || 0) > 0) {
                        sizeMap.set(sName, { ...v, stock: mergedStock });
                    } else {
                        existing.stock = mergedStock;
                    }
                }
            });
        return Array.from(sizeMap.values());
    }, [product, hasVariants, activeColor]);

    const handleSelectColor = (colorName) => {
        if (!hasVariants || !Array.isArray(product.variants)) return;
        const currentSize = getVariantSize(selectedVariant);
        const match =
            product.variants.find((v) => getVariantColor(v) === colorName && getVariantSize(v) === currentSize) ||
            product.variants.find((v) => getVariantColor(v) === colorName && v.stock > 0) ||
            product.variants.find((v) => getVariantColor(v) === colorName);
        setSelectedVariant(match || null);
        setModalQty(match && match.stock > 0 ? 1 : 0);
    };

    const handleSelectSizeVariant = (variant) => {
        setSelectedVariant(variant);
        setModalQty(variant && variant.stock > 0 ? 1 : 0);
    };

    // Active image (swaps with variant if available)
    const activeImage = useMemo(() => {
        if (hasVariants && selectedVariant?.image) return selectedVariant.image;
        if (hasVariants && activeColor && Array.isArray(product.variants)) {
            const match = product.variants.find((v) => getVariantColor(v) === activeColor && v.image);
            if (match?.image) return match.image;
        }
        return product.image;
    }, [hasVariants, selectedVariant, activeColor, product]);

    const activeUnit = selectedUnit || product.units?.find((u) => u.is_base) || product.units?.[0] || null;

    const unitPrice = useMemo(() => {
        if (hasVariants && selectedVariant) {
            return selectedVariant.final_price || selectedVariant.sell_price || 0;
        }
        return activeUnit?.final_price || activeUnit?.sell_price || product.final_price || product.sell_price || 0;
    }, [product, activeUnit, hasVariants, selectedVariant]);

    const originalPrice = useMemo(() => {
        if (hasVariants && selectedVariant) {
            return selectedVariant.sell_price || 0;
        }
        return activeUnit?.sell_price || product.sell_price || 0;
    }, [product, activeUnit, hasVariants, selectedVariant]);

    const maxStock = useMemo(() => {
        if (hasVariants) return selectedVariant?.stock || 0;
        const factor = Number(activeUnit?.conversion_factor) || 1;
        return factor > 0 ? Math.floor(product.stock / factor) : 0;
    }, [product, activeUnit, hasVariants, selectedVariant]);

    const isSoldOut = maxStock <= 0;

    const handleConfirmAdd = () => {
        if (isSoldOut || modalQty <= 0) return;
        const targetProduct = hasVariants && selectedVariant ? selectedVariant : product;
        onAddToCart(targetProduct, modalQty, true, activeUnit);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            {/* Modal Dialog */}
            <div className="relative bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-karima-brand/10 dark:border-stone-800 z-10 max-h-[90vh] overflow-y-auto">
                {/* Mobile Pull Handle */}
                <div className="w-10 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto -mt-1 mb-3 sm:hidden" />

                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-full text-karima-ink/40 hover:text-karima-brand dark:hover:text-white transition-colors cursor-pointer"
                >
                    <IconX size={20} />
                </button>

                {/* Main Product Image Container */}
                <div className="aspect-[4/3] sm:aspect-[16/10] w-full rounded-lg bg-stone-100 dark:bg-slate-800 overflow-hidden mb-4 relative flex items-center justify-center border border-karima-brand/5 dark:border-stone-800">
                    {activeImage ? (
                        <img
                            src={activeImage}
                            alt={product.title}
                            className={`w-full h-full object-cover object-top transition-all duration-300 ${isSoldOut ? "grayscale opacity-50 contrast-75" : ""
                                }`}
                        />
                    ) : (
                        <div className="flex flex-col items-center text-stone-400">
                            <IconPhotoOff size={36} />
                            <span className="text-xxs uppercase tracking-wider mt-1">Foto Belum Tersedia</span>
                        </div>
                    )}

                    {isSoldOut && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-black/60 flex items-center justify-center">
                            <span className="bg-karima-brand text-white font-bold text-xs uppercase tracking-widest px-4 py-1.5 shadow-md">
                                SOLD OUT
                            </span>
                        </div>
                    )}
                </div>

                {/* Meta & Title */}
                <div className="text-left">
                    {product.category_name && (
                        <p className="text-xxs uppercase tracking-[0.25em] text-karima-accent dark:text-stone-400 font-semibold mb-1">
                            {product.category_name}
                        </p>
                    )}
                    <h2 className="font-serif text-xl sm:text-2xl text-karima-brand dark:text-stone-100 font-medium leading-snug">
                        {product.title}
                    </h2>
                </div>

                {/* Price Display */}
                <div className="flex items-baseline gap-2.5 my-3">
                    <span className="font-serif text-xl sm:text-2xl font-bold text-karima-brand dark:text-stone-100">
                        {formatRupiah(unitPrice)}
                    </span>
                    {originalPrice > unitPrice && (
                        <>
                            <span className="text-xs text-karima-ink/40 dark:text-stone-500 line-through">
                                {formatRupiah(originalPrice)}
                            </span>
                            <span className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
                                -{Math.round(((originalPrice - unitPrice) / originalPrice) * 100)}%
                            </span>
                        </>
                    )}
                    {activeUnit && !hasVariants && (
                        <span className="text-xxs uppercase tracking-wider text-karima-ink/40 dark:text-stone-500">
                            / {activeUnit.name || activeUnit.code}
                        </span>
                    )}
                </div>

                {/* Stock info */}
                <div className="text-xxs uppercase tracking-wider text-karima-ink/60 dark:text-stone-400 pb-3 mb-3 border-b border-karima-brand/10 dark:border-stone-800 flex items-center justify-between">
                    <span>
                        Ketersediaan:{" "}
                        <strong className={isSoldOut ? "text-rose-600" : "text-karima-brand dark:text-stone-200"}>
                            {isSoldOut ? "Stok Habis" : `${maxStock} Tersedia`}
                        </strong>
                    </span>
                    {((hasVariants && selectedVariant?.sku) || product.sku) && (
                        <span>
                            SKU: <strong>{(hasVariants && selectedVariant?.sku) || product.sku}</strong>
                        </span>
                    )}
                </div>

                {/* Fashion Variants: Colors & Sizes */}
                {hasVariants && (
                    <div className="space-y-4 my-4 p-4 rounded-lg bg-karima-base/30 dark:bg-slate-800/40 border border-karima-brand/10 dark:border-stone-800">
                        {/* 1. Color Selector */}
                        {availableColors.length > 0 && (
                            <div>
                                <label className="text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400 mb-2 flex items-center justify-between">
                                    <span>Warna:</span>
                                    <span className="font-bold text-karima-brand dark:text-white capitalize">
                                        {activeColor}
                                    </span>
                                </label>
                                <CatalogVariantColorSelector
                                    availableColors={availableColors}
                                    activeColor={activeColor}
                                    onSelectColor={handleSelectColor}
                                    displayType={product?.variant_display_type || "color"}
                                    size="sm"
                                />
                            </div>
                        )}

                        {/* 2. Size Selector */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400 flex items-center gap-1.5">
                                    <span>Ukuran:</span>
                                    <span className="font-bold text-karima-brand dark:text-white">
                                        {selectedVariant ? getVariantSize(selectedVariant) : "-"}
                                    </span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowSizeChart(true)}
                                    className="text-xxs uppercase tracking-wider font-semibold text-karima-accent hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <IconRulerMeasure size={13} />
                                    <span>Panduan Ukuran</span>
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {availableSizesForColor.map((v) => {
                                    const sName = getVariantSize(v);
                                    const isSelected = selectedVariant && getVariantSize(selectedVariant) === sName;
                                    const sizeStock = Number(v.stock) || 0;
                                    const isOutOfStock = sizeStock <= 0;

                                    return (
                                        <button
                                            key={`${v.id}-${sName}`}
                                            type="button"
                                            disabled={isOutOfStock}
                                            onClick={() => handleSelectSizeVariant(v)}
                                            className={`min-w-10 px-3 py-1.5 rounded border text-xs font-semibold uppercase tracking-wider transition-all ${isOutOfStock
                                                    ? "border-stone-200 text-stone-300 dark:border-stone-800 dark:text-stone-600 line-through cursor-not-allowed"
                                                    : isSelected
                                                        ? "border-karima-brand bg-karima-brand text-white shadow-xs"
                                                        : "border-karima-brand/20 dark:border-stone-700 bg-white dark:bg-slate-900 text-karima-ink/70 dark:text-stone-300 hover:border-karima-brand"
                                                }`}
                                        >
                                            {sName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Multi-unit UOM selector */}
                {hasMultiUnits && !hasVariants && (
                    <div className="my-3">
                        <label className="text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400 mb-2 block">
                            Pilih Kemasan / Satuan:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {product.units.map((u) => {
                                const isSelected = activeUnit?.id === u.id;
                                return (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => setSelectedUnit(u)}
                                        className={`p-2.5 rounded border text-left transition-all ${isSelected
                                                ? "border-karima-brand bg-karima-base/40 text-karima-brand"
                                                : "border-stone-200 dark:border-stone-800 hover:border-karima-brand/40"
                                            }`}
                                    >
                                        <div className="text-xs font-bold">{u.name || u.code}</div>
                                        <div className="text-[11px] text-karima-accent font-serif font-medium">
                                            {formatRupiah(u.final_price || u.sell_price)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Description */}
                {product.description && (
                    <div className="my-3 text-xs text-karima-ink/70 dark:text-stone-400 leading-relaxed max-h-24 overflow-y-auto pr-1">
                        {product.description}
                    </div>
                )}

                {/* Quantity & Add to Cart Footer */}
                <div className="mt-5 pt-4 border-t border-karima-brand/10 dark:border-stone-800 flex items-center gap-3">
                    {/* Stepper */}
                    <div className="flex items-center border border-karima-brand/20 dark:border-stone-700 rounded h-11 bg-stone-50 dark:bg-slate-900">
                        <button
                            type="button"
                            disabled={modalQty <= 1 || isSoldOut}
                            onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                            className="w-10 h-full flex items-center justify-center text-karima-ink/60 hover:text-karima-brand disabled:opacity-30 cursor-pointer"
                        >
                            <IconMinus size={15} />
                        </button>
                        <span className="w-10 text-center font-serif font-bold text-sm text-karima-brand dark:text-stone-200">
                            {modalQty}
                        </span>
                        <button
                            type="button"
                            disabled={modalQty >= maxStock || isSoldOut}
                            onClick={() => setModalQty((q) => Math.min(maxStock, q + 1))}
                            className="w-10 h-full flex items-center justify-center text-karima-ink/60 hover:text-karima-brand disabled:opacity-30 cursor-pointer"
                        >
                            <IconPlus size={15} />
                        </button>
                    </div>

                    {/* Add to Bag Button */}
                    <button
                        type="button"
                        disabled={isSoldOut || !isStoreOpen}
                        onClick={handleConfirmAdd}
                        className={`flex-1 h-11 py-2.5 px-6 rounded flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-xs font-semibold shadow-xs transition-all ${isSoldOut || !isStoreOpen
                                ? "bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed shadow-none"
                                : "bg-karima-brand hover:bg-karima-accent text-white active:scale-[0.99] cursor-pointer"
                            }`}
                    >
                        <IconShoppingCart size={16} />
                        <span>{isSoldOut ? "Stok Habis" : "Tambah ke Keranjang"}</span>
                    </button>

                    {/* Wishlist Button */}
                    <button
                        type="button"
                        onClick={() => onToggleWishlist(product)}
                        className={`h-11 w-11 rounded border flex items-center justify-center transition-all cursor-pointer shrink-0 ${isWishlisted
                                ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                                : "border-karima-brand/20 dark:border-stone-700 hover:border-rose-400 text-stone-600 dark:text-stone-300 hover:text-rose-500 bg-white dark:bg-slate-900"
                            }`}
                        title={isWishlisted ? "Hapus dari Wishlist" : "Simpan ke Wishlist"}
                        aria-label="Wishlist"
                    >
                        <IconHeart size={18} fill={isWishlisted ? "currentColor" : "none"} />
                    </button>
                </div>
            </div>

            {/* Size Chart Modal */}
            <SizeChartModal
                isOpen={showSizeChart}
                onClose={() => setShowSizeChart(false)}
                sizeChart={product?.category?.size_chart || product?.size_chart || null}
                productTitle={product?.title || ""}
            />
        </div>
    );
}

