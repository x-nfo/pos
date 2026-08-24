/**
 * WebUSB ESC/POS Printer Utility for Thermal Printers
 */

export function buildEscPosReceipt(transaction, storeInfo = {}, paperSize = "58mm") {
    const encoder = new TextEncoder();
    const maxWidth = paperSize === "58mm" ? 32 : 48;
    const parts = [];

    const leftRight = (left, right) => {
        const l = (left || "").toString().substring(0, maxWidth - 15);
        const r = (right || "").toString().substring(0, 14);
        const spaces = Math.max(1, maxWidth - l.length - r.length);
        return l + " ".repeat(spaces) + r + "\n";
    };

    const center = (text) => {
        const t = (text || "").toString().trim().substring(0, maxWidth);
        const pad = Math.max(0, Math.floor((maxWidth - t.length) / 2));
        return " ".repeat(pad) + t + "\n";
    };

    const line = (char = "-") => char.repeat(maxWidth) + "\n";

    // ESC/POS Init
    parts.push(new Uint8Array([0x1b, 0x40])); // ESC @ (initialize)
    parts.push(new Uint8Array([0x1b, 0x61, 0x01])); // ESC a 1 (center alignment)
    parts.push(new Uint8Array([0x1b, 0x45, 0x01])); // ESC E 1 (bold on)
    parts.push(encoder.encode((storeInfo.name || "TOKO ANDA").toUpperCase() + "\n"));
    parts.push(new Uint8Array([0x1b, 0x45, 0x00])); // ESC E 0 (bold off)

    if (storeInfo.address) parts.push(encoder.encode(center(storeInfo.address)));
    if (storeInfo.phone) parts.push(encoder.encode(center("Telp: " + storeInfo.phone)));

    parts.push(new Uint8Array([0x1b, 0x61, 0x00])); // ESC a 0 (left alignment)
    parts.push(encoder.encode(line("=")));
    parts.push(encoder.encode("No: " + (transaction.invoice || "") + "\n"));
    parts.push(encoder.encode("Tgl: " + new Date(transaction.created_at || Date.now()).toLocaleString("id-ID") + "\n"));
    parts.push(encoder.encode("Kasir: " + (transaction.cashier?.name || "-") + "\n"));
    parts.push(encoder.encode("Pelanggan: " + (transaction.customer?.name || "Umum") + "\n"));
    parts.push(encoder.encode(line("=")));

    (transaction.details || []).forEach((item) => {
        const title = item.product?.title || "Produk";
        const qty = item.qty || 1;
        const total = Number(item.price || 0);
        const unitPrice = Number(item.unit_price || (total / Math.max(1, qty)));
        const unitSymbol = item.unit?.symbol ? " " + item.unit.symbol : "";

        parts.push(encoder.encode(title.substring(0, maxWidth) + "\n"));
        parts.push(encoder.encode(leftRight(`${qty}${unitSymbol}x @ ${unitPrice.toLocaleString("id-ID")}`, total.toLocaleString("id-ID"))));
    });

    parts.push(encoder.encode(line("-")));

    const promoDiscount = (transaction.details || []).reduce((acc, curr) => acc + Number(curr.discount_total || 0), 0);
    const voucherDiscount = Number(transaction.customer_voucher_discount || 0);
    const loyaltyDiscount = Number(transaction.loyalty_discount_total || 0);
    const subtotal = (Number(transaction.grand_total || 0) + Number(transaction.discount || 0) - Number(transaction.shipping_cost || 0) - Number(transaction.tax_total || 0)) + promoDiscount + voucherDiscount + loyaltyDiscount;

    parts.push(encoder.encode(leftRight("Subtotal", subtotal.toLocaleString("id-ID"))));
    if (promoDiscount > 0) parts.push(encoder.encode(leftRight("Promo", "-" + promoDiscount.toLocaleString("id-ID"))));
    if (transaction.discount > 0) parts.push(encoder.encode(leftRight("Diskon", "-" + Number(transaction.discount).toLocaleString("id-ID"))));
    if (voucherDiscount > 0) parts.push(encoder.encode(leftRight("Voucher", "-" + voucherDiscount.toLocaleString("id-ID"))));
    if (loyaltyDiscount > 0) parts.push(encoder.encode(leftRight("Poin", "-" + loyaltyDiscount.toLocaleString("id-ID"))));
    if (transaction.tax_total > 0) parts.push(encoder.encode(leftRight("PPN", Number(transaction.tax_total).toLocaleString("id-ID"))));

    parts.push(encoder.encode(line("-")));
    parts.push(new Uint8Array([0x1b, 0x45, 0x01])); // bold on
    parts.push(encoder.encode(leftRight("TOTAL", Number(transaction.grand_total || 0).toLocaleString("id-ID"))));
    parts.push(new Uint8Array([0x1b, 0x45, 0x00])); // bold off

    if (transaction.payment_method === "cash" && transaction.cash > 0) {
        parts.push(encoder.encode(leftRight("Bayar (Tunai)", Number(transaction.cash).toLocaleString("id-ID"))));
        if (transaction.change > 0) {
            parts.push(encoder.encode(leftRight("Kembali", Number(transaction.change).toLocaleString("id-ID"))));
        }
    }

    parts.push(encoder.encode(line("=")));
    parts.push(new Uint8Array([0x1b, 0x61, 0x01])); // center alignment
    parts.push(encoder.encode("Terima Kasih\nBarang yang sudah dibeli\ntidak dapat ditukar/dikembalikan\n\n\n\n"));
    parts.push(new Uint8Array([0x1d, 0x56, 0x41, 0x00])); // GS V A 0 (paper cut)

    // Combine byte arrays
    const totalLength = parts.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of parts) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }

    return combined;
}

export async function printViaWebUsb(transaction, storeInfo = {}, paperSize = "58mm") {
    if (!navigator?.usb) {
        throw new Error("WebUSB tidak didukung di browser ini. Gunakan Chrome, Edge, atau Opera.");
    }

    const device = await navigator.usb.requestDevice({ filters: [] });
    await device.open();
    if (device.configuration === null) {
        await device.selectConfiguration(1);
    }
    await device.claimInterface(0);

    const data = buildEscPosReceipt(transaction, storeInfo, paperSize);
    
    // Find OUT endpoint
    const endpoint = device.configuration.interfaces[0]?.alternate?.endpoints?.find(
        (e) => e.direction === "out"
    );
    const endpointNumber = endpoint ? endpoint.endpointNumber : 1;

    await device.transferOut(endpointNumber, data);
    await device.close();
    return true;
}
