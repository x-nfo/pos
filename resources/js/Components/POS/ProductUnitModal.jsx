import React, { useEffect, useState } from "react";
import axios from "axios";
import {
    IconX,
    IconPackage,
    IconRulerMeasure,
    IconCheck,
    IconBarcode,
    IconBuildingStore,
    IconChevronDown,
    IconRefresh,
} from "@tabler/icons-react";
import { getProductImageUrl } from "@/Utils/imageUrl";
import { useHaptic } from "@/Hooks/useHaptic";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export default function ProductUnitModal({
    isOpen,
    product,
    onClose,
    onSelectUnit,
    isAdding = false,
}) {
    const { triggerHaptic } = useHaptic();
    const [showOtherBranches, setShowOtherBranches] = useState(false);
    const [liveOtherWarehouses, setLiveOtherWarehouses] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Live sync branch stock on modal open
    useEffect(() => {
        if (!isOpen || !product?.id) return;

        setLiveOtherWarehouses(product.other_warehouses || []);
        setShowOtherBranches(false);

        let isMounted = true;
        setIsRefreshing(true);

        const stockUrl =
            typeof route === "function" && route().has("transactions.stock-breakdown")
                ? route("transactions.stock-breakdown", product.id)
                : `/dashboard/transactions/${product.id}/stock-breakdown`;

        axios
            .get(stockUrl)
            .then((res) => {
                if (isMounted && res.data?.success && res.data?.data) {
                    setLiveOtherWarehouses(res.data.data.other_warehouses || []);
                }
            })
            .catch(() => {
                // Silently fallback to cached product.other_warehouses
            })
            .finally(() => {
                if (isMounted) setIsRefreshing(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, product?.id]);

    if (!isOpen || !product) return null;

    const units = Array.isArray(product.units) && product.units.length > 0
        ? product.units
        : [
              {
                  id: product.unit_id || 1,
                  code: "PCS",
                  name: "Pieces",
                  symbol: "pcs",
                  is_base: true,
                  conversion_factor: 1,
                  sell_price: product.sell_price || 0,
                  buy_price: product.buy_price || 0,
                  barcode: product.barcode || null,
              },
          ];

    const baseStock = Number(product.stock || 0);
    const otherBranchesCount = liveOtherWarehouses.length;
    const totalOtherStock = liveOtherWarehouses.reduce((acc, w) => acc + (w.stock || 0), 0);

    const handleSelect = (unit) => {
        triggerHaptic("tap");
        onSelectUnit(product, unit);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
            {/* Modal Card */}
            <div
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-slide-up sm:animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 shadow-xs">
                            <img
                                src={getProductImageUrl(product.image, true)}
                                alt={product.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.src = "/images/product-placeholder.svg?v=5";
                                }}
                            />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/60 px-2 py-0.5 rounded-md">
                                Pilih Satuan (UOM)
                            </span>
                            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate mt-0.5">
                                {product.title}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Stok cabang aktif: <span className="font-bold text-slate-700 dark:text-slate-200">{baseStock}</span> (Satuan Dasar)
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center flex-shrink-0 transition-colors"
                    >
                        <IconX size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Cross-Branch Stock Banner (Responsive & Collapsible if multiple) */}
                {otherBranchesCount > 0 && (
                    <div className="mx-4 mt-3 sm:mx-5">
                        {otherBranchesCount === 1 ? (
                            /* Single branch: Clean slim pill */
                            <div className="p-2.5 px-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between gap-2 shadow-2xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <IconBuildingStore size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 truncate">
                                        Stok di {liveOtherWarehouses[0].name}:
                                    </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-lg bg-amber-200/70 dark:bg-amber-900/70 font-mono text-xs font-black text-amber-900 dark:text-amber-100 shrink-0">
                                    {liveOtherWarehouses[0].stock} pcs
                                </span>
                            </div>
                        ) : (
                            /* Multiple branches: Compact collapsible card */
                            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 overflow-hidden shadow-2xs transition-all">
                                <button
                                    type="button"
                                    onClick={() => setShowOtherBranches(!showOtherBranches)}
                                    className="w-full p-2.5 px-3 flex items-center justify-between gap-2 text-left hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <IconBuildingStore size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                            Tersedia di {otherBranchesCount} Cabang Lain
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/80 font-mono text-[11px] font-black text-amber-950 dark:text-amber-100">
                                            Total {totalOtherStock} pcs
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 shrink-0">
                                        <span>{showOtherBranches ? "Tutup" : "Lihat Cabang"}</span>
                                        <IconChevronDown
                                            size={15}
                                            className={`transition-transform duration-200 ${
                                                showOtherBranches ? "rotate-180" : ""
                                            }`}
                                        />
                                    </div>
                                </button>

                                {showOtherBranches && (
                                    <div className="p-3 pt-0 border-t border-amber-200/60 dark:border-amber-900/40">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto mt-2.5 pr-1">
                                            {liveOtherWarehouses.map((w) => (
                                                <div
                                                    key={w.id}
                                                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-amber-200/70 dark:border-amber-900/70 text-xs shadow-2xs"
                                                >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-slate-700 text-amber-900 dark:text-amber-200 shrink-0">
                                                            {w.code}
                                                        </span>
                                                        <span className="truncate text-slate-700 dark:text-slate-200 font-semibold">
                                                            {w.name}
                                                        </span>
                                                    </div>
                                                    <span className="font-mono font-black text-amber-800 dark:text-amber-300 shrink-0 ml-1">
                                                        {w.stock} pcs
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Units List */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Pilih kemasan / satuan yang akan dijual:
                    </p>

                    {units.map((unit) => {
                        const factor = Number(unit.conversion_factor) || 1;
                        const unitPrice = unit.is_base 
                            ? Number(product.sell_price || 0) 
                            : Number(unit.sell_price || product.sell_price || 0);
                        const estStock = factor > 0 ? Math.floor(baseStock / factor) : 0;
                        const isAvailable = baseStock >= factor;

                        return (
                            <button
                                key={unit.id}
                                type="button"
                                onClick={() => isAvailable && !isAdding && handleSelect(unit)}
                                disabled={!isAvailable || isAdding}
                                className={`
                                    w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 flex items-center justify-between gap-3 group
                                    ${
                                        isAvailable
                                            ? "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-primary-500 dark:hover:border-primary-500 hover:shadow-md hover:bg-primary-50/20 dark:hover:bg-primary-950/20 active:scale-[0.99] cursor-pointer"
                                            : "bg-slate-50 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800/60 opacity-50 cursor-not-allowed"
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3.5 min-w-0">
                                    {/* Icon Badge */}
                                    <div
                                        className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-sm uppercase ${
                                            unit.is_base
                                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                                                : "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60"
                                        }`}
                                    >
                                        <span className="text-xs font-black">
                                            {unit.symbol || unit.code}
                                        </span>
                                    </div>

                                    {/* Unit Info */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900 dark:text-white capitalize">
                                                {unit.name || unit.code}
                                            </span>
                                            {unit.is_base ? (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                                                    Satuan Dasar
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                                    1 {unit.symbol || unit.code} = {factor} {units.find(u => u.is_base)?.symbol || "pcs"}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                            <span>
                                                Tersedia:{" "}
                                                <strong className={estStock > 0 ? "text-slate-800 dark:text-slate-200" : "text-rose-500"}>
                                                    {estStock} {unit.symbol || unit.code}
                                                </strong>
                                            </span>
                                            {unit.barcode && (
                                                <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-slate-400">
                                                    <IconBarcode size={12} /> {unit.barcode}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Price & Select Action */}
                                <div className="text-right flex-shrink-0">
                                    <span className="text-sm sm:text-base font-black text-primary-600 dark:text-primary-400 block">
                                        {formatPrice(unitPrice)}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-primary-600 transition-colors">
                                        + Pilih Satuan
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
