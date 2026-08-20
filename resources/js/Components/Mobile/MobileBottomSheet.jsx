import React, { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { useHaptic } from "@/Hooks/useHaptic";

export default function MobileBottomSheet({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    maxHeight = "max-h-[90vh]",
    showCloseButton = true,
    footer,
}) {
    const { triggerHaptic } = useHaptic();
    const sheetRef = useRef(null);
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef(0);
    const currentYRef = useRef(0);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
            setDragY(0);
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleTouchStart = (e) => {
        startYRef.current = e.touches[0].clientY;
        currentYRef.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        currentYRef.current = e.touches[0].clientY;
        const delta = currentYRef.current - startYRef.current;
        // Only allow dragging downwards
        if (delta > 0) {
            setDragY(delta);
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        const delta = currentYRef.current - startYRef.current;
        if (delta > 120) {
            triggerHaptic("light");
            onClose();
        } else {
            setDragY(0);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
                onClick={() => {
                    triggerHaptic("tap");
                    onClose();
                }}
            />

            {/* Sheet Container */}
            <div
                ref={sheetRef}
                style={{
                    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
                    transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                className={`relative z-10 w-full rounded-t-3xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col ${maxHeight} overscroll-contain pb-safe animate-sheet-up border-t border-slate-200/50 dark:border-slate-800`}
            >
                {/* Drag Handle Area */}
                <div
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="w-full pt-3 pb-2 flex flex-col items-center cursor-grab active:cursor-grabbing select-none"
                >
                    <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                </div>

                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="px-5 pb-3 pt-1 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
                        <div className="min-w-0 flex-1 pr-2">
                            {title && (
                                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                    {title}
                                </h3>
                            )}
                            {subtitle && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                    {subtitle}
                                </p>
                            )}
                        </div>

                        {showCloseButton && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("tap");
                                    onClose();
                                }}
                                className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                            >
                                <IconX size={20} />
                            </button>
                        )}
                    </div>
                )}

                {/* Body / Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
                    {children}
                </div>

                {/* Optional Sticky Footer */}
                {footer && (
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm pb-safe">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
