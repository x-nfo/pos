import React, { useState, useMemo } from "react";
import { Head, Link, usePage, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconSearch,
    IconShoppingCart,
    IconBox,
    IconFolder,
    IconUsersPlus,
    IconBuildingWarehouse,
    IconBarcode,
    IconToolsKitchen2,
    IconHistory,
    IconClockHour6,
    IconPercentage,
    IconFileDescription,
    IconTruckDelivery,
    IconClipboardCheck,
    IconArrowsLeftRight,
    IconTruckReturn,
    IconChartBar,
    IconChartInfographic,
    IconWallet,
    IconBuildingStore,
    IconCreditCard,
    IconCrown,
    IconGift,
    IconBrandWhatsapp,
    IconUserShield,
    IconShieldLock,
    IconSettings,
    IconListDetails,
    IconUserCog,
    IconLogout,
    IconChevronRight,
    IconBuildingBank,
    IconPalette,
} from "@tabler/icons-react";
import { useAuthorization } from "@/Utils/authorization";
import { useHaptic } from "@/Hooks/useHaptic";
import Swal from "sweetalert2";

// Static Menu Definition with Verified Route Names
const MENU_SECTIONS = [
    {
        category: "Master Data",
        badgeBg: "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400",
        items: [
            {
                title: "Produk",
                desc: "Kelola katalog produk & harga",
                routeName: "products.index",
                icon: IconBox,
                color: "text-blue-500 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400",
                permissions: ["products-access"],
            },
            {
                title: "Kategori",
                desc: "Kelompok & klasifikasi barang",
                routeName: "categories.index",
                icon: IconFolder,
                color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400",
                permissions: ["categories-access"],
            },
            {
                title: "Pelanggan",
                desc: "Data member & riwayat belanja",
                routeName: "customers.index",
                icon: IconUsersPlus,
                color: "text-sky-500 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-400",
                permissions: ["customers-access"],
            },
            {
                title: "Supplier",
                desc: "Pemasok & kontak vendor",
                routeName: "suppliers.index",
                icon: IconBuildingWarehouse,
                color: "text-amber-500 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400",
                permissions: ["suppliers-access"],
            },
            {
                title: "Cetak Barcode",
                desc: "Generate & print label barcode",
                routeName: "products.index",
                routeParams: { view: "barcode" },
                icon: IconBarcode,
                color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-400",
                permissions: ["products-access"],
            },
        ],
    },
    {
        category: "Transaksi & Kasir",
        badgeBg: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",
        items: [
            {
                title: "Kasir POS",
                desc: "Point of Sale transaksi kilat",
                routeName: "transactions.mobile",
                icon: IconShoppingCart,
                color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400",
                permissions: ["transactions-access"],
                highlight: true,
            },
            {
                title: "Meja & Dine-In",
                desc: "Pengaturan meja & area resto",
                routeName: "dine-areas.index",
                icon: IconToolsKitchen2,
                color: "text-orange-500 bg-orange-50 dark:bg-orange-950/60 dark:text-orange-400",
                permissions: ["dine-orders-access"],
            },
            {
                title: "Riwayat Transaksi",
                desc: "Daftar invoice & pembayaran",
                routeName: "transactions.history",
                icon: IconHistory,
                color: "text-teal-500 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-400",
                permissions: ["transactions-access"],
            },
            {
                title: "Shift Kasir",
                desc: "Rekap kas masuk & saldo shift",
                routeName: "cashier-shifts.index",
                icon: IconClockHour6,
                color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-400",
                permissions: ["cashier-shifts-access"],
            },
            {
                title: "Approval Diskon",
                desc: "Persetujuan diskon kasir",
                routeName: "discount-approvals.pending",
                icon: IconPercentage,
                color: "text-rose-500 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400",
                permissions: ["discounts-approve"],
            },
        ],
    },
    {
        category: "Stok & Inventori",
        badgeBg: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400",
        items: [
            {
                title: "Purchase Order",
                desc: "Pesanan pembelian barang",
                routeName: "purchase-orders.index",
                icon: IconFileDescription,
                color: "text-amber-500 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400",
                permissions: ["purchase-orders-access"],
            },
            {
                title: "Penerimaan Barang",
                desc: "Goods receiving & verifikasi PO",
                routeName: "goods-receivings.index",
                icon: IconTruckDelivery,
                color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400",
                permissions: ["goods-receivings-access"],
            },
            {
                title: "Stok Opname",
                desc: "Penyesuaian fisik & sistem",
                routeName: "stock-opnames.index",
                icon: IconClipboardCheck,
                color: "text-purple-500 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400",
                permissions: ["stock-opnames-access"],
            },
            {
                title: "Mutasi Stok",
                desc: "Perpindahan stok gudang",
                routeName: "stock-mutations.index",
                icon: IconArrowsLeftRight,
                color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400",
                permissions: ["stock-mutations-access"],
            },
            {
                title: "Retur Supplier",
                desc: "Pengembalian barang cacat/rusak",
                routeName: "supplier-returns.index",
                icon: IconTruckReturn,
                color: "text-rose-500 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400",
                permissions: ["supplier-returns-access"],
            },
        ],
    },
    {
        category: "Laporan & Keuangan",
        badgeBg: "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400",
        items: [
            {
                title: "Laporan Penjualan",
                desc: "Grafik omzet & ringkasan kasir",
                routeName: "reports.sales.index",
                icon: IconChartBar,
                color: "text-purple-500 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400",
                permissions: ["sales-reports-access"],
            },
            {
                title: "Laporan Laba Rugi",
                desc: "Margin kotor & laba bersih",
                routeName: "reports.profits.index",
                icon: IconChartInfographic,
                color: "text-pink-500 bg-pink-50 dark:bg-pink-950/60 dark:text-pink-400",
                permissions: ["profit-reports-access"],
            },
            {
                title: "Piutang Pelanggan",
                desc: "Tagihan kredit & jatuh tempo",
                routeName: "receivables.index",
                icon: IconWallet,
                color: "text-amber-500 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400",
                permissions: ["receivables-access"],
            },
            {
                title: "Hutang Supplier",
                desc: "Kewajiban bayar tempo supplier",
                routeName: "payables.index",
                icon: IconBuildingStore,
                color: "text-rose-500 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400",
                permissions: ["payables-access"],
            },
            {
                title: "Rekening Bank",
                desc: "Akun bank & transfer qris",
                routeName: "settings.bank-accounts.index",
                icon: IconBuildingBank,
                color: "text-blue-500 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400",
                permissions: ["payment-settings-access"],
            },
        ],
    },
    {
        category: "Marketing & Loyalitas",
        badgeBg: "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400",
        items: [
            {
                title: "Program Loyalitas",
                desc: "Tier member & poin belanja",
                routeName: "settings.loyalty",
                icon: IconCrown,
                color: "text-amber-500 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400",
                permissions: ["dashboard-access"],
            },
            {
                title: "Voucher Diskon",
                desc: "Kupon promo & potongan harga",
                routeName: "customer-vouchers.index",
                icon: IconGift,
                color: "text-rose-500 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400",
                permissions: ["customer-vouchers-access"],
            },
            {
                title: "WhatsApp CRM",
                desc: "Broadcast promo & blast otomatis",
                routeName: "crm-campaigns.index",
                icon: IconBrandWhatsapp,
                color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400",
                permissions: ["crm-campaigns-access"],
            },
        ],
    },
    {
        category: "Pengaturan & Sistem",
        badgeBg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
        items: [
            {
                title: "Pengguna (Users)",
                desc: "Akun kasir & hak akses staff",
                routeName: "users.index",
                icon: IconUserShield,
                color: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300",
                permissions: ["users-access"],
            },
            {
                title: "Peran & Izin (Roles)",
                desc: "Matrix wewenang Spatie RBAC",
                routeName: "roles.index",
                icon: IconShieldLock,
                color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400",
                permissions: ["roles-access"],
            },
            {
                title: "Payment Gateway",
                desc: "Midtrans & Xendit QRIS otomatis",
                routeName: "settings.payments.edit",
                icon: IconCreditCard,
                color: "text-teal-500 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-400",
                permissions: ["payment-settings-access"],
            },
            {
                title: "Pengaturan Toko",
                desc: "Profil usaha, alamat & logo",
                routeName: "settings.store",
                icon: IconSettings,
                color: "text-blue-500 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400",
                permissions: ["dashboard-access"],
            },
            {
                title: "Branding & Tampilan",
                desc: "Tema warna & kustomisasi UI",
                routeName: "settings.branding",
                icon: IconPalette,
                color: "text-purple-500 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400",
                permissions: ["dashboard-access"],
            },
            {
                title: "Pengaturan WhatsApp",
                desc: "Koneksi WhatsApp gateway",
                routeName: "settings.whatsapp",
                icon: IconBrandWhatsapp,
                color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400",
                permissions: ["whatsapp-settings-access"],
            },
            {
                title: "Audit Log",
                desc: "Rekam jejak aktivitas user",
                routeName: "audit-logs.index",
                icon: IconListDetails,
                color: "text-amber-500 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400",
                permissions: ["audit-logs-access"],
            },
        ],
    },
];

export default function MenuIndex() {
    const { auth, storeProfile } = usePage().props;
    const { canAny } = useAuthorization();
    const { triggerHaptic } = useHaptic();
    const [search, setSearch] = useState("");

    const user = auth?.user || {};
    const roleName = user?.roles?.[0]?.name || "Staff";
    const userInitial = user?.name?.charAt(0)?.toUpperCase() || "U";

    // Safe route resolver to avoid any Ziggy unhandled error
    const resolveRoute = (routeName, params) => {
        try {
            return params ? route(routeName, params) : route(routeName);
        } catch {
            return "#";
        }
    };

    // Filter sections and items based on search query and user permissions
    const filteredSections = useMemo(() => {
        const query = search.trim().toLowerCase();
        return MENU_SECTIONS.map((sec) => ({
            ...sec,
            items: sec.items.filter((item) => {
                if (item.permissions && !canAny(item.permissions)) {
                    return false;
                }
                if (!query) return true;
                return (
                    item.title.toLowerCase().includes(query) ||
                    item.desc.toLowerCase().includes(query) ||
                    sec.category.toLowerCase().includes(query)
                );
            }),
        })).filter((sec) => sec.items.length > 0);
    }, [search, canAny]);

    const handleLogout = () => {
        triggerHaptic("warning");
        Swal.fire({
            title: "Konfirmasi Keluar",
            text: "Apakah Anda yakin ingin keluar dari akun ini?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Keluar",
            cancelButtonText: "Batal",
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route("logout"));
            }
        });
    };

    return (
        <DashboardLayout>
            <Head title="Menu Aplikasi" />

            <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
                {/* 1. Header Profile Card (App Style) */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 text-white p-5 sm:p-6 shadow-xl shadow-primary-950/20">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                    <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

                    <div className="relative flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                            {/* Avatar */}
                            <div className="relative w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-xl shadow-md flex-shrink-0">
                                {user?.avatar ? (
                                    <img
                                        src={user.avatar}
                                        alt={user.name}
                                        className="w-full h-full object-cover rounded-2xl"
                                    />
                                ) : (
                                    userInitial
                                )}
                                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white dark:border-slate-900 rounded-full" />
                            </div>

                            {/* User details */}
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-base sm:text-lg font-black truncate">
                                        {user?.name || "Pengguna"}
                                    </h1>
                                    <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white">
                                        {roleName}
                                    </span>
                                </div>
                                <p className="text-xs text-white/80 truncate mt-0.5">
                                    {storeProfile?.name || "Point of Sales"} • {user?.email}
                                </p>
                            </div>
                        </div>

                        {/* Quick Profile Link */}
                        <Link
                            href={resolveRoute("profile.edit")}
                            onClick={() => triggerHaptic("tap")}
                            className="p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition-all flex-shrink-0"
                            title="Edit Profil"
                        >
                            <IconUserCog size={22} strokeWidth={2} />
                        </Link>
                    </div>

                    {/* Quick Navigation Pills */}
                    <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-4 gap-2 text-center">
                        <Link
                            href={resolveRoute("transactions.mobile")}
                            onClick={() => triggerHaptic("tap")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                        >
                            <div className="w-9 h-9 rounded-xl bg-white text-primary-700 flex items-center justify-center shadow-sm">
                                <IconShoppingCart size={20} strokeWidth={2.2} />
                            </div>
                            <span className="text-[10px] font-bold tracking-tight">Kasir</span>
                        </Link>

                        <Link
                            href={resolveRoute("products.create")}
                            onClick={() => triggerHaptic("tap")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                        >
                            <div className="w-9 h-9 rounded-xl bg-white text-blue-700 flex items-center justify-center shadow-sm">
                                <IconBox size={20} strokeWidth={2.2} />
                            </div>
                            <span className="text-[10px] font-bold tracking-tight">+ Produk</span>
                        </Link>

                        <Link
                            href={resolveRoute("reports.sales.index")}
                            onClick={() => triggerHaptic("tap")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                        >
                            <div className="w-9 h-9 rounded-xl bg-white text-purple-700 flex items-center justify-center shadow-sm">
                                <IconChartBar size={20} strokeWidth={2.2} />
                            </div>
                            <span className="text-[10px] font-bold tracking-tight">Laporan</span>
                        </Link>

                        <Link
                            href={resolveRoute("settings.store")}
                            onClick={() => triggerHaptic("tap")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                        >
                            <div className="w-9 h-9 rounded-xl bg-white text-slate-700 flex items-center justify-center shadow-sm">
                                <IconSettings size={20} strokeWidth={2.2} />
                            </div>
                            <span className="text-[10px] font-bold tracking-tight">Seting</span>
                        </Link>
                    </div>
                </div>

                {/* 2. Instant Search Menu */}
                <div className="relative">
                    <IconSearch
                        size={18}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari menu, laporan, master data, fitur..."
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-primary-500 shadow-xs transition-all"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800"
                        >
                            Reset
                        </button>
                    )}
                </div>

                {/* 3. Categorized Menu Grid (Native App Tiles) */}
                <div className="space-y-6">
                    {filteredSections.map((section, sIdx) => (
                        <div key={sIdx} className="space-y-2.5">
                            {/* Section Title */}
                            <div className="flex items-center justify-between px-1">
                                <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${section.badgeBg}`}>
                                    {section.category}
                                </span>
                                <span className="text-[11px] font-medium text-slate-400">
                                    {section.items.length} Menu
                                </span>
                            </div>

                            {/* Section Items Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {section.items.map((item, iIdx) => {
                                    const IconComponent = item.icon;
                                    const targetHref = resolveRoute(item.routeName, item.routeParams);

                                    return (
                                        <Link
                                            key={iIdx}
                                            href={targetHref}
                                            onClick={() => triggerHaptic("tap")}
                                            className={`p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/90 shadow-xs flex items-center justify-between gap-3 transition-all hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md active:scale-[0.98] ${
                                                item.highlight
                                                    ? "ring-1 ring-primary-500/30 bg-primary-50/20 dark:bg-primary-950/20"
                                                    : ""
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                                                    <IconComponent size={22} strokeWidth={2} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                                        {item.title}
                                                    </h3>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                        {item.desc}
                                                    </p>
                                                </div>
                                            </div>

                                            <IconChevronRight
                                                size={18}
                                                className="text-slate-300 dark:text-slate-600 flex-shrink-0"
                                            />
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {filteredSections.length === 0 && (
                        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                            <IconBox size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                Tidak ada menu ditemukan
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Coba gunakan kata kunci lain untuk pencarian
                            </p>
                        </div>
                    )}
                </div>

                {/* 4. Bottom Logout & App Info */}
                <div className="pt-3 pb-6">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border border-rose-200/80 dark:border-rose-900/60 active:scale-98 transition-all"
                    >
                        <IconLogout size={18} strokeWidth={2.2} />
                        <span>Keluar dari Aplikasi</span>
                    </button>

                    <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-4">
                        Point of Sales System • Version 2.1.0
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
}
