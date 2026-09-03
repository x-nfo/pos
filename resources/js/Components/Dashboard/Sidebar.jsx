import React, { useState, useMemo, useEffect, useRef } from "react";
import { usePage, Link } from "@inertiajs/react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import LinkItem from "@/Components/Dashboard/LinkItem";
import LinkItemDropdown from "@/Components/Dashboard/LinkItemDropdown";
import Menu from "@/Utils/Menu";
import hasAnyPermission from "@/Utils/Permission";
import { normalizeStorageUrl } from "@/Utils/imageUrl";

export default function Sidebar({ sidebarOpen }) {
    const { t } = useTranslation();
    const { auth, storeProfile, appVersion, branding } = usePage().props;
    const menuNavigation = Menu();

    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef(null);

    const hasDashboardAccess = hasAnyPermission(["dashboard-access"]);
    const homeRoute = hasDashboardAccess ? route("dashboard") : route("dashboard.menu");

    const appName = branding?.appName || storeProfile?.name || "KASIR";
    const appLogo = normalizeStorageUrl(branding?.logoLight || storeProfile?.logo || null);
    const appLogoMini = normalizeStorageUrl(branding?.logoCollapsed || branding?.favicon || appLogo);
    const appInitial =
        appName?.charAt(0)?.toUpperCase() ||
        auth?.user?.name?.charAt(0)?.toUpperCase() ||
        "K";

    // Keyboard shortcut to focus search: press "/"
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (
                e.key === "/" &&
                document.activeElement?.tagName !== "INPUT" &&
                document.activeElement?.tagName !== "TEXTAREA"
            ) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
                setSearchQuery("");
                searchInputRef.current?.blur();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Filter menu navigation based on search query
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return menuNavigation;
        const q = searchQuery.toLowerCase().trim();

        return menuNavigation
            .map((section) => {
                const matchingDetails = section.details.reduce((acc, detail) => {
                    if (!detail.permissions) return acc;

                    const matchSelf = detail.title?.toLowerCase().includes(q);

                    if (detail.hasOwnProperty("subdetails")) {
                        const matchingSubs = detail.subdetails.filter(
                            (sub) => sub.permissions && sub.title?.toLowerCase().includes(q)
                        );
                        if (matchSelf || matchingSubs.length > 0) {
                            acc.push({
                                ...detail,
                                // If parent matched, keep all permitted subs, otherwise keep matching subs
                                subdetails: matchSelf
                                    ? detail.subdetails.filter((s) => s.permissions)
                                    : matchingSubs,
                            });
                        }
                    } else if (matchSelf) {
                        acc.push(detail);
                    }

                    return acc;
                }, []);

                return {
                    ...section,
                    details: matchingDetails,
                };
            })
            .filter((section) => section.details.length > 0);
    }, [menuNavigation, searchQuery]);

    return (
        <aside
            className={`
                hidden md:flex ${sidebarOpen ? "w-[260px]" : "w-[80px]"}
                sticky top-0 self-stretch shrink-0 h-screen flex-col overflow-hidden
                border-r border-slate-200 dark:border-slate-800
                bg-white dark:bg-slate-900
                transition-all duration-300 ease-in-out z-30
            `}
        >
            {/* Logo */}
            <Link
                href={homeRoute}
                className="flex items-center justify-center h-16 border-b border-slate-100 dark:border-slate-800 px-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                title={hasDashboardAccess ? "Dashboard" : "Menu Aplikasi"}
            >
                {sidebarOpen ? (
                    <div className="flex items-center gap-2.5 w-full min-w-0">
                        {appLogo ? (
                            <img
                                src={appLogo}
                                alt={appName}
                                className="w-9 h-9 rounded-lg object-contain shrink-0"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    if (e.currentTarget.nextElementSibling) {
                                        e.currentTarget.nextElementSibling.style.display = "flex";
                                    }
                                }}
                            />
                        ) : null}
                        <div
                            className={`w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center shrink-0 shadow-sm shadow-primary-500/20 ${
                                appLogo ? "hidden" : "flex"
                            }`}
                        >
                            <span className="text-white font-bold text-sm">
                                {appInitial}
                            </span>
                        </div>
                        <span className="text-lg font-bold text-slate-800 dark:text-white truncate">
                            {appName}
                        </span>
                    </div>
                ) : appLogoMini ? (
                    <>
                        <img
                            src={appLogoMini}
                            alt={appName}
                            className="w-9 h-9 rounded-lg object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                if (e.currentTarget.nextElementSibling) {
                                    e.currentTarget.nextElementSibling.style.display = "flex";
                                }
                            }}
                        />
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 hidden items-center justify-center shadow-sm shadow-primary-500/20">
                            <span className="text-white font-bold text-sm">
                                {appInitial}
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm shadow-primary-500/20">
                        <span className="text-white font-bold text-sm">
                            {appInitial}
                        </span>
                    </div>
                )}
            </Link>

            {/* Quick Search Filter (When sidebar is open) */}
            {sidebarOpen && (
                <div className="px-3.5 pt-3 pb-2 shrink-0">
                    <div className="relative flex items-center">
                        <IconSearch
                            size={16}
                            className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none"
                        />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t("sidebar.items.searchPlaceholder", {
                                defaultValue: "Cari menu... (/)",
                            })}
                            className="w-full pl-9 pr-8 py-2 bg-slate-100/90 dark:bg-slate-800/90 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl border-0 focus:ring-2 focus:ring-primary-500/30 transition-all outline-none"
                        />
                        {searchQuery ? (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                                title="Hapus pencarian"
                            >
                                <IconX size={14} />
                            </button>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className="dashboard-scrollbar min-h-0 flex-1 overflow-y-auto py-2 px-3.5">
                {filteredSections.length > 0 ? (
                    filteredSections.map((section, index) => {
                        const hasPermission = section.details.some(
                            (detail) => detail.permissions === true
                        );
                        if (!hasPermission) return null;

                        return (
                            <div key={index} className="mb-3">
                                {/* Section Title with comfortable left indent */}
                                {sidebarOpen && (
                                    <div className="px-3 pt-2 pb-1.5 flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                            {section.title}
                                        </span>
                                    </div>
                                )}

                                {/* Menu Items */}
                                <div
                                    className={
                                        sidebarOpen
                                            ? "space-y-0.5"
                                            : "flex flex-col items-center"
                                    }
                                >
                                    {section.details.map((detail, idx) => {
                                        if (!detail.permissions) return null;

                                        if (detail.hasOwnProperty("subdetails")) {
                                            return (
                                                <LinkItemDropdown
                                                    key={idx}
                                                    title={detail.title}
                                                    icon={detail.icon}
                                                    data={detail.subdetails}
                                                    access={detail.permissions}
                                                    sidebarOpen={sidebarOpen}
                                                />
                                            );
                                        }

                                        return (
                                            <LinkItem
                                                key={idx}
                                                title={detail.title}
                                                icon={detail.icon}
                                                href={detail.href}
                                                access={detail.permissions}
                                                sidebarOpen={sidebarOpen}
                                                badge={detail.badge}
                                                active={detail.active}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="p-6 text-center">
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            {t("sidebar.items.noMenuFound", {
                                defaultValue: "Menu tidak ditemukan",
                            })}
                        </p>
                    </div>
                )}
            </nav>

            {/* Version/Footer */}
            {sidebarOpen && (
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center space-y-0.5 shrink-0 bg-white dark:bg-slate-900">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {appName} {appVersion}
                    </p>
                    {branding?.poweredBy?.show && branding?.poweredBy?.text && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {branding?.poweredBy?.url ? (
                                <a
                                    href={branding.poweredBy.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:underline hover:text-primary-500"
                                >
                                    {branding.poweredBy.text}
                                </a>
                            ) : (
                                branding.poweredBy.text
                            )}
                        </p>
                    )}
                </div>
            )}
        </aside>
    );
}
