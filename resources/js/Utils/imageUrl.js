export const DEFAULT_PRODUCT_IMAGE = "/images/product-placeholder.svg?v=5";

/**
 * Normalize storage URLs to prevent broken images from port/host mismatches
 * @param {string} url
 * @returns {string}
 */
export function normalizeStorageUrl(url) {
    if (!url || typeof url !== "string") return url;
    const trimmed = url.trim();

    // If it's a localhost or 127.0.0.1 full URL with /storage/, extract relative path
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/storage\//i.test(trimmed)) {
        const idx = trimmed.indexOf("/storage/");
        return trimmed.substring(idx);
    }

    return trimmed;
}

/**
 * Get proper image URL - handles both full URLs and filenames
 * @param {string} image - Image path (can be filename or full URL)
 * @param {string} folder - Storage folder (products, categories, bank-logos, etc)
 * @param {string|null} fallback - Fallback image URL if image is empty
 * @returns {string|null} - Proper image URL or fallback/null
 */
export function getImageUrl(image, folder = "products", fallback = null) {
    if (!image || typeof image !== "string") return fallback;

    let trimmed = image.trim();
    if (
        !trimmed ||
        trimmed.endsWith("/storage/products") ||
        trimmed.endsWith("/storage/products/") ||
        trimmed.endsWith("/storage/category") ||
        trimmed.endsWith("/storage/category/") ||
        trimmed.endsWith("/storage/categories") ||
        trimmed.endsWith("/storage/categories/") ||
        trimmed.endsWith("/storage/bank-logos") ||
        trimmed.endsWith("/storage/bank-logos/") ||
        trimmed.endsWith("/storage/store") ||
        trimmed.endsWith("/storage/store/")
    ) {
        return fallback;
    }

    // Normalize localhost / 127.0.0.1 storage URLs
    trimmed = normalizeStorageUrl(trimmed);

    // If starts with blob: or data:
    if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
        return trimmed;
    }

    // If starts with storage/ (no leading slash)
    if (trimmed.startsWith("storage/")) {
        return `/${trimmed}`;
    }

    // If already a full URL or starts with /storage/ or /images/
    if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("/storage/") ||
        trimmed.startsWith("/images/")
    ) {
        return trimmed;
    }

    // If starts with folder name e.g. "bank-logos/xyz.png" or "products/abc.jpg" or "store/abc.png"
    if (folder && trimmed.startsWith(`${folder}/`)) {
        return `/storage/${trimmed}`;
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

/**
 * Get bank logo URL
 * @param {string} image - Bank logo
 * @param {string|null} fallback - Fallback image URL
 * @returns {string|null}
 */
export function getBankLogoUrl(image, fallback = null) {
    return getImageUrl(image, "bank-logos", fallback);
}

/**
 * Get store logo URL
 * @param {string} image - Store logo
 * @param {string|null} fallback - Fallback image URL
 * @returns {string|null}
 */
export function getStoreLogoUrl(image, fallback = null) {
    return getImageUrl(image, "store", fallback);
}

export default {
    DEFAULT_PRODUCT_IMAGE,
    normalizeStorageUrl,
    getImageUrl,
    getProductImageUrl,
    getCategoryImageUrl,
    getBankLogoUrl,
    getStoreLogoUrl,
};



