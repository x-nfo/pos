import React from "react";
import { Link } from "@inertiajs/react";
import {
    IconBuildingStore,
    IconShoppingCart,
    IconHistory,
    IconUser,
} from "@tabler/icons-react";
import { useHaptic } from "@/Hooks/useHaptic";

export default function MobileBottomNav({
    currentTab = "catalog",
    onTabChange,
    cartCount = 0,
    onOpenShiftModal,
}) {
    const { triggerHaptic } = useHaptic();

    return (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            <div className="max-w-md mx-auto grid grid-cols-4 h-16 px-2">
                {/* 1. Katalog */}
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("tap");
                        onTabChange("catalog");
                    }}
                    className={`flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                        currentTab === "catalog"
                            ? "text-primary-600 dark:text-primary-400 font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    <div className="relative">
                        <IconBuildingStore
                            size={22}
                            strokeWidth={currentTab === "catalog" ? 2.5 : 1.8}
                        />
                        {currentTab === "catalog" && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400" />
                        )}
                    </div>
                    <span className="text-[10px]">Katalog</span>
                </button>

                {/* 2. Keranjang */}
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("tap");
                        onTabChange("cart");
                    }}
                    className={`flex flex-col items-center justify-center gap-1 transition-all active:scale-95 relative ${
                        currentTab === "cart"
                            ? "text-primary-600 dark:text-primary-400 font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    <div className="relative">
                        <IconShoppingCart
                            size={22}
                            strokeWidth={currentTab === "cart" ? 2.5 : 1.8}
                        />
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-2 px-1.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-sm">
                                {cartCount > 99 ? "99+" : cartCount}
                            </span>
                        )}
                        {currentTab === "cart" && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400" />
                        )}
                    </div>
                    <span className="text-[10px]">Keranjang</span>
                </button>

                {/* 3. Riwayat */}
                <Link
                    href={route("transactions.history")}
                    onClick={() => triggerHaptic("tap")}
                    className="flex flex-col items-center justify-center gap-1 transition-all active:scale-95 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                    <IconHistory size={22} strokeWidth={1.8} />
                    <span className="text-[10px]">Riwayat</span>
                </Link>

                {/* 4. Shift Kasir */}
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("tap");
                        onOpenShiftModal();
                    }}
                    className="flex flex-col items-center justify-center gap-1 transition-all active:scale-95 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                    <IconUser size={22} strokeWidth={1.8} />
                    <span className="text-[10px]">Shift</span>
                </button>
            </div>
        </nav>
    );
}
