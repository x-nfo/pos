import React from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm } from "@inertiajs/react";
import toast from "react-hot-toast";
import {
    IconPrinter,
    IconCheck,
    IconDeviceDesktop,
    IconBluetooth,
    IconUsb,
    IconBolt,
    IconFileText,
    IconInfoCircle,
} from "@tabler/icons-react";

export default function Printer({ settings }) {
    const { data, setData, post, processing, errors } = useForm({
        printer_auto_print: settings.printer_auto_print || false,
        printer_paper_size: settings.printer_paper_size || "80mm",
    });

    const submit = (e) => {
        e.preventDefault();
        post(route("settings.printer.update"), {
            preserveScroll: true,
            onSuccess: () => toast.success("Pengaturan printer berhasil disimpan"),
            onError: () => toast.error("Gagal menyimpan pengaturan printer"),
        });
    };

    return (
        <>
            <Head title="Pengaturan Printer" />
            <div className="max-w-5xl space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-900/50 flex items-center justify-center shrink-0">
                            <IconPrinter className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                    Pengaturan Printer Thermal
                                </h1>
                                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    ESC/POS Ready
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                Konfigurasi printer struk thermal (WebUSB, Bluetooth, & direct printing)
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Main Settings Panel */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Paper Size Card Selection */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-1">
                                    Ukuran Kertas Struk
                                </label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Pilih lebar kertas thermal yang terpasang pada printer Anda
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Option 58mm */}
                                <button
                                    type="button"
                                    onClick={() => setData("printer_paper_size", "58mm")}
                                    className={`relative text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                                        data.printer_paper_size === "58mm"
                                            ? "border-primary-500 bg-primary-50/40 dark:bg-primary-950/30 text-slate-900 dark:text-white shadow-sm"
                                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                                    }`}
                                >
                                    {data.printer_paper_size === "58mm" && (
                                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-sm">
                                            <IconCheck size={14} strokeWidth={2.5} />
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 inline-block">
                                            Compact
                                        </span>
                                        <h4 className="text-base font-bold text-slate-900 dark:text-white pt-1">
                                            58 mm
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Printer kasir Bluetooth portabel / mini thermal
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-400 flex items-center gap-1">
                                        <IconFileText size={14} />
                                        Maks 32 karakter per baris
                                    </div>
                                </button>

                                {/* Option 80mm */}
                                <button
                                    type="button"
                                    onClick={() => setData("printer_paper_size", "80mm")}
                                    className={`relative text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                                        data.printer_paper_size === "80mm"
                                            ? "border-primary-500 bg-primary-50/40 dark:bg-primary-950/30 text-slate-900 dark:text-white shadow-sm"
                                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                                    }`}
                                >
                                    {data.printer_paper_size === "80mm" && (
                                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-sm">
                                            <IconCheck size={14} strokeWidth={2.5} />
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 inline-block">
                                            Standar POS
                                        </span>
                                        <h4 className="text-base font-bold text-slate-900 dark:text-white pt-1">
                                            80 mm
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Printer thermal desktop & kasir minimarket
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-400 flex items-center gap-1">
                                        <IconFileText size={14} />
                                        Maks 48 karakter per baris
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Auto-Print Feature Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <IconBolt className="w-5 h-5 text-amber-500" />
                                        <label htmlFor="auto-print-toggle" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                                            Cetak Struk Otomatis (Auto-Print)
                                        </label>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                                        Saat transaksi diselesaikan & lunas, sistem akan langsung mengirim perintah cetak ke printer tanpa perlu klik tombol cetak manual.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                                    <input
                                        id="auto-print-toggle"
                                        type="checkbox"
                                        checked={data.printer_auto_print}
                                        onChange={(e) => setData("printer_auto_print", e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-slate-600 peer-checked:bg-primary-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* Connection Methods & Compatibility Info */}
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 p-5 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                <IconInfoCircle size={16} />
                                Dukungan Konektivitas Hardware
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                    <IconUsb className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">WebUSB</span>
                                    <span className="text-[10px] text-slate-400">Direct Chrome / Edge</span>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                    <IconBluetooth className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Bluetooth</span>
                                    <span className="text-[10px] text-slate-400">Android / Mobile POS</span>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                    <IconDeviceDesktop className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">RAW / CUPS</span>
                                    <span className="text-[10px] text-slate-400">ESC/POS Direct Spooler</span>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={processing}
                                className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white text-sm font-semibold transition-all shadow-md shadow-primary-600/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                <IconPrinter size={18} />
                                {processing ? "Menyimpan..." : "Simpan Pengaturan"}
                            </button>
                        </div>
                    </div>

                    {/* Live Receipt Visualizer */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <IconFileText size={18} className="text-primary-500" />
                                    Simulasi Tampilan Struk
                                </h3>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    Format {data.printer_paper_size}
                                </span>
                            </div>

                            {/* Simulated Paper Container */}
                            <div className="flex justify-center bg-slate-100 dark:bg-slate-950 p-6 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                <div
                                    className={`bg-white text-slate-900 font-mono text-[11px] p-4 shadow-md rounded border border-slate-200 transition-all duration-300 ${
                                        data.printer_paper_size === "58mm" ? "w-[210px]" : "w-[270px]"
                                    }`}
                                >
                                    <div className="text-center space-y-1 mb-3 pb-2 border-b border-dashed border-slate-300">
                                        <p className="font-bold text-xs uppercase tracking-wider">STORE NAME</p>
                                        <p className="text-[10px] text-slate-500">Jl. Contoh POS No. 123</p>
                                        <p className="text-[10px] text-slate-500">Telp: 0812-3456-7890</p>
                                    </div>

                                    <div className="space-y-1 mb-3 text-[10px]">
                                        <div className="flex justify-between">
                                            <span>No: TRX-20260824-001</span>
                                            <span>14:30</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Kasir: Admin</span>
                                            <span>Tunai</span>
                                        </div>
                                    </div>

                                    <div className="border-t border-b border-dashed border-slate-300 py-2 my-2 space-y-1.5">
                                        <div className="flex justify-between">
                                            <span className="truncate max-w-[120px]">Kopi Susu Gula Aren</span>
                                            <span>18.000</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-slate-500">
                                            <span>1 x 18.000</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="truncate max-w-[120px]">Roti Bakar Keju</span>
                                            <span>15.000</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-slate-500">
                                            <span>1 x 15.000</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1 pt-1 text-[11px]">
                                        <div className="flex justify-between font-bold">
                                            <span>TOTAL</span>
                                            <span>Rp 33.000</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span>BAYAR</span>
                                            <span>Rp 50.000</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span>KEMBALI</span>
                                            <span>Rp 17.000</span>
                                        </div>
                                    </div>

                                    <div className="text-center mt-4 pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-500 space-y-0.5">
                                        <p>*** TERIMA KASIH ***</p>
                                        <p>Simulasi Cetak Struk POS</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

Printer.layout = (page) => <DashboardLayout children={page} />;
