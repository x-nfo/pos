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
                        }
                    }
                `}
            </style>

            <div
                className="shipping-label-container bg-white text-slate-800 border border-slate-200 rounded-xl shadow-md relative overflow-hidden box-border"
                style={{
                    width: "425.2pt",
                    height: "283.5pt",
                    maxWidth: "100%",
                    padding: "12pt",
                    fontFamily: "'Helvetica', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    color: "#1e293b",
                }}
            >
                {/* Header Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto", marginBottom: "5pt" }}>
                    <tbody>
                        <tr>
                            <td style={{ width: "1%", paddingRight: "8pt", verticalAlign: "middle" }}>
                                <div style={{ width: "40pt", height: "40pt", display: "block" }}>
                                    {storeLogo ? (
                                        <img
                                            src={storeLogo}
                                            alt={storeName}
                                            style={{ maxWidth: "40pt", maxHeight: "40pt", objectFit: "contain" }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: "40pt",
                                                height: "40pt",
                                                border: "1px solid #e2e8f0",
                                                lineHeight: "40pt",
                                                textAlign: "center",
                                                fontWeight: "bold",
                                                fontSize: "17pt",
                                            }}
                                        >
                                            {storeName.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td style={{ textAlign: "left", verticalAlign: "middle", padding: "0 4pt" }}>
                                <div style={{ fontSize: "13pt", fontWeight: "bold", lineHeight: 1.1 }}>
                                    {storeName}
                                </div>
                                <div style={{ fontSize: "7pt", color: "#64748b", marginTop: "3pt" }}>
                                    {storeAddress ? (storeAddress.length > 60 ? storeAddress.substring(0, 60) + "..." : storeAddress) : ""}
                                </div>
                                <div style={{ fontSize: "7pt", color: "#64748b", marginTop: "2pt", letterSpacing: "0.7pt" }}>
                                    {storePhone}{storePhone && storeEmail ? " | " : ""}{storeEmail}
                                </div>
                            </td>
                            <td style={{ width: "180pt", textAlign: "right", verticalAlign: "top", padding: "0 4pt" }}>
                                <div style={{ fontSize: "7pt", color: "#64748b" }}>INVOICE</div>
                                <div style={{ fontSize: "15pt", fontWeight: "bold", color: "#000", lineHeight: 1.1 }}>
                                    {transaction?.invoice}
                                </div>
                                <div style={{ fontSize: "8pt", color: "#1e293b" }}>
                                    {formatDate(transaction?.created_at)}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div style={{ borderTop: "1px solid #e2e8f0", margin: "8pt 0" }} />

                {/* Section Penerima & Ringkasan Pesanan */}
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                        <tr>
                            <td style={{ width: "65%", paddingRight: "5pt", verticalAlign: "top" }}>
                                <div
                                    style={{
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "6pt",
                                        padding: "6pt",
                                        height: "65pt",
                                        boxSizing: "border-box",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "7pt",
                                            textTransform: "uppercase",
                                            color: "#64748b",
                                            fontWeight: "bold",
                                            marginBottom: "3pt",
                                        }}
                                    >
                                        Penerima
                                    </div>
                                    <div style={{ fontSize: "10pt", fontWeight: "bold", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {customer.name || "Umum"}
                                    </div>
                                    <div style={{ fontSize: "8pt", color: "#64748b", marginTop: "5px", marginBottom: "5px" }}>
                                        {customerPhone}
                                    </div>
                                    <div style={{ fontSize: "8pt", color: "#64748b", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {customerAddress ? (customerAddress.length > 80 ? customerAddress.substring(0, 80) + "..." : customerAddress) : "No Address"}
                                    </div>
                                    <div style={{ fontSize: "8pt", color: "#64748b", marginTop: "2pt", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {regionString}
                                    </div>
                                </div>
                            </td>
                            <td style={{ width: "35%", paddingLeft: "5pt", verticalAlign: "top" }}>
                                <div
                                    style={{
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "6pt",
                                        padding: "6pt",
                                        height: "65pt",
                                        boxSizing: "border-box",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "7pt",
                                            textTransform: "uppercase",
                                            color: "#64748b",
                                            fontWeight: "bold",
                                            marginBottom: "3pt",
                                        }}
                                    >
                                        Ringkasan Pesanan
                                    </div>
                                    <table style={{ width: "100%", fontSize: "8pt", borderCollapse: "collapse" }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ color: "#1e293b" }}>Item</td>
                                                <td style={{ textAlign: "right", color: "#1e293b" }}>{itemCount} unit</td>
                                            </tr>
                                            <tr>
                                                <td style={{ paddingTop: "15pt", fontWeight: "bold", color: "#1e293b", fontSize: "10pt" }}>
                                                    Total
                                                </td>
                                                <td style={{ paddingTop: "15pt", textAlign: "right", fontWeight: "bold", color: "#1e293b", fontSize: "10pt" }}>
                                                    {formatPrice(transaction?.grand_total)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Daftar Produk */}
                <div
                    style={{
                        fontSize: "7pt",
                        textTransform: "uppercase",
                        color: "#64748b",
                        fontWeight: "bold",
                        marginTop: "10pt",
                        marginBottom: "2pt",
                    }}
                >
                    Daftar Produk
                </div>
                <div style={{ height: "50pt", overflow: "hidden" }}>
                    <ul style={{ margin: 0, paddingLeft: "12pt", listStyleType: "disc" }}>
                        {displayedProducts.map((detail, idx) => {
                            const title = detail.product?.title || "Produk";
                            const truncatedTitle = title.length > 40 ? title.substring(0, 40) + "..." : title;
                            return (
                                <li key={idx} style={{ fontSize: "8pt", marginBottom: "2pt", color: "#1e293b" }}>
                                    {truncatedTitle} ({detail.qty}x)
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Footer Absolute */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "15pt",
                        left: "15pt",
                        right: "15pt",
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: "8pt",
                    }}
                >
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
                        <tbody>
                            <tr>
                                <td style={{ verticalAlign: "bottom", paddingBottom: "2pt", lineHeight: 1.5, color: "#64748b", fontSize: "7pt" }}>
                                    Admin: <strong style={{ color: "#1e293b" }}>{transaction?.cashier?.name || "-"}</strong>
                                    <br />
                                    Dicetak: {getPrintDate()}
                                </td>
                                <td style={{ textAlign: "right", width: "150pt", verticalAlign: "bottom" }}>
                                    <div style={{ textAlign: "right", width: "220pt", float: "right" }}>
                                        <svg
                                            ref={barcodeRef}
                                            style={{
                                                height: "35pt",
                                                width: "100%",
                                                maxWidth: "220pt",
                                                display: "block",
                                                marginLeft: "auto",
                                            }}
                                        />
                                        <div
                                            style={{
                                                fontSize: "8pt",
                                                fontWeight: "bold",
                                                letterSpacing: "2pt",
                                                marginTop: "5pt",
                                                color: "#000",
                                                textAlign: "center",
                                            }}
                                        >
                                            {transaction?.invoice}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
