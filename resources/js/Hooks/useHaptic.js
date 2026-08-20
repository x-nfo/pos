import { useCallback } from "react";

/**
 * Custom Hook for Vibration / Haptic Feedback API
 * Enhances mobile touch interactions (tap, scan success, error, checkout).
 */
export function useHaptic() {
    const triggerHaptic = useCallback((type = "light") => {
        if (typeof window === "undefined" || !("vibrate" in navigator)) {
            return;
        }

        try {
            switch (type) {
                case "light":
                case "tap":
                    navigator.vibrate(12);
                    break;
                case "medium":
                    navigator.vibrate(25);
                    break;
                case "heavy":
                    navigator.vibrate(45);
                    break;
                case "success":
                    // Double subtle buzz
                    navigator.vibrate([20, 40, 25]);
                    break;
                case "warning":
                    navigator.vibrate([35, 30, 35]);
                    break;
                case "error":
                    navigator.vibrate([50, 40, 50, 40, 60]);
                    break;
                case "scan":
                    navigator.vibrate(30);
                    break;
                default:
                    navigator.vibrate(15);
                    break;
            }
        } catch {
            // Ignore devices that block vibration without user gesture
        }
    }, []);

    return { triggerHaptic };
}

export default useHaptic;
