import React, { useState, useMemo } from "react";
import { Link, usePage, router } from "@inertiajs/react";
import {
    IconX,
    IconChevronRight,
    IconChevronDown,
    IconChevronUp,
    IconUser,
    IconLogout,
    IconSun,
    IconMoon,
    IconDeviceMobile,
    IconReceipt,
    IconSearch,
    IconBuildingStore,
} from "@tabler/icons-react";
import Menu from "@/Utils/Menu";
import { useTheme } from "@/Context/ThemeSwitcherContext";
import { useHaptic } from "@/Hooks/useHaptic";

export default function MobileAppMenu({ isOpen, onClose }) {
    const { auth, storeProfile, appVersion, branding } = usePage().props;
    const { darkMode, themeSwitcher } = useTheme();
    const { triggerHaptic } = useHaptic();
    const menuNavigation = Menu();

    const [expandedSections, setExpandedSections] = useState({});
    const [searchQuery, setSearchQuery] = useState("");

    const toggleSection = (index) => {
        triggerHaptic("light");
        setExpandedSections((prev) => ({
            ...prev,
            [index]: !prev[index],
        }));
    };

    const storeName = branding?.appName || storeProfile?.name || "KASIR POS";
    const userName = auth?.user?.name || "Pengguna";
    const userEmail = auth?.user?.email || "";
    const userRole = auth?.user?.roles?.[0]?.name || "Staff";

    // Filtered menus when user types in search
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return menuNavigation;
        const q = searchQuery.toLowerCase();

        return menuNavigation
            .map((section) => {
                const matchingDetails = section.details.filter((detail) => {
                    if (!detail.permissions) return false;
                    const matchTitle = detail.title?.toLowerCase().includes(q);
                    const matchSub = detail.subdetails?.some(
                        (sub) => sub.permissions && sub.title?.toLowerCase().includes(q)
                    );
                    return matchTitle || matchSub;
                });

                return {
                    ...section,
                    details: matchingDetails,
                };
            })
            .filter((section) => section.details.length > 0);
    }, [searchQuery, menuNavigation]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 animate-in fade-in duration-200 pt-safe select-none">
            {/* 1. Fullscreen Top App Bar */}
            <header className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between flex-shrink-0 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-primary-600 to-primary-700 text-white flex items-center justify-center font-black text-sm shadow-xs flex-shrink-0">
                        {storeProfile?.logo ? (
                            <img
                                src={storeProfile.logo}
                                alt="Logo"
                                className="w-full h-full object-cover rounded-2xl"
                            />
                        ) : (
                            storeName.charAt(0).toUpperCase()
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-slate-900 dark:text-white truncate leading-tight">
                            {storeName}
                        </h2>
                        <span className="text-[10px] text-slate-400 font-medium block">
                            Menu Navigasi Aplikasi • v{appVersion || "2.1.0"}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("tap");
                        onClose();
                    }}
                    className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-90 transition-transform shadow-xs"
                    aria-label="Tutup Menu"
                >
                    <IconX size={20} strokeWidth={2.2} />
                </button>
            </header>

            {/* 2. Search & Profile Header */}
            <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 space-y-3 flex-shrink-0">
                {/* Search Bar */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <IconSearch size={16} />
                    </div>
                    <input
                        type="text"
                        placeholder="Cari menu atau fitur..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                        >
                            <IconX size={16} />
                        </button>
                    )}
                </div>

                {/* Profile Card */}
                {!searchQuery && (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-bold text-base flex-shrink-0 shadow-xs">
                                {auth?.user?.avatar ? (
                                    <img
                                        src={auth.user.avatar}
                                        alt={userName}
                                        className="w-full h-full object-cover rounded-2xl"
                                    />
                                ) : (
                                    userName.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {userName}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200/50">
                                        {userRole}
                                    </span>
                                    <span className="text-[10px] text-slate-400 truncate">
                                        {userEmail}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Theme Toggle Button */}
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("tap");
                                themeSwitcher();
                            }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 active:scale-90 transition-transform shadow-xs flex-shrink-0"
                            title="Toggle Theme"
                        >
                            {darkMode ? (
                                <IconSun size={17} className="text-amber-400" />
                            ) : (
                                <IconMoon size={17} />
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* 3. Quick Action Shortcuts (Only when not searching) */}
            {!searchQuery && (
                <div className="px-4 py-3 grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950/60 flex-shrink-0">
                    <Link
                        href={route("transactions.mobile")}
                        onClick={() => {
                            triggerHaptic("tap");
                            onClose();
                        }}
                        className="flex items-center gap-2.5 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-xs"
                    >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-700 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                            <IconDeviceMobile size={19} />
                        </div>
                        <div className="min-w-0">
                            <span className="text-xs font-black block leading-tight text-primary-600 dark:text-primary-400">
                                Kasir POS
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                                Transaksi Baru
                            </span>
                        </div>
                    </Link>

                    <Link
                        href={route("transactions.history")}
                        onClick={() => {
                            triggerHaptic("tap");
                            onClose();
                        }}
                        className="flex items-center gap-2.5 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-xs"
                    >
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                            <IconReceipt size={19} />
                        </div>
                        <div className="min-w-0">
                            <span className="text-xs font-bold block leading-tight">
                                Riwayat
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                                Cek Nota
                            </span>
                        </div>
                    </Link>
                </div>
            )}

            {/* 4. Fullscreen Scrollable Category Menu */}
            <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 no-scrollbar">
                {filteredSections.length > 0 ? (
                    filteredSections.map((section, secIdx) => {
                        const permittedDetails = section.details.filter(
                            (detail) => detail.permissions === true
                        );
                        if (permittedDetails.length === 0) return null;

                        // When searching, auto-expand all matching sections
                        const isSectionExpanded = searchQuery
                            ? true
                            : Boolean(expandedSections[secIdx]);

                        return (
                            <div
                                key={secIdx}
                                className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 overflow-hidden shadow-xs transition-all"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleSection(secIdx)}
                                    className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 transition-colors active:scale-98"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                            {section.title}
                                        </span>
                                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                            {permittedDetails.length}
                                        </span>
                                    </div>
                                    <div className="text-slate-400 dark:text-slate-500">
                                        {isSectionExpanded ? (
                                            <IconChevronUp size={18} />
                                        ) : (
                                            <IconChevronDown size={18} />
                                        )}
                                    </div>
                                </button>

                                {isSectionExpanded && (
                                    <div className="p-2 pt-1 space-y-1 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 animate-in fade-in duration-150">
                                        {section.details.map((item, itemIdx) => {
                                            if (!item.permissions) return null;

                                            if (item.hasOwnProperty("subdetails")) {
                                                return (
                                                    <div
                                                        key={itemIdx}
                                                        className="space-y-0.5"
                                                    >
                                                        <div className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                            <div className="text-primary-500">
                                                                {item.icon}
                                                            </div>
                                                            <span>{item.title}</span>
                                                        </div>
                                                        <div className="pl-6 space-y-1">
                                                            {item.subdetails.map(
                                                                (sub, subIdx) => {
                                                                    if (!sub.permissions)
                                                                        return null;
                                                                    return (
                                                                        <Link
                                                                            key={subIdx}
                                                                            href={sub.href}
                                                                            onClick={() => {
                                                                                triggerHaptic(
                                                                                    "tap"
                                                                                );
                                                                                onClose();
                                                                            }}
                                                                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 ${
                                                                                sub.active
                                                                                    ? "bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 font-bold border border-primary-200 dark:border-primary-800"
                                                                                    : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                                                                            }`}
                                                                        >
                                                                            <span>
                                                                                {sub.title}
                                                                            </span>
                                                                            {sub.active ? (
                                                                                <span className="w-2 h-2 rounded-full bg-primary-600 dark:bg-primary-400" />
                                                                            ) : (
                                                                                <IconChevronRight
                                                                                    size={14}
                                                                                    className="text-slate-300 dark:text-slate-600"
                                                                                />
                                                                            )}
                                                                        </Link>
                                                                    );
                                                                }
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <Link
                                                    key={itemIdx}
                                                    href={item.href}
                                                    onClick={() => {
                                                        triggerHaptic("tap");
                                                        onClose();
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 ${
                                                        item.active
                                                            ? "bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 font-bold border border-primary-200 dark:border-primary-800 shadow-xs"
                                                            : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                                                item.active
                                                                    ? "bg-primary-600 text-white shadow-xs"
                                                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
                                                            }`}
                                                        >
                                                            {item.icon}
                                                        </div>
                                                        <span className="font-bold">
                                                            {item.title}
                                                        </span>
                                                    </div>
                                                    {item.active ? (
                                                        <span className="w-2 h-2 rounded-full bg-primary-600 dark:bg-primary-400" />
                                                    ) : (
                                                        <IconChevronRight
                                                            size={16}
                                                            className="text-slate-300 dark:text-slate-600"
                                                        />
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="py-12 text-center text-slate-400 text-xs">
                        Tidak ada menu yang sesuai dengan "{searchQuery}"
                    </div>
                )}
            </main>

            {/* 5. Footer Utility & Logout */}
            <footer className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 pb-safe space-y-2 flex-shrink-0 shadow-lg">
                <div className="flex gap-2">
                    {/* Profile Link */}
                    <Link
                        href={route("profile.edit")}
                        onClick={() => {
                            triggerHaptic("tap");
                            onClose();
                        }}
                        className="flex-1 h-11 px-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <IconUser size={16} />
                        <span>Pengaturan Akun</span>
                    </Link>

                    {/* Logout Button */}
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("warning");
                            router.post(route("logout"));
                        }}
                        className="flex-1 h-11 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                        <IconLogout size={16} />
                        <span>Keluar</span>
                    </button>
                </div>
            </footer>
        </div>
    );
}
