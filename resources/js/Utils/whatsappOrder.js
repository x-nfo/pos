/**
 * Helper utilities for WhatsApp Commerce order formatting and redirection
 */

export function cleanWhatsAppNumber(phone) {
    if (!phone) return "";
    let cleaned = String(phone).replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
        cleaned = "62" + cleaned.slice(1);
    } else if (cleaned.startsWith("8")) {
        cleaned = "62" + cleaned;
    }
    return cleaned;
}

export function formatRupiah(val) {
    return Number(val || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });
}

export function generateWhatsAppOrderMessage({
    orderNumber = "",
    trackingUrl = "",
    storeName = "Toko",
    items = [],
    customerName = "",
    customerPhone = "",
    deliveryMethod = "pickup", // 'pickup' | 'delivery'
    deliveryAddress = "",
    shippingCourier = "",
    shippingService = "",
    shippingCost = 0,
    shippingEtd = "",
    shippingDestination = "",
    notes = "",
    totalAmount = 0,
    couponCode = "",
    discountAmount = 0,
    bankName = "",
    bankAccountNumber = "",
    bankAccountName = "",
    hasPaymentProof = false,
}) {
    const lines = [];

    lines.push(`Halo *${storeName}*, saya ingin memesan dari toko online:`);
    if (orderNumber) {
        lines.push(`🔖 *No. Pesanan:* *${orderNumber}*`);
    }
    lines.push("");
    lines.push("📋 *RINCIAN PESANAN:*");

    items.forEach((item, index) => {
        const qty = item.qty || 1;
        const price = item.final_price || item.sell_price || 0;
        const subtotal = price * qty;
        const unitLabel = item.unit_name || item.unit_symbol || item.unit_code ? ` ${item.unit_name || item.unit_symbol || item.unit_code}` : "x";
        lines.push(`${index + 1}. *${item.title || item.product_title}* (${qty}${unitLabel}) — ${formatRupiah(subtotal)}`);
    });

    lines.push("");
    lines.push(`🛍️ *Subtotal Produk:* ${formatRupiah(totalAmount)}`);

    if (discountAmount > 0) {
        lines.push(`🏷️ *Diskon Kupon (${couponCode || "PROMO"}):* -${formatRupiah(discountAmount)}`);
    }

    const discountedTotal = Math.max(0, Number(totalAmount) - Number(discountAmount));
    const hasShipping = deliveryMethod === "delivery" && (Number(shippingCost) > 0 || shippingCourier);
    if (hasShipping) {
        const courierInfo = [shippingCourier, shippingService].filter(Boolean).join(" ");
        const etdInfo = shippingEtd ? ` (${shippingEtd} hari)` : "";
        lines.push(`🚚 *Ongkos Kirim (${courierInfo}${etdInfo}):* ${formatRupiah(shippingCost)}`);
        lines.push(`💰 *Grand Total (Termasuk Ongkir):* *${formatRupiah(discountedTotal + Number(shippingCost))}*`);
    } else {
        lines.push(`💰 *Total Belanja:* *${formatRupiah(discountedTotal)}*`);
    }

    lines.push("");
    lines.push("👤 *DATA PEMESAN:*");
    lines.push(`• *Nama:* ${customerName || "-"}`);
    if (customerPhone) {
        lines.push(`• *No. WhatsApp:* ${customerPhone}`);
    }
    lines.push(
        `• *Pengambilan:* ${deliveryMethod === "delivery" ? "🚚 Kirim ke Alamat" : "🏪 Ambil di Toko"}`
    );

    if (deliveryMethod === "delivery") {
        if (shippingDestination) {
            lines.push(`• *Kecamatan/Kota Tujuan:* ${shippingDestination}`);
        }
        if (deliveryAddress) {
            lines.push(`• *Alamat Lengkap:* ${deliveryAddress}`);
        }
        if (shippingCourier) {
            lines.push(`• *Kurir Pilihan:* ${shippingCourier} - ${shippingService || "Reguler"}`);
        }
    }

    if (notes) {
        lines.push(`• *Catatan:* ${notes}`);
    }

    lines.push("");
    lines.push("💳 *PEMBAYARAN:*");
    lines.push("• *Metode:* Transfer Bank");
    if (bankName) {
        const accInfo = [bankAccountNumber, bankAccountName ? `a/n ${bankAccountName}` : ""].filter(Boolean).join(" ");
        lines.push(`• *Rekening Tujuan:* ${bankName}${accInfo ? ` (${accInfo})` : ""}`);
    }
    if (hasPaymentProof) {
        lines.push("• *Bukti Transfer:* ✅ Sudah diunggah ke sistem (saya juga melampirkan foto bukti transfer di chat ini)");
    }

    if (trackingUrl) {
        lines.push("");
        lines.push(`📍 *Lacak Status Pesanan:* ${trackingUrl}`);
    }

    lines.push("");
    lines.push("Mohon konfirmasi pesanan & verifikasi pembayarannya ya. Terima kasih! 🙏");

    return lines.join("\n");
}

export function openWhatsAppOrder({
    phone,
    message,
}) {
    const cleanPhone = cleanWhatsAppNumber(phone);
    const encoded = encodeURIComponent(message);
    const url = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
        : `https://api.whatsapp.com/send?text=${encoded}`;

    window.open(url, "_blank", "noopener,noreferrer");
}
