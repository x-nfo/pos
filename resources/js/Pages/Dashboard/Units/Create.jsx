import React from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage, Link } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import toast from "react-hot-toast";
import {
    IconRulerMeasure,
    IconDeviceFloppy,
    IconArrowLeft,
    IconInfoCircle,
    IconLayersLinked,
    IconScale,
    IconCheck,
} from "@tabler/icons-react";

export default function Create() {
    const { errors } = usePage().props;

    const { data, setData, post, processing } = useForm({
        code: "",
        name: "",
        symbol: "",
    });

    const submit = (e) => {
        e.preventDefault();
        post(route("units.store"), {
            onSuccess: () => toast.success("Satuan berhasil ditambahkan"),
            onError: () => toast.error("Gagal menyimpan satuan"),
        });
    };

    return (
        <>
            <Head title="Tambah Satuan Barang" />

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
                    Tambah Satuan Baru
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Daftarkan master satuan barang untuk digunakan dalam konversi stok bertingkat (Multi-UOM) pada produk dan kasir.
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
                                    placeholder="Contoh: PCS, PACK, DUS, CUP, PORSI"
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
                                <span className="text-xs text-slate-400 mt-1 block">
                                    Maksimal 10 karakter kapital unik. Contoh: <code>PCS</code>, <code>PACK</code>, <code>DUS</code>, <code>CUP</code>.
                                </span>
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
                                    placeholder="Contoh: Pieces / Butir, Pack 10 Pcs, Dus / Karton, Porsi Saji"
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
                                    placeholder="Contoh: pcs, pak, dus, cup, prs"
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
                                <span className="text-xs text-slate-400 mt-1 block">
                                    Simbol yang dicetak pada struk kasir, invoice, dan tabel produk.
                                </span>
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
                                    {processing ? "Menyimpan..." : "Simpan Satuan"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Guide & Examples Sidebar */}
                <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-sm mb-3">
                            <IconInfoCircle size={20} />
                            Konsep Multi-UOM
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                            Satuan yang didaftarkan di sini adalah <strong>Master Satuan Global</strong>. Pada form produk, Anda dapat menentukan:
                        </p>
                        <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0"></span>
                                <span><strong>Satuan Dasar (Base Unit)</strong>: Satuan terkecil untuk pencatatan stok fisik (misal: <em>PCS</em> atau <em>Cup</em>).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0"></span>
                                <span><strong>Satuan Kemasan (Packaging)</strong>: Satuan dengan faktor konversi (misal: <em>1 Pack = 10 Pcs</em>, <em>1 Dus = 24 Pcs</em>).</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-teal-50/60 dark:bg-teal-950/20 rounded-2xl border border-teal-100 dark:border-teal-900/30 p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 mb-2 flex items-center gap-1.5">
                            <IconScale size={16} />
                            Contoh Standar Satuan
                        </div>
                        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-teal-100/60 dark:border-teal-900/40">
                                <strong>PCS</strong> (Pieces / Satuan Dasar)
                            </div>
                            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-teal-100/60 dark:border-teal-900/40">
                                <strong>PACK</strong> (Pack / Isi 10 Pcs)
                            </div>
                            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-teal-100/60 dark:border-teal-900/40">
                                <strong>DUS</strong> (Dus / Karton isi 24 Pcs)
                            </div>
                            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-teal-100/60 dark:border-teal-900/40">
                                <strong>CUP / PORSI</strong> (Satuan Resto / F&B)
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;
