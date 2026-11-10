import React from "react";

/**
 * CatalogVariantColorSelector
 *
 * Mendukung 3 mode tampilan varian warna per-produk:
 * 1. 'color' : Versi lingkaran warna saja tanpa gambar baju & tanpa tulisan (Color Swatches)
 * 2. 'image' : Versi thumbnail foto baju saja tanpa tulisan (Garment Image Thumbnails)
 * 3. 'pill'  : Versi pill klasik (bulatan thumbnail/warna + teks nama warna)
 */
export default function CatalogVariantColorSelector({
    availableColors = [],
    activeColor = "",
    onSelectColor = () => {},
    displayType = "color",
    size = "md",
}) {
    if (!Array.isArray(availableColors) || availableColors.length === 0) {
        return null;
    }

    const isSmall = size === "sm";

    // 1. Versi Color Saja: Lingkaran warna swatch murni (tanpa gambar baju & tanpa tulisan)
    if (displayType === "color") {
        return (
            <div className="flex flex-wrap items-center gap-2.5">
                {availableColors.map((col) => {
                    const isSelected = activeColor === col.name;
                    return (
                        <button
                            key={col.name}
                            type="button"
                            onClick={() => onSelectColor(col.name)}
                            title={col.name}
                            aria-label={`Warna ${col.name}`}
                            className={`group relative rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer p-0.5 ${
                                isSmall ? "w-7 h-7 sm:w-8 sm:h-8" : "w-8 h-8 sm:w-9 sm:h-9"
                            } ${
                                isSelected
                                    ? "ring-2 ring-karima-brand ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110 shadow-xs"
                                    : "ring-1 ring-black/10 dark:ring-white/10 hover:ring-karima-brand/40 hover:scale-105 opacity-85 hover:opacity-100"
                            }`}
                        >
                            <span
                                className="w-full h-full rounded-full border border-black/15 dark:border-white/15 shadow-inner block"
                                style={{ backgroundColor: col.hex || "#1e293b" }}
                            />
                        </button>
                    );
                })}
            </div>
        );
    }

    // 2. Versi Gambar Baju Saja: Thumbnail foto baju tanpa tulisan teks
    if (displayType === "image") {
        return (
            <div className="flex flex-wrap items-center gap-2.5">
                {availableColors.map((col) => {
                    const isSelected = activeColor === col.name;
                    return (
                        <button
                            key={col.name}
                            type="button"
                            onClick={() => onSelectColor(col.name)}
                            title={col.name}
                            aria-label={`Varian ${col.name}`}
                            className={`relative rounded-md overflow-hidden border-2 transition-all duration-200 cursor-pointer bg-stone-100 dark:bg-slate-800 p-0.5 shrink-0 ${
                                isSmall ? "w-11 h-14 sm:w-12 sm:h-15" : "w-13 h-17 sm:w-14 sm:h-18"
                            } ${
                                isSelected
                                    ? "border-karima-brand shadow-sm ring-2 ring-karima-brand/20 scale-105"
                                    : "border-stone-200 dark:border-stone-700 hover:border-karima-brand/50 opacity-80 hover:opacity-100"
                            }`}
                        >
                            {col.image ? (
                                <img
                                    src={col.image}
                                    alt={col.name}
                                    className="w-full h-full object-cover rounded-[3px]"
                                    loading="lazy"
                                />
                            ) : (
                                <span
                                    className="w-full h-full rounded-[3px] flex items-center justify-center text-[10px] font-bold"
                                    style={{ backgroundColor: col.hex || "#e2e8f0" }}
                                >
                                    <span className="sr-only">{col.name}</span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        );
    }

    // 3. Versi Pill: Pill teks nama warna dengan bulatan thumbnail/warna (Bawaan)
    return (
        <div className="flex flex-wrap gap-2">
            {availableColors.map((col) => {
                const isSelected = activeColor === col.name;
                return (
                    <button
                        key={col.name}
                        type="button"
                        onClick={() => onSelectColor(col.name)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                                ? "border-karima-brand bg-karima-brand text-white shadow-xs ring-2 ring-karima-brand/20"
                                : "border-karima-brand/20 dark:border-stone-700 bg-white dark:bg-slate-900 text-karima-ink/80 dark:text-stone-300 hover:border-karima-brand"
                        }`}
                    >
                        {col.image ? (
                            <img
                                src={col.image}
                                alt={col.name}
                                className="w-3.5 h-3.5 rounded-full object-cover border border-black/10 shrink-0"
                            />
                        ) : (
                            <span
                                className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                                style={{ backgroundColor: col.hex || "#1e293b" }}
                            />
                        )}
                        <span className="capitalize">{col.name}</span>
                    </button>
                );
            })}
        </div>
    );
}
