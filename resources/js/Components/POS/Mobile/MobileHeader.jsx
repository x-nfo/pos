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
    IconWallet,
    IconArrowLeft,
    IconDotsVertical,
} from "@tabler/icons-react";

export default function MobileHeader({ activeShift, onOpenShiftModal }) {
    const { auth, storeProfile } = usePage().props;
    const { darkMode, themeSwitcher } = useTheme();
    const { isOnline, pendingCount, syncOfflineTransactions } = useOfflineSync();
    const [isSyncing, setIsSyncing] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const handleSync = async () => {
        if (!isOnline || isSyncing) return;
        setIsSyncing(true);
        try {
            await syncOfflineTransactions();
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between flex-shrink-0 shadow-xs">
            {/* Left: Brand & Shift Info */}
            <div className="flex items-center gap-2.5 min-w-0">
                <Link
                    href={route("dashboard")}
                    className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-primary-600 text-white font-black text-xs shadow-xs flex-shrink-0 active:scale-95 transition-transform"
                >
                    {storeProfile?.logo ? (
                        <img
                            src={storeProfile.logo}
                            alt={storeProfile?.name || "Store"}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        (storeProfile?.name || "K").charAt(0).toUpperCase()
                    )}
                </Link>
                <div className="min-w-0">
                    <h1 className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate">
                        {storeProfile?.name || "POS Kasir"}
                    </h1>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {activeShift ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Shift #{activeShift.id}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={onOpenShiftModal}
                                className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded-md"
                            >
                                Buka Shift
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Offline Status */}
                {!isOnline ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Offline
                    </span>
                ) : pendingCount > 0 ? (
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 text-[10px] font-bold flex items-center gap-1 border border-primary-200 dark:border-primary-800"
                    >
                        <IconRefresh
                            size={12}
                            className={isSyncing ? "animate-spin" : ""}
                        />
                        {pendingCount}
                    </button>
                ) : null}

                {/* Theme Toggle */}
                <button
                    type="button"
                    onClick={themeSwitcher}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                    aria-label="Toggle Theme"
                >
                    {darkMode ? <IconSun size={17} /> : <IconMoon size={17} />}
                </button>

                {/* Dropdown Menu */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                        aria-label="Menu"
                    >
                        <IconDotsVertical size={18} />
                    </button>

                    {menuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40 bg-black/20"
                                onClick={() => setMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-10 w-52 z-50 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 text-slate-800 dark:text-slate-200">
                                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                                    <p className="text-[10px] text-slate-400">Kasir Aktif</p>
                                    <p className="text-xs font-bold truncate">
                                        {auth?.user?.name || "Kasir"}
                                    </p>
                                </div>

                                <Link
                                    href={route("transactions.index")}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-primary-600 dark:text-primary-400"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <IconDeviceDesktop size={15} />
                                    <span>Versi Desktop</span>
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
                                        href={route("cashier-shifts.index")}
                                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <IconWallet size={15} />
                                        <span>Kelola Shift</span>
                                    </Link>
                                )}

                                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                                <Link
                                    href={route("dashboard")}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <IconArrowLeft size={15} />
                                    <span>Dashboard</span>
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
