import React, { useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import {
    IconPrinter,
    IconCheck,
    IconX,
    IconReceipt,
    IconWifiOff,
    IconBluetooth,
    IconUsb,
    IconLoader2,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { printViaBluetooth, isWebBluetoothSupported } from "@/Utils/webBluetoothPrinter";
import { printViaWebUsb } from "@/Utils/webUsbPrinter";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export default function OfflineReceiptModal({
    isOpen,
    onClose,
    transactionData,
}) {
    const { storeProfile, branding, auth } = usePage().props;
    const printAreaRef = useRef(null);
    const [isPrintingBt, setIsPrintingBt] = useState(false);
    const [isPrintingUsb, setIsPrintingUsb] = useState(false);

    if (!isOpen || !transactionData) return null;

    const baseStoreName = storeProfile?.name || branding?.appName || "Point of Sales";
    const warehouse = transactionData.warehouse || auth?.warehouse || auth?.user?.warehouse;
    const storeName = warehouse && warehouse.type !== "main" && warehouse.name
        ? `${baseStoreName} (${warehouse.name})`
        : baseStoreName;

    const clean = (val) => {
        if (!val || typeof val !== "string") return "";
        return val.toLowerCase().includes("belum diisi") ? "" : val.trim();
    };

    const storeAddress = clean(warehouse?.address) || clean(storeProfile?.address) || "";
    const storePhone = clean(warehouse?.phone) || clean(storeProfile?.phone) || "";
    const cashierName = transactionData.cashier_name || auth?.user?.name || "Kasir";
    const customerName = transactionData.customer?.name || "Pelanggan Umum";
    const clientTxId = transactionData.client_tx_id || "offline-trx";
    const createdAt = transactionData.created_at
        ? new Date(transactionData.created_at).toLocaleString("id-ID", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : new Date().toLocaleString("id-ID");

    const items = transactionData.items || [];
    const discount = Number(transactionData.discount || 0);
    const shipping = Number(transactionData.shipping_cost || 0);
    const grandTotal = Number(transactionData.grand_total || 0);
    const cash = Number(transactionData.cash || grandTotal);
    const change = Number(transactionData.change || Math.max(0, cash - grandTotal));
    const subtotal = items.reduce((acc, it) => acc + Number(it.price || 0), 0);

    const handleBrowserPrint = () => {
        window.print();
    };

    const handleBluetoothPrint = async () => {
        if (!isWebBluetoothSupported()) {
            toast.error(
                "Web Bluetooth tidak didukung di browser ini. Gunakan Google Chrome (Android/Desktop), Microsoft Edge, atau Opera.",
                { id: "bt-support-error" }
            );
            return;
        }

        try {
            setIsPrintingBt(true);
            const txForBt = {
                invoice: clientTxId,
                created_at: transactionData.created_at || new Date().toISOString(),
                cashier: { name: cashierName },
                customer: transactionData.customer || { name: customerName },
                details: items.map((it) => ({
                    product: it.product || { title: it.title || "Produk" },
                    qty: it.qty || 1,
                    unit: it.unit || null,
                    price: it.price || 0,
                    unit_price: it.unit_price || (it.price / Math.max(1, it.qty || 1)),
                    discount_total: it.discount_total || 0,
                })),
                grand_total: grandTotal,
                discount: discount,
                shipping_cost: shipping,
                payment_method: "cash",
                cash: cash,
                change: change,
            };

            await printViaBluetooth(
                txForBt,
                {
                    name: storeName,
                    address: storeAddress,
                    phone: storePhone,
                },
                "58mm"
            );

            toast.success("Struk berhasil dikirim ke Printer Bluetooth!", {
                icon: "🖨️",
            });
        } catch (err) {
            console.error("Bluetooth print error:", err);
            toast.error(err.message || "Gagal mencetak via Bluetooth");
        } finally {
            setIsPrintingBt(false);
        }
    };

    const handleUsbPrint = async () => {
        try {
            setIsPrintingUsb(true);
            const txForUsb = {
                invoice: clientTxId,
                created_at: transactionData.created_at || new Date().toISOString(),
                cashier: { name: cashierName },
                customer: transactionData.customer || { name: customerName },
                details: items.map((it) => ({
                    product: it.product || { title: it.title || "Produk" },
                    qty: it.qty || 1,
                    unit: it.unit || null,
                    price: it.price || 0,
                    unit_price: it.unit_price || (it.price / Math.max(1, it.qty || 1)),
                    discount_total: it.discount_total || 0,
                })),
                grand_total: grandTotal,
                discount: discount,
                shipping_cost: shipping,
                payment_method: "cash",
                cash: cash,
                change: change,
            };

            await printViaWebUsb(
                txForUsb,
                {
                    name: storeName,
                    address: storeAddress,
                    phone: storePhone,
                },
                "58mm"
            );

            toast.success("Struk berhasil dikirim ke Printer USB!", {
                icon: "🖨️",
            });
        } catch (err) {
            console.error("USB print error:", err);
            toast.error(err.message || "Gagal mencetak via USB");
        } finally {
            setIsPrintingUsb(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            {/* Print styling overrides to only print the receipt paper */}
            <style>
                {`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #offline-receipt-paper, #offline-receipt-paper * {
                        visibility: visible;
                    }
                    #offline-receipt-paper {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        max-width: 80mm !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        color: #000 !important;
                        background: #fff !important;
                    }
                }
                `}
            </style>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <IconReceipt size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                Struk Transaksi Offline
                            </h3>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <IconWifiOff size={12} className="text-amber-500" />
                                Tersimpan di memori perangkat
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                {/* Printable Receipt Paper */}
                <div className="flex-1 overflow-y-auto py-4">
                    <div
                        id="offline-receipt-paper"
                        ref={printAreaRef}
                        className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200"
                    >
                        {/* Store Header */}
                        <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
                            <div className="font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-white">
                                {storeName}
                            </div>
                            {storeAddress && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                    {storeAddress}
                                </div>
                            )}
                            {storePhone && (
                                <div className="text-[10px] text-slate-500">
                                    Telp: {storePhone}
                                </div>
                            )}
                            <div className="inline-block px-2 py-0.5 mt-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full border border-amber-300 dark:border-amber-700">
                                *** NOTA SEMENTARA (OFFLINE) ***
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-slate-300 dark:border-slate-700">
                            <div className="flex justify-between">
                                <span className="text-slate-500">No. Ref:</span>
                                <span className="font-semibold">{clientTxId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Tanggal:</span>
                                <span>{createdAt}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Kasir:</span>
                                <span>{cashierName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Pelanggan:</span>
                                <span>{customerName}</span>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="py-2.5 space-y-2 border-b border-dashed border-slate-300 dark:border-slate-700">
                            {items.map((item, idx) => {
                                const title = item.product?.title || item.title || "Produk";
                                const qty = item.qty || 1;
                                const unitLabel = item.unit?.symbol || item.unit?.code || "";
                                const unitPrice = Number(item.unit_price || item.price / Math.max(1, qty) || 0);
                                const itemTotal = Number(item.price || unitPrice * qty);

                                return (
                                    <div key={idx} className="space-y-0.5">
                                        <div className="font-medium text-slate-900 dark:text-white">
                                            {title} {unitLabel ? `(${unitLabel})` : ""}
                                        </div>
                                        <div className="flex justify-between text-slate-500 text-[11px]">
                                            <span>
                                                {qty} x {formatPrice(unitPrice)}
                                            </span>
                                            <span className="text-slate-800 dark:text-slate-200 font-semibold">
                                                {formatPrice(itemTotal)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Totals */}
                        <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-slate-300 dark:border-slate-700">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Subtotal:</span>
                                <span>{formatPrice(subtotal)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                                    <span>Diskon:</span>
                                    <span>-{formatPrice(discount)}</span>
                                </div>
                            )}
                            {shipping > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Ongkir:</span>
                                    <span>{formatPrice(shipping)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs font-bold text-slate-950 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                                <span>Total:</span>
                                <span>{formatPrice(grandTotal)}</span>
                            </div>
                            <div className="flex justify-between pt-1">
                                <span className="text-slate-500">Tunai:</span>
                                <span>{formatPrice(cash)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Kembalian:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatPrice(change)}
                                </span>
                            </div>
                        </div>

                        {/* Footer Message */}
                        <div className="text-center pt-3 text-[10px] text-slate-500 space-y-1">
                            <div>Terima Kasih atas Kunjungan Anda</div>
                            <div className="italic text-[9px]">
                                Transaksi akan disinkronkan ke server secara otomatis saat online kembali.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="grid grid-cols-2 gap-2">
                        {/* Bluetooth Printer Button */}
                        <button
                            type="button"
                            onClick={handleBluetoothPrint}
                            disabled={isPrintingBt}
                            className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                            title="Cetak langsung ke Thermal Printer Bluetooth"
                        >
                            {isPrintingBt ? (
                                <IconLoader2 size={16} className="animate-spin" />
                            ) : (
                                <IconBluetooth size={16} />
                            )}
                            <span>{isPrintingBt ? "Menghubungkan..." : "Bluetooth"}</span>
                        </button>

                        {/* USB Printer Button */}
                        <button
                            type="button"
                            onClick={handleUsbPrint}
                            disabled={isPrintingUsb}
                            className="py-2.5 px-3 bg-teal-600 hover:bg-teal-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20 transition-all cursor-pointer"
                            title="Cetak langsung ke Thermal Printer USB"
                        >
                            {isPrintingUsb ? (
                                <IconLoader2 size={16} className="animate-spin" />
                            ) : (
                                <IconUsb size={16} />
                            )}
                            <span>{isPrintingUsb ? "Menghubungkan..." : "USB Thermal"}</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {/* Browser Print Button */}
                        <button
                            type="button"
                            onClick={handleBrowserPrint}
                            className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                            title="Cetak menggunakan dialog print browser"
                        >
                            <IconPrinter size={16} />
                            <span>Cetak Browser</span>
                        </button>

                        {/* Next Transaction Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-98 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                            <IconCheck size={16} />
                            <span>Transaksi Baru</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
