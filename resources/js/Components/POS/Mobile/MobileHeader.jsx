import React, { useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import { useTheme } from "@/Context/ThemeSwitcherContext";
import { useOfflineSync } from "@/Context/OnlineStatusContext";
import {
    IconDeviceDesktop,
    IconSun,
    IconMoon,
    IconRefresh,
    IconHistory,
    IconArrowLeft,
    IconDotsVertical,
    IconUser,
    IconShoppingCart,
    IconGridDots,
} from "@tabler/icons-react";
import { useHaptic } from "@/Hooks/useHaptic";
import hasAnyPermission from "@/Utils/Permission";

export default function MobileHeader({
    activeShift,
    onOpenShiftModal,
    cartCount = 0,
    onOpenCart,
}) {
    const { auth, storeProfile } = usePage().props;
    const { darkMode, themeSwitcher } = useTheme();
    const { triggerHaptic } = useHaptic();
    const { isOnline, pendingCount, syncOfflineTransactions } = useOfflineSync();
    const [isSyncing, setIsSyncing] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const hasDashboardAccess = hasAnyPermission(["dashboard-access"]);
    const homeRoute = hasDashboardAccess ? route("dashboard") : route("dashboard.menu");

    const handleSync = async () => {
        if (!isOnline || isSyncing) return;
        triggerHaptic("tap");
        setIsSyncing(true);
        try {
            await syncOfflineTransactions();
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3.5 sm:px-4 py-2 sm:py-2.5 pt-safe min-h-[3.5rem] sm:min-h-[4rem] h-14 sm:h-16 flex items-center justify-between flex-shrink-0 shadow-xs transition-all">
            {/* Left: Brand & Shift Status Pill */}
            <div className="flex items-center gap-2.5 min-w-0">
                <Link
                    href={homeRoute}
                    onClick={() => triggerHaptic("tap")}
                    className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-tr from-primary-600 to-primary-700 text-white font-black text-xs shadow-xs flex-shrink-0 active:scale-95 transition-transform"
                    title={hasDashboardAccess ? "Dashboard" : "Menu Aplikasi"}
                >
                    {storeProfile?.logo ? (
                        <img
                            src={storeProfile.logo}
                            alt="Logo"
                            className="w-full h-full object-cover rounded-xl"
                        />
                    ) : (
                        (storeProfile?.name || "K").charAt(0).toUpperCase()
                    )}
                </Link>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <h1 className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate">
                            {storeProfile?.name || "POS Kasir"}
                        </h1>
                        {activeShift ? (
                            <Link
                                href={route("cashier-shifts.show", activeShift.id)}
                                onClick={() => triggerHaptic("tap")}
                                className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50 flex-shrink-0 active:scale-95 transition-transform hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Shift #{activeShift.id}
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("tap");
                                    onOpenShiftModal();
                                }}
                                className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded-full border border-rose-200/50 flex-shrink-0 active:scale-95"
                            >
                                Buka Shift
                            </button>
                        )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate block leading-none mt-0.5">
                        Katalog Kasir
                    </span>
                </div>
            </div>

            {/* Right: Offline status, Theme & Menu */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {/* Offline Status */}
                {!isOnline ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Offline
                    </span>
                ) : pendingCount > 0 ? (
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 text-[10px] font-bold flex items-center gap-1 border border-primary-200 dark:border-primary-800 active:scale-95"
                    >
                        <IconRefresh
                            size={12}
                            className={isSyncing ? "animate-spin" : ""}
                        />
                        {pendingCount}
                    </button>
                ) : null}

                {/* Cart Button */}
                {onOpenCart && (
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("tap");
                            onOpenCart();
                        }}
                        className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-slate-800 active:scale-95 transition-all"
                        aria-label="Keranjang"
                        title="Keranjang Belanja"
                    >
                        <IconShoppingCart size={18} />
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs">
                                {cartCount > 99 ? "99+" : cartCount}
                            </span>
                        )}
                    </button>
                )}

                {/* Theme Toggle */}
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("tap");
                        themeSwitcher();
                    }}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all"
                    aria-label="Toggle Theme"
                >
                    {darkMode ? (
                        <IconSun size={18} className="text-amber-400" />
                    ) : (
                        <IconMoon size={18} />
                    )}
                </button>

                {/* Dropdown Menu */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("tap");
                            setMenuOpen(!menuOpen);
                        }}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
                        aria-label="Menu"
                    >
                        <IconDotsVertical size={18} />
                    </button>

                    {menuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs"
                                onClick={() => setMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-9 w-52 z-50 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 text-slate-800 dark:text-slate-200 animate-sheet-up">
                                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                                    <p className="text-[10px] text-slate-400">Kasir Aktif</p>
                                    <p className="text-xs font-bold truncate">
                                        {auth?.user?.name || "Kasir"}
                                    </p>
                                </div>

                                <Link
                                    href={route("dashboard.menu")}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <IconGridDots size={15} className="text-primary-500" />
                                    <span>Menu Aplikasi</span>
                                </Link>

                                <Link
                                    href={route("transactions.index", { desktop: 1 })}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-primary-600 dark:text-primary-400"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <IconDeviceDesktop size={15} />
                                    <span>Mode Desktop POS</span>
                                </Link>

                                <Link
                                    href={route("transactions.history")}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <IconHistory size={15} />
                                    <span>Riwayat Transaksi</span>
                                </Link>

                                {activeShift && (
                                    <Link
                                        href={route("cashier-shifts.show", activeShift.id)}
                                        onClick={() => {
                                            triggerHaptic("tap");
                                            setMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                    >
                                        <IconUser size={15} />
                                        <span>Detail / Tutup Shift</span>
                                    </Link>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
