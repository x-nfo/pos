import React from "react";
import { IconShoppingCart, IconArrowRight } from "@tabler/icons-react";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export default function MobileFloatingCartBar({
    cartCount = 0,
    totalPayable = 0,
    onOpenCart,
}) {
    if (cartCount <= 0) return null;

    return (
        <div className="fixed bottom-18 inset-x-0 px-3 z-30 pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto">
                <button
                    type="button"
                    onClick={onOpenCart}
                    className="w-full h-13 bg-slate-900 dark:bg-primary-600 text-white rounded-2xl p-2.5 px-3.5 shadow-xl shadow-slate-900/25 dark:shadow-primary-950/60 flex items-center justify-between active:scale-[0.98] transition-transform border border-white/10"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="relative w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                            <IconShoppingCart size={18} className="text-white" />
                            <span className="absolute -top-1.5 -right-1.5 px-1 min-w-[17px] h-[17px] bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                                {cartCount}
                            </span>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] text-white/80 font-semibold leading-tight">
                                {cartCount} item dalam keranjang
                            </p>
                            <p className="text-xs font-black text-white leading-tight">
                                {formatPrice(totalPayable)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-colors">
                        <span>Lihat</span>
                        <IconArrowRight size={15} />
                    </div>
                </button>
            </div>
        </div>
    );
}
