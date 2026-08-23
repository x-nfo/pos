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
        <div className="fixed bottom-0 inset-x-0 p-3 pb-safe bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 shadow-lg z-30 animate-slide-up">
            <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                        <IconShoppingCart size={20} strokeWidth={2.2} />
                        <span className="absolute -top-1.5 -right-1.5 px-1.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm animate-cart-add">
                            {cartCount > 99 ? "99+" : cartCount}
                        </span>
                    </div>
                    <div className="min-w-0 text-left">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                            {cartCount} Item di Keranjang
                        </p>
                        <p className="text-base font-black text-slate-900 dark:text-white truncate font-mono">
                            {formatPrice(totalPayable)}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("tap");
                        onOpenCart();
                    }}
                    className="h-12 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform flex-shrink-0"
                >
                    <span>Keranjang</span>
                    <IconArrowRight size={18} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
}
