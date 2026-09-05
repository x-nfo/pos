import React, { useState, useMemo, useEffect } from "react";
import Modal from "@/Components/Dashboard/Modal";
import Button from "@/Components/Dashboard/Button";
import {
    IconSearch,
    IconFilter,
    IconCheck,
    IconX,
    IconPackage,
    IconPlus,
    IconShoppingCart,
    IconSparkles,
} from "@tabler/icons-react";

const formatCurrency = (val = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(val) || 0);

const calculateSuggestedQty = (product, conversionFactor = 1.0, warehouseId = null) => {
    const factor = Number(conversionFactor) || 1.0;
    const maxStock = Number(product.max_stock) || 0;
    if (maxStock <= 0) {
        return 1;
    }

    const currentStock = (warehouseId && product.warehouse_stocks && product.warehouse_stocks[warehouseId] !== undefined)
        ? Number(product.warehouse_stocks[warehouseId]) || 0
        : Number(product.stock) || 0;

    const neededBase = Math.max(0, maxStock - currentStock);
    if (neededBase <= 0) {
        return 1;
    }

    return Math.max(1, Math.ceil(neededBase / factor));
};

export default function ProductPickerModal({
    show = false,
    onClose = () => {},
    products = [],
    categories = [],
    existingItems = [],
    onAddProducts = () => {},
    warehouseId = null,
}) {
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'unadded' | 'added'

    // Map existing items product IDs for quick lookup
    const existingProductIds = useMemo(() => {
        return new Set(existingItems.map((item) => Number(item.product_id)));
    }, [existingItems]);

    // Selected product IDs in modal
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Row custom inputs: { [productId]: { unit_id, conversion_factor, qty_ordered, unit_price } }
    const [rowConfigs, setRowConfigs] = useState({});

    // Reset or initialize state when modal opens
    useEffect(() => {
        if (show) {
            setSelectedIds(new Set());
            // Pre-initialize row configs with default unit and buy_price
            const configs = {};
            products.forEach((p) => {
                const units = Array.isArray(p.units) ? p.units : [];
                const baseUnit = units.find((u) => u.is_base) || units[0] || null;
                const conversionFactor = baseUnit ? Number(baseUnit.conversion_factor) || 1.0 : 1.0;
                const defaultQty = calculateSuggestedQty(p, conversionFactor, warehouseId);
                configs[p.id] = {
                    unit_id: baseUnit ? baseUnit.id : null,
                    conversion_factor: conversionFactor,
                    qty_ordered: defaultQty,
                    unit_price: baseUnit ? Number(baseUnit.buy_price) || 0 : Number(p.buy_price) || 0,
                };
            });
            setRowConfigs(configs);
        }
    }, [show, products, warehouseId]);

    // Filter products
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const matchesSearch =
                !search ||
                (p.title || "").toLowerCase().includes(search.toLowerCase()) ||
                (p.sku || "").toLowerCase().includes(search.toLowerCase()) ||
                (p.barcode || "").toLowerCase().includes(search.toLowerCase());

            const matchesCategory =
                selectedCategory === "all" || String(p.category_id) === String(selectedCategory);

            const isAlreadyAdded = existingProductIds.has(Number(p.id));
            const matchesStatus =
                filterStatus === "all" ||
                (filterStatus === "unadded" && !isAlreadyAdded) ||
                (filterStatus === "added" && isAlreadyAdded);

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [products, search, selectedCategory, filterStatus, existingProductIds]);

    const toggleSelect = (productId) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(productId)) {
                next.delete(productId);
            } else {
                next.add(productId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        const visibleUnadded = filteredProducts.filter((p) => !existingProductIds.has(Number(p.id)));
        const allSelected = visibleUnadded.length > 0 && visibleUnadded.every((p) => selectedIds.has(p.id));

        if (allSelected) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                visibleUnadded.forEach((p) => next.delete(p.id));
                return next;
            });
        } else {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                visibleUnadded.forEach((p) => next.add(p.id));
                return next;
            });
        }
    };

    const updateRowConfig = (productId, key, value) => {
        setRowConfigs((prev) => {
            const current = prev[productId] || {
                unit_id: null,
                conversion_factor: 1.0,
                qty_ordered: 1,
                unit_price: 0,
            };
            return {
                ...prev,
                [productId]: {
                    ...current,
                    [key]:
                        key === "qty_ordered"
                            ? Math.max(1, parseInt(value, 10) || 1)
                            : key === "unit_price"
                            ? Math.max(0, Number(value) || 0)
                            : value,
                },
            };
        });
    };

    const handleUnitChange = (product, unitId) => {
        const units = Array.isArray(product.units) ? product.units : [];
        const selectedUnit = units.find((u) => u.id === Number(unitId));
        const conversionFactor = selectedUnit ? Number(selectedUnit.conversion_factor) || 1.0 : 1.0;
        const newQty = calculateSuggestedQty(product, conversionFactor, warehouseId);

        setRowConfigs((prev) => ({
            ...prev,
            [product.id]: {
                ...(prev[product.id] || {}),
                unit_id: selectedUnit ? selectedUnit.id : null,
                conversion_factor: conversionFactor,
                qty_ordered: newQty,
                unit_price: selectedUnit ? Number(selectedUnit.buy_price) || 0 : Number(product.buy_price) || 0,
            },
        }));
    };

    const handleConfirm = () => {
        const itemsToAdd = [];
        selectedIds.forEach((productId) => {
            const product = products.find((p) => p.id === productId);
            if (!product) return;

            const config = rowConfigs[productId] || {};
            const units = Array.isArray(product.units) ? product.units : [];
            const selectedUnit = units.find((u) => u.id === Number(config.unit_id));
            const baseUnit = units.find((u) => u.is_base) || units[0] || null;

            itemsToAdd.push({
                product_id: product.id,
                product_title: product.title,
                product_sku: product.sku || "-",
                units: units,
                unit_id: selectedUnit ? selectedUnit.id : baseUnit ? baseUnit.id : null,
                conversion_factor: selectedUnit
                    ? Number(selectedUnit.conversion_factor) || 1.0
                    : baseUnit
                    ? Number(baseUnit.conversion_factor) || 1.0
                    : 1.0,
                qty_ordered: Number(config.qty_ordered) || 1,
                unit_price:
                    Number(config.unit_price) >= 0
                        ? Number(config.unit_price)
                        : selectedUnit
                        ? Number(selectedUnit.buy_price) || 0
                        : Number(product.buy_price) || 0,
                max_stock: Number(product.max_stock) || 0,
                stock:
                    warehouseId && product.warehouse_stocks && product.warehouse_stocks[warehouseId] !== undefined
                        ? product.warehouse_stocks[warehouseId]
                        : (product.stock || 0),
            });
        });

        if (itemsToAdd.length > 0) {
            onAddProducts(itemsToAdd);
        }
        onClose();
    };

    // Calculate preview summary of selected items
    const selectedSummary = useMemo(() => {
        let totalNominal = 0;
        let totalQty = 0;

        selectedIds.forEach((id) => {
            const config = rowConfigs[id];
            if (config) {
                const qty = Number(config.qty_ordered) || 1;
                const price = Number(config.unit_price) || 0;
                totalNominal += qty * price;
                totalQty += qty;
            }
        });

        return { count: selectedIds.size, totalQty, totalNominal };
    }, [selectedIds, rowConfigs]);

    return (
        <Modal
            show={show}
            onClose={onClose}
            title="Katalog & Pilih Produk Massal"
            icon={<IconSparkles size={20} />}
            maxWidth="5xl"
        >
            <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nama, SKU, barcode..."
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        />
                        {search ? (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <IconX size={16} />
                            </button>
                        ) : (
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                                <IconSearch size={16} />
                            </div>
                        )}
                    </div>

                    <div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                            <option value="all">Semua Kategori</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                            <option value="all">Semua Status Produk</option>
                            <option value="unadded">Belum Ada di PO</option>
                            <option value="added">Sudah Ada di PO</option>
                        </select>
                    </div>
                </div>

                {/* Table Products List */}
                <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                            <tr>
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={
                                            filteredProducts.length > 0 &&
                                            filteredProducts
                                                .filter((p) => !existingProductIds.has(Number(p.id)))
                                                .every((p) => selectedIds.has(p.id)) &&
                                            filteredProducts.some((p) => !existingProductIds.has(Number(p.id)))
                                        }
                                        onChange={toggleSelectAll}
                                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                        title="Pilih Semua Produk yang Belum Ada di PO"
                                    />
                                </th>
                                <th className="p-3">Produk</th>
                                <th className="p-3">Kategori</th>
                                <th className="p-3 text-center">Stok</th>
                                <th className="p-3">Satuan (UOM)</th>
                                <th className="p-3 w-28 text-right">Harga Beli</th>
                                <th className="p-3 w-24 text-right">Qty</th>
                                <th className="p-3 w-32 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {filteredProducts.length > 0 ? (
                                filteredProducts.map((product) => {
                                    const isAlreadyInPO = existingProductIds.has(Number(product.id));
                                    const isChecked = selectedIds.has(product.id);
                                    const config = rowConfigs[product.id] || {
                                        unit_id: null,
                                        conversion_factor: 1.0,
                                        qty_ordered: 1,
                                        unit_price: product.buy_price || 0,
                                    };
                                    const subtotal = (config.qty_ordered || 1) * (config.unit_price || 0);

                                    return (
                                        <tr
                                            key={product.id}
                                            className={`transition-colors ${
                                                isAlreadyInPO
                                                    ? "bg-slate-50/60 dark:bg-slate-800/30 opacity-75"
                                                    : isChecked
                                                    ? "bg-primary-50/40 dark:bg-primary-950/30"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            }`}
                                        >
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleSelect(product.id)}
                                                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                                {product.title}
                                                            </p>
                                                            {isAlreadyInPO && (
                                                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                                    Sudah di PO
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500">
                                                            SKU: {product.sku || "-"}
                                                            {product.barcode && ` • Barcode: ${product.barcode}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-xs text-slate-600 dark:text-slate-400">
                                                <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                    {product.category_name || "Umum"}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {(() => {
                                                    const displayedStock =
                                                        warehouseId && product.warehouse_stocks && product.warehouse_stocks[warehouseId] !== undefined
                                                            ? product.warehouse_stocks[warehouseId]
                                                            : product.stock;
                                                    return (
                                                        <>
                                                            <span
                                                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                                    displayedStock > 10
                                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                                        : displayedStock > 0
                                                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                                                        : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                                                }`}
                                                            >
                                                                {displayedStock}
                                                            </span>
                                                            {product.max_stock > 0 && (
                                                                <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">
                                                                    Target: {product.max_stock}
                                                                </span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                            <td className="p-3">
                                                {product.units && product.units.length > 0 ? (
                                                    <select
                                                        value={config.unit_id || ""}
                                                        onChange={(e) => handleUnitChange(product, e.target.value)}
                                                        className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                    >
                                                        {product.units.map((u) => (
                                                            <option key={u.id} value={u.id}>
                                                                {u.name} ({u.symbol || u.code}) {u.conversion_factor > 1 ? `@${u.conversion_factor}` : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs text-slate-500">Pcs</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="100"
                                                    value={config.unit_price}
                                                    onChange={(e) => updateRowConfig(product.id, "unit_price", e.target.value)}
                                                    className="h-8 w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right text-xs text-slate-800 outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                />
                                            </td>
                                            <td className="p-3 text-right">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={config.qty_ordered}
                                                    onChange={(e) => updateRowConfig(product.id, "qty_ordered", e.target.value)}
                                                    className="h-8 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right text-xs text-slate-800 outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                />
                                            </td>
                                            <td className="p-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                                                {formatCurrency(subtotal)}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400">
                                        <IconPackage size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                                        <p className="mt-2 text-sm">Tidak ada produk yang sesuai dengan filter.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Action Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                            <IconCheck size={16} />
                            {selectedSummary.count} Produk Terpilih
                        </span>
                        {selectedSummary.count > 0 && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Total Estimasi:{" "}
                                <strong className="text-slate-800 dark:text-slate-200">
                                    {formatCurrency(selectedSummary.totalNominal)}
                                </strong>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            Batal
                        </button>
                        <Button
                            type="button"
                            onClick={handleConfirm}
                            disabled={selectedSummary.count === 0}
                            icon={<IconPlus size={18} />}
                            className="bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30 disabled:opacity-50"
                            label={`Tambahkan (${selectedSummary.count}) ke PO`}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
