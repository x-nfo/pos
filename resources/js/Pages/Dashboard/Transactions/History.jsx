import React, { useEffect, useState } from "react";
import { Head, router, Link, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Pagination from "@/Components/Dashboard/Pagination";
import MobileBottomSheet from "@/Components/Mobile/MobileBottomSheet";
import MobileDataCard from "@/Components/Mobile/MobileDataCard";
import { useHaptic } from "@/Hooks/useHaptic";
import { useWebShare } from "@/Hooks/useWebShare";
import { useAuthorization } from "@/Utils/authorization";
import { usePasswordConfirmation } from "@/Context/PasswordConfirmationContext";
import { shareWhatsappReceipt } from "@/Utils/whatsappReceipt";
import {
    IconDatabaseOff,
    IconSearch,
    IconHistory,
    IconReceipt,
    IconPrinter,
    IconFilter,
    IconX,
    IconCheck,
    IconBuildingBank,
    IconAlertCircle,
    IconBrandWhatsapp,
    IconShare,
    IconRotateClockwise,
    IconCreditCard,
    IconCash,
    IconCalendar,
} from "@tabler/icons-react";

const defaultFilters = {
    invoice: "",
    start_date: "",
    end_date: "",
    warehouse_id: "",
    payment_status: "",
    payment_method: "",
};

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const History = ({ transactions, filters, warehouses = [] }) => {
    const { storeProfile, branding } = usePage().props;
    const { can } = useAuthorization();
    const { triggerHaptic } = useHaptic();
    const { share: nativeShare, isSupported: isShareSupported } = useWebShare();

    const canCreateSalesReturn = can("sales-returns-create");
    const canConfirmPayment = can("transactions-confirm-payment");
    const canCreateCrmCampaign = can("crm-campaigns-create");
    const { requirePasswordConfirmation } = usePasswordConfirmation();

    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        ...filters,
    });
    const [showFilters, setShowFilters] = useState(false);
    const [confirmModal, setConfirmModal] = useState({
        open: false,
        transaction: null,
    });
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            ...filters,
        });
    }, [filters]);

    const handleChange = (field, value) => {
        setFilterData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const applyFilters = (event) => {
        if (event) event.preventDefault();
        triggerHaptic("tap");
        router.get(route("transactions.history"), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        triggerHaptic("light");
        setFilterData(defaultFilters);
        router.get(route("transactions.history"), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
        setShowFilters(false);
    };

    const handleShareTransaction = async (trx) => {
        triggerHaptic("tap");
        await shareWhatsappReceipt({
            transaction: trx,
            storeProfile,
            branding,
            isShareSupported,
            nativeShare,
        });
    };

    const rows = transactions?.data ?? [];
    const links = transactions?.links ?? [];
    const currentPage = transactions?.current_page ?? 1;
    const perPage = transactions?.per_page
        ? Number(transactions?.per_page)
        : rows.length || 1;

    const hasActiveFilters =
        Boolean(filterData.invoice || filterData.start_date || filterData.end_date || filterData.warehouse_id || filterData.payment_status || filterData.payment_method);

    return (
        <>
            <Head title="Riwayat Transaksi" />

            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <IconHistory
                                size={28}
                                className="text-primary-500"
                            />
                            Riwayat Transaksi
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {transactions?.total || 0} transaksi tercatat
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("tap");
                                setShowFilters(!showFilters);
                            }}
                            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
                                showFilters || hasActiveFilters
                                    ? "bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-950/60 dark:border-primary-700 dark:text-primary-300 shadow-sm"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
                            }`}
                        >
                            <IconFilter size={18} />
                            <span>Filter</span>
                            {hasActiveFilters && (
                                <span className="w-2 h-2 rounded-full bg-primary-600 dark:bg-primary-400"></span>
                            )}
                        </button>

                        <Link
                            href={route("transactions.mobile")}
                            onClick={() => triggerHaptic("tap")}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-primary-500/25 active:scale-95"
                        >
                            <IconReceipt size={18} />
                            <span>Kasir Baru</span>
                        </Link>
                    </div>
                </div>

                {/* Desktop Filters Panel (Hidden on Mobile) */}
                {showFilters && (
                    <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 animate-slide-up shadow-sm">
                        <form onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                        Nomor Invoice
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="TRX-..."
                                        value={filterData.invoice}
                                        onChange={(e) =>
                                            handleChange("invoice", e.target.value)
                                        }
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                        Tanggal Mulai
                                    </label>
                                    <input
                                        type="date"
                                        value={filterData.start_date}
                                        onChange={(e) =>
                                            handleChange("start_date", e.target.value)
                                        }
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                        Tanggal Akhir
                                    </label>
                                    <input
                                        type="date"
                                        value={filterData.end_date}
                                        onChange={(e) =>
                                            handleChange("end_date", e.target.value)
                                        }
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                        Gudang / Cabang
                                    </label>
                                    <select
                                        value={filterData.warehouse_id}
                                        onChange={(e) =>
                                            handleChange("warehouse_id", e.target.value)
                                        }
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    >
                                        <option value="">Semua Gudang</option>
                                        {warehouses.map((w) => (
                                            <option key={w.id} value={w.id}>
                                                {w.code} — {w.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                        Status Pembayaran
                                    </label>
                                    <select
                                        value={filterData.payment_status}
                                        onChange={(e) =>
                                            handleChange("payment_status", e.target.value)
                                        }
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    >
                                        <option value="">Semua Status</option>
                                        <option value="pending">Pending (Menunggu)</option>
                                        <option value="paid">Lunas</option>
                                        <option value="unpaid">Belum Lunas (Tempo)</option>
                                        <option value="failed">Gagal</option>
                                        <option value="expired">Kedaluwarsa</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                        Metode Pembayaran
                                    </label>
                                    <select
                                        value={filterData.payment_method}
                                        onChange={(e) =>
                                            handleChange("payment_method", e.target.value)
                                        }
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    >
                                        <option value="">Semua Metode</option>
                                        <option value="bank_transfer">Transfer Bank</option>
                                        <option value="cash">Tunai</option>
                                        <option value="pay_later">Bayar Nanti</option>
                                        <option value="midtrans">Midtrans</option>
                                        <option value="xendit">Xendit</option>
                                        <option value="qrisly">QRISLY</option>
                                    </select>
                                </div>
                                <div className="col-span-full flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="h-11 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
                                        >
                                            <IconX size={16} />
                                            <span>Reset</span>
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="h-11 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold transition-colors shadow-md shadow-primary-500/20"
                                    >
                                        <IconSearch size={18} />
                                        <span>Terapkan Filter</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Mobile Filter Bottom Sheet (< sm) */}
                <MobileBottomSheet
                    isOpen={showFilters}
                    onClose={() => setShowFilters(false)}
                    title="Filter Riwayat Transaksi"
                    subtitle="Saring berdasarkan nomor invoice, tanggal, gudang, atau status"
                    footer={
                        <div className="flex gap-2">
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="flex-1 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold active:scale-95 transition-transform"
                                >
                                    Reset
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={applyFilters}
                                className="flex-[2] h-12 rounded-2xl bg-primary-600 text-white text-xs font-bold shadow-lg shadow-primary-500/25 active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                            >
                                <IconSearch size={16} />
                                <span>Terapkan Filter</span>
                            </button>
                        </div>
                    }
                >
                    <div className="space-y-3.5 py-1">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Nomor Invoice
                            </label>
                            <input
                                type="text"
                                placeholder="TRX-..."
                                value={filterData.invoice}
                                onChange={(e) => handleChange("invoice", e.target.value)}
                                className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Mulai
                                </label>
                                <input
                                    type="date"
                                    value={filterData.start_date}
                                    onChange={(e) => handleChange("start_date", e.target.value)}
                                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Sampai
                                </label>
                                <input
                                    type="date"
                                    value={filterData.end_date}
                                    onChange={(e) => handleChange("end_date", e.target.value)}
                                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Status
                                </label>
                                <select
                                    value={filterData.payment_status}
                                    onChange={(e) => handleChange("payment_status", e.target.value)}
                                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                >
                                    <option value="">Semua Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Lunas</option>
                                    <option value="unpaid">Belum Lunas</option>
                                    <option value="failed">Gagal</option>
                                    <option value="expired">Expired</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Metode
                                </label>
                                <select
                                    value={filterData.payment_method}
                                    onChange={(e) => handleChange("payment_method", e.target.value)}
                                    className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                >
                                    <option value="">Semua Metode</option>
                                    <option value="bank_transfer">Transfer Bank</option>
                                    <option value="cash">Tunai</option>
                                    <option value="pay_later">Bayar Nanti</option>
                                    <option value="midtrans">Midtrans</option>
                                    <option value="xendit">Xendit</option>
                                    <option value="qrisly">QRISLY</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Gudang / Cabang
                            </label>
                            <select
                                value={filterData.warehouse_id}
                                onChange={(e) => handleChange("warehouse_id", e.target.value)}
                                className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                            >
                                <option value="">Semua Gudang</option>
                                {warehouses.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.code} — {w.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </MobileBottomSheet>

                {/* Transaction Content */}
                {rows.length > 0 ? (
                    <div>
                        {/* 1. Mobile Cards View (< 640px) */}
                        <div className="sm:hidden space-y-3">
                            {rows.map((transaction, index) => {
                                const isPayLater =
                                    transaction.payment_method === "pay_later" &&
                                    transaction.payment_status !== "paid";
                                const isPaid = transaction.payment_status === "paid";
                                const isPending =
                                    transaction.payment_status === "pending";

                                return (
                                    <MobileDataCard
                                        key={transaction.id}
                                        title={transaction.invoice}
                                        subtitle={`${transaction.created_at} • Kasir: ${
                                            transaction.cashier?.name ?? "-"
                                        }`}
                                        avatar={
                                            <div className="w-full h-full bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                                                <IconReceipt size={22} />
                                            </div>
                                        }
                                        badge={
                                            isPayLater ? (
                                                <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                                                    Piutang
                                                </span>
                                            ) : isPaid ? (
                                                <span
                                                    title={
                                                        transaction.payment_confirmer
                                                            ? `Dikonfirmasi oleh ${transaction.payment_confirmer.name}`
                                                            : undefined
                                                    }
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                                >
                                                    <IconCheck size={12} strokeWidth={3} />
                                                    Lunas
                                                </span>
                                            ) : isPending ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        triggerHaptic("tap");
                                                        setConfirmModal({
                                                            open: true,
                                                            transaction,
                                                        });
                                                    }}
                                                    className="px-2 py-0.5 text-xs font-bold rounded-lg bg-warning-100 text-warning-700 dark:bg-warning-950/60 dark:text-warning-400 border border-warning-300"
                                                >
                                                    Pending (Konfirmasi)
                                                </button>
                                            ) : (
                                                <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                                                    {transaction.payment_status ?? "-"}
                                                </span>
                                            )
                                        }
                                        meta={[
                                            {
                                                label: formatCurrency(
                                                    transaction.grand_total ?? 0
                                                ),
                                                variant: "primary",
                                            },
                                            {
                                                label: transaction.customer?.name
                                                    ? `Pelanggan: ${transaction.customer.name}`
                                                    : "Pelanggan Umum",
                                            },
                                            {
                                                label: `${transaction.total_items ?? 0} Item`,
                                            },
                                            {
                                                label:
                                                    transaction.payment_method?.replace(
                                                        "_",
                                                        " "
                                                    ) ?? "Tunai",
                                            },
                                        ]}
                                        expandable={true}
                                        expandedContent={
                                            <div className="space-y-2 py-1">
                                                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                                                    <div>
                                                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                                                            Gudang
                                                        </span>
                                                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                                            {transaction.warehouse?.name ??
                                                                "Gudang Utama"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                                                            Diskon / Pajak
                                                        </span>
                                                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                                            {formatCurrency(
                                                                transaction.discount ?? 0
                                                            )}{" "}
                                                            /{" "}
                                                            {formatCurrency(
                                                                transaction.tax ?? 0
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Action buttons inside expanded card */}
                                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                    <a
                                                        href={route(
                                                            "pdf.transactions.receipt",
                                                            transaction.invoice
                                                        )}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                                                    >
                                                        <IconPrinter size={15} />
                                                        <span>Cetak PDF</span>
                                                    </a>
                                                    <a
                                                        href={route(
                                                            "pdf.transactions.shipping",
                                                            transaction.invoice
                                                        )}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                                                    >
                                                        <span>Resi</span>
                                                    </a>
                                                    {canCreateSalesReturn &&
                                                        transaction.can_create_sales_return && (
                                                            <Link
                                                                href={route(
                                                                    "sales-returns.create",
                                                                    transaction.id
                                                                )}
                                                                className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                                                            >
                                                                <IconRotateClockwise size={15} />
                                                                <span>Retur</span>
                                                            </Link>
                                                        )}
                                                </div>
                                            </div>
                                        }
                                        actions={[
                                            {
                                                label: "Bagikan",
                                                icon: <IconShare size={15} />,
                                                onClick: () =>
                                                    handleShareTransaction(
                                                        transaction
                                                    ),
                                            },
                                            {
                                                label: "Detail / Struk",
                                                variant: "primary",
                                                icon: <IconReceipt size={15} />,
                                                onClick: () =>
                                                    router.get(
                                                        route(
                                                            "transactions.print",
                                                            transaction.invoice
                                                        )
                                                    ),
                                            },
                                        ]}
                                    />
                                );
                            })}
                        </div>

                        {/* 2. Desktop Table View (>= 640px) */}
                        <div className="hidden sm:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                            <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                No
                                            </th>
                                            <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Invoice
                                            </th>
                                            <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Tanggal
                                            </th>
                                            <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Kasir
                                            </th>
                                            <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Pelanggan
                                            </th>
                                            <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Item
                                            </th>
                                            <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Total
                                            </th>
                                            <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                        {rows.map((transaction, index) => (
                                            <tr
                                                key={transaction.id}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                <td className="px-4 py-3.5 text-slate-500">
                                                    {index +
                                                        1 +
                                                        (currentPage - 1) * perPage}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="font-semibold text-slate-900 dark:text-white">
                                                        {transaction.invoice}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                                                    {transaction.created_at}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                                                    {transaction.cashier?.name ?? "-"}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                                                        {transaction.customer?.name ??
                                                            "Umum"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 rounded-full">
                                                        {transaction.total_items ?? 0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                                                    {formatCurrency(
                                                        transaction.grand_total ?? 0
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    {transaction.payment_method ===
                                                        "pay_later" &&
                                                    transaction.payment_status !==
                                                        "paid" ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-800">
                                                            Piutang
                                                        </span>
                                                    ) : transaction.payment_status ===
                                                      "paid" ? (
                                                        <span
                                                            title={
                                                                transaction.payment_confirmer
                                                                    ? `Dikonfirmasi oleh ${transaction.payment_confirmer.name}`
                                                                    : undefined
                                                            }
                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800 cursor-default"
                                                        >
                                                            <IconCheck size={12} strokeWidth={3} />
                                                            Lunas
                                                        </span>
                                                    ) : transaction.payment_status ===
                                                          "pending" &&
                                                      canConfirmPayment ? (
                                                        <button
                                                            onClick={() =>
                                                                setConfirmModal({
                                                                    open: true,
                                                                    transaction,
                                                                })
                                                            }
                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-warning-50 text-warning-700 dark:bg-warning-950/50 dark:text-warning-400 rounded-full border border-warning-200 hover:bg-warning-100 transition-colors"
                                                        >
                                                            Pending (Konfirmasi)
                                                        </button>
                                                    ) : transaction.payment_status ===
                                                      "pending" ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-800">
                                                            Pending
                                                        </span>
                                                    ) : transaction.payment_status ===
                                                      "expired" ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                                                            Kadaluarsa
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-800">
                                                            {transaction.payment_status === "failed"
                                                                ? "Gagal"
                                                                : transaction.payment_status ?? "-"}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleShareTransaction(
                                                                    transaction
                                                                )
                                                            }
                                                            className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                                                            title="Bagikan Nota"
                                                        >
                                                            <IconBrandWhatsapp size={18} />
                                                        </button>
                                                        <Link
                                                            href={route(
                                                                "transactions.print",
                                                                transaction.invoice
                                                            )}
                                                            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                            title="Cetak Struk"
                                                        >
                                                            <IconPrinter size={18} />
                                                        </Link>
                                                        {canCreateSalesReturn &&
                                                            transaction.can_create_sales_return && (
                                                                <Link
                                                                    href={route(
                                                                        "sales-returns.create",
                                                                        transaction.id
                                                                    )}
                                                                    className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold"
                                                                    title="Buat Retur"
                                                                >
                                                                    Retur
                                                                </Link>
                                                            )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
                            <IconDatabaseOff size={32} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                            Belum Ada Transaksi
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {hasActiveFilters
                                ? "Tidak ada transaksi yang cocok dengan filter."
                                : "Transaksi kasir akan muncul di sini."}
                        </p>
                    </div>
                )}

                {links.length > 3 && <Pagination links={links} />}
            </div>

            {/* Confirmation Modal */}
            {confirmModal.open && confirmModal.transaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() =>
                            !isConfirming &&
                            setConfirmModal({ open: false, transaction: null })
                        }
                    />

                    {/* Modal */}
                    <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-sheet-up border border-slate-200 dark:border-slate-800">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                                    <IconBuildingBank size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold">
                                        Konfirmasi Pembayaran
                                    </h3>
                                    <p className="text-xs text-white/80">
                                        Transfer Bank
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Invoice
                                    </span>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {confirmModal.transaction.invoice}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Pelanggan
                                    </span>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                        {confirmModal.transaction.customer?.name ?? "Umum"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 dark:border-slate-700">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Total
                                    </span>
                                    <span className="text-base font-black text-primary-600 dark:text-primary-400 font-mono">
                                        {formatCurrency(
                                            confirmModal.transaction.grand_total ?? 0
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800">
                                <IconAlertCircle
                                    size={18}
                                    className="text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5"
                                />
                                <p className="text-xs text-warning-800 dark:text-warning-300 leading-relaxed">
                                    Pastikan mutasi dana transfer sudah masuk ke rekening sebelum konfirmasi.
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-5 pb-5 flex gap-2.5">
                            <button
                                type="button"
                                onClick={() =>
                                    setConfirmModal({
                                        open: false,
                                        transaction: null,
                                    })
                                }
                                disabled={isConfirming}
                                className="flex-1 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold active:scale-95 transition-all"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    requirePasswordConfirmation({
                                        title: "Konfirmasi Pembayaran Bank",
                                        description: `Masukkan password akun Anda untuk mengonfirmasi pembayaran invoice ${confirmModal.transaction?.invoice ?? ""}.`,
                                        challenge: "Konfirmasi Pembayaran",
                                        onConfirmed: () => {
                                            triggerHaptic("success");
                                            setIsConfirming(true);
                                            router.patch(
                                                route(
                                                    "transactions.confirm-payment",
                                                    confirmModal.transaction.id
                                                ),
                                                {},
                                                {
                                                    onSuccess: () => {
                                                        setConfirmModal({
                                                            open: false,
                                                            transaction: null,
                                                        });
                                                        setIsConfirming(false);
                                                    },
                                                    onError: () => {
                                                        setIsConfirming(false);
                                                    },
                                                }
                                            );
                                        },
                                    });
                                }}
                                disabled={isConfirming}
                                className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                            >
                                {isConfirming ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <IconCheck size={16} strokeWidth={3} />
                                        <span>Konfirmasi Lunas</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

History.layout = (page) => <DashboardLayout children={page} />;

export default History;
