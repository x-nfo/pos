import React, { useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconListDetails,
    IconPlus,
    IconPencil,
    IconTrash,
    IconEye,
    IconCheck,
    IconX,
    IconUsers,
    IconTag,
    IconLayersLinked,
} from "@tabler/icons-react";
import { usePasswordConfirmation } from "@/Context/PasswordConfirmationContext";

const slugify = (text = "") =>
    text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-");

const resolveRoute = (name, params, fallback) => {
    try {
        return typeof route === "function" ? (params !== undefined ? route(name, params) : route(name)) : fallback;
    } catch {
        return fallback;
    }
};

export default function PriceLists({ priceLists = [], customerSegments = [] }) {
    const { errors = {} } = usePage().props;
    const { requirePasswordConfirmation } = usePasswordConfirmation();

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [slugManual, setSlugManual] = useState(false);
    const [form, setForm] = useState({
        name: "",
        slug: "",
        customer_scope: "all",
        customer_segment_id: "",
        is_active: true,
        notes: "",
        priority: 0,
    });

    const resetForm = () => {
        setForm({
            name: "",
            slug: "",
            customer_scope: "all",
            customer_segment_id: "",
            is_active: true,
            notes: "",
            priority: 0,
        });
        setEditing(null);
        setSlugManual(false);
        setShowForm(false);
    };

    const openEdit = (pl) => {
        setEditing(pl);
        setSlugManual(true);
        setForm({
            name: pl.name || "",
            slug: pl.slug || "",
            customer_scope: pl.customer_scope || "all",
            customer_segment_id: pl.customer_segment_id ? String(pl.customer_segment_id) : "",
            is_active: pl.is_active !== undefined ? Boolean(pl.is_active) : true,
            notes: pl.notes || "",
            priority: pl.priority || 0,
        });
        setShowForm(true);
    };

    const handleNameChange = (e) => {
        const val = e.target.value;
        setForm((prev) => ({
            ...prev,
            name: val,
            slug: !editing && !slugManual ? slugify(val) : prev.slug,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const payload = {
            ...form,
            customer_segment_id:
                form.customer_scope === "segment" && form.customer_segment_id
                    ? Number(form.customer_segment_id)
                    : null,
            priority: Number(form.priority) || 0,
            is_active: Boolean(form.is_active),
        };

        requirePasswordConfirmation({
            title: editing ? "Konfirmasi Ubah Price List" : "Konfirmasi Tambah Price List",
            description: "Masukkan password akun Anda untuk menyimpan pengaturan price list.",
            challenge: editing ? "Ubah Price List" : "Tambah Price List",
            onConfirmed: () => {
                if (editing) {
                    router.put(
                        resolveRoute(
                            "price-lists.update",
                            editing.id,
                            `/dashboard/settings/price-lists/${editing.id}`
                        ),
                        payload,
                        {
                            onSuccess: () => resetForm(),
                        }
                    );
                } else {
                    router.post(
                        resolveRoute(
                            "price-lists.store",
                            undefined,
                            "/dashboard/settings/price-lists"
                        ),
                        payload,
                        {
                            onSuccess: () => resetForm(),
                        }
                    );
                }
            },
        });
    };

    const handleDelete = (pl) => {
        if (!confirm(`Hapus price list "${pl.name}"? Semua item harga di dalamnya akan ikut terhapus.`)) return;

        requirePasswordConfirmation({
            title: "Konfirmasi Hapus Price List",
            description: `Masukkan password akun Anda untuk menghapus price list ${pl.name}.`,
            challenge: "Hapus Price List",
            onConfirmed: () => {
                router.delete(
                    resolveRoute(
                        "price-lists.destroy",
                        pl.id,
                        `/dashboard/settings/price-lists/${pl.id}`
                    )
                );
            },
        });
    };

    const scopeBadge = {
        all: { label: "Semua Pelanggan", bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" },
        walk_in: { label: "Walk-in (Umum)", bg: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300" },
        registered: { label: "Pelanggan Terdaftar", bg: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300" },
        member: { label: "Member Loyalitas", bg: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" },
        segment: { label: "Segmen Khusus", bg: "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300" },
    };

    return (
        <>
            <Head title="Price List (Daftar Harga Khusus)" />
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 dark:text-white">
                            <span className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                                <IconListDetails size={26} />
                            </span>
                            Price List (Daftar Harga)
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Atur harga khusus produk per kelompok atau segmen pelanggan (Wholesale, Member, VIP, dsb).
                        </p>
                    </div>
                    {!showForm && (
                        <button
                            onClick={() => {
                                resetForm();
                                setShowForm(true);
                            }}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm shadow-primary-500/20 transition-all cursor-pointer"
                        >
                            <IconPlus size={18} /> Price List Baru
                        </button>
                    )}
                </div>

                {/* Form Tambah / Edit */}
                {showForm && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {editing ? `Edit Price List: ${editing.name}` : "Buat Price List Baru"}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Tentukan nama, kelompok sasaran, dan prioritas evaluasi harga.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                            >
                                Batal
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Nama Price List <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={handleNameChange}
                                        placeholder="Contoh: Harga Khusus Member VIP"
                                        className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:text-white"
                                        required
                                    />
                                    {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Slug Identifikasi <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.slug}
                                        onChange={(e) => {
                                            setSlugManual(true);
                                            setForm({ ...form, slug: e.target.value });
                                        }}
                                        placeholder="contoh-member-vip"
                                        className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-mono text-xs focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:text-white"
                                        required
                                    />
                                    {errors.slug && <p className="mt-1 text-xs text-rose-500">{errors.slug}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className={form.customer_scope === "segment" ? "md:col-span-1" : "md:col-span-2"}>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Kelompok Pelanggan <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={form.customer_scope}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                customer_scope: e.target.value,
                                                customer_segment_id:
                                                    e.target.value === "segment" ? form.customer_segment_id : "",
                                            })
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:border-primary-500 dark:text-white"
                                    >
                                        <option value="all">Semua Pelanggan</option>
                                        <option value="walk_in">Walk-in (Tanpa Member/Pelanggan)</option>
                                        <option value="registered">Pelanggan Terdaftar (Ada Data)</option>
                                        <option value="member">Member Loyalitas</option>
                                        <option value="segment">Segmen Pelanggan Khusus</option>
                                    </select>
                                    {errors.customer_scope && (
                                        <p className="mt-1 text-xs text-rose-500">{errors.customer_scope}</p>
                                    )}
                                </div>

                                {form.customer_scope === "segment" && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Pilih Segmen <span className="text-rose-500">*</span>
                                        </label>
                                        <select
                                            value={form.customer_segment_id}
                                            onChange={(e) => setForm({ ...form, customer_segment_id: e.target.value })}
                                            className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:border-primary-500 dark:text-white"
                                            required={form.customer_scope === "segment"}
                                        >
                                            <option value="">-- Pilih Segmen --</option>
                                            {customerSegments.map((seg) => (
                                                <option key={seg.id} value={seg.id}>
                                                    {seg.name}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.customer_segment_id && (
                                            <p className="mt-1 text-xs text-rose-500">{errors.customer_segment_id}</p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Prioritas Evaluasi
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.priority}
                                        onChange={(e) =>
                                            setForm({ ...form, priority: parseInt(e.target.value, 10) || 0 })
                                        }
                                        placeholder="0"
                                        className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm focus:border-primary-500 dark:text-white"
                                    />
                                    <p className="mt-1 text-[11px] text-slate-400">Nilai lebih tinggi didahulukan</p>
                                    {errors.priority && (
                                        <p className="mt-1 text-xs text-rose-500">{errors.priority}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Catatan / Keterangan
                                </label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    placeholder="Catatan tambahan mengenai price list ini..."
                                    rows={2}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm focus:border-primary-500 dark:text-white"
                                />
                                {errors.notes && <p className="mt-1 text-xs text-rose-500">{errors.notes}</p>}
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                        className="rounded-lg border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Price list aktif (diterapkan di POS)
                                    </span>
                                </label>
                            </div>

                            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
                                >
                                    {editing ? "Perbarui Price List" : "Simpan Price List"}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                >
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* List Price Lists */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <IconLayersLinked size={18} className="text-slate-400" />
                            <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                Daftar Price List ({priceLists.length})
                            </h2>
                        </div>
                        <span className="text-xs text-slate-400">
                            Urutan prioritas: tertinggi dievaluasi paling awal
                        </span>
                    </div>

                    {priceLists.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {priceLists.map((pl) => {
                                const badge = scopeBadge[pl.customer_scope] || {
                                    label: pl.customer_scope,
                                    bg: "bg-slate-100 text-slate-700",
                                };
                                return (
                                    <div
                                        key={pl.id}
                                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                                    >
                                        <div className="space-y-1.5 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-bold text-slate-900 dark:text-white text-base">
                                                    {pl.name}
                                                </span>
                                                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                    {pl.slug}
                                                </span>
                                                {pl.is_active ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                                        <IconCheck size={12} /> Aktif
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                        <IconX size={12} /> Nonaktif
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <span className={`px-2.5 py-0.5 rounded-lg font-medium ${badge.bg}`}>
                                                    {badge.label}
                                                    {pl.customer_scope === "segment" && pl.segment && (
                                                        <span className="font-bold ml-1">({pl.segment.name})</span>
                                                    )}
                                                </span>
                                                <span>•</span>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                    {pl.items_count || 0} Produk Ditetapkan
                                                </span>
                                                <span>•</span>
                                                <span>Prioritas: <strong className="text-slate-800 dark:text-slate-200">{pl.priority}</strong></span>
                                                {pl.notes && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="italic text-slate-400 max-w-xs truncate">{pl.notes}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center">
                                            <Link
                                                href={resolveRoute("price-lists.show", pl.id, `/dashboard/settings/price-lists/${pl.id}`)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition cursor-pointer"
                                                title="Kelola Item Produk"
                                            >
                                                <IconEye size={16} /> Kelola Produk ({pl.items_count || 0})
                                            </Link>
                                            <button
                                                onClick={() => openEdit(pl)}
                                                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                                title="Edit Pengaturan Price List"
                                            >
                                                <IconPencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(pl)}
                                                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                                title="Hapus Price List"
                                            >
                                                <IconTrash size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <IconListDetails size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <h3 className="font-semibold text-slate-700 dark:text-slate-300">Belum ada Price List</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Buat price list pertama Anda untuk menetapkan harga khusus grosir, member VIP, atau kelompok pelanggan tertentu.
                            </p>
                            <button
                                onClick={() => {
                                    resetForm();
                                    setShowForm(true);
                                }}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold shadow-sm hover:bg-primary-700 transition"
                            >
                                <IconPlus size={16} /> Buat Price List Baru
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

PriceLists.layout = (page) => <DashboardLayout children={page} />;

