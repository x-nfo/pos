import React, { useState } from "react";
import { Head, Link, usePage } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconBrandWhatsapp,
    IconFileInvoice,
    IconPrinter,
    IconReceipt,
    IconShoppingCart,
} from "@tabler/icons-react";
import { shareWhatsappPurchaseOrder } from "@/Utils/whatsappPurchaseOrder";

const formatCurrency = (val = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(val) || 0);

const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
};

const formatDateOnly = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
    }).format(date);
};

export default function Print({ order, defaultPaperSize = "a4" }) {
    const { storeProfile = {}, branding = {} } = usePage().props;
    const [printMode, setPrintMode] = useState(defaultPaperSize === "58mm" || defaultPaperSize === "80mm" ? "thermal" : "a4");

    const storeName = storeProfile?.name || branding?.appName || "Point of Sales";
    const storeAddress = storeProfile?.address || "";
    const storePhone = storeProfile?.phone || "";
    const storeEmail = storeProfile?.email || "";

    const items = order.items || [];
    const grandTotal = items.reduce((sum, i) => sum + Number(i.qty_ordered || 0) * Number(i.unit_price || 0), 0);
    const totalQty = items.reduce((sum, i) => sum + Number(i.qty_ordered || 0), 0);

    const handlePrint = () => {
        window.print();
    };

    const handleShareWhatsapp = () => {
        shareWhatsappPurchaseOrder({ order, storeProfile, branding });
    };

    return (
        <>
            <Head title={`Cetak PO ${order.document_number}`} />

            {/* Non-Printable Top Action Bar */}
            <div className="print:hidden sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800 px-4 py-3">
                <div className="max-w-5xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href={route("purchase-orders.show", order.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                        >
                            <IconArrowLeft size={16} />
                            Kembali ke Detail PO
                        </Link>
                        <span className="text-sm font-semibold text-slate-300 hidden sm:inline">
                            {order.document_number}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Mode Switcher */}
                        <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                            <button
                                type="button"
                                onClick={() => setPrintMode("a4")}
                                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${
                                    printMode === "a4"
                                        ? "bg-primary-600 text-white shadow-sm"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <IconFileInvoice size={14} /> Dokumen Resmi (A4)
                            </button>
                            <button
                                type="button"
                                onClick={() => setPrintMode("thermal")}
                                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${
                                    printMode === "thermal"
                                        ? "bg-primary-600 text-white shadow-sm"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <IconReceipt size={14} /> Struk Ringkas
                            </button>
                        </div>

                        {/* WhatsApp Button */}
                        <button
                            type="button"
                            onClick={handleShareWhatsapp}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                            title="Kirim rincian PO via WhatsApp ke supplier"
                        >
                            <IconBrandWhatsapp size={16} />
                            Kirim ke WA Supplier
                        </button>

                        {/* Print Button */}
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold shadow-md transition"
                        >
                            <IconPrinter size={16} />
                            Cetak Dokumen
                        </button>
                    </div>
                </div>
            </div>

            {/* Printable Content */}
            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 print:p-0 print:bg-white print:text-black">
                {printMode === "a4" ? (
                    /* A4 Standard Purchase Order Document */
                    <div className="max-w-4xl mx-auto bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-12 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:text-black">
                        {/* Header Toko & Judul Dokumen */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b-2 border-slate-900 gap-4">
                            <div>
                                {storeProfile?.logo ? (
                                    <img
                                        src={`/storage/${storeProfile.logo}`}
                                        alt={storeName}
                                        className="h-14 w-auto object-contain mb-2"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-2 rounded-xl bg-primary-600 text-white">
                                            <IconShoppingCart size={22} />
                                        </div>
                                        <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                                            {storeName}
                                        </h2>
                                    </div>
                                )}
                                {storeAddress && (
                                    <p className="text-xs text-slate-600 max-w-sm">{storeAddress}</p>
                                )}
                                <div className="text-xs text-slate-500 mt-1 space-x-3">
                                    {storePhone && <span>Telp: {storePhone}</span>}
                                    {storeEmail && <span>Email: {storeEmail}</span>}
                                </div>
                            </div>

                            <div className="sm:text-right">
                                <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary-600 bg-primary-50 px-3 py-1 rounded-md mb-1.5 border border-primary-200 print:border-slate-400">
                                    Surat Pesanan Pembelian
                                </span>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                    PURCHASE ORDER
                                </h1>
                                <p className="font-mono text-sm font-bold text-slate-700 mt-1">
                                    {order.document_number}
                                </p>
                            </div>
                        </div>

                        {/* Metadata & Pihak Terkait (Supplier & Gudang) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-xs">
                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 print:bg-white print:border-slate-300">
                                <p className="font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Kepada Supplier / Vendor:
                                </p>
                                <p className="text-sm font-bold text-slate-900">
                                    {order.supplier?.name || "Supplier Umum"}
                                </p>
                                {order.supplier?.phone && (
                                    <p className="text-slate-600 mt-0.5">Telepon: {order.supplier.phone}</p>
                                )}
                                {order.supplier?.email && (
                                    <p className="text-slate-600">Email: {order.supplier.email}</p>
                                )}
                                {order.supplier?.address && (
                                    <p className="text-slate-600 mt-1 leading-relaxed">
                                        {order.supplier.address}
                                    </p>
                                )}
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 print:bg-white print:border-slate-300">
                                <p className="font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Tujuan Pengiriman & Informasi Dokumen:
                                </p>
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Tanggal PO:</span>
                                        <span className="font-medium">{formatDateOnly(order.created_at)}</span>
                                    </div>
                                    {order.ordered_at && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Tanggal Pesan:</span>
                                            <span className="font-medium">{formatDateTime(order.ordered_at)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Gudang Tujuan:</span>
                                        <span className="font-bold text-slate-900">
                                            {order.warehouse ? `${order.warehouse.code} - ${order.warehouse.name}` : "Gudang Utama"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Dibuat Oleh:</span>
                                        <span className="font-medium">{order.creator?.name || "-"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Status PO:</span>
                                        <span className="font-semibold uppercase text-primary-700">
                                            {order.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabel Item PO */}
                        <div className="py-6">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-y-2 border-slate-900 bg-slate-50 print:bg-transparent font-bold text-slate-900">
                                        <th className="py-3 px-2 w-10 text-center">No</th>
                                        <th className="py-3 px-3">Kode / SKU</th>
                                        <th className="py-3 px-3">Deskripsi Barang</th>
                                        <th className="py-3 px-3 text-center">Satuan (UOM)</th>
                                        <th className="py-3 px-3 text-right">Qty</th>
                                        <th className="py-3 px-3 text-right">Harga Satuan</th>
                                        <th className="py-3 px-3 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {items.length > 0 ? (
                                        items.map((item, idx) => {
                                            const subtotal = Number(item.qty_ordered || 0) * Number(item.unit_price || 0);
                                            const unitName = item.unit?.symbol || item.unit?.name || "Pcs";
                                            const isMulti = Number(item.conversion_factor) > 1;

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                                                    <td className="py-3 px-2 text-center text-slate-500">{idx + 1}</td>
                                                    <td className="py-3 px-3 font-mono text-slate-600">
                                                        {item.product?.sku || "-"}
                                                    </td>
                                                    <td className="py-3 px-3 font-semibold text-slate-900">
                                                        {item.product?.title || `Produk #${item.product_id}`}
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 print:bg-transparent font-medium">
                                                            {unitName}
                                                            {isMulti && ` (@${item.conversion_factor})`}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                                                        {item.qty_ordered}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono">
                                                        {formatCurrency(item.unit_price)}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                                        {formatCurrency(subtotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="py-6 text-center text-slate-400">
                                                Tidak ada item pada PO ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-900 font-bold">
                                        <td colSpan={4} className="py-3 px-3 text-right">
                                            Total Barang: {items.length} item ({totalQty} unit)
                                        </td>
                                        <td colSpan={2} className="py-3 px-3 text-right text-sm">
                                            GRAND TOTAL ESTIMASI:
                                        </td>
                                        <td className="py-3 px-3 text-right text-sm font-mono text-primary-700 print:text-black">
                                            {formatCurrency(grandTotal)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Catatan PO */}
                        {order.notes && (
                            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs print:bg-white print:border-slate-300">
                                <p className="font-bold text-slate-700 mb-1">Catatan Pemesanan / Instruksi:</p>
                                <p className="text-slate-600 leading-relaxed">{order.notes}</p>
                            </div>
                        )}

                        {/* Syarat & Ketentuan Singkat */}
                        <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-4 mb-8 space-y-1">
                            <p className="font-semibold text-slate-700">Ketentuan Pemesanan:</p>
                            <p>1. Harap sertakan salinan Surat Pesanan (PO) ini pada saat pengiriman barang dan penagihan faktur.</p>
                            <p>2. Barang yang dikirim harus dalam kondisi baik dan sesuai dengan spesifikasi yang tercantum di atas.</p>
                            <p>3. Konfirmasi ketersediaan barang dan jadwal kirim dapat menghubungi kontak toko yang tertera.</p>
                        </div>

                        {/* Kolom Tanda Tangan */}
                        <div className="grid grid-cols-3 gap-6 pt-4 text-center text-xs">
                            <div>
                                <p className="text-slate-500 mb-16">Dibuat Oleh (Purchasing):</p>
                                <p className="font-bold text-slate-900 border-t border-slate-400 pt-1">
                                    {order.creator?.name || "( ......................... )"}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500 mb-16">Disetujui Oleh (Pimpinan):</p>
                                <p className="font-bold text-slate-900 border-t border-slate-400 pt-1">
                                    ( ......................... )
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500 mb-16">Dikonfirmasi Supplier:</p>
                                <p className="font-bold text-slate-900 border-t border-slate-400 pt-1">
                                    {order.supplier?.name || "( ......................... )"}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Compact Thermal Receipt Layout (58mm / 80mm) */
                    <div className="max-w-[320px] mx-auto bg-white text-slate-900 p-4 font-mono text-xs shadow-lg rounded-xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full">
                        <div className="text-center pb-2 border-b border-dashed border-slate-400">
                            <p className="font-bold text-sm uppercase">{storeName}</p>
                            {storeAddress && <p className="text-[10px] text-slate-600">{storeAddress}</p>}
                            {storePhone && <p className="text-[10px] text-slate-600">Telp: {storePhone}</p>}
                        </div>

                        <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
                            <p className="font-bold text-center text-xs my-1">PURCHASE ORDER</p>
                            <p>No: {order.document_number}</p>
                            <p>Tgl: {formatDateTime(order.created_at)}</p>
                            <p>Supplier: {order.supplier?.name || "-"}</p>
                            <p>Gudang: {order.warehouse?.code || "Utama"}</p>
                            <p>Oleh: {order.creator?.name || "-"}</p>
                        </div>

                        <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5">
                            {items.map((item) => {
                                const subtotal = Number(item.qty_ordered || 0) * Number(item.unit_price || 0);
                                const unitName = item.unit?.symbol || item.unit?.name || "Pcs";
                                return (
                                    <div key={item.id} className="text-[11px]">
                                        <p className="font-semibold">{item.product?.title || `Item #${item.product_id}`}</p>
                                        <div className="flex justify-between text-slate-600">
                                            <span>
                                                {item.qty_ordered} {unitName} x {formatCurrency(item.unit_price)}
                                            </span>
                                            <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-1 font-bold">
                            <div className="flex justify-between">
                                <span>Total Item:</span>
                                <span>{items.length} ({totalQty} qty)</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span>GRAND TOTAL:</span>
                                <span>{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>

                        {order.notes && (
                            <div className="py-2 border-b border-dashed border-slate-400 text-[10px]">
                                <p className="font-bold">Catatan:</p>
                                <p>{order.notes}</p>
                            </div>
                        )}

                        <div className="text-center pt-3 text-[10px] text-slate-500">
                            <p>Terima kasih atas kerja samanya.</p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
