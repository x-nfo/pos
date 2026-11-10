import { useState, useEffect, useRef, useCallback } from "react";
import { router } from "@inertiajs/react";

/**
 * Normalizes input from Inertia (array vs LengthAwarePaginator object)
 */
function normalizePaginator(raw) {
    if (Array.isArray(raw)) {
        return {
            data: raw,
            current_page: 1,
            last_page: 1,
            total: raw.length,
            has_more: false,
            next_page_url: null,
        };
    }

    const data = Array.isArray(raw?.data) ? raw.data : [];
    const currentPage = Number(raw?.current_page) || 1;
    const lastPage = Number(raw?.last_page) || 1;
    const total = typeof raw?.total === "number" ? raw.total : data.length;
    const nextPageUrl = raw?.next_page_url || null;
    const hasMore = Boolean(nextPageUrl || currentPage < lastPage);

    return {
        data,
        current_page: currentPage,
        last_page: lastPage,
        total,
        has_more: hasMore,
        next_page_url: nextPageUrl,
    };
}

/**
 * Custom Hook for Catalog Infinite Scrolling & Pagination
 *
 * @param {Object|Array} productsProp - Initial or updated products from Inertia
 * @param {Object} activeFilters - Current filter dictionary (q, category_id, sort, in_stock, etc.)
 */
export function useCatalogInfiniteScroll(productsProp, activeFilters = {}) {
    const initial = normalizePaginator(productsProp);

    const [items, setItems] = useState(initial.data);
    const [currentPage, setCurrentPage] = useState(initial.current_page);
    const [lastPage, setLastPage] = useState(initial.last_page);
    const [total, setTotal] = useState(initial.total);
    const [hasMore, setHasMore] = useState(initial.has_more);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const sentinelRef = useRef(null);
    const isLoadingMoreRef = useRef(false);
    isLoadingMoreRef.current = isLoadingMore;

    // Synchronize when Inertia updates productsProp
    useEffect(() => {
        const fresh = normalizePaginator(productsProp);

        if (fresh.current_page <= 1) {
            // Fresh filter/query reset or page 1 reload: replace items list
            setItems(fresh.data);
        } else {
            // Successive page load: append new items with ID deduplication
            setItems((prev) => {
                const existingIds = new Set(prev.map((item) => item.id));
                const uniqueNew = fresh.data.filter((item) => !existingIds.has(item.id));
                return [...prev, ...uniqueNew];
            });
        }

        setCurrentPage(fresh.current_page);
        setLastPage(fresh.last_page);
        setTotal(fresh.total);
        setHasMore(fresh.has_more);
        setIsLoadingMore(false);
    }, [productsProp]);

    // Request next page
    const loadMore = useCallback(() => {
        if (isLoadingMoreRef.current || !hasMore) return;

        const nextPage = currentPage + 1;
        setIsLoadingMore(true);

        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("page", String(nextPage));

        // Ensure active filters are kept in sync
        Object.entries(activeFilters).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== "" && val !== "all" && val !== false) {
                currentUrl.searchParams.set(key, String(val));
            }
        });

        router.get(
            currentUrl.pathname + currentUrl.search,
            {},
            {
                preserveState: true,
                preserveScroll: true,
                only: ["products"],
                onFinish: () => {
                    setIsLoadingMore(false);
                },
                onError: () => {
                    setIsLoadingMore(false);
                },
            }
        );
    }, [currentPage, hasMore, activeFilters]);

    // IntersectionObserver auto-trigger for initial pages (up to page 3)
    useEffect(() => {
        // Threshold: stop auto-loading at page 4 to give users access to footer & contact info
        if (!sentinelRef.current || !hasMore || currentPage >= 4) {
            return;
        }

        const target = sentinelRef.current;
        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first && first.isIntersecting && !isLoadingMoreRef.current) {
                    loadMore();
                }
            },
            {
                root: null,
                rootMargin: "250px", // Trigger 250px before entering viewport for smooth UX
                threshold: 0.01,
            }
        );

        observer.observe(target);

        return () => {
            if (target) observer.unobserve(target);
            observer.disconnect();
        };
    }, [sentinelRef, hasMore, currentPage, loadMore]);

    return {
        items,
        total,
        currentPage,
        lastPage,
        hasMore,
        isLoadingMore,
        loadMore,
        sentinelRef,
        isAutoLoadThresholdReached: currentPage >= 4,
    };
}

