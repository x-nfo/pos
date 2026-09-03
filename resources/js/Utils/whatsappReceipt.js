/**
 * Utility to format and share transaction receipts via WhatsApp with clean receipt details + public link.
 */

const formatRupiah = (value = 0) =>
    "Rp " +
    Number(value || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    const pad = (n) => String(n).padStart(2, "0");
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export function formatPaymentMethod(method) {
    if (!method) return "Tunai (Cash)";
    const map = {
        cash: "Tunai (Cash)",
        bank_transfer: "Transfer Bank",
        qris: "QRIS",
        midtrans: "Midtrans Gateway",
        xendit: "Xendit Gateway",
        pay_later: "Tempo / Piutang",
        point: "Poin Loyalitas",
    };
    return map[method] || String(method).toUpperCase();
}

/**
 * Generate formatted WhatsApp receipt text string with clean linebreaks and no broken emoji symbols
 */
export function generateWhatsappReceiptText(
    transaction = {},
    storeProfile = {},
    branding = {}
) {
    if (!transaction) return "";

    const baseStoreName =
        storeProfile?.name ||
        branding?.appName ||
        "Point of Sales";
    const warehouse = transaction?.warehouse || transaction?.cashier?.warehouse;
    const storeName =
        warehouse && warehouse.type !== "main" && warehouse.name
            ? `${baseStoreName} (${warehouse.name})`
            : baseStoreName;

    const clean = (val) => {
        if (!val || typeof val !== "string") return "";
        return val.toLowerCase().includes("belum diisi") ? "" : val.trim();
    };

    const storeAddress = clean(warehouse?.address) || clean(storeProfile?.address);
    const storePhone = clean(warehouse?.phone) || clean(storeProfile?.phone);

    const cashierName =
        transaction.cashier?.name ||
        transaction.cashier_name ||
        "-";
    const customerName =
        transaction.customer?.name ||
        transaction.customer_name ||
        "Umum";

    const lines = [];

    const isPaid = transaction.payment_status === "paid";
    const sepDouble = "======================";
    const sepSingle = "----------------------";

    // Header Toko (Gaya Struk 58mm)
    lines.push(isPaid ? "*STRUK PEMBELIAN (LUNAS)*" : "*TAGIHAN PEMBELIAN*");
    lines.push(`*${storeName.toUpperCase()}*`);
    if (storeAddress) lines.push(storeAddress);
    if (storePhone) lines.push(`Telp: ${storePhone}`);
    lines.push(sepDouble);

    // Metadata Transaksi Ringkas
    lines.push(`Nota  : ${transaction.invoice || "-"}`);
    lines.push(`Tgl   : ${formatDateTime(transaction.created_at)}`);
    lines.push(`Kasir : ${cashierName}`);
    lines.push(`Plg   : ${customerName}`);
    lines.push(sepDouble);

    // Rincian Item (Compact 58mm Style)
    const items = transaction.details || [];
    if (items.length > 0) {
        items.forEach((item) => {
            const title =
                item.product?.title ||
                item.product_title ||
                item.title ||
                "Produk";
            const qty = Number(item.qty || 1);
            const unitSymbol = item.unit?.symbol ? ` ${item.unit.symbol}` : " pcs";
            const unitPrice = Number(
                item.unit_price ||
                    (item.price ? item.price / Math.max(1, qty) : 0)
            );
            const lineTotal = Number(item.price || qty * unitPrice);

            lines.push(`*${title}*`);
            lines.push(
                `${qty}${unitSymbol} x ${formatRupiah(unitPrice)} = ${formatRupiah(lineTotal)}`
            );
            if (Number(item.discount_total || 0) > 0) {
                lines.push(
                    `(Diskon: -${formatRupiah(item.discount_total)})`
                );
            }
        });
    } else {
        lines.push(`Total: ${formatRupiah(transaction.grand_total)}`);
    }

    lines.push(sepDouble);

    // Ringkasan Keuangan
    const discount = Number(transaction.discount || 0);
    const taxTotal = Number(transaction.tax_total || 0);
    const shippingCost = Number(transaction.shipping_cost || 0);
    const grandTotal = Number(transaction.grand_total || 0);
    const subtotal =
        grandTotal + discount - taxTotal - shippingCost;

    lines.push(`Subtotal : ${formatRupiah(subtotal)}`);
    if (discount > 0) {
        lines.push(`Diskon   : -${formatRupiah(discount)}`);
    }
    if (taxTotal > 0) {
        lines.push(`PPN      : +${formatRupiah(taxTotal)}`);
    }
    if (shippingCost > 0) {
        lines.push(`Ongkir   : +${formatRupiah(shippingCost)}`);
    }

    lines.push(sepSingle);
    lines.push(`*TOTAL    : ${formatRupiah(grandTotal)}*`);

    // Metode Pembayaran & Tunai
    lines.push(`Metode   : ${formatPaymentMethod(transaction.payment_method)}`);
    lines.push(`Status   : ${isPaid ? "LUNAS" : "BELUM LUNAS"}`);

    const cash = Number(transaction.cash || 0);
    const change = Number(transaction.change || 0);

    if (transaction.payment_method === "cash" || cash > 0) {
        lines.push(`Bayar    : ${formatRupiah(cash)}`);
        if (change > 0) {
            lines.push(`Kembali  : ${formatRupiah(change)}`);
        }
    }

    if (!isPaid && transaction.payment_method === "bank_transfer" && transaction.bank_account) {
        lines.push(sepSingle);
        lines.push("*Info Transfer:*");
        lines.push(`Bank : ${transaction.bank_account.bank_name}`);
        lines.push(`Rek  : ${transaction.bank_account.account_number}`);
        lines.push(`A/N  : ${transaction.bank_account.account_name}`);
    }

    if (transaction.receivable && transaction.payment_method === "pay_later") {
        const remaining = Number(
            transaction.receivable.remaining ??
                grandTotal - (transaction.receivable.paid || 0)
        );
        lines.push(sepSingle);
        lines.push(`Sisa Tagihan : ${formatRupiah(remaining)}`);
        if (transaction.receivable.due_date) {
            lines.push(
                `Jatuh Tempo  : ${formatDateTime(transaction.receivable.due_date).split(" ")[0]}`
            );
        }
    }

    lines.push(sepDouble);
    lines.push("Terima kasih atas kunjungan Anda!");

    // Link Publik
    let publicUrl = "";
    try {
        if (typeof route === "function") {
            publicUrl = route("transactions.public", transaction.invoice, true);
        }
    } catch {
        // Fallback
    }

    if (!publicUrl && transaction.invoice && typeof window !== "undefined") {
        publicUrl = `${window.location.origin}/share/transactions/${transaction.invoice}`;
    }

    if (publicUrl) {
        lines.push(sepSingle);
        lines.push("*Nota Online:*");
        lines.push(publicUrl);
    }

    return lines.join("\n");
}

/**
 * Format phone number for WhatsApp link (628xxx)
 */
export function formatWhatsappPhone(rawPhone) {
    if (!rawPhone) return "";
    let clean = String(rawPhone).replace(/\D/g, "");
    if (clean.startsWith("0")) {
        clean = "62" + clean.slice(1);
    } else if (clean.startsWith("8")) {
        clean = "62" + clean;
    }
    return clean;
}

/**
 * Generate WhatsApp share URL with API endpoint to preserve newline breaks
 */
export function getWhatsappShareUrl(
    transaction = {},
    storeProfile = {},
    branding = {}
) {
    const text = generateWhatsappReceiptText(
        transaction,
        storeProfile,
        branding
    );
    const phone =
        formatWhatsappPhone(transaction.customer?.no_telp) ||
        formatWhatsappPhone(transaction.customer_phone);

    if (phone) {
        return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Share WhatsApp receipt directly (opens WhatsApp with intact linebreaks)
 */
export function shareWhatsappReceipt({
    transaction,
    storeProfile = {},
    branding = {},
}) {
    const waUrl = getWhatsappShareUrl(transaction, storeProfile, branding);
    if (typeof window !== "undefined") {
        window.open(waUrl, "_blank", "noopener,noreferrer");
    }
    return true;
}
