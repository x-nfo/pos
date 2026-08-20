import React from "react";
import { IconBackspace, IconCheck } from "@tabler/icons-react";
import { useHaptic } from "@/Hooks/useHaptic";

const formatRupiah = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(num);
};

export default function MobileNumpad({
    value = "",
    onChange,
    targetAmount = 0,
    onSubmit,
    submitLabel = "Selesai",
    showShortcuts = true,
}) {
    const { triggerHaptic } = useHaptic();

    const handleNumberClick = (numStr) => {
        triggerHaptic("tap");
        const currentStr = String(value || "");
        if (currentStr === "0" && numStr !== "00" && numStr !== "000") {
            onChange(numStr);
        } else {
            onChange(currentStr + numStr);
        }
    };

    const handleBackspace = () => {
        triggerHaptic("light");
        const currentStr = String(value || "");
        if (currentStr.length <= 1) {
            onChange("");
        } else {
            onChange(currentStr.slice(0, -1));
        }
    };

    const handleClear = () => {
        triggerHaptic("light");
        onChange("");
    };

    const handleExactAmount = () => {
        triggerHaptic("medium");
        onChange(String(Math.round(targetAmount || 0)));
    };

    const handleAddAmount = (addVal) => {
        triggerHaptic("tap");
        const current = Number(value || 0);
        onChange(String(current + addVal));
    };

    // Calculate common quick pay suggestions based on target amount
    const quickPresets = React.useMemo(() => {
        const target = Math.round(targetAmount || 0);
        if (target <= 0) {
            return [10000, 20000, 50000, 100000];
        }

        const presets = new Set();
        // Exact
        presets.add(target);

        // Next round up 10k, 20k, 50k, 100k
        const round10k = Math.ceil(target / 10000) * 10000;
        const round20k = Math.ceil(target / 20000) * 20000;
        const round50k = Math.ceil(target / 50000) * 50000;
        const round100k = Math.ceil(target / 100000) * 100000;

        if (round10k > target) presets.add(round10k);
        if (round20k > target) presets.add(round20k);
        if (round50k > target) presets.add(round50k);
        if (round100k > target) presets.add(round100k);

        // Default fallbacks if fewer than 4
        [50000, 100000].forEach((v) => {
            if (v > target && presets.size < 5) presets.add(v);
        });

        return Array.from(presets).slice(0, 5);
    }, [targetAmount]);

    return (
        <div className="w-full select-none">
            {/* Quick Cash Presets Carousel */}
            {showShortcuts && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 pt-1">
                    <button
                        type="button"
                        onClick={handleExactAmount}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-300 dark:border-primary-700 text-xs font-bold text-primary-700 dark:text-primary-300 active:scale-95 transition-transform"
                    >
                        Uang Pas ({formatRupiah(targetAmount)})
                    </button>
                    {quickPresets.map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => {
                                triggerHaptic("tap");
                                onChange(String(preset));
                            }}
                            className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
                        >
                            {formatRupiah(preset)}
                        </button>
                    ))}
                </div>
            )}

            {/* Numpad Grid */}
            <div className="grid grid-cols-3 gap-2 touch-action-manipulation">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        type="button"
                        onClick={() => handleNumberClick(String(num))}
                        className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xl font-bold text-slate-800 dark:text-white active:bg-slate-200 dark:active:bg-slate-700 active:scale-95 transition-all shadow-sm flex items-center justify-center"
                    >
                        {num}
                    </button>
                ))}

                {/* Bottom Row */}
                <button
                    type="button"
                    onClick={handleClear}
                    className="h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-sm font-bold active:bg-rose-100 dark:active:bg-rose-900/60 active:scale-95 transition-all shadow-sm flex items-center justify-center"
                >
                    C
                </button>

                <button
                    type="button"
                    onClick={() => handleNumberClick("0")}
                    className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xl font-bold text-slate-800 dark:text-white active:bg-slate-200 dark:active:bg-slate-700 active:scale-95 transition-all shadow-sm flex items-center justify-center"
                >
                    0
                </button>

                <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 active:bg-slate-300 dark:active:bg-slate-600 active:scale-95 transition-all shadow-sm flex items-center justify-center"
                >
                    <IconBackspace size={24} />
                </button>

                {/* Additional Quick Denominations */}
                <button
                    type="button"
                    onClick={() => handleNumberClick("00")}
                    className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-base font-semibold text-slate-600 dark:text-slate-300 active:scale-95 transition-all flex items-center justify-center"
                >
                    00
                </button>
                <button
                    type="button"
                    onClick={() => handleNumberClick("000")}
                    className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-base font-semibold text-slate-600 dark:text-slate-300 active:scale-95 transition-all flex items-center justify-center"
                >
                    000
                </button>
                {onSubmit ? (
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("success");
                            onSubmit();
                        }}
                        className="h-12 rounded-2xl bg-primary-600 dark:bg-primary-500 text-white font-bold text-sm active:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-1 shadow-md shadow-primary-500/20"
                    >
                        <IconCheck size={18} />
                        <span>{submitLabel}</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => handleAddAmount(50000)}
                        className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 active:scale-95 transition-all flex items-center justify-center"
                    >
                        +50k
                    </button>
                )}
            </div>
        </div>
    );
}
