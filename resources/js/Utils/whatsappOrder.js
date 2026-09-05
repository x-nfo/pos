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
    storeName = "Toko",
    items = [],
    customerName = "",
    customerPhone = "",
    deliveryMethod = "pickup", // 'pickup' | 'delivery'
    deliveryAddress = "",
    notes = "",
    totalAmount = 0,
}) {
    const lines = [];

    lines.push(`Halo *${storeName}*, saya ingin memesan dari toko online:`);
    lines.push("");
    lines.push("📋 *RINCIAN PESANAN:*");

    items.forEach((item, index) => {
        const qty = item.qty || 1;
        const price = item.final_price || item.sell_price || 0;
        const subtotal = price * qty;
        lines.push(`${index + 1}. *${item.title}* (${qty}x) — ${formatRupiah(subtotal)}`);
    });

    lines.push("");
    lines.push(`💰 *Total Belanja:* *${formatRupiah(totalAmount)}*`);
    lines.push("");
    lines.push("👤 *DATA PEMESAN:*");
    lines.push(`• *Nama:* ${customerName || "-"}`);
    if (customerPhone) {
        lines.push(`• *No. WhatsApp:* ${customerPhone}`);
    }
    lines.push(
        `• *Pengambilan:* ${deliveryMethod === "delivery" ? "🚚 Kirim ke Alamat" : "🏪 Ambil di Toko"}`
    );

    if (deliveryMethod === "delivery" && deliveryAddress) {
        lines.push(`• *Alamat Pengiriman:* ${deliveryAddress}`);
    }

    if (notes) {
        lines.push(`• *Catatan:* ${notes}`);
    }

    lines.push("");
    lines.push("Mohon konfirmasi ketersediaan stok & rincian berikutnya ya. Terima kasih! 🙏");

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
