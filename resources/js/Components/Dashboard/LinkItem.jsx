import React from "react";
import { Link, usePage } from "@inertiajs/react";
import { isSuperAdmin } from "@/Utils/authorization";

export default function LinkItem({
    href,
    icon,
    access,
    title,
    sidebarOpen,
    badge = null,
    active,
    ...props
}) {
    const { url } = usePage();
    const { auth } = usePage().props;

    // Check active status
    const checkIsActive = () => {
        if (typeof active === "boolean") return active;
        if (!href) return false;
        const currentPath = (url || "")
            .split("?")[0]
            .split("#")[0]
            .replace(/\/+$/, "") || "/";
        let targetPath = "";
        try {
            targetPath =
                (new URL(href, window.location.origin).pathname || "").replace(/\/+$/, "") || "/";
        } catch {
            targetPath = (href.split("?")[0].split("#")[0] || "").replace(/\/+$/, "") || "/";
        }
        if (targetPath === "/dashboard") return currentPath === "/dashboard";
        return currentPath === targetPath || currentPath.startsWith(targetPath + "/");
    };

    const isActive = checkIsActive();
    const canAccess = isSuperAdmin(auth) || access === true;

    if (!canAccess) return null;

    if (sidebarOpen) {
        return (
            <Link
                href={href}
                className={`
                    group flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all duration-150 relative w-full
                    ${
                        isActive
                            ? "bg-primary-50 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 font-semibold shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                    }
                `}
                {...props}
            >
                {/* Active indicator bar on left */}
                {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary-600 dark:bg-primary-400" />
                )}

                <div className="flex items-center gap-3 min-w-0">
                    <span
                        className={`transition-colors shrink-0 ${
                            isActive
                                ? "text-primary-600 dark:text-primary-400"
                                : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                        }`}
                    >
                        {icon}
                    </span>
                    <span className="truncate">{title}</span>
                </div>

                {badge > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500 text-white shrink-0 shadow-xs animate-pulse">
                        {badge > 99 ? "99+" : badge}
                    </span>
                )}
            </Link>
        );
    }

    // Collapsed sidebar
    return (
        <Link
            href={href}
            className={`
                w-11 h-11 mx-auto my-1 flex items-center justify-center rounded-xl relative transition-all duration-150
                ${
                    isActive
                        ? "bg-primary-50 dark:bg-primary-950/70 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500/20 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                }
            `}
            title={title}
            {...props}
        >
            <span className="relative flex items-center justify-center">
                {icon}
                {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                )}
            </span>
        </Link>
    );
}
