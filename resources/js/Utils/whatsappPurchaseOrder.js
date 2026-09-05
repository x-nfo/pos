/**
 * Utility to format and share Purchase Orders via WhatsApp with clean formatting.
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
 * Generate formatted WhatsApp Purchase Order text string
 */
export function generateWhatsappPurchaseOrderText(
    order = {},
    storeProfile = {},
    branding = {}
) {
    if (!order) return "";

    const storeName =
        storeProfile?.name ||
        branding?.appName ||
        "Point of Sales";
    const storeAddress =
        storeProfile?.address &&
        !storeProfile.address.toLowerCase().includes("belum diisi")
            ? storeProfile.address.trim()
            : "";
    const storePhone =
        storeProfile?.phone &&
        !storeProfile.phone.toLowerCase().includes("belum diisi")
            ? storeProfile.phone.trim()
            : "";

    const supplierName = order.supplier?.name || "Supplier / Vendor";
    const warehouseName = order.warehouse ? `${order.warehouse.code} - ${order.warehouse.name}` : "Gudang Utama";
    const creatorName = order.creator?.name || "-";

    const lines = [];

    // Salam Pembuka B2B
    lines.push(`Kepada Yth. *${supplierName}*`);
    lines.push("");
    lines.push(`Halo, kami dari *${storeName}* ingin mengajukan pemesanan barang dengan rincian Purchase Order sebagai berikut:`);
    lines.push("");

    // Metadata PO
    lines.push(`*Nomor PO:* ${order.document_number || "-"}`);
    lines.push(`*Tanggal:* ${formatDateTime(order.created_at)}`);
    if (order.ordered_at) {
        lines.push(`*Tgl Pesan:* ${formatDateTime(order.ordered_at)}`);
    }
    lines.push(`*Tujuan Kirim:* ${warehouseName}`);
    if (order.warehouse?.address) {
        lines.push(`*Alamat Kirim:* ${order.warehouse.address}`);
    }
    if (order.warehouse?.phone) {
        lines.push(`*Kontak Gudang/Penerima:* ${order.warehouse.phone}`);
    }
    lines.push(`*Pembuat PO:* ${creatorName}`);
    lines.push("");

    // Daftar Barang
    lines.push(`*Daftar Barang yang Dipesan:*`);
    const items = order.items || [];
    let grandTotal = 0;
    let totalQty = 0;

    if (items.length > 0) {
        items.forEach((item, index) => {
            const title = item.product?.title || `Produk #${item.product_id}`;
            const sku = item.product?.sku ? ` (SKU: ${item.product.sku})` : "";
            const unitName = item.unit?.symbol || item.unit?.name || "Pcs";
            const qty = Number(item.qty_ordered || 0);
            const unitPrice = Number(item.unit_price || 0);
            const subtotal = qty * unitPrice;
            const isMulti = Number(item.conversion_factor) > 1;
            const convVal = item.conversion_factor == parseInt(item.conversion_factor, 10) ? parseInt(item.conversion_factor, 10) : item.conversion_factor;

            grandTotal += subtotal;
            totalQty += qty;

            const unitDisplay = isMulti ? `${qty} ${unitName} (@${convVal})` : `${qty} ${unitName}`;
            lines.push(`${index + 1}. *${title}*${sku}`);
            lines.push(`   • Qty: ${unitDisplay} x ${formatRupiah(unitPrice)} = ${formatRupiah(subtotal)}`);
        });
    } else {
        lines.push("Tidak ada item.");
    }

    lines.push("");
    lines.push(`*Estimasi Total:* *${formatRupiah(grandTotal)}* (${items.length} item / ${totalQty} unit)`);

    if (order.notes) {
        lines.push(`*Catatan:* ${order.notes}`);
    }

    // Link Publik PDF PO
    let publicUrl = "";
    try {
        if (typeof route === "function" && route().has("purchase-orders.public")) {
            publicUrl = route("purchase-orders.public", order.document_number, true);
        }
    } catch {
        // Fallback
    }

    if (!publicUrl && order.document_number && typeof window !== "undefined") {
        publicUrl = `${window.location.origin}/share/purchase-orders/${order.document_number}`;
    }

    if (publicUrl) {
        lines.push("");
        lines.push(`*Dokumen PO Resmi (PDF):*`);
        lines.push(publicUrl);
        lines.push(`_(Simpan nomor kontak kami atau balas pesan ini jika tautan belum bisa langsung diklik)_`);
    }

    lines.push("");
    lines.push("Mohon konfirmasi ketersediaan stok dan estimasi jadwal pengirimannya. Terima kasih atas kerja samanya.");

    if (storePhone || storeAddress) {
        lines.push("");
        lines.push(`*${storeName}*`);
        if (storeAddress) lines.push(storeAddress);
        if (storePhone) lines.push(`Kontak: ${storePhone}`);
    }

    return lines.join("\n");
}

/**
 * Generate WhatsApp share URL for Purchase Order
 */
export function getWhatsappPurchaseOrderUrl(
    order = {},
    storeProfile = {},
    branding = {}
) {
    const text = generateWhatsappPurchaseOrderText(order, storeProfile, branding);
    const phone = formatWhatsappPhone(order.supplier?.phone);

    if (phone) {
        return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Open WhatsApp directly with the formatted Purchase Order
 */
export function shareWhatsappPurchaseOrder({
    order,
    storeProfile = {},
    branding = {},
}) {
    const waUrl = getWhatsappPurchaseOrderUrl(order, storeProfile, branding);
    if (typeof window !== "undefined") {
        window.open(waUrl, "_blank", "noopener,noreferrer");
    }
    return true;
}
