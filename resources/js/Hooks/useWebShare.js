import { useState, useCallback } from "react";

/**
 * Custom Hook for Web Share API
 * Enables native mobile sharing (WhatsApp, Telegram, AirDrop, etc.)
 */
export function useWebShare() {
    const [isSupported] = useState(
        () => typeof navigator !== "undefined" && !!navigator.share
    );

    const share = useCallback(
        async ({ title, text, url, files }) => {
            if (!isSupported) {
                return false;
            }

            try {
                const shareData = {};
                if (title) shareData.title = title;
                if (text) shareData.text = text;
                if (url) shareData.url = url;
                if (files && navigator.canShare && navigator.canShare({ files })) {
                    shareData.files = files;
                }

                await navigator.share(shareData);
                return true;
            } catch (err) {
                // User abort / cancel is normal
                if (err.name !== "AbortError") {
                    console.error("WebShare error:", err);
                }
                return false;
            }
        },
        [isSupported]
    );

    return { isSupported, share };
}

export default useWebShare;
