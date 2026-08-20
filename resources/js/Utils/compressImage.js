/**
 * Compresses and resizes an image File using HTML5 Canvas.
 * 
 * @param {File} file - The original image file from input/camera
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width (default: 1200)
 * @param {number} options.maxHeight - Maximum height (default: 1200)
 * @param {number} options.quality - Quality from 0 to 1 (default: 0.82)
 * @param {string} options.mimeType - Output mime type (default: 'image/jpeg')
 * @returns {Promise<{file: File, originalSize: number, compressedSize: number, formattedOriginal: string, formattedCompressed: string}>}
 */
export async function compressImage(file, options = {}) {
    const {
        maxWidth = 1200,
        maxHeight = 1200,
        quality = 0.82,
        mimeType = "image/jpeg",
    } = options;

    // If file is not an image, return as is
    if (!file || !file.type.startsWith("image/")) {
        return {
            file,
            originalSize: file?.size || 0,
            compressedSize: file?.size || 0,
            formattedOriginal: formatBytes(file?.size || 0),
            formattedCompressed: formatBytes(file?.size || 0),
        };
    }

    const originalSize = file.size;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                let { width, height } = img;

                // Calculate aspect ratio scale
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                
                // Draw background white for transparent png when converting to jpeg
                if (mimeType === "image/jpeg") {
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(0, 0, width, height);
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            // Fallback to original file
                            resolve({
                                file,
                                originalSize,
                                compressedSize: originalSize,
                                formattedOriginal: formatBytes(originalSize),
                                formattedCompressed: formatBytes(originalSize),
                            });
                            return;
                        }

                        // Create new File object
                        const extension = mimeType === "image/webp" ? "webp" : "jpg";
                        const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || "product-image";
                        const newFileName = `${baseName}_optimized.${extension}`;
                        const compressedFile = new File([blob], newFileName, {
                            type: mimeType,
                            lastModified: Date.now(),
                        });

                        resolve({
                            file: compressedFile,
                            originalSize,
                            compressedSize: compressedFile.size,
                            formattedOriginal: formatBytes(originalSize),
                            formattedCompressed: formatBytes(compressedFile.size),
                        });
                    },
                    mimeType,
                    quality
                );
            };

            img.onerror = () => {
                resolve({
                    file,
                    originalSize,
                    compressedSize: originalSize,
                    formattedOriginal: formatBytes(originalSize),
                    formattedCompressed: formatBytes(originalSize),
                });
            };
        };

        reader.onerror = () => {
            resolve({
                file,
                originalSize,
                compressedSize: originalSize,
                formattedOriginal: formatBytes(originalSize),
                formattedCompressed: formatBytes(originalSize),
            });
        };
    });
}

/**
 * Format bytes to readable string (e.g. 1.2 MB, 340 KB)
 */
export function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
