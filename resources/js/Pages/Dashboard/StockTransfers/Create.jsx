import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, useForm } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import StockTransferProductPickerModal from "./Components/StockTransferProductPickerModal";
import {
    IconArrowLeft,
    IconArrowsLeftRight,
    IconPlus,
    IconTrash,
    IconPackage,
    IconAlertCircle,
    IconSparkles,
    IconSearch,
    IconInfoCircle,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

export default function Create({ warehouses, categories = [], products = [] }) {
    const { data, setData, post, processing, errors } = useForm({
        source_warehouse_id: "",
        destination_warehouse_id: "",
        document_number: "",
        notes: "",
        items: [],
    });

    const [searchProduct, setSearchProduct] = useState("");
    const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);

    const getSourceStock = (product, sourceId = data.source_warehouse_id) => {
        if (!sourceId) return product.stock ?? 0;
        const wh = product.warehouses?.find((w) => String(w.id) === String(sourceId));
        return wh ? (wh.pivot?.stock ?? 0) : 0;
    };

    const filteredProducts = products.filter(
        (p) =>
            p.title.toLowerCase().includes(searchProduct.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(searchProduct.toLowerCase())) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchProduct.toLowerCase()))
    );

    const addItem = (product) => {
        if (data.items.some((i) => i.product_id === product.id)) {
            toast.error("Produk sudah ada di daftar.");
            return;
        }
        const sourceStock = getSourceStock(product);
        const productUnits = Array.isArray(product.units) ? product.units : [];
        const baseUnit = productUnits.find((u) => u.is_base) || productUnits[0] || null;

        setData("items", [
            ...data.items,
            {
                product_id: product.id,
                product_title: product.title,
                product_sku: product.sku || "-",
                available_stock: sourceStock,
                units: productUnits,
                unit_id: baseUnit ? baseUnit.id : null,
                unit_name: baseUnit?.name || "Pcs",
                unit_symbol: baseUnit?.symbol || baseUnit?.code || "pcs",
                conversion_factor: baseUnit ? Number(baseUnit.conversion_factor) || 1.0 : 1.0,
                qty: 1,
            },
        ]);
        setSearchProduct("");
    };

    const handleAddProductsFromModal = (newItems) => {
        const existingIds = new Set(data.items.map((i) => i.product_id));
        const toAdd = newItems.filter((item) => !existingIds.has(item.product_id));

        if (toAdd.length === 0) {
            toast.error("Produk yang dipilih sudah ada di dalam daftar transfer.");
            return;
        }

        setData("items", [...data.items, ...toAdd]);
        toast.success(`${toAdd.length} produk berhasil ditambahkan ke daftar transfer.`);
    };

    const removeItem = (index) => setData("items", data.items.filter((_, i) => i !== index));

    const updateItemQty = (index, value) => {
        const items = [...data.items];
        items[index] = { ...items[index], qty: Math.max(1, parseInt(value, 10) || 1) };
        setData("items", items);
    };

    const handleUnitChange = (index, unitId) => {
        const items = [...data.items];
        const item = items[index];
        const selected = (item.units || []).find((u) => u.id === Number(unitId));

        if (selected) {
            items[index] = {
                ...item,
                unit_id: selected.id,
                unit_name: selected.name,
                unit_symbol: selected.symbol || selected.code,
                conversion_factor: Number(selected.conversion_factor) || 1.0,
            };
        } else {
            items[index] = {
                ...item,
                unit_id: null,
                unit_name: "Pcs",
                unit_symbol: "pcs",
                conversion_factor: 1.0,
            };
        }
        setData("items", items);
    };

    const handleSourceWarehouseChange = (whId) => {
        setData((prev) => {
            const updatedItems = prev.items.map((item) => {
                const prod = products.find((p) => p.id === item.product_id);
                const wh = prod?.warehouses?.find((w) => String(w.id) === String(whId));
                return {
                    ...item,
                    available_stock: wh ? (wh.pivot?.stock ?? 0) : 0,
                };
            });
            return {
                ...prev,
                source_warehouse_id: whId,
                items: updatedItems,
            };
        });
    };

    const submit = (e) => {
        e.preventDefault();
        if (data.items.length === 0) {
            toast.error("Tambahkan minimal satu item transfer.");
            return;
        }
        if (data.source_warehouse_id === data.destination_warehouse_id) {
            toast.error("Gudang asal dan tujuan harus berbeda.");
            return;
        }

        const anyOver = data.items.some((item) => {
            const baseQty = (item.qty || 1) * (Number(item.conversion_factor) || 1.0);
            return data.source_warehouse_id && baseQty > item.available_stock;
        });
        if (anyOver) {
            toast.error("Terdapat item transfer yang melebihi saldo stok di gudang asal.");
            return;
        }

        post(route("stock-transfers.store"), {
            onError: () => toast.error("Gagal membuat transfer stok."),
        });
    };

    const warehousesExcept = (excludeId) => warehouses.filter((w) => String(w.id) !== String(excludeId));
    const selectedSourceWarehouse = warehouses.find((w) => String(w.id) === String(data.source_warehouse_id));

    // Summary calculation
    const totalItems = data.items.length;
    const totalBaseUnits = data.items.reduce(
        (sum, item) => sum + (Number(item.qty) || 1) * (Number(item.conversion_factor) || 1.0),
        0
    );

    return (
        <>
            <Head title="Transfer Stok Baru" />
            <div className="mb-6">
                <Link
                    href={route("stock-transfers.index")}
                    className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                    <IconArrowLeft size={16} /> Kembali ke daftar transfer
                </Link>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                    <IconArrowsLeftRight size={28} className="text-primary-500" />
                    Transfer Stok Baru
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Transfer stok antar gudang dengan ukuran satuan (UOM) sesuai data produk tanpa perlu menghitung konversi manual.
                </p>
            </div>

            <form onSubmit={submit} className="max-w-6xl">
                <div className="space-y-6">
                    {/* Warehouse & Document Information */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Informasi Transfer</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Gudang Asal <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={data.source_warehouse_id}
                                    onChange={(e) => handleSourceWarehouseChange(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="">Pilih Gudang Asal</option>
                                    {warehouses.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.code} — {w.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.source_warehouse_id && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.source_warehouse_id}</p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Gudang Tujuan <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={data.destination_warehouse_id}
                                    onChange={(e) => setData("destination_warehouse_id", e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="">Pilih Gudang Tujuan</option>
                                    {warehousesExcept(data.source_warehouse_id).map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.code} — {w.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.destination_warehouse_id && (
                                    <p className="mt-1 text-xs text-danger-500">{errors.destination_warehouse_id}</p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Nomor Dokumen
                                </label>
                                <input
                                    type="text"
                                    value={data.document_number}
                                    onChange={(e) => setData("document_number", e.target.value)}
                                    placeholder="Kosongkan auto-generate"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Catatan
                                </label>
                                <input
                                    type="text"
                                    value={data.notes}
                                    onChange={(e) => setData("notes", e.target.value)}
                                    placeholder="Opsional (cth: Restok mingguan)"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Products and UOM Item Selection */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Item Transfer</h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Pilih produk dan ukuran satuan kemasan (Dus, Pcs, Karton, dll.) sesuai data master produk.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    icon={<IconSparkles size={16} className="text-primary-500" />}
                                    label="Katalog & Pilih Massal"
                                    onClick={() => setIsPickerModalOpen(true)}
                                    className="text-xs h-10 border-primary-200 bg-primary-50/50 hover:bg-primary-50 text-primary-700 dark:border-primary-800/40 dark:bg-primary-950/20 dark:text-primary-300"
                                />
                                {selectedSourceWarehouse && (
                                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        <IconPackage size={15} />
                                        {selectedSourceWarehouse.name}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Quick Search Input */}
                        <div className="relative mb-4">
                            <input
                                type="text"
                                value={searchProduct}
                                onChange={(e) => setSearchProduct(e.target.value)}
                                placeholder="Cari nama produk, SKU, atau barcode untuk menambahkan cepat..."
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-10 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                                <IconSearch size={18} />
                            </div>
                        </div>

                        {/* Quick Search Results Dropdown */}
                        {searchProduct && filteredProducts.length > 0 && (
                            <div className="mb-4 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                                {filteredProducts.map((product) => {
                                    const sourceStock = getSourceStock(product);
                                    const hasUnits = product.units && product.units.length > 0;

                                    return (
                                        <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => addItem(product)}
                                            className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 text-left text-sm transition hover:border-primary-300 hover:bg-primary-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-700 dark:hover:bg-primary-950/20"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {product.title}
                                                    </p>
                                                    {hasUnits && (
                                                        <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                                                            {product.units.map((u) => u.symbol || u.code).join(", ")}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    SKU: {product.sku || "-"} &bull;{" "}
                                                    <span
                                                        className={
                                                            sourceStock <= 0
                                                                ? "text-rose-500 font-semibold"
                                                                : "text-emerald-600 dark:text-emerald-400 font-semibold"
                                                        }
                                                    >
                                                        Saldo di {selectedSourceWarehouse ? selectedSourceWarehouse.code : "Asal"}: {sourceStock} pcs
                                                    </span>
                                                </p>
                                            </div>
                                            <span className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 shadow-sm border border-primary-200 dark:bg-slate-700 dark:border-slate-600 dark:text-primary-300">
                                                + Tambah
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Items Table — Exactly like Purchase Order */}
                        {data.items.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="px-4 py-3 text-left">Produk</th>
                                            <th className="px-3 py-3 text-left w-48">Satuan (UOM)</th>
                                            <th className="px-3 py-3 text-right">Saldo Asal</th>
                                            <th className="px-3 py-3 text-right w-44">Qty Transfer</th>
                                            <th className="w-12 px-3 py-3 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                        {data.items.map((item, index) => {
                                            const factor = Number(item.conversion_factor) || 1.0;
                                            const totalBaseQty = Math.round((item.qty || 1) * factor);
                                            const isOver = data.source_warehouse_id && totalBaseQty > item.available_stock;
                                            const availableInSelectedUnit = factor > 1 ? Math.floor(item.available_stock / factor) : item.available_stock;

                                            return (
                                                <tr
                                                    key={item.product_id}
                                                    className={`transition-colors ${
                                                        isOver
                                                            ? "bg-rose-50/40 dark:bg-rose-950/20"
                                                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                                                    }`}
                                                >
                                                    {/* Product Details */}
                                                    <td className="px-4 py-3.5">
                                                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                                                            {item.product_title}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            SKU: {item.product_sku}
                                                        </p>
                                                    </td>

                                                    {/* Clean UOM Dropdown (Matches Product Data Only) */}
                                                    <td className="px-3 py-3.5">
                                                        {item.units && item.units.length > 0 ? (
                                                            <select
                                                                value={item.unit_id || ""}
                                                                onChange={(e) => handleUnitChange(index, e.target.value)}
                                                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                            >
                                                                {item.units.map((u) => (
                                                                    <option key={u.id} value={u.id}>
                                                                        {u.name} ({u.symbol || u.code}) {u.conversion_factor > 1 ? `@${u.conversion_factor}` : ""}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                                Pcs
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Source Warehouse Balance */}
                                                    <td className="px-3 py-3.5 text-right">
                                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                            {data.source_warehouse_id
                                                                ? `${item.available_stock} pcs`
                                                                : "-"}
                                                        </p>
                                                        {data.source_warehouse_id && factor > 1 && (
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                                ({availableInSelectedUnit} {item.unit_symbol})
                                                            </p>
                                                        )}
                                                    </td>

                                                    {/* Qty Input with Instant Equivalence */}
                                                    <td className="px-3 py-3.5 text-right">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.qty}
                                                                    onChange={(e) => updateItemQty(index, e.target.value)}
                                                                    className={`h-10 w-24 rounded-lg border px-3 text-right text-sm font-bold outline-none transition focus:ring-2 dark:bg-slate-800 dark:text-slate-200 ${
                                                                        isOver
                                                                            ? "border-rose-400 bg-rose-50/60 text-rose-700 focus:border-rose-500 focus:ring-rose-500/20"
                                                                            : "border-slate-200 bg-slate-50 text-slate-800 focus:border-primary-500 focus:ring-primary-500/20 dark:border-slate-700"
                                                                    }`}
                                                                />
                                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 min-w-[36px] text-left">
                                                                    {item.unit_symbol || "pcs"}
                                                                </span>
                                                            </div>
                                                            {factor > 1 && (
                                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                                    = {totalBaseQty} pcs
                                                                </span>
                                                            )}
                                                            {isOver && (
                                                                <span className="flex items-center gap-1 text-[11px] text-rose-500 font-medium">
                                                                    <IconAlertCircle size={12} />
                                                                    Kurang {totalBaseQty - item.available_stock} pcs
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Delete Button */}
                                                    <td className="px-3 py-3.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(index)}
                                                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
                                                            title="Hapus item"
                                                        >
                                                            <IconTrash size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Table Footer Summary */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-xs gap-2">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <IconInfoCircle size={16} className="text-primary-500" />
                                        <span>
                                            Total <strong>{totalItems}</strong> macam produk &bull; Akumulasi kuantitas setara <strong>{totalBaseUnits}</strong> unit dasar (pcs)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 dark:text-slate-400">
                                            Status:
                                        </span>
                                        <span className="inline-flex rounded-full bg-slate-200 dark:bg-slate-700 px-2.5 py-0.5 font-semibold text-slate-700 dark:text-slate-300">
                                            Draft
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                                <IconPackage size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                    Belum ada produk dalam daftar transfer.
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    Gunakan tombol <strong>Katalog & Pilih Massal</strong> atau cari produk melalui kolom di atas.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Link
                            href={route("stock-transfers.index")}
                            className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            Batal
                        </Link>
                        <Button
                            type="submit"
                            icon={<IconPlus size={18} />}
                            className="bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                            label={processing ? "Menyimpan..." : "Simpan Draft Transfer"}
                            disabled={processing}
                        />
                    </div>
                </div>
            </form>

            {/* Modal Pilih Massal Produk Sesuai Data Produk (UOM) */}
            <StockTransferProductPickerModal
                show={isPickerModalOpen}
                onClose={() => setIsPickerModalOpen(false)}
                products={products}
                categories={categories}
                existingItems={data.items}
                sourceWarehouseId={data.source_warehouse_id}
                sourceWarehouseName={selectedSourceWarehouse?.name || ""}
                onAddProducts={handleAddProductsFromModal}
            />
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;
