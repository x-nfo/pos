import React, { useEffect, useState, useRef } from "react";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconArrowLeft,
    IconCreditCard,
    IconBrandWhatsapp,
    IconCash,
    IconPrinter,
    IconCheck,
    IconX,
    IconClock,
    IconAlertCircle,
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

export default function ReceivableShow({ receivable, bankAccounts = [], approvalThreshold = 1000000 }) {
    const { flash, storeProfile, auth } = usePage().props;
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
    const collectionNotesForm = useForm({
        collection_notes: receivable.collection_notes || "",
    });
    const canPayReceivable = can("receivables-pay");
    const canApprove = can("receivables-approve") || can("super-admin");
    const canCreateCrmCampaign = can("crm-campaigns-create");

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const shareText = `Invoice ${receivable.invoice} - Total ${formatCurrency(
        receivable.total
    )} - Sisa ${formatCurrency(receivable.remaining)}`;

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

    const paymentStatusBadge = (status) => {
        switch (status) {
            case "pending":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <IconClock size={12} />
                        Menunggu Approval
                    </span>
                );
            case "rejected":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">
                        <IconX size={12} />
                        Ditolak
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                        <IconCheck size={12} />
                        Disetujui
                    </span>
                );
        }
    };

    const handleApprove = (payment) => {
        Swal.fire({
            title: "Setujui Pembayaran?",
            text: `Apakah Anda yakin ingin menyetujui pembayaran senilai ${formatCurrency(payment.amount)}?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Setujui",
            cancelButtonText: "Batal",
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(
                    route("receivables.payments.approve", payment.id),
                    {},
                    {
                        preserveScroll: true,
                        onSuccess: () => toast.success("Pembayaran berhasil disetujui"),
                        onError: (errs) => toast.error(errs?.message || "Gagal menyetujui pembayaran"),
                    }
                );
            }
        });
    };

    const handleReject = (payment) => {
        Swal.fire({
            title: "Tolak Pembayaran",
            text: `Masukkan alasan penolakan pembayaran senilai ${formatCurrency(payment.amount)}:`,
            input: "textarea",
            inputPlaceholder: "Contoh: Bukti transfer belum masuk mutasi rekening...",
            inputAttributes: {
                "aria-label": "Alasan penolakan",
                required: "true",
            },
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Tolak Pembayaran",
            cancelButtonText: "Batal",
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return "Alasan penolakan wajib diisi!";
                }
            },
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                router.post(
                    route("receivables.payments.reject", payment.id),
                    { approval_notes: result.value },
                    {
                        preserveScroll: true,
                        onSuccess: () => toast.success("Pembayaran berhasil ditolak"),
                        onError: (errs) => toast.error(errs?.message || "Gagal menolak pembayaran"),
                    }
                );
            }
        });
    };

    const statusBadge = (value) => {
        const base = "px-2 py-1 text-xs font-semibold rounded-full";
        switch (value) {
            case "paid":
                return (
                    <span className={`${base} bg-success-100 text-success-700`}>
                        Lunas
                    </span>
                );
            case "partial":
                return (
                    <span className={`${base} bg-primary-100 text-primary-700`}>
                        Parsial
                    </span>
                );
            case "overdue":
                return (
                    <span className={`${base} bg-rose-100 text-rose-700`}>
                        Jatuh Tempo
                    </span>
                );
            default:
                return (
                    <span className={`${base} bg-amber-100 text-amber-700`}>
                        Belum Lunas
                    </span>
                );
        }
    };

    const submitPayment = (e) => {
        e.preventDefault();
        post(route("receivables.pay", receivable.id), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setShowForm(false);
            },
        });
    };

    const submitCollectionNotes = (e) => {
        e.preventDefault();
        collectionNotesForm.patch(
            route("receivables.collection-notes", receivable.id),
            {
                preserveScroll: true,
                onSuccess: () => toast.success("Catatan penagihan berhasil disimpan"),
                onError: () => toast.error("Gagal menyimpan catatan penagihan"),
            }
        );
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        window.print();
    };

    return (
        <>
            <Head title={`Nota ${receivable.invoice}`} />
            <div className="space-y-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Link
                            href={route("receivables.index")}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <IconArrowLeft size={18} />
                            Kembali
                        </Link>
                        <div>
                            <p className="text-xs text-slate-500">Invoice</p>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                {receivable.invoice}
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {canCreateCrmCampaign && (
                            <Link
                                href={route(
                                    "receivables.share-campaign",
                                    receivable.id
                                )}
                                method="post"
                                as="button"
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
                            >
                                <IconBrandWhatsapp size={18} />
                                Campaign
                            </Link>
                        )}
                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
                        >
                            <IconBrandWhatsapp size={18} />
                            Share WA
                        </a>
                        <div>{statusBadge(receivable.status)}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div
                        ref={printRef}
                        className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 print:border-0 print:shadow-none"
                    >
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500">Pelanggan</p>
                                <p className="font-semibold text-slate-800 dark:text-white">
                                    {receivable.customer?.name || "Umum"}
                                </p>
                                {receivable.customer?.phone && (
                                    <p className="text-xs text-slate-500">
                                        {receivable.customer.phone}
                                    </p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-slate-500">Jatuh Tempo</p>
                                <p className="font-semibold text-slate-800 dark:text-white">
                                    {formatDate(receivable.due_date)}
                                </p>
                            </div>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500">Total</p>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(receivable.total)}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500">Terbayar</p>
                                <p className="text-lg font-bold text-success-600">
                                    {formatCurrency(receivable.paid)}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                                <p className="text-xs text-amber-700">Sisa</p>
                                <p className="text-lg font-bold text-amber-700">
                                    {formatCurrency(receivable.remaining)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Riwayat Pembayaran
                            </p>
                            {receivable.status !== "paid" && canPayReceivable && (
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="px-3 py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                                >
                                    Tambah Pembayaran
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {receivable.payments?.length ? (
                                receivable.payments.map((pay) => (
                                    <div
                                        key={pay.id}
                                        className={`p-3.5 rounded-xl border ${pay.status === "pending"
                                            ? "border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20"
                                            : pay.status === "rejected"
                                                ? "border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20 opacity-80"
                                                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                            } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                    {formatCurrency(pay.amount)}
                                                </p>
                                                {paymentStatusBadge(pay.status || "approved")}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {formatDate(pay.paid_at)} • {pay.method === "bank_transfer" ? "Transfer Bank" : pay.method}
                                                {pay.bank_account && ` • ${pay.bank_account.bank_name}`}
                                                {pay.user?.name && ` • Oleh: ${pay.user.name}`}
                                            </p>
                                            {pay.note && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                                                    Catatan: {pay.note}
                                                </p>
                                            )}
                                            {pay.approver && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {pay.status === "approved" ? "Disetujui" : "Diproses"} oleh:{" "}
                                                    <span className="font-semibold">{pay.approver.name}</span>
                                                    {pay.approved_at && ` (${formatDate(pay.approved_at)})`}
                                                </p>
                                            )}
                                            {pay.status === "rejected" && pay.approval_notes && (
                                                <div className="mt-1 p-2 rounded-lg bg-rose-100/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
                                                    <span className="font-semibold">Alasan Penolakan:</span> {pay.approval_notes}
                                                </div>
                                            )}
                                        </div>

                                        {pay.status === "pending" && canApprove && (
                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                <button
                                                    onClick={() => handleApprove(pay)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition shadow-sm"
                                                    title="Setujui pembayaran"
                                                >
                                                    <IconCheck size={14} />
                                                    Setujui
                                                </button>
                                                <button
                                                    onClick={() => handleReject(pay)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 transition shadow-sm"
                                                    title="Tolak pembayaran"
                                                >
                                                    <IconX size={14} />
                                                    Tolak
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-slate-500">
                                    Belum ada pembayaran.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 print:hidden">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3">
                            Detail Nota
                        </p>
                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <div className="flex justify-between">
                                <span>Invoice</span>
                                <span className="font-semibold text-slate-800 dark:text-white">
                                    {receivable.invoice}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Jatuh Tempo</span>
                                <span>{formatDate(receivable.due_date)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Status</span>
                                <span>{statusBadge(receivable.status)}</span>
                            </div>
                            {receivable.transaction_id && (
                                <div className="flex justify-between">
                                    <span>ID Transaksi</span>
                                    <Link
                                        href={route("transactions.print", receivable.invoice)}
                                        className="text-primary-600 font-semibold"
                                    >
                                        Lihat
                                    </Link>
                                </div>
                            )}
                        </div>

                        <form onSubmit={submitCollectionNotes} className="mt-4 space-y-3">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Catatan Penagihan
                            </label>
                            <textarea
                                rows={3}
                                value={collectionNotesForm.data.collection_notes}
                                onChange={(e) =>
                                    collectionNotesForm.setData("collection_notes", e.target.value)
                                }
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                placeholder="Catatan proses penagihan..."
                            />
                            {collectionNotesForm.errors.collection_notes && (
                                <p className="text-xs text-danger-500">
                                    {collectionNotesForm.errors.collection_notes}
                                </p>
                            )}
                            {collectionNotesForm.wasSuccessful && (
                                <p className="text-xs text-success-500">Tersimpan!</p>
                            )}
                            <button
                                type="submit"
                                disabled={collectionNotesForm.processing}
                                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                                {collectionNotesForm.processing ? "Menyimpan..." : "Simpan Catatan"}
                            </button>
                        </form>

                        {showForm && canPayReceivable && (
                            <form onSubmit={submitPayment} className="mt-4 space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        Nominal
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={data.amount}
                                        onChange={(e) => setData("amount", e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        required
                                    />
                                    {errors.amount && (
                                        <p className="text-xs text-danger-500 mt-1">
                                            {errors.amount}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        Tanggal Bayar
                                    </label>
                                    <input
                                        type="date"
                                        value={data.paid_at}
                                        onChange={(e) => setData("paid_at", e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setData("method", "cash")}
                                        className={`h-11 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-semibold ${data.method === "cash"
                                            ? "border-primary-500 bg-primary-50 text-primary-700"
                                            : "border-slate-200 dark:border-slate-700"
                                            }`}
                                    >
                                        <IconCash size={16} />
                                        Tunai
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setData("method", "bank_transfer")}
                                        className={`h-11 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-semibold ${data.method === "bank_transfer"
                                            ? "border-primary-500 bg-primary-50 text-primary-700"
                                            : "border-slate-200 dark:border-slate-700"
                                            }`}
                                    >
                                        <IconCreditCard size={16} />
                                        Transfer
                                    </button>
                                </div>
                                {data.method === "bank_transfer" && (
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            Rekening
                                        </label>
                                        <select
                                            value={data.bank_account_id}
                                            onChange={(e) =>
                                                setData("bank_account_id", e.target.value)
                                            }
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        >
                                            <option value="">Pilih rekening</option>
                                            {bankAccounts.map((bank) => (
                                                <option key={bank.id} value={bank.id}>
                                                    {bank.bank_name} - {bank.account_number}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        Catatan (opsional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={data.note}
                                        onChange={(e) => setData("note", e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        placeholder="Catatan pembayaran"
                                    />
                                </div>

                                {(data.method !== "cash" || (Number(data.amount) >= approvalThreshold && Number(data.amount) > 0)) && (
                                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                        <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                                        <span>
                                            Pembayaran ini akan berstatus <strong>Menunggu Persetujuan (Pending)</strong> dari Supervisor/Manager karena{" "}
                                            {data.method !== "cash"
                                                ? "menggunakan metode non-tunai."
                                                : `nominal mencapai/melebihi ${formatCurrency(approvalThreshold)}.`}
                                        </span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full h-11 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    Simpan Pembayaran
                                </button>
                            </form>
                        )}

                        <div className="mt-4">
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => setShowPreview(true)}
                                    className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2"
                                >
                                    <IconPrinter size={18} />
                                    Preview / PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl relative overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <p className="text-xs text-slate-500">Preview Nota Barang</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                    {receivable.invoice}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={route("pdf.receivables.show", receivable.id)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold"
                                >
                                    <IconPrinter size={16} />
                                    PDF / Cetak
                                </a>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="text-sm px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-900">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 print-area">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 border border-slate-200 rounded-md flex items-center justify-center overflow-hidden">
                                            {storeProfile?.logo ? (
                                                <img
                                                    src={storeProfile.logo}
                                                    alt={storeProfile.name}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            ) : (
                                                <span className="font-bold text-primary-600">
                                                    {storeProfile?.name?.[0] || "T"}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                {storeProfile?.name}
                                            </p>
                                            {storeProfile?.address && (
                                                <p className="text-xs text-slate-500">{storeProfile.address}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500">Invoice</p>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                                            {receivable.invoice}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Jatuh tempo: {formatDate(receivable.due_date)}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                    <div>
                                        <p className="text-slate-500">Pelanggan</p>
                                        <p className="font-semibold text-slate-800 dark:text-white">
                                            {receivable.customer?.name || "Umum"}
                                        </p>
                                        {receivable.customer?.phone && (
                                            <p className="text-xs text-slate-500">
                                                {receivable.customer.phone}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-500">Status</p>
                                        <p className="font-semibold text-slate-800 dark:text-white">
                                            {statusBadge(receivable.status)}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <p className="text-xs text-slate-500">Total</p>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(receivable.total)}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <p className="text-xs text-slate-500">Terbayar</p>
                                        <p className="text-lg font-bold text-success-600">
                                            {formatCurrency(receivable.paid)}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                                        <p className="text-xs text-amber-700">Sisa</p>
                                        <p className="text-lg font-bold text-amber-700">
                                            {formatCurrency(receivable.remaining)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                                        Riwayat Pembayaran
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        {receivable.payments?.length ? (
                                            receivable.payments.map((pay) => (
                                                <div
                                                    key={pay.id}
                                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                                >
                                                    <div>
                                                        <p className="font-semibold text-slate-800 dark:text-white">
                                                            {formatCurrency(pay.amount)}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {formatDate(pay.paid_at)} • {pay.method || "metode"}
                                                            {pay.bank_account && ` • ${pay.bank_account.bank_name}`}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-slate-500">
                                                        {pay.user?.name || "-"}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-slate-500">
                                                Belum ada pembayaran.
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
                    }
                }
            `}</style>
        </>
    );
}

ReceivableShow.layout = (page) => <DashboardLayout children={page} />;
