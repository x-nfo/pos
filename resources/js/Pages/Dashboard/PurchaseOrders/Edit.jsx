import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, useForm } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import ProductPickerModal from "./Components/ProductPickerModal";
import {
    IconArrowLeft,
    IconDeviceFloppy,
    IconPackage,
    IconPlus,
    IconSparkles,
    IconShoppingCart,
    IconTrash,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

export default function Edit({ order, suppliers = [], categories = [], products = [], warehouses = [] }) {
    const initialItems = (order.items || []).map((item) => {
        const matchedProduct = products.find((p) => p.id === item.product_id);
        const productUnits = Array.isArray(matchedProduct?.units) ? matchedProduct.units : [];

        return {
            product_id: item.product_id,
            product_title: item.product?.title || matchedProduct?.title || `Produk #${item.product_id}`,
            product_sku: item.product?.sku || matchedProduct?.sku || "-",
            units: productUnits,
            unit_id: item.unit_id || null,
            conversion_factor: Number(item.conversion_factor) || 1.0,
            qty_ordered: Number(item.qty_ordered) || 1,
            unit_price: Number(item.unit_price) || 0,
        };
    });

    const { data, setData, put, processing, errors } = useForm({
        supplier_id: order.supplier_id || "",
        warehouse_id: order.warehouse_id || "",
        document_number: order.document_number || "",
        notes: order.notes || "",
        items: initialItems,
    });

    const [showPickerModal, setShowPickerModal] = useState(false);
    const [searchProduct, setSearchProduct] = useState("");
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

        const productUnits = Array.isArray(product.units) ? product.units : [];
        const baseUnit = productUnits.find((u) => u.is_base) || productUnits[0] || null;

        setData("items", [
            ...data.items,
            {
                product_id: product.id,
                product_title: product.title,
                product_sku: product.sku || "-",
                units: productUnits,
                unit_id: baseUnit ? baseUnit.id : null,
                conversion_factor: baseUnit ? Number(baseUnit.conversion_factor) || 1.0 : 1.0,
                qty_ordered: 1,
                unit_price: baseUnit ? Number(baseUnit.buy_price) || 0 : Number(product.buy_price) || 0,
            },
        ]);
        setSearchProduct("");
    };

    const handleBulkAdd = (newItems) => {
        const existingIds = new Set(data.items.map((i) => i.product_id));
        const toAdd = newItems.filter((i) => !existingIds.has(i.product_id));

        if (toAdd.length > 0) {
            setData("items", [...data.items, ...toAdd]);
            toast.success(`${toAdd.length} produk berhasil ditambahkan.`);
        } else {
            toast.info("Semua produk terpilih sudah ada dalam PO.");
        }
    };

    const removeItem = (index) => {
        setData(
            "items",
            data.items.filter((_, i) => i !== index)
        );
    };

    const handleUnitChange = (index, unitId) => {
        const items = [...data.items];
        const item = items[index];
        const selected = (item.units || []).find((u) => u.id === Number(unitId));

        if (selected) {
            items[index] = {
                ...item,
                unit_id: selected.id,
                conversion_factor: Number(selected.conversion_factor) || 1.0,
                unit_price: Number(selected.buy_price) || 0,
            };
        } else {
            items[index] = {
                ...item,
                unit_id: null,
                conversion_factor: 1.0,
            };
        }
        setData("items", items);
    };

    const updateItem = (index, key, value) => {
        const items = [...data.items];
        items[index] = {
            ...items[index],
            [key]: key === "qty_ordered" ? parseInt(value, 10) || 0 : Number(value) || 0,
        };
        setData("items", items);
    };

    const submit = (e) => {
        e.preventDefault();
        if (data.items.length === 0) {
            toast.error("Tambahkan minimal satu item.");
            return;
        }
        put(route("purchase-orders.update", order.id), {
            onError: () => toast.error("Gagal memperbarui purchase order"),
        });
    };

    const total = data.items.reduce((sum, item) => sum + item.qty_ordered * item.unit_price, 0);

    return (
        <>
            <Head title={`Edit ${order.document_number}`} />
            <div className="mb-6">
                <Link
                    href={route("purchase-orders.show", order.id)}
                    className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke detail PO
                </Link>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                    <IconShoppingCart size={28} className="text-primary-500" />
                    Edit Purchase Order ({order.document_number})
                </h1>
            </div>

            <form onSubmit={submit} className="max-w-5xl">
                <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Informasi PO</h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Supplier
                                </label>
                                <select
                                    value={data.supplier_id}
                                    onChange={(e) => setData("supplier_id", e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="">Pilih Supplier</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                {errors.supplier_id && <p className="mt-1 text-xs text-danger-500">{errors.supplier_id}</p>}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Tujuan Gudang
                                </label>
                                <select
                                    value={data.warehouse_id}
                                    onChange={(e) => setData("warehouse_id", e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="">Pilih Gudang</option>
                                    {warehouses.map((w) => (
                                        <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                                    ))}
                                </select>
                                {errors.warehouse_id && <p className="mt-1 text-xs text-danger-500">{errors.warehouse_id}</p>}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Nomor Dokumen
                                </label>
                                <input
                                    type="text"
                                    value={data.document_number}
                                    onChange={(e) => setData("document_number", e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                {errors.document_number && <p className="mt-1 text-xs text-danger-500">{errors.document_number}</p>}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    Catatan
                                </label>
                                <input
                                    type="text"
                                    value={data.notes}
                                    onChange={(e) => setData("notes", e.target.value)}
                                    placeholder="Catatan PO"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                />
                                {errors.notes && <p className="mt-1 text-xs text-danger-500">{errors.notes}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Item Pembelian</h2>
                                <p className="text-xs text-slate-500">Cari produk secara langsung atau pilih banyak item dari katalog.</p>
                            </div>
                            <Button
                                type="button"
                                onClick={() => setShowPickerModal(true)}
                                icon={<IconSparkles size={18} />}
                                className="bg-primary-600 hover:bg-primary-700 text-white shadow-sm"
                                label="Katalog & Pilih Massal"
                            />
                        </div>

                        <div className="mb-4 flex gap-3">
                            <input
                                type="text"
                                value={searchProduct}
                                onChange={(e) => setSearchProduct(e.target.value)}
                                placeholder="Cari cepat nama / SKU / barcode produk..."
                                className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                        </div>
                        {searchProduct && filteredProducts.length > 0 && (
                            <div className="mb-4 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                                {filteredProducts.map((product) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => addItem(product)}
                                        className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm transition hover:border-primary-200 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-700 dark:hover:bg-primary-950/20"
                                    >
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">{product.title}</p>
                                            <p className="text-xs text-slate-500">
                                                {product.sku || "-"} &bull; Stok: {product.stock}
                                                {product.units?.length > 1 && ` • ${product.units.length} Satuan`}
                                            </p>
                                        </div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {formatCurrency(product.buy_price)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {data.items.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Produk</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Satuan (UOM)</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Qty</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Harga Beli</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Subtotal</th>
                                            <th className="w-16 px-3 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.items.map((item, index) => (
                                            <tr key={index} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="px-3 py-3">
                                                    <p className="font-medium text-slate-800 dark:text-slate-200">{item.product_title}</p>
                                                    <p className="text-xs text-slate-500">{item.product_sku}</p>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {item.units && item.units.length > 0 ? (
                                                        <select
                                                            value={item.unit_id || ""}
                                                            onChange={(e) => handleUnitChange(index, e.target.value)}
                                                            className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                        >
                                                            {item.units.map((u) => (
                                                                <option key={u.id} value={u.id}>
                                                                    {u.name} ({u.symbol || u.code}) {u.conversion_factor > 1 ? `@${u.conversion_factor}` : ""}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                            Pcs
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.qty_ordered}
                                                        onChange={(e) => updateItem(index, "qty_ordered", e.target.value)}
                                                        className="h-10 w-20 rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                    />
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="100"
                                                        value={item.unit_price}
                                                        onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                                                        className="h-10 w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 text-right text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                    />
                                                </td>
                                                <td className="px-3 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                                                    {formatCurrency(item.qty_ordered * item.unit_price)}
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(index)}
                                                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-danger-50 hover:text-danger-500"
                                                    >
                                                        <IconTrash size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                                            <td colSpan={4} className="px-3 py-3 text-right font-bold text-slate-800 dark:text-slate-200">Total</td>
                                            <td className="px-3 py-3 text-right font-bold text-primary-600 dark:text-primary-400">{formatCurrency(total)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
                                <IconPackage size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cari produk di atas untuk ditambahkan ke PO.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        <Link
                            href={route("purchase-orders.show", order.id)}
                            className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            Batal
                        </Link>
                        <Button
                            type="submit"
                            icon={<IconDeviceFloppy size={18} />}
                            className="bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                            label={processing ? "Menyimpan..." : "Simpan Perubahan"}
                            disabled={processing}
                        />
                    </div>
                </div>
            </form>

            <ProductPickerModal
                show={showPickerModal}
                onClose={() => setShowPickerModal(false)}
                products={products}
                categories={categories}
                existingItems={data.items}
                onAddProducts={handleBulkAdd}
            />
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;

