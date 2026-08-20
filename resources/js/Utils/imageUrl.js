export const DEFAULT_PRODUCT_IMAGE = "/images/product-placeholder.svg";

/**
 * Get proper image URL - handles both full URLs and filenames
 * @param {string} image - Image path (can be filename or full URL)
 * @param {string} folder - Storage folder (products, categories, etc)
 * @param {string|null} fallback - Fallback image URL if image is empty
 * @returns {string|null} - Proper image URL or fallback/null
 */
export function getImageUrl(image, folder = "products", fallback = null) {
    if (!image) return fallback;

    // If already a full URL, return as-is
    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("/storage/") ||
        image.startsWith("/images/")
    ) {
        return image;
    }

    // Otherwise, prepend storage path
    return `/storage/${folder}/${image}`;
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
    return getImageUrl(image, "categories", fallback);
}

export default {
    DEFAULT_PRODUCT_IMAGE,
    getImageUrl,
    getProductImageUrl,
    getCategoryImageUrl,
};

