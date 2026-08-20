import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { router } from "@inertiajs/react";
import {
    IconFileInvoice,
    IconCamera,
    IconPhoto,
    IconTrash,
    IconLoader2,
    IconSparkles,
    IconCheck,
    IconAlertCircle,
    IconRefresh,
    IconPlus,
    IconBuildingStore,
    IconCalendar,
    IconPercentage,
    IconBox,
} from "@tabler/icons-react";
import Modal from "@/Components/Dashboard/Modal";
import { compressImage } from "@/Utils/compressImage";

export default function InvoiceBatchOcrModal({
    isOpen,
    onClose,
    onSuccess,
    categories = [],
}) {
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [scanError, setScanError] = useState(null);

    // Invoice parsed metadata & items
    const [invoiceMeta, setInvoiceMeta] = useState({
        invoice_number: "",
        supplier_name: "",
        invoice_date: "",
        total_amount: 0,
    });
    const [items, setItems] = useState([]);
    const [bulkMarginPercent, setBulkMarginPercent] = useState(20);
    const [bulkCategory, setBulkCategory] = useState("");

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setImagePreview(null);
            setImageFile(null);
            setIsScanning(false);
            setIsSubmitting(false);
            setScanError(null);
            setItems([]);
            setInvoiceMeta({
                invoice_number: "",
                supplier_name: "",
                invoice_date: "",
                total_amount: 0,
            });
        }
    }, [isOpen]);

    const handleFileInputChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await handleImageProcess(file);
        }
        e.target.value = "";
    };

    const handleImageProcess = async (file) => {
        if (!file) return;
        setScanError(null);
        setItems([]);

        try {
            const compressed = await compressImage(file, {
                maxWidth: 1600,
                maxHeight: 1600,
                quality: 0.88,
            });

            setImageFile(compressed.file);
            setImagePreview(URL.createObjectURL(compressed.file));
            await runInvoiceOcr(compressed.file);
        } catch (err) {
            console.error("Image process error:", err);
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            await runInvoiceOcr(file);
        }
    };

    const runInvoiceOcr = async (fileToScan) => {
        const file = fileToScan || imageFile;
        if (!file) {
            toast.error("Silakan pilih foto faktur/nota terlebih dahulu.");
            return;
        }

        setIsScanning(true);
        setScanError(null);

        const formData = new FormData();
        formData.append("image", file);

        try {
            const response = await axios.post(route("products.ocr.scan-invoice"), formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (response.data?.success) {
                const data = response.data;
                setInvoiceMeta({
                    invoice_number: data.invoice_number || "",
                    supplier_name: data.supplier_name || "",
                    invoice_date: data.invoice_date || new Date().toISOString().split("T")[0],
                    total_amount: data.total_amount || 0,
                });

                const parsedItems = (data.items || []).map((item, idx) => ({
                    ...item,
                    temp_id: `temp_${Date.now()}_${idx}`,
                    selected: true,
                }));

                setItems(parsedItems);
                toast.success(`Faktur Berhasil Dipindai: ${parsedItems.length} item terdeteksi!`);
            } else {
                setScanError(response.data?.message || "Gagal membaca item faktur.");
            }
        } catch (err) {
            console.error("Invoice OCR scan error:", err);
            if (err.response?.data?.code === "API_KEY_MISSING") {
                setScanError("API Key Gemini belum disetel. Buka Pengaturan > OCR & AI untuk memasukkan API Key.");
            } else {
                setScanError(err.response?.data?.message || "Terjadi kesalahan saat memproses OCR faktur.");
            }
        } finally {
            setIsScanning(false);
        }
    };

    const updateItemField = (tempId, field, value) => {
        setItems((prev) =>
            prev.map((item) => {
                if (item.temp_id === tempId) {
                    const updated = { ...item, [field]: value };
                    // Auto-recalculate sell_price if buy_price changed
                    if (field === "buy_price") {
                        const bp = Number(value) || 0;
                        updated.sell_price = Math.round(bp * (1 + bulkMarginPercent / 100));
                        updated.subtotal = bp * (Number(updated.qty) || 1);
                    }
                    if (field === "qty") {
                        updated.subtotal = (Number(updated.buy_price) || 0) * (Number(value) || 1);
                    }
                    return updated;
                }
                return item;
            })
        );
    };

    const removeItem = (tempId) => {
        setItems((prev) => prev.filter((item) => item.temp_id !== tempId));
    };

    const toggleSelectItem = (tempId) => {
        setItems((prev) =>
            prev.map((item) =>
                item.temp_id === tempId ? { ...item, selected: !item.selected } : item
            )
        );
    };

    const toggleSelectAll = (checked) => {
        setItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
    };

    const applyBulkMargin = () => {
        const margin = Number(bulkMarginPercent) || 0;
        setItems((prev) =>
            prev.map((item) => ({
                ...item,
                sell_price: Math.round((Number(item.buy_price) || 0) * (1 + margin / 100)),
            }))
        );
        toast.success(`Margin ${margin}% diterapkan ke semua produk.`);
    };

    const applyBulkCategory = () => {
        if (!bulkCategory) return;
        setItems((prev) =>
            prev.map((item) => ({
                ...item,
                category_id: Number(bulkCategory),
            }))
        );
        toast.success("Kategori diterapkan ke semua produk.");
    };

    const handleBatchSave = async () => {
        const selectedItems = items.filter((item) => item.selected);
        if (selectedItems.length === 0) {
            toast.error("Pilih minimal 1 item untuk di-import.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                items: selectedItems.map((item) => ({
                    title: item.title,
                    barcode: item.barcode || "",
                    sku: item.sku || "",
                    category_id: item.category_id || (categories.length > 0 ? categories[0].id : null),
                    buy_price: Number(item.buy_price) || 0,
                    sell_price: Number(item.sell_price) || 0,
                    qty: Number(item.qty) || 1,
                    unit: item.unit || "PCS",
                    action: item.action || "create_new",
                    existing_product_id: item.existing_product_id || null,
                })),
            };

            const response = await axios.post(route("products.ocr.batch-store"), payload);

            if (response.data?.success) {
                toast.success(response.data.message || "Batch produk berhasil disimpan!");
                if (onSuccess) {
                    onSuccess(response.data);
                } else {
                    router.reload({ only: ["products"] });
                }
                onClose();
            } else {
                toast.error(response.data?.message || "Gagal menyimpan batch produk.");
            }
        } catch (err) {
            console.error("Batch store error:", err);
            toast.error(err.response?.data?.message || "Terjadi kesalahan saat menyimpan produk.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedCount = items.filter((i) => i.selected).length;
    const grandTotalEstimated = items
        .filter((i) => i.selected)
        .reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);

    return (
        <Modal
            show={isOpen}
            onClose={onClose}
            title="Import Faktur & Nota Belanja via OCR (AI)"
            maxWidth="2xl"
        >
            <div className="space-y-4">
                {/* Upload or Re-scan Area */}
                {items.length === 0 ? (
                    <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-3xl bg-primary-100 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-3 shadow-inner">
                            <IconFileInvoice size={36} />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                            Unggah Foto Faktur / Nota Pembelian Grosir
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mb-5">
                            AI akan mengekstrak tabel barang belanjaan (Nama Barang, Qty, Harga Beli/HPP, Subtotal) secara otomatis untuk di-import langsung ke katalog produk toko.
                        </p>

                        {isScanning ? (
                            <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary-600 text-white text-xs font-bold shadow-lg animate-pulse">
                                <IconLoader2 size={18} className="animate-spin" />
                                <span>AI sedang memindai seluruh baris nota...</span>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
                                >
                                    <IconCamera size={16} />
                                    <span>Ambil Foto via Kamera</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all"
                                >
                                    <IconPhoto size={16} />
                                    <span>Pilih File Gambar / PDF</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Invoice Metadata Header */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Supplier / Grosir
                                </span>
                                <input
                                    type="text"
                                    value={invoiceMeta.supplier_name}
                                    onChange={(e) =>
                                        setInvoiceMeta((prev) => ({ ...prev, supplier_name: e.target.value }))
                                    }
                                    placeholder="Nama Supplier"
                                    className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                                />
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    No. Faktur / Nota
                                </span>
                                <input
                                    type="text"
                                    value={invoiceMeta.invoice_number}
                                    onChange={(e) =>
                                        setInvoiceMeta((prev) => ({ ...prev, invoice_number: e.target.value }))
                                    }
                                    placeholder="No. Nota"
                                    className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200"
                                />
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Tanggal Faktur
                                </span>
                                <input
                                    type="date"
                                    value={invoiceMeta.invoice_date}
                                    onChange={(e) =>
                                        setInvoiceMeta((prev) => ({ ...prev, invoice_date: e.target.value }))
                                    }
                                    className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                                />
                            </div>

                            <div className="flex items-end justify-end">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 text-xs font-semibold"
                                >
                                    <IconRefresh size={14} />
                                    <span>Ganti Foto Nota</span>
                                </button>
                            </div>
                        </div>

                        {/* Bulk Action Toolbar */}
                        <div className="p-3 rounded-xl bg-primary-50/60 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-primary-900 dark:text-primary-300 flex items-center gap-1">
                                    <IconPercentage size={16} />
                                    Set Margin Jual:
                                </span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="200"
                                        value={bulkMarginPercent}
                                        onChange={(e) => setBulkMarginPercent(e.target.value)}
                                        className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-center"
                                    />
                                    <span className="font-bold text-slate-500">%</span>
                                    <button
                                        type="button"
                                        onClick={applyBulkMargin}
                                        className="px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs"
                                    >
                                        Terapkan
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600 dark:text-slate-400">
                                    Set Kategori Semua:
                                </span>
                                <select
                                    value={bulkCategory}
                                    onChange={(e) => setBulkCategory(e.target.value)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                                >
                                    <option value="">-- Pilih --</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={applyBulkCategory}
                                    disabled={!bulkCategory}
                                    className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-semibold text-xs disabled:opacity-50"
                                >
                                    Terapkan
                                </button>
                            </div>
                        </div>

                        {/* Items Review Table */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-96 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 uppercase text-[10px] font-bold sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 w-8">
                                            <input
                                                type="checkbox"
                                                checked={items.length > 0 && items.every((i) => i.selected)}
                                                onChange={(e) => toggleSelectAll(e.target.checked)}
                                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                                            />
                                        </th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 min-w-[200px]">Nama Produk</th>
                                        <th className="p-3 min-w-[120px]">Barcode / SKU</th>
                                        <th className="p-3 min-w-[140px]">Kategori</th>
                                        <th className="p-3 w-16 text-center">Qty</th>
                                        <th className="p-3 min-w-[110px]">Harga Beli (Modal)</th>
                                        <th className="p-3 min-w-[110px]">Harga Jual</th>
                                        <th className="p-3 min-w-[100px] text-right">Subtotal</th>
                                        <th className="p-3 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {items.map((item) => (
                                        <tr
                                            key={item.temp_id}
                                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                                                !item.selected ? "opacity-40" : ""
                                            }`}
                                        >
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={item.selected}
                                                    onChange={() => toggleSelectItem(item.temp_id)}
                                                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                                                />
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                {item.is_existing ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                                        Update Stok ({item.existing_stock})
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                        Produk Baru
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    value={item.title}
                                                    onChange={(e) =>
                                                        updateItemField(item.temp_id, "title", e.target.value)
                                                    }
                                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    value={item.barcode || ""}
                                                    placeholder="Auto-generate"
                                                    onChange={(e) =>
                                                        updateItemField(item.temp_id, "barcode", e.target.value)
                                                    }
                                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <select
                                                    value={item.category_id || ""}
                                                    onChange={(e) =>
                                                        updateItemField(item.temp_id, "category_id", e.target.value)
                                                    }
                                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200"
                                                >
                                                    {categories.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.qty}
                                                    onChange={(e) =>
                                                        updateItemField(item.temp_id, "qty", e.target.value)
                                                    }
                                                    className="w-16 px-1.5 py-1 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.buy_price}
                                                    onChange={(e) =>
                                                        updateItemField(item.temp_id, "buy_price", e.target.value)
                                                    }
                                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.sell_price}
                                                    onChange={(e) =>
                                                        updateItemField(item.temp_id, "sell_price", e.target.value)
                                                    }
                                                    className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                                                />
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                Rp {(Number(item.subtotal) || 0).toLocaleString("id-ID")}
                                            </td>
                                            <td className="p-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(item.temp_id)}
                                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                    title="Hapus baris"
                                                >
                                                    <IconTrash size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Error Banner */}
                {scanError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs flex items-start gap-2.5">
                        <IconAlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />
                        <div className="flex-1">
                            <p className="font-semibold">Pemindaian Faktur Terkendala</p>
                            <p className="mt-0.5 text-rose-600 dark:text-rose-400">{scanError}</p>
                        </div>
                    </div>
                )}

                {/* Hidden Inputs */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileInputChange}
                    className="hidden"
                />
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileInputChange}
                    className="hidden"
                />

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Tutup
                    </button>

                    {items.length > 0 && (
                        <div className="flex items-center gap-3">
                            <div className="text-right text-xs">
                                <span className="text-slate-400">Total Terpilih: </span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {selectedCount} item
                                </span>
                                <span className="text-slate-400 ml-2">Estimasi Modal: </span>
                                <span className="font-bold text-primary-600 dark:text-primary-400">
                                    Rp {grandTotalEstimated.toLocaleString("id-ID")}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleBatchSave}
                                disabled={isSubmitting || selectedCount === 0}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg shadow-primary-500/25 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <IconLoader2 size={16} className="animate-spin" />
                                ) : (
                                    <IconCheck size={16} />
                                )}
                                <span>Simpan & Import ({selectedCount} Produk)</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
