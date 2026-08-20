import React from "react";
import { IconShoppingCart, IconArrowRight } from "@tabler/icons-react";
import { useHaptic } from "@/Hooks/useHaptic";

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
    const { triggerHaptic } = useHaptic();

    if (cartCount <= 0) return null;

    return (
        <div className="fixed bottom-16 inset-x-0 px-3 z-30 pointer-events-none mb-safe animate-slide-up">
            <div className="max-w-md mx-auto pointer-events-auto">
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("tap");
                        onOpenCart();
                    }}
                    className="w-full h-14 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-primary-600 dark:to-primary-800 text-white rounded-2xl p-2.5 px-4 shadow-2xl shadow-slate-900/30 dark:shadow-primary-950/70 flex items-center justify-between active:scale-[0.98] transition-transform border border-white/10"
                >
                    <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                            <IconShoppingCart size={20} className="text-white" />
                            <span className="absolute -top-1.5 -right-1.5 px-1.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-cart-add">
                                {cartCount}
                            </span>
                        </div>
                        <div className="text-left">
                            <p className="text-[11px] text-white/80 font-medium leading-tight">
                                {cartCount} item dalam keranjang
                            </p>
                            <p className="text-sm font-black text-white leading-tight font-mono">
                                {formatPrice(totalPayable)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white transition-colors">
                        <span>Keranjang</span>
                        <IconArrowRight size={16} />
                    </div>
                </button>
            </div>
        </div>
    );
}
