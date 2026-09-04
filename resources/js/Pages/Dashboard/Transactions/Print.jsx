import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconPrinter,
    IconExternalLink,
    IconReceipt,
    IconFileInvoice,
    IconTruck,
    IconBuildingBank,
    IconCheck,
    IconCircleCheck,
    IconAlertCircle,
    IconShare,
    IconQrcode,
    IconRefresh,
    IconUsb,
    IconBluetooth,
    IconBolt,
    IconX,
    IconVolume,
    IconVolumeOff,
    IconShoppingCart,
    IconBrandWhatsapp,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import ThermalReceipt, {
    ThermalReceipt58mm,
} from "@/Components/Receipt/ThermalReceipt";
import ShippingLabel from "@/Components/Receipt/ShippingLabel";
import { useAuthorization } from "@/Utils/authorization";
import { usePasswordConfirmation } from "@/Context/PasswordConfirmationContext";
import { shareWhatsappReceipt } from "@/Utils/whatsappReceipt";
import { printViaWebUsb } from "@/Utils/webUsbPrinter";
import { printViaBluetooth } from "@/Utils/webBluetoothPrinter";
import { playSuccessChime, isSoundEnabled, toggleSoundEnabled } from "@/Utils/sound";
import toast, { Toaster } from "react-hot-toast";
import axios from "axios";
import Swal from "sweetalert2";

function QrisCode({ value, size = 180 }) {
    const [dataUrl, setDataUrl] = useState("");

    useEffect(() => {
        if (!value) return;
        QRCode.toDataURL(value, { width: size, margin: 1 })
            .then((url) => setDataUrl(url))
            .catch((err) => console.error("Error generating QR code:", err));
    }, [value, size]);

    if (!dataUrl) {
        return (
            <div
                style={{ width: size, height: size }}
                className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-400"
            >
                Membuat QRIS...
            </div>
        );
    }

    return (
        <img
            src={dataUrl}
            alt="Dynamic QRIS"
            width={size}
            height={size}
            className="rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-white p-1.5"
        />
    );
}

export default function Print({
    transaction,
    defaultPaperSize = "58mm",
    autoPrint = false,
    autoPrintDriver = "browser",
    enabledButtons = {
        bluetooth: true,
        webusb: true,
        server: true,
        pdf_receipt: true,
        pdf_invoice: true,
    },
    isJustCompleted = false,
}) {
    const { storeProfile, branding, flash } = usePage().props;
    const { can } = useAuthorization();
    const initialMode = defaultPaperSize === "58mm" ? "thermal58" : defaultPaperSize === "80mm" ? "thermal80" : "invoice";
    const [printMode, setPrintMode] = useState(initialMode);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isRetryingQris, setIsRetryingQris] = useState(false);
    const [isDirectPrinting, setIsDirectPrinting] = useState(false);
    const [isWebUsbPrinting, setIsWebUsbPrinting] = useState(false);
    const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
    const [isCheckingApproval, setIsCheckingApproval] = useState(false);
    const [soundActive, setSoundActive] = useState(() => isSoundEnabled());
    const hasAutoPrinted = useRef(false);
    const hasPlayedSound = useRef(false);
    const canConfirmPayment = can("transactions-confirm-payment");
    const canApproveDiscount = can("discounts-approve");
    const { requirePasswordConfirmation } = usePasswordConfirmation();

    const handleCheckApprovalStatus = () => {
        setIsCheckingApproval(true);
        router.reload({
            only: ["transaction"],
            onSuccess: () => {
                setIsCheckingApproval(false);
                toast.success("Status transaksi diperbarui.");
            },
            onError: () => {
                setIsCheckingApproval(false);
                toast.error("Gagal memeriksa status approval.");
            },
        });
    };

    const handleDiscountDecision = (action) => {
        const isApprove = action === "approve";
        Swal.fire({
            title: isApprove ? "Setujui Diskon?" : "Tolak Diskon?",
            text: `${isApprove ? "Setujui" : "Tolak"} permintaan diskon untuk transaksi ${transaction.invoice}?`,
            icon: isApprove ? "question" : "warning",
            showCancelButton: true,
            confirmButtonColor: isApprove ? "#10b981" : "#e11d48",
            cancelButtonColor: "#64748b",
            confirmButtonText: isApprove ? "Ya, Setujui" : "Ya, Tolak",
            cancelButtonText: "Batal",
            customClass: {
                popup: "rounded-2xl dark:bg-slate-900 dark:text-white",
            },
        }).then((result) => {
            if (!result.isConfirmed) return;

            router.post(
                route(`discount-approvals.${action}`, transaction.id),
                {},
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success(
                            isApprove ? "Diskon disetujui." : "Diskon ditolak."
                        );
                    },
                    onError: () => toast.error("Gagal memproses approval diskon."),
                }
            );
        });
    };

    const handleDirectPrint = async () => {
        setIsDirectPrinting(true);
        try {
            const res = await axios.post(route("transactions.print.direct", transaction.invoice));
            if (res.data?.success) {
                toast.success(res.data.message || "Struk berhasil dicetak langsung ke printer!");
            }
        } catch (e) {
            toast.error(e.response?.data?.message || "Gagal mencetak struk langsung. Pastikan printer terhubung.");
        } finally {
            setIsDirectPrinting(false);
        }
    };

    const handleWebUsbPrint = async () => {
        setIsWebUsbPrinting(true);
        try {
            const paperSize = printMode === "thermal58" ? "58mm" : "80mm";
            await printViaWebUsb(transaction, store, paperSize);
            toast.success("Struk berhasil dikirim ke printer WebUSB!");
        } catch (e) {
            toast.error(e.message || "Gagal mencetak via WebUSB. Pastikan printer USB terhubung.");
        } finally {
            setIsWebUsbPrinting(false);
        }
    };

    const handleBluetoothPrint = async () => {
        setIsBluetoothPrinting(true);
        try {
            const paperSize = printMode === "thermal58" ? "58mm" : "80mm";
            await printViaBluetooth(transaction, store, paperSize);
            toast.success("Struk berhasil dikirim ke printer Bluetooth!");
        } catch (e) {
            toast.error(e.message || "Gagal mencetak via Bluetooth. Pastikan Bluetooth aktif.");
        } finally {
            setIsBluetoothPrinting(false);
        }
    };

    const handleToggleSound = () => {
        const next = toggleSoundEnabled();
        setSoundActive(next);
        if (next) {
            playSuccessChime();
            toast.success("Suara notifikasi kasir aktif");
        } else {
            toast("Suara notifikasi kasir dinonaktifkan", { icon: "🔇" });
        }
    };

    const handleTriggerPrint = () => {
        if (printMode === "thermal58" || printMode === "thermal80") {
            if (autoPrintDriver === "bluetooth" && enabledButtons?.bluetooth !== false) {
                handleBluetoothPrint();
            } else if (autoPrintDriver === "webusb" && enabledButtons?.webusb !== false) {
                handleWebUsbPrint();
            } else if (autoPrintDriver === "server" && enabledButtons?.server !== false) {
                handleDirectPrint();
            } else {
                handlePrint();
            }
        } else {
            handlePrint();
        }
    };

    useEffect(() => {
        if ((isJustCompleted || flash?.success) && !hasPlayedSound.current) {
            hasPlayedSound.current = true;
            playSuccessChime();
        }
    }, [isJustCompleted, flash?.success]);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error, { duration: 6000 });
        if (flash?.info) toast(flash.info);
    }, [flash]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
                return;
            }
            if (showConfirmModal) return;

            if (e.key === "Escape" || e.key === "F2") {
                e.preventDefault();
                router.visit(route("transactions.index"));
            } else if ((e.key === "p" || e.key === "P") && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                handleTriggerPrint();
            } else if ((e.key === "w" || e.key === "W") && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                shareWhatsappReceipt({
                    transaction,
                    storeProfile,
                    branding,
                });
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showConfirmModal, printMode, autoPrintDriver, enabledButtons, transaction, storeProfile, branding]);

    const formatPrice = (price = 0) =>
        Number(price || 0).toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        });

    const formatDateTime = (value) =>
        new Date(value).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    const formatDate = (value) => {
        if (!value) return "-";
        try {
            const d = new Date(value);
            if (isNaN(d.getTime())) return value;
            return d.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            });
        } catch (e) {
            return value;
        }
    };

    const items = transaction?.details ?? [];
    const promoDiscountTotal = useMemo(
        () =>
            items.reduce(
                (sum, item) => sum + Number(item.discount_total || 0),
                0
            ),
        [items]
    );
    const loyaltyDiscountTotal = Number(
        transaction?.loyalty_discount_total || 0
    );
    const voucherDiscountTotal = Number(
        transaction?.customer_voucher_discount || 0
    );
    const baseSubtotal =
        (transaction?.grand_total || 0) +
        (transaction?.discount || 0) -
        (transaction?.shipping_cost || 0) -
        (transaction?.tax_total || 0) +
        promoDiscountTotal +
        loyaltyDiscountTotal +
        voucherDiscountTotal;

    const store = useMemo(() => {
        const baseStoreName = storeProfile?.name || branding?.appName || "Rekasir";
        const warehouse = transaction?.warehouse || transaction?.cashier?.warehouse;
        const storeName = warehouse && warehouse.type !== "main" && warehouse.name
            ? `${baseStoreName} (${warehouse.name})`
            : baseStoreName;

        const clean = (val) => {
            if (!val || typeof val !== "string") return "";
            return val.toLowerCase().includes("belum diisi") ? "" : val.trim();
        };

        return {
            name: storeName,
            logo: storeProfile?.logo || branding?.logoLight || null,
            address: clean(warehouse?.address) || clean(storeProfile?.address) || "",
            phone: clean(warehouse?.phone) || clean(storeProfile?.phone) || "",
            email: clean(storeProfile?.email) || "",
            website: clean(storeProfile?.website) || "",
        };
    }, [storeProfile, branding, transaction?.warehouse, transaction?.cashier?.warehouse]);

    const paymentLabels = {
        cash: "Tunai",
        bank_transfer: "Transfer Bank",
        midtrans: "Midtrans",
        xendit: "Xendit",
        qrisly: "QRIS (QRISLY)",
        pay_later: "Piutang",
    };
    const paymentMethodKey = (
        transaction?.payment_method || "cash"
    ).toLowerCase();
    const paymentMethodLabel = paymentLabels[paymentMethodKey] ?? "Tunai";

    const paymentStatuses = {
        paid: "Lunas",
        pending:
            transaction?.payment_method === "pay_later"
                ? "Belum Lunas"
                : transaction?.payment_method === "bank_transfer"
                ? "Belum Dikonfirmasi"
                : "Menunggu",
        pending_approval: "Menunggu Approval Diskon",
        failed: "Gagal",
        expired: "Kedaluwarsa",
        unpaid: "Belum Lunas",
        partial: "Parsial",
    };
    const paymentStatusKey = (transaction?.payment_status || "").toLowerCase();
    const paymentStatusLabel =
        paymentStatuses[paymentStatusKey] ??
        (paymentMethodKey === "cash" ? "Lunas" : "Menunggu");

    const statusColors = {
        paid: "bg-success-100 text-success-700 dark:bg-success-900/50 dark:text-success-400",
        pending:
            transaction?.payment_method === "bank_transfer"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                : "bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-400",
        pending_approval:
            "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
        unpaid:
            "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
        partial:
            "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400",
        failed: "bg-danger-100 text-danger-700 dark:bg-danger-900/50 dark:text-danger-400",
        expired:
            "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    };
    const paymentStatusColor =
        statusColors[paymentStatusKey] ?? statusColors.paid;

    const isNonCash = paymentMethodKey !== "cash";
    const showPaymentLink = isNonCash && transaction.payment_status !== "paid" && transaction.payment_url && /^https?:\/\//i.test(transaction.payment_url);

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const shouldAutoPrint = autoPrint || urlParams.get("auto_print") === "1" || urlParams.get("autoprint") === "1";

        if (shouldAutoPrint && paymentStatusKey === "paid" && !hasAutoPrinted.current) {
            hasAutoPrinted.current = true;
            const timer = setTimeout(() => {
                if (autoPrintDriver === "bluetooth") {
                    toast.success("Memicu auto-print via Bluetooth...");
                    handleBluetoothPrint();
                } else if (autoPrintDriver === "webusb") {
                    toast.success("Memicu auto-print via WebUSB...");
                    handleWebUsbPrint();
                } else if (autoPrintDriver === "server") {
                    toast.success("Memicu auto-print via Server Thermal...");
                    handleDirectPrint();
                } else {
                    handlePrint();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoPrint, paymentStatusKey, autoPrintDriver]);

    const isPendingApproval =
        transaction?.discount_approval_status === "pending" ||
        transaction?.payment_status === "pending_approval";

    const isPendingBankConfirmation =
        paymentMethodKey === "bank_transfer" && paymentStatusKey === "pending";

    const SimpleBarcode = ({ value }) => {
        const bars = useMemo(() => {
            const data = value || "";
            return data.split("").map((char, idx) => {
                const weight = (char.charCodeAt(0) + idx * 17) % 5;
                return 2 + weight; // 2-6px width
            });
        }, [value]);
        const totalWidth = bars.reduce((acc, w) => acc + w, 0);
        const targetWidth = 180; // px target
        const scale = totalWidth ? Math.min(2.2, targetWidth / totalWidth) : 1;

        return (
            <div className="flex items-end gap-[2px] mt-4">
                {bars.map((w, i) => (
                    <span
                        key={i}
                        style={{ width: `${w * scale}px` }}
                        className="h-10 sm:h-14 bg-slate-800 dark:bg-slate-100 block"
                    />
                ))}
            </div>
        );
    };

    return (
        <>
            <Head title="Invoice Penjualan" />
            <Toaster position="top-center" />

            <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 py-3 sm:py-8 px-2.5 sm:px-4 flex flex-col items-center justify-start print:bg-white print:p-0 print:m-0 print:min-h-0">
                <div className={`w-full mx-auto print:max-w-none print:m-0 print:p-0 transition-all duration-300 ${printMode === "invoice" ? "max-w-6xl" : "max-w-5xl"}`}>
                    {/* Unified POS Workstation Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800 overflow-hidden print:shadow-none print:border-0 print:rounded-none">
                        {/* Integrated Header / Status Bar (print:hidden) */}
                        <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 print:hidden">
                            <div className="flex items-center justify-between sm:justify-start gap-2.5">
                                <Link
                                    href={route("transactions.index")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors shrink-0"
                                >
                                    <IconArrowLeft size={16} />
                                    <span>Kasir (Esc)</span>
                                </Link>

                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                        {transaction.invoice}
                                    </span>
                                    <span className="text-xs text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                                        {formatDateTime(transaction.created_at)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${paymentStatusColor}`}>
                                    {paymentStatusLabel}
                                </span>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleToggleSound}
                                        className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        title={soundActive ? "Bisukan suara kasir" : "Aktifkan suara kasir"}
                                        aria-label="Toggle Sound"
                                    >
                                        {soundActive ? <IconVolume size={16} /> : <IconVolumeOff size={16} className="text-slate-400" />}
                                    </button>

                                    <Link
                                        href={route("transactions.index")}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-bold text-xs shadow-sm shadow-primary-500/25 transition-all cursor-pointer"
                                    >
                                        <IconShoppingCart size={16} />
                                        <span>Transaksi Baru</span>
                                        <kbd className="hidden sm:inline text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-normal">Esc</kbd>
                                    </Link>
                                </div>
                            </div>
                        </header>

                        {/* Split Workstation Body */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 print:block">
                            {/* Left Column: Cashier Command Hub (print:hidden) */}
                            <div className="lg:col-span-5 p-4 sm:p-7 flex flex-col justify-between space-y-6 print:hidden">
                                <div className="space-y-4 sm:space-y-5">
                                    {/* Success Indicator & Customer Info */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                            <IconCheck size={24} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                                {isJustCompleted ? "Transaksi Selesai!" : "Detail Transaksi"}
                                            </h2>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {transaction.customer?.name || "Pelanggan Umum"} • Kasir: {transaction.cashier?.name || "Kasir"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Kembalian & Total Box */}
                                    {paymentMethodKey === "cash" ? (
                                        <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-500/30 p-4 sm:p-5 shadow-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                                                    Uang Kembalian
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md bg-emerald-200/80 dark:bg-emerald-900/60 text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                                                    Kembalikan
                                                </span>
                                            </div>
                                            <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-1.5">
                                                {formatPrice(transaction.change)}
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                                <span>Total: <strong className="text-slate-900 dark:text-white">{formatPrice(transaction.grand_total)}</strong></span>
                                                <span>Diterima: <strong className="text-slate-900 dark:text-white">{formatPrice(transaction.cash)}</strong></span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-4 sm:p-5">
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                                                Total Tagihan
                                            </div>
                                            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1.5">
                                                {formatPrice(transaction.grand_total)}
                                            </div>
                                            <div className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                Metode Pembayaran: <span className="text-slate-900 dark:text-white font-bold">{paymentMethodLabel}</span>
                                            </div>
                                            {transaction.payment_method === "pay_later" && transaction.receivable?.due_date && (
                                                <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/60 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                                    Jatuh Tempo: <span className="font-bold">{formatDate(transaction.receivable.due_date)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Buttons Stack */}
                                    <div className="space-y-2.5">
                                        <button
                                            type="button"
                                            onClick={handleTriggerPrint}
                                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 text-white text-sm font-bold shadow-xs transition-all cursor-pointer"
                                        >
                                            <IconPrinter size={18} />
                                            <span>
                                                {printMode === "invoice"
                                                    ? "Cetak Invoice A4"
                                                    : printMode === "shipping"
                                                    ? "Cetak Resi"
                                                    : "Cetak Struk Sekarang"}
                                            </span>
                                            <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-normal">P</kbd>
                                        </button>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => shareWhatsappReceipt({ transaction, storeProfile, branding })}
                                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold transition-colors cursor-pointer"
                                            >
                                                <IconBrandWhatsapp size={16} />
                                                <span>Kirim WA</span>
                                                <kbd className="text-[9px] bg-emerald-200/60 dark:bg-emerald-900/60 px-1 py-0.5 rounded font-mono">W</kbd>
                                            </button>

                                            {showPaymentLink ? (
                                                <a
                                                    href={transaction.payment_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 text-xs font-bold transition-colors"
                                                >
                                                    <IconExternalLink size={16} />
                                                    <span>Link Bayar</span>
                                                </a>
                                            ) : (
                                                <Link
                                                    href={route("transactions.index")}
                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
                                                >
                                                    <IconShoppingCart size={16} />
                                                    <span>Kasir Baru</span>
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    {/* Driver Options for Thermal */}
                                    {(printMode === "thermal58" || printMode === "thermal80") && (
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">
                                                Driver Cetak Thermal:
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                {enabledButtons?.bluetooth !== false && (
                                                    <button
                                                        type="button"
                                                        onClick={handleBluetoothPrint}
                                                        disabled={isBluetoothPrinting}
                                                        className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <IconBluetooth size={14} className="text-indigo-500" />
                                                        <span>Bluetooth</span>
                                                    </button>
                                                )}
                                                {enabledButtons?.webusb !== false && (
                                                    <button
                                                        type="button"
                                                        onClick={handleWebUsbPrint}
                                                        disabled={isWebUsbPrinting}
                                                        className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <IconUsb size={14} className="text-blue-500" />
                                                        <span>WebUSB</span>
                                                    </button>
                                                )}
                                                {enabledButtons?.server !== false && (
                                                    <button
                                                        type="button"
                                                        onClick={handleDirectPrint}
                                                        disabled={isDirectPrinting}
                                                        className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <IconPrinter size={14} />
                                                        <span>Server</span>
                                                    </button>
                                                )}
                                                {enabledButtons?.pdf_receipt !== false && (
                                                    <a
                                                        href={route("pdf.transactions.receipt", {
                                                            invoice: transaction.invoice,
                                                            size: printMode === "thermal58" ? "58" : "80",
                                                        })}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all"
                                                    >
                                                        <IconFileInvoice size={14} />
                                                        <span>PDF</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action links for Invoice A4 */}
                                    {printMode === "invoice" && enabledButtons?.pdf_invoice !== false && (
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <a
                                                href={route("pdf.transactions.invoice", transaction.invoice)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-colors"
                                            >
                                                <IconPrinter size={16} />
                                                <span>Buka Dokumen PDF Invoice</span>
                                            </a>
                                        </div>
                                    )}

                                    {/* Action links for Shipping Label */}
                                    {printMode === "shipping" && (
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <a
                                                href={route("pdf.transactions.shipping", transaction.invoice)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                                            >
                                                <IconPrinter size={16} />
                                                <span>Buka PDF Resi Pengiriman</span>
                                            </a>
                                        </div>
                                    )}

                                    {/* Pending Bank Confirmation Banner */}
                                    {isPendingBankConfirmation && (
                                        <div className="rounded-2xl border border-cyan-200 dark:border-cyan-800/80 bg-cyan-50/90 dark:bg-cyan-950/40 p-4 shadow-xs">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                                                    <IconBuildingBank size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-cyan-950 dark:text-cyan-100 text-xs">
                                                        Menunggu Konfirmasi Transfer
                                                    </h4>
                                                    <p className="text-[11px] text-cyan-800/80 dark:text-cyan-300/80 mt-0.5">
                                                        {transaction.bank_account?.bank_name} • {transaction.bank_account?.account_number}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-3">
                                                        <button
                                                            type="button"
                                                            onClick={handleCheckApprovalStatus}
                                                            disabled={isCheckingApproval}
                                                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200 text-xs font-semibold hover:bg-cyan-50 cursor-pointer"
                                                        >
                                                            {isCheckingApproval ? "Memeriksa..." : "Cek Status"}
                                                        </button>
                                                        {canConfirmPayment && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowConfirmModal(true)}
                                                                className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold cursor-pointer"
                                                            >
                                                                Konfirmasi Bayar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Pending Discount Approval Banner */}
                                    {isPendingApproval && (
                                        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/40 p-4 shadow-xs">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                                    <IconAlertCircle size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-amber-950 dark:text-amber-100 text-xs">
                                                        Menunggu Persetujuan Diskon
                                                    </h4>
                                                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                                                        Diskon diajukan: {formatPrice(transaction.discount)}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                        <button
                                                            type="button"
                                                            onClick={handleCheckApprovalStatus}
                                                            disabled={isCheckingApproval}
                                                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold cursor-pointer"
                                                        >
                                                            {isCheckingApproval ? "Memeriksa..." : "Cek Status"}
                                                        </button>
                                                        {canApproveDiscount && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDiscountDecision("approve")}
                                                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                                                                >
                                                                    Setujui
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDiscountDecision("deny")}
                                                                    className="px-2.5 py-1 rounded-lg border border-rose-200 bg-white text-rose-600 text-xs font-bold cursor-pointer"
                                                                >
                                                                    Tolak
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Approved Discount Alert */}
                                    {transaction?.discount_approval_status === "approved" && (
                                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                                            <IconCheck size={16} className="text-emerald-600 shrink-0" />
                                            <span>Diskon disetujui {transaction?.discount_approver?.name ? `oleh ${transaction.discount_approver.name}` : ""}.</span>
                                        </div>
                                    )}

                                    {/* Denied Discount Alert */}
                                    {transaction?.discount_approval_status === "denied" && (
                                        <div className="rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300">
                                            <IconX size={16} className="text-rose-600 shrink-0" />
                                            <span>Pengajuan diskon ditolak. Transaksi tanpa diskon.</span>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Shortcut Legend */}
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex flex-wrap items-center justify-between gap-1">
                                    <span>Pintasan Cepat:</span>
                                    <span>
                                        <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">Esc</kbd> Kasir Baru • <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">P</kbd> Cetak • <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">W</kbd> WA
                                    </span>
                                </div>
                            </div>

                            {/* Right Column: Live Document Preview (Prints to paper) */}
                            <div className="lg:col-span-7 bg-slate-50/75 dark:bg-slate-950/50 p-3 sm:p-6 lg:p-7 flex flex-col items-center justify-start border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 print:bg-white print:p-0 print:border-0 print:w-full overflow-x-auto">
                                {/* Centered Format Switcher Pills (print:hidden) */}
                                <div className="w-full max-w-full overflow-x-auto flex justify-center mb-4 sm:mb-6 print:hidden">
                                    <div className="inline-flex items-center p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                                        <button
                                            onClick={() => setPrintMode("thermal58")}
                                            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                                printMode === "thermal58"
                                                    ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                            }`}
                                        >
                                            <IconReceipt size={14} className="inline mr-1" />
                                            Struk 58mm
                                        </button>
                                        <button
                                            onClick={() => setPrintMode("thermal80")}
                                            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                                printMode === "thermal80"
                                                    ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                            }`}
                                        >
                                            <IconReceipt size={14} className="inline mr-1" />
                                            Struk 80mm
                                        </button>
                                        <button
                                            onClick={() => setPrintMode("invoice")}
                                            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                                printMode === "invoice"
                                                    ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                            }`}
                                        >
                                            <IconFileInvoice size={14} className="inline mr-1" />
                                            Invoice A4
                                        </button>
                                        <button
                                            onClick={() => setPrintMode("shipping")}
                                            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                                printMode === "shipping"
                                                    ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                            }`}
                                        >
                                            <IconTruck size={14} className="inline mr-1" />
                                            Resi
                                        </button>
                                    </div>
                                </div>

                    {/* Thermal Receipt Preview */}
                    {(printMode === "thermal80" || printMode === "thermal58") && (
                        <div className="flex justify-center print:block">
                            <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 print:shadow-none print:border-0 print:p-0 print:rounded-none">
                                {printMode === "thermal80" ? (
                                    <ThermalReceipt
                                        transaction={transaction}
                                        storeName={store.name}
                                        storeAddress={store.address}
                                        storePhone={store.phone}
                                        storeEmail={store.email}
                                        storeWebsite={store.website}
                                    />
                                ) : (
                                    <ThermalReceipt58mm
                                        transaction={transaction}
                                        storeName={store.name}
                                        storeAddress={store.address}
                                        storePhone={store.phone}
                                        storeEmail={store.email}
                                        storeWebsite={store.website}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Shipping Label Preview */}
                    {printMode === "shipping" && (
                        <div className="w-full flex justify-center items-center py-2 sm:py-6 print:py-0 print:block">
                            <div className="w-full max-w-full sm:max-w-[425.2pt] mx-auto flex justify-center print:block print:max-w-none print:w-auto">
                                <ShippingLabel
                                    transaction={transaction}
                                    store={store}
                                />
                            </div>
                        </div>
                    )}

                    {/* Invoice View */}
                    {printMode === "invoice" && (
                        <div className="w-full max-w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md print:shadow-none print:border-slate-300">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-4 sm:px-6 py-5 sm:py-6 text-white print:bg-slate-100 print:text-slate-900">
                                <div className="flex flex-col items-center text-center gap-4 sm:gap-5 sm:grid sm:grid-cols-[1.4fr,1fr] sm:text-left sm:items-start">
                                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 min-w-0">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center p-1 flex-shrink-0">
                                            {store.logo ? (
                                                <img
                                                    src={store.logo}
                                                    alt={store.name}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            ) : (
                                                <span className="text-lg font-bold text-white print:text-slate-800">
                                                    {store.name.charAt(0)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-white print:text-slate-800 space-y-1 min-w-0 text-center sm:text-left">
                                            <p className="text-base sm:text-lg font-bold leading-tight">
                                                {store.name}
                                            </p>
                                            {store.address && (
                                                <p className="text-[11px] sm:text-xs opacity-90 leading-snug break-words">
                                                    {store.address}
                                                </p>
                                            )}
                                            {(store.phone ||
                                                store.email ||
                                                store.website) && (
                                                <p className="text-[11px] sm:text-xs opacity-90 space-x-2 leading-snug flex flex-wrap justify-center sm:justify-start gap-x-2 gap-y-1">
                                                    {store.phone && (
                                                        <span>
                                                            Telp: {store.phone}
                                                        </span>
                                                    )}
                                                    {store.email && (
                                                        <span>
                                                            Email: {store.email}
                                                        </span>
                                                    )}
                                                    {store.website && (
                                                        <span>{store.website}</span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-center sm:text-right">
                                        <div className="inline-flex flex-col items-center sm:items-end bg-white/5 print:bg-transparent rounded-xl px-3 py-2 sm:px-4 sm:py-3 min-w-[180px] sm:min-w-[200px]">
                                            <div className="flex items-center gap-2 mb-1 justify-center sm:justify-end">
                                                <IconReceipt size={20} className="sm:w-6 sm:h-6" />
                                                <span className="text-xs sm:text-sm font-medium opacity-90 print:opacity-100">
                                                    INVOICE
                                                </span>
                                            </div>
                                            <p className="text-lg sm:text-2xl font-bold leading-tight">
                                                {transaction.invoice}
                                            </p>
                                            <p className="text-xs sm:text-sm opacity-80 print:opacity-100 mt-1">
                                                {formatDateTime(
                                                    transaction.created_at
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-6 py-4 sm:py-6 border-b border-slate-100 dark:border-slate-800">
                                <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-xl p-3 sm:p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                        Pelanggan
                                    </p>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                                        {transaction.customer?.name ?? "Umum"}
                                    </p>
                                    {transaction.customer?.address && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {transaction.customer.address}
                                        </p>
                                    )}
                                    {transaction.customer?.phone && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {transaction.customer.phone}
                                        </p>
                                    )}
                                </div>
                                <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-xl p-3 sm:p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                        Kasir
                                    </p>
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-base font-semibold text-slate-900 dark:text-white">
                                            {transaction.cashier?.name ?? "-"}
                                        </p>
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <span
                                                className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${paymentStatusColor}`}
                                            >
                                                {paymentStatusLabel}
                                            </span>
                                            <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                {paymentMethodLabel}
                                            </span>
                                            {transaction.payment_method ===
                                                "pay_later" &&
                                                transaction.receivable && (
                                                    <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                        Jatuh tempo:{" "}
                                                        {formatDate(transaction.receivable?.due_date)}
                                                    </span>
                                                )}
                                            {transaction.payment_confirmer && (
                                                <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                                                    Dikonfirmasi:{" "}
                                                    {transaction.payment_confirmer.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bank Transfer Info */}
                            {paymentMethodKey === "bank_transfer" &&
                                transaction.bank_account && (
                                    <div className="mx-6 mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                                            Silakan Transfer ke Rekening
                                        </p>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                                            {transaction.bank_account.bank_name}
                                        </p>
                                        <p className="text-base font-semibold text-primary-600 dark:text-primary-400">
                                            {
                                                transaction.bank_account
                                                    .account_number
                                            }
                                        </p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            a.n.{" "}
                                            {
                                                transaction.bank_account
                                                    .account_name
                                            }
                                        </p>
                                    </div>
                                )}

                            {/* QRISLY Dynamic QR Code Info */}
                            {paymentMethodKey === "qrisly" &&
                                (transaction.payment_url ? (
                                    <div className="mx-6 mb-6 p-5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/60 flex flex-col sm:flex-row items-center gap-5">
                                        <div className="flex-shrink-0">
                                            <QrisCode value={transaction.payment_url} size={160} />
                                        </div>
                                        <div className="flex-1 text-center sm:text-left space-y-1.5">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300">
                                                <IconQrcode size={14} />
                                                QRIS Dinamis (QRISLY)
                                            </div>
                                            <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                                Scan QRIS untuk Membayar
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                                Buka aplikasi m-Banking (BCA, Mandiri, BRI, BNI) atau E-Wallet (DANA, GoPay, OVO, ShopeePay) lalu pindai QRIS di samping.
                                            </p>
                                            <div className="pt-1 flex items-center justify-center sm:justify-start gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => router.reload({ only: ['transaction'] })}
                                                    className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                                                >
                                                    <IconRefresh size={14} /> Cek Status Pembayaran
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsRetryingQris(true);
                                                        router.post(
                                                            route("transactions.qrisly-retry", transaction.invoice),
                                                            {},
                                                            {
                                                                preserveScroll: true,
                                                                onFinish: () => setIsRetryingQris(false),
                                                            }
                                                        );
                                                    }}
                                                    disabled={isRetryingQris}
                                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:underline disabled:opacity-50"
                                                >
                                                    <IconRefresh size={14} className={isRetryingQris ? "animate-spin" : ""} />
                                                    Generate Ulang
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : transaction.payment_status === "pending" ? (
                                    <div className="mx-6 mb-6 p-5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row items-center gap-4">
                                        <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl">
                                            <IconAlertCircle size={28} />
                                        </div>
                                        <div className="flex-1 text-center sm:text-left">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 mb-1">
                                                <IconQrcode size={14} />
                                                QRIS Gagal Dibuat
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                                QR Code Belum Tersedia
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                                Permintaan generate QRIS ke server QRISLY mengalami kendala (misalnya saldo QRISLY / Komerce belum mencukupi atau koneksi terputus).
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsRetryingQris(true);
                                                router.post(
                                                    route("transactions.qrisly-retry", transaction.invoice),
                                                    {},
                                                    {
                                                        preserveScroll: true,
                                                        onFinish: () => setIsRetryingQris(false),
                                                    }
                                                );
                                            }}
                                            disabled={isRetryingQris}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                                        >
                                            <IconRefresh size={16} className={isRetryingQris ? "animate-spin" : ""} />
                                            {isRetryingQris ? "Membuat QRIS..." : "Generate Ulang QRIS"}
                                        </button>
                                    </div>
                                ) : null)}

                            {/* Items Table */}
                            <div className="px-4 sm:px-6 py-6">
                                <div className="w-full overflow-x-auto">
                                    <table className="w-full min-w-[620px] text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                    Produk
                                                </th>
                                                <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                    Harga
                                                </th>
                                                <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                    Qty
                                                </th>
                                                <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                    Subtotal
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {items.map((item, index) => {
                                                const quantity =
                                                    Number(item.qty) || 1;
                                                const subtotal =
                                                    Number(item.price) || 0;
                                                const unitPrice =
                                                    Number(
                                                        item.unit_price || 0
                                                    ) || subtotal / quantity;
                                                const baseUnitPrice =
                                                    Number(
                                                        item.base_unit_price || 0
                                                    ) || unitPrice;
                                                const hasPromo =
                                                    Number(
                                                        item.discount_total || 0
                                                    ) > 0 &&
                                                    baseUnitPrice > unitPrice;

                                                return (
                                                    <tr
                                                        key={item.id ?? index}
                                                        className={
                                                            index % 2 === 0
                                                                ? "bg-slate-50/60 dark:bg-slate-800/30"
                                                                : ""
                                                        }
                                                    >
                                                        <td className="py-3">
                                                            <p className="font-medium text-slate-900 dark:text-white">
                                                                {
                                                                    item.product
                                                                        ?.title
                                                                }
                                                            </p>
                                                            {hasPromo && (
                                                                <p className="text-xs font-medium text-rose-500 dark:text-rose-400">
                                                                    {item.pricing_group_label ||
                                                                        item.pricing_rule_name ||
                                                                        "Promo aktif"}
                                                                </p>
                                                            )}
                                                            {item.product
                                                                ?.barcode && (
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {
                                                                        item.product
                                                                            .barcode
                                                                    }
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                                                            <div>
                                                                {hasPromo && (
                                                                    <p className="text-xs text-slate-400 line-through">
                                                                        {formatPrice(
                                                                            baseUnitPrice
                                                                        )}
                                                                    </p>
                                                                )}
                                                                <p>
                                                                    {formatPrice(
                                                                        unitPrice
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 text-center text-slate-600 dark:text-slate-400">
                                                            {quantity} {item.unit?.symbol || ""}
                                                        </td>
                                                        <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">
                                                            {formatPrice(
                                                                subtotal
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-6">
                                <div className="max-w-xs ml-auto space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Subtotal</span>
                                        <span>{formatPrice(baseSubtotal)}</span>
                                    </div>
                                    {promoDiscountTotal > 0 && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Promo Otomatis</span>
                                            <span>
                                                -{" "}
                                                {formatPrice(
                                                    promoDiscountTotal
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                        <span>Diskon Manual</span>
                                        <span>
                                            -{" "}
                                            {formatPrice(transaction.discount)}
                                        </span>
                                    </div>
                                    {transaction.shipping_cost > 0 && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Ongkos Kirim</span>
                                            <span>
                                                +{" "}
                                                {formatPrice(
                                                    transaction.shipping_cost
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    {transaction.tax_total > 0 && (
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>PPN {transaction.tax_rate ? Number(transaction.tax_rate).toFixed(0) : "11"}%</span>
                                            <span>
                                                +{" "}
                                                {formatPrice(transaction.tax_total)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <span>Total</span>
                                        <span>
                                            {formatPrice(
                                                transaction.grand_total
                                            )}
                                        </span>
                                    </div>
                                    {paymentMethodKey === "cash" && (
                                        <>
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-2">
                                                <span>Tunai</span>
                                                <span>
                                                    {formatPrice(
                                                        transaction.cash
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-success-600 dark:text-success-400 font-medium">
                                                <span>Kembali</span>
                                                <span>
                                                    {formatPrice(
                                                        transaction.change
                                                    )}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Barcode + Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Invoice: {transaction.invoice}
                                </p>
                                <SimpleBarcode value={transaction.invoice} />
                                <div className="text-center mt-4">
                                    <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                        Terima kasih telah berbelanja
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

            {/* Confirmation Modal */}
            {showConfirmModal && canConfirmPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() =>
                            !isConfirming && setShowConfirmModal(false)
                        }
                    />

                    {/* Modal */}
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-5 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                    <IconBuildingBank size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">
                                        Konfirmasi Pembayaran
                                    </h3>
                                    <p className="text-sm opacity-90">
                                        Transfer Bank
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {/* Invoice Info */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                        Invoice
                                    </span>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                                        {transaction.invoice}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                        Pelanggan
                                    </span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {transaction.customer?.name ?? "Umum"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                        Total
                                    </span>
                                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                                        {formatPrice(
                                            transaction.grand_total ?? 0
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Confirmation Message */}
                            <div className="flex items-start gap-3 p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl border border-warning-200 dark:border-warning-800">
                                <IconAlertCircle
                                    size={20}
                                    className="text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5"
                                />
                                <p className="text-sm text-warning-800 dark:text-warning-300">
                                    Pastikan dana sudah diterima sebelum
                                    mengkonfirmasi pembayaran ini. Tindakan ini
                                    tidak dapat dibatalkan.
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isConfirming}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => {
                                    requirePasswordConfirmation({
                                        title: "Konfirmasi Pembayaran Bank",
                                        description: `Masukkan password akun Anda untuk mengonfirmasi pembayaran invoice ${transaction.invoice}.`,
                                        challenge: "Konfirmasi Pembayaran",
                                        onConfirmed: () => {
                                            setIsConfirming(true);
                                            router.patch(
                                                route(
                                                    "transactions.confirm-payment",
                                                    transaction.id
                                                ),
                                                {},
                                                {
                                                    onSuccess: () => {
                                                        setShowConfirmModal(false);
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
                                className="flex-1 px-4 py-3 rounded-xl bg-success-500 hover:bg-success-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isConfirming ? (
                                    <>
                                        <svg
                                            className="animate-spin h-4 w-4"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="none"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <IconCheck size={18} />
                                        Konfirmasi Lunas
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
