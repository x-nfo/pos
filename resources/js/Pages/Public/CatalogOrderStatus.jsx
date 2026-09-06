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
} from "@tabler/icons-react";
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
    } catch (_) {}
    return `/katalog/order/${token}/check`;
};

export default function CatalogOrderStatus({ order: initialOrder, store }) {
    const [order, setOrder] = useState(initialOrder);
    const [refreshing, setRefreshing] = useState(false);
    const [lastChecked, setLastChecked] = useState(new Date());

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
                    }));
                }
            }
        } catch (_) {}
        setRefreshing(false);
        setLastChecked(new Date());
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
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                                        isCurrent
                                                            ? "bg-primary-600 text-white ring-4 ring-primary-500/20 shadow-md scale-110"
                                                            : isCompleted
                                                            ? "bg-primary-500 text-white"
                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
                                                    }`}
                                                >
                                                    {isCompleted ? <IconCheck size={14} /> : step.id}
                                                </div>
                                                <span
                                                    className={`text-[10px] sm:text-xs font-medium mt-2 max-w-[65px] sm:max-w-none leading-tight ${
                                                        isCurrent
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
                            Metode Pengambilan
                        </h3>
                        <div className="space-y-2 text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                                {order.delivery_method === "delivery" ? (
                                    <>
                                        <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
                                            <IconTruckDelivery size={16} />
                                        </div>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            Kirim ke Alamat Pemesan
                                        </span>
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

                            {order.delivery_method === "delivery" && order.delivery_address && (
                                <div className="pt-2 text-slate-700 dark:text-slate-300">
                                    <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-1">
                                        <IconMapPin size={14} className="shrink-0 mt-0.5" />
                                        <span>Alamat Tujuan:</span>
                                    </div>
                                    <p className="text-xs leading-relaxed bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        {order.delivery_address}
                                    </p>
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
                                            {item.qty} × {formatRupiah(item.price)}
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
                        {order.shipping_cost > 0 && (
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Ongkos Kirim</span>
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
        </div>
    );
}
