import React, { useState, useEffect } from "react";
import { Menu, Transition } from "@headlessui/react";
import {
    IconBell,
    IconCircleCheck,
    IconPackage,
    IconReceipt,
    IconCurrencyDollar,
    IconDiscount2,
    IconBuildingBank,
    IconCheck,
    IconX,
    IconEye,
} from "@tabler/icons-react";
import { usePage, router, Link } from "@inertiajs/react";
import { useHaptic } from "@/Hooks/useHaptic";
import { useAuthorization } from "@/Utils/authorization";
import { usePasswordConfirmation } from "@/Context/PasswordConfirmationContext";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

const formatCurrency = (v = 0) =>
    Number(v || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export default function Notification() {
    const {
        lowStockNotifications = [],
        receivableNotifications = [],
        payableNotifications = [],
        discountApprovalNotifications = [],
        bankPaymentNotifications = [],
        pendingBankPaymentCount = 0,
        auth,
    } = usePage().props;
    const { triggerHaptic } = useHaptic();
    const { can } = useAuthorization();
    const [processingDiscountId, setProcessingDiscountId] = useState(null);
    const [processingBankPaymentId, setProcessingBankPaymentId] = useState(null);

    const canApproveDiscounts = can("discounts-approve");
    const canConfirmBankPayments = can("transactions-confirm-payment");
    const { requirePasswordConfirmation } = usePasswordConfirmation();

    const mapItems = (items) =>
        items.map((item) => ({
            ...item,
            type: item.type || "stock",
            icon:
                item.type === "bank_payment" ? (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <IconBuildingBank size={18} />
                    </span>
                ) : item.type === "discount" ? (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <IconDiscount2 size={18} />
                    </span>
                ) : item.type === "receivable" ? (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                        <IconReceipt size={17} />
                    </span>
                ) : item.type === "payable" ? (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <IconCurrencyDollar size={17} />
                    </span>
                ) : (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                        <IconPackage size={17} />
                    </span>
                ),
        }));

    const mergeData = () => [
        ...mapItems(
            bankPaymentNotifications.map((n) => ({
                ...n,
                id: `bank-${n.id}`,
                originalId: n.id,
                title: `Konfirmasi Bank: ${n.invoice}`,
                subtitle: `Kasir: ${n.cashier} • ${n.bank_name} • Total: ${formatCurrency(n.grand_total)}`,
                type: "bank_payment",
            }))
        ),
        ...mapItems(
            discountApprovalNotifications.map((n) => ({
                ...n,
                id: `discount-${n.id}`,
                originalId: n.id,
                title: `Approval Diskon: ${n.invoice}`,
                subtitle: `Kasir: ${n.cashier} • Diskon: ${formatCurrency(n.discount)}`,
                type: "discount",
            }))
        ),
        ...mapItems(
            lowStockNotifications.map((n) => ({
                ...n,
                id: `stock-${n.id}`,
                originalId: n.id,
                title: (n.stock <= 0 ? `Stok habis: ${n.title}` : `Stok menipis: ${n.title}`) + (n.warehouse ? ` (${n.warehouse})` : ""),
                subtitle: `Tersisa: ${n.stock} ${n.min_stock ? `(Batas min: ${n.min_stock})` : ""}`,
                type: "stock",
            }))
        ),
        ...mapItems(
            receivableNotifications.map((n) => ({
                ...n,
                id: `recv-${n.id}`,
                originalId: n.id,
                type: "receivable",
            }))
        ),
        ...mapItems(
            payableNotifications.map((n) => ({
                ...n,
                id: `pay-${n.id}`,
                originalId: n.id,
                type: "payable",
            }))
        ),
    ];

    const [data, setData] = useState(mergeData());

    // Sync when notifications props change
    useEffect(() => {
        setData(mergeData());
    }, [
        bankPaymentNotifications,
        discountApprovalNotifications,
        lowStockNotifications,
        receivableNotifications,
        payableNotifications,
    ]);

    // Background polling for real-time discount approvals & bank payment confirmations
    useEffect(() => {
        if (!canApproveDiscounts && !canConfirmBankPayments) return;

        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                router.reload({
                    only: [
                        "bankPaymentNotifications",
                        "pendingBankPaymentCount",
                        "discountApprovalNotifications",
                        "pendingApprovalCount",
                        "lowStockNotifications",
                        "receivableNotifications",
                        "payableNotifications",
                    ],
                    preserveScroll: true,
                    preserveState: true,
                });
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [canApproveDiscounts, canConfirmBankPayments]);

    const handleReloadNotifications = () => {
        triggerHaptic("tap");
        router.reload({
            only: [
                "bankPaymentNotifications",
                "pendingBankPaymentCount",
                "discountApprovalNotifications",
                "pendingApprovalCount",
                "lowStockNotifications",
                "receivableNotifications",
                "payableNotifications",
            ],
            preserveScroll: true,
            preserveState: true,
        });
    };

    const handleConfirmBankPayment = (item) => {
        triggerHaptic("medium");
        Swal.fire({
            title: "Konfirmasi Pembayaran Bank?",
            html: `
                <div class="text-left text-sm space-y-2 mt-2">
                    <p>Konfirmasi transaksi <strong>${item.invoice}</strong> sebesar <strong class="text-cyan-600 font-bold">${formatCurrency(item.grand_total)}</strong>?</p>
                    <div class="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs space-y-1 text-slate-700 dark:text-slate-300">
                        <p><strong>Bank:</strong> ${item.bank_name}</p>
                        ${item.account_number ? `<p><strong>No. Rek:</strong> ${item.account_number}</p>` : ""}
                        ${item.account_name ? `<p><strong>a.n:</strong> ${item.account_name}</p>` : ""}
                    </div>
                    <p class="text-xs text-amber-600 dark:text-amber-400 font-medium">⚠️ Pastikan dana sudah masuk ke rekening bank sebelum konfirmasi.</p>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0891b2",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Konfirmasi Lunas",
            cancelButtonText: "Batal",
            customClass: {
                popup: "rounded-2xl dark:bg-slate-900 dark:text-white",
            },
        }).then((result) => {
            if (!result.isConfirmed) return;

            const submitConfirm = () => {
                setProcessingBankPaymentId(item.id);
                router.patch(
                    route("transactions.confirm-payment", item.originalId),
                    {},
                    {
                        preserveScroll: true,
                        preserveState: true,
                        onSuccess: () => {
                            setData((prev) => prev.filter((d) => d.id !== item.id));
                            toast.success(`Pembayaran ${item.invoice} berhasil dikonfirmasi.`);
                            setProcessingBankPaymentId(null);
                        },
                        onError: () => {
                            toast.error(`Gagal mengonfirmasi pembayaran ${item.invoice}.`);
                            setProcessingBankPaymentId(null);
                        },
                        onFinish: () => {
                            setProcessingBankPaymentId(null);
                        },
                    }
                );
            };

            requirePasswordConfirmation({
                title: "Konfirmasi Pembayaran Bank",
                description: `Masukkan password akun Anda untuk mengonfirmasi pembayaran invoice ${item.invoice}.`,
                challenge: "Konfirmasi Pembayaran",
                onConfirmed: submitConfirm,
            });
        });
    };

    const handleApproveDiscount = (item) => {
        triggerHaptic("medium");
        setProcessingDiscountId(item.id);
        router.post(
            route("discount-approvals.approve", item.originalId),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setData((prev) => prev.filter((d) => d.id !== item.id));
                    toast.success(`Diskon ${item.invoice} berhasil disetujui.`);
                    setProcessingDiscountId(null);
                },
                onError: () => {
                    toast.error(`Gagal menyetujui diskon ${item.invoice}.`);
                    setProcessingDiscountId(null);
                },
            }
        );
    };

    const handleDenyDiscount = (item) => {
        triggerHaptic("medium");
        Swal.fire({
            title: "Tolak Diskon?",
            text: `Tolak permintaan diskon untuk transaksi ${item.invoice}?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#e11d48",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Tolak Diskon",
            cancelButtonText: "Batal",
            customClass: {
                popup: "rounded-2xl dark:bg-slate-900 dark:text-white",
            },
        }).then((result) => {
            if (!result.isConfirmed) return;

            setProcessingDiscountId(item.id);
            router.post(
                route("discount-approvals.deny", item.originalId),
                {},
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        setData((prev) => prev.filter((d) => d.id !== item.id));
                        toast.success(`Diskon ${item.invoice} ditolak.`);
                        setProcessingDiscountId(null);
                    },
                    onError: () => {
                        toast.error(`Gagal menolak diskon ${item.invoice}.`);
                        setProcessingDiscountId(null);
                    },
                }
            );
        });
    };

    const handleMarkRead = (id) => {
        setData((prev) => prev.filter((item) => item.id !== id));
        const item = data.find((d) => d.id === id);
        if (item?.type === "stock") {
            router.post(
                route("notifications.stock.read"),
                { product_id: item.originalId || id },
                { preserveScroll: true, preserveState: true }
            );
        }
    };

    const handleMarkAllRead = () => {
        setData((prev) => prev.filter((item) => item.type === "discount" || item.type === "bank_payment"));
        router.post(
            route("notifications.stock.readAll"),
            {},
            { preserveScroll: true, preserveState: true }
        );
    };

    const badgeCount = data.length;
    const discountCount = data.filter((d) => d.type === "discount").length;
    const bankCount = data.filter((d) => d.type === "bank_payment").length;
    const hasUrgentAction = discountCount > 0 || bankCount > 0;

    const NotificationList = ({ close }) => (
        <div className="flex flex-col gap-2.5 items-stretch w-full">
            {badgeCount === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                    <IconBell size={32} className="mx-auto mb-2 opacity-25" />
                    <span>Tidak ada notifikasi baru</span>
                </div>
            )}
            {data.map((item) => {
                if (item.type === "bank_payment") {
                    return (
                        <div
                            key={item.id}
                            className="w-full p-3 sm:p-3.5 rounded-2xl bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-200/90 dark:border-cyan-800/60 shadow-2xs transition-all space-y-2.5"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    {item.icon}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                                {item.invoice}
                                            </span>
                                            <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300">
                                                Transfer Bank
                                            </span>
                                        </div>
                                        <div className="text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs mt-1 space-y-0.5">
                                            <p className="truncate">
                                                Kasir: <strong className="text-slate-800 dark:text-slate-100">{item.cashier}</strong>
                                                {item.customer && item.customer !== "Umum" ? ` • ${item.customer}` : ""}
                                            </p>
                                            <p className="truncate text-slate-500 dark:text-slate-400">
                                                Rekening: <span className="font-medium text-slate-700 dark:text-slate-200">{item.bank_name}</span>
                                                {item.account_number ? ` (${item.account_number}${item.account_name ? ` - ${item.account_name}` : ""})` : ""}
                                            </p>
                                            <p>
                                                Total:{" "}
                                                <strong className="text-cyan-700 dark:text-cyan-300 font-bold">
                                                    {formatCurrency(item.grand_total)}
                                                </strong>
                                            </p>
                                            {item.time && (
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                                    {item.time}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Link
                                    href={route("transactions.print", item.invoice)}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
                                    title="Lihat Nota"
                                    onClick={close}
                                >
                                    <IconEye size={17} />
                                </Link>
                            </div>

                            {/* Direct Action Buttons */}
                            {canConfirmBankPayments && (
                                <div className="flex items-center gap-2 pt-1 border-t border-cyan-200/60 dark:border-cyan-900/40">
                                    <button
                                        type="button"
                                        disabled={processingBankPaymentId === item.id}
                                        onClick={() => handleConfirmBankPayment(item)}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-bold shadow-2xs hover:shadow-xs active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                        {processingBankPaymentId === item.id ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <IconCheck size={14} />
                                        )}
                                        <span>Konfirmasi Bayar</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                }

                if (item.type === "discount") {
                    return (
                        <div
                            key={item.id}
                            className="w-full p-3 sm:p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 shadow-2xs transition-all space-y-2.5"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    {item.icon}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                                {item.invoice}
                                            </span>
                                            <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                                                Approval Diskon
                                            </span>
                                            {item.payment_method === "bank_transfer" && (
                                                <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300">
                                                    Transfer Bank
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs mt-1 space-y-0.5">
                                            <p className="truncate">
                                                Kasir: <strong className="text-slate-800 dark:text-slate-100">{item.cashier}</strong>
                                                {item.customer && item.customer !== "Umum" ? ` • ${item.customer}` : ""}
                                            </p>
                                            <p>
                                                Diskon:{" "}
                                                <strong className="text-rose-600 dark:text-rose-400 font-bold">
                                                    {formatCurrency(item.discount)}
                                                </strong>
                                                <span className="mx-1.5 text-slate-300 dark:text-slate-600">|</span>
                                                Total:{" "}
                                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                    {formatCurrency(item.grand_total)}
                                                </span>
                                            </p>
                                            {item.payment_method === "bank_transfer" && (
                                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                                    ℹ️ Mutasi bank {item.bank_name ? `(${item.bank_name})` : ""} tetap harus dikonfirmasi setelah diskon disetujui.
                                                </p>
                                            )}
                                            {item.time && (
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                                    {item.time}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Link
                                    href={route("transactions.print", item.invoice)}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                                    title="Lihat Nota"
                                    onClick={close}
                                >
                                    <IconEye size={17} />
                                </Link>
                            </div>

                            {/* Direct Action Buttons */}
                            <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                                <button
                                    type="button"
                                    disabled={processingDiscountId === item.id}
                                    onClick={() => handleApproveDiscount(item)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs hover:shadow-xs active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                                >
                                    <IconCheck size={14} />
                                    <span>Setujui</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={processingDiscountId === item.id}
                                    onClick={() => handleDenyDiscount(item)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-[11px] font-bold active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                                >
                                    <IconX size={14} />
                                    <span>Tolak</span>
                                </button>
                            </div>
                        </div>
                    );
                }

                return (
                    <div
                        className="flex items-center justify-between gap-3 w-full p-3 sm:p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 hover:border-primary-200 dark:hover:border-primary-800 shadow-2xs transition-all"
                        key={item.id}
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            {item.icon}
                            <Link
                                href={
                                    item.type === "stock"
                                        ? route("products.edit", item.originalId)
                                        : item.type === "receivable"
                                        ? route("receivables.show", item.originalId)
                                        : route("payables.show", item.originalId)
                                }
                                className="min-w-0 flex-1 group"
                                onClick={close}
                            >
                                <div className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                    {item.title}
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs truncate mt-0.5">
                                    {item.subtitle} {item.time && `• ${item.time}`}
                                </div>
                            </Link>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("light");
                                handleMarkRead(item.id);
                            }}
                            className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/50 border border-primary-200/60 dark:border-primary-800/80 active:scale-95 transition-all"
                        >
                            <IconCircleCheck size={14} />
                            <span>Dibaca</span>
                        </button>
                    </div>
                );
            })}
        </div>
    );

    return (
        <Menu className="relative z-50" as="div">
            {({ close }) => (
                <>
                    <Menu.Button
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center relative text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all"
                        aria-label="Notifikasi"
                        onClick={handleReloadNotifications}
                    >
                {badgeCount > 0 && (
                    <span
                        className={`absolute -top-1 -right-1 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] px-1 ${
                            hasUrgentAction
                                ? "bg-cyan-500 ring-2 ring-cyan-200 dark:ring-cyan-900 animate-pulse"
                                : "bg-rose-500"
                        } text-white text-[9px] sm:text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs`}
                    >
                        {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                )}
                <IconBell
                    strokeWidth={1.8}
                    size={18}
                    className={
                        hasUrgentAction
                            ? "text-cyan-600 dark:text-cyan-400"
                            : "text-slate-500 dark:text-slate-400"
                    }
                />
            </Menu.Button>
            <Transition
                enter="transition duration-150 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-100 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
            >
                <Menu.Items className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-14 sm:top-auto sm:mt-2 sm:w-[460px] max-w-[calc(100vw-1.5rem)] sm:max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 z-[100] bg-white dark:bg-slate-900 shadow-2xl overflow-hidden focus:outline-none">
                    {/* Header */}
                    <div className="flex justify-between items-center gap-2 p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                            <span>Notifikasi</span>
                            {badgeCount > 0 && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                                    {badgeCount}
                                </span>
                            )}
                            {bankCount > 0 && (
                                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300">
                                    {bankCount} Perlu Konfirmasi Bank
                                </span>
                            )}
                            {discountCount > 0 && (
                                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                                    {discountCount} Perlu Approval
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {canConfirmBankPayments && bankCount > 0 && (
                                <Link
                                    href={route("transactions.history", { payment_method: "bank_transfer", payment_status: "pending" })}
                                    className="text-[11px] sm:text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                                    onClick={close}
                                >
                                    Riwayat Bank
                                </Link>
                            )}
                            {canApproveDiscounts && discountCount > 0 && (
                                <Link
                                    href={route("discount-approvals.pending")}
                                    className="text-[11px] sm:text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                                    onClick={close}
                                >
                                    Semua Approval
                                </Link>
                            )}
                            {badgeCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("light");
                                        handleMarkAllRead();
                                    }}
                                    className="text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 transition-all"
                                >
                                    Tandai stok dibaca
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notification Items List */}
                    <div className="p-3 sm:p-4 max-h-[60vh] sm:max-h-[420px] overflow-y-auto dashboard-scrollbar">
                        <NotificationList close={close} />
                    </div>
                </Menu.Items>
            </Transition>
                </>
            )}
        </Menu>
    );
}
