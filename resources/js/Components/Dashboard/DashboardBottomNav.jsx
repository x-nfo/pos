import React from "react";
import { Link, usePage } from "@inertiajs/react";
import {
    IconHome,
    IconShoppingCart,
    IconBox,
    IconChartBar,
    IconGridDots,
} from "@tabler/icons-react";
import { useHaptic } from "@/Hooks/useHaptic";

export default function DashboardBottomNav() {
    const { url } = usePage();
    const { triggerHaptic } = useHaptic();

    const isDashboard = url === "/dashboard";
    const isPOS = url.startsWith("/transactions/mobile") || url.startsWith("/transactions");
    const isProducts = url.startsWith("/dashboard/products") || url.startsWith("/dashboard/categories");
    const isReports = url.startsWith("/dashboard/reports") || url.startsWith("/dashboard/sales-reports");
    const isMenu = url.startsWith("/dashboard/menu");

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-around h-16 px-1">
                {/* 1. Beranda */}
                <Link
                    href={route("dashboard")}
                    onClick={() => triggerHaptic("tap")}
                    className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 ${
                        isDashboard
                            ? "text-primary-600 dark:text-primary-400 font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    <div className="relative">
                        <IconHome size={22} strokeWidth={isDashboard ? 2.2 : 1.7} />
                        {isDashboard && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400" />
                        )}
                    </div>
                    <span className="text-[10px] mt-1 tracking-tight">Beranda</span>
                </Link>

                {/* 2. Produk */}
                <Link
                    href={route("products.index")}
                    onClick={() => triggerHaptic("tap")}
                    className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 ${
                        isProducts
                            ? "text-primary-600 dark:text-primary-400 font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    <div className="relative">
                        <IconBox size={22} strokeWidth={isProducts ? 2.2 : 1.7} />
                        {isProducts && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400" />
                        )}
                    </div>
                    <span className="text-[10px] mt-1 tracking-tight">Produk</span>
                </Link>

                {/* 3. Kasir POS (Center Action) */}
                <Link
                    href={route("transactions.mobile")}
                    onClick={() => triggerHaptic("tap")}
                    className="flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all active:scale-95 group"
                >
                    <div className="w-10 h-10 -mt-5 rounded-2xl bg-gradient-to-tr from-primary-600 to-primary-700 text-white flex items-center justify-center shadow-lg shadow-primary-500/30 group-active:scale-90 transition-transform">
                        <IconShoppingCart size={22} strokeWidth={2} />
                    </div>
                    <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 mt-0.5 tracking-tight">
                        Kasir
                    </span>
                </Link>

                {/* 4. Laporan / Riwayat */}
                <Link
                    href={route("reports.sales.index")}
                    onClick={() => triggerHaptic("tap")}
                    className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 ${
                        isReports
                            ? "text-primary-600 dark:text-primary-400 font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    <div className="relative">
                        <IconChartBar size={22} strokeWidth={isReports ? 2.2 : 1.7} />
                        {isReports && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400" />
                        )}
                    </div>
                    <span className="text-[10px] mt-1 tracking-tight">Laporan</span>
                </Link>

                {/* 5. Menu Halaman Aplikasi */}
                <Link
                    href={route("dashboard.menu")}
                    onClick={() => triggerHaptic("tap")}
                    className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 ${
                        isMenu
                            ? "text-primary-600 dark:text-primary-400 font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    <div className="relative">
                        <IconGridDots size={22} strokeWidth={isMenu ? 2.2 : 1.7} />
                        {isMenu && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400" />
                        )}
                    </div>
                    <span className="text-[10px] mt-1 tracking-tight">Menu</span>
                </Link>
            </div>
        </nav>
    );
}
