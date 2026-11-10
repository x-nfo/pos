import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
    getStoredWishlist,
    setStoredWishlist,
    formatWishlistItem,
    WISHLIST_EVENT_NAME,
    WISHLIST_STORAGE_KEY,
} from "@/Utils/wishlist";

/**
 * Custom hook to interact reactively with the public catalog wishlist.
 * Synchronizes across multiple components and browser tabs.
 */
export function useWishlist() {
    const [wishlist, setWishlist] = useState(() => getStoredWishlist());

    useEffect(() => {
        // Handle in-tab updates via CustomEvent
        const handleCustomUpdate = (event) => {
            if (event?.detail?.items && Array.isArray(event.detail.items)) {
                setWishlist(event.detail.items);
            } else {
                setWishlist(getStoredWishlist());
            }
        };

        // Handle cross-tab updates via window storage event
        const handleStorageChange = (event) => {
            if (event.key === WISHLIST_STORAGE_KEY) {
                try {
                    const parsed = event.newValue ? JSON.parse(event.newValue) : [];
                    setWishlist(Array.isArray(parsed) ? parsed : []);
                } catch {
                    setWishlist([]);
                }
            }
        };

        window.addEventListener(WISHLIST_EVENT_NAME, handleCustomUpdate);
        window.addEventListener("storage", handleStorageChange);

        return () => {
            window.removeEventListener(WISHLIST_EVENT_NAME, handleCustomUpdate);
            window.removeEventListener("storage", handleStorageChange);
        };
    }, []);

    const isInWishlist = useCallback(
        (productId) => {
            if (productId == null) return false;
            return wishlist.some((item) => String(item.id) === String(productId));
        },
        [wishlist]
    );

    const addToWishlist = useCallback(
        (product, showToast = true) => {
            if (!product || product.id == null) return false;

            const current = getStoredWishlist();
            if (current.some((item) => String(item.id) === String(product.id))) {
                return true;
            }

            const formatted = formatWishlistItem(product);
            const next = [formatted, ...current];
            const ok = setStoredWishlist(next);

            if (ok && showToast) {
                const title = product.title || "Produk";
                toast.success(`Disimpan ke Wishlist: ${title}`, {
                    id: `wishlist-add-${product.id}`,
                    icon: "❤️",
                    duration: 3500,
                });
            }
            return ok;
        },
        []
    );

    const removeFromWishlist = useCallback(
        (productId, showToast = true, customTitle = null) => {
            if (productId == null) return false;

            const current = getStoredWishlist();
            const itemToRemove = current.find((i) => String(i.id) === String(productId));
            const next = current.filter((i) => String(i.id) !== String(productId));
            const ok = setStoredWishlist(next);

            if (ok && showToast) {
                const title = customTitle || itemToRemove?.title || "Produk";
                toast.success(`Dihapus dari Wishlist: ${title}`, {
                    id: `wishlist-rem-${productId}`,
                    duration: 3000,
                });
            }
            return ok;
        },
        []
    );

    const toggleWishlist = useCallback(
        (product, showToast = true) => {
            if (!product || product.id == null) return false;

            const isCurrentlyIn = isInWishlist(product.id);
            if (isCurrentlyIn) {
                return removeFromWishlist(product.id, showToast, product.title);
            } else {
                return addToWishlist(product, showToast);
            }
        },
        [isInWishlist, addToWishlist, removeFromWishlist]
    );

    const clearWishlist = useCallback(
        (showToast = true) => {
            const ok = setStoredWishlist([]);
            if (ok && showToast) {
                toast.success("Wishlist telah dikosongkan", {
                    id: "wishlist-cleared",
                    duration: 3000,
                });
            }
            return ok;
        },
        []
    );

    return {
        wishlist,
        wishlistCount: wishlist.length,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        clearWishlist,
    };
}

export default useWishlist;

