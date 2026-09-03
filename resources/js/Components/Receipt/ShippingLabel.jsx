import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function ShippingLabel({ transaction, store = {} }) {
    const barcodeRef = useRef(null);

    const formatPrice = (price = 0) =>
        `Rp ${Number(price || 0).toLocaleString("id-ID")}`;

    const formatDate = (value) => {
        if (!value) return "-";
        const d = new Date(value);
        const months = [
            "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
            "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
        ];
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const getPrintDate = () => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    };

    const storeName = store?.name || "Toko";
    const storeLogo = store?.logo || store?.logo_data;
    const storePhone = store?.phone || "";
    const storeAddress = store?.address || "";
    const storeEmail = store?.email || "";

    const customer = transaction?.customer || {};
    const customerPhone = customer.no_telp || customer.phone || "-";
    const customerAddress = customer.address || "No Address";

    const regionParts = [
        customer.village_name,
        customer.district_name,
        customer.regency_name,
        customer.province_name,
    ].filter(Boolean);
    const regionString = regionParts.length > 0 ? regionParts.join(", ") : "-";

    const details = transaction?.details || [];
    const itemCount = details.length;
    const displayedProducts = details.slice(0, 3);

    useEffect(() => {
        if (barcodeRef.current && transaction?.invoice) {
            try {
                JsBarcode(barcodeRef.current, transaction.invoice, {
                    format: "CODE128",
                    width: 1.8,
                    height: 45,
                    displayValue: false,
                    margin: 0,
                    background: "transparent",
                    lineColor: "#000000",
                });
            } catch (e) {
                console.error("Barcode generation error:", e);
            }
        }
    }, [transaction?.invoice]);

    return (
        <div className="w-full flex justify-center py-2 print:p-0 print:block">
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
                            border: none !important;
                            border-radius: 0 !important;
                            width: 150mm !important;
                            height: 100mm !important;
                            max-width: 150mm !important;
                            max-height: 100mm !important;
                            margin: 0 !important;
                            padding: 12pt !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                            overflow: hidden !important;
                            position: relative !important;
                        }
                        .shipping-label-footer {
                            position: absolute !important;
                            bottom: 12pt !important;
                            left: 12pt !important;
                            right: 12pt !important;
                            border-top: 1px solid #e2e8f0 !important;
                            padding-top: 6pt !important;
                            margin-top: 0 !important;
                        }
                        .shipping-label-penerima {
                            height: 65pt !important;
                        }
                        .shipping-label-ringkasan {
                            height: 65pt !important;
                        }
                        .shipping-label-products {
                            height: 48pt !important;
                            overflow: hidden !important;
                        }
                    }
                `}
            </style>

            <div
                className="shipping-label-container bg-white text-slate-800 border border-slate-200 rounded-2xl sm:rounded-xl shadow-lg sm:shadow-md relative overflow-hidden box-border w-full max-w-[425.2pt] sm:w-[425.2pt] h-auto sm:h-[283.5pt] p-3.5 sm:p-[12pt] transition-all"
                style={{
                    fontFamily: "'Helvetica', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    color: "#1e293b",
                }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-2.5 sm:gap-3 pb-2 sm:pb-[5pt]">
                    {/* Store Branding (Left) */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-[40pt] sm:h-[40pt] flex-shrink-0 flex items-center justify-center">
                            {storeLogo ? (
                                <img
                                    src={storeLogo}
                                    alt={storeName}
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full border border-slate-200 rounded-lg sm:rounded-none flex items-center justify-center font-bold text-sm sm:text-[17pt] text-slate-700 bg-slate-50 sm:bg-transparent">
                                    {storeName.slice(0, 2).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs sm:text-[13pt] text-slate-900 leading-tight truncate">
                                {storeName}
                            </div>
                            {storeAddress && (
                                <div className="text-[10px] sm:text-[7pt] text-slate-500 mt-0.5 leading-snug line-clamp-1 sm:truncate">
                                    {storeAddress}
                                </div>
                            )}
                            {(storePhone || storeEmail) && (
                                <div className="text-[10px] sm:text-[7pt] text-slate-500 mt-0.5 tracking-tight truncate">
                                    {storePhone}{storePhone && storeEmail ? " | " : ""}{storeEmail}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Invoice & Date Info (Right) */}
                    <div className="text-right flex-shrink-0 pl-1">
                        <div className="text-[9px] sm:text-[7pt] font-semibold text-slate-400 uppercase tracking-wider">
                            INVOICE
                        </div>
                        <div className="font-bold text-xs sm:text-[14pt] text-slate-900 leading-tight whitespace-nowrap">
                            {transaction?.invoice}
                        </div>
                        <div className="text-[10px] sm:text-[8pt] text-slate-600 mt-0.5">
                            {formatDate(transaction?.created_at)}
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-200 my-2 sm:my-[8pt]" />

                {/* Section Penerima & Ringkasan Pesanan */}
                <div className="grid grid-cols-12 gap-2 sm:gap-2.5">
                    {/* Penerima Box */}
                    <div className="shipping-label-penerima col-span-7 border border-slate-200 rounded-lg p-2 sm:p-[6pt] h-auto sm:h-[65pt] flex flex-col justify-between overflow-hidden">
                        <div>
                            <div className="text-[9px] sm:text-[7pt] font-bold uppercase text-slate-400 mb-0.5 sm:mb-[3pt]">
                                Penerima
                            </div>
                            <div className="font-bold text-xs sm:text-[10pt] text-slate-900 truncate">
                                {customer.name || "Umum"}
                            </div>
                            <div className="text-[10px] sm:text-[8pt] text-slate-500 mt-0.5">
                                {customerPhone}
                            </div>
                        </div>
                        <div className="mt-1">
                            <div className="text-[10px] sm:text-[8pt] text-slate-500 leading-tight line-clamp-1 sm:truncate">
                                {customerAddress ? customerAddress : "No Address"}
                            </div>
                            {regionString !== "-" && (
                                <div className="text-[10px] sm:text-[8pt] text-slate-500 leading-tight truncate mt-0.5">
                                    {regionString}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ringkasan Pesanan Box */}
                    <div className="shipping-label-ringkasan col-span-5 border border-slate-200 rounded-lg p-2 sm:p-[6pt] h-auto sm:h-[65pt] flex flex-col justify-between overflow-hidden">
                        <div className="text-[9px] sm:text-[7pt] font-bold uppercase text-slate-400 mb-0.5 sm:mb-[3pt]">
                            Ringkasan Pesanan
                        </div>
                        <div className="space-y-1 sm:space-y-0 text-[10px] sm:text-[8pt]">
                            <div className="flex justify-between items-center text-slate-700">
                                <span>Item</span>
                                <span className="font-semibold">{itemCount} unit</span>
                            </div>
                            <div className="flex justify-between items-baseline pt-1 sm:pt-[10pt] border-t border-slate-100 sm:border-0">
                                <span className="font-bold text-slate-900 text-[10px] sm:text-[10pt]">Total</span>
                                <span className="font-bold text-slate-900 text-[11px] sm:text-[10pt] text-right ml-1 whitespace-nowrap">
                                    {formatPrice(transaction?.grand_total)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Daftar Produk */}
                <div className="mt-2.5 sm:mt-[10pt]">
                    <div className="text-[9px] sm:text-[7pt] font-bold uppercase text-slate-400 mb-1 sm:mb-[2pt]">
                        Daftar Produk
                    </div>
                    <div className="shipping-label-products h-auto sm:h-[48pt] overflow-hidden">
                        <ul className="m-0 pl-3.5 sm:pl-[12pt] list-disc space-y-0.5 sm:space-y-[2pt]">
                            {displayedProducts.map((detail, idx) => {
                                const title = detail.product?.title || "Produk";
                                return (
                                    <li key={idx} className="text-[11px] sm:text-[8pt] text-slate-800 leading-snug truncate">
                                        {title} ({detail.qty}x)
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="shipping-label-footer mt-3 pt-2.5 border-t border-slate-200 sm:border-t sm:absolute sm:bottom-[12pt] sm:left-[12pt] sm:right-[12pt] sm:mt-0 sm:pt-[8pt] flex flex-col sm:flex-row items-center sm:items-end justify-between gap-2.5 sm:gap-2">
                    {/* Admin & Print Date */}
                    <div className="text-[10px] sm:text-[7pt] text-slate-500 leading-snug text-center sm:text-left order-2 sm:order-1 self-start sm:self-end">
                        <div>
                            Admin: <strong className="text-slate-800 font-semibold">{transaction?.cashier?.name || "-"}</strong>
                        </div>
                        <div className="text-slate-400">
                            Dicetak: {getPrintDate()}
                        </div>
                    </div>

                    {/* Barcode & Invoice Number */}
                    <div className="flex flex-col items-center sm:items-end order-1 sm:order-2 w-full sm:w-auto max-w-[240px] sm:max-w-[220pt]">
                        <svg
                            ref={barcodeRef}
                            className="h-8 sm:h-[35pt] w-full max-w-[200px] sm:max-w-[220pt] block mx-auto sm:ml-auto"
                        />
                        <div className="text-[10px] sm:text-[8pt] font-bold tracking-widest text-slate-900 text-center mt-1 sm:mt-[4pt]">
                            {transaction?.invoice}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
