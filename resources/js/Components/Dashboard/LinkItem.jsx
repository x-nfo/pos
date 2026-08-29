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
    ...props
}) {
    const { url } = usePage();
    const { auth } = usePage().props;

    const isActive = url.startsWith(href);
    const canAccess = isSuperAdmin(auth) || access === true;

    if (!canAccess) return null;

    const baseClasses = `
        flex items-center gap-3
        transition-all duration-200
        text-slate-600 dark:text-slate-400
    `;

    const activeClasses = isActive
        ? "bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-400 border-l-[3px] border-primary-500"
        : "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border-l-[3px] border-transparent";

    if (sidebarOpen) {
        return (
            <Link
                href={href}
                className={`${baseClasses} ${activeClasses} px-4 py-2.5 text-sm font-medium justify-between`}
                {...props}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <span
                        className={
                            isActive ? "text-primary-600 dark:text-primary-400" : ""
                        }
                    >
                        {icon}
                    </span>
                    <span className="truncate">{title}</span>
                </div>
                {badge > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500 text-white shrink-0 shadow-xs animate-pulse">
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
                w-full flex justify-center py-3 relative
                transition-all duration-200
                ${
                    isActive
                        ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }
            `}
            title={title}
            {...props}
        >
            <span className="relative">
                {icon}
                {badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                )}
            </span>
        </Link>
    );
}
