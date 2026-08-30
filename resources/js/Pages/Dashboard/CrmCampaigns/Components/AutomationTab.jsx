import { useForm, usePage } from "@inertiajs/react";
import { useState, useRef } from "react";
import toast from "react-hot-toast";
import {
    IconRobotFace,
    IconBell,
    IconSparkles,
    IconCalendarTime,
    IconAlertTriangle,
    IconInfoCircle,
    IconDeviceFloppy,
    IconBrandWhatsapp,
    IconClock,
} from "@tabler/icons-react";

const PLACEHOLDERS = [
    { tag: "{{customer_name}}", label: "Nama Pelanggan" },
    { tag: "{{invoice}}", label: "No. Invoice" },
    { tag: "{{remaining}}", label: "Sisa Tagihan (Rp)" },
    { tag: "{{total}}", label: "Total Piutang (Rp)" },
    { tag: "{{due_date}}", label: "Tgl Jatuh Tempo" },
    { tag: "{{store_name}}", label: "Nama Toko" },
];

export default function AutomationTab({ settings = {} }) {
    const { props } = usePage();
    const wa_ready = props.wa_ready;

    const { data, setData, post, processing } = useForm({
        wa_auto_reminder: settings?.wa_auto_reminder || false,
        wa_auto_invoice: settings?.wa_auto_invoice || false,
        wa_receivable_reminder_mode: settings?.wa_receivable_reminder_mode || (settings?.wa_auto_reminder ? "auto" : "manual"),
        wa_reminder_schedule_time: settings?.wa_reminder_schedule_time || "09:15",
        wa_template_due_soon:
            settings?.wa_template_due_soon ||
            "Halo {{customer_name}}, ini pengingat tagihan invoice {{invoice}} sebesar Rp {{remaining}} akan jatuh tempo pada {{due_date}}. Mohon dapat melakukan pembayaran sebelum jatuh tempo. Terima kasih.",
        wa_template_overdue:
            settings?.wa_template_overdue ||
            "Halo {{customer_name}}, tagihan invoice {{invoice}} sebesar Rp {{remaining}} telah melewati jatuh tempo ({{due_date}}). Mohon segera melakukan konfirmasi dan pelunasan pembayaran. Terima kasih.",
    });

    const [activeTemplateTab, setActiveTemplateTab] = useState("due_soon");
    const dueSoonTextareaRef = useRef(null);
    const overdueTextareaRef = useRef(null);

    const handleSave = (e) => {
        e.preventDefault();
        post(route("crm-campaigns.automation.update"), {
            preserveScroll: true,
            onSuccess: () => toast.success("Pengaturan Otomatisasi & CRM berhasil disimpan"),
            onError: () => toast.error("Gagal menyimpan pengaturan"),
        });
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
            <div className="space-y-6 max-w-4xl mx-auto">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <IconRobotFace size={28} className="text-primary-500" />
                        Pengingat Otomatis
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Konfigurasi otomatisasi pengiriman pesan dan template untuk berinteraksi dengan pelanggan.
                    </p>
                </div>

                {!wa_ready && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-start gap-3">
                        <IconAlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                        <div>
                            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">WhatsApp Gateway Sedang Offline</h3>
                            <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-1">
                                Beberapa fitur otomatisasi pengiriman (Auto-Dispatch dan Kirim Otomatis Struk) di bawah ini dinonaktifkan sementara karena koneksi sistem ke WhatsApp saat ini terputus. Pastikan WhatsApp Gateway menyala di pengaturan Infrastruktur.
                            </p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Card 1: Pengaturan Struk Otomatis (Hidden for now as backend is not implemented) */}
                    {/* 
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <IconBrandWhatsapp size={20} className="text-emerald-500" />
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                Pengiriman Transaksi
                            </h2>
                        </div>
                        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={data.wa_auto_invoice}
                                disabled={!wa_ready && !data.wa_auto_invoice}
                                onChange={(e) => setData("wa_auto_invoice", e.target.checked)}
                                className={`w-4 h-4 rounded border-slate-300 focus:ring-primary-500 ${!wa_ready && !data.wa_auto_invoice ? "bg-slate-100 cursor-not-allowed opacity-60" : "text-primary-600"}`}
                            />
                            <span className={!wa_ready && !data.wa_auto_invoice ? "opacity-60" : ""}>
                                Kirim invoice otomatis melalui WhatsApp setelah transaksi selesai (Auto-Invoice)
                            </span>
                        </label>
                    </div>
                    */}

                    {/* Card 2: Pilihan Mode Reminder Piutang (Kirim Otomatis vs Pengingat Internal) */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <IconRobotFace size={20} className="text-primary-500" />
                                    Mode Pengiriman Reminder Piutang
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Tentukan bagaimana pengingat jatuh tempo H-3 dan overdue diproses setiap hari ({data.wa_reminder_schedule_time || "09:15"} WIB).
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
                                                className="h-4 w-4 focus:ring-primary-500 border-slate-300 text-primary-600"
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
                                    if (wa_ready || data.wa_receivable_reminder_mode === "auto") {
                                        setData((prev) => ({
                                            ...prev,
                                            wa_receivable_reminder_mode: "auto",
                                            wa_auto_reminder: true,
                                        }));
                                    }
                                }}
                                className={`${!wa_ready && data.wa_receivable_reminder_mode !== "auto" ? "cursor-not-allowed opacity-70" : "cursor-pointer"} rounded-2xl border p-4 transition-all ${
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
                                        <IconRobotFace size={22} />
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
                                                disabled={!wa_ready && data.wa_receivable_reminder_mode !== "auto"}
                                                onChange={() => {}}
                                                className={`h-4 w-4 focus:ring-primary-500 border-slate-300 ${!wa_ready && data.wa_receivable_reminder_mode !== "auto" ? "bg-slate-100 opacity-60" : "text-primary-600"}`}
                                            />
                                        </div>
                                        <p className={`mt-1 text-xs leading-relaxed ${data.wa_receivable_reminder_mode === 'auto' ? 'text-primary-700 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                            Pesan pengingat otomatis terkirim langsung ke nomor WhatsApp pelanggan saat jadwal cron berjalan, tanpa perlu klik manual.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pengaturan Jam Pengiriman Otomatis */}
                        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        <IconClock size={18} className="text-primary-500" />
                                        Jam Pengiriman Otomatis (WIB)
                                    </label>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Pilih jam eksekusi cronjob harian untuk memicu pengingat piutang otomatis.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={data.wa_reminder_schedule_time}
                                        onChange={(e) => setData("wa_reminder_schedule_time", e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pilihan cepat:</span>
                                {[
                                    { label: "08:00 (Pagi)", value: "08:00" },
                                    { label: "09:15 (Standar)", value: "09:15" },
                                    { label: "10:00 (Siang)", value: "10:00" },
                                    { label: "14:00 (Siang)", value: "14:00" },
                                    { label: "16:00 (Sore)", value: "16:00" },
                                ].map((preset) => (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={() => setData("wa_reminder_schedule_time", preset.value)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                            data.wa_reminder_schedule_time === preset.value
                                                ? "bg-primary-500 text-white font-bold shadow-2xs"
                                                : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600"
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
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
        </>
    );
}
