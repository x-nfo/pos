import React from "react";
import { Head, Link, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconShoppingCart,
    IconUsers,
    IconFileInvoice,
    IconCurrencyDollar,
    IconBuildingWarehouse,
    IconChartArrowsVertical,
    IconToolsKitchen2,
    IconTruckDelivery,
    IconArrowsLeftRight,
    IconClipboardCheck,
    IconClockHour6,
    IconFileDescription,
    IconReceiptRefund,
    IconChartInfographic,
    IconTruckReturn,
} from "@tabler/icons-react";
import hasAnyPermission from "@/Utils/Permission";

const cards = [
    {
        title: "Kasir POS",
        desc: "Mulai transaksi kasir kilat",
        icon: <IconShoppingCart size={22} />,
        route: "transactions.index",
        perms: ["transactions-access"],
    },
    {
        title: "Shift Kasir",
        desc: "Buka, pantau, dan tutup shift kasir",
        icon: <IconClockHour6 size={22} />,
        route: "cashier-shifts.index",
        perms: ["cashier-shifts-access"],
    },
    {
        title: "Pesanan Dapur / Resto",
        desc: "Pesanan dine-in & antrean meja",
        icon: <IconToolsKitchen2 size={22} />,
        route: "dine-orders.index",
        perms: ["dine-orders-access"],
    },
    {
        title: "Penerimaan Barang",
        desc: "Catat penerimaan barang masuk",
        icon: <IconTruckDelivery size={22} />,
        route: "goods-receivings.index",
        perms: ["goods-receivings-access"],
    },
    {
        title: "Purchase Order",
        desc: "Pesanan pembelian ke supplier",
        icon: <IconClipboardCheck size={22} />,
        route: "purchase-orders.index",
        perms: ["purchase-orders-access"],
    },
    {
        title: "Transfer Stok",
        desc: "Kirim & terima stok antar gudang",
        icon: <IconArrowsLeftRight size={22} />,
        route: "stock-transfers.index",
        perms: ["stock-transfers-access"],
    },
    {
        title: "Stock Opname",
        desc: "Pemeriksaan & rekonsiliasi fisik stok",
        icon: <IconFileDescription size={22} />,
        route: "stock-opnames.index",
        perms: ["stock-opnames-access"],
    },
    {
        title: "Retur Penjualan",
        desc: "Kelola retur barang dari pelanggan",
        icon: <IconReceiptRefund size={22} />,
        route: "sales-returns.index",
        perms: ["sales-returns-access"],
    },
    {
        title: "Retur Supplier",
        desc: "Pengembalian barang rusak ke supplier",
        icon: <IconTruckReturn size={22} />,
        route: "supplier-returns.index",
        perms: ["supplier-returns-access"],
    },
    {
        title: "Pelanggan",
        desc: "Kelola data & kontak pelanggan",
        icon: <IconUsers size={22} />,
        route: "customers.index",
        perms: ["customers-access"],
    },
    {
        title: "Piutang Pelanggan",
        desc: "Nota barang tempo pelanggan",
        icon: <IconFileInvoice size={22} />,
        route: "receivables.index",
        perms: ["receivables-access"],
    },
    {
        title: "Hutang Supplier",
        desc: "Kewajiban bayar tempo ke supplier",
        icon: <IconCurrencyDollar size={22} />,
        route: "payables.index",
        perms: ["payables-access"],
    },
    {
        title: "Supplier",
        desc: "Kelola data vendor & pemasok",
        icon: <IconBuildingWarehouse size={22} />,
        route: "suppliers.index",
        perms: ["suppliers-access"],
    },
    {
        title: "Laporan Penjualan",
        desc: "Lihat ringkasan transaksi & omzet",
        icon: <IconChartArrowsVertical size={22} />,
        route: "reports.sales.index",
        perms: ["reports-access"],
    },
    {
        title: "Laporan Laba Rugi",
        desc: "Margin kotor, HPP & laba bersih",
        icon: <IconChartInfographic size={22} />,
        route: "reports.profits.index",
        perms: ["profits-access"],
    },
];

function AccessPage() {
    const { auth } = usePage().props;

    const visibleCards = cards.filter((card) =>
        hasAnyPermission(card.perms, auth?.permissions)
    );

    return (
        <>
            <Head title="Akses" />
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Pilih Akses
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Halaman ini muncul ketika Anda tidak memiliki akses
                        dashboard.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleCards.length ? (
                        visibleCards.map((card) => (
                            <Link
                                key={card.title}
                                href={route(card.route)}
                                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start gap-3 hover:border-primary-300 dark:hover:border-primary-700 transition-colors shadow-sm"
                            >
                                <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center">
                                    {card.icon}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-slate-900 dark:text-white">
                                        {card.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {card.desc}
                                    </p>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="col-span-full text-slate-500 dark:text-slate-400">
                            Tidak ada akses tersedia. Hubungi admin.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

AccessPage.layout = (page) => <DashboardLayout children={page} />;

export default AccessPage;
