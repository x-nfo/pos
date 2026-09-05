import React, { useEffect, useState } from "react";
import { Head, usePage, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconBuildingWarehouse,
    IconPlus,
    IconPencil,
    IconTrash,
    IconDots,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { useAuthorization } from "@/Utils/authorization";
import Input from "@/Components/Dashboard/Input";

export default function Warehouses({ warehouses = [] }) {
    const { flash } = usePage().props;
    const { can } = useAuthorization();
    const canCreate = can("warehouses-create");
    const canUpdate = can("warehouses-update");
    const canDelete = can("warehouses-delete");

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        code: "",
        name: "",
        type: "branch",
        address: "",
        phone: "",
        is_active: true,
        sort_order: 0,
        catalog_delivery_enabled: true,
        catalog_pickup_enabled: true,
        is_24_hours: false,
        open_time: "08:00",
        close_time: "21:00",
        operating_days: [1, 2, 3, 4, 5, 6, 7],
        is_temporarily_closed: false,
        closure_reason: "",
        reopen_date: "",
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const resetForm = () => {
        setForm({
            code: "",
            name: "",
            type: "branch",
            address: "",
            phone: "",
            is_active: true,
            sort_order: 0,
            catalog_delivery_enabled: true,
            catalog_pickup_enabled: true,
            is_24_hours: false,
            open_time: "08:00",
            close_time: "21:00",
            operating_days: [1, 2, 3, 4, 5, 6, 7],
            is_temporarily_closed: false,
            closure_reason: "",
            reopen_date: "",
        });
        setErrors({});
        setEditing(null);
        setShowForm(false);
    };

    const openEdit = (w) => {
        setEditing(w);
        setForm({
            code: w.code,
            name: w.name,
            type: w.type,
            address: w.address || "",
            phone: w.phone || "",
            is_active: w.is_active,
            sort_order: w.sort_order,
            catalog_delivery_enabled: w.catalog_delivery_enabled !== undefined ? Boolean(w.catalog_delivery_enabled) : true,
            catalog_pickup_enabled: w.catalog_pickup_enabled !== undefined ? Boolean(w.catalog_pickup_enabled) : true,
            is_24_hours: Boolean(w.is_24_hours),
            open_time: w.open_time ? String(w.open_time).substring(0, 5) : "08:00",
            close_time: w.close_time ? String(w.close_time).substring(0, 5) : "21:00",
            operating_days: Array.isArray(w.operating_days) ? w.operating_days : [1, 2, 3, 4, 5, 6, 7],
            is_temporarily_closed: Boolean(w.is_temporarily_closed),
            closure_reason: w.closure_reason || "",
            reopen_date: w.reopen_date ? String(w.reopen_date).substring(0, 10) : "",
        });
        setErrors({});
        setShowForm(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrors({});

        if (editing) {
            router.put(route("settings.warehouses.update", editing.id), form, {
                onError: (err) => {
                    setErrors(err);
                    const firstErr = Object.values(err)[0];
                    toast.error(firstErr || "Gagal memperbarui data gudang.");
                },
                onSuccess: () => {
                    toast.success("Data cabang berhasil diperbarui.");
                    resetForm();
                },
            });
        } else {
            router.post(route("settings.warehouses.store"), form, {
                onError: (err) => {
                    setErrors(err);
                    const firstErr = Object.values(err)[0];
                    toast.error(firstErr || "Gagal menambahkan gudang.");
                },
                onSuccess: () => {
                    toast.success("Cabang baru berhasil ditambahkan.");
                    resetForm();
                },
            });
        }
    };

    const handleDelete = (w) => {
        if (!confirm(`Hapus gudang ${w.name}?`)) return;
        router.delete(route("settings.warehouses.destroy", w.id));
    };

    const typeLabel = (type) => {
        const labels = { main: "Utama", branch: "Cabang", warehouse: "Gudang" };
        return labels[type] || type;
    };

    const typeColor = (type) => {
        const colors = {
            main: "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400",
            branch: "bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400",
            warehouse: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        };
        return colors[type] || colors.warehouse;
    };

    return (
        <>
            <Head title="Pengaturan Gudang" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconBuildingWarehouse size={28} className="text-primary-500" />
                    Gudang / Cabang
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Kelola gudang dan cabang untuk pemisahan stok per lokasi
                </p>
            </div>

            <div className="max-w-4xl space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 dark:text-white">
                            Daftar Gudang ({warehouses.length})
                        </h3>
                        {canCreate && (
                            <button
                                onClick={() => { resetForm(); setShowForm(true); }}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
                            >
                                <IconPlus size={18} />
                                Tambah Gudang
                            </button>
                        )}
                    </div>

                    {warehouses.length > 0 ? (
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                            {warehouses.map((w) => (
                                <div key={w.id} className={`p-4 flex items-center gap-4 ${!w.is_active ? "opacity-50" : ""}`}>
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <IconBuildingWarehouse size={22} className="text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-slate-800 dark:text-white truncate">
                                                {w.name}
                                            </p>
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${typeColor(w.type)}`}>
                                                {typeLabel(w.type)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {w.code}
                                            {w.address ? ` • ${w.address}` : ""}
                                            {w.phone ? ` • WA: ${w.phone}` : ""}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                            {w.operating_status && (
                                                <span
                                                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${
                                                        w.operating_status.is_open
                                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                            : w.operating_status.status === "temporarily_closed"
                                                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                                    }`}
                                                    title={w.operating_status.schedule_info || ""}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full ${w.operating_status.is_open ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                                                    <span>{w.operating_status.badge_text}</span>
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${w.catalog_delivery_enabled !== false ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                                                🚚 {w.catalog_delivery_enabled !== false ? "Kirim Aktif" : "Kirim Nonaktif"}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${w.catalog_pickup_enabled !== false ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                                                🏪 {w.catalog_pickup_enabled !== false ? "Ambil di Toko" : "Pickup Nonaktif"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {w.type !== "main" && (
                                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                                Sort: {w.sort_order}
                                            </span>
                                        )}
                                        {canUpdate && (
                                            <button
                                                onClick={() => openEdit(w)}
                                                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                <IconPencil size={18} />
                                            </button>
                                        )}
                                        {canDelete && w.type !== "main" && (
                                            <button
                                                onClick={() => handleDelete(w)}
                                                className="p-2 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                                            >
                                                <IconTrash size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <IconBuildingWarehouse size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">Belum ada gudang</p>
                        </div>
                    )}
                </div>

                {showForm && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                        <h3 className="font-semibold text-slate-800 dark:text-white">
                            {editing ? "Edit Gudang" : "Tambah Gudang Baru"}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input
                                    label="Kode"
                                    placeholder="WH-002"
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    errors={errors.code}
                                    disabled={!!editing}
                                />
                                <Input
                                    label="Nama Gudang"
                                    placeholder="Gudang Cabang A"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    errors={errors.name}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipe</label>
                                    <select
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    >
                                        <option value="branch">Cabang</option>
                                        <option value="warehouse">Gudang</option>
                                    </select>
                                    {errors.type && (
                                        <p className="text-xs text-danger-500 mt-1">{errors.type}</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Alamat
                                    </label>
                                    <textarea
                                        value={form.address}
                                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                                        className="w-full h-20 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                                    />
                                    {errors.address && (
                                        <p className="text-xs text-danger-500 mt-1">{errors.address}</p>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <Input
                                        label="Telepon"
                                        placeholder="021-12345678"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        errors={errors.phone}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Urutan"
                                            type="number"
                                            value={form.sort_order}
                                            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                                            errors={errors.sort_order}
                                        />
                                        <div className="flex items-end pb-2">
                                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={form.is_active}
                                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                                    className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                                                />
                                                Aktif
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Jam Operasional Cabang */}
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        🕒 Jam Operasional Cabang
                                    </p>
                                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.is_24_hours}
                                            onChange={(e) => setForm({ ...form, is_24_hours: e.target.checked })}
                                            className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span>Buka 24 Jam Non-Stop</span>
                                    </label>
                                </div>

                                {!form.is_24_hours && (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                    Jam Buka
                                                </label>
                                                <input
                                                    type="time"
                                                    value={form.open_time}
                                                    onChange={(e) => setForm({ ...form, open_time: e.target.value })}
                                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500"
                                                />
                                                {errors.open_time && (
                                                    <p className="text-xs text-danger-500 mt-1">{errors.open_time}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                    Jam Tutup
                                                </label>
                                                <input
                                                    type="time"
                                                    value={form.close_time}
                                                    onChange={(e) => setForm({ ...form, close_time: e.target.value })}
                                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500"
                                                />
                                                {errors.close_time && (
                                                    <p className="text-xs text-danger-500 mt-1">{errors.close_time}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                                                Hari Buka Operasional
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    { id: 1, label: "Senin" },
                                                    { id: 2, label: "Selasa" },
                                                    { id: 3, label: "Rabu" },
                                                    { id: 4, label: "Kamis" },
                                                    { id: 5, label: "Jumat" },
                                                    { id: 6, label: "Sabtu" },
                                                    { id: 7, label: "Minggu" },
                                                ].map((d) => {
                                                    const isSelected = form.operating_days?.includes(d.id);
                                                    return (
                                                        <button
                                                            key={d.id}
                                                            type="button"
                                                            onClick={() => {
                                                                const current = form.operating_days || [];
                                                                const updated = isSelected
                                                                    ? current.filter((x) => x !== d.id)
                                                                    : [...current, d.id];
                                                                setForm({ ...form, operating_days: updated });
                                                            }}
                                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                                                isSelected
                                                                    ? "bg-primary-600 text-white shadow-2xs"
                                                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                                                            }`}
                                                        >
                                                            {d.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {errors.operating_days && (
                                                <p className="text-xs text-danger-500 mt-1">{errors.operating_days}</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Tutup Sementara / Libur Khusus */}
                            <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                                            🛑 Tutup Sementara / Libur Khusus
                                        </p>
                                        <p className="text-[11px] text-rose-600 dark:text-rose-400">
                                            Gunakan jika toko tutup mendadak, sakit, musibah, atau libur hari raya.
                                        </p>
                                    </div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.is_temporarily_closed}
                                            onChange={(e) => setForm({ ...form, is_temporarily_closed: e.target.checked })}
                                            className="rounded border-rose-300 dark:border-rose-700 text-rose-600 focus:ring-rose-500"
                                        />
                                        <span>Aktifkan Tutup Sementara</span>
                                    </label>
                                </div>

                                {form.is_temporarily_closed && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-rose-200/80 dark:border-rose-900/60">
                                        <div>
                                            <label className="block text-xs font-medium text-rose-800 dark:text-rose-300 mb-1">
                                                Alasan Penutupan
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Contoh: Libur Hari Raya Idul Fitri / Renovasi"
                                                value={form.closure_reason}
                                                onChange={(e) => setForm({ ...form, closure_reason: e.target.value })}
                                                className="w-full h-10 px-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500"
                                            />
                                            {errors.closure_reason && (
                                                <p className="text-xs text-danger-500 mt-1">{errors.closure_reason}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-rose-800 dark:text-rose-300 mb-1">
                                                Estimasi Buka Kembali (Opsional)
                                            </label>
                                            <input
                                                type="date"
                                                value={form.reopen_date}
                                                onChange={(e) => setForm({ ...form, reopen_date: e.target.value })}
                                                className="w-full h-10 px-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500"
                                            />
                                            {errors.reopen_date && (
                                                <p className="text-xs text-danger-500 mt-1">{errors.reopen_date}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Catalog online order settings */}
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Layanan Toko Online (Katalog WhatsApp) Cabang Ini
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.catalog_delivery_enabled}
                                            onChange={(e) => setForm({ ...form, catalog_delivery_enabled: e.target.checked })}
                                            className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span>Bisa Kirim ke Alamat (Delivery)</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.catalog_pickup_enabled}
                                            onChange={(e) => setForm({ ...form, catalog_pickup_enabled: e.target.checked })}
                                            className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span>Bisa Ambil di Cabang (Pick-up)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold transition-colors"
                                >
                                    {editing ? "Update" : "Simpan"}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </>
    );
}

Warehouses.layout = (page) => <DashboardLayout children={page} />;
