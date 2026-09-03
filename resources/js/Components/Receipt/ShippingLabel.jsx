import React, { useEffect, useRef } from "react";
import {
    IconMapPin,
    IconPhone,
    IconUser,
    IconPackage,
    IconBuildingStore,
} from "@tabler/icons-react";
import JsBarcode from "jsbarcode";

export default function ShippingLabel({ transaction, store = {} }) {
    const barcodeRef = useRef(null);

    const formatPrice = (price = 0) =>
        Number(price || 0).toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        });

    const formatDate = (value) => {
        if (!value) return "-";
        const d = new Date(value);
        return d.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const storeName = store?.name || "TOKO";
    const storeInitial = storeName?.[0] || "T";
    const storeLogo = store?.logo;
    const storePhone = store?.phone || "";
    const storeAddress = store?.address || "";

    const customer = transaction?.customer || {};
    const customerPhone = customer.phone || customer.no_telp || "";
    const customerAddress = customer.address || "";
    const isStorePickup = !customerAddress || customerAddress.toLowerCase().includes("ambil di toko");

    const region = [
        customer.village_name,
        customer.district_name,
        customer.regency_name,
        customer.province_name,
    ]
        .filter(Boolean)
        .join(", ");

    const isPaid =
        transaction?.payment_status === "paid" ||
        (!transaction?.payment_status && (transaction?.cash || 0) >= (transaction?.grand_total || 0));

    const totalItemCount =
        transaction?.details?.reduce((acc, d) => acc + (Number(d.qty) || 0), 0) || 0;

    useEffect(() => {
        if (barcodeRef.current && transaction?.invoice) {
            try {
                JsBarcode(barcodeRef.current, transaction.invoice, {
                    format: "CODE128",
                    width: 1.35,
                    height: 32,
                    displayValue: false,
                    margin: 0,
                    background: "transparent",
                    lineColor: "#0f172a",
                });
            } catch (e) {
                console.error("Barcode generation error:", e);
            }
        }
    }, [transaction?.invoice]);

    return (
        <div className="w-full flex justify-center py-2 print:py-0 print:block">
            <style>
                {`
                    @media print {
                        @page {
                            size: 150mm 100mm;
                            margin: 0;
                        }
                        body, html {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #ffffff !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .shipping-label-container {
                            box-shadow: none !important;
                            border: 1px solid #94a3b8 !important;
                            width: 150mm !important;
                            height: 100mm !important;
                            max-width: 150mm !important;
                            max-height: 100mm !important;
                            margin: 0 !important;
                            padding: 4mm 5mm !important;
                            border-radius: 0 !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                            overflow: hidden !important;
                        }
                    }
                    .shipping-label-container {
                        color: #0f172a !important;
                        background-color: #ffffff !important;
                    }
                `}
            </style>

            <div
                className="shipping-label-container bg-white text-slate-900 border-2 border-slate-300 rounded-2xl p-4 sm:p-5 shadow-md relative overflow-hidden flex flex-col justify-between box-border"
                style={{
                    width: "150mm",
                    maxWidth: "100%",
                    minHeight: "100mm",
                }}
            >
                {/* Decorative Accent Side Bar (Screen only) */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-600 print:hidden" />

                <div className="space-y-3">
                    {/* Header Section: Store (Left) and Invoice Info (Right) */}
                    <div className="flex items-start justify-between gap-3 border-b-2 border-dashed border-slate-200 pb-3">
                        {/* Pengirim (Store Info) */}
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center p-1.5 border border-slate-200 shrink-0">
                                {storeLogo ? (
                                    <img
                                        src={storeLogo}
                                        alt={storeName}
                                        className="max-w-full max-h-full object-contain"
                                    />
                                ) : (
                                    <span className="text-xl font-black text-primary-600">
                                        {storeInitial}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Pengirim
                                </span>
                                <h2
                                    className="text-sm sm:text-base font-bold text-slate-900 leading-snug truncate"
                                    title={storeName}
                                >
                                    {storeName}
                                </h2>
                                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                    {storePhone && (
                                        <span className="inline-flex items-center gap-1 shrink-0">
                                            <IconPhone size={12} className="text-slate-400 shrink-0" />
                                            {storePhone}
                                        </span>
                                    )}
                                    {storeAddress && (
                                        <span className="truncate text-slate-400">
                                            {storePhone ? "• " : ""}{storeAddress}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Invoice & Status (Right) */}
                        <div className="shrink-0 text-right pl-3 border-l-2 border-slate-200">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                No. Invoice
                            </span>
                            <div className="text-base sm:text-lg font-black text-primary-600 font-mono tracking-tight whitespace-nowrap leading-tight">
                                {transaction?.invoice}
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-1">
                                <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                    {formatDate(transaction?.created_at)}
                                </span>
                                <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider leading-none ${
                                        isPaid
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                            : "bg-amber-100 text-amber-800 border border-amber-300"
                                    }`}
                                >
                                    {isPaid ? "LUNAS" : "BELUM LUNAS"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Middle Grid: Penerima & Isi Paket */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Left Side: Penerima */}
                        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                    <div className="flex items-center gap-1.5 text-primary-600 font-bold text-[11px] uppercase tracking-wider">
                                        <IconUser size={15} />
                                        <span>Penerima</span>
                                    </div>
                                    {isStorePickup && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-semibold border border-blue-200/60">
                                            <IconBuildingStore size={11} /> Ambil di Toko
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">
                                    {customer.name || "Pelanggan Umum"}
                                </h3>
                                {customerPhone && (
                                    <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
                                        <IconPhone size={12} className="text-slate-400 shrink-0" />
                                        <span>{customerPhone}</span>
                                    </p>
                                )}
                                <div className="mt-1.5 flex items-start gap-1">
                                    <IconMapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                                            {customerAddress || "Ambil di Toko"}
                                        </p>
                                        {region && (
                                            <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5 leading-tight line-clamp-1">
                                                {region}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Isi Paket & Total */}
                        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                    <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                                        <IconPackage size={15} />
                                        <span>Isi Paket</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500">
                                        {totalItemCount} {totalItemCount > 1 ? "items" : "item"}
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-700 space-y-1 max-h-[56px] overflow-hidden leading-snug font-medium">
                                    {transaction?.details?.slice(0, 3).map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="flex justify-between items-center gap-1 truncate"
                                        >
                                            <span className="truncate text-slate-800">
                                                {item.product?.title || "Produk"}
                                            </span>
                                            <span className="shrink-0 font-bold text-slate-600 text-[10px] tabular-nums">
                                                x{item.qty}
                                            </span>
                                        </div>
                                    ))}
                                    {(transaction?.details?.length || 0) > 3 && (
                                        <p className="text-[10px] text-slate-400 italic">
                                            +{transaction.details.length - 3} item lainnya...
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 mt-2 border-t border-slate-200/80 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Total Bayar
                                </span>
                                <span className="text-sm font-black text-slate-900 tabular-nums">
                                    {formatPrice(transaction?.grand_total)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Section: Printed At, Cashier & Barcode */}
                <div className="flex justify-between items-end mt-3 pt-2.5 border-t-2 border-dashed border-slate-200">
                    <div className="space-y-0.5 text-[10px] text-slate-500 font-medium">
                        <div>
                            Kasir:{" "}
                            <strong className="text-slate-700">
                                {transaction?.cashier?.name || "-"}
                            </strong>
                        </div>
                        <div className="italic text-slate-400 text-[9px]">
                            Dicetak: {new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" })}
                        </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                        <svg ref={barcodeRef} className="h-8 max-w-[180px]" />
                        <span className="text-[9px] font-mono font-bold tracking-widest text-slate-800 mt-0.5 uppercase">
                            {transaction?.invoice}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
