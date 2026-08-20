import React, { useEffect, useState } from "react";
import { usePage, Link } from "@inertiajs/react";
import { IconMenu2, IconMoon, IconSun } from "@tabler/icons-react";
import AuthDropdown from "@/Components/Dashboard/AuthDropdown";
import LanguageSwitcher from "@/Components/Dashboard/LanguageSwitcher";
import Menu from "@/Utils/Menu";
import Notification from "@/Components/Dashboard/Notification";
import { useHaptic } from "@/Hooks/useHaptic";

export default function Navbar({ toggleSidebar, themeSwitcher, darkMode }) {
    const { auth, storeProfile } = usePage().props;
    const { triggerHaptic } = useHaptic();
    const menuNavigation = Menu();

    const storeName = storeProfile?.name || "KASIR";
    const storeInitial = storeName?.charAt(0)?.toUpperCase() || "K";

    // Get current page title
    const links = menuNavigation.flatMap((item) => item.details);
    const sublinks = links
        .filter((item) => item.hasOwnProperty("subdetails"))
        .flatMap((item) => item.subdetails);

    const getCurrentTitle = () => {
        for (const link of links) {
            if (link.hasOwnProperty("subdetails")) {
                const activeSublink = sublinks.find((s) => s.active);
                if (activeSublink) return activeSublink.title;
            } else if (link.active) {
                return link.title;
            }
        }
        return "Dashboard";
    };

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <header
            className="sticky top-0 z-30 h-14 md:h-16 flex items-center justify-between px-3 md:px-6
            bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
            border-b border-slate-200/80 dark:border-slate-800
            pt-safe transition-all duration-200"
        >
            {/* Left Section: Menu Toggle & Title/Brand */}
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
                {/* Sidebar Toggle */}
                <button
                    onClick={() => {
                        triggerHaptic("tap");
                        toggleSidebar();
                    }}
                    className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all flex-shrink-0"
                    title="Menu"
                >
                    <IconMenu2 size={20} strokeWidth={1.8} />
                </button>

                {/* Mobile Brand / Page Title */}
                <div className="md:hidden flex items-center gap-2 min-w-0">
                    <Link
                        href={route("dashboard")}
                        className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-xs"
                    >
                        {storeProfile?.logo ? (
                            <img
                                src={storeProfile.logo}
                                alt="Logo"
                                className="w-full h-full object-cover rounded-lg"
                            />
                        ) : (
                            storeInitial
                        )}
                    </Link>
                    <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate block leading-tight">
                            {getCurrentTitle()}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block leading-none">
                            {storeName}
                        </span>
                    </div>
                </div>

                {/* Desktop Page Title */}
                <div className="hidden md:flex items-center">
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mr-4" />
                    <h1 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                        {getCurrentTitle()}
                    </h1>
                </div>
            </div>

            {/* Right Section: Compact Actions */}
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                {/* Language Switcher (Desktop only for compact mobile header) */}
                <div className="hidden sm:block">
                    <LanguageSwitcher />
                </div>

                {/* Theme Toggle */}
                <button
                    onClick={() => {
                        triggerHaptic("tap");
                        themeSwitcher();
                    }}
                    className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all"
                    title={darkMode ? "Light Mode" : "Dark Mode"}
                >
                    {darkMode ? (
                        <IconSun
                            size={18}
                            strokeWidth={1.8}
                            className="text-amber-400"
                        />
                    ) : (
                        <IconMoon size={18} strokeWidth={1.8} />
                    )}
                </button>

                {/* Notifications */}
                <Notification />

                {/* Divider */}
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-0.5" />

                {/* User Dropdown */}
                <AuthDropdown auth={auth} isMobile={isMobile} />
            </div>
        </header>
    );
}
