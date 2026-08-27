export const DEFAULT_PRODUCT_IMAGE = "/images/product-placeholder.svg?v=5";

/**
 * Get proper image URL - handles both full URLs and filenames
 * @param {string} image - Image path (can be filename or full URL)
 * @param {string} folder - Storage folder (products, categories, etc)
 * @param {string|null} fallback - Fallback image URL if image is empty
 * @returns {string|null} - Proper image URL or fallback/null
 */
export function getImageUrl(image, folder = "products", fallback = null) {
    if (!image || typeof image !== "string") return fallback;

    const trimmed = image.trim();
    if (
        !trimmed ||
        trimmed.endsWith("/storage/products") ||
        trimmed.endsWith("/storage/products/") ||
        trimmed.endsWith("/storage/category") ||
        trimmed.endsWith("/storage/category/") ||
        trimmed.endsWith("/storage/categories") ||
        trimmed.endsWith("/storage/categories/")
    ) {
        return fallback;
    }

    // If already a full URL, return as-is
    if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("/storage/") ||
        trimmed.startsWith("/images/")
    ) {
        return trimmed;
    }

    // Otherwise, prepend storage path
    return `/storage/${folder}/${trimmed.replace(/^\/+/, "")}`;
}

/**
 * Get product image URL
 * @param {string} image - Product image
 * @param {boolean|string} fallback - Whether to use default product placeholder or custom URL
 * @returns {string|null}
 */
export function getProductImageUrl(image, fallback = false) {
    const fallbackUrl = fallback === true ? DEFAULT_PRODUCT_IMAGE : (typeof fallback === "string" ? fallback : null);
    return getImageUrl(image, "products", fallbackUrl);
}

/**
 * Get category image URL
 * @param {string} image - Category image
 * @param {string|null} fallback - Fallback image URL
 * @returns {string|null}
 */
export function getCategoryImageUrl(image, fallback = null) {
    return getImageUrl(image, "category", fallback);
}

export default {
    DEFAULT_PRODUCT_IMAGE,
    getImageUrl,
    getProductImageUrl,
    getCategoryImageUrl,
};

