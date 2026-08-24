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
    IconAlertCircle,
    IconShare,
    IconQrcode,
    IconRefresh,
    IconUsb,
    IconBolt,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import ThermalReceipt, {
    ThermalReceipt58mm,
} from "@/Components/Receipt/ThermalReceipt";
import ShippingLabel from "@/Components/Receipt/ShippingLabel";
import { useAuthorization } from "@/Utils/authorization";
import { printViaWebUsb } from "@/Utils/webUsbPrinter";
import toast from "react-hot-toast";
import axios from "axios";

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

export default function Print({ transaction, defaultPaperSize = "58mm", autoPrint = false }) {
    const { storeProfile, branding, flash } = usePage().props;
    const { can } = useAuthorization();
    const initialMode = defaultPaperSize === "58mm" ? "thermal58" : defaultPaperSize === "80mm" ? "thermal80" : "invoice";
    const [printMode, setPrintMode] = useState(initialMode);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isRetryingQris, setIsRetryingQris] = useState(false);
    const [isDirectPrinting, setIsDirectPrinting] = useState(false);
    const [isWebUsbPrinting, setIsWebUsbPrinting] = useState(false);
    const hasAutoPrinted = useRef(false);
    const canConfirmPayment = can("transactions-confirm-payment");

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

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error, { duration: 6000 });
        if (flash?.info) toast(flash.info);
    }, [flash]);

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

    const store = useMemo(
        () => ({
            name: storeProfile?.name || branding?.appName || "Rekasir",
            logo: storeProfile?.logo || branding?.logoLight || null,
            address: storeProfile?.address || "",
            phone: storeProfile?.phone || "",
            email: storeProfile?.email || "",
            website: storeProfile?.website || "",
        }),
        [storeProfile, branding]
    );

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
        pending: transaction?.payment_method === "pay_later" ? "Belum Lunas" : "Menunggu",
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
            "bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-400",
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
    const showPaymentLink = isNonCash && transaction.payment_url && /^https?:\/\//i.test(transaction.payment_url);

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const shouldAutoPrint = autoPrint || urlParams.get("auto_print") === "1" || urlParams.get("autoprint") === "1";

        if (shouldAutoPrint && paymentStatusKey === "paid" && !hasAutoPrinted.current) {
            hasAutoPrinted.current = true;
            const timer = setTimeout(() => {
                toast.success("Cetak otomatis dipicu");
                window.print();
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [autoPrint, paymentStatusKey]);

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

            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 print:bg-white print:p-0 print:m-0 print:min-h-0">
                <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:m-0 print:p-0 print:space-y-0">
                    {/* Auto-Print Active Banner */}
                    {autoPrint && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-300 print:hidden shadow-sm">
                            <div className="flex items-center gap-2.5">
                                <IconBolt className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
                                <div>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">Auto-Print Aktif</p>
                                    <p className="text-slate-600 dark:text-slate-400">Struk otomatis dipicu untuk transaksi lunas saat halaman dibuka.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handlePrint()}
                                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-semibold transition-all shadow-sm flex items-center gap-1"
                                >
                                    <IconPrinter size={14} />
                                    Cetak Browser
                                </button>
                                <button
                                    type="button"
                                    onClick={handleWebUsbPrint}
                                    disabled={isWebUsbPrinting}
                                    className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-transparent hover:bg-amber-100/60 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                                >
                                    <IconUsb size={14} />
                                    {isWebUsbPrinting ? "Mengirim..." : "WebUSB"}
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
                        <Link
                            href={route("transactions.index")}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <IconArrowLeft size={18} />
                            Kembali ke kasir
                        </Link>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            {/* Print Mode Selector */}
                            <div className="flex bg-slate-200 dark:bg-slate-800 rounded-xl p-1 w-full sm:w-auto">
                                <button
                                    onClick={() => setPrintMode("invoice")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "invoice"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconFileInvoice
                                        size={16}
                                        className="inline mr-1"
                                    />
                                    Invoice
                                </button>
                                <button
                                    onClick={() => setPrintMode("thermal80")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "thermal80"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt
                                        size={16}
                                        className="inline mr-1"
                                    />
                                    Struk 80mm
                                </button>
                                <button
                                    onClick={() => setPrintMode("thermal58")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "thermal58"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt
                                        size={16}
                                        className="inline mr-1"
                                    />
                                    Struk 58mm
                                </button>
                                <button
                                    onClick={() => setPrintMode("shipping")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "shipping"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconTruck
                                        size={16}
                                        className="inline mr-1"
                                    />
                                    Resi
                                </button>
                            </div>

                            {showPaymentLink && (
                                <a
                                    href={transaction.payment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary-200 dark:border-primary-800 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-colors w-full sm:w-auto"
                                >
                                    <IconExternalLink size={18} />
                                    Pembayaran
                                </a>
                            )}

                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const url = route("portal.transaction", {
                                            invoice: transaction.invoice,
                                            token: transaction.access_token,
                                        });
                                        const shareUrl = /^https?:\/\//i.test(url)
                                            ? url
                                            : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;

                                        if (navigator.clipboard?.writeText) {
                                            await navigator.clipboard.writeText(shareUrl);
                                        } else {
                                            const textarea = document.createElement("textarea");
                                            textarea.value = shareUrl;
                                            textarea.style.position = "fixed";
                                            textarea.style.left = "-999999px";
                                            textarea.style.top = "-999999px";
                                            document.body.appendChild(textarea);
                                            textarea.focus();
                                            textarea.select();
                                            document.execCommand("copy");
                                            document.body.removeChild(textarea);
                                        }
                                        alert("Link invoice disalin");
                                    } catch (e) {
                                        alert("Gagal menyalin link: " + (e?.message || "Terjadi kesalahan"));
                                    }
                                }}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full sm:w-auto"
                            >
                                <IconShare size={18} />
                                Share
                            </button>

                            {/* Confirm Payment Button - Only for pending bank_transfer */}
                            {paymentMethodKey === "bank_transfer" &&
                                paymentStatusKey === "pending" &&
                                canConfirmPayment && (
                                    <button
                                        onClick={() =>
                                            setShowConfirmModal(true)
                                        }
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success-500 hover:bg-success-600 text-sm font-semibold text-white transition-colors w-full sm:w-auto"
                                    >
                                        <IconCheck size={18} />
                                        Konfirmasi Bayar
                                    </button>
                                )}

                            {printMode === "invoice" && (
                                <a
                                    href={route("pdf.transactions.invoice", transaction.invoice)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition-colors w-full sm:w-auto"
                                >
                                    <IconPrinter size={18} />
                                    PDF Invoice
                                </a>
                            )}

                            {(printMode === "thermal80" || printMode === "thermal58") && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleWebUsbPrint}
                                        disabled={isWebUsbPrinting}
                                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-all shadow-sm w-full sm:w-auto disabled:opacity-50"
                                        title="Cetak Struk Langsung via WebUSB ESC/POS (USB Thermal Printer)"
                                    >
                                        <IconUsb size={18} className="text-blue-500" />
                                        {isWebUsbPrinting ? "Mengirim..." : "WebUSB"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDirectPrint}
                                        disabled={isDirectPrinting}
                                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full sm:w-auto disabled:opacity-50"
                                        title="Cetak Struk via Server Spooler CUPS / LPR"
                                    >
                                        <IconPrinter size={18} />
                                        {isDirectPrinting ? "Mencetak..." : "Server Thermal"}
                                    </button>
                                    <a
                                        href={route("pdf.transactions.receipt", {
                                            invoice: transaction.invoice,
                                            size: printMode === "thermal58" ? "58" : "80",
                                        })}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-sm font-semibold text-white transition-colors w-full sm:w-auto"
                                    >
                                        <IconPrinter size={18} />
                                        PDF Struk {printMode === "thermal58" ? "58mm" : "80mm"}
                                    </a>
                                </>
                            )}

                            {printMode === "shipping" && (
                                <a
                                    href={route("pdf.transactions.shipping", transaction.invoice)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold text-white transition-colors w-full sm:w-auto"
                                >
                                    <IconPrinter size={18} />
                                    PDF Resi
                                </a>
                            )}
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
    <div className="flex justify-center items-center py-10 print:py-0 print:block">
        <div className="w-full max-w-[150mm] mx-auto transition-all duration-300 transform scale-100 md:scale-110 lg:scale-125 print:scale-100">
            <ShippingLabel
                transaction={transaction}
                store={store}
            />
        </div>
    </div>
)}

                    {/* Invoice View */}
                    {printMode === "invoice" && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl print:shadow-none print:border-slate-300">
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
                                                        {transaction.receivable
                                                            ?.due_date || "-"}
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
