import React from "react";
import { IconX, IconRotate } from "@tabler/icons-react";
import { formatRupiah } from "@/Utils/whatsappOrder";

export default function CatalogFilterDrawer({
    isOpen = false,
    onClose = () => {},
    categories = [],
    selectedCategoryId = "all",
    onSelectCategory = () => {},
    minPrice = 0,
    maxPrice = 5000000,
    priceLimit = 5000000,
    onPriceChange = () => {},
    availableColors = [],
    selectedColors = [],
    onToggleColor = () => {},
    inStockOnly = false,
    onToggleInStockOnly = () => {},
    onResetFilters = () => {},
    isDesktopSidebar = false,
}) {
    const content = (
        <div className="flex flex-col h-full space-y-8 p-6 lg:p-0">
            {/* Header for Mobile */}
            {!isDesktopSidebar && (
                <div className="flex items-center justify-between pb-4 border-b border-karima-brand/10 dark:border-stone-800">
                    <h3 className="font-serif text-xl text-karima-brand dark:text-stone-100 font-medium">
                        Filter Produk
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-karima-ink/40 hover:text-karima-brand dark:hover:text-white"
                    >
                        <IconX size={20} />
                    </button>
                </div>
            )}

            {/* 1. Kategori */}
            <div>
                <h4 className="font-serif text-base text-karima-brand dark:text-stone-100 mb-4 font-medium flex items-center justify-between">
                    <span>Kategori</span>
                    {selectedCategoryId !== "all" && (
                        <button
                            type="button"
                            onClick={() => onSelectCategory("all")}
                            className="text-xxs text-karima-accent hover:underline uppercase tracking-wider"
                        >
                            Reset
                        </button>
                    )}
                </h4>
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    <label
                        className="flex items-center justify-between cursor-pointer group py-1 text-xs"
                        onClick={() => onSelectCategory("all")}
                    >
                        <div className="flex items-center gap-2.5">
                            <div
                                className={`w-3.5 h-3.5 border flex items-center justify-center transition-all ${
                                    selectedCategoryId === "all"
                                        ? "bg-karima-brand border-karima-brand text-white"
                                        : "border-karima-brand/30 group-hover:border-karima-brand"
                                }`}
                            >
                                {selectedCategoryId === "all" && <div className="w-1.5 h-1.5 bg-white" />}
                            </div>
                            <span
                                className={`transition-colors uppercase tracking-wider text-[11px] ${
                                    selectedCategoryId === "all"
                                        ? "text-karima-brand dark:text-white font-bold"
                                        : "text-karima-ink/70 dark:text-stone-400 group-hover:text-karima-brand"
                                }`}
                            >
                                Semua Kategori
                            </span>
                        </div>
                    </label>

                    {categories.map((cat) => {
                        const isSelected = String(selectedCategoryId) === String(cat.id);
                        return (
                            <label
                                key={cat.id}
                                className="flex items-center justify-between cursor-pointer group py-1 text-xs"
                                onClick={() => onSelectCategory(cat.id)}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                        className={`w-3.5 h-3.5 border shrink-0 flex items-center justify-center transition-all ${
                                            isSelected
                                                ? "bg-karima-brand border-karima-brand text-white"
                                                : "border-karima-brand/30 group-hover:border-karima-brand"
                                        }`}
                                    >
                                        {isSelected && <div className="w-1.5 h-1.5 bg-white" />}
                                    </div>
                                    <span
                                        className={`truncate uppercase tracking-wider text-[11px] ${
                                            isSelected
                                                ? "text-karima-brand dark:text-white font-bold"
                                                : "text-karima-ink/70 dark:text-stone-400 group-hover:text-karima-brand"
                                        }`}
                                    >
                                        {cat.name}
                                    </span>
                                </div>
                                {cat.products_count !== undefined && (
                                    <span className="text-xxs text-karima-ink/40 dark:text-stone-500 font-mono">
                                        ({cat.products_count})
                                    </span>
                                )}
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* 2. Rentang Harga */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-serif text-base text-karima-brand dark:text-stone-100 font-medium">
                        Maksimal Harga
                    </h4>
                    <span className="text-xs font-serif font-bold text-karima-brand dark:text-stone-200">
                        {formatRupiah(maxPrice)}
                    </span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={priceLimit > 0 ? priceLimit : 5000000}
                    step={25000}
                    value={maxPrice}
                    onChange={(e) => onPriceChange(Number(e.target.value))}
                    className="w-full h-1 bg-karima-brand/10 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-karima-brand"
                />
                <div className="flex justify-between text-xxs text-karima-ink/40 dark:text-stone-500 font-mono mt-1">
                    <span>Rp 0</span>
                    <span>{formatRupiah(priceLimit)}</span>
                </div>
            </div>

            {/* 3. Pilihan Warna (jika ada varian dengan warna) */}
            {availableColors && availableColors.length > 0 && (
                <div>
                    <h4 className="font-serif text-base text-karima-brand dark:text-stone-100 mb-3 font-medium flex items-center justify-between">
                        <span>Pilihan Warna</span>
                        {selectedColors.length > 0 && (
                            <button
                                type="button"
                                onClick={() => selectedColors.forEach((c) => onToggleColor(c))}
                                className="text-xxs text-karima-accent hover:underline uppercase tracking-wider"
                            >
                                Clear
                            </button>
                        )}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {availableColors.map((color) => {
                            const isSelected = selectedColors.includes(color.name);
                            return (
                                <button
                                    key={color.name}
                                    type="button"
                                    onClick={() => onToggleColor(color.name)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xxs border transition-all ${
                                        isSelected
                                            ? "border-karima-brand bg-karima-brand text-white shadow-xs"
                                            : "border-karima-brand/20 dark:border-stone-700 bg-white dark:bg-slate-900 text-karima-ink/70 dark:text-stone-300 hover:border-karima-brand"
                                    }`}
                                    title={color.name}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full border border-black/15 shadow-2xs"
                                        style={{ backgroundColor: color.hex || "#94a3b8" }}
                                    />
                                    <span className="capitalize">{color.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 4. Filter Ketersediaan Stok */}
            <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => onToggleInStockOnly(e.target.checked)}
                        className="rounded border-karima-brand/30 text-karima-brand focus:ring-karima-brand cursor-pointer"
                    />
                    <span className="text-xs uppercase tracking-wider text-karima-ink/70 dark:text-stone-300 group-hover:text-karima-brand font-medium">
                        Hanya Produk Tersedia
                    </span>
                </label>
            </div>

            {/* Reset All Button */}
            <div className="pt-4 border-t border-karima-brand/10 dark:border-stone-800">
                <button
                    type="button"
                    onClick={onResetFilters}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xxs uppercase tracking-[0.25em] font-bold text-karima-brand dark:text-stone-300 hover:bg-karima-base/40 dark:hover:bg-slate-800 border border-karima-brand/20 dark:border-stone-700 rounded transition-colors"
                >
                    <IconRotate size={14} />
                    <span>Hapus Semua Filter</span>
                </button>
            </div>
        </div>
    );

    if (isDesktopSidebar) {
        return <div className="w-64 shrink-0">{content}</div>;
    }

    return (
        <div>
            {/* Backdrop for Mobile */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity duration-300 lg:hidden ${
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                onClick={onClose}
            />

            {/* Off-canvas Drawer */}
            <div
                className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] bg-white dark:bg-slate-950 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden overflow-y-auto ${
                    isOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                {content}
            </div>
        </div>
    );
}

