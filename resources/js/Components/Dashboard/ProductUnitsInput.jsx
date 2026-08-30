import React, { useState, useEffect, useMemo } from "react";
import {
    IconRulerMeasure,
    IconPlus,
    IconTrash,
    IconInfoCircle,
    IconCalculator,
    IconBarcode,
    IconSparkles,
    IconArrowRight,
    IconCheck,
} from "@tabler/icons-react";

export default function ProductUnitsInput({
    units = [],
    value = [],
    onChange,
    defaultBuyPrice = 0,
    defaultSellPrice = 0,
    errors = {},
}) {
    // If value already has units passed in (e.g. on Edit), enable by default
    const [isEnabled, setIsEnabled] = useState(Array.isArray(value) && value.length > 0);

    // Find default PCS unit
    const defaultBaseUnit = units.find((u) => u.code === "PCS") || units[0] || null;

    useEffect(() => {
        if (Array.isArray(value) && value.length > 0 && !isEnabled) {
            setIsEnabled(true);
        }
    }, [value]);

    const handleToggle = (checked) => {
        setIsEnabled(checked);
        if (checked) {
            if (!value || value.length === 0) {
                // Initialize with base unit
                onChange([
                    {
                        unit_id: defaultBaseUnit ? defaultBaseUnit.id : "",
                        is_base: true,
                        conversion_factor: 1,
                        buy_price: defaultBuyPrice || "",
                        sell_price: defaultSellPrice || "",
                        barcode: "",
                    },
                ]);
            }
        } else {
            onChange([]);
        }
    };

    const baseItem = value?.find((item) => item.is_base) || value?.[0] || null;
    const additionalItems = value?.filter((item) => !item.is_base) || [];

    const usedUnitIds = useMemo(() => {
        return new Set((value || []).map((v) => Number(v.unit_id)).filter(Boolean));
    }, [value]);

    const getUnitById = (id) => units.find((u) => u.id === Number(id));
    const baseUnitObj = baseItem ? getUnitById(baseItem.unit_id) : defaultBaseUnit;

    const updateBaseUnit = (unitId) => {
        const updated = value.map((item) => {
            if (item.is_base) {
                return {
                    ...item,
                    unit_id: Number(unitId),
                    conversion_factor: 1,
                };
            }
            return item;
        });

        // If no base unit existed, add one
        if (!value.some((item) => item.is_base)) {
            updated.unshift({
                unit_id: Number(unitId),
                is_base: true,
                conversion_factor: 1,
                buy_price: defaultBuyPrice || "",
                sell_price: defaultSellPrice || "",
                barcode: "",
            });
        }

        onChange(updated);
    };

    const handleAddUnit = () => {
        const availableUnit = units.find((u) => !usedUnitIds.has(u.id)) || units[0];

        const defaultFactor = 12;
        const autoBuy = defaultBuyPrice ? Math.round(Number(defaultBuyPrice) * defaultFactor) : "";
        const autoSell = defaultSellPrice ? Math.round(Number(defaultSellPrice) * defaultFactor) : "";

        const newItem = {
            unit_id: availableUnit ? availableUnit.id : "",
            is_base: false,
            conversion_factor: defaultFactor,
            buy_price: autoBuy,
            sell_price: autoSell,
            barcode: "",
        };

        onChange([...(value || []), newItem]);
    };

    const handleUpdateAdditionalItem = (index, field, val) => {
        const newAdditional = [...additionalItems];
        newAdditional[index] = {
            ...newAdditional[index],
            [field]: val,
        };

        // Recombine base item and additionals
        const updated = baseItem ? [baseItem, ...newAdditional] : newAdditional;
        onChange(updated);
    };

    const handleRemoveAdditionalItem = (index) => {
        const newAdditional = additionalItems.filter((_, i) => i !== index);
        const updated = baseItem ? [baseItem, ...newAdditional] : newAdditional;
        onChange(updated);
    };

    const autoCalculatePrices = (index) => {
        const item = additionalItems[index];
        const factor = Number(item.conversion_factor) || 1;
        const buy = defaultBuyPrice ? Math.round(Number(defaultBuyPrice) * factor) : "";
        const sell = defaultSellPrice ? Math.round(Number(defaultSellPrice) * factor) : "";

        const newAdditional = [...additionalItems];
        newAdditional[index] = {
            ...newAdditional[index],
            buy_price: buy,
            sell_price: sell,
        };

        const updated = baseItem ? [baseItem, ...newAdditional] : newAdditional;
        onChange(updated);
    };

    const syncAllAdditionalPrices = () => {
        const newAdditional = additionalItems.map((item) => {
            const factor = Number(item.conversion_factor) || 1;
            return {
                ...item,
                buy_price: defaultBuyPrice ? Math.round(Number(defaultBuyPrice) * factor) : item.buy_price,
                sell_price: defaultSellPrice ? Math.round(Number(defaultSellPrice) * factor) : item.sell_price,
            };
        });

        const updated = baseItem ? [baseItem, ...newAdditional] : newAdditional;
        onChange(updated);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 transition-all">
            {/* Header & Toggle */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                        <IconRulerMeasure size={22} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            Multi-Satuan & Konversi (UOM)
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                Opsional
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Atur satuan dasar (PCS/KG) dan satuan kemasan (Box, Karton, Dus) dengan rasio isi dan barcode masing-masing.
                        </p>
                    </div>
                </div>

                {/* Switch Toggle */}
                <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => handleToggle(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                </label>
            </div>

            {/* Expanded Content */}
            {isEnabled && (
                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-6">
                    {/* Base Unit Card */}
                    <div className="bg-primary-50/50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/40 rounded-xl p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-primary-500"></span>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-primary-900 dark:text-primary-300">
                                    Satuan Dasar (Base Unit)
                                </h4>
                            </div>
                            <span className="text-xs text-primary-700 dark:text-primary-400 bg-primary-100/60 dark:bg-primary-900/40 px-2 py-0.5 rounded-md font-medium">
                                Stok fisik dicatat dalam satuan ini
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Pilih Satuan Dasar
                                </label>
                                <select
                                    value={baseItem?.unit_id || ""}
                                    onChange={(e) => updateBaseUnit(e.target.value)}
                                    className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                >
                                    {units.map((u) => {
                                        const isUsedInAdditional = additionalItems.some(
                                            (ai) => Number(ai.unit_id) === u.id
                                        );
                                        return (
                                            <option key={u.id} value={u.id} disabled={isUsedInAdditional}>
                                                {u.name} ({u.symbol}) {isUsedInAdditional ? "- Sudah dipakai kemasan" : ""}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 pb-2">
                                Faktor konversi: <strong className="text-slate-700 dark:text-slate-200">1</strong> (Harga beli & jual default mengikuti form harga dasar di atas).
                            </div>
                        </div>
                    </div>

                    {/* Additional Units Section */}
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    Satuan Tambahan / Kemasan
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Misal Box, Dus, atau Karton dengan konversi ke {baseUnitObj?.symbol || "Base Unit"}.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {additionalItems.length > 0 && defaultSellPrice > 0 && (
                                    <button
                                        type="button"
                                        onClick={syncAllAdditionalPrices}
                                        className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 transition-colors"
                                        title="Sinkronisasi harga semua kemasan dari harga dasar"
                                    >
                                        <IconSparkles size={14} className="text-primary-500" />
                                        Auto-Set Semua Harga
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleAddUnit}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 dark:hover:bg-primary-900/50 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <IconPlus size={15} />
                                    Tambah Satuan
                                </button>
                            </div>
                        </div>

                        {additionalItems.length === 0 ? (
                            <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 text-xs">
                                <IconInfoCircle size={24} className="mx-auto mb-1 text-slate-400" />
                                Belum ada satuan tambahan. Klik <strong>Tambah Satuan</strong> jika produk memiliki kemasan Box/DUS/Karton.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {additionalItems.map((item, index) => {
                                    const currentUnit = getUnitById(item.unit_id);
                                    const factor = Number(item.conversion_factor) || 0;
                                    const sellPrice = Number(item.sell_price) || 0;
                                    const buyPrice = Number(item.buy_price) || 0;
                                    const baseSell = Number(defaultSellPrice) || 0;
                                    const eqSell = factor > 0 && sellPrice > 0 ? sellPrice / factor : 0;
                                    const diffSell = baseSell > 0 && eqSell > 0 ? baseSell - eqSell : 0;

                                    // Error keys
                                    const realIndex = index + 1; // 0 is base unit
                                    const unitError = errors[`units.${realIndex}.unit_id`] || errors[`units.${index}.unit_id`];
                                    const barcodeError = errors[`units.${realIndex}.barcode`] || errors[`units.${index}.barcode`];

                                    return (
                                        <div
                                            key={index}
                                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 relative group transition-all"
                                        >
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-start">
                                                {/* Satuan Dropdown */}
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                        Satuan
                                                    </label>
                                                    <select
                                                        value={item.unit_id}
                                                        onChange={(e) =>
                                                            handleUpdateAdditionalItem(
                                                                index,
                                                                "unit_id",
                                                                Number(e.target.value)
                                                            )
                                                        }
                                                        className={`w-full h-9 px-2.5 text-xs rounded-lg border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary-500 ${
                                                            unitError
                                                                ? "border-rose-400 dark:border-rose-600"
                                                                : "border-slate-200 dark:border-slate-700"
                                                        }`}
                                                    >
                                                        {units.map((u) => {
                                                            const isBase = baseItem && Number(baseItem.unit_id) === u.id;
                                                            const isUsedOther = additionalItems.some(
                                                                (ai, aiIdx) => aiIdx !== index && Number(ai.unit_id) === u.id
                                                            );
                                                            const isOptionDisabled = isBase || isUsedOther;

                                                            return (
                                                                <option key={u.id} value={u.id} disabled={isOptionDisabled}>
                                                                    {u.name} ({u.symbol}){" "}
                                                                    {isBase
                                                                        ? "- Satuan Dasar"
                                                                        : isUsedOther
                                                                        ? "- Sudah dipilih"
                                                                        : ""}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                    {unitError && (
                                                        <span className="text-[10px] text-rose-500 mt-1 block">
                                                            {unitError}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Konversi Factor */}
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                        Isi per Satuan
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="0.0001"
                                                            step="any"
                                                            value={item.conversion_factor ?? ""}
                                                            onChange={(e) =>
                                                                handleUpdateAdditionalItem(
                                                                    index,
                                                                    "conversion_factor",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary-500"
                                                            placeholder="Contoh: 12"
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                                                        1 {currentUnit?.symbol || "Unit"} = {item.conversion_factor || 0} {baseUnitObj?.symbol || "Base"}
                                                    </span>
                                                </div>

                                                {/* Harga Beli */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                                            Harga Beli
                                                        </label>
                                                        <button
                                                            type="button"
                                                            title="Hitung otomatis dari harga dasar"
                                                            onClick={() => autoCalculatePrices(index)}
                                                            className="text-[10px] text-primary-600 hover:underline flex items-center gap-0.5"
                                                        >
                                                            <IconSparkles size={11} /> Auto
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={item.buy_price ?? ""}
                                                        onChange={(e) =>
                                                            handleUpdateAdditionalItem(
                                                                index,
                                                                "buy_price",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary-500"
                                                        placeholder="Rp Beli"
                                                    />
                                                </div>

                                                {/* Harga Jual */}
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                        Harga Jual
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={item.sell_price ?? ""}
                                                        onChange={(e) =>
                                                            handleUpdateAdditionalItem(
                                                                index,
                                                                "sell_price",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary-500"
                                                        placeholder="Rp Jual"
                                                    />
                                                </div>

                                                {/* Barcode & Delete Button */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                            Barcode (Opsional)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={item.barcode || ""}
                                                            onChange={(e) =>
                                                                handleUpdateAdditionalItem(
                                                                    index,
                                                                    "barcode",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className={`w-full h-9 px-2.5 text-xs rounded-lg border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary-500 ${
                                                                barcodeError
                                                                    ? "border-rose-400 dark:border-rose-600"
                                                                    : "border-slate-200 dark:border-slate-700"
                                                            }`}
                                                            placeholder="Barcode"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveAdditionalItem(index)}
                                                        className="mt-5 p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                                        title="Hapus Satuan"
                                                    >
                                                        <IconTrash size={17} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Barcode Error feedback */}
                                            {barcodeError && (
                                                <span className="text-[10px] text-rose-500 mt-1 block">
                                                    {barcodeError}
                                                </span>
                                            )}

                                            {/* Price Comparison & Equivalent Insight */}
                                            {eqSell > 0 && factor > 1 && (
                                                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                        <IconCalculator size={13} className="text-slate-400" />
                                                        <span>
                                                            Setara <strong>Rp {Math.round(eqSell).toLocaleString("id-ID")}</strong> / {baseUnitObj?.symbol || "pcs"}
                                                        </span>
                                                    </div>
                                                    {baseSell > 0 && (
                                                        <div>
                                                            {diffSell > 0 ? (
                                                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                                                                    <IconCheck size={12} />
                                                                    Lebih hemat Rp {Math.round(diffSell).toLocaleString("id-ID")}/{baseUnitObj?.symbol || "pcs"} vs eceran
                                                                </span>
                                                            ) : diffSell < 0 ? (
                                                                <span className="text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                                                                    Lebih mahal Rp {Math.round(-diffSell).toLocaleString("id-ID")}/{baseUnitObj?.symbol || "pcs"} vs eceran
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-500 dark:text-slate-400">
                                                                    Sama dengan harga eceran
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
