import React from "react";
import { usePage } from "@inertiajs/react";
import { IconLayoutGrid } from "@tabler/icons-react";
import LinkItem from "@/Components/Dashboard/LinkItem";
import LinkItemDropdown from "@/Components/Dashboard/LinkItemDropdown";
import Menu from "@/Utils/Menu";

export default function Sidebar({ sidebarOpen }) {
    const { auth, storeProfile, appVersion, branding } = usePage().props;
    const menuNavigation = Menu();

    const appName = branding?.appName || storeProfile?.name || "KASIR";
    const appLogo = branding?.logoLight || storeProfile?.logo || null;
    const appLogoMini = branding?.logoCollapsed || branding?.favicon || appLogo;
    const appInitial =
        appName?.charAt(0)?.toUpperCase() ||
        auth?.user?.name?.charAt(0)?.toUpperCase() ||
        "K";

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
            <div className="flex items-center justify-center h-16 border-b border-slate-100 dark:border-slate-800 px-4">
                {sidebarOpen ? (
                    <div className="flex items-center gap-2.5 w-full min-w-0">
                        {appLogo ? (
                            <img
                                src={appLogo}
                                alt={appName}
                                className="w-9 h-9 rounded-lg object-contain shrink-0"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0 shadow-sm shadow-primary-500/20">
                                <span className="text-white font-bold text-sm">
                                    {appInitial}
                                </span>
                            </div>
                        )}
                        <span className="text-lg font-bold text-slate-800 dark:text-white truncate">
                            {appName}
                        </span>
                    </div>
                ) : (
                    appLogoMini ? (
                        <img
                            src={appLogoMini}
                            alt={appName}
                            className="w-9 h-9 rounded-lg object-contain"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm shadow-primary-500/20">
                            <span className="text-white font-bold text-sm">
                                {appInitial}
                            </span>
                        </div>
                    )
                )}
            </div>

            {/* Navigation */}
            <nav className="dashboard-scrollbar min-h-0 flex-1 overflow-y-auto py-3">
                {menuNavigation.map((section, index) => {
                    const hasPermission = section.details.some(
                        (detail) => detail.permissions === true
                    );
                    if (!hasPermission) return null;

                    return (
                        <div key={index} className="mb-2">
                            {/* Section Title */}
                            {sidebarOpen && (
                                <div className="px-4 py-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                                        {section.title}
                                    </span>
                                </div>
                            )}

                            {/* Menu Items */}
                            <div
                                className={
                                    sidebarOpen
                                        ? ""
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
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Version/Footer */}
            {sidebarOpen && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center space-y-1">
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
