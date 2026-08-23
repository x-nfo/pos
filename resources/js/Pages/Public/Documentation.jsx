import { Head, Link, usePage } from "@inertiajs/react";
import PublicLayout from "@/Layouts/PublicLayout";
import { IconBook2, IconArrowRight, IconSparkles, IconDeviceMobile } from "@tabler/icons-react";

const categories = [
    {
        title: "Panduan Memulai",
        docs: [
            { title: "Pengaturan Awal & Profil Toko", desc: "Panduan setup identitas bisnis, logo struk, alamat, dan nomor kontak toko." },
            { title: "Konfigurasi Sistem & Gateway", desc: "Pengaturan metode pembayaran, printer thermal, PPN, dan integrasi WhatsApp." },
            { title: "Arsitektur & Keamanan", desc: "Struktur data aman, otorisasi RBAC berjenjang, dan perlindungan audit log." },
            { title: "Daftar Modul & Fitur", desc: "Daftar lengkap 44+ fitur terintegrasi yang siap digunakan." },
        ],
    },
    {
        title: "POS & Transaksi",
        docs: [
            { title: "Operasional Kasir (POS)", desc: "Alur keranjang belanja, checkout cepat, hold & resume bill, dan multi-payment." },
            { title: "Manajemen Shift Kasir", desc: "Buka/tutup shift kasir, input kas awal, dan rekonsiliasi kas harian." },
            { title: "Retur Penjualan", desc: "Proses retur barang dari transaksi pelanggan secara akurat." },
            { title: "Mobile POS (PWA)", desc: "Akses kasir langsung dari smartphone atau tablet dengan dukungan offline mode." },
            { title: "Printer Thermal Struk", desc: "Cetak struk ukuran 58mm/80mm via WebUSB dan Bluetooth printer." },
        ],
    },
    {
        title: "Inventory & Gudang",
        docs: [
            { title: "Katalog Produk & Stok", desc: "Kelola master produk, kategori, stok minimum, dan mutasi stok barang." },
            { title: "Multi-Warehouse / Cabang", desc: "Manajemen stok terpisah per gudang dan transfer stok antar cabang." },
            { title: "Multi-Satuan (UOM)", desc: "Konversi satuan bertingkat (pcs, box, renteng, karton) secara otomatis." },
        ],
    },
    {
        title: "Pembelian & Keuangan",
        docs: [
            { title: "Rantai Pengadaan (Purchasing)", desc: "Purchase order (PO), penerimaan barang (GR), dan retur ke supplier." },
            { title: "Hutang Supplier (Payables)", desc: "Monitoring tagihan hutang supplier beserta jadwal jatuh tempo." },
            { title: "Piutang Pelanggan (Receivables)", desc: "Pengelolaan piutang, pelunasan parsial, dan analisis penuaan piutang (aging)." },
            { title: "Manajemen Pajak (PPN)", desc: "Perhitungan PPN otomatis, invoice pajak, dan pencatatan NPWP pelanggan." },
            { title: "Customer Portal & Self Payment", desc: "Halaman struk/invoice digital mandiri untuk pelanggan menyelesaikan tagihan." },
        ],
    },
    {
        title: "CRM, Promosi & Loyalty",
        docs: [
            { title: "Segmentasi & Campaign Pelanggan", desc: "Pengelompokan pelanggan otomatis dan pengiriman promo WhatsApp tertarget." },
            { title: "Keanggotaan Member & Poin", desc: "Sistem tiering member, reward poin belanja, dan benefit pelanggan setia." },
            { title: "Aturan Harga & Voucher", desc: "Diskon bertingkat, harga grosir, bundle promo, dan voucher diskon." },
        ],
    },
    {
        title: "Administrasi & Pengaturan",
        docs: [
            { title: "Hak Akses & Role (RBAC)", desc: "Pembatasan hak akses kasir, supervisor, dan administrator secara presisi." },
            { title: "Audit Log & Jejak Aktivitas", desc: "Pencatatan riwayat setiap perubahan data penting dalam sistem." },
            { title: "Pengaturan Pembayaran & Bank", desc: "Aktivasi QRIS Dinamis, akun rekening transfer bank, dan payment gateway." },
            { title: "Import & Export Data Excel", desc: "Migrasi cepat produk dan data pelanggan massal via format spreadsheet." },
            { title: "Laporan & Dokumen PDF", desc: "Unduh laporan penjualan, laba rugi, dan analitik performa dalam format PDF." },
            { title: "WhatsApp Gateway", desc: "Otomatisasi pengiriman struk belanja, reminder piutang, dan pesan notifikasi." },
        ],
    },
];

export default function Documentation() {
    const { branding } = usePage().props;
    const appName = branding?.appName || "Rekasir";

    return (
        <PublicLayout active="/dokumentasi">
            <Head title={`Dokumentasi — ${appName}`} />

            {/* Header */}
            <section className="pt-20 pb-14 px-6 bg-gradient-to-b from-primary-50 dark:from-primary-950/40 to-transparent">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 text-sm font-medium mb-5 border border-primary-100 dark:border-primary-900">
                        <IconBook2 size={16} />
                        Pusat Panduan
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white">
                        Panduan &amp; Dokumentasi Fitur
                    </h1>
                    <p className="mt-5 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        Pelajari cara kerja setiap modul untuk memaksimalkan potensi bisnis dan efisiensi operasional toko Anda.
                    </p>
                </div>
            </section>

            {/* Categories */}
            <section className="pb-20 px-6">
                <div className="max-w-5xl mx-auto space-y-14">
                    {categories.map((cat) => (
                        <div key={cat.title}>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                                <span className="w-8 h-1 rounded-full bg-gradient-to-r from-primary-500 to-primary-600" />
                                {cat.title}
                            </h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {cat.docs.map((doc, idx) => (
                                    <div
                                        key={idx}
                                        className="group p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                                {doc.title}
                                            </h3>
                                            <IconSparkles size={16} className="text-primary-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {doc.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="pb-20 px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="rounded-3xl bg-slate-900 dark:bg-slate-800 p-8 sm:p-10 text-center text-white">
                        <h2 className="text-2xl md:text-3xl font-bold mb-3">
                            Siap Mengoptimalkan Toko Anda?
                        </h2>
                        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                            Eksplorasi langsung antarmuka kasir dan fitur lengkap {appName} dengan akun demo siap pakai.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-2xl hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/25 transition-all"
                            >
                                <IconDeviceMobile size={18} />
                                Coba Demo Sekarang
                                <IconArrowRight size={16} />
                            </Link>
                            <Link
                                href="/fitur"
                                className="inline-flex items-center gap-2 px-6 py-4 text-sm font-semibold text-slate-300 border border-slate-700 rounded-2xl hover:border-primary-400 hover:text-primary-400 transition-colors"
                            >
                                Jelajahi Daftar Fitur
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
