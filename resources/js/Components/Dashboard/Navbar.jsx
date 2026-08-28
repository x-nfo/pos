import React, { useEffect, useState } from "react";
import { usePage, Link } from "@inertiajs/react";
import { IconMenu2, IconMoon, IconSun, IconChevronLeft } from "@tabler/icons-react";
import AuthDropdown from "@/Components/Dashboard/AuthDropdown";
import LanguageSwitcher from "@/Components/Dashboard/LanguageSwitcher";
import Menu from "@/Utils/Menu";
import Notification from "@/Components/Dashboard/Notification";
import { useHaptic } from "@/Hooks/useHaptic";
import hasAnyPermission from "@/Utils/Permission";
import { getStoreLogoUrl } from "@/Utils/imageUrl";

export default function Navbar({ toggleSidebar, themeSwitcher, darkMode, isDashboard = true }) {
    const { auth, storeProfile } = usePage().props;
    const { url } = usePage();
    const { triggerHaptic } = useHaptic();
    const menuNavigation = Menu();

    const hasDashboardAccess = hasAnyPermission(["dashboard-access"]);
    const homeRoute = hasDashboardAccess ? route("dashboard") : route("dashboard.menu");

    const storeName = storeProfile?.name || "KASIR";
    const storeInitial = storeName?.charAt(0)?.toUpperCase() || "K";
    const storeLogoUrl = getStoreLogoUrl(storeProfile?.logo);

    // Get current page title
    const links = menuNavigation.flatMap((item) => item.details);
    const sublinks = links
        .filter((item) => item.hasOwnProperty("subdetails"))
        .flatMap((item) => item.subdetails);

    const getCurrentTitle = () => {
        if (url.startsWith("/dashboard/menu")) return "Menu Aplikasi";
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
            className="sticky top-0 z-30 min-h-[3.5rem] md:min-h-[4rem] h-14 md:h-16 flex items-center justify-between px-3.5 sm:px-4 md:px-6
            bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
            border-b border-slate-200/80 dark:border-slate-800 shadow-xs
            pt-safe transition-all duration-200"
        >
            {/* Left Section: Menu Toggle / Back Button & Title */}
            <div className="flex items-center gap-2.5 md:gap-4 min-w-0">
                {/* Mobile Subpage: Chevron Left Back to Dashboard or Menu */}
                {!isDashboard && (
                    <Link
                        href={homeRoute}
                        onClick={() => triggerHaptic("tap")}
                        className="md:hidden w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 active:scale-95 flex items-center justify-center transition-all flex-shrink-0"
                        title={hasDashboardAccess ? "Kembali ke Dashboard" : "Kembali ke Menu"}
                    >
                        <IconChevronLeft size={20} strokeWidth={2.2} />
                    </Link>
                )}

                {/* Desktop Sidebar Toggle */}
                <button
                    onClick={() => {
                        triggerHaptic("tap");
                        toggleSidebar();
                    }}
                    className="hidden md:flex p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all flex-shrink-0"
                    title="Menu"
                >
                    <IconMenu2 size={20} strokeWidth={1.8} />
                </button>

                {/* Mobile Brand / Page Title on Dashboard */}
                {isDashboard && (
                    <div className="md:hidden flex items-center gap-2.5 min-w-0">
                        <Link
                            href={homeRoute}
                            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-700 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-xs active:scale-95 transition-transform overflow-hidden"
                            title={hasDashboardAccess ? "Dashboard" : "Menu Aplikasi"}
                        >
                            {storeLogoUrl ? (
                                <img
                                    src={storeLogoUrl}
                                    alt="Logo"
                                    className="w-full h-full object-cover rounded-xl"
                                    onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                        if (e.currentTarget.nextElementSibling) {
                                            e.currentTarget.nextElementSibling.style.display = "block";
                                        }
                                    }}
                                />
                            ) : null}
                            <span className={storeLogoUrl ? "hidden" : ""}>
                                {storeInitial}
                            </span>
                        </Link>
                        <div className="min-w-0">
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate block leading-tight">
                                {storeName}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate block leading-none mt-0.5">
                                {getCurrentTitle()}
                            </span>
                        </div>
                    </div>
                )}

                {/* Mobile Page Title on Subpages (when not Dashboard) */}
                {!isDashboard && (
                    <div className="md:hidden min-w-0">
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate block leading-tight">
                            {getCurrentTitle()}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate block leading-none mt-0.5">
                            {storeName}
                        </span>
                    </div>
                )}

                {/* Desktop Page Title */}
                <div className="hidden md:flex items-center">
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mr-4" />
                    <h1 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                        {getCurrentTitle()}
                    </h1>
                </div>
            </div>

            {/* Right Section: Compact Actions with Consistent Sizing */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
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
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all"
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
                <div className="w-px h-5 bg-slate-200/80 dark:bg-slate-800 mx-0.5 sm:mx-1" />

                {/* User Dropdown */}
                <AuthDropdown auth={auth} isMobile={isMobile} />
            </div>
        </header>
    );
}
