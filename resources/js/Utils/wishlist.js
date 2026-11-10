/**
 * Wishlist Utility for Point of Sales Public Catalog
 * Manages persistent storage of wishlisted products in localStorage with
 * cross-tab synchronization and error resilience.
 */

export const WISHLIST_STORAGE_KEY = "pos_catalog_wishlist_v1";
export const WISHLIST_EVENT_NAME = "pos:wishlist-updated";

/**
 * Safely parse JSON from localStorage with defensive fallbacks.
 *
 * @returns {Array} List of stored wishlist items
 */
export const getStoredWishlist = () => {
    if (typeof window === "undefined" || !window.localStorage) {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        // Validate and ensure each entry has an id
        return parsed.filter(
            (item) => item && typeof item === "object" && item.id != null
        );
    } catch (e) {
        console.warn("Gagal membaca wishlist dari localStorage:", e);
        return [];
    }
};

/**
 * Safely persist wishlist array to localStorage and broadcast an update event.
 *
 * @param {Array} items
 * @returns {boolean} True if successfully stored
 */
export const setStoredWishlist = (items) => {
    if (typeof window === "undefined" || !window.localStorage) {
        return false;
    }
    try {
        const sanitized = Array.isArray(items)
            ? items.filter(
                (item) => item && typeof item === "object" && item.id != null
            )
            : [];

        // Deduplicate by product id (preserving earliest/latest unique items)
        const seen = new Set();
        const unique = [];
        for (const item of sanitized) {
            const key = String(item.id);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        }

        window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(unique));

        // Dispatch CustomEvent for reactive sync within the current tab
        try {
            window.dispatchEvent(
                new CustomEvent(WISHLIST_EVENT_NAME, { detail: { items: unique } })
            );
        } catch (_) { }

        return true;
    } catch (e) {
        console.error("Gagal menyimpan wishlist ke localStorage:", e);
        return false;
    }
};

/**
 * Formats a Product model or payload into a lightweight, self-contained wishlist item.
 *
 * @param {Object} product
 * @returns {Object|null}
 */
export const formatWishlistItem = (product) => {
    if (!product || product.id == null) return null;

    const sellPrice = Number(product.sell_price || 0);
    const finalPrice = Number(product.final_price || product.sell_price || 0);
    const hasDiscount = Boolean(product.has_discount) && finalPrice < sellPrice;
    const discountPercentage = Number(product.discount_percentage || 0);

    const imageUrl =
        product.image ||
        (Array.isArray(product.gallery) && product.gallery[0]) ||
        (Array.isArray(product.images) && product.images[0]) ||
        null;

    const hasVariants =
        Boolean(product.has_variants) ||
        (Array.isArray(product.variants) && product.variants.length > 0);

    return {
        id: product.id,
        title: product.title || "Produk",
        category_name: product.category_name || product.category?.name || "Koleksi",
        category_id: product.category_id || product.category?.id || null,
        sell_price: sellPrice,
        final_price: finalPrice,
        has_discount: hasDiscount,
        discount_percentage: discountPercentage,
        image: imageUrl,
        stock: Number(product.stock ?? 0),
        has_variants: hasVariants,
        variants: Array.isArray(product.variants) ? product.variants : [],
        units: Array.isArray(product.units) ? product.units : [],
        added_at: new Date().toISOString(),
    };
};

/**
 * Check if a product ID exists in the wishlist
 *
 * @param {number|string} productId
 * @returns {boolean}
 */
export const isProductInWishlist = (productId) => {
    if (productId == null) return false;
    const current = getStoredWishlist();
    return current.some((item) => String(item.id) === String(productId));
};

/**
 * Add a product to the wishlist
 *
 * @param {Object} product
 * @returns {{ success: boolean, added: boolean, items: Array }}
 */
export const addWishlistItem = (product) => {
    if (!product || product.id == null) {
        return { success: false, added: false, items: getStoredWishlist() };
    }
    const current = getStoredWishlist();
    const exists = current.some((item) => String(item.id) === String(product.id));
    if (exists) {
        return { success: true, added: false, items: current };
    }

    const formatted = formatWishlistItem(product);
    const next = [formatted, ...current];
    const success = setStoredWishlist(next);
    return { success, added: success, items: success ? next : current };
};

/**
 * Remove a product from the wishlist
 *
 * @param {number|string} productId
 * @returns {{ success: boolean, removed: boolean, items: Array }}
 */
export const removeWishlistItem = (productId) => {
    if (productId == null) {
        return { success: false, removed: false, items: getStoredWishlist() };
    }
    const current = getStoredWishlist();
    const next = current.filter((item) => String(item.id) !== String(productId));
    const removed = next.length !== current.length;
    const success = setStoredWishlist(next);
    return { success, removed, items: success ? next : current };
};

/**
 * Toggle a product in/out of the wishlist
 *
 * @param {Object} product
 * @returns {{ success: boolean, isWishlisted: boolean, items: Array }}
 */
export const toggleWishlistItem = (product) => {
    if (!product || product.id == null) {
        return { success: false, isWishlisted: false, items: getStoredWishlist() };
    }
    if (isProductInWishlist(product.id)) {
        const res = removeWishlistItem(product.id);
        return { success: res.success, isWishlisted: false, items: res.items };
    } else {
        const res = addWishlistItem(product);
        return { success: res.success, isWishlisted: true, items: res.items };
    }
};

/**
 * Clear all wishlist items
 *
 * @returns {boolean}
 */
export const clearStoredWishlist = () => {
    return setStoredWishlist([]);
};

