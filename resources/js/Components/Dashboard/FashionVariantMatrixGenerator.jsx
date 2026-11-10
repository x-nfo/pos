import React, { useState, useEffect, useRef } from "react";
import {
    IconPlus,
    IconTrash,
    IconColorSwatch,
    IconRulerMeasure,
    IconRefresh,
    IconCheck,
    IconPhoto,
    IconUpload,
    IconX,
} from "@tabler/icons-react";
import { getProductImageUrl } from "@/Utils/imageUrl";
import toast from "react-hot-toast";

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

const extractInitialColors = (vars) => {
    if (!vars || !Array.isArray(vars) || vars.length === 0) return [];
    const colorsMap = new Map();
    vars.forEach((v) => {
        const cName = v.color_name || v.variant_attributes?.color_name;
        const cHex = v.color_hex || v.variant_attributes?.color_hex || "#111827";
        if (cName && !colorsMap.has(cName)) {
            colorsMap.set(cName, { name: cName, hex: cHex });
        }
    });
    return Array.from(colorsMap.values());
};

const extractInitialSizes = (vars) => {
    if (!vars || !Array.isArray(vars) || vars.length === 0) return [];
    const sizesSet = new Set();
    vars.forEach((v) => {
        const sName = v.size || v.variant_attributes?.size;
        if (sName) {
            sizesSet.add(sName);
        }
    });
    return Array.from(sizesSet);
};

export default function FashionVariantMatrixGenerator({
    variants = [],
    onChange = () => { },
    colorImages = {},
    onColorImagesChange = () => { },
    parentImage = null,
    baseBuyPrice = 0,
    baseSellPrice = 0,
    productTitle = "",
    productSku = "",
}) {
    const [selectedColors, setSelectedColors] = useState(() => extractInitialColors(variants));
    const [customColorName, setCustomColorName] = useState("");
    const [customColorHex, setCustomColorHex] = useState("#3b82f6");

    const [selectedSizes, setSelectedSizes] = useState(() => extractInitialSizes(variants));
    const [customSize, setCustomSize] = useState("");

    const [batchStock, setBatchStock] = useState("");
    const [batchSellPrice, setBatchSellPrice] = useState("");

    const isInitialMount = useRef(true);
    const variantsRef = useRef(variants);
    variantsRef.current = variants;

    // Keep selectedColors & selectedSizes in sync if variants prop changes from external source
    useEffect(() => {
        if (variants && variants.length > 0 && selectedColors.length === 0 && selectedSizes.length === 0) {
            const initialC = extractInitialColors(variants);
            const initialS = extractInitialSizes(variants);
            if (initialC.length > 0) setSelectedColors(initialC);
            if (initialS.length > 0) setSelectedSizes(initialS);
        }
    }, [variants]);

    // Add Color
    const handleAddColor = (color) => {
        if (!color.name.trim()) return;
        if (selectedColors.some((c) => c.name.toLowerCase() === color.name.trim().toLowerCase())) return;
        setSelectedColors((prev) => [...prev, { name: color.name.trim(), hex: color.hex || "#000000" }]);
    };

    const handleRemoveColor = (colorName) => {
        setSelectedColors((prev) => prev.filter((c) => c.name !== colorName));
        if (colorImages[colorName]) {
            const updated = { ...colorImages };
            delete updated[colorName];
            onColorImagesChange(updated);
        }
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
        // Skip on initial mount if variants were already loaded
        if (isInitialMount.current) {
            isInitialMount.current = false;
            if (variantsRef.current && variantsRef.current.length > 0) {
                return;
            }
        }

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

                // Preserve previous attributes if already edited
                const existing = (variantsRef.current || []).find(
                    (v) => ((v.color_name || v.variant_attributes?.color_name || "").trim().toLowerCase() === color.name.trim().toLowerCase()) &&
                        ((v.size || v.variant_attributes?.size || "").trim().toUpperCase() === size.trim().toUpperCase())
                );

                newMatrix.push({
                    id: existing?.id,
                    color_name: color.name,
                    color_hex: color.hex,
                    size: size,
                    sku: existing?.sku || generatedSku,
                    barcode: existing?.barcode || generatedBarcode,
                    buy_price: existing?.buy_price !== undefined ? existing.buy_price : baseBuyPrice,
                    sell_price: existing?.sell_price !== undefined ? existing.sell_price : baseSellPrice,
                    stock: existing?.stock !== undefined ? existing.stock : 0,
                    image: existing?.image || null,
                    image_preview: existing?.image_preview || null,
                    has_row_override: Boolean(existing?.has_row_override || existing?.image instanceof File),
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

    // Handle upload photo per color (Bulk Color Image)
    const handleColorImageUpload = (colorName, file) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Ukuran gambar warna maksimal 2MB.");
            return;
        }
        const previewUrl = URL.createObjectURL(file);
        onColorImagesChange({
            ...colorImages,
            [colorName]: file,
            [`${colorName}_preview`]: previewUrl,
        });

        // Also update variants that do not have explicit row override to clear any old row image
        const updatedVariants = variants.map((v) => {
            if ((v.color_name || "").toLowerCase() === colorName.toLowerCase() && !v.has_row_override) {
                return { ...v, image: null, image_preview: null };
            }
            return v;
        });
        onChange(updatedVariants);

        toast.success(`Foto untuk warna "${colorName}" diterapkan ke semua ukurannya.`);
    };

    const handleRemoveColorImage = (colorName) => {
        const updated = { ...colorImages };
        delete updated[colorName];
        delete updated[`${colorName}_preview`];
        onColorImagesChange(updated);

        // Also clear image on variants that do not have row override
        const updatedVariants = variants.map((v) => {
            if ((v.color_name || "").toLowerCase() === colorName.toLowerCase() && !v.has_row_override) {
                return { ...v, image: null, image_preview: null };
            }
            return v;
        });
        onChange(updatedVariants);
    };

    // Handle row-specific image override
    const handleRowImageUpload = (index, file) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Ukuran gambar varian maksimal 2MB.");
            return;
        }
        const previewUrl = URL.createObjectURL(file);
        const updated = [...variants];
        updated[index] = {
            ...updated[index],
            image: file,
            image_preview: previewUrl,
            has_row_override: true,
        };
        onChange(updated);
    };

    const handleClearRowImageOverride = (index) => {
        const updated = [...variants];
        updated[index] = {
            ...updated[index],
            image: null,
            image_preview: null,
            has_row_override: false,
        };
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

    // Helper: determine preview image URL for a variant row
    const getRowImageInfo = (v) => {
        // 1. Explicit row override
        if (v.has_row_override) {
            if (v.image_preview) {
                return { url: v.image_preview, source: "row" };
            }
            if (v.image instanceof File) {
                return { url: URL.createObjectURL(v.image), source: "row" };
            }
            if (typeof v.image === "string" && v.image && !v.image.startsWith("blob:")) {
                return { url: getProductImageUrl(v.image), source: "row" };
            }
        } else {
            if (v.image_preview) {
                return { url: v.image_preview, source: "row" };
            }
            if (v.image instanceof File) {
                return { url: URL.createObjectURL(v.image), source: "row" };
            }
        }

        // 2. Color-level image (new upload preview, File, or existing string URL)
        const cPreview = colorImages[`${v.color_name}_preview`];
        if (cPreview) {
            return { url: cPreview, source: "color" };
        }
        const cFile = colorImages[v.color_name];
        if (cFile instanceof File) {
            return { url: URL.createObjectURL(cFile), source: "color" };
        }
        if (typeof colorImages[v.color_name] === "string" && colorImages[v.color_name] && !colorImages[v.color_name].startsWith("blob:")) {
            return { url: getProductImageUrl(colorImages[v.color_name]), source: "color" };
        }

        // 3. Saved variant image fallback
        if (typeof v.image === "string" && v.image && !v.image.startsWith("blob:")) {
            return { url: getProductImageUrl(v.image), source: "saved" };
        }

        // 4. Parent image fallback
        if (parentImage) {
            const pUrl = typeof parentImage === "string" ? getProductImageUrl(parentImage) : (parentImage instanceof File ? URL.createObjectURL(parentImage) : null);
            if (pUrl) return { url: pUrl, source: "parent" };
        }

        return { url: null, source: "none" };
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
                            Matriks Varian Pakaian & Foto (Warna × Ukuran)
                        </h3>
                        <p className="text-xs text-slate-500">
                            Pilih warna, ukuran, dan tetapkan foto untuk setiap varian atau warna pakaian.
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
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${isSelected
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

                {/* 1.1 Upload Foto per Warna (Color-level Bulk Images) */}
                {selectedColors.length > 0 && (
                    <div className="mt-3 p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <IconPhoto size={15} className="text-primary-500" />
                                Foto per Warna (Otomatis mewarisi ke seluruh ukuran warna ini):
                            </span>
                            <span className="text-[11px] text-slate-400">
                                Format: JPG, PNG, WEBP (Max 2MB)
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                            {selectedColors.map((col) => {
                                const colorPreview =
                                    colorImages[`${col.name}_preview`] ||
                                    (colorImages[col.name] instanceof File
                                        ? URL.createObjectURL(colorImages[col.name])
                                        : typeof colorImages[col.name] === "string" && colorImages[col.name] && !colorImages[col.name].startsWith("blob:")
                                        ? getProductImageUrl(colorImages[col.name])
                                        : null);
                                return (
                                    <div
                                        key={col.name}
                                        className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 gap-2"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="w-3.5 h-3.5 rounded-full border border-slate-300 flex-shrink-0"
                                                style={{ backgroundColor: col.hex }}
                                            />
                                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                                {col.name}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {colorPreview ? (
                                                <div className="relative group w-9 h-9 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                                    <img
                                                        src={colorPreview}
                                                        alt={col.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveColorImage(col.name)}
                                                        className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Hapus foto warna"
                                                    >
                                                        <IconTrash size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-400 text-slate-600 dark:text-slate-300 transition-colors shadow-2xs">
                                                    <IconUpload size={13} className="text-primary-500" />
                                                    <span>+ Foto</span>
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/jpg,image/webp"
                                                        className="hidden"
                                                        onChange={(e) => handleColorImageUpload(col.name, e.target.files[0])}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
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
                                        className={`px-3 py-1 rounded-xl font-bold border transition-all ${isSelected
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
                                    <th className="py-2.5 px-3 w-16 text-center">Foto</th>
                                    <th className="py-2.5 px-3">Varian (Warna & Size)</th>
                                    <th className="py-2.5 px-3">Barcode / Hangtag</th>
                                    <th className="py-2.5 px-3">SKU</th>
                                    <th className="py-2.5 px-3">Harga Jual (Rp)</th>
                                    <th className="py-2.5 px-3">Stok Awal</th>
                                    <th className="py-2.5 px-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {variants.map((v, idx) => {
                                    const imageInfo = getRowImageInfo(v);
                                    return (
                                        <tr key={`${v.color_name}-${v.size}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            {/* Column: Variant Photo */}
                                            <td className="py-2 px-3 text-center">
                                                <div className="relative inline-block group">
                                                    {imageInfo.url ? (
                                                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                                                            <img
                                                                src={imageInfo.url}
                                                                alt={`${v.color_name} ${v.size}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            {/* Overlay on hover */}
                                                            <label
                                                                className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                                                                title="Ganti foto khusus varian ini"
                                                            >
                                                                <IconUpload size={14} />
                                                                <input
                                                                    type="file"
                                                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                                                    className="hidden"
                                                                    onChange={(e) => handleRowImageUpload(idx, e.target.files[0])}
                                                                />
                                                            </label>
                                                        </div>
                                                    ) : (
                                                        <label
                                                            className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary-500 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-primary-600 flex items-center justify-center cursor-pointer transition-colors"
                                                            title="Upload foto varian ini"
                                                        >
                                                            <IconPhoto size={16} />
                                                            <input
                                                                type="file"
                                                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                                                className="hidden"
                                                                onChange={(e) => handleRowImageUpload(idx, e.target.files[0])}
                                                            />
                                                        </label>
                                                    )}

                                                    {/* Badge for source */}
                                                    {imageInfo.source === "row" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleClearRowImageOverride(idx)}
                                                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] shadow-xs"
                                                            title="Hapus foto khusus (gunakan foto warna/induk)"
                                                        >
                                                            <IconX size={10} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Column: Variant name & badge */}
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
                                                    {imageInfo.source === "row" && (
                                                        <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                                                            Kustom
                                                        </span>
                                                    )}
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
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
