import React, { useMemo, useState, useEffect } from "react";
import { Link, usePage } from "@inertiajs/react";
import { IconChevronDown } from "@tabler/icons-react";
import { isSuperAdmin } from "@/Utils/authorization";

export default function LinkItemDropdown({
    icon,
    title,
    data = [],
    access,
    sidebarOpen,
    ...props
}) {
    const { url } = usePage();
    const { auth } = usePage().props;
    const superAdmin = isSuperAdmin(auth);

    const visibleItems = useMemo(
        () => data.filter((item) => superAdmin || item.permissions === true),
        [data, superAdmin]
    );

    const checkIsItemActive = (item) => {
        if (typeof item.active === "boolean") return item.active;
        if (!item.href) return false;
        const currentPath = (url || "")
            .split("?")[0]
            .split("#")[0]
            .replace(/\/+$/, "") || "/";
        let targetPath = "";
        try {
            targetPath =
                (new URL(item.href, window.location.origin).pathname || "").replace(/\/+$/, "") || "/";
        } catch {
            targetPath = (item.href.split("?")[0].split("#")[0] || "").replace(/\/+$/, "") || "/";
        }
        if (targetPath === "/dashboard") return currentPath === "/dashboard";
        return currentPath === targetPath || currentPath.startsWith(targetPath + "/");
    };

    const hasActiveChild = useMemo(
        () => visibleItems.some((item) => checkIsItemActive(item)),
        [visibleItems, url]
    );

    // Auto-open when current URL is inside this dropdown
    const [isOpen, setIsOpen] = useState(hasActiveChild);

    useEffect(() => {
        if (hasActiveChild) {
            setIsOpen(true);
        }
    }, [hasActiveChild, url]);

    // Total badges inside subdetails
    const totalBadgeCount = useMemo(() => {
        return visibleItems.reduce((acc, item) => acc + (item.badge || 0), 0);
    }, [visibleItems]);

    const canRenderParent = superAdmin || access === true || visibleItems.length > 0;

    if (!canRenderParent || visibleItems.length === 0) {
        return null;
    }

    if (sidebarOpen) {
        return (
            <div className="w-full">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all duration-150 group
                        ${
                            hasActiveChild
                                ? "bg-primary-50/60 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-semibold"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                        }
                    `}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <span
                            className={`transition-colors shrink-0 ${
                                hasActiveChild
                                    ? "text-primary-600 dark:text-primary-400"
                                    : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                            }`}
                        >
                            {icon}
                        </span>
                        <span className="truncate text-left">{title}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {totalBadgeCount > 0 && (
                            <span className="px-1.5 py-0.2 text-[10px] font-extrabold rounded-full bg-rose-500 text-white animate-pulse">
                                {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
                            </span>
                        )}
                        {hasActiveChild && !isOpen && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                        )}
                        <IconChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform duration-200 ${
                                isOpen ? "rotate-180 text-primary-500" : ""
                            }`}
                        />
                    </div>
                </button>

                {isOpen && (
                    <div className="mt-1 ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        {visibleItems.map((item, index) => {
                            const isChildActive = checkIsItemActive(item);

                            return (
                                <Link
                                    key={index}
                                    href={item.href}
                                    className={`
                                        group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all relative
                                        ${
                                            isChildActive
                                                ? "bg-primary-50 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 font-semibold shadow-xs"
                                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
                                        }
                                    `}
                                    {...props}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {item.icon && (
                                            <span
                                                className={`shrink-0 ${
                                                    isChildActive
                                                        ? "text-primary-600 dark:text-primary-400"
                                                        : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500"
                                                }`}
                                            >
                                                {item.icon}
                                            </span>
                                        )}
                                        <span className="truncate">{item.title}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {item.badge > 0 && (
                                            <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded-full bg-rose-500 text-white animate-pulse">
                                                {item.badge}
                                            </span>
                                        )}
                                        {isChildActive && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary-600 dark:bg-primary-400" />
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // Collapsed sidebar
    return (
        <div className="relative group/dropdown flex justify-center my-1">
            <button
                type="button"
                className={`
                    w-11 h-11 flex items-center justify-center rounded-xl relative transition-all duration-150
                    ${
                        hasActiveChild
                            ? "bg-primary-50 dark:bg-primary-950/70 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500/20 shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    }
                `}
                title={title}
            >
                <span className="relative flex items-center justify-center">
                    {icon}
                    {hasActiveChild && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                    )}
                    {totalBadgeCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                    )}
                </span>
            </button>

            {/* Hover floating menu in collapsed mode */}
            <div className="hidden group-hover/dropdown:block absolute left-full top-0 ml-2 w-48 py-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 mb-1 border-b border-slate-100 dark:border-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                    {title}
                </div>
                <div className="space-y-0.5 px-1">
                    {visibleItems.map((item, index) => {
                        const isChildActive = checkIsItemActive(item);
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className={`
                                    flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors
                                    ${
                                        isChildActive
                                            ? "bg-primary-50 dark:bg-primary-950/80 text-primary-600 dark:text-primary-400 font-bold"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium"
                                    }
                                `}
                            >
                                <span className="truncate">{item.title}</span>
                                {isChildActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
