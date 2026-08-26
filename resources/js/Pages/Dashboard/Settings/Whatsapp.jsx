import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm } from "@inertiajs/react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import axios from "axios";
import {
    IconBrandWhatsapp,
    IconPlugConnected,
    IconPlugConnectedX,
    IconRobot,
    IconBell,
    IconSparkles,
    IconCalendarTime,
    IconAlertTriangle,
    IconInfoCircle,
    IconDeviceFloppy,
    IconSend,
} from "@tabler/icons-react";

const PLACEHOLDERS = [
    { tag: "{{customer_name}}", label: "Nama Pelanggan" },
    { tag: "{{invoice}}", label: "No. Invoice" },
    { tag: "{{remaining}}", label: "Sisa Tagihan (Rp)" },
    { tag: "{{total}}", label: "Total Piutang (Rp)" },
    { tag: "{{due_date}}", label: "Tgl Jatuh Tempo" },
    { tag: "{{store_name}}", label: "Nama Toko" },
];

export default function Whatsapp({ settings, waStatus }) {
    const { data, setData, post, processing } = useForm({
        wa_service_url: settings.wa_service_url || "",
        wa_enabled: settings.wa_enabled || false,
        wa_auto_reminder: settings.wa_auto_reminder || false,
        wa_auto_invoice: settings.wa_auto_invoice || false,
        wa_receivable_reminder_mode: settings.wa_receivable_reminder_mode || (settings.wa_auto_reminder ? "auto" : "manual"),
        wa_template_due_soon:
            settings.wa_template_due_soon ||
            "Halo {{customer_name}}, ini pengingat tagihan invoice {{invoice}} sebesar Rp {{remaining}} akan jatuh tempo pada {{due_date}}. Mohon dapat melakukan pembayaran sebelum jatuh tempo. Terima kasih.",
        wa_template_overdue:
            settings.wa_template_overdue ||
            "Halo {{customer_name}}, tagihan invoice {{invoice}} sebesar Rp {{remaining}} telah melewati jatuh tempo ({{due_date}}). Mohon segera melakukan konfirmasi dan pelunasan pembayaran. Terima kasih.",
    });

    const [status, setStatus] = useState(waStatus || { connected: false, phone: null, qr: null, starting: false });
    const [polling, setPolling] = useState(false);
    const [testNumber, setTestNumber] = useState("");
    const [activeTemplateTab, setActiveTemplateTab] = useState("due_soon");

    const dueSoonTextareaRef = useRef(null);
    const overdueTextareaRef = useRef(null);

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

    const insertPlaceholder = (field, tag) => {
        const textarea = field === "wa_template_due_soon" ? dueSoonTextareaRef.current : overdueTextareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = data[field] || "";
            const newText = text.substring(0, start) + tag + text.substring(end);
            setData(field, newText);
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + tag.length, start + tag.length);
            }, 50);
        } else {
            setData(field, (data[field] ? data[field] + " " : "") + tag);
        }
    };

    const renderPreview = (template) => {
        if (!template) return "-";
        return template
            .replaceAll("{{customer_name}}", "Budi Santoso")
            .replaceAll("{{name}}", "Budi Santoso")
            .replaceAll("{{invoice}}", "RCV-202608-001")
            .replaceAll("{{remaining}}", "250.000")
            .replaceAll("{{total}}", "500.000")
            .replaceAll("{{due_date}}", "28/08/2026")
            .replaceAll("{{store_name}}", "Point of Sales")
            .replaceAll("{{reason}}", "jatuh tempo");
    };

    return (
        <>
            <Head title="Pengaturan WhatsApp" />
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <IconBrandWhatsapp size={28} className="text-emerald-500" />
                        WhatsApp Gateway & Otomatisasi Reminder
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Konfigurasi koneksi WhatsApp Gateway, mode pengiriman reminder piutang, dan kustomisasi template pesan.
                    </p>
                </div>

                <div className="bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700/50 rounded-2xl p-4 flex gap-3">
                    <IconInfoCircle className="text-sky-600 dark:text-sky-400 flex-shrink-0" size={24} />
                    <div className="text-sm text-sky-800 dark:text-sky-300 space-y-2">
                        <strong className="block font-bold">Panduan Pengiriman Aman (Smart Delay Aktif)</strong>
                        <p>
                            Sistem ini telah dilengkapi dengan fitur pengaman <strong>Smart Delay</strong> yang mengatur jeda antar pesan secara acak dan natural, menyerupai ketikan manusia. Teknologi ini dirancang khusus untuk meminimalkan risiko filter anti-spam WhatsApp.
                        </p>
                        <p>
                            Meskipun sistem telah bekerja secara aman di latar belakang, sebagai langkah perlindungan ekstra (<em>best practice</em>), kami tetap merekomendasikan penggunaan <strong>nomor operasional toko</strong> (bukan nomor pribadi utama) dan membatasi eksekusi pengiriman kampanye secara bertahap (maksimal 100 pesan per sesi).
                        </p>
                    </div>
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
                                        onChange={(e) => setData("wa_enabled", e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="font-medium">Aktifkan Penggunaan WhatsApp Gateway</span>
                                </label>

                                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={data.wa_auto_invoice}
                                        onChange={(e) => setData("wa_auto_invoice", e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span>Kirim invoice otomatis setelah transaksi selesai</span>
                                </label>
                            </div>

                            {/* Card 2: Pilihan Mode Reminder Piutang (Kirim Otomatis vs Pengingat Internal) */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                            <IconRobot size={20} className="text-primary-500" />
                                            Mode Pengiriman Reminder Piutang
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Tentukan bagaimana pengingat jatuh tempo H-3 dan overdue diproses setiap hari (01:15 WIB).
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    {/* Pilihan 1: Pengingat Internal (Manual) */}
                                    <div
                                        onClick={() => {
                                            setData((prev) => ({
                                                ...prev,
                                                wa_receivable_reminder_mode: "manual",
                                                wa_auto_reminder: false,
                                            }));
                                        }}
                                        className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                                            data.wa_receivable_reminder_mode === "manual"
                                                ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500/50 dark:border-primary-500 dark:bg-primary-900/20 dark:ring-primary-500/30"
                                                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div
                                                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                                    data.wa_receivable_reminder_mode === "manual"
                                                        ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                                                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                                }`}
                                            >
                                                <IconBell size={22} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={`font-semibold text-sm ${data.wa_receivable_reminder_mode === 'manual' ? 'text-primary-900 dark:text-primary-100' : 'text-slate-900 dark:text-white'}`}>
                                                        Pengingat Internal (Manual)
                                                    </span>
                                                    <input
                                                        type="radio"
                                                        name="wa_receivable_reminder_mode"
                                                        checked={data.wa_receivable_reminder_mode === "manual"}
                                                        onChange={() => {}}
                                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300"
                                                    />
                                                </div>
                                                <p className={`mt-1 text-xs leading-relaxed ${data.wa_receivable_reminder_mode === 'manual' ? 'text-primary-700 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    Hanya menyusun antrean reminder internal di CRM. Owner/staf meninjau dan mengirim pesan WhatsApp secara manual lewat tombol kirim.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pilihan 2: Kirim Otomatis via WA Gateway */}
                                    <div
                                        onClick={() => {
                                            setData((prev) => ({
                                                ...prev,
                                                wa_receivable_reminder_mode: "auto",
                                                wa_auto_reminder: true,
                                            }));
                                        }}
                                        className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                                            data.wa_receivable_reminder_mode === "auto"
                                                ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500/50 dark:border-primary-500 dark:bg-primary-900/20 dark:ring-primary-500/30"
                                                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div
                                                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                                    data.wa_receivable_reminder_mode === "auto"
                                                        ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                                                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                                }`}
                                            >
                                                <IconRobot size={22} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={`font-semibold text-sm ${data.wa_receivable_reminder_mode === 'auto' ? 'text-primary-900 dark:text-primary-100' : 'text-slate-900 dark:text-white'}`}>
                                                        Kirim Otomatis (Auto-Dispatch)
                                                    </span>
                                                    <input
                                                        type="radio"
                                                        name="wa_receivable_reminder_mode"
                                                        checked={data.wa_receivable_reminder_mode === "auto"}
                                                        onChange={() => {}}
                                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300"
                                                    />
                                                </div>
                                                <p className={`mt-1 text-xs leading-relaxed ${data.wa_receivable_reminder_mode === 'auto' ? 'text-primary-700 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    Pesan pengingat otomatis terkirim langsung ke nomor WhatsApp pelanggan saat jadwal cron berjalan, tanpa perlu klik manual.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Custom Template Pesan Pengingat */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                        <IconSparkles size={20} className="text-amber-500" />
                                        Template Pesan Reminder Piutang
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Sesuaikan kata-kata pesan WhatsApp untuk pengingat jatuh tempo dan piutang overdue.
                                    </p>
                                </div>

                                {/* Placeholder Chips */}
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                                        <IconInfoCircle size={15} className="text-primary-500" />
                                        Klik variabel berikut untuk menyisipkan ke template:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {PLACEHOLDERS.map((item) => (
                                            <button
                                                key={item.tag}
                                                type="button"
                                                onClick={() =>
                                                    insertPlaceholder(
                                                        activeTemplateTab === "due_soon"
                                                            ? "wa_template_due_soon"
                                                            : "wa_template_overdue",
                                                        item.tag
                                                    )
                                                }
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-300 transition-colors shadow-2xs"
                                            >
                                                <span className="font-mono text-primary-600 dark:text-primary-400">{item.tag}</span>
                                                <span className="text-slate-400 dark:text-slate-400">({item.label})</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tab Selector */}
                                <div className="flex border-b border-slate-200 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTemplateTab("due_soon")}
                                        className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors px-1 ${
                                            activeTemplateTab === "due_soon"
                                                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                                        }`}
                                    >
                                        <IconCalendarTime size={18} />
                                        Jatuh Tempo (H-3)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTemplateTab("overdue")}
                                        className={`ml-6 pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors px-1 ${
                                            activeTemplateTab === "overdue"
                                                ? "border-rose-500 text-rose-600 dark:text-rose-400"
                                                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                                        }`}
                                    >
                                        <IconAlertTriangle size={18} />
                                        Piutang Overdue
                                    </button>
                                </div>

                                {/* Tab 1: Template Jatuh Tempo (H-3) */}
                                {activeTemplateTab === "due_soon" && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                                Template Pesan Pengingat Jatuh Tempo (H-3)
                                            </label>
                                            <textarea
                                                ref={dueSoonTextareaRef}
                                                rows={4}
                                                value={data.wa_template_due_soon}
                                                onChange={(e) => setData("wa_template_due_soon", e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 p-3.5 text-sm font-normal focus:ring-2 focus:ring-primary-500"
                                                placeholder="Tulis template pesan jatuh tempo..."
                                            />
                                        </div>

                                        {/* Live Preview */}
                                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-4">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                                                <IconBrandWhatsapp size={16} />
                                                Pratinjau Pesan yang Diterima Pelanggan:
                                            </div>
                                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 border border-emerald-100 dark:border-slate-700 shadow-2xs whitespace-pre-wrap">
                                                {renderPreview(data.wa_template_due_soon)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tab 2: Template Overdue */}
                                {activeTemplateTab === "overdue" && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                                                Template Pesan Piutang Overdue (Lewat Jatuh Tempo)
                                            </label>
                                            <textarea
                                                ref={overdueTextareaRef}
                                                rows={4}
                                                value={data.wa_template_overdue}
                                                onChange={(e) => setData("wa_template_overdue", e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 p-3.5 text-sm font-normal focus:ring-2 focus:ring-rose-500"
                                                placeholder="Tulis template pesan overdue..."
                                            />
                                        </div>

                                        {/* Live Preview */}
                                        <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20 p-4">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2">
                                                <IconBrandWhatsapp size={16} />
                                                Pratinjau Pesan yang Diterima Pelanggan:
                                            </div>
                                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 border border-rose-100 dark:border-slate-700 shadow-2xs whitespace-pre-wrap">
                                                {renderPreview(data.wa_template_overdue)}
                                            </div>
                                        </div>
                                    </div>
                                )}
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
