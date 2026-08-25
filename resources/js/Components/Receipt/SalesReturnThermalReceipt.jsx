import React from "react";

/**
 * SalesReturnThermalReceipt (80mm) - Receipt template for Sales Return & Product Exchange
 */
export default function SalesReturnThermalReceipt({
    salesReturn,
    storeName = "TOKO ANDA",
    storeAddress = "",
    storePhone = "",
    storeEmail = "",
    storeWebsite = "",
}) {
    const formatPrice = (price = 0) => {
        return "Rp " + Number(price || 0).toLocaleString("id-ID");
    };

    const formatDate = (value) => {
        return new Date(value || Date.now()).toLocaleString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const isExchange = salesReturn?.return_type === "product_exchange";
    const items = salesReturn?.items || [];
    const exchangeItems = salesReturn?.exchange_items || [];

    const line = "=".repeat(32);
    const dashLine = "-".repeat(32);

    const SimpleBarcode = ({ value }) => {
        const bars = (value || "").split("").map((char, idx) => {
            const weight = (char.charCodeAt(0) + idx * 17) % 5;
            return 2 + weight;
        });

        return (
            <div className="flex items-end justify-center gap-[2px] mt-2">
                {bars.map((w, i) => (
                    <span
                        key={i}
                        style={{ width: `${w}px` }}
                        className="h-10 bg-black block"
                    />
                ))}
            </div>
        );
    };

    return (
        <div
            className="thermal-receipt font-mono text-xs leading-tight text-slate-900 bg-white"
            style={{ width: "80mm", padding: "4mm", margin: "0 auto" }}
        >
            {/* Store Header */}
            <div className="text-center mb-2">
                <p className="text-sm font-bold">{storeName}</p>
                {storeAddress && <p className="text-xs">{storeAddress}</p>}
                {storePhone && <p className="text-xs">Telp: {storePhone}</p>}
                {storeEmail && <p className="text-xs">Email: {storeEmail}</p>}
                {storeWebsite && <p className="text-xs">{storeWebsite}</p>}
            </div>

            <pre className="whitespace-pre-wrap">{line}</pre>
            <div className="text-center my-1 font-bold">
                <p className="text-xs uppercase">
                    {isExchange ? "BUKTI TUKAR BARANG" : "BUKTI RETUR PENJUALAN"}
                </p>
            </div>
            <pre className="whitespace-pre-wrap">{dashLine}</pre>

            {/* Info */}
            <div className="my-1">
                <div className="flex justify-between">
                    <span>No Retur:</span>
                    <span className="font-semibold">{salesReturn?.code}</span>
                </div>
                <div className="flex justify-between">
                    <span>Ref Nota:</span>
                    <span>{salesReturn?.transaction?.invoice || "-"}</span>
                </div>
                <div className="flex justify-between">
                    <span>Tgl:</span>
                    <span>
                        {formatDate(
                            salesReturn?.completed_at || salesReturn?.created_at
                        )}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{salesReturn?.cashier?.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span>{salesReturn?.customer?.name || "Umum"}</span>
                </div>
            </div>

            <pre className="whitespace-pre-wrap">{line}</pre>

            {/* Returned Items */}
            <div className="my-1">
                <p className="font-bold text-[11px] mb-1">[BARANG DIRETUR]</p>
                {items.map((item, index) => {
                    const qty = Number(item.qty_return || item.qty || 1);
                    const unitPrice = Number(item.unit_price || 0);
                    const subtotal = Number(item.subtotal || qty * unitPrice);

                    return (
                        <div key={item.id || index} className="mb-1">
                            <p className="font-medium truncate">
                                {item.product?.title || "Produk"}
                            </p>
                            <div className="flex justify-between">
                                <span>
                                    {qty}x @ {formatPrice(unitPrice)}
                                </span>
                                <span>-{formatPrice(subtotal)}</span>
                            </div>
                            {item.return_reason && (
                                <p className="text-[10px] text-slate-500 italic">
                                    Alasan: {item.return_reason}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Exchange Items if product_exchange */}
            {isExchange && exchangeItems.length > 0 && (
                <>
                    <pre className="whitespace-pre-wrap">{dashLine}</pre>
                    <div className="my-1">
                        <p className="font-bold text-[11px] mb-1">
                            [BARANG PENGGANTI]
                        </p>
                        {exchangeItems.map((item, index) => {
                            const qty = Number(item.qty || 1);
                            const unitPrice = Number(item.unit_price || 0);
                            const subtotal = Number(
                                item.subtotal || qty * unitPrice
                            );

                            return (
                                <div key={item.id || index} className="mb-1">
                                    <p className="font-medium truncate">
                                        {item.product?.title || "Produk Pengganti"}
                                    </p>
                                    <div className="flex justify-between">
                                        <span>
                                            {qty}x @ {formatPrice(unitPrice)}
                                        </span>
                                        <span>{formatPrice(subtotal)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            <pre className="whitespace-pre-wrap">{dashLine}</pre>

            {/* Totals & Settlement */}
            <div className="my-1">
                {isExchange ? (
                    <>
                        <div className="flex justify-between">
                            <span>Total Retur</span>
                            <span>
                                -{formatPrice(salesReturn?.total_return_amount)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total Pengganti</span>
                            <span>
                                {formatPrice(salesReturn?.exchange_amount)}
                            </span>
                        </div>
                        <pre className="whitespace-pre-wrap">{dashLine}</pre>

                        {Number(salesReturn?.difference_amount || 0) > 0 ? (
                            <>
                                <div className="flex justify-between font-bold text-sm">
                                    <span>Kurang Bayar</span>
                                    <span>
                                        {formatPrice(
                                            salesReturn?.difference_amount
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>
                                        Bayar (
                                        {salesReturn?.exchange_payment_method
                                            ?.replaceAll("_", " ")
                                            .toUpperCase() || "TUNAI"}
                                        )
                                    </span>
                                    <span>
                                        {formatPrice(
                                            salesReturn?.exchange_cash ||
                                                salesReturn?.difference_amount
                                        )}
                                    </span>
                                </div>
                                {Number(salesReturn?.exchange_change || 0) >
                                    0 && (
                                    <div className="flex justify-between font-bold">
                                        <span>Kembali</span>
                                        <span>
                                            {formatPrice(
                                                salesReturn?.exchange_change
                                            )}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : Number(salesReturn?.difference_amount || 0) < 0 ? (
                            <>
                                <div className="flex justify-between font-bold text-sm">
                                    <span>
                                        {salesReturn?.credited_amount > 0
                                            ? "Saldo Toko (Deposit)"
                                            : "Refund Tunai"}
                                    </span>
                                    <span>
                                        {formatPrice(
                                            Math.abs(
                                                salesReturn?.difference_amount
                                            )
                                        )}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="flex justify-between font-bold text-sm">
                                <span>Selisih</span>
                                <span>Rp 0 (Tukar Pas)</span>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex justify-between font-bold text-sm">
                            <span>Total Retur</span>
                            <span>
                                {formatPrice(salesReturn?.total_return_amount)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>
                                {salesReturn?.return_type === "store_credit" ||
                                salesReturn?.credited_amount > 0
                                    ? "Saldo Toko (Deposit)"
                                    : "Refund Tunai"}
                            </span>
                            <span>
                                {formatPrice(
                                    salesReturn?.credited_amount ||
                                        salesReturn?.refund_amount ||
                                        salesReturn?.total_return_amount
                                )}
                            </span>
                        </div>
                    </>
                )}
            </div>

            <pre className="whitespace-pre-wrap">{line}</pre>

            {/* Footer */}
            <div className="text-center mt-2">
                <p className="text-xs">Terima kasih</p>
                <p className="text-xs">Simpan bukti ini sebagai konfirmasi</p>
                <p className="text-xs mt-1">#{salesReturn?.code}</p>
                <SimpleBarcode value={salesReturn?.code} />
            </div>

            {/* Print Styles */}
            <style>{`
                .thermal-receipt {
                    color: #0f172a !important;
                    background-color: #ffffff !important;
                }
                .thermal-receipt * {
                    color: inherit;
                }
                .thermal-receipt .text-slate-500 {
                    color: #64748b !important;
                }
                @media print {
                    .thermal-receipt {
                        width: 80mm !important;
                        margin: 0 !important;
                        padding: 2mm !important;
                        font-size: 10pt !important;
                        color: #000000 !important;
                        background-color: #ffffff !important;
                    }
                    .thermal-receipt * {
                        color: inherit;
                    }
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                }
            `}</style>
        </div>
    );
}

/**
 * Compact SalesReturn Thermal Receipt for 58mm printers
 */
export function SalesReturnThermalReceipt58mm({
    salesReturn,
    storeName = "TOKO",
    storePhone = "",
    storeEmail = "",
    storeWebsite = "",
}) {
    const formatPrice = (price = 0) => {
        return "Rp" + Number(price || 0).toLocaleString("id-ID");
    };

    const formatTime = (value) => {
        return new Date(value || Date.now()).toLocaleString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const isExchange = salesReturn?.return_type === "product_exchange";
    const items = salesReturn?.items || [];
    const exchangeItems = salesReturn?.exchange_items || [];
    const line = "-".repeat(24);

    const SimpleBarcode = ({ value }) => {
        const bars = (value || "").split("").map((char, idx) => {
            const weight = (char.charCodeAt(0) + idx * 17) % 4;
            return 2 + weight;
        });

        return (
            <div className="flex items-end gap-[2px] mt-2 justify-center">
                {bars.map((w, i) => (
                    <span
                        key={i}
                        style={{ width: `${w}px` }}
                        className="h-8 bg-black block"
                    />
                ))}
            </div>
        );
    };

    return (
        <div
            className="thermal-receipt-58 font-mono text-xs text-slate-900 bg-white"
            style={{
                width: "48mm",
                maxWidth: "48mm",
                padding: "1mm",
                margin: "0 auto",
                boxSizing: "border-box",
            }}
        >
            <div className="text-center">
                <p className="font-bold">{storeName}</p>
                {storePhone && <p>{storePhone}</p>}
                {storeEmail && <p className="text-[10px]">{storeEmail}</p>}
                {storeWebsite && <p className="text-[10px]">{storeWebsite}</p>}
            </div>

            <pre>{line}</pre>
            <div className="text-center font-bold text-[11px]">
                <p>{isExchange ? "TUKAR BARANG" : "RETUR PENJUALAN"}</p>
            </div>
            <pre>{line}</pre>
            <p>#{salesReturn?.code}</p>
            <p>Ref: {salesReturn?.transaction?.invoice || "-"}</p>
            <p>{formatTime(salesReturn?.completed_at || salesReturn?.created_at)}</p>
            <p>Kasir: {salesReturn?.cashier?.name || "-"}</p>
            <pre>{line}</pre>

            {/* Returned Items */}
            <p className="font-bold text-[10px]">[RETUR]</p>
            {items.map((item, i) => {
                const qty = Number(item.qty_return || item.qty || 1);
                const unitPrice = Number(item.unit_price || 0);
                const subtotal = Number(item.subtotal || qty * unitPrice);

                return (
                    <div key={i} className="mb-1">
                        <p className="truncate">{item.product?.title}</p>
                        <div className="flex justify-between">
                            <span>
                                {qty}x @ {formatPrice(unitPrice)}
                            </span>
                            <span>-{formatPrice(subtotal)}</span>
                        </div>
                    </div>
                );
            })}

            {/* Exchange items */}
            {isExchange && exchangeItems.length > 0 && (
                <>
                    <pre>{line}</pre>
                    <p className="font-bold text-[10px]">[PENGGANTI]</p>
                    {exchangeItems.map((item, i) => {
                        const qty = Number(item.qty || 1);
                        const unitPrice = Number(item.unit_price || 0);
                        const subtotal = Number(
                            item.subtotal || qty * unitPrice
                        );

                        return (
                            <div key={i} className="mb-1">
                                <p className="truncate">
                                    {item.product?.title || "Produk Pengganti"}
                                </p>
                                <div className="flex justify-between">
                                    <span>
                                        {qty}x @ {formatPrice(unitPrice)}
                                    </span>
                                    <span>{formatPrice(subtotal)}</span>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            <pre>{line}</pre>

            {/* Totals */}
            {isExchange ? (
                <>
                    <div className="flex justify-between">
                        <span>Retur</span>
                        <span>
                            -{formatPrice(salesReturn?.total_return_amount)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Pengganti</span>
                        <span>
                            {formatPrice(salesReturn?.exchange_amount)}
                        </span>
                    </div>
                    <pre>{line}</pre>
                    {Number(salesReturn?.difference_amount || 0) > 0 ? (
                        <>
                            <div className="flex justify-between font-bold">
                                <span>Kurang</span>
                                <span>
                                    {formatPrice(salesReturn?.difference_amount)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Bayar</span>
                                <span>
                                    {formatPrice(
                                        salesReturn?.exchange_cash ||
                                            salesReturn?.difference_amount
                                    )}
                                </span>
                            </div>
                            {Number(salesReturn?.exchange_change || 0) > 0 && (
                                <div className="flex justify-between font-bold">
                                    <span>Kembali</span>
                                    <span>
                                        {formatPrice(
                                            salesReturn?.exchange_change
                                        )}
                                    </span>
                                </div>
                            )}
                        </>
                    ) : Number(salesReturn?.difference_amount || 0) < 0 ? (
                        <div className="flex justify-between font-bold">
                            <span>Refund</span>
                            <span>
                                {formatPrice(
                                    Math.abs(salesReturn?.difference_amount)
                                )}
                            </span>
                        </div>
                    ) : (
                        <div className="flex justify-between font-bold">
                            <span>Selisih</span>
                            <span>Rp0 (Pas)</span>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="flex justify-between font-bold">
                        <span>Total Retur</span>
                        <span>
                            {formatPrice(salesReturn?.total_return_amount)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>Refund</span>
                        <span>
                            {formatPrice(
                                salesReturn?.refund_amount ||
                                    salesReturn?.credited_amount ||
                                    salesReturn?.total_return_amount
                            )}
                        </span>
                    </div>
                </>
            )}

            <pre>{line}</pre>
            <p className="text-center">Terima kasih!</p>
            <SimpleBarcode value={salesReturn?.code} />

            <style>{`
                .thermal-receipt-58 {
                    color: #0f172a !important;
                    background-color: #ffffff !important;
                }
                .thermal-receipt-58 * {
                    color: inherit;
                }
                .thermal-receipt-58 .text-slate-500 {
                    color: #64748b !important;
                }
                @media print {
                    html, body {
                        width: 48mm !important;
                        max-width: 48mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    .thermal-receipt-58 {
                        width: 48mm !important;
                        max-width: 48mm !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        font-family: 'Courier New', Courier, monospace !important;
                        font-size: 11pt !important;
                        line-height: 1.3 !important;
                        color: #000000 !important;
                        background-color: #ffffff !important;
                    }
                    .thermal-receipt-58 * {
                        color: inherit;
                    }
                    @page {
                        size: 58mm auto;
                        margin: 0mm;
                    }
                }
            `}</style>
        </div>
    );
}
