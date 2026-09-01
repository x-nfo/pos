import React, { useMemo, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Modal from "@/Components/Dashboard/Modal";
import {
    IconAlertTriangle,
    IconArrowLeft,
    IconCashBanknote,
    IconCheck,
    IconReceipt,
    IconRotateClockwise2,
    IconShoppingBag,
    IconWallet,
} from "@tabler/icons-react";
import { useAuthorization } from "@/Utils/authorization";
import { usePasswordConfirmation } from "@/Context/PasswordConfirmationContext";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const formatDateTime = (value) => {
    if (!value) return "-";

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "full",
        timeStyle: "short",
    }).format(new Date(value));
};

function MetricCard({ title, value, icon: Icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Icon size={18} />
                <span>{title}</span>
            </div>
            <p className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
                {value}
            </p>
        </div>
    );
}

export default function Show({
    cashierShift,
    pendingHeldCarts = [],
    canForceClose = false,
}) {
    const { auth, errors } = usePage().props;
    const { can } = useAuthorization();
    const [actualCash, setActualCash] = useState(
        cashierShift.actual_cash !== null ? String(cashierShift.actual_cash) : ""
    );
    const [closeNotes, setCloseNotes] = useState(cashierShift.close_notes || "");
    const [showHeldCartsModal, setShowHeldCartsModal] = useState(false);

    const canCloseShift = useMemo(() => {
        if (cashierShift.status !== "open") return false;

        return (
            can("cashier-shifts-close") &&
            (cashierShift.user?.id === auth?.user?.id ||
                auth?.super ||
                canForceClose)
        );
    }, [
        auth?.super,
        auth?.user?.id,
        can,
        canForceClose,
        cashierShift.status,
        cashierShift.user?.id,
    ]);

    const actualCashNumber = Number(actualCash || 0);
    const difference = actualCash === ""
        ? null
        : actualCashNumber - Number(cashierShift.expected_cash || 0);

    const totalHeldAmount = useMemo(() => {
        return pendingHeldCarts.reduce(
            (acc, curr) => acc + Number(curr.total || 0),
            0
        );
    }, [pendingHeldCarts]);

    const { requirePasswordConfirmation } = usePasswordConfirmation();
    const isForceClose = cashierShift.user?.id !== auth?.user?.id;

    const proceedCloseShift = () => {
        const submitClose = () => {
            router.post(route("cashier-shifts.close", cashierShift.id), {
                actual_cash: actualCashNumber,
                close_notes: closeNotes,
            });
        };

        if (isForceClose) {
            requirePasswordConfirmation({
                title: "Konfirmasi Force Close Shift",
                description: `Tindakan force close shift kasir ${cashierShift.user?.name ?? ""} memerlukan konfirmasi password akun.`,
                challenge: "Force Close Shift",
                onConfirmed: submitClose,
            });
        } else {
            submitClose();
        }
    };

    const handleCloseShift = (event) => {
        event.preventDefault();

        if (pendingHeldCarts.length > 0) {
            setShowHeldCartsModal(true);
            return;
        }

        proceedCloseShift();
    };

    return (
        <>
            <Head title={`Shift #${cashierShift.id}`} />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Link
                            href={route("cashier-shifts.index")}
                            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                        >
                            <IconArrowLeft size={16} />
                            <span>Kembali ke histori shift</span>
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Shift Kasir {cashierShift.user?.name || "-"}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Dibuka {formatDateTime(cashierShift.opened_at)}
                        </p>
                    </div>
                    <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${
                            cashierShift.status === "open"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : cashierShift.status === "force_closed"
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                    >
                        {cashierShift.status === "open"
                            ? "Shift Aktif"
                            : cashierShift.status === "force_closed"
                              ? "Force Closed"
                              : "Shift Closed"}
                    </span>
                </div>

                {cashierShift.status === "open" && pendingHeldCarts.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
                                    <IconAlertTriangle size={22} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                        Peringatan: Terdapat {pendingHeldCarts.length} Transaksi Tertahan (Hold Cart)
                                    </h3>
                                    <p className="mt-1 text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                                        Masih ada keranjang yang di-hold dengan total nominal {formatCurrency(totalHeldAmount)}. Transaksi ini tidak akan masuk perhitungan kas jika shift ditutup.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowHeldCartsModal(true)}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-800 shadow-xs hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
                                >
                                    <IconReceipt size={16} />
                                    <span>Daftar Transaksi ({pendingHeldCarts.length})</span>
                                </button>
                                <Link
                                    href={route("transactions.index")}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
                                >
                                    <IconShoppingBag size={16} />
                                    <span>Buka POS</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Modal Awal" value={formatCurrency(cashierShift.opening_cash)} icon={IconWallet} />
                    <MetricCard title="Expected Cash" value={formatCurrency(cashierShift.expected_cash)} icon={IconCashBanknote} />
                    <MetricCard title="Penjualan Tunai" value={formatCurrency(cashierShift.cash_sales_total)} icon={IconReceipt} />
                    <MetricCard title="Refund Tunai" value={formatCurrency(cashierShift.cash_refund_total)} icon={IconRotateClockwise2} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] min-w-0">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900 overflow-hidden min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Ringkasan Shift
                        </h2>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Kasir</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.user?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Gudang / Cabang</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.warehouse?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dibuka Oleh</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.opened_by?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Waktu Tutup</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{formatDateTime(cashierShift.closed_at)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ditutup Oleh</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.closed_by?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Transaksi</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.transactions_count}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Retur</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{cashierShift.sales_returns_count}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Penjualan Non Tunai</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{formatCurrency(cashierShift.non_cash_sales_total)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Refund Non Tunai</p>
                                <p className="mt-2 text-sm text-slate-900 dark:text-white">{formatCurrency(cashierShift.non_cash_refund_total)}</p>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Catatan Shift</p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{cashierShift.notes || "Tidak ada catatan pembukaan."}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Catatan Closing</p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{cashierShift.close_notes || "Tidak ada catatan penutupan."}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 min-w-0">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Cash Closing
                            </h2>
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">Expected Cash</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(cashierShift.expected_cash)}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">Actual Cash</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        {cashierShift.actual_cash === null ? "-" : formatCurrency(cashierShift.actual_cash)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">Selisih</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        {cashierShift.cash_difference === null ? "-" : formatCurrency(cashierShift.cash_difference)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {canCloseShift && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Tutup Shift
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Input kas fisik akhir untuk finalisasi cash closing.
                                </p>
                                <form onSubmit={handleCloseShift} className="mt-4 space-y-4">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Kas Fisik Aktual</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={actualCash}
                                            onChange={(event) => setActualCash(event.target.value)}
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        />
                                        {errors?.actual_cash && (
                                            <p className="mt-2 text-xs text-rose-500">{errors.actual_cash}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan Closing</label>
                                        <textarea
                                            rows={4}
                                            value={closeNotes}
                                            onChange={(event) => setCloseNotes(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                            placeholder="Opsional"
                                        />
                                    </div>
                                    {difference !== null && (
                                        <div
                                            className={`rounded-xl px-4 py-3 text-sm ${
                                                difference === 0
                                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                            }`}
                                        >
                                            Selisih closing: {formatCurrency(difference)}
                                        </div>
                                    )}
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                                    >
                                        <IconCashBanknote size={18} />
                                        <span>Finalisasi Closing</span>
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Konfirmasi Transaksi Tertahan (Pending Hold Carts) */}
            <Modal
                show={showHeldCartsModal}
                onClose={() => setShowHeldCartsModal(false)}
                title="Peringatan Transaksi Tertahan (Hold Cart)"
                icon={<IconAlertTriangle size={20} className="text-amber-500" />}
                maxWidth="2xl"
            >
                <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                        <div className="flex items-start gap-3">
                            <IconAlertTriangle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={20} />
                            <div className="text-sm">
                                <p className="font-semibold text-amber-900 dark:text-amber-200">
                                    Masih ada {pendingHeldCarts.length} transaksi keranjang yang di-hold
                                </p>
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                    Sebelum menutup shift, pastikan transaksi tertahan berikut sudah diselesaikan atau dibatalkan. Jika Anda melanjutkan penutupan shift, transaksi ini tetap tersimpan di sistem namun <strong>tidak akan dihitung</strong> pada rekapitulasi kas shift saat ini.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                            <span>Daftar Transaksi Tertahan ({pendingHeldCarts.length})</span>
                            <span className="text-slate-700 dark:text-slate-200 font-bold">Total: {formatCurrency(totalHeldAmount)}</span>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            {pendingHeldCarts.map((hold) => (
                                <div
                                    key={hold.hold_id}
                                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-800"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                                                {hold.label || hold.hold_id}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                                                {hold.hold_id}
                                            </span>
                                        </div>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                                            {formatCurrency(hold.total)}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500 dark:text-slate-400">
                                        <span>
                                            {hold.items_count} item
                                            {hold.items && hold.items.length > 0 && (
                                                <span className="ml-1 text-slate-400 dark:text-slate-500">
                                                    ({hold.items.map((i) => `${i.product_title || "Item"} x${i.qty}`).join(", ")})
                                                </span>
                                            )}
                                        </span>
                                        <span>{formatDateTime(hold.held_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <Link
                            href={route("transactions.index")}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            <IconShoppingBag size={16} />
                            <span>Buka POS & Selesaikan</span>
                        </Link>
                        <div className="flex w-full sm:w-auto items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => setShowHeldCartsModal(false)}
                                className="flex-1 sm:flex-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowHeldCartsModal(false);
                                    proceedCloseShift();
                                }}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors"
                            >
                                <IconCheck size={16} />
                                <span>Tetap Tutup Shift</span>
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;
