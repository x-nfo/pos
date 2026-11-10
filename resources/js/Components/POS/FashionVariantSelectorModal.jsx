import React, { useState, useEffect, useMemo } from "react";
import {
    IconX,
    IconColorSwatch,
    IconRulerMeasure,
    IconShoppingCartPlus,
    IconCheck,
} from "@tabler/icons-react";
import { getProductImageUrl } from "@/Utils/imageUrl";

export default function FashionVariantSelectorModal({
    isOpen = false,
    product = null,
    onClose = () => { },
    onSelectVariant = () => { },
    isAdding = false,
}) {
    const variants = product?.variants || [];

    // Distinct colors available in this product's variants
    const availableColors = useMemo(() => {
        const map = new Map();
        variants.forEach((v) => {
            const name = v.variant_attributes?.color_name || "Default";
            const hex = v.variant_attributes?.color_hex || "#111827";
            if (!map.has(name)) {
                map.set(name, { name, hex });
            }
        });
        return Array.from(map.values());
    }, [variants]);

    const [selectedColor, setSelectedColor] = useState(null);
    const [selectedSize, setSelectedSize] = useState(null);

    // Auto-select first color when opened
    useEffect(() => {
        if (isOpen && availableColors.length > 0) {
            setSelectedColor(availableColors[0].name);
            setSelectedSize(null);
        }
    }, [isOpen, product]);

    // Available sizes for currently selected color (Deduplicated by size)
    const availableSizesForColor = useMemo(() => {
        if (!selectedColor) return [];

        const sizeMap = new Map();
        variants
            .filter((v) => (v.variant_attributes?.color_name || "Default") === selectedColor)
            .forEach((v) => {
                const sName = v.variant_attributes?.size || "All Size";
                const vStock = Number(v.stock) || 0;
                const vPrice = Number(v.sell_price || product?.sell_price || 0);

                if (!sizeMap.has(sName)) {
                    sizeMap.set(sName, {
                        size: sName,
                        stock: vStock,
                        price: vPrice,
                        variant: v,
                    });
                } else {
                    const existing = sizeMap.get(sName);
                    existing.stock += vStock;
                    // Prefer variant with stock > 0 as active selection target
                    if ((existing.variant?.stock || 0) <= 0 && vStock > 0) {
                        existing.variant = v;
                        existing.price = vPrice;
                    }
                }
            });

        return Array.from(sizeMap.values());
    }, [selectedColor, variants, product]);

    // Current selected variant object
    const currentVariantItem = useMemo(() => {
        if (!selectedColor || !selectedSize) return null;
        return availableSizesForColor.find((s) => s.size === selectedSize)?.variant || null;
    }, [selectedColor, selectedSize, availableSizesForColor]);

    // Active image: Row-selected variant -> Color variant -> Master product
    const activeModalImage = useMemo(() => {
        if (currentVariantItem?.image) {
            return currentVariantItem.image;
        }
        if (selectedColor) {
            const colorVariant = variants.find(
                (v) => (v.variant_attributes?.color_name || "Default") === selectedColor && v.image
            );
            if (colorVariant?.image) return colorVariant.image;
        }
        return product?.image;
    }, [currentVariantItem, selectedColor, variants, product]);

    if (!isOpen || !product) return null;

    const formatPrice = (val = 0) =>
        Number(val).toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        });

    const handleConfirm = () => {
        if (!currentVariantItem) return;
        onSelectVariant(currentVariantItem);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700">
                            <img
                                src={getProductImageUrl(activeModalImage, true)}
                                alt={product.title}
                                className="w-full h-full object-cover transition-all duration-200"
                            />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                {product.title}
                            </h3>
                            <p className="text-xs text-primary-600 dark:text-primary-400 font-bold">
                                {formatPrice(currentVariantItem?.sell_price || product.sell_price)}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5 overflow-y-auto flex-1">
                    {/* 1. Pilih Warna */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                            <IconColorSwatch size={16} className="text-primary-500" />
                            Pilih Warna: <span className="text-primary-600 font-black">{selectedColor}</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {availableColors.map((c) => {
                                const isSelected = selectedColor === c.name;
                                const colorVariantImage = variants.find(
                                    (v) => (v.variant_attributes?.color_name || "Default") === c.name && v.image
                                )?.image;
                                return (
                                    <button
                                        key={c.name}
                                        type="button"
                                        onClick={() => {
                                            setSelectedColor(c.name);
                                            setSelectedSize(null);
                                        }}
                                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${isSelected
                                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md scale-105"
                                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                                            }`}
                                    >
                                        {colorVariantImage ? (
                                            <img
                                                src={getProductImageUrl(colorVariantImage)}
                                                alt={c.name}
                                                className="w-4 h-4 rounded-full object-cover border border-slate-300 flex-shrink-0"
                                            />
                                        ) : (
                                            <span
                                                className="w-3.5 h-3.5 rounded-full border border-slate-300 flex-shrink-0"
                                                style={{ backgroundColor: c.hex }}
                                            />
                                        )}
                                        {c.name}
                                        {isSelected && <IconCheck size={14} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Pilih Ukuran */}
                    <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                            <IconRulerMeasure size={16} className="text-primary-500" />
                            Pilih Ukuran (Size):{" "}
                            {selectedSize && <span className="text-primary-600 font-black">{selectedSize}</span>}
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                            {availableSizesForColor.map((s) => {
                                const isSelected = selectedSize === s.size;
                                const isOutOfStock = s.stock <= 0;
                                return (
                                    <button
                                        key={`${selectedColor}-${s.size}`}
                                        type="button"
                                        disabled={isOutOfStock}
                                        onClick={() => setSelectedSize(s.size)}
                                        className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl border transition-all ${isSelected
                                                ? "bg-primary-600 text-white border-primary-600 shadow-md scale-105"
                                                : isOutOfStock
                                                    ? "bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60"
                                                    : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-primary-400"
                                            }`}
                                    >
                                        <span className="text-sm font-black tracking-wide">{s.size}</span>
                                        <span
                                            className={`text-[10px] mt-0.5 font-medium ${isSelected
                                                    ? "text-primary-100"
                                                    : isOutOfStock
                                                        ? "text-rose-500 font-bold"
                                                        : "text-slate-400"
                                                }`}
                                        >
                                            {isOutOfStock ? "Habis" : `Sisa ${s.stock}`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Summary Barcode / SKU if selected */}
                    {currentVariantItem && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                            <div>
                                <span className="text-slate-400 block text-[10px]">Barcode Hangtag:</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                    {currentVariantItem.barcode}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-slate-400 block text-[10px]">Harga Varian:</span>
                                <span className="font-bold text-primary-600 dark:text-primary-400">
                                    {formatPrice(currentVariantItem.sell_price)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 px-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        disabled={!currentVariantItem || isAdding}
                        onClick={handleConfirm}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${currentVariantItem && !isAdding
                                ? "bg-primary-600 hover:bg-primary-700 text-white active:scale-95"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                            }`}
                    >
                        <IconShoppingCartPlus size={16} />
                        <span>Tambah ke Kasir</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
