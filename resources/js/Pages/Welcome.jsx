import { Head, Link, usePage } from "@inertiajs/react";
import PublicLayout from "@/Layouts/PublicLayout";
import {
    IconShoppingCart,
    IconWallet,
    IconBuildingWarehouse,
    IconReceiptTax,
    IconChartBar,
    IconReportMoney,
    IconUsers,
    IconBrandWhatsapp,
    IconShieldLock,
    IconCloudOff,
    IconArrowRight,
    IconDeviceMobile,
    IconPackage,
    IconCreditCard,
    IconRocket,
    IconSparkles,
} from "@tabler/icons-react";

const stats = [
    { value: "44+", label: "Fitur Lengkap" },
    { value: "8", label: "Modul Terintegrasi" },
    { value: "100%", label: "Kontrol Penuh" },
    { value: "Multi", label: "Gudang & Cabang" },
];

const features = [
    {
        icon: IconShoppingCart,
        title: "POS Cepat & Mudah",
        desc: "Cari produk via barcode atau keyboard, scan pakai kamera (PWA), cart hold/resume, dan checkout dalam hitungan detik.",
    },
    {
        icon: IconWallet,
        title: "Multi-Payment",
        desc: "Tunai, transfer bank, QRIS (Midtrans), Xendit, hingga pay later (piutang) — semua dalam satu kasir.",
    },
    {
        icon: IconBuildingWarehouse,
        title: "Multi-Warehouse",
        desc: "Stok terpisah per gudang/cabang, transfer antar gudang, stock opname, dan tracking batch/expiry (FEFO).",
    },
    {
        icon: IconReceiptTax,
        title: "PPN & Pajak",
        desc: "Dukungan PPN 11% (exclusive/inclusive), data NPWP pelanggan, dan laporan pajak yang rapi.",
    },
    {
        icon: IconChartBar,
        title: "Laporan & Insight",
        desc: "Laporan penjualan, profit & margin, performa per kasir, jam sibuk, dan repeat customer.",
    },
    {
        icon: IconReportMoney,
        title: "Piutang & Hutang",
        desc: "Kelola piutang pelanggan & hutang supplier dengan aging analysis dan partial payment.",
    },
    {
        icon: IconUsers,
        title: "CRM & Loyalty",
        desc: "Member tiers, poin loyalty, voucher, segmentasi pelanggan otomatis, dan campaign marketing.",
    },
    {
        icon: IconBrandWhatsapp,
        title: "WhatsApp Gateway",
        desc: "Kirim struk, reminder piutang, dan promo otomatis ke pelanggan via WhatsApp (whatsapp-web.js).",
    },
    {
        icon: IconShieldLock,
        title: "RBAC & Audit Log",
        desc: "Kontrol akses per role (admin/kasir), persetujuan diskon, dan jejak audit before/after setiap perubahan.",
    },
    {
        icon: IconCloudOff,
        title: "Offline Mode",
        desc: "Tetap bisa jualan saat internet mati — transaksi masuk antrean dan tersinkron otomatis saat online.",
    },
];

const techStack = [
    { name: "Laravel 13", color: "bg-red-500" },
    { name: "Inertia.js 3", color: "bg-purple-500" },
    { name: "React 19", color: "bg-cyan-500" },
    { name: "Tailwind CSS", color: "bg-sky-500" },
    { name: "MySQL", color: "bg-orange-500" },
    { name: "PWA", color: "bg-emerald-500" },
];

const screenshots = [
    { src: "/screenshots/01-dashboard.png", title: "Dashboard", span: "col-span-2 row-span-2" },
    { src: "/screenshots/02-pos-checkout.png", title: "POS Checkout" },
    { src: "/screenshots/06-stock-opnames.png", title: "Stock Opname" },
    { src: "/screenshots/12-receivables.png", title: "Receivables" },
    { src: "/screenshots/15-sales-report.png", title: "Sales Report" },
];

const getFaqs = (appName) => [
    {
        q: `Apakah ${appName} mudah digunakan?`,
        a: `Ya. ${appName} dirancang dengan antarmuka yang modern, responsif, dan intuitif sehingga staf kasir dapat langsung menggunakannya tanpa kendala.`,
    },
    {
        q: "Bisakah dipakai untuk bisnis multi-cabang?",
        a: `Bisa. ${appName} mendukung multi-warehouse dengan stok terpisah per gudang/cabang, transfer stok antar gudang, dan laporan per gudang.`,
    },
    {
        q: "Bagaimana kalau internet di toko mati?",
        a: `${appName} punya offline mode: transaksi tetap bisa diproses dan masuk antrean lokal, lalu tersinkron otomatis saat koneksi kembali.`,
    },
    {
        q: "Apa saja perangkat yang didukung?",
        a: `${appName} dapat diakses melalui browser komputer/laptop, tablet, hingga smartphone (PWA), serta mendukung printer thermal via WebUSB & Bluetooth.`,
    },
    {
        q: "Bagaimana cara memulai?",
        a: `Anda dapat langsung mencoba demo aplikasi untuk melihat fitur-fitur yang tersedia atau masuk menggunakan akun kasir dan admin.`,
    },
];

const onboardingSteps = [
    {
        step: "01",
        title: "Atur Master Produk & Stok",
        desc: "Tambahkan produk beserta harga bertingkat, varian satuan (UOM), kategori, dan stok minimum dengan mudah lewat import Excel atau barcode scanner.",
        icon: IconPackage,
        tags: ["Import Excel", "Multi Satuan", "Barcode Scanner"],
    },
    {
        step: "02",
        title: "Hubungkan Hardware & Pembayaran",
        desc: "Koneksikan printer thermal struk (WebUSB / Bluetooth) dan aktifkan ragam metode pembayaran: QRIS Dinamis, Transfer Bank, hingga E-Wallet.",
        icon: IconCreditCard,
        tags: ["Thermal WebUSB", "QRIS Dinamis", "Multi-Payment"],
    },
    {
        step: "03",
        title: "Mulai Transaksi & Pantau Real-Time",
        desc: "Kasir siap melayani pelanggan dengan cepat secara online/offline, kirim struk WhatsApp otomatis, dan pantau laba bersih secara real-time.",
        icon: IconRocket,
        tags: ["Offline Mode", "Struk WhatsApp", "Analisis Laba Rugi"],
    },
];

export default function Welcome() {
    const { branding } = usePage().props;
    const appName = branding?.appName || "Rekasir";
    const faqs = getFaqs(appName);

    return (
        <PublicLayout>
            <Head title={`${appName} — Sistem Kasir & Manajemen Bisnis Modern`} />

            {/* ============ HERO ============ */}
            <section className="pt-28 pb-16 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 text-sm font-medium mb-6 border border-primary-100 dark:border-primary-900">
                            <IconShoppingCart size={16} />
                            Point of Sale · Multi-Warehouse · CRM &amp; Loyalty
                        </div>

                        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white leading-tight">
                            Sistem Kasir Modern
                            <span className="block mt-2 bg-gradient-to-r from-primary-500 to-primary-600 bg-clip-text text-transparent">
                                Cepat, Lengkap &amp; Handal
                            </span>
                        </h1>

                        <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                            {appName} adalah aplikasi point of sale lengkap untuk warung, toko, dan
                            bisnis retail — multi-warehouse, PPN, loyalty &amp; CRM, WhatsApp
                            gateway, hingga offline mode. Kelola bisnis Anda dengan mudah dan efisien.
                        </p>

                        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/login"
                                className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl hover:from-primary-600 hover:to-primary-700 shadow-xl shadow-primary-500/30 transition-all flex items-center justify-center gap-2"
                            >
                                <IconRocket size={20} />
                                Coba Demo Sekarang
                                <IconArrowRight size={18} />
                            </Link>
                            <Link
                                href="/fitur"
                                className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary-300 dark:hover:border-primary-700 transition-all flex items-center justify-center gap-2"
                            >
                                <IconShoppingCart size={20} />
                                Jelajahi Fitur
                            </Link>
                        </div>
                    </div>

                    {/* App preview */}
                    <div className="mt-16 relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none h-32 bottom-0 top-auto" />
                        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 flex items-center gap-2">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-400" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                    <div className="w-3 h-3 rounded-full bg-green-400" />
                                </div>
                                <div className="flex-1 text-center text-xs text-slate-500">
                                    rekasir.com
                                </div>
                            </div>
                            <img
                                src="/media/revamp-pos.png"
                                alt={`Preview POS ${appName}`}
                                className="w-full"
                                loading="lazy"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ============ STATS ============ */}
            <section className="py-12 px-6 border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((stat) => (
                        <div key={stat.label} className="text-center">
                            <div className="text-3xl md:text-4xl font-extrabold text-primary-600 dark:text-primary-400">
                                {stat.value}
                            </div>
                            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ============ SCREENSHOTS ============ */}
            <section id="screenshot" className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Tampilan Aplikasi
                        </h2>
                        <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                            Dari kasir harian hingga laporan manajemen — semua dalam satu aplikasi
                            yang rapi dan cepat.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[140px] md:auto-rows-[180px]">
                        {screenshots.map((shot) => (
                            <div
                                key={shot.title}
                                className={`${shot.span || ""} relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 group`}
                            >
                                <img
                                    src={shot.src}
                                    alt={shot.title}
                                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                                    <span className="text-xs font-medium text-white">
                                        {shot.title}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-8">
                        <Link
                            href="/fitur"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                        >
                            Jelajahi semua modul &amp; fitur
                            <IconArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ============ FEATURES ============ */}
            <section id="fitur" className="py-20 px-6 bg-white dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Fitur Lengkap untuk Bisnis Nyata
                        </h2>
                        <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                            44+ modul terintegrasi — dari transaksi harian sampai analitik
                            lanjutan, dirancang untuk kebutuhan UMKM Indonesia.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature) => (
                            <div
                                key={feature.title}
                                className="group p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-lg hover:shadow-primary-500/5 transition-all"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <feature.icon size={24} className="text-white" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-10">
                        <Link
                            href="/fitur"
                            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                        >
                            Jelajahi semua fitur
                            <IconArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ============ TECH STACK ============ */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                        Tech Stack Modern
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-10">
                        Dibangun dengan teknologi yang teruji, cepat, dan mudah dikembangkan
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        {techStack.map((tech) => (
                            <div
                                key={tech.name}
                                className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                            >
                                <div className={`w-3 h-3 rounded-full ${tech.color}`} />
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {tech.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ============ HOW IT WORKS / ONBOARDING ============ */}
            <section id="cara-kerja" className="py-20 px-6 bg-white dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 dark:bg-primary-950/60 border border-primary-200 dark:border-primary-800 text-xs font-semibold text-primary-700 dark:text-primary-300 mb-4">
                            <IconSparkles size={14} />
                            Implementasi Cepat &amp; Praktis
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Siap Digunakan dalam 3 Langkah Mudah
                        </h2>
                        <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                            Mulai dari input produk hingga cetak struk pertama tanpa setup yang membingungkan. Bisnis Anda siap bertumbuh hari ini.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 relative">
                        {onboardingSteps.map((item) => (
                            <div
                                key={item.step}
                                className="relative flex flex-col p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-xl hover:shadow-primary-500/5 transition-all group"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform">
                                        <item.icon size={28} />
                                    </div>
                                    <span className="text-3xl font-black text-slate-300 dark:text-slate-700 font-mono group-hover:text-primary-500/40 transition-colors">
                                        {item.step}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                                    {item.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6 flex-1">
                                    {item.desc}
                                </p>

                                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                                    {item.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700/50 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-600/60"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Value Proposition Callout */}
                    <div className="mt-12 rounded-3xl bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-primary-500/15">
                        <div className="space-y-1 text-center md:text-left">
                            <h4 className="text-lg sm:text-xl font-bold">
                                Butuh panduan integrasi atau konsultasi fitur?
                            </h4>
                            <p className="text-xs sm:text-sm text-primary-100 max-w-xl">
                                Kami siap membantu proses migrasi data produk dan penyesuaian sistem kasir untuk kelancaran bisnis Anda.
                            </p>
                        </div>
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-primary-700 font-bold text-sm hover:bg-primary-50 shadow-md transition-all whitespace-nowrap flex-shrink-0"
                        >
                            Coba Demo Sekarang
                            <IconArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ============ DEMO ============ */}
            <section className="py-16 px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="rounded-2xl border border-primary-200 dark:border-primary-900 bg-primary-50/50 dark:bg-primary-950/30 p-8 text-center">
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                            Ingin Coba Langsung?
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            Demo berisi data contoh lengkap — produk, transaksi, dan laporan.
                            Gunakan akun demo berikut:
                        </p>
                        <div className="grid sm:grid-cols-2 gap-4 mb-8 text-left">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-2 uppercase tracking-wide">
                                    Admin
                                </div>
                                <div className="font-mono text-sm text-slate-700 dark:text-slate-300">
                                    admin@mail.com
                                </div>
                                <div className="font-mono text-sm text-slate-500 dark:text-slate-400">
                                    password
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-2 uppercase tracking-wide">
                                    Kasir
                                </div>
                                <div className="font-mono text-sm text-slate-700 dark:text-slate-300">
                                    cashier@gmail.com
                                </div>
                                <div className="font-mono text-sm text-slate-500 dark:text-slate-400">
                                    password
                                </div>
                            </div>
                        </div>
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-2xl hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/25 transition-all"
                        >
                            Buka Demo
                            <IconArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ============ FAQ ============ */}
            <section id="faq" className="py-20 px-6 bg-white dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                            Pertanyaan Umum
                        </h2>
                    </div>
                    <div className="space-y-4">
                        {faqs.map((faq) => (
                            <details
                                key={faq.q}
                                className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 open:shadow-md transition-all"
                            >
                                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none">
                                    <span className="font-medium text-slate-900 dark:text-white">
                                        {faq.q}
                                    </span>
                                    <span className="text-primary-500 group-open:rotate-45 transition-transform text-lg">
                                        +
                                    </span>
                                </summary>
                                <p className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {faq.a}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* ============ CTA ============ */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-3xl p-12 text-center text-white">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Siap Kelola Bisnis dengan {appName}?
                        </h2>
                        <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
                            Solusi kasir modern, cepat, dan handal untuk mengembangkan bisnis Anda ke level berikutnya.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 font-semibold rounded-2xl hover:bg-slate-50 transition-colors shadow-lg"
                            >
                                <IconDeviceMobile size={20} />
                                Coba Demo Sekarang
                                <IconArrowRight size={18} />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
