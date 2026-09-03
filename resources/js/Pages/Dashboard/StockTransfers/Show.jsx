import React, { useState, useEffect } from "react";
import { Head, Link, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Modal from "@/Components/Modal";
import {
    IconArrowLeft,
    IconArrowsLeftRight,
    IconSend,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconPackage,
    IconInfoCircle,
    IconRulerMeasure,
} from "@tabler/icons-react";
import { useAuthorization } from "@/Utils/authorization";
import toast from "react-hot-toast";

const formatDateTime = (value) => {
    if (!value) return "-";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));
};

const statusBadge = (status) => {
    const styles = {
        draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        in_transit: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
        completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
        cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    };
    const labels = { draft: "Draft", in_transit: "In Transit", completed: "Selesai", cancelled: "Batal" };
    return <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${styles[status] || styles.draft}`}>{labels[status] || status}</span>;
};

export default function Show({ transfer }) {
    const { can } = useAuthorization();

    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [receiveItems, setReceiveItems] = useState([]);
    const [submittingReceive, setSubmittingReceive] = useState(false);

    useEffect(() => {
        if (transfer && transfer.items) {
            setReceiveItems(
                transfer.items.map((item) => {
                    const unitName = item.unit?.name || "Unit";
                    const unitSymbol = item.unit?.symbol || item.unit?.code || "unit";
                    const conversionFactor = Number(item.conversion_factor) || 1.0;

                    return {
                        id: item.id,
                        product_id: item.product_id,
                        product_title: item.product?.title || "-",
                        product_sku: item.product?.sku || "-",
                        unit_name: unitName,
                        unit_symbol: unitSymbol,
                        conversion_factor: conversionFactor,
                        qty: item.qty,
                        received_qty: item.received_qty !== null && item.received_qty !== undefined ? item.received_qty : item.qty,
                        notes: item.notes || "",
                    };
                })
            );
        }
    }, [transfer]);

    const handleReceiveItemChange = (index, field, value) => {
        const updated = [...receiveItems];
        if (field === "received_qty") {
            const parsed = parseInt(value, 10);
            const validVal = isNaN(parsed) ? 0 : Math.max(0, Math.min(updated[index].qty, parsed));
            updated[index].received_qty = validVal;
        } else {
            updated[index][field] = value;
        }
        setReceiveItems(updated);
    };

    const confirmReceiveSubmit = (e) => {
        e.preventDefault();
        setSubmittingReceive(true);

        router.post(
            route("stock-transfers.receive", transfer.id),
            {
                items: receiveItems.map((item) => ({
                    id: item.id,
                    received_qty: item.received_qty,
                    notes: item.notes,
                })),
            },
            {
                onSuccess: () => {
                    setIsReceiveModalOpen(false);
                    toast.success("Transfer stok berhasil diterima.");
                },
                onError: (errors) => {
                    toast.error(errors.transfer || "Gagal memproses penerimaan transfer.");
                },
                onFinish: () => {
                    setSubmittingReceive(false);
                },
            }
        );
    };

    const confirmAction = (action, label) => {
        if (!confirm(`Yakin ingin ${label} transfer ini?`)) return;
        router.post(route(`stock-transfers.${action}`, transfer.id), {}, {
            onError: (errors) => {
                toast.error(errors.transfer || `Gagal ${label} transfer.`);
            },
        });
    };

    const hasAnyDifference = receiveItems.some((item) => item.received_qty < item.qty);

    return (
        <>
            <Head title={`Transfer ${transfer.document_number}`} />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
                    <div className="min-w-0">
                        <Link href={route("stock-transfers.index")} className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400">
                            <IconArrowLeft size={16} /> Kembali ke daftar transfer
                        </Link>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white break-words">
                            <IconArrowsLeftRight size={28} className="text-primary-500 flex-shrink-0" />
                            {transfer.document_number}
                        </h1>
                    </div>
                    <div className="flex-shrink-0">
                        {statusBadge(transfer.status)}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] min-w-0">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900 overflow-hidden min-w-0 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Detail Transfer</h2>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Gudang Asal</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{transfer.source_warehouse?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Gudang Tujuan</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{transfer.destination_warehouse?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dibuat Oleh</p>
                                <p className="mt-1 text-sm text-slate-900 dark:text-white">{transfer.creator?.name || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dibuat Pada</p>
                                <p className="mt-1 text-sm text-slate-900 dark:text-white">{formatDateTime(transfer.created_at)}</p>
                            </div>
                            {transfer.completed_at && (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Selesai Pada</p>
                                    <p className="mt-1 text-sm text-slate-900 dark:text-white">{formatDateTime(transfer.completed_at)}</p>
                                </div>
                            )}
                            <div className="sm:col-span-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Catatan</p>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 break-words">{transfer.notes || "-"}</p>
                            </div>
                        </div>

                        <h3 className="mt-6 text-base font-semibold text-slate-900 dark:text-white">Item Transfer</h3>
                        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-3 py-2.5 text-left">Produk</th>
                                        <th className="px-3 py-2.5 text-left">Satuan (UOM)</th>
                                        <th className="px-3 py-2.5 text-right">Qty Kirim</th>
                                        {transfer.status === "completed" && (
                                            <>
                                                <th className="px-3 py-2.5 text-right">Qty Diterima</th>
                                                <th className="px-3 py-2.5 text-left">Status & Catatan</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {transfer.items.map((item) => {
                                        const received = item.received_qty !== null && item.received_qty !== undefined ? item.received_qty : item.qty;
                                        const difference = item.qty - received;
                                        const factor = Number(item.conversion_factor) || 1.0;
                                        const unitName = item.unit ? item.unit.name : "Unit";
                                        const unitSymbol = item.unit ? (item.unit.symbol || item.unit.code) : "unit";
                                        const baseSentQty = Math.round(item.qty * factor);
                                        const baseReceivedQty = Math.round(received * factor);
                                        const baseDiff = Math.round(difference * factor);

                                        return (
                                            <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="px-3 py-3">
                                                    <p className="font-medium text-slate-800 dark:text-slate-200">{item.product?.title || "-"}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.product?.sku || "-"}</p>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                                            {unitName} ({unitSymbol})
                                                        </span>
                                                        {factor > 1 && (
                                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                1 {unitSymbol} = {factor} unit dasar
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                                        {item.qty} {unitSymbol}
                                                    </span>
                                                    {factor > 1 && (
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            ({baseSentQty} unit dasar)
                                                        </p>
                                                    )}
                                                </td>
                                                {transfer.status === "completed" && (
                                                    <>
                                                        <td className="px-3 py-3 text-right">
                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                                {received} {unitSymbol}
                                                            </span>
                                                            {factor > 1 && (
                                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                    ({baseReceivedQty} unit dasar)
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            {difference > 0 ? (
                                                                <div className="space-y-1">
                                                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-400">
                                                                        <IconAlertTriangle size={13} /> Selisih {difference} {unitSymbol}
                                                                        {factor > 1 && ` (${baseDiff} unit dasar)`}
                                                                    </span>
                                                                    {item.notes && <p className="text-xs text-slate-600 dark:text-slate-400">{item.notes}</p>}
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                                                    <IconCheck size={13} /> Lengkap
                                                                </span>
                                                            )}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-4 min-w-0">
                        {transfer.status === "draft" && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Aksi</h2>
                                <div className="mt-4 space-y-3">
                                    {can("stock-transfers-send") && (
                                        <button onClick={() => confirmAction("send", "mengirim")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600 shadow-md shadow-primary-500/20">
                                            <IconSend size={18} /> Kirim Barang
                                        </button>
                                    )}
                                    {can("stock-transfers-cancel") && (
                                        <button onClick={() => confirmAction("cancel", "membatalkan")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/20">
                                            <IconX size={18} /> Batalkan
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {transfer.status === "in_transit" && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Aksi Penerimaan</h2>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Barang sedang dalam perjalanan. Terima barang di gudang tujuan atau batalkan jika terjadi kendala pengiriman.
                                </p>
                                <div className="mt-4 space-y-3">
                                    {can("stock-transfers-receive") && (
                                        <button
                                            type="button"
                                            onClick={() => setIsReceiveModalOpen(true)}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition-colors hover:bg-emerald-600"
                                        >
                                            <IconCheck size={18} /> Terima Barang
                                        </button>
                                    )}
                                    {can("stock-transfers-cancel") && (
                                        <button onClick={() => confirmAction("cancel", "membatalkan")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/20">
                                            <IconX size={18} /> Batalkan & Kembalikan
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {transfer.status === "completed" && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                                        <IconPackage size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Transfer Selesai</h3>
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Stok telah berhasil diterima dan ditambahkan ke {transfer.destination_warehouse?.name}.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Penerimaan Barang (Mendukung Multi-Satuan UOM) */}
            <Modal show={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} maxWidth="2xl">
                <form onSubmit={confirmReceiveSubmit} className="p-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <IconPackage size={24} className="text-emerald-500" />
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Penerimaan Transfer Stok</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsReceiveModalOpen(false)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                        >
                            <IconX size={20} />
                        </button>
                    </div>

                    <div className="mt-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <IconInfoCircle size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                        <span>
                            Periksa kondisi fisik barang. Jika ada barang rusak atau kurang, sesuaikan <strong>Qty Diterima</strong> dalam satuan pengiriman dan cantumkan alasan selisihnya.
                        </span>
                    </div>

                    <div className="mt-4 space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                        {receiveItems.map((item, index) => {
                            const diff = item.qty - item.received_qty;
                            const factor = item.conversion_factor || 1.0;
                            const baseSent = Math.round(item.qty * factor);
                            const baseRecv = Math.round(item.received_qty * factor);
                            const baseDiff = Math.round(diff * factor);

                            return (
                                <div key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 bg-white dark:bg-slate-900">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{item.product_title}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {item.product_sku} &bull; Dikirim:{" "}
                                                <strong className="text-slate-700 dark:text-slate-300">
                                                    {item.qty} {item.unit_symbol}
                                                </strong>
                                                {factor > 1 && ` (setara ${baseSent} unit dasar)`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Diterima:</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.qty}
                                                value={item.received_qty}
                                                onChange={(e) => handleReceiveItemChange(index, "received_qty", e.target.value)}
                                                className="h-9 w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            />
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                {item.unit_symbol}
                                            </span>
                                        </div>
                                    </div>

                                    {diff > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                <IconAlertTriangle size={14} />
                                                <span>
                                                    Terdapat selisih {diff} {item.unit_symbol}
                                                    {factor > 1 && ` (${baseDiff} unit dasar)`} tidak diterima / rusak.
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Tuliskan alasan selisih (misal: 1 dus basah / rusak di jalan)..."
                                                value={item.notes}
                                                onChange={(e) => handleReceiveItemChange(index, "notes", e.target.value)}
                                                className="h-8 w-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-400 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-slate-200"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {hasAnyDifference && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                            <strong>Perhatian:</strong> Hanya stok fisik yang diterima yang akan ditambahkan ke gudang tujuan (dalam kuantitas dasar setelah dikonversikan). Selisih tidak diterima akan dicatat pada mutasi dan log audit.
                        </div>
                    )}

                    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setIsReceiveModalOpen(false)}
                            className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submittingReceive}
                            className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-50"
                        >
                            <IconCheck size={18} />
                            {submittingReceive ? "Memproses..." : "Konfirmasi Penerimaan"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;
