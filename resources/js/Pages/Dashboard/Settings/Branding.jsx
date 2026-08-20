import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import {
    IconPalette,
    IconDeviceFloppy,
    IconPhoto,
    IconWorld,
    IconSparkles,
    IconLayoutDashboard,
    IconSquareCheck,
    IconClick,
    IconTrash,
    IconExternalLink,
    IconRefresh,
    IconLayersLinked,
} from "@tabler/icons-react";
import { applyThemeColors } from "@/Utils/brandingTheme";

const PRESET_PRIMARY_COLORS = [
    { name: "Indigo (Default)", hex: "#4f46e5" },
    { name: "Ocean Blue", hex: "#0284c7" },
    { name: "Emerald Green", hex: "#059669" },
    { name: "Royal Violet", hex: "#7c3aed" },
    { name: "Crimson Rose", hex: "#e11d48" },
    { name: "Amber Gold", hex: "#d97706" },
    { name: "Midnight Slate", hex: "#334155" },
    { name: "Modern Teal", hex: "#0d9488" },
];

const PRESET_ACCENT_COLORS = [
    { name: "Cyan (Default)", hex: "#06b6d4" },
    { name: "Sky Blue", hex: "#38bdf8" },
    { name: "Emerald", hex: "#10b981" },
    { name: "Amber", hex: "#f59e0b" },
    { name: "Fuchsia", hex: "#d946ef" },
    { name: "Rose", hex: "#f43f5e" },
];

export default function Branding({ settings, branding }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        app_name: settings.app_name || "Point of Sales",
        app_tagline: settings.app_tagline || "Sistem Kasir & Manajemen Toko Modern",
        app_logo_light: null,
        app_logo_dark: null,
        app_logo_collapsed: null,
        app_favicon: null,
        remove_app_logo_light: false,
        remove_app_logo_dark: false,
        remove_app_logo_collapsed: false,
        remove_app_favicon: false,
        theme_primary_color: settings.theme_primary_color || "#4f46e5",
        theme_accent_color: settings.theme_accent_color || "#06b6d4",
        app_footer_text: settings.app_footer_text || "",
        app_powered_by_show: Boolean(settings.app_powered_by_show),
        app_powered_by_text: settings.app_powered_by_text || "",
        app_powered_by_url: settings.app_powered_by_url || "",
        landing_page_mode: settings.landing_page_mode || "public_landing",
    });

    const [previewLight, setPreviewLight] = useState(branding.logoLight || null);
    const [previewDark, setPreviewDark] = useState(branding.logoDark || null);
    const [previewCollapsed, setPreviewCollapsed] = useState(branding.logoCollapsed || null);
    const [previewFavicon, setPreviewFavicon] = useState(branding.favicon || null);

    useEffect(() => {
        return () => {
            [previewLight, previewDark, previewCollapsed, previewFavicon].forEach((url) => {
                if (url && url.startsWith("blob:")) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [previewLight, previewDark, previewCollapsed, previewFavicon]);

    // Live preview theme color changes across the entire dashboard
    useEffect(() => {
        if (data.theme_primary_color || data.theme_accent_color) {
            applyThemeColors(data.theme_primary_color, data.theme_accent_color);
        }
    }, [data.theme_primary_color, data.theme_accent_color]);

    const submit = (e) => {
        e.preventDefault();
        post(route("settings.branding.update"), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Pengaturan White Label Branding berhasil disimpan!");
            },
            onError: () => toast.error("Gagal menyimpan pengaturan branding. Periksa form."),
        });
    };

    return (
        <>
            <Head title="White Label & Branding" />

            <div className="space-y-8 max-w-7xl mx-auto pb-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-sm mb-1">
                            <IconPalette size={20} />
                            <span>Kustomisasi Identitas & White Label</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            Branding & Tampilan Aplikasi
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Ubah nama platform, logo, favicon, palet warna, dan mode halaman utama tanpa menyentuh kode.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={submit}
                        disabled={processing}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium shadow-lg shadow-primary-500/25 transition-all duration-150 disabled:opacity-50"
                    >
                        <IconDeviceFloppy size={20} />
                        <span>{processing ? "Menyimpan..." : "Simpan Perubahan"}</span>
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-8">
                    {/* Section 1: Identitas Aplikasi */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                                <IconSparkles size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Identitas Brand</h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Nama platform dan deskripsi yang tampil di title bar & metadata.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Nama Aplikasi / Brand <span className="text-rose-500">*</span>
                                </label>
                                <Input
                                    type="text"
                                    value={data.app_name}
                                    onChange={(e) => setData("app_name", e.target.value)}
                                    placeholder="Contoh: MajuPOS, KasirKu, Retaila"
                                    className="w-full"
                                    required
                                />
                                {errors.app_name && <p className="text-xs text-rose-500 mt-1">{errors.app_name}</p>}
                                <p className="text-xs text-slate-400 mt-1.5">Akan menggantikan teks "Point of Sales" di seluruh aplikasi & PWA.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Tagline / Slogan
                                </label>
                                <Input
                                    type="text"
                                    value={data.app_tagline}
                                    onChange={(e) => setData("app_tagline", e.target.value)}
                                    placeholder="Contoh: Solusi Kasir Terpercaya untuk Bisnis Anda"
                                    className="w-full"
                                />
                                {errors.app_tagline && <p className="text-xs text-rose-500 mt-1">{errors.app_tagline}</p>}
                                <p className="text-xs text-slate-400 mt-1.5">Tampil pada meta description dan deskripsi pencarian.</p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Logo & Media Assets */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                                <IconPhoto size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Logo & Favicon</h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Unggah logo resmi platform Anda untuk berbagai mode tampilan.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                            {/* Logo Light */}
                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Logo Light Mode
                                </label>
                                <div className="h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center p-3 relative group overflow-hidden">
                                    {previewLight ? (
                                        <img src={previewLight} alt="Logo Light" className="max-h-full max-w-full object-contain" />
                                    ) : (
                                        <div className="text-center text-slate-400">
                                            <IconPhoto size={28} className="mx-auto mb-1 opacity-50" />
                                            <span className="text-xs">Default Logo</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept="image/png,image/svg+xml,image/webp,image/jpeg"
                                        id="logo_light_input"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                setData((prev) => ({ ...prev, app_logo_light: file, remove_app_logo_light: false }));
                                                setPreviewLight(URL.createObjectURL(file));
                                            }
                                        }}
                                    />
                                    <label
                                        htmlFor="logo_light_input"
                                        className="cursor-pointer flex-1 text-center py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    >
                                        Pilih File
                                    </label>
                                    {previewLight && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setData((prev) => ({ ...prev, app_logo_light: null, remove_app_logo_light: true }));
                                                setPreviewLight(null);
                                            }}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                                            title="Hapus Logo"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400">Digunakan pada sidebar terang dan halaman login.</p>
                            </div>

                            {/* Logo Dark */}
                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Logo Dark Mode
                                </label>
                                <div className="h-32 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 flex items-center justify-center p-3 relative group overflow-hidden">
                                    {previewDark ? (
                                        <img src={previewDark} alt="Logo Dark" className="max-h-full max-w-full object-contain" />
                                    ) : (
                                        <div className="text-center text-slate-500">
                                            <IconPhoto size={28} className="mx-auto mb-1 opacity-50" />
                                            <span className="text-xs">Default Logo</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept="image/png,image/svg+xml,image/webp,image/jpeg"
                                        id="logo_dark_input"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                setData((prev) => ({ ...prev, app_logo_dark: file, remove_app_logo_dark: false }));
                                                setPreviewDark(URL.createObjectURL(file));
                                            }
                                        }}
                                    />
                                    <label
                                        htmlFor="logo_dark_input"
                                        className="cursor-pointer flex-1 text-center py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    >
                                        Pilih File
                                    </label>
                                    {previewDark && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setData((prev) => ({ ...prev, app_logo_dark: null, remove_app_logo_dark: true }));
                                                setPreviewDark(null);
                                            }}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                                            title="Hapus Logo"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400">Digunakan pada sidebar gelap / mode dark.</p>
                            </div>

                            {/* Logo Collapsed / Mobile */}
                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Icon / Logo Mini
                                </label>
                                <div className="h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center p-3 relative group overflow-hidden">
                                    {previewCollapsed ? (
                                        <img src={previewCollapsed} alt="Logo Mini" className="max-h-full max-w-full object-contain" />
                                    ) : (
                                        <div className="text-center text-slate-400">
                                            <IconPhoto size={28} className="mx-auto mb-1 opacity-50" />
                                            <span className="text-xs">Default Icon</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept="image/png,image/svg+xml,image/webp,image/jpeg"
                                        id="logo_collapsed_input"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                setData((prev) => ({ ...prev, app_logo_collapsed: file, remove_app_logo_collapsed: false }));
                                                setPreviewCollapsed(URL.createObjectURL(file));
                                            }
                                        }}
                                    />
                                    <label
                                        htmlFor="logo_collapsed_input"
                                        className="cursor-pointer flex-1 text-center py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    >
                                        Pilih File
                                    </label>
                                    {previewCollapsed && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setData((prev) => ({ ...prev, app_logo_collapsed: null, remove_app_logo_collapsed: true }));
                                                setPreviewCollapsed(null);
                                            }}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                                            title="Hapus Logo"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400">Digunakan saat sidebar diminimalkan dan icon PWA.</p>
                            </div>

                            {/* Favicon */}
                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Favicon Tab Browser
                                </label>
                                <div className="h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center p-3 relative group overflow-hidden">
                                    {previewFavicon ? (
                                        <img src={previewFavicon} alt="Favicon" className="w-12 h-12 object-contain" />
                                    ) : (
                                        <div className="text-center text-slate-400">
                                            <IconPhoto size={28} className="mx-auto mb-1 opacity-50" />
                                            <span className="text-xs">Default Favicon</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept="image/x-icon,image/png,image/svg+xml,image/webp"
                                        id="favicon_input"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                setData((prev) => ({ ...prev, app_favicon: file, remove_app_favicon: false }));
                                                setPreviewFavicon(URL.createObjectURL(file));
                                            }
                                        }}
                                    />
                                    <label
                                        htmlFor="favicon_input"
                                        className="cursor-pointer flex-1 text-center py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    >
                                        Pilih File
                                    </label>
                                    {previewFavicon && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setData((prev) => ({ ...prev, app_favicon: null, remove_app_favicon: true }));
                                                setPreviewFavicon(null);
                                            }}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                                            title="Hapus Favicon"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400">Format .ico, .png, atau .svg (Rekomendasi 32x32 atau 64x64).</p>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Theming & Color Engine */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">
                                <IconPalette size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Palet Warna Brand (Dynamic Theming)</h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Pilih palet warna siap pakai atau gunakan kode Hex custom bisnis Anda.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                            {/* Primary Color */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                        Warna Utama (Primary Color)
                                    </label>
                                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                        {data.theme_primary_color}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={data.theme_primary_color}
                                        onChange={(e) => setData("theme_primary_color", e.target.value)}
                                        className="w-12 h-12 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-800"
                                    />
                                    <Input
                                        type="text"
                                        value={data.theme_primary_color}
                                        onChange={(e) => setData("theme_primary_color", e.target.value)}
                                        placeholder="#4f46e5"
                                        className="flex-1 font-mono uppercase"
                                    />
                                </div>

                                <div>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Preset Warna Populer:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {PRESET_PRIMARY_COLORS.map((preset) => (
                                            <button
                                                key={preset.hex}
                                                type="button"
                                                onClick={() => setData("theme_primary_color", preset.hex)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                                    data.theme_primary_color.toLowerCase() === preset.hex.toLowerCase()
                                                        ? "border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                                                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                }`}
                                            >
                                                <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: preset.hex }} />
                                                <span>{preset.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Accent Color */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                        Warna Aksen (Accent Color)
                                    </label>
                                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                        {data.theme_accent_color}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={data.theme_accent_color}
                                        onChange={(e) => setData("theme_accent_color", e.target.value)}
                                        className="w-12 h-12 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-800"
                                    />
                                    <Input
                                        type="text"
                                        value={data.theme_accent_color}
                                        onChange={(e) => setData("theme_accent_color", e.target.value)}
                                        placeholder="#06b6d4"
                                        className="flex-1 font-mono uppercase"
                                    />
                                </div>

                                <div>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Preset Warna Aksen:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {PRESET_ACCENT_COLORS.map((preset) => (
                                            <button
                                                key={preset.hex}
                                                type="button"
                                                onClick={() => setData("theme_accent_color", preset.hex)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                                    data.theme_accent_color.toLowerCase() === preset.hex.toLowerCase()
                                                        ? "border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                                                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                }`}
                                            >
                                                <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: preset.hex }} />
                                                <span>{preset.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Live Preview Widget */}
                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Live Preview UI Elements</h3>
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-4">
                                <button
                                    type="button"
                                    className="px-4 py-2 rounded-xl text-white font-medium text-sm shadow-md"
                                    style={{ backgroundColor: data.theme_primary_color }}
                                >
                                    Tombol Utama
                                </button>
                                <span
                                    className="px-3 py-1 rounded-full text-xs font-semibold"
                                    style={{
                                        backgroundColor: `${data.theme_primary_color}20`,
                                        color: data.theme_primary_color,
                                    }}
                                >
                                    Badge Highlight
                                </span>
                                <button
                                    type="button"
                                    className="px-4 py-2 rounded-xl text-white font-medium text-sm shadow-sm"
                                    style={{ backgroundColor: data.theme_accent_color }}
                                >
                                    Aksen Sekunder
                                </button>
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    <IconSquareCheck size={18} style={{ color: data.theme_primary_color }} />
                                    <span>Contoh Checklist Aktif</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Halaman Muka & Mode Deployment */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                                <IconWorld size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mode Halaman Utama & Akses Publik</h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Tentukan tampilan saat pengunjung mengakses domain utama Anda.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <label
                                className={`cursor-pointer p-4 rounded-2xl border-2 transition relative flex flex-col justify-between ${
                                    data.landing_page_mode === "public_landing"
                                        ? "border-primary-600 bg-primary-50/20 dark:bg-primary-950/20"
                                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <input
                                            type="radio"
                                            name="landing_page_mode"
                                            value="public_landing"
                                            checked={data.landing_page_mode === "public_landing"}
                                            onChange={(e) => setData("landing_page_mode", e.target.value)}
                                            className="sr-only"
                                        />
                                        <p className="font-bold text-slate-900 dark:text-white text-base">Public Marketing Landing Page</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Menampilkan landing page informasi fitur & navigasi sebelum pengguna login.
                                        </p>
                                    </div>
                                    <div
                                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                            data.landing_page_mode === "public_landing"
                                                ? "border-primary-600 bg-primary-600 text-white"
                                                : "border-slate-300"
                                        }`}
                                    >
                                        {data.landing_page_mode === "public_landing" && <span className="w-2 h-2 rounded-full bg-white" />}
                                    </div>
                                </div>
                            </label>

                            <label
                                className={`cursor-pointer p-4 rounded-2xl border-2 transition relative flex flex-col justify-between ${
                                    data.landing_page_mode === "direct_login"
                                        ? "border-primary-600 bg-primary-50/20 dark:bg-primary-950/20"
                                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <input
                                            type="radio"
                                            name="landing_page_mode"
                                            value="direct_login"
                                            checked={data.landing_page_mode === "direct_login"}
                                            onChange={(e) => setData("landing_page_mode", e.target.value)}
                                            className="sr-only"
                                        />
                                        <p className="font-bold text-slate-900 dark:text-white text-base">Direct Login (Dedicated Client)</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Akses URL utama (/) langsung dialihkan ke halaman login klien yang bermerek.
                                        </p>
                                    </div>
                                    <div
                                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                            data.landing_page_mode === "direct_login"
                                                ? "border-primary-600 bg-primary-600 text-white"
                                                : "border-slate-300"
                                        }`}
                                    >
                                        {data.landing_page_mode === "direct_login" && <span className="w-2 h-2 rounded-full bg-white" />}
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Section 5: Footer & Watermark Agency */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                        <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
                                <IconLayersLinked size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Footer & Identitas Reseller (Opsional)</h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Pengaturan copyright dan watermark agensi / software house pengembang.</p>
                            </div>
                        </div>

                        <div className="space-y-6 mt-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Teks Copyright Footer
                                </label>
                                <Input
                                    type="text"
                                    value={data.app_footer_text}
                                    onChange={(e) => setData("app_footer_text", e.target.value)}
                                    placeholder="Contoh: © 2026 PT Nama Klien Anda. All rights reserved."
                                    className="w-full"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={data.app_powered_by_show}
                                        onChange={(e) => setData("app_powered_by_show", e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        Tampilkan label "Powered by" (Watermark Agensi / Vendor)
                                    </span>
                                </label>

                                {data.app_powered_by_show && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                Teks Agensi / Vendor
                                            </label>
                                            <Input
                                                type="text"
                                                value={data.app_powered_by_text}
                                                onChange={(e) => setData("app_powered_by_text", e.target.value)}
                                                placeholder="Contoh: Powered by AgencySolusi"
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                                Website Link URL
                                            </label>
                                            <Input
                                                type="url"
                                                value={data.app_powered_by_url}
                                                onChange={(e) => setData("app_powered_by_url", e.target.value)}
                                                placeholder="https://agencyanda.com"
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Save Action */}
                    <div className="flex items-center justify-end gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-base shadow-xl shadow-primary-500/25 transition-all duration-150 disabled:opacity-50"
                        >
                            <IconDeviceFloppy size={22} />
                            <span>{processing ? "Menyimpan..." : "Simpan Semua Pengaturan Branding"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

Branding.layout = (page) => <DashboardLayout children={page} />;
