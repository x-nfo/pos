import React from "react";
import { Head, usePage } from "@inertiajs/react";

const formatPrice = (v = 0) => Number(v || 0).toLocaleString("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 });
const formatDate = (v) => v ? new Date(v).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" }) : "-";

const statusBadge = (status) => {
    const styles = { paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300", unpaid: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300", pending_approval: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };
    const labels = { paid: "Lunas", pending: "Menunggu", unpaid: "Belum Lunas", pending_approval: "Menunggu Approval" };
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[status] || "bg-slate-100 text-slate-600"}`}>{labels[status] || status}</span>;
};

export default function TransactionDetail({ transaction, token }) {
    const { storeProfile, branding } = usePage().props;
    const storeName = storeProfile?.name || branding?.appName || "STRUK PEMBELIAN";
    const logoSrc = storeProfile?.logo || branding?.logoLight || null;

    return (
        <>
            <Head title={`Invoice ${transaction.invoice} - ${storeName}`} />
            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-6 sm:py-10 px-4 flex items-center justify-center">
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                    {/* Header with Store Branding */}
                    <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-6 py-6 text-white text-center">
                        {logoSrc ? (
                            <img
                                src={logoSrc}
                                alt="Store Logo"
                                className="w-14 h-14 object-contain mx-auto mb-2 bg-white rounded-2xl p-1.5 shadow-md"
                            />
                        ) : null}
                        <h2 className="text-lg font-black tracking-tight">{storeName}</h2>
                        {storeProfile?.address && (
                            <p className="text-xs text-white/80 mt-0.5 max-w-xs mx-auto truncate">{storeProfile.address}</p>
                        )}
                        
                        <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/90">
                            <span className="font-mono font-bold tracking-wider">{transaction.invoice}</span>
                            <span className="text-white/80">{formatDate(transaction.created_at)}</span>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Status Pembayaran</span>
                            {statusBadge(transaction.payment_status)}
                        </div>

                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Pelanggan</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{transaction.customer_name || "Umum"}</span>
                        </div>

                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Kasir</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{transaction.cashier_name || "-"}</span>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">Rincian Item</p>
                            <div className="space-y-2">
                                {transaction.details.map((item, i) => (
                                    <div key={i} className="flex justify-between items-baseline text-sm">
                                        <div className="min-w-0 pr-2">
                                            <span className="text-slate-800 dark:text-slate-200 font-medium block truncate">{item.product_title}</span>
                                            <span className="text-xs text-slate-400">{item.qty} x {formatPrice(item.price)}</span>
                                        </div>
                                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono flex-shrink-0">{formatPrice(item.price * item.qty)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-sm">
                            <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                <span>Subtotal</span>
                                <span className="font-mono">{formatPrice(transaction.grand_total + transaction.discount - (transaction.shipping_cost || 0) - (transaction.tax_total || 0))}</span>
                            </div>
                            {transaction.discount > 0 && (
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                    <span>Diskon</span>
                                    <span className="font-mono">-{formatPrice(transaction.discount)}</span>
                                </div>
                            )}
                            {transaction.tax_total > 0 && (
                                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                    <span>PPN</span>
                                    <span className="font-mono">+{formatPrice(transaction.tax_total)}</span>
                                </div>
                            )}
                            {transaction.shipping_cost > 0 && (
                                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                    <span>Ongkos Kirim</span>
                                    <span className="font-mono">+{formatPrice(transaction.shipping_cost)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-baseline font-black text-lg pt-3 border-t border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                                <span>Total Bayar</span>
                                <span className="text-primary-600 dark:text-primary-400 font-mono">{formatPrice(transaction.grand_total)}</span>
                            </div>
                        </div>

                        {transaction.payment_method === "cash" && transaction.cash > 0 && (
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                                <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>Bayar Tunai</span><span className="font-mono font-medium">{formatPrice(transaction.cash)}</span></div>
                                {transaction.change > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold"><span>Kembalian</span><span className="font-mono">+{formatPrice(transaction.change)}</span></div>}
                            </div>
                        )}

                        {transaction.receivable && transaction.receivable.status !== "paid" && (
                            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 space-y-3">
                                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Sisa Tagihan / Piutang</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-amber-700 dark:text-amber-400 text-xs">Jatuh tempo: {formatDate(transaction.receivable.due_date)}</span>
                                    <span className="font-black text-amber-900 dark:text-amber-200 font-mono">{formatPrice(transaction.receivable.remaining)}</span>
                                </div>
                                <button
                                    type="button"
                                    className="block w-full text-center px-4 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-black uppercase tracking-wider shadow-sm active:scale-95 transition-transform"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const form = document.createElement("form");
                                        form.method = "POST";
                                        form.action = route("portal.receivable.pay", [transaction.receivable.id, { token }]);
                                        document.body.appendChild(form);
                                        form.submit();
                                    }}
                                >
                                    Bayar Sekarang
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500">
                        Terima kasih telah berbelanja di {storeName}! 🙏
                    </div>
                </div>
            </div>
        </>
    );
}
