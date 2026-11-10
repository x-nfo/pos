import React from "react";
import { IconPackage, IconArrowRight, IconX } from "@tabler/icons-react";

export default function CatalogOrderStatusBanner({
    latestActiveOrder = null,
    onDismiss = () => {},
}) {
    if (!latestActiveOrder) return null;

    return (
        <div className="mb-6 p-3.5 sm:p-4 rounded border border-karima-brand/15 dark:border-stone-800 bg-karima-base/40 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded bg-karima-brand/10 text-karima-brand dark:text-stone-300 flex items-center justify-center shrink-0">
                    <IconPackage size={18} />
                </span>
                <div className="min-w-0 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-karima-ink dark:text-stone-300">
                            Pesanan Berjalan:
                        </span>
                        <span className="font-mono font-bold text-karima-brand dark:text-white">
                            {latestActiveOrder.order_number}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>{latestActiveOrder.status_label || "Sedang Diproses"}</span>
                        </span>
                    </div>
                    <p className="text-[11px] text-karima-ink/50 dark:text-stone-400 truncate mt-0.5">
                        Pesanan Anda sedang diproses oleh staf toko. Anda dapat memantau progres secara live.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <a
                    href={latestActiveOrder.status_url || `/katalog/order/${latestActiveOrder.access_token}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xxs uppercase tracking-wider font-semibold bg-karima-brand hover:bg-karima-accent text-white transition-all shadow-2xs"
                >
                    <span>Pantau Status</span>
                    <IconArrowRight size={13} />
                </a>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="p-1.5 text-stone-400 hover:text-karima-brand dark:hover:text-stone-200"
                    title="Tutup banner"
                >
                    <IconX size={15} />
                </button>
            </div>
        </div>
    );
}

