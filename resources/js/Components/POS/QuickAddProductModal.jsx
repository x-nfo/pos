import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
    IconX,
    IconBarcode,
    IconSparkles,
    IconPackage,
    IconPlus,
} from "@tabler/icons-react";

export default function QuickAddProductModal({
    isOpen,
    onClose,
    onSuccess,
    initialData = {},
    categories = [],
}) {
    const [formData, setFormData] = useState({
        barcode: "",
        title: "",
        category_id: "",
        buy_price: "",
        sell_price: "",
        stock: 10,
        description: "",
        image: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const isFromCatalog = Boolean(initialData?.fromCatalog);

    useEffect(() => {
        if (isOpen) {
            setErrors({});
            const defaultCategoryId =
                initialData?.category_id || (categories.length > 0 ? categories[0].id : "");

            setFormData({
                barcode: initialData?.barcode || "",
                title: initialData?.title || "",
                category_id: defaultCategoryId ? String(defaultCategoryId) : "",
                buy_price: initialData?.buy_price ? String(initialData.buy_price) : "0",
                sell_price: initialData?.sell_price ? String(initialData.sell_price) : "",
                stock: initialData?.stock !== undefined ? initialData.stock : 10,
                description: initialData?.description || initialData?.title || "",
                image: initialData?.image || "",
            });
        }
    }, [isOpen, initialData, categories]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        if (!formData.title.trim()) {
            setErrors((prev) => ({ ...prev, title: "Nama produk wajib diisi" }));
            return;
        }

        if (!formData.category_id) {
            setErrors((prev) => ({ ...prev, category_id: "Pilih kategori produk" }));
            return;
        }

        if (!formData.sell_price || Number(formData.sell_price) < 0) {
            setErrors((prev) => ({ ...prev, sell_price: "Harga jual wajib diisi dan valid" }));
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                barcode: formData.barcode,
                title: formData.title,
                category_id: Number(formData.category_id),
                buy_price: Number(formData.buy_price) || 0,
                sell_price: Number(formData.sell_price),
                stock: Number(formData.stock) || 0,
                description: formData.description || formData.title,
                image: formData.image || "",
            };

            const response = await axios.post(route("products.quick-store"), payload);

            if (response.data?.success && response.data?.data) {
                toast.success(`Produk "${response.data.data.title}" berhasil ditambahkan!`);
                onSuccess(response.data.data);
                onClose();
            } else {
                toast.error("Gagal menambahkan produk.");
            }
        } catch (err) {
            console.error("Quick store error:", err);
            if (err.response?.data?.errors) {
                setErrors(err.response.data.errors);
            } else {
                toast.error(err.response?.data?.message || "Terjadi kesalahan saat menyimpan produk.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                                isFromCatalog
                                    ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                                    : "bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400"
                            }`}
                        >
                            {isFromCatalog ? (
                                <IconSparkles size={22} />
                            ) : (
                                <IconPackage size={22} />
                            )}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                {isFromCatalog
                                    ? "Produk Ditemukan di Katalog!"
                                    : "Tambah Produk Cepat"}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {isFromCatalog
                                    ? "Data terisi otomatis dari referensi. Cek harga & stok toko Anda."
                                    : "Produk belum terdaftar, lengkapi data untuk langsung menjualnya."}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <IconX size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Barcode & Status Badge */}
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center gap-2">
                            <IconBarcode size={22} className="text-slate-500 dark:text-slate-400" />
                            <div>
                                <p className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">
                                    Barcode Produk
                                </p>
                                <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {formData.barcode || "-"}
                                </p>
                            </div>
                        </div>

                        {isFromCatalog ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                <IconSparkles size={14} />
                                Katalog Referensi
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                Produk Baru
                            </span>
                        )}
                    </div>

                    {/* Nama Produk */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                            Nama Produk <span className="text-danger-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, title: e.target.value }))
                            }
                            placeholder="Contoh: Indomie Goreng 85g"
                            className={`w-full px-3.5 py-2.5 rounded-xl border ${
                                errors.title
                                    ? "border-danger-500 ring-2 ring-danger-500/20"
                                    : "border-slate-200 dark:border-slate-700"
                            } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all`}
                            required
                        />
                        {errors.title && (
                            <p className="mt-1 text-xs text-danger-500">{errors.title}</p>
                        )}
                    </div>

                    {/* Kategori */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                            Kategori <span className="text-danger-500">*</span>
                        </label>
                        <select
                            value={formData.category_id}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, category_id: e.target.value }))
                            }
                            className={`w-full px-3.5 py-2.5 rounded-xl border ${
                                errors.category_id
                                    ? "border-danger-500 ring-2 ring-danger-500/20"
                                    : "border-slate-200 dark:border-slate-700"
                            } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all`}
                            required
                        >
                            <option value="">-- Pilih Kategori --</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                        {errors.category_id && (
                            <p className="mt-1 text-xs text-danger-500">{errors.category_id}</p>
                        )}
                    </div>

                    {/* Pricing: Harga Beli & Harga Jual */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                Harga Beli (Modal)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    Rp
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.buy_price}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            buy_price: e.target.value,
                                        }))
                                    }
                                    placeholder="0"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                Harga Jual <span className="text-danger-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    Rp
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.sell_price}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            sell_price: e.target.value,
                                        }))
                                    }
                                    placeholder="0"
                                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border ${
                                        errors.sell_price
                                            ? "border-danger-500 ring-2 ring-danger-500/20"
                                            : "border-slate-200 dark:border-slate-700"
                                    } bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all`}
                                    required
                                />
                            </div>
                            {errors.sell_price && (
                                <p className="mt-1 text-xs text-danger-500">{errors.sell_price}</p>
                            )}
                        </div>
                    </div>

                    {/* Stok Awal */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                            Stok Awal Toko <span className="text-danger-500">*</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={formData.stock}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, stock: e.target.value }))
                            }
                            placeholder="10"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            required
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                            Stok otomatis dicatat ke mutasi stok masuk awal toko.
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <IconPlus size={18} />
                            )}
                            <span>Simpan & Tambah ke Transaksi</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
