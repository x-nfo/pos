import React, { useEffect, useState, useRef } from "react";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconArrowLeft,
    IconCreditCard,
    IconCash,
    IconPrinter,
    IconChevronLeft,
    IconTrash,
    IconBrandWhatsapp,
    IconBuildingStore,
    IconCheck,
    IconX,
    IconReceipt,
    IconPlus,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { useAuthorization } from "@/Utils/authorization";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

export default function PayableShow({ payable, bankAccounts = [] }) {
    const { flash, storeProfile } = usePage().props;
    const { can } = useAuthorization();
    const [showForm, setShowForm] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const printRef = useRef(null);
    const { data, setData, post, processing, reset, errors } = useForm({
        amount: "",
        paid_at: new Date().toISOString().slice(0, 10),
        method: "cash",
        bank_account_id: "",
        note: "",
    });
    const canPayPayable = can("payables-pay");

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const isOverdue = payable.status === "overdue" || (
        payable.status !== "paid" &&
        payable.due_date &&
        new Date(payable.due_date).setHours(23, 59, 59, 999) < new Date().getTime()
    );

    const statusBadge = (value) => {
        const base = "px-2.5 py-1 text-xs font-semibold rounded-full inline-flex items-center gap-1.5 shadow-sm";
        switch (value) {
            case "paid":
                return (
                    <span className={`${base} bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Lunas
                    </span>
                );
            case "partial":
                return (
                    <span className={`${base} bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                        Parsial
                    </span>
                );
            case "overdue":
                return (
                    <span className={`${base} bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        Jatuh Tempo
                    </span>
                );
            default:
                return (
                    <span className={`${base} bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Belum Lunas
                    </span>
                );
        }
    };

    const submitPayment = (e) => {
        e.preventDefault();
        post(route("payables.pay", payable.id), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setShowForm(false);
            },
        });
    };

    const handleDeletePayment = (payment) => {
        Swal.fire({
            title: "Hapus Pembayaran?",
            text: `Masukkan password akun Anda untuk membatalkan pembayaran senilai ${formatCurrency(payment.amount)}:`,
            icon: "warning",
            input: "password",
            inputPlaceholder: "Masukkan password Anda...",
            inputAttributes: {
                autocapitalize: "off",
                autocorrect: "off",
                autocomplete: "current-password",
            },
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Konfirmasi & Hapus",
            cancelButtonText: "Batal",
            preConfirm: (password) => {
                if (!password) {
                    Swal.showValidationMessage("Password wajib diisi!");
                }
                return password;
            },
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                router.delete(
                    route("payables.payments.destroy", [payable.id, payment.id]),
                    {
                        data: { password: result.value },
                        preserveScroll: true,
                        onSuccess: () => toast.success("Pembayaran berhasil dihapus dan saldo dipulihkan"),
                        onError: (errs) => toast.error(errs?.password || errs?.message || "Gagal menghapus pembayaran"),
                    }
                );
            }
        });
    };

    // Construct WhatsApp message if supplier has phone
    const cleanPhone = payable.supplier?.phone ? payable.supplier.phone.replace(/[^0-9]/g, "") : null;
    const shareText = `Halo ${payable.supplier?.name || "Supplier"}, konfirmasi informasi hutang/tagihan dengan nomor dokumen ${payable.document_number}${payable.vendor_invoice_number ? ` (No. Faktur: ${payable.vendor_invoice_number})` : ""} senilai ${formatCurrency(payable.total)}. Sisa tagihan: ${formatCurrency(payable.remaining)}. Jatuh tempo: ${formatDate(payable.due_date)}. Terima kasih.`;
    const waUrl = cleanPhone
        ? `https://wa.me/${cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(shareText)}`
        : null;

    return (
        <>
            <Head title={`Hutang ${payable.document_number}`} />
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col gap-4">
                    {/* Top Row: Back Link and Status Badge */}
                    <div className="flex items-center justify-between gap-3">
                        <Link
                            href={route("payables.index")}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 transition-colors"
                        >
                            <IconChevronLeft size={18} strokeWidth={2.2} />
                            Kembali ke Hutang
                        </Link>
                        <div>{statusBadge(payable.status)}</div>
                    </div>

                    {/* Title & Quick Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dokumen Hutang</span>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                                {payable.document_number}
                            </h1>
                            {payable.vendor_invoice_number && (
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                    No. Faktur: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{payable.vendor_invoice_number}</span>
                                </p>
                            )}
                            {payable.purchase_order && (
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                    No. PO:{" "}
                                    <Link
                                        href={route("purchase-orders.show", payable.purchase_order.id)}
                                        className="font-mono font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                                    >
                                        {payable.purchase_order.document_number}
                                    </Link>
                                    {payable.purchase_order.warehouse && (
                                        <span className="ml-2">
                                            &bull; Unit/Cabang:{" "}
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                {payable.purchase_order.warehouse.name} ({payable.purchase_order.warehouse.code})
                                            </span>
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {waUrl && (
                                <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
                                    title="Hubungi Supplier via WhatsApp"
                                >
                                    <IconBrandWhatsapp size={18} />
                                    <span className="hidden sm:inline">WhatsApp</span> Supplier
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowPreview(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
                            >
                                <IconPrinter size={18} />
                                Preview / PDF
                            </button>
                            {payable.status !== "paid" && canPayPayable && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForm(true);
                                        setTimeout(() => {
                                            document.getElementById("payment-form-section")?.scrollIntoView({ behavior: "smooth" });
                                        }, 100);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
                                >
                                    <IconPlus size={18} />
                                    Bayar Hutang
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main 2-Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
                    {/* Left Column: Supplier Info, Summary, & Payments List */}
                    <div
                        ref={printRef}
                        className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm min-w-0 overflow-hidden"
                    >
                        {/* Supplier and Due Date Summary Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-100 dark:border-primary-800 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                                    <IconBuildingStore size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Supplier</p>
                                    <p className="text-base font-bold text-slate-800 dark:text-white truncate">
                                        {payable.supplier?.name || "-"}
                                    </p>
                                    {payable.supplier?.phone && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {payable.supplier.phone}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-left sm:text-right shrink-0">
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Jatuh Tempo</p>
                                <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                                    {formatDate(payable.due_date)}
                                </p>
                                {isOverdue && (
                                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                                        ⚠️ Telah Melewati Jatuh Tempo
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 3 Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Tagihan</p>
                                <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1 break-words">
                                    {formatCurrency(payable.total)}
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/60">
                                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Sudah Dibayar</p>
                                <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 break-words">
                                    {formatCurrency(payable.paid)}
                                </p>
                            </div>
                            <div className={`p-3.5 rounded-xl ${
                                isOverdue
                                    ? "bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-800/60"
                                    : "bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/60"
                            }`}>
                                <p className={`text-xs font-medium ${isOverdue ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-400"}`}>
                                    Sisa Hutang
                                </p>
                                <p className={`text-lg sm:text-xl font-bold mt-1 break-words ${isOverdue ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-400"}`}>
                                    {formatCurrency(payable.remaining)}
                                </p>
                            </div>
                        </div>

                        {/* Riwayat Pembayaran */}
                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">
                                        Riwayat Pembayaran
                                    </p>
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {payable.payments?.length || 0}
                                    </span>
                                </div>
                                {payable.status !== "paid" && canPayPayable && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowForm(!showForm);
                                            if (!showForm) {
                                                setTimeout(() => {
                                                    document.getElementById("payment-form-section")?.scrollIntoView({ behavior: "smooth" });
                                                }, 100);
                                            }
                                        }}
                                        className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-primary-50 hover:bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800 transition-colors"
                                    >
                                        {showForm ? "Sembunyikan Form" : "+ Tambah Pembayaran"}
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2.5">
                                {payable.payments?.length ? (
                                    payable.payments.map((pay) => (
                                        <div
                                            key={pay.id}
                                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                        >
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                                        {formatCurrency(pay.amount)}
                                                    </p>
                                                    {pay.voucher_number && (
                                                        <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                                                            {pay.voucher_number}
                                                        </span>
                                                    )}
                                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                                        {pay.method === "bank_transfer" ? "Transfer" : "Tunai"}
                                                    </span>
                                                    {pay.bank_account && (
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            {pay.bank_account.bank_name} - {pay.bank_account.account_number}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {formatDate(pay.paid_at)} &bull; Dicatat oleh <span className="font-medium text-slate-700 dark:text-slate-300">{pay.user?.name || "-"}</span>
                                                </p>
                                                {pay.note && (
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white/60 dark:bg-slate-900/40 px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                                                        &ldquo;{pay.note}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-end gap-2 shrink-0">
                                                {canPayPayable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeletePayment(pay)}
                                                        title="Hapus Pembayaran"
                                                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                                    >
                                                        <IconTrash size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-6 text-center rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
                                        <IconReceipt size={28} className="mx-auto text-slate-400 mb-2" />
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                            Belum ada pembayaran untuk hutang ini.
                                        </p>
                                        {payable.status !== "paid" && canPayPayable && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowForm(true);
                                                    setTimeout(() => {
                                                        document.getElementById("payment-form-section")?.scrollIntoView({ behavior: "smooth" });
                                                    }, 100);
                                                }}
                                                className="mt-2 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                                            >
                                                Catat pembayaran sekarang &rarr;
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Detail Hutang & Payment Form */}
                    <div id="payment-form-section" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 print:hidden min-w-0 shadow-sm space-y-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                                Detail Hutang
                            </h2>
                            <div className="mt-3 space-y-2.5 text-xs sm:text-sm">
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Nomor Dokumen</span>
                                    <span className="font-semibold text-slate-800 dark:text-white font-mono">
                                        {payable.document_number}
                                    </span>
                                </div>
                                {payable.vendor_invoice_number && (
                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-500">No. Faktur Supplier</span>
                                        <span className="font-semibold text-slate-800 dark:text-white font-mono">
                                            {payable.vendor_invoice_number}
                                        </span>
                                    </div>
                                )}
                                {payable.purchase_order && (
                                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-500">Purchase Order</span>
                                        <Link
                                            href={route("purchase-orders.show", payable.purchase_order.id)}
                                            className="font-semibold text-primary-600 dark:text-primary-400 hover:underline font-mono"
                                        >
                                            {payable.purchase_order.document_number}
                                        </Link>
                                    </div>
                                )}
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Jatuh Tempo</span>
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {formatDate(payable.due_date)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500">Status</span>
                                    <span>{statusBadge(payable.status)}</span>
                                </div>
                                {payable.note && (
                                    <div className="py-1.5">
                                        <span className="text-slate-500 block mb-1">Catatan</span>
                                        <p className="text-slate-700 dark:text-slate-300 italic text-xs bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                            {payable.note}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment Form */}
                        {showForm && canPayPayable && (
                            <form onSubmit={submitPayment} className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">
                                        Form Pembayaran
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    >
                                        Batal
                                    </button>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            Nominal Pembayaran
                                        </label>
                                        {payable.remaining > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setData("amount", payable.remaining)}
                                                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                                            >
                                                Bayar Lunas
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        min="1"
                                        max={payable.remaining}
                                        value={data.amount}
                                        onChange={(e) => setData("amount", e.target.value)}
                                        placeholder="Contoh: 500000"
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:text-white"
                                        required
                                    />
                                    {errors.amount && (
                                        <p className="text-xs text-rose-500 mt-1">
                                            {errors.amount}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Tanggal Bayar
                                    </label>
                                    <input
                                        type="date"
                                        value={data.paid_at}
                                        onChange={(e) => setData("paid_at", e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Metode Pembayaran
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setData("method", "cash")}
                                            className={`h-11 rounded-xl border-2 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition-all ${
                                                data.method === "cash"
                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300"
                                                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            <IconCash size={16} />
                                            Tunai
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setData("method", "bank_transfer")}
                                            className={`h-11 rounded-xl border-2 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition-all ${
                                                data.method === "bank_transfer"
                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300"
                                                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            <IconCreditCard size={16} />
                                            Transfer
                                        </button>
                                    </div>
                                </div>

                                {data.method === "bank_transfer" && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Pilih Rekening Bank
                                        </label>
                                        <select
                                            value={data.bank_account_id}
                                            onChange={(e) => setData("bank_account_id", e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:text-white"
                                            required
                                        >
                                            <option value="">Pilih rekening</option>
                                            {bankAccounts.map((bank) => (
                                                <option key={bank.id} value={bank.id}>
                                                    {bank.bank_name} - {bank.account_number} ({bank.account_name})
                                                </option>
                                            ))}
                                        </select>
                                        {errors.bank_account_id && (
                                            <p className="text-xs text-rose-500 mt-1">
                                                {errors.bank_account_id}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Catatan (opsional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={data.note}
                                        onChange={(e) => setData("note", e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:text-white"
                                        placeholder="Contoh: Pembayaran termin 1 via transfer"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full h-11 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                                >
                                    <IconCheck size={18} />
                                    Simpan Pembayaran
                                </button>
                            </form>
                        )}

                        {/* Preview / PDF Trigger Button */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowPreview(true)}
                                className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                                <IconPrinter size={18} />
                                Preview Dokumen / PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal (Optimized for Mobile & Desktop) */}
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2.5 sm:p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                            <div className="min-w-0 pr-2">
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Preview Hutang</p>
                                <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white truncate">
                                    {payable.document_number}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <a
                                    href={route("pdf.payables.show", payable.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
                                >
                                    <IconPrinter size={16} />
                                    <span>PDF / Cetak</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setShowPreview(false)}
                                    className="inline-flex items-center gap-1 text-xs sm:text-sm px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors"
                                >
                                    <IconX size={16} />
                                    <span>Tutup</span>
                                </button>
                            </div>
                        </div>

                        {/* Modal Scrollable Body */}
                        <div className="p-3 sm:p-6 bg-slate-100/60 dark:bg-slate-950 overflow-y-auto flex-1">
                            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 print-area shadow-sm">
                                {/* Store Info & Document Header */}
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-11 h-11 sm:w-12 sm:h-12 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center overflow-hidden shrink-0 bg-slate-50 dark:bg-slate-800">
                                            {storeProfile?.logo ? (
                                                <img
                                                    src={storeProfile.logo}
                                                    alt={storeProfile.name}
                                                    className="w-full h-full object-contain p-1"
                                                />
                                            ) : (
                                                <span className="font-bold text-primary-600 dark:text-primary-400 text-lg">
                                                    {storeProfile?.name?.[0] || "T"}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                                                {storeProfile?.name || "Toko Rekasir"}
                                            </p>
                                            {storeProfile?.address && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                                    {storeProfile.address}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0">
                                        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Dokumen</span>
                                        <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white font-mono">
                                            {payable.document_number}
                                        </p>
                                        {payable.vendor_invoice_number && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                Faktur: {payable.vendor_invoice_number}
                                            </p>
                                        )}
                                        {payable.purchase_order && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                PO: {payable.purchase_order.document_number}
                                            </p>
                                        )}
                                        {payable.purchase_order?.warehouse && (
                                            <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                                                Unit: {payable.purchase_order.warehouse.name} ({payable.purchase_order.warehouse.code})
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Jatuh tempo: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(payable.due_date)}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Supplier & Status Bar */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 text-sm py-4 border-b border-slate-100 dark:border-slate-800">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Supplier</p>
                                        <p className="font-bold text-slate-800 dark:text-white mt-0.5">
                                            {payable.supplier?.name || "-"}
                                        </p>
                                        {payable.supplier?.phone && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {payable.supplier.phone}
                                            </p>
                                        )}
                                        {payable.supplier?.address && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {payable.supplier.address}
                                            </p>
                                        )}
                                    </div>
                                    <div className="sm:text-right flex flex-col sm:items-end justify-start">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                                        <div>{statusBadge(payable.status)}</div>
                                    </div>
                                </div>

                                {/* 3 Metric Cards - responsive 1 col on mobile, 3 cols on sm+ and print */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-2.5 sm:gap-3 my-4">
                                    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Tagihan</p>
                                        <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5 break-words">
                                            {formatCurrency(payable.total)}
                                        </p>
                                    </div>
                                    <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50">
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Sudah Dibayar</p>
                                        <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 break-words">
                                            {formatCurrency(payable.paid)}
                                        </p>
                                    </div>
                                    <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50">
                                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Sisa Hutang</p>
                                        <p className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 mt-0.5 break-words">
                                            {formatCurrency(payable.remaining)}
                                        </p>
                                    </div>
                                </div>

                                {/* Riwayat Pembayaran */}
                                <div className="mt-4 pt-2">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white mb-2.5">
                                        Riwayat Pembayaran ({payable.payments?.length || 0})
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        {payable.payments?.length ? (
                                            payable.payments.map((pay) => (
                                                <div
                                                    key={pay.id}
                                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-bold text-slate-800 dark:text-white">
                                                                {formatCurrency(pay.amount)}
                                                            </p>
                                                            {pay.voucher_number && (
                                                                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                                    {pay.voucher_number}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            {formatDate(pay.paid_at)} &bull; {pay.method === "bank_transfer" ? "Transfer" : "Tunai"}
                                                            {pay.bank_account && ` &bull; ${pay.bank_account.bank_name}`}
                                                        </p>
                                                        {pay.note && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">
                                                                Catatan: {pay.note}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                                        Dicatat: {pay.user?.name || "-"}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-slate-500 dark:text-slate-400 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                                                Belum ada catatan pembayaran.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: 0 !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>
        </>
    );
}

PayableShow.layout = (page) => <DashboardLayout children={page} />;
