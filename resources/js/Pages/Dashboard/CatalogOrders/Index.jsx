import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router, Link } from "@inertiajs/react";
import {
    IconSearch,
    IconClock,
    IconCheck,
    IconX,
    IconPackage,
    IconTruckDelivery,
    IconBuildingStore,
    IconBrandWhatsapp,
    IconExternalLink,
    IconShoppingCart,
    IconAlertCircle,
    IconFilter,
    IconEye,
} from "@tabler/icons-react";
import { useAuthorization } from "@/Utils/authorization";
import { formatRupiah, cleanWhatsAppNumber } from "@/Utils/whatsappOrder";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import Pagination from "@/Components/Dashboard/Pagination";

const STATUS_MAP = {
    submitted: {
        label: "Menunggu Konfirmasi",
        badge: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
        icon: IconClock,
    },
    confirmed: {
        label: "Dikonfirmasi",
        badge: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
        icon: IconCheck,
    },
    processing: {
        label: "Sedang Disiapkan",
        badge: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900",
        icon: IconPackage,
    },
    ready: {
        label: "Siap / Dikirim",
        badge: "bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900",
        icon: IconTruckDelivery,
    },
    completed: {
        label: "Selesai",
        badge: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
        icon: IconCheck,
    },
    cancelled: {
        label: "Dibatalkan",
        badge: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
        icon: IconX,
    },
};

export default function Index({ orders, metrics, warehouses, filters }) {
    const { can } = useAuthorization();
    const canProcess = can("catalog-orders-process");

    const [selectedOrder, setSelectedOrder] = useState(null);
    const [cancelModalOrder, setCancelModalOrder] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [searchTerm, setSearchTerm] = useState(filters.q || "");

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(
            route("catalog-orders.index"),
            { ...filters, q: searchTerm },
            { preserveState: true, replace: true }
        );
    };

    const handleStatusTab = (status) => {
        router.get(
            route("catalog-orders.index"),
            { ...filters, status, page: 1 },
            { preserveState: true }
        );
    };

    const handleConfirm = (order) => {
        Swal.fire({
            title: "Konfirmasi Pesanan?",
            text: `Terima pesanan ${order.order_number}? Stok barang cabang akan langsung dipotong.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Terima Pesanan",
            cancelButtonText: "Batal",
            customClass: {
                popup: "rounded-2xl dark:bg-slate-900 dark:text-white",
            },
        }).then((result) => {
            if (!result.isConfirmed) return;

            router.post(
                route("catalog-orders.confirm", order.id),
                {},
                {
                    onSuccess: () => {
                        toast.success(`Pesanan ${order.order_number} berhasil dikonfirmasi!`);
                        if (selectedOrder?.id === order.id) {
                            setSelectedOrder(null);
                        }
                    },
                    onError: (err) => toast.error(err?.error || "Gagal mengonfirmasi pesanan"),
                }
            );
        });
    };

    const handleUpdateStatus = (order, newStatus, label) => {
        Swal.fire({
            title: `Ubah ke "${label}"?`,
            text: `Perbarui status pesanan ${order.order_number} menjadi ${label}?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#6366f1",
            cancelButtonColor: "#64748b",
            confirmButtonText: `Ya, ${label}`,
            cancelButtonText: "Batal",
            customClass: {
                popup: "rounded-2xl dark:bg-slate-900 dark:text-white",
            },
        }).then((result) => {
            if (!result.isConfirmed) return;

            router.post(
                route("catalog-orders.status", order.id),
                { status: newStatus },
                {
                    onSuccess: () => {
                        toast.success(`Status pesanan berhasil diubah menjadi ${label}`);
                        if (selectedOrder?.id === order.id) {
                            setSelectedOrder(null);
                        }
                    },
                    onError: (err) => toast.error(err?.error || "Gagal mengubah status"),
                }
            );
        });
    };

    const handleCancelSubmit = (e) => {
        e.preventDefault();
        if (!cancelReason.trim()) {
            toast.error("Mohon isi alasan pembatalan");
            return;
        }

        router.post(
            route("catalog-orders.cancel", cancelModalOrder.id),
            { reason: cancelReason },
            {
                onSuccess: () => {
                    toast.success("Pesanan berhasil dibatalkan");
                    setCancelModalOrder(null);
                    setCancelReason("");
                    if (selectedOrder?.id === cancelModalOrder.id) {
                        setSelectedOrder(null);
                    }
                },
                onError: (err) => toast.error(err?.error || "Gagal membatalkan pesanan"),
            }
        );
    };

    const handleLoadToPos = (order) => {
        Swal.fire({
            title: "Muat ke Kasir POS?",
            text: `Muat pesanan ${order.order_number} ke keranjang kasir POS untuk transaksi kasir langsung?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0f172a",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Buka di Kasir",
            cancelButtonText: "Batal",
            customClass: {
                popup: "rounded-2xl dark:bg-slate-900 dark:text-white",
            },
        }).then((result) => {
            if (!result.isConfirmed) return;

            router.post(
                route("catalog-orders.load-to-pos", order.id),
                {},
                {
                    onSuccess: () => toast.success("Pesanan berhasil dimuat ke kasir POS!"),
                    onError: (err) => toast.error(err?.error || "Gagal memuat ke POS"),
                }
            );
        });
    };

    return (
        <DashboardLayout>
            <Head title="Pesanan Online (Katalog)" />

            {/* Page Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Pesanan Online Katalog
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Kelola dan tindak lanjuti pesanan masuk dari katalog web pelanggan secara real-time.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href={route("transactions.index")}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition"
                    >
                        <IconShoppingCart size={16} />
                        Buka Kasir POS
                    </Link>
                </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Menunggu Konfirmasi</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center">
                            <IconClock size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.submitted}</div>
                    <span className="text-[11px] text-slate-400">Perlu segera dicek</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sedang Berjalan</span>
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
                            <IconPackage size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{metrics.processing}</div>
                    <span className="text-[11px] text-slate-400">Dikonfirmasi / disiapkan / siap</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Selesai Hari Ini</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
                            <IconCheck size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.completed_today}</div>
                    <span className="text-[11px] text-slate-400">Transaksi selesai</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Semua Pesanan</span>
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center">
                            <IconTruckDelivery size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">{metrics.total}</div>
                    <span className="text-[11px] text-slate-400">Sepanjang waktu</span>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 mb-6 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                        {[
                            { key: "all", label: "Semua" },
                            { key: "submitted", label: "Menunggu", count: metrics.submitted },
                            { key: "active", label: "Aktif", count: metrics.processing },
                            { key: "confirmed", label: "Dikonfirmasi" },
                            { key: "processing", label: "Disiapkan" },
                            { key: "ready", label: "Siap / Dikirim" },
                            { key: "completed", label: "Selesai" },
                            { key: "cancelled", label: "Dibatalkan" },
                        ].map((tab) => {
                            const isActive = (filters.status || "all") === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => handleStatusTab(tab.key)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                        isActive
                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span
                                            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                                isActive
                                                    ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                                                    : "bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300"
                                            }`}
                                        >
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search Input */}
                    <form onSubmit={handleSearch} className="flex items-center gap-2">
                        <div className="relative w-full sm:w-64">
                            <IconSearch
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari No. Order / Pemesan..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/20"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                        >
                            Cari
                        </button>
                    </form>
                </div>
            </div>

            {/* Orders Table Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <tr>
                                <th className="px-4 py-3.5">Pesanan</th>
                                <th className="px-4 py-3.5">Pemesan</th>
                                <th className="px-4 py-3.5">Metode</th>
                                <th className="px-4 py-3.5">Item Belanja</th>
                                <th className="px-4 py-3.5">Total</th>
                                <th className="px-4 py-3.5">Status</th>
                                <th className="px-4 py-3.5 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {orders.data && orders.data.length > 0 ? (
                                orders.data.map((order) => {
                                    const statusCfg = STATUS_MAP[order.status] || STATUS_MAP.submitted;
                                    const StatusIcon = statusCfg.icon;

                                    return (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                                        >
                                            {/* Order Number & Time */}
                                            <td className="px-4 py-3.5">
                                                <div className="font-extrabold text-slate-900 dark:text-white">
                                                    {order.order_number}
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                    {new Date(order.created_at).toLocaleString("id-ID", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    Cabang: {order.warehouse?.name || "-"}
                                                </div>
                                            </td>

                                            {/* Customer */}
                                            <td className="px-4 py-3.5">
                                                <div className="font-bold text-slate-900 dark:text-white">
                                                    {order.customer_name}
                                                </div>
                                                {order.customer_phone ? (
                                                    <a
                                                        href={`https://wa.me/${cleanWhatsAppNumber(order.customer_phone)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mt-0.5"
                                                    >
                                                        <IconBrandWhatsapp size={13} />
                                                        {order.customer_phone}
                                                    </a>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400">-</span>
                                                )}
                                                {order.other_active_orders_count > 0 && (
                                                    <div className="mt-1">
                                                        <span
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                                                            title="Pelanggan memiliki pesanan aktif lainnya yang sedang berjalan (bisa ditawarkan untuk digabung kirim)"
                                                        >
                                                            +{order.other_active_orders_count} Pesanan Aktif Lain
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Delivery Method */}
                                            <td className="px-4 py-3.5">
                                                {order.delivery_method === "delivery" ? (
                                                    <div className="space-y-0.5">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-900">
                                                            <IconTruckDelivery size={12} />
                                                            Kirim Alamat
                                                        </span>
                                                        {order.delivery_address && (
                                                            <p className="text-[11px] text-slate-500 line-clamp-1 max-w-[150px]" title={order.delivery_address}>
                                                                {order.delivery_address}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                                                        <IconBuildingStore size={12} />
                                                        Ambil di Toko
                                                    </span>
                                                )}
                                            </td>

                                            {/* Items */}
                                            <td className="px-4 py-3.5">
                                                <div className="space-y-0.5 max-w-[180px]">
                                                    {order.items.slice(0, 2).map((item) => (
                                                        <div key={item.id} className="text-xs truncate text-slate-800 dark:text-slate-200">
                                                            <span className="font-bold">{item.qty}×</span> {item.product_title}
                                                        </div>
                                                    ))}
                                                    {order.items.length > 2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedOrder(order)}
                                                            className="text-[11px] text-primary-600 font-semibold hover:underline"
                                                        >
                                                            +{order.items.length - 2} item lainnya...
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Total */}
                                            <td className="px-4 py-3.5">
                                                <div className="font-extrabold text-slate-900 dark:text-white">
                                                    {formatRupiah(order.grand_total)}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {order.items.reduce((sum, i) => sum + i.qty, 0)} produk
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-4 py-3.5">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold ${statusCfg.badge}`}
                                                >
                                                    <StatusIcon size={13} />
                                                    {statusCfg.label}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Detail Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedOrder(order)}
                                                        title="Lihat Detail Pesanan"
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                                    >
                                                        <IconEye size={16} />
                                                    </button>

                                                    {/* Tracking Link */}
                                                    <a
                                                        href={route("catalog.order.status", order.access_token)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        title="Buka Halaman Pelacakan Pelanggan"
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                                    >
                                                        <IconExternalLink size={16} />
                                                    </a>

                                                    {/* Contextual Flow Action Buttons */}
                                                    {canProcess && (
                                                        <>
                                                            {order.status === "submitted" && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleConfirm(order)}
                                                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                                                                    >
                                                                        Terima
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setCancelModalOrder(order);
                                                                            setCancelReason("");
                                                                        }}
                                                                        className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-xs transition cursor-pointer"
                                                                    >
                                                                        Tolak
                                                                    </button>
                                                                </>
                                                            )}

                                                            {order.status === "confirmed" && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateStatus(order, "processing", "Sedang Disiapkan")}
                                                                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                                                                    >
                                                                        Siapkan
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleLoadToPos(order)}
                                                                        title="Muat ke Kasir POS untuk Pembayaran"
                                                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-xs transition cursor-pointer"
                                                                    >
                                                                        Ke POS
                                                                    </button>
                                                                </>
                                                            )}

                                                            {order.status === "processing" && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateStatus(order, "ready", order.delivery_method === "delivery" ? "Sedang Dikirim" : "Siap Diambil")}
                                                                        className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                                                                    >
                                                                        {order.delivery_method === "delivery" ? "Kirim" : "Siap"}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleLoadToPos(order)}
                                                                        title="Muat ke Kasir POS untuk Pembayaran"
                                                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-xs transition cursor-pointer"
                                                                    >
                                                                        Ke POS
                                                                    </button>
                                                                </>
                                                            )}

                                                            {order.status === "ready" && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateStatus(order, "completed", "Selesai")}
                                                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                                                                    >
                                                                        Selesaikan
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleLoadToPos(order)}
                                                                        title="Muat ke Kasir POS untuk Pembayaran"
                                                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-xs transition cursor-pointer"
                                                                    >
                                                                        Ke POS
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                        <IconTruckDelivery size={36} className="mx-auto mb-2 opacity-40" />
                                        <p className="font-semibold">Belum ada pesanan online untuk filter ini</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {orders.links && orders.links.length > 3 && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <Pagination links={orders.links} />
                    </div>
                )}
            </div>

            {/* Detail Order Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    Detail Pesanan {selectedOrder.order_number}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {new Date(selectedOrder.created_at).toLocaleString("id-ID")}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedOrder(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        {/* Customer & Address Details */}
                        <div className="space-y-3 text-xs sm:text-sm mb-4">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Nama Pemesan:</span>
                                    <span className="font-bold">{selectedOrder.customer_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">No. WhatsApp:</span>
                                    <span>{selectedOrder.customer_phone || "-"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Metode:</span>
                                    <span className="font-bold">
                                        {selectedOrder.delivery_method === "delivery" ? "🚚 Pengiriman ke Alamat" : "🏪 Ambil di Toko"}
                                    </span>
                                </div>
                                {selectedOrder.delivery_address && (
                                    <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700">
                                        <span className="text-slate-500 block">Alamat:</span>
                                        <p className="mt-0.5">{selectedOrder.delivery_address}</p>
                                    </div>
                                )}
                                {selectedOrder.notes && (
                                    <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700">
                                        <span className="text-slate-500 block">Catatan:</span>
                                        <p className="italic">{selectedOrder.notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Items List */}
                            <div>
                                <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-2">
                                    Daftar Produk ({selectedOrder.items.length})
                                </h4>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                                    {selectedOrder.items.map((item) => (
                                        <div key={item.id} className="p-3 flex items-center justify-between gap-2">
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {item.product_title}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {item.qty} × {formatRupiah(item.price)}
                                                </p>
                                            </div>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {formatRupiah(item.subtotal)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 flex justify-between items-center text-base font-black">
                                <span>Total Tagihan</span>
                                <span className="text-primary-600">{formatRupiah(selectedOrder.grand_total)}</span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedOrder(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Modal */}
            {cancelModalOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <form
                        onSubmit={handleCancelSubmit}
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800"
                    >
                        <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                            Batalkan / Tolak Pesanan
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Nomor Pesanan: <span className="font-bold">{cancelModalOrder.order_number}</span> ({cancelModalOrder.customer_name})
                        </p>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Alasan Pembatalan / Penolakan *
                            </label>
                            <textarea
                                rows={3}
                                required
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Contoh: Stok barang fisik rusak / pelanggan membatalkan pesanan"
                                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setCancelModalOrder(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                            >
                                Konfirmasi Tolak
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </DashboardLayout>
    );
}
