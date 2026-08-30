import React from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage, Link } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import toast from "react-hot-toast";
import {
    IconRulerMeasure,
    IconDeviceFloppy,
    IconArrowLeft,
    IconBox,
    IconAlertTriangle,
    IconInfoCircle,
} from "@tabler/icons-react";

export default function Edit({ unit }) {
    const { errors } = usePage().props;

    const { data, setData, put, processing } = useForm({
        code: unit?.code || "",
        name: unit?.name || "",
        symbol: unit?.symbol || "",
    });

    const productCount = unit?.product_units_count || 0;

    const submit = (e) => {
        e.preventDefault();
        put(route("units.update", unit.id), {
            onSuccess: () => toast.success("Satuan berhasil diperbarui"),
            onError: () => toast.error("Gagal memperbarui satuan"),
        });
    };

    return (
        <>
            <Head title={`Edit Satuan - ${unit.name}`} />

            <div className="mb-6">
                <Link
                    href={route("units.index")}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 mb-3 transition-colors"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke Daftar Satuan
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                        <IconRulerMeasure size={24} />
                    </div>
                    Edit Satuan: {unit.name}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Perbarui informasi kode, nama, dan simbol satuan barang.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
                {/* Form Card */}
                <div className="lg:col-span-2">
                    <form onSubmit={submit}>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Kode Satuan (Singkatan Unik) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    maxLength={10}
                                    value={data.code}
                                    onChange={(e) =>
                                        setData("code", e.target.value.toUpperCase())
                                    }
                                    placeholder="Contoh: PCS, PACK, DUS, CUP"
                                    className={`w-full h-11 px-4 text-sm font-mono uppercase rounded-xl border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                                        errors.code
                                            ? "border-rose-400 focus:border-rose-500"
                                            : "border-slate-200 dark:border-slate-700"
                                    }`}
                                />
                                {errors.code && (
                                    <p className="text-xs text-rose-500 mt-1.5 font-medium">
                                        {errors.code}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Nama Lengkap Satuan <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    maxLength={50}
                                    value={data.name}
                                    onChange={(e) => setData("name", e.target.value)}
                                    placeholder="Contoh: Pieces / Butir, Pack, Dus"
                                    className={`w-full h-11 px-4 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                                        errors.name
                                            ? "border-rose-400 focus:border-rose-500"
                                            : "border-slate-200 dark:border-slate-700"
                                    }`}
                                />
                                {errors.name && (
                                    <p className="text-xs text-rose-500 mt-1.5 font-medium">
                                        {errors.name}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Simbol Singkat Tampilan <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    maxLength={10}
                                    value={data.symbol}
                                    onChange={(e) => setData("symbol", e.target.value)}
                                    placeholder="Contoh: pcs, pak, dus, cup"
                                    className={`w-full h-11 px-4 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                                        errors.symbol
                                            ? "border-rose-400 focus:border-rose-500"
                                            : "border-slate-200 dark:border-slate-700"
                                    }`}
                                />
                                {errors.symbol && (
                                    <p className="text-xs text-rose-500 mt-1.5 font-medium">
                                        {errors.symbol}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end items-center gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <Link
                                    href={route("units.index")}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm transition-colors"
                                >
                                    Batal
                                </Link>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50"
                                >
                                    <IconDeviceFloppy size={18} />
                                    {processing ? "Menyimpan..." : "Perbarui Satuan"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Info Sidebar */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                            Status Penggunaan Satuan
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                            <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                                <IconBox size={20} />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">
                                    {productCount} Produk
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Terkait dengan satuan ini
                                </div>
                            </div>
                        </div>

                        {productCount > 0 && (
                            <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                <IconAlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
                                <div>
                                    Perubahan kode atau nama satuan akan otomatis terrefleksi pada {productCount} produk yang menggunakannya.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;
