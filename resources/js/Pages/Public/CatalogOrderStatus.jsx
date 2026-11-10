import React, { useEffect, useState, useMemo } from "react";
import { Head, Link } from "@inertiajs/react";
import {
    IconCheck,
    IconClock,
    IconX,
    IconRefresh,
    IconBrandWhatsapp,
    IconTruckDelivery,
    IconBuildingStore,
    IconMapPin,
    IconArrowLeft,
    IconAlertCircle,
    IconChefHat,
    IconPackage,
    IconNotes,
    IconCopy,
    IconBarcode,
    IconBuildingBank,
    IconUpload,
    IconEye,
    IconTicket,
    IconFileText,
    IconExternalLink,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { formatRupiah, openWhatsAppOrder } from "@/Utils/whatsappOrder";

const STATUS_CONFIG = {
    submitted: {
        step: 1,
        label: "Menunggu Konfirmasi",
        badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
        icon: IconClock,
        desc: "Pesanan Anda telah diterima sistem dan sedang menunggu konfirmasi staf toko.",
    },
    confirmed: {
        step: 2,
        label: "Dikonfirmasi Toko",
        badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
        icon: IconCheck,
        desc: "Pesanan telah dikonfirmasi oleh toko dan stok barang telah disiapkan.",
    },
    processing: {
        step: 3,
        label: "Sedang Disiapkan",
        badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
        icon: IconPackage,
        desc: "Produk pesanan Anda sedang dikemas dengan rapi oleh staf.",
    },
    ready: {
        step: 4,
        label: "Siap / Sedang Dikirim",
        badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800",
        icon: IconTruckDelivery,
        desc: "Pesanan Anda siap untuk diambil di toko atau sedang dalam perjalanan ke alamat.",
    },
    completed: {
        step: 5,
        label: "Selesai",
        badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
        icon: IconCheck,
        desc: "Pesanan telah selesai diterima. Terima kasih telah berbelanja bersama kami!",
    },
    cancelled: {
        step: 0,
        label: "Dibatalkan",
        badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
        icon: IconX,
        desc: "Pesanan ini telah dibatalkan.",
    },
};

const STEPS = [
    { id: 1, key: "submitted", label: "Pesanan Masuk" },
    { id: 2, key: "confirmed", label: "Dikonfirmasi" },
    { id: 3, key: "processing", label: "Disiapkan" },
    { id: 4, key: "ready", label: "Siap / Dikirim" },
    { id: 5, key: "completed", label: "Selesai" },
];

const resolveStatusCheckUrl = (token) => {
    try {
        if (typeof route === "function" && route().has("catalog.order.status-check")) {
            return route("catalog.order.status-check", token);
        }
    } catch (_) { }
    return `/katalog/order/${token}/check`;
};

export default function CatalogOrderStatus({ order: initialOrder, store, bankAccounts = [] }) {
    const [order, setOrder] = useState(initialOrder);
    const [refreshing, setRefreshing] = useState(false);
    const [lastChecked, setLastChecked] = useState(new Date());
    const [isViewingProof, setIsViewingProof] = useState(false);
    const [uploadingProof, setUploadingProof] = useState(false);

    const handleUploadNewProof = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!validTypes.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|pdf)$/i)) {
            toast.error("Bukti transfer harus berupa file gambar (JPG, PNG, WEBP) atau PDF");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Ukuran file maksimal 5 MB");
            return;
        }

        const formData = new FormData();
        formData.append("payment_proof", file);

        setUploadingProof(true);
        const toastId = toast.loading("Mengunggah bukti transfer...");

        try {
            const uploadUrl = typeof route === "function" && route().has("catalog.order.payment-proof")
                ? route("catalog.order.payment-proof", order.access_token)
                : `/katalog/order/${order.access_token}/payment-proof`;

            const res = await fetch(uploadUrl, {
                method: "POST",
                body: formData,
                headers: {
                    Accept: "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN": document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "",
                },
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Bukti transfer berhasil diunggah!", { id: toastId });
                setOrder((prev) => ({
                    ...prev,
                    payment_proof_url: data.payment_proof_url,
                    payment_proof_is_pdf: data.payment_proof_is_pdf ?? isPdf,
                    payment_proof_uploaded_at: data.payment_proof_uploaded_at,
                }));
            } else {
                toast.error(data.message || "Gagal mengunggah bukti transfer", { id: toastId });
            }
        } catch (_) {
            toast.error("Terjadi kesalahan saat mengunggah", { id: toastId });
        } finally {
            setUploadingProof(false);
        }
    };

    const isFinalState = order.status === "completed" || order.status === "cancelled";

    // Polling live status check every 6 seconds if order is active
    useEffect(() => {
        if (isFinalState) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(
                    resolveStatusCheckUrl(order.access_token),
                    { headers: { Accept: "application/json" } }
                );
                if (!res.ok) return;
                const data = await res.json();
                if (data.success && data.order) {
                    setOrder((prev) => ({
                        ...prev,
                        status: data.order.status,
                        cancellation_reason: data.order.cancellation_reason,
                        confirmed_at: data.order.confirmed_at,
                        completed_at: data.order.completed_at,
                        cancelled_at: data.order.cancelled_at,
                    }));
                    setLastChecked(new Date());
                }
            } catch (e) {
                // Ignore network error on polling
            }
        }, 6000);

        return () => clearInterval(interval);
    }, [isFinalState, order.access_token]);

    const handleManualRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await fetch(
                resolveStatusCheckUrl(order.access_token),
                { headers: { Accept: "application/json" } }
            );
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.order) {
                    setOrder((prev) => ({
                        ...prev,
                        status: data.order.status,
                        cancellation_reason: data.order.cancellation_reason,
                        confirmed_at: data.order.confirmed_at,
                        completed_at: data.order.completed_at,
                        cancelled_at: data.order.cancelled_at,
                        shipping_tracking_number: data.order.shipping_tracking_number || prev.shipping_tracking_number,
                    }));
                }
            }
        } catch (_) { }
        setRefreshing(false);
        setLastChecked(new Date());
    };

    const handleCopyTrackingNumber = () => {
        if (!order.shipping_tracking_number) return;
        try {
            navigator.clipboard.writeText(order.shipping_tracking_number);
            toast.success("Nomor resi berhasil disalin!");
        } catch (_) {
            toast.error("Gagal menyalin nomor resi");
        }
    };

    const currentStatus = STATUS_CONFIG[order.status] || STATUS_CONFIG.submitted;
    const StatusIcon = currentStatus.icon;

    const handleWhatsAppStore = () => {
        const message = `Halo ${store.name || "Toko"}, saya ingin menanyakan status pesanan saya:\n\n*No. Pesanan:* ${order.order_number}\n*Nama Pemesan:* ${order.customer_name}\n*Total Tagihan:* ${formatRupiah(order.grand_total)}\n*Status Saat Ini:* ${currentStatus.label}\n\nLink Pelacakan: ${window.location.href}\n\nTerima kasih! 🙏`;
        openWhatsAppOrder({
            phone: order.warehouse?.phone || store.wa_number || store.phone,
            message,
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
            <Head title={`Status Pesanan ${order.order_number} — ${store.name || "Toko"}`} />

            {/* Header / Brand Top Bar */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
                    <Link
                        href={route("catalog.index")}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition"
                    >
                        <IconArrowLeft size={16} />
                        <span>Katalog Produk</span>
                    </Link>

                    <div className="flex items-center gap-2">
                        {store.logo && (
                            <img
                                src={store.logo}
                                alt={store.name}
                                className="h-6 sm:h-7 w-auto object-contain rounded"
                            />
                        )}
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate max-w-[160px] sm:max-w-[240px]">
                            {store.name || "Toko Online"}
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
                {/* Hero Order Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 shadow-xs relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Nomor Pesanan Resmi
                            </span>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                {order.order_number}
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Cabang: <span className="font-semibold text-slate-700 dark:text-slate-300">{order.warehouse?.name || "Toko Utama"}</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                            <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${currentStatus.badgeColor}`}
                            >
                                <StatusIcon size={14} />
                                {currentStatus.label}
                            </span>
                        </div>
                    </div>

                    {/* Stepper Progress (Hidden if cancelled) */}
                    {order.status !== "cancelled" ? (
                        <div className="py-6">
                            <div className="relative">
                                {/* Track Line */}
                                <div className="absolute top-4 left-4 right-4 h-1 bg-slate-100 dark:bg-slate-800 -z-0">
                                    <div
                                        className="h-full bg-primary-600 transition-all duration-700 ease-out rounded-full"
                                        style={{
                                            width: `${Math.min(
                                                100,
                                                ((currentStatus.step - 1) / (STEPS.length - 1)) * 100
                                            )}%`,
                                        }}
                                    />
                                </div>

                                {/* Step Circles */}
                                <div className="relative z-10 flex justify-between">
                                    {STEPS.map((step) => {
                                        const isCompleted = step.id <= currentStatus.step;
                                        const isCurrent = step.id === currentStatus.step;

                                        return (
                                            <div
                                                key={step.id}
                                                className="flex flex-col items-center text-center"
                                            >
                                                <div
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCurrent
                                                        ? "bg-primary-600 text-white ring-4 ring-primary-500/20 shadow-md scale-110"
                                                        : isCompleted
                                                            ? "bg-primary-500 text-white"
                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
                                                        }`}
                                                >
                                                    {isCompleted ? <IconCheck size={14} /> : step.id}
                                                </div>
                                                <span
                                                    className={`text-[10px] sm:text-xs font-medium mt-2 max-w-[65px] sm:max-w-none leading-tight ${isCurrent
                                                        ? "text-primary-700 dark:text-primary-400 font-bold"
                                                        : isCompleted
                                                            ? "text-slate-700 dark:text-slate-300"
                                                            : "text-slate-400 dark:text-slate-600"
                                                        }`}
                                                >
                                                    {step.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <p className="text-xs sm:text-sm text-center text-slate-600 dark:text-slate-400 mt-6 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                {currentStatus.desc}
                            </p>
                        </div>
                    ) : (
                        <div className="py-5">
                            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-800 dark:text-rose-300">
                                <IconAlertCircle size={20} className="shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-sm">Pesanan Dibatalkan</h4>
                                    <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-400">
                                        Alasan: {order.cancellation_reason || "Dibatalkan oleh staf atau permintaan pemesan."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Auto Refresh Info & Manual Button */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <span>
                            {!isFinalState ? "Pembaruan otomatis tiap beberapa detik" : "Status pesanan sudah final"}
                        </span>
                        <button
                            type="button"
                            onClick={handleManualRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 hover:text-primary-600 transition"
                        >
                            <IconRefresh
                                size={13}
                                className={refreshing ? "animate-spin text-primary-600" : ""}
                            />
                            Refresh Status
                        </button>
                    </div>
                </div>

                {/* Delivery and Customer Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Customer Info Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                            Data Pemesan
                        </h3>
                        <div className="space-y-2 text-xs sm:text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Nama:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{order.customer_name}</span>
                            </div>
                            {order.customer_phone && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">No. WhatsApp:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{order.customer_phone}</span>
                                </div>
                            )}
                            {order.notes && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-500 block mb-0.5">Catatan:</span>
                                    <p className="text-slate-700 dark:text-slate-300 italic">"{order.notes}"</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Delivery Method Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                            Metode Pengambilan & Pengiriman
                        </h3>
                        <div className="space-y-3 text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                                {order.delivery_method === "delivery" ? (
                                    <>
                                        <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
                                            <IconTruckDelivery size={16} />
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">
                                                Kirim via Ekspedisi / Kurir
                                            </span>
                                            {order.shipping_courier && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                                                    {order.shipping_courier.toUpperCase()} {order.shipping_service || ""}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                            <IconBuildingStore size={16} />
                                        </div>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            Ambil Sendiri di Toko
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Resi Tracking Badge */}
                            {order.delivery_method === "delivery" && order.shipping_tracking_number && (
                                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                                            <IconBarcode size={16} className="shrink-0" />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider">
                                                Nomor Resi:
                                            </span>
                                            <span className="font-mono font-bold text-xs">
                                                {order.shipping_tracking_number}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleCopyTrackingNumber}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-[10px] font-bold hover:bg-amber-300 transition cursor-pointer"
                                            title="Salin Resi"
                                        >
                                            <IconCopy size={12} />
                                            Salin
                                        </button>
                                    </div>
                                </div>
                            )}

                            {order.delivery_method === "delivery" && (
                                <div className="space-y-1.5 pt-1 text-slate-700 dark:text-slate-300">
                                    {order.shipping_destination_label && (
                                        <div className="flex items-start gap-1.5 text-xs text-slate-500">
                                            <IconMapPin size={14} className="shrink-0 mt-0.5 text-primary-500" />
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                {order.shipping_destination_label}
                                            </span>
                                        </div>
                                    )}

                                    {order.delivery_address && (
                                        <p className="text-xs leading-relaxed bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                            {order.delivery_address}
                                        </p>
                                    )}

                                    {order.shipping_etd && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                            <IconClock size={13} />
                                            <span>Estimasi Tiba: <strong>{order.shipping_etd} Hari Kerja</strong></span>
                                            {order.shipping_weight > 0 && (
                                                <span className="text-slate-400">· Berat: {order.shipping_weight}g</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {order.delivery_method === "pickup" && order.warehouse?.address && (
                                <div className="pt-2 text-slate-700 dark:text-slate-300">
                                    <span className="text-xs text-slate-500 block mb-1">Lokasi Toko:</span>
                                    <p className="text-xs leading-relaxed bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        {order.warehouse.address}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Pembayaran & Bukti Transfer */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400 flex items-center justify-center shrink-0">
                                <IconBuildingBank size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                                    Pembayaran & Bukti Transfer
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Metode: Transfer Bank
                                </p>
                            </div>
                        </div>

                        {order.payment_proof_url ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <IconCheck size={13} />
                                Bukti Terlampir
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <IconClock size={13} />
                                Belum Ada Bukti
                            </span>
                        )}
                    </div>

                    <div className="space-y-4">
                        {order.bank_account && (
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
                                <div>
                                    <span className="text-[11px] text-slate-500 block">Rekening Toko Tujuan:</span>
                                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                                        {order.bank_account.bank_name} - {order.bank_account.account_number}
                                    </span>
                                    <span className="text-slate-500 block text-[11px] mt-0.5">
                                        a/n {order.bank_account.account_name}
                                    </span>
                                </div>
                            </div>
                        )}

                        {order.payment_proof_url ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        onClick={() => setIsViewingProof(true)}
                                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer group shrink-0 flex items-center justify-center bg-rose-50 dark:bg-rose-950/30 text-rose-600"
                                    >
                                        {(order.payment_proof_is_pdf || order.payment_proof?.toLowerCase().endsWith(".pdf")) ? (
                                            <IconFileText size={28} />
                                        ) : (
                                            <img
                                                src={order.payment_proof_url}
                                                alt="Bukti Transfer"
                                                className="w-full h-full object-cover group-hover:scale-105 transition"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                            <IconEye size={16} />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                            {(order.payment_proof_is_pdf || order.payment_proof?.toLowerCase().endsWith(".pdf"))
                                                ? "Dokumen Bukti Transfer (PDF)"
                                                : "Foto Bukti Transfer"}
                                        </span>
                                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                            {order.payment_proof_uploaded_at
                                                ? `Diunggah: ${new Date(order.payment_proof_uploaded_at).toLocaleString("id-ID")}`
                                                : "Tersimpan di sistem"}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setIsViewingProof(true)}
                                            className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer"
                                        >
                                            <IconEye size={13} />
                                            {(order.payment_proof_is_pdf || order.payment_proof?.toLowerCase().endsWith(".pdf"))
                                                ? "Lihat Dokumen PDF"
                                                : "Lihat Foto Penuh"}
                                        </button>
                                    </div>
                                </div>

                                {order.status === "submitted" && (
                                    <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer self-start sm:self-auto shrink-0">
                                        <IconUpload size={14} />
                                        <span>{uploadingProof ? "Mengunggah..." : "Ganti Bukti Transfer"}</span>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/jpg,image/webp,application/pdf"
                                            disabled={uploadingProof}
                                            onChange={handleUploadNewProof}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-center space-y-2">
                                <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
                                    Belum ada bukti transfer terlampir untuk pesanan ini.
                                </p>
                                {order.status === "submitted" && (
                                    <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition cursor-pointer">
                                        <IconUpload size={14} />
                                        <span>{uploadingProof ? "Mengunggah..." : "Unggah Bukti Transfer Sekarang"}</span>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/jpg,image/webp,application/pdf"
                                            disabled={uploadingProof}
                                            onChange={handleUploadNewProof}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Ordered Items Breakdown */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                        Rincian Barang Belanjaan
                    </h3>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {order.items.map((item) => (
                            <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                                        {item.image ? (
                                            <img
                                                src={item.image.startsWith("http") ? item.image : `/storage/${item.image}`}
                                                alt={item.product_title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <IconPackage size={20} className="text-slate-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                            {item.product_title}
                                        </h4>
                                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                                            {item.qty} {item.unit?.name || item.unit?.symbol || ""} × {formatRupiah(item.price)}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right shrink-0">
                                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                                        {formatRupiah(item.subtotal)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary Totals */}
                    <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs sm:text-sm">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                            <span>Subtotal Belanja</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{formatRupiah(order.subtotal)}</span>
                        </div>
                        {order.discount_amount > 0 && (
                            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                <span className="flex items-center gap-1.5">
                                    <IconTicket size={14} />
                                    <span>Diskon Kupon {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                                </span>
                                <span className="font-semibold">-{formatRupiah(order.discount_amount)}</span>
                            </div>
                        )}
                        {order.shipping_cost > 0 && (
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>
                                    Ongkos Kirim
                                    {order.shipping_courier && (
                                        <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                                            ({order.shipping_courier.toUpperCase()} {order.shipping_service || ""})
                                        </span>
                                    )}
                                </span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatRupiah(order.shipping_cost)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm sm:text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span>Total Tagihan</span>
                            <span className="text-primary-600 dark:text-primary-400">{formatRupiah(order.grand_total)}</span>
                        </div>
                    </div>
                </div>

                {/* WhatsApp Action Footer */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 rounded-2xl sm:rounded-3xl border border-emerald-200/80 dark:border-emerald-900/40 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                        <h4 className="font-bold text-sm sm:text-base text-emerald-900 dark:text-emerald-300">
                            Ada pertanyaan atau ingin konfirmasi cepat?
                        </h4>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                            Hubungi layanan WhatsApp toko kami dengan menyertakan nomor pesanan Anda.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleWhatsAppStore}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-98 transition shrink-0 cursor-pointer"
                    >
                        <IconBrandWhatsapp size={18} />
                        Chat WhatsApp Toko
                    </button>
                </div>
            </main>

            {/* Modal Zoom Foto / Dokumen PDF Bukti Transfer */}
            {isViewingProof && order.payment_proof_url && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs"
                    onClick={() => setIsViewingProof(false)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-4 overflow-hidden shadow-2xl relative border border-slate-200 dark:border-slate-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                            <div>
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                    Bukti Transfer Pembayaran
                                </h4>
                                <p className="text-[11px] text-slate-400">
                                    {order.order_number} · {order.customer_name}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsViewingProof(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <IconX size={18} />
                            </button>
                        </div>
                        {(order.payment_proof_is_pdf || order.payment_proof?.toLowerCase().endsWith(".pdf")) ? (
                            <div className="w-full space-y-3">
                                <iframe
                                    src={order.payment_proof_url}
                                    title="Dokumen Bukti Transfer PDF"
                                    className="w-full h-[60vh] rounded-xl border border-slate-200 dark:border-slate-800"
                                />
                                <div className="flex justify-end">
                                    <a
                                        href={order.payment_proof_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary-600 text-white hover:bg-primary-700 transition"
                                    >
                                        <IconExternalLink size={14} />
                                        Buka di Tab Baru
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="max-h-[70vh] overflow-auto flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-950 p-2">
                                <img
                                    src={order.payment_proof_url}
                                    alt="Bukti Transfer Penuh"
                                    className="max-w-full max-h-[65vh] object-contain rounded-lg"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
