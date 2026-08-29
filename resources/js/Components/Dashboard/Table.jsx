import React, { useRef, useState, useEffect } from "react";
import { IconDatabaseOff, IconArrowsHorizontal } from "@tabler/icons-react";

/**
 * Table.Card — Modern Card Container for Dashboard Tables
 */
const Card = ({ icon, title, badge, actions, className = "", children }) => {
    return (
        <div
            className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden ${className}`}
        >
            {title && (
                <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {icon && (
                            <div className="text-primary-600 dark:text-primary-400 flex-shrink-0">
                                {icon}
                            </div>
                        )}
                        <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                            {title}
                        </h3>
                        {badge && (
                            <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                                {badge}
                            </span>
                        )}
                    </div>
                    {actions && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {actions}
                        </div>
                    )}
                </div>
            )}
            <div className="relative">{children}</div>
        </div>
    );
};

/**
 * Table — Responsive Table with Touch-momentum Scrolling & Mobile Swipe Indicator
 */
const Table = ({ className = "", children }) => {
    const scrollRef = useRef(null);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setCanScrollRight(scrollWidth - (scrollLeft + clientWidth) > 10);
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener("resize", checkScroll);
        return () => window.removeEventListener("resize", checkScroll);
    }, []);

    return (
        <div className="relative w-full max-w-full overflow-hidden min-w-0">
            <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="w-full overflow-x-auto overscroll-x-contain touch-pan-x"
                style={{ WebkitOverflowScrolling: "touch" }}
            >
                <table
                    className={`w-full text-xs sm:text-sm text-left border-collapse ${className}`}
                >
                    {children}
                </table>
            </div>

            {/* Mobile Scroll Hint Badge (Appears when table overflows horizontally on mobile) */}
            {canScrollRight && (
                <div className="sm:hidden pointer-events-none absolute right-2 bottom-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/80 dark:bg-white/90 text-white dark:text-slate-900 text-[10px] font-bold backdrop-blur-xs shadow-md animate-pulse">
                    <IconArrowsHorizontal size={12} />
                    <span>Geser</span>
                </div>
            )}
        </div>
    );
};

const Thead = ({ className = "", children }) => {
    return (
        <thead
            className={`border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${className}`}
        >
            {children}
        </thead>
    );
};

const Tbody = ({ className = "", children }) => {
    return (
        <tbody
            className={`divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 ${className}`}
        >
            {children}
        </tbody>
    );
};

const Th = ({ className = "", children, ...props }) => {
    return (
        <th
            scope="col"
            className={`h-10 sm:h-11 px-3 sm:px-4 text-left align-middle font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap ${className}`}
            {...props}
        >
            {children}
        </th>
    );
};

const Td = ({ className = "", children, ...props }) => {
    return (
        <td
            className={`px-3 py-3 sm:px-4 sm:py-3.5 align-middle text-xs sm:text-sm whitespace-nowrap ${className}`}
            {...props}
        >
            {children}
        </td>
    );
};

const Empty = ({ colSpan = 1, message = "Tidak ada data yang ditemukan", children }) => {
    return (
        <tr>
            <td colSpan={colSpan} className="py-12 sm:py-16 text-center">
                <div className="flex flex-col items-center justify-center px-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 text-slate-400">
                        {children || <IconDatabaseOff size={28} strokeWidth={1.5} />}
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {message}
                    </div>
                </div>
            </td>
        </tr>
    );
};

Table.Card = Card;
Table.Thead = Thead;
Table.Tbody = Tbody;
Table.Td = Td;
Table.Th = Th;
Table.Empty = Empty;

export default Table;
