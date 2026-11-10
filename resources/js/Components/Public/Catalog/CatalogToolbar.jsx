import React from "react";
import {
    IconAdjustmentsHorizontal,
    IconLayoutGrid,
    IconGridDots,
    IconChevronDown,
} from "@tabler/icons-react";

export default function CatalogToolbar({
    onOpenFilter = () => {},
    activeFilterCount = 0,
    sortBy = "newest",
    onSortChange = () => {},
    gridCols = 3,
    onGridColsChange = () => {},
}) {
    return (
        <div className="bg-white/95 dark:bg-slate-950/95 border-b border-karima-brand/10 dark:border-stone-800 py-3.5 mb-8 flex items-center justify-between sticky top-[56px] sm:top-[64px] z-30 backdrop-blur-md">
            {/* Filter Toggle Button */}
            <button
                type="button"
                onClick={onOpenFilter}
                className="flex items-center gap-2 text-xxs uppercase tracking-widest font-semibold text-karima-brand dark:text-stone-200 hover:text-karima-accent transition-colors cursor-pointer py-1 px-1 rounded"
                title="Buka filter kategori & harga"
            >
                <IconAdjustmentsHorizontal size={16} />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-karima-brand text-white text-[9px] font-bold flex items-center justify-center">
                        {activeFilterCount}
                    </span>
                )}
            </button>

            <div className="flex items-center gap-5 sm:gap-7">
                {/* Sort Dropdown */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="hidden sm:inline text-xxs uppercase tracking-widest text-karima-ink/40 dark:text-stone-500 font-medium">
                        Urutkan:
                    </span>
                    <div className="relative inline-flex items-center">
                        <select
                            value={sortBy}
                            onChange={(e) => onSortChange(e.target.value)}
                            className="bg-transparent text-xs font-serif text-karima-brand dark:text-stone-200 focus:outline-none cursor-pointer border-none py-1 pl-1 pr-6 font-medium appearance-none"
                        >
                            <option value="newest" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-stone-200">
                                Terbaru
                            </option>
                            <option value="price-asc" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-stone-200">
                                Harga: Rendah ke Tinggi
                            </option>
                            <option value="price-desc" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-stone-200">
                                Harga: Tinggi ke Rendah
                            </option>
                        </select>
                        <IconChevronDown size={13} className="absolute right-0 pointer-events-none text-karima-ink/40 dark:text-stone-500" />
                    </div>
                </div>

                {/* Grid Switcher (Desktop only) */}
                <div className="hidden lg:flex items-center gap-1 border-l border-karima-brand/10 dark:border-stone-800 pl-5">
                    <button
                        type="button"
                        onClick={() => onGridColsChange(2)}
                        className={`p-1.5 rounded transition-colors ${
                            gridCols === 2
                                ? "text-karima-brand dark:text-white bg-karima-base/40 dark:bg-stone-800"
                                : "text-karima-ink/30 dark:text-stone-600 hover:text-karima-brand"
                        }`}
                        title="Tampilan 2 Kolom"
                    >
                        <IconLayoutGrid size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onGridColsChange(3)}
                        className={`p-1.5 rounded transition-colors ${
                            gridCols === 3
                                ? "text-karima-brand dark:text-white bg-karima-base/40 dark:bg-stone-800"
                                : "text-karima-ink/30 dark:text-stone-600 hover:text-karima-brand"
                        }`}
                        title="Tampilan 3 Kolom"
                    >
                        <IconGridDots size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

