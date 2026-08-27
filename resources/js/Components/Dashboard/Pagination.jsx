import React, { useState } from "react";
import { Link, router } from "@inertiajs/react";
import {
    IconChevronRight,
    IconChevronLeft,
    IconDots,
} from "@tabler/icons-react";
import { useHaptic } from "@/Hooks/useHaptic";

/**
 * Pagination — Mobile-native optimized & responsive.
 * In desktop: full numeric pagination list.
 * In mobile: sleek touch-friendly Prev/Next controller with page jumping & per-page dropdown.
 */
export default function Pagination({ links }) {
    if (!links || links.length <= 3) return null;

    const { triggerHaptic } = useHaptic();

    const [perPage, setPerPage] = useState(
        () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("per_page") || "10"
    );

    const changePerPage = (value) => {
        triggerHaptic("tap");
        setPerPage(value);
        const url = new URL(window.location.href);
        url.searchParams.set("per_page", value);
        // Reset to page 1 on per-page change
        url.searchParams.delete("page");
        router.get(url.pathname + url.search, {}, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const toSafeUrl = (url) => {
        if (!url) return null;
        try {
            if (typeof window !== "undefined" && url.startsWith("http")) {
                const parsed = new URL(url);
                if (parsed.hostname === window.location.hostname) {
                    return parsed.pathname + parsed.search + parsed.hash;
                }
            }
            return url;
        } catch {
            return url;
        }
    };

    const isPrev = (item, i) =>
        i === 0 ||
        item.label.includes("Previous") ||
        item.label.includes("Sebelumnya") ||
        item.label.includes("&laquo;");

    const isNext = (item, i) =>
        i === links.length - 1 ||
        item.label.includes("Next") ||
        item.label.includes("Berikutnya") ||
        item.label.includes("&raquo;");

    const prevItem = links.find((item, i) => isPrev(item, i));
    const nextItem = links.find((item, i) => isNext(item, i));

    const numericItems = links.filter((l) => /^\d+$/.test(l.label));
    const currentItem = numericItems.find((l) => l.active);
    const currentPageNum = currentItem ? Number(currentItem.label) : 1;
    const totalPages = numericItems.length > 0 ? Math.max(...numericItems.map((l) => Number(l.label))) : 1;

    const baseBtn =
        "inline-flex items-center justify-center min-w-[36px] h-[36px] text-sm border rounded-xl bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:border-slate-800 border-slate-200 transition-all active:scale-95";
    const activeBtn =
        "border-primary-500 bg-primary-50 text-primary-700 font-bold dark:bg-primary-950/60 dark:text-primary-300 dark:border-primary-700 shadow-xs";
    const disabledBtn = "opacity-40 pointer-events-none cursor-not-allowed";

    const isEllipsis = (item, i) =>
        !item.url && !/^\d+$/.test(item.label) && !isPrev(item, i) && !isNext(item, i);

    return (
        <nav
            aria-label="Pagination Navigation"
            className="mt-5 mb-6 sm:mb-0 w-full select-none"
        >
            {/* 1. Mobile-Native Pagination Controller (< 640px) */}
            <div className="sm:hidden space-y-2.5">
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                    {/* Prev Button */}
                    {prevItem?.url ? (
                        <Link
                            href={toSafeUrl(prevItem.url)}
                            onClick={() => triggerHaptic("tap")}
                            className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 active:scale-95 transition-all"
                        >
                            <IconChevronLeft size={16} strokeWidth={2.5} />
                            <span>Prev</span>
                        </Link>
                    ) : (
                        <div
                            className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-400 dark:text-slate-600 border border-slate-200/40 dark:border-slate-800 opacity-60 cursor-not-allowed"
                        >
                            <IconChevronLeft size={16} strokeWidth={2} />
                            <span>Prev</span>
                        </div>
                    )}

                    {/* Page Indicator Center */}
                    <div className="px-3 text-center flex-shrink-0">
                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono block">
                            {currentPageNum} / {totalPages}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-none mt-0.5">
                            Halaman
                        </span>
                    </div>

                    {/* Next Button */}
                    {nextItem?.url ? (
                        <Link
                            href={toSafeUrl(nextItem.url)}
                            onClick={() => triggerHaptic("tap")}
                            className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 active:scale-95 transition-all"
                        >
                            <span>Next</span>
                            <IconChevronRight size={16} strokeWidth={2.5} />
                        </Link>
                    ) : (
                        <div
                            className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-400 dark:text-slate-600 border border-slate-200/40 dark:border-slate-800 opacity-60 cursor-not-allowed"
                        >
                            <span>Next</span>
                            <IconChevronRight size={16} strokeWidth={2} />
                        </div>
                    )}
                </div>

                {/* Per-Page Quick Selector Mobile */}
                <div className="flex items-center justify-between px-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Tampilkan data</span>
                    <div className="flex items-center gap-1.5">
                        {["10", "25", "50"].map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => changePerPage(opt)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                                    perPage === opt
                                        ? "bg-primary-600 text-white font-bold shadow-xs"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                        <span className="text-[11px] text-slate-400 ml-0.5">baris</span>
                    </div>
                </div>
            </div>

            {/* 2. Desktop Pagination View (>= 640px) */}
            <div className="hidden sm:flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Halaman{" "}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {currentPageNum}
                        </span>{" "}
                        dari{" "}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {totalPages}
                        </span>
                    </p>

                    <label className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                        <span>Tampilkan</span>
                        <select
                            value={perPage}
                            onChange={(e) => changePerPage(e.target.value)}
                            className="py-1 pl-2.5 pr-8 rounded-xl text-xs font-semibold border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 border-slate-200 focus:ring-1 focus:ring-primary-500 cursor-pointer"
                            aria-label="Jumlah data per halaman"
                        >
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                        </select>
                        <span>per halaman</span>
                    </label>
                </div>

                {/* Numeric Pagination Buttons */}
                <ul className="flex flex-wrap items-center justify-end gap-1.5">
                    {links.map((item, i) => {
                        if (isPrev(item, i)) {
                            return item.url ? (
                                <Link
                                    key={i}
                                    href={toSafeUrl(item.url)}
                                    className={baseBtn}
                                    aria-label="Halaman sebelumnya"
                                >
                                    <IconChevronLeft size={18} strokeWidth={1.8} />
                                </Link>
                            ) : (
                                <span
                                    key={i}
                                    className={`${baseBtn} ${disabledBtn}`}
                                    aria-disabled="true"
                                >
                                    <IconChevronLeft size={18} strokeWidth={1.8} />
                                </span>
                            );
                        }

                        if (isNext(item, i)) {
                            return item.url ? (
                                <Link
                                    key={i}
                                    href={toSafeUrl(item.url)}
                                    className={baseBtn}
                                    aria-label="Halaman berikutnya"
                                >
                                    <IconChevronRight size={18} strokeWidth={1.8} />
                                </Link>
                            ) : (
                                <span
                                    key={i}
                                    className={`${baseBtn} ${disabledBtn}`}
                                    aria-disabled="true"
                                >
                                    <IconChevronRight size={18} strokeWidth={1.8} />
                                </span>
                            );
                        }

                        if (isEllipsis(item, i) || !item.url) {
                            return (
                                <span
                                    key={i}
                                    className={`${baseBtn} ${disabledBtn}`}
                                    aria-disabled="true"
                                >
                                    <IconDots size={16} />
                                </span>
                            );
                        }

                        return (
                            <Link
                                key={i}
                                href={toSafeUrl(item.url)}
                                aria-current={item.active ? "page" : undefined}
                                className={`${baseBtn} px-3 ${
                                    item.active ? activeBtn : ""
                                }`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </ul>
            </div>
        </nav>
    );
}
