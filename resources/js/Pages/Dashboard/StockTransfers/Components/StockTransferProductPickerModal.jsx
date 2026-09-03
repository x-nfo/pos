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
    IconSparkles,
    IconAlertCircle,
} from "@tabler/icons-react";

export default function StockTransferProductPickerModal({
    show = false,
    onClose = () => {},
    products = [],
    categories = [],
    existingItems = [],
    sourceWarehouseId = "",
    sourceWarehouseName = "",
    onAddProducts = () => {},
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

    // Row custom inputs: { [productId]: { unit_id, conversion_factor, qty } }
    const [rowConfigs, setRowConfigs] = useState({});

    const getProductSourceStock = (product) => {
        if (!sourceWarehouseId) return product.stock ?? 0;
        const wh = product.warehouses?.find((w) => String(w.id) === String(sourceWarehouseId));
        return wh ? (wh.pivot?.stock ?? 0) : 0;
    };

    // Reset or initialize state when modal opens
    useEffect(() => {
        if (show) {
            setSelectedIds(new Set());
            const configs = {};
            products.forEach((p) => {
                const units = Array.isArray(p.units) ? p.units : [];
                const baseUnit = units.find((u) => u.is_base) || units[0] || null;
                configs[p.id] = {
                    unit_id: baseUnit ? baseUnit.id : null,
                    conversion_factor: baseUnit ? Number(baseUnit.conversion_factor) || 1.0 : 1.0,
                    qty: 1,
                };
            });
            setRowConfigs(configs);
        }
    }, [show, products]);

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

    const updateRowQty = (productId, value) => {
        setRowConfigs((prev) => {
            const current = prev[productId] || {
                unit_id: null,
                conversion_factor: 1.0,
                qty: 1,
            };
            return {
                ...prev,
                [productId]: {
                    ...current,
                    qty: Math.max(1, parseInt(value, 10) || 1),
                },
            };
        });
    };

    const handleUnitChange = (product, unitId) => {
        const units = Array.isArray(product.units) ? product.units : [];
        const selectedUnit = units.find((u) => u.id === Number(unitId));

        setRowConfigs((prev) => ({
            ...prev,
            [product.id]: {
                ...(prev[product.id] || {}),
                unit_id: selectedUnit ? selectedUnit.id : null,
                conversion_factor: selectedUnit ? Number(selectedUnit.conversion_factor) || 1.0 : 1.0,
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

            const sourceStock = getProductSourceStock(product);

            itemsToAdd.push({
                product_id: product.id,
                product_title: product.title,
                product_sku: product.sku || "-",
                available_stock: sourceStock,
                units: units,
                unit_id: selectedUnit ? selectedUnit.id : baseUnit ? baseUnit.id : null,
                unit_name: selectedUnit ? selectedUnit.name : baseUnit ? baseUnit.name : "Pcs",
                unit_symbol: selectedUnit ? (selectedUnit.symbol || selectedUnit.code) : baseUnit ? (baseUnit.symbol || baseUnit.code) : "pcs",
                conversion_factor: selectedUnit
                    ? Number(selectedUnit.conversion_factor) || 1.0
                    : baseUnit
                    ? Number(baseUnit.conversion_factor) || 1.0
                    : 1.0,
                qty: Number(config.qty) || 1,
            });
        });

        if (itemsToAdd.length > 0) {
            onAddProducts(itemsToAdd);
        }
        onClose();
    };

    // Calculate total base quantity of selected products
    const totalSelectedBaseQty = useMemo(() => {
        let total = 0;
        selectedIds.forEach((id) => {
            const config = rowConfigs[id] || {};
            const factor = Number(config.conversion_factor) || 1.0;
            const qty = Number(config.qty) || 1;
            total += qty * factor;
        });
        return total;
    }, [selectedIds, rowConfigs]);

    return (
        <Modal
            show={show}
            onClose={onClose}
            maxWidth="5xl"
            title="Katalog & Pilih Produk Transfer"
            icon={<IconSparkles size={20} className="text-primary-500" />}
        >
            <div className="p-6 space-y-4">
                {/* Search and Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="relative md:col-span-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari berdasarkan Judul, SKU, atau Barcode..."
                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-10 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
                            <option value="unadded">Belum Ada di Transfer</option>
                            <option value="added">Sudah Ada di Transfer</option>
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
                                    />
                                </th>
                                <th className="p-3">Produk</th>
                                <th className="p-3">Kategori</th>
                                <th className="p-3 text-right">Saldo Asal</th>
                                <th className="p-3 w-44">Ukuran Satuan (UOM)</th>
                                <th className="p-3 w-28 text-right">Qty</th>
                                <th className="p-3 text-right">Setara Dasar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-slate-400">
                                        Tidak ada produk yang cocok dengan pencarian / filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => {
                                    const isAdded = existingProductIds.has(Number(product.id));
                                    const isSelected = selectedIds.has(product.id);
                                    const config = rowConfigs[product.id] || {
                                        unit_id: null,
                                        conversion_factor: 1.0,
                                        qty: 1,
                                    };
                                    const sourceStock = getProductSourceStock(product);
                                    const factor = Number(config.conversion_factor) || 1.0;
                                    const totalBase = (config.qty || 1) * factor;
                                    const isOverStock = sourceWarehouseId && totalBase > sourceStock;

                                    return (
                                        <tr
                                            key={product.id}
                                            className={`transition-colors ${
                                                isAdded
                                                    ? "bg-slate-50/50 dark:bg-slate-800/30 opacity-60"
                                                    : isSelected
                                                    ? "bg-primary-50/40 dark:bg-primary-950/20"
                                                    : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                                            }`}
                                        >
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    disabled={isAdded}
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(product.id)}
                                                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-40"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <div className="font-semibold text-slate-800 dark:text-slate-100">
                                                    {product.title}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    SKU: {product.sku || "-"}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    {product.category_name}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                                <span className={sourceStock <= 0 ? "text-rose-500 font-bold" : ""}>
                                                    {sourceWarehouseId ? `${sourceStock} pcs` : `${product.stock} pcs`}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                {product.units && product.units.length > 0 ? (
                                                    <select
                                                        disabled={isAdded}
                                                        value={config.unit_id || ""}
                                                        onChange={(e) => handleUnitChange(product, e.target.value)}
                                                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50"
                                                    >
                                                        {product.units.map((u) => (
                                                            <option key={u.id} value={u.id}>
                                                                {u.name} ({u.symbol || u.code}) {u.conversion_factor > 1 ? `@${u.conversion_factor}` : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                        Pcs
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    disabled={isAdded}
                                                    value={config.qty}
                                                    onChange={(e) => updateRowQty(product.id, e.target.value)}
                                                    className="h-9 w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right text-xs font-bold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50"
                                                />
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                                    {totalBase} unit
                                                </div>
                                                {isOverStock && (
                                                    <div className="text-[10px] text-rose-500 font-semibold flex items-center justify-end gap-0.5 mt-0.5">
                                                        <IconAlertCircle size={11} /> Melebihi saldo
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Modal Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedIds.size > 0 ? (
                            <span>
                                Terpilih: <strong>{selectedIds.size} produk</strong> &bull; Total kuantitas:{" "}
                                <strong>{totalSelectedBaseQty} unit dasar</strong>
                            </span>
                        ) : (
                            <span>Pilih produk yang ingin ditransfer sekaligus dengan satuan yang sesuai.</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            label="Batal"
                            onClick={onClose}
                            className="text-xs h-9 px-4"
                        />
                        <Button
                            type="button"
                            variant="primary"
                            icon={<IconPlus size={16} />}
                            label={`Tambahkan (${selectedIds.size}) ke Transfer`}
                            disabled={selectedIds.size === 0}
                            onClick={handleConfirm}
                            className="text-xs h-9 px-4 bg-primary-500 hover:bg-primary-600 text-white"
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
