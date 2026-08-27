import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm } from "@inertiajs/react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import axios from "axios";
import {
    IconBrandWhatsapp,
    IconPlugConnected,
    IconPlugConnectedX,
    IconDeviceFloppy,
    IconSend,
} from "@tabler/icons-react";

export default function Whatsapp({ settings, waStatus }) {
    const { data, setData, post, processing } = useForm({
        wa_service_url: settings.wa_service_url || "",
        wa_enabled: settings.wa_enabled || false,
    });

    const [status, setStatus] = useState(waStatus || { connected: false, phone: null, qr: null, starting: false });
    const [polling, setPolling] = useState(false);
    const [testNumber, setTestNumber] = useState("");

    useEffect(() => {
        let interval;
        if (polling || status.starting) {
            interval = setInterval(() => {
                fetchStatus();
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [polling, status.starting]);

    const fetchStatus = async () => {
        try {
            const res = await axios.get(route("settings.whatsapp.status"));
            setStatus(res.data);
            if (res.data.connected) setPolling(false);
        } catch (e) {}
    };

    const handleConnect = async () => {
        try {
            await axios.post(route("settings.whatsapp.start"));
            setPolling(true);
            setStatus((s) => ({ ...s, starting: true }));
        } catch (e) {
            toast.error("Gagal menghubungkan");
        }
    };

    const handleDisconnect = async () => {
        try {
            await axios.post(route("settings.whatsapp.disconnect"));
            setStatus({ connected: false, phone: null, qr: null, starting: false });
            toast.success("Koneksi diputuskan");
        } catch (e) {
            toast.error("Gagal memutuskan koneksi");
        }
    };

    const handleSave = (e) => {
        e.preventDefault();
        post(route("settings.whatsapp.update"), {
            preserveScroll: true,
            onSuccess: () => toast.success("Pengaturan WhatsApp berhasil disimpan"),
            onError: () => toast.error("Gagal menyimpan pengaturan"),
        });
    };

    const handleTest = async () => {
        if (!testNumber) return toast.error("Masukkan nomor tujuan");
        try {
            await axios.post(route("settings.whatsapp.test"), { target: testNumber });
            toast.success("Pesan test terkirim!");
        } catch (e) {
            toast.error("Gagal mengirim");
        }
    };



    return (
        <>
            <Head title="Pengaturan WhatsApp" />
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <IconBrandWhatsapp size={28} className="text-emerald-500" />
                        WhatsApp Gateway
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Konfigurasi koneksi sistem dengan server WhatsApp (Node.js) untuk pengiriman pesan.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Kolom Kiri: Status & Test Send */}
                    <div className="space-y-6 lg:col-span-1">
                        {/* Status Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Status Koneksi</h2>
                            <div className="flex items-center gap-3 mb-4">
                                <div
                                    className={`w-3.5 h-3.5 rounded-full ${
                                        status.connected
                                            ? "bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950"
                                            : status.starting
                                            ? "bg-amber-400 animate-pulse"
                                            : "bg-slate-300 dark:bg-slate-700"
                                    }`}
                                />
                                <div>
                                    <span className="font-semibold text-slate-800 dark:text-white text-sm">
                                        {status.connected
                                            ? `Terhubung (${status.phone || "Aktif"})`
                                            : status.starting
                                            ? "Menghubungkan ke WhatsApp..."
                                            : "Terputus"}
                                    </span>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {status.connected ? "Gateway siap mengirim pesan" : "Gateway offline"}
                                    </p>
                                </div>
                            </div>

                            {status.qr && !status.connected && (
                                <div className="mb-5 text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <img src={status.qr} alt="QR Code" className="mx-auto w-48 h-48 rounded-lg shadow-sm" />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">
                                        Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat lalu scan QR di atas.
                                    </p>
                                </div>
                            )}

                            <div className="pt-2">
                                {!status.connected ? (
                                    <button
                                        type="button"
                                        onClick={handleConnect}
                                        disabled={processing || status.starting}
                                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                                    >
                                        <IconPlugConnected size={18} />
                                        {status.starting ? "Menyiapkan Sesi..." : "Hubungkan WhatsApp"}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleDisconnect}
                                        disabled={processing}
                                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-300 text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <IconPlugConnectedX size={18} />
                                        Putuskan Koneksi
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Test Send */}
                        {status.connected && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                                    <IconSend size={16} className="text-primary-500" />
                                    Test Kirim Pesan
                                </h3>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={testNumber}
                                        onChange={(e) => setTestNumber(e.target.value)}
                                        placeholder="08123456789"
                                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 px-4 text-sm focus:ring-2 focus:ring-primary-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleTest}
                                        disabled={processing}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium transition-colors disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                                    >
                                        Kirim Pesan Uji Coba
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Kolom Kanan: Form Pengaturan Lengkap */}
                    <div className="space-y-6 lg:col-span-2">
                        <form onSubmit={handleSave} className="space-y-6">
                            {/* Card 1: Konfigurasi Service Gateway */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <IconBrandWhatsapp size={20} className="text-emerald-500" />
                                    Konfigurasi Gateway
                                </h2>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        URL Service WhatsApp
                                    </label>
                                    <input
                                        type="text"
                                        value={data.wa_service_url}
                                        onChange={(e) => setData("wa_service_url", e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 px-4 text-sm focus:ring-2 focus:ring-primary-500"
                                        placeholder="http://localhost:3001"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Alamat endpoint service Node.js (whatsapp-web.js)</p>
                                </div>

                                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={data.wa_enabled}
                                        disabled={!waStatus.connected && !data.wa_enabled}
                                        onChange={(e) => setData("wa_enabled", e.target.checked)}
                                        className={`w-4 h-4 rounded border-slate-300 focus:ring-emerald-500 ${!waStatus.connected && !data.wa_enabled ? "bg-slate-100 cursor-not-allowed opacity-60" : "text-emerald-600"}`}
                                    />
                                    <span className={`font-medium ${!waStatus.connected && !data.wa_enabled ? "opacity-60" : ""}`}>Aktifkan Penggunaan WhatsApp Gateway</span>
                                </label>

                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors disabled:opacity-50 shadow-md shadow-primary-500/20"
                                >
                                    <IconDeviceFloppy size={18} />
                                    Simpan Pengaturan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}

Whatsapp.layout = (page) => <DashboardLayout children={page} />;
