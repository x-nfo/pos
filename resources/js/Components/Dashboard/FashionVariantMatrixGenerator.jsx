import React, { useState, useEffect } from "react";
import {
    IconPlus,
    IconTrash,
    IconColorSwatch,
    IconRulerMeasure,
    IconRefresh,
    IconCheck,
    IconCopy,
} from "@tabler/icons-react";
import Button from "@/Components/Dashboard/Button";

const COLOR_PRESETS = [
    { name: "Hitam", hex: "#111827" },
    { name: "Putih", hex: "#ffffff" },
    { name: "Navy", hex: "#1e3a8a" },
    { name: "Sage Green", hex: "#84a98c" },
    { name: "Maroon", hex: "#881337" },
    { name: "Abu-abu", hex: "#6b7280" },
    { name: "Mocca", hex: "#a27b5c" },
    { name: "Krem / Beige", hex: "#f5f5dc" },
    { name: "Coklat", hex: "#78350f" },
    { name: "Mustard", hex: "#d97706" },
];

const SIZE_PRESETS = [
    { group: "Pakaian Dewasa", sizes: ["S", "M", "L", "XL", "XXL"] },
    { group: "All Size", sizes: ["All Size"] },
    { group: "Celana", sizes: ["28", "29", "30", "31", "32", "33", "34"] },
    { group: "Sepatu / Sandal", sizes: ["38", "39", "40", "41", "42", "43", "44"] },
];

export default function FashionVariantMatrixGenerator({
    variants = [],
    onChange = () => {},
    baseBuyPrice = 0,
    baseSellPrice = 0,
    productTitle = "",
    productSku = "",
}) {
    const [selectedColors, setSelectedColors] = useState([]);
    const [customColorName, setCustomColorName] = useState("");
    const [customColorHex, setCustomColorHex] = useState("#3b82f6");

    const [selectedSizes, setSelectedSizes] = useState([]);
    const [customSize, setCustomSize] = useState("");

    const [batchStock, setBatchStock] = useState("");
    const [batchSellPrice, setBatchSellPrice] = useState("");

    // Add Color
    const handleAddColor = (color) => {
        if (!color.name.trim()) return;
        if (selectedColors.some((c) => c.name.toLowerCase() === color.name.trim().toLowerCase())) return;
        setSelectedColors((prev) => [...prev, { name: color.name.trim(), hex: color.hex || "#000000" }]);
    };

    const handleRemoveColor = (colorName) => {
        setSelectedColors((prev) => prev.filter((c) => c.name !== colorName));
    };

    // Add Size
    const handleAddSize = (size) => {
        const s = size.trim().toUpperCase();
        if (!s) return;
        if (selectedSizes.includes(s)) return;
        setSelectedSizes((prev) => [...prev, s]);
    };

    const handleRemoveSize = (size) => {
        setSelectedSizes((prev) => prev.filter((s) => s !== size));
    };

    // Auto-generate Matrix when colors or sizes change
    useEffect(() => {
        if (selectedColors.length === 0 || selectedSizes.length === 0) {
            onChange([]);
            return;
        }

        const cleanSkuPrefix = (productSku || productTitle || "ART")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "-")
            .slice(0, 10);

        const newMatrix = [];

        selectedColors.forEach((color) => {
            selectedSizes.forEach((size) => {
                const colorCode = color.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "CLR";
                const sizeCode = size.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "SZ";
                const generatedSku = `${cleanSkuPrefix}-${colorCode}-${sizeCode}`;
                const generatedBarcode = `${cleanSkuPrefix}-${colorCode}-${sizeCode}`;

                // Preserve previous price / stock if already edited
                const existing = variants.find(
                    (v) => v.color_name === color.name && v.size === size
                );

                newMatrix.push({
                    color_name: color.name,
                    color_hex: color.hex,
                    size: size,
                    sku: existing?.sku || generatedSku,
                    barcode: existing?.barcode || generatedBarcode,
                    buy_price: existing?.buy_price !== undefined ? existing.buy_price : baseBuyPrice,
                    sell_price: existing?.sell_price !== undefined ? existing.sell_price : baseSellPrice,
                    stock: existing?.stock !== undefined ? existing.stock : 0,
                });
            });
        });

        onChange(newMatrix);
    }, [selectedColors, selectedSizes, baseBuyPrice, baseSellPrice, productTitle, productSku]);

    // Handle single field change in matrix row
    const handleRowChange = (index, field, value) => {
        const updated = [...variants];
        updated[index] = { ...updated[index], [field]: value };
        onChange(updated);
    };

    // Remove single row
    const handleRemoveRow = (index) => {
        const updated = variants.filter((_, i) => i !== index);
        onChange(updated);
    };

    // Batch apply stock
    const handleApplyBatchStock = () => {
        if (batchStock === "") return;
        const qty = Math.max(0, parseInt(batchStock) || 0);
        const updated = variants.map((v) => ({ ...v, stock: qty }));
        onChange(updated);
    };

    // Batch apply sell price
    const handleApplyBatchPrice = () => {
        if (batchSellPrice === "") return;
        const price = Math.max(0, parseInt(batchSellPrice) || 0);
        const updated = variants.map((v) => ({ ...v, sell_price: price }));
        onChange(updated);
    };

    const totalStock = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);

    return (
        <div className="space-y-6 bg-slate-50/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 rounded-xl">
                        <IconColorSwatch size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            Matriks Varian Pakaian (Warna × Ukuran)
                        </h3>
                        <p className="text-xs text-slate-500">
                            Pilih warna dan ukuran baju untuk menghasilkan kombinasi SKU dan stok otomatis.
                        </p>
                    </div>
                </div>
                {variants.length > 0 && (
                    <div className="text-right">
                        <span className="text-xs text-slate-500 block">Total Stok Kombinasi</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {totalStock} pcs ({variants.length} varian)
                        </span>
                    </div>
                )}
            </div>

            {/* 1. Pemilihan Warna */}
            <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <IconColorSwatch size={16} className="text-primary-500" />
                    1. Pilihan Warna Pakaian
                </label>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((cp) => {
                        const isSelected = selectedColors.some((c) => c.name.toLowerCase() === cp.name.toLowerCase());
                        return (
                            <button
                                key={cp.name}
                                type="button"
                                onClick={() => (isSelected ? handleRemoveColor(cp.name) : handleAddColor(cp))}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                                    isSelected
                                        ? "bg-primary-50 border-primary-500 text-primary-700 dark:bg-primary-950/40 dark:border-primary-400 dark:text-primary-300 ring-2 ring-primary-500/20"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                                }`}
                            >
                                <span
                                    className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0"
                                    style={{ backgroundColor: cp.hex }}
                                />
                                {cp.name}
                                {isSelected && <IconCheck size={14} className="text-primary-600" />}
                            </button>
                        );
                    })}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center gap-2 pt-1">
                    <input
                        type="color"
                        value={customColorHex}
                        onChange={(e) => setCustomColorHex(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800"
                        title="Pilih warna khusus"
                    />
                    <input
                        type="text"
                        placeholder="Nama warna lain (misal: Terracotta, Denim...)"
                        value={customColorName}
                        onChange={(e) => setCustomColorName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddColor({ name: customColorName, hex: customColorHex });
                                setCustomColorName("");
                            }
                        }}
                        className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 w-64 focus:ring-2 focus:ring-primary-500/20 outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            handleAddColor({ name: customColorName, hex: customColorHex });
                            setCustomColorName("");
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors"
                    >
                        + Tambah Warna
                    </button>
                </div>
            </div>

            {/* 2. Pemilihan Ukuran */}
            <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <IconRulerMeasure size={16} className="text-primary-500" />
                    2. Pilihan Ukuran (Size)
                </label>

                {SIZE_PRESETS.map((sg) => (
                    <div key={sg.group} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 w-28 flex-shrink-0 font-medium">{sg.group}:</span>
                        <div className="flex flex-wrap gap-1.5">
                            {sg.sizes.map((s) => {
                                const isSelected = selectedSizes.includes(s);
                                return (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => (isSelected ? handleRemoveSize(s) : handleAddSize(s))}
                                        className={`px-3 py-1 rounded-xl font-bold border transition-all ${
                                            isSelected
                                                ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary-400"
                                        }`}
                                    >
                                        {s}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Custom Size Input */}
                <div className="flex items-center gap-2 pt-1">
                    <input
                        type="text"
                        placeholder="Ukuran khusus (misal: 4XL, M-L, Free Size...)"
                        value={customSize}
                        onChange={(e) => setCustomSize(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSize(customSize);
                                setCustomSize("");
                            }
                        }}
                        className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 w-64 focus:ring-2 focus:ring-primary-500/20 outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            handleAddSize(customSize);
                            setCustomSize("");
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors"
                    >
                        + Tambah Ukuran
                    </button>
                </div>
            </div>

            {/* 3. Tabel Matriks Varian */}
            {variants.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Terapkan Cepat ke Semua Varian:
                        </span>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-500">Stok:</span>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="10"
                                    value={batchStock}
                                    onChange={(e) => setBatchStock(e.target.value)}
                                    className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyBatchStock}
                                    className="px-2 py-1 text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300"
                                >
                                    Terapkan
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-500">Harga:</span>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="150000"
                                    value={batchSellPrice}
                                    onChange={(e) => setBatchSellPrice(e.target.value)}
                                    className="w-24 px-2 py-1 text-xs text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyBatchPrice}
                                    className="px-2 py-1 text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300"
                                >
                                    Terapkan
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table Matrix */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                            <thead className="bg-slate-50 dark:bg-slate-900/80 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="py-2.5 px-3">Varian (Warna & Size)</th>
                                    <th className="py-2.5 px-3">Barcode / Hangtag</th>
                                    <th className="py-2.5 px-3">SKU</th>
                                    <th className="py-2.5 px-3">Harga Jual (Rp)</th>
                                    <th className="py-2.5 px-3">Stok Awal</th>
                                    <th className="py-2.5 px-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {variants.map((v, idx) => (
                                    <tr key={`${v.color_name}-${v.size}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="w-3.5 h-3.5 rounded-full border border-slate-300 flex-shrink-0"
                                                    style={{ backgroundColor: v.color_hex }}
                                                />
                                                <span className="font-semibold text-slate-900 dark:text-white">
                                                    {v.color_name}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px]">
                                                    {v.size}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3">
                                            <input
                                                type="text"
                                                value={v.barcode}
                                                onChange={(e) => handleRowChange(idx, "barcode", e.target.value)}
                                                className="w-36 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px] outline-none focus:border-primary-500"
                                            />
                                        </td>
                                        <td className="py-2 px-3">
                                            <input
                                                type="text"
                                                value={v.sku}
                                                onChange={(e) => handleRowChange(idx, "sku", e.target.value)}
                                                className="w-32 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px] outline-none focus:border-primary-500"
                                            />
                                        </td>
                                        <td className="py-2 px-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={v.sell_price}
                                                onChange={(e) => handleRowChange(idx, "sell_price", e.target.value)}
                                                className="w-28 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-right font-medium text-xs outline-none focus:border-primary-500"
                                            />
                                        </td>
                                        <td className="py-2 px-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={v.stock}
                                                onChange={(e) => handleRowChange(idx, "stock", e.target.value)}
                                                className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-bold text-xs text-primary-600 outline-none focus:border-primary-500"
                                            />
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRow(idx)}
                                                className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                                                title="Hapus varian ini"
                                            >
                                                <IconTrash size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
