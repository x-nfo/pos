import React, { useState } from "react";
import { IconChevronDown, IconChevronUp, IconDotsVertical } from "@tabler/icons-react";
import { useHaptic } from "@/Hooks/useHaptic";

export default function MobileDataCard({
    title,
    subtitle,
    badge,
    avatar,
    meta = [],
    actions = [],
    onClick,
    expandable = false,
    expandedContent,
    className = "",
}) {
    const { triggerHaptic } = useHaptic();
    const [isExpanded, setIsExpanded] = useState(false);

    const handleCardClick = (e) => {
        if (onClick) {
            triggerHaptic("tap");
            onClick(e);
        } else if (expandable) {
            triggerHaptic("light");
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div
            className={`w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm transition-all duration-200 active-press ${
                onClick ? "cursor-pointer hover:border-primary-300 dark:hover:border-primary-700" : ""
            } ${className}`}
            onClick={handleCardClick}
        >
            <div className="flex items-start gap-3">
                {/* Optional Avatar / Icon / Image */}
                {avatar && (
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200/60 dark:border-slate-700">
                        {avatar}
                    </div>
                )}

                {/* Main Info */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {title}
                        </h4>
                        {badge && <div className="flex-shrink-0">{badge}</div>}
                    </div>

                    {subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium line-clamp-1">
                            {subtitle}
                        </p>
                    )}

                    {/* Metadata Badges / Info List */}
                    {meta.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            {meta.map((item, idx) => (
                                <span
                                    key={idx}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
                                        item.variant === "primary"
                                            ? "bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
                                            : item.variant === "success"
                                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                            : item.variant === "warning"
                                            ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                            : item.variant === "danger"
                                            ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                    }`}
                                >
                                    {item.icon && <span className="opacity-80">{item.icon}</span>}
                                    <span>{item.label}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Optional Expand Toggle or Actions */}
                {expandable && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic("light");
                            setIsExpanded(!isExpanded);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        {isExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                    </button>
                )}
            </div>

            {/* Expanded Content */}
            {expandable && isExpanded && expandedContent && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 animate-slide-up">
                    {expandedContent}
                </div>
            )}

            {/* Quick Actions Bar */}
            {actions.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2">
                    {actions.map((action, idx) => (
                        <button
                            key={idx}
                            type="button"
                            disabled={action.disabled}
                            onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic("tap");
                                action.onClick(e);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-all ${
                                action.variant === "danger"
                                    ? "bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-400"
                                    : action.variant === "primary"
                                    ? "bg-primary-600 hover:bg-primary-700 text-white shadow-sm"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
                            }`}
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
