import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    IconZoomIn,
    IconZoomOut,
    IconRotate,
    IconX,
    IconChevronLeft,
    IconChevronRight,
    IconPhotoOff,
    IconArrowsMaximize,
    IconMaximize,
    IconMinimize,
} from "@tabler/icons-react";

/**
 * Senior Developer Quality Interactive Image Zoom & Lightbox Component
 * 
 * Features:
 * 1. Desktop Inline Lens/Pan Zoom: Smooth 60fps GPU-accelerated mouse tracking (scale 2.0x).
 * 2. Cinematic Fullscreen Lightbox: Multi-level zoom (1x-3.5x), drag-to-pan, mousewheel zoom.
 * 3. Mobile Touch Gestures: Pinch-to-zoom, double-tap toggle, swipe navigation when unzoomed.
 * 4. WCAG AA Accessible: Keyboard shortcuts (Esc, Arrows, +/-, R/0), body scroll-lock.
 * 5. Fast & Lightweight: Zero external heavy dependencies, native PointerEvents.
 */
export default function ProductImageGallery({
    images = [],
    activeImage = null,
    onSelectImage = () => { },
    productTitle = "Produk",
    isSoldOut = false,
    badge = null,
    wishlistButton = null,
    aspectRatio = "aspect-[2/3]",
    enableInlineZoom = true,
    inlineZoomScale = 2.0,
    maxZoom = 3.5,
}) {
    // Current active image index in gallery
    const currentIndex = Math.max(
        0,
        images.findIndex((img) => img === activeImage)
    );

    // Inline Desktop Hover Zoom State
    const [isHovered, setIsHovered] = useState(false);
    const [mouseOrigin, setMouseOrigin] = useState({ x: 50, y: 50 });
    const imageContainerRef = useRef(null);

    // Lightbox Modal State
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(currentIndex);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Gesture & Tracking Refs
    const lightboxStageRef = useRef(null);
    const dragStartRef = useRef({ x: 0, y: 0, startPanX: 0, startPanY: 0, isSwipe: false });
    const initialTouchDistanceRef = useRef(null);
    const initialZoomOnPinchRef = useRef(1);
    const lastTapTimeRef = useRef(0);

    // Sync lightboxIndex when activeImage or currentIndex changes
    useEffect(() => {
        if (currentIndex >= 0 && currentIndex < images.length) {
            setLightboxIndex(currentIndex);
        }
    }, [currentIndex, images.length]);

    // Cleanup scroll lock on unmount
    useEffect(() => {
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    // -------------------------------------------------------------
    // Inline Desktop Pan-Zoom Handlers
    // -------------------------------------------------------------
    const handleMouseMove = (e) => {
        if (!enableInlineZoom || !imageContainerRef.current) return;
        const rect = imageContainerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setMouseOrigin({
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y)),
        });
    };

    // -------------------------------------------------------------
    // Lightbox Navigation & Zoom Actions
    // -------------------------------------------------------------
    const openLightbox = (index = currentIndex) => {
        setLightboxIndex(index);
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
        setIsLightboxOpen(true);
        document.body.style.overflow = "hidden";
    };

    const closeLightbox = useCallback(() => {
        setIsLightboxOpen(false);
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
        document.body.style.overflow = "";
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }
    }, []);

    const handleNext = useCallback(() => {
        if (images.length <= 1) return;
        setLightboxIndex((prev) => {
            const nextIdx = (prev + 1) % images.length;
            if (typeof onSelectImage === "function" && images[nextIdx]) {
                onSelectImage(images[nextIdx], nextIdx);
            }
            return nextIdx;
        });
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    }, [images, onSelectImage]);

    const handlePrev = useCallback(() => {
        if (images.length <= 1) return;
        setLightboxIndex((prev) => {
            const prevIdx = (prev - 1 + images.length) % images.length;
            if (typeof onSelectImage === "function" && images[prevIdx]) {
                onSelectImage(images[prevIdx], prevIdx);
            }
            return prevIdx;
        });
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    }, [images, onSelectImage]);

    const handleZoomIn = () => {
        setZoomLevel((prev) => Math.min(Number((prev + 0.5).toFixed(2)), maxZoom));
    };

    const handleZoomOut = () => {
        setZoomLevel((prev) => {
            const next = Math.max(Number((prev - 0.5).toFixed(2)), 1);
            if (next === 1) setPanOffset({ x: 0, y: 0 });
            return next;
        });
    };

    const handleResetZoom = () => {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
        }
    };

    // -------------------------------------------------------------
    // Double-tap / Double-click to toggle Zoom
    // -------------------------------------------------------------
    const handleDoubleTap = (e) => {
        if (zoomLevel > 1) {
            handleResetZoom();
        } else {
            const nextZoom = 2.4;
            setZoomLevel(nextZoom);
            // Center zoom focus around click position if feasible
            if (lightboxStageRef.current) {
                const rect = lightboxStageRef.current.getBoundingClientRect();
                const clientX = e.clientX || rect.left + rect.width / 2;
                const clientY = e.clientY || rect.top + rect.height / 2;
                const offsetX = (rect.width / 2 - (clientX - rect.left)) * (nextZoom - 1);
                const offsetY = (rect.height / 2 - (clientY - rect.top)) * (nextZoom - 1);
                setPanOffset({
                    x: Math.max(-400, Math.min(400, offsetX)),
                    y: Math.max(-400, Math.min(400, offsetY)),
                });
            }
        }
    };

    // -------------------------------------------------------------
    // Mouse Wheel Zoom Support inside Lightbox
    // -------------------------------------------------------------
    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        setZoomLevel((prev) => {
            const next = Math.max(1, Math.min(maxZoom, Number((prev + delta).toFixed(2))));
            if (next === 1) setPanOffset({ x: 0, y: 0 });
            return next;
        });
    };

    // -------------------------------------------------------------
    // Pointer Drag & Pan / Swipe Handlers (Unified Mouse + Touch)
    // -------------------------------------------------------------
    const handlePointerDown = (e) => {
        // Prevent default browser dragging
        if (e.button !== 0 && e.pointerType === "mouse") return;
        // Do not intercept interactive buttons/links
        if (e.target.closest("button") || e.target.closest("a") || e.target.closest("[role='button']")) {
            return;
        }
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            startPanX: panOffset.x,
            startPanY: panOffset.y,
            isSwipe: zoomLevel === 1,
        };
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) { }
    };

    const handlePointerMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;

        if (zoomLevel > 1) {
            // Drag-to-pan with soft boundaries
            const maxOffset = 380 * (zoomLevel - 1);
            setPanOffset({
                x: Math.max(-maxOffset, Math.min(maxOffset, dragStartRef.current.startPanX + deltaX)),
                y: Math.max(-maxOffset, Math.min(maxOffset, dragStartRef.current.startPanY + deltaY)),
            });
        }
    };

    const handlePointerUp = (e) => {
        if (!isDragging) return;
        setIsDragging(false);
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (_) { }

        // If at zoom 1x, check horizontal swipe distance for slide navigation
        if (zoomLevel === 1 && images.length > 1) {
            const deltaX = e.clientX - dragStartRef.current.x;
            const deltaY = Math.abs(e.clientY - dragStartRef.current.y);
            // Must be predominantly horizontal swipe > 45px
            if (Math.abs(deltaX) > 45 && deltaY < 80) {
                if (deltaX < 0) {
                    handleNext();
                } else {
                    handlePrev();
                }
            }
        }
    };

    // Multi-touch Pinch to Zoom
    const handleTouchStart = (e) => {
        if (e.target.closest("button") || e.target.closest("a") || e.target.closest("[role='button']")) {
            return;
        }
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialTouchDistanceRef.current = dist;
            initialZoomOnPinchRef.current = zoomLevel;
        } else if (e.touches.length === 1) {
            // Check double-tap on mobile touch
            const now = Date.now();
            if (now - lastTapTimeRef.current < 300) {
                handleDoubleTap(e.touches[0]);
                lastTapTimeRef.current = 0;
            } else {
                lastTapTimeRef.current = now;
            }
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && initialTouchDistanceRef.current) {
            e.preventDefault();
            const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const scaleFactor = currentDist / initialTouchDistanceRef.current;
            const nextZoom = Math.max(1, Math.min(maxZoom, Number((initialZoomOnPinchRef.current * scaleFactor).toFixed(2))));
            setZoomLevel(nextZoom);
            if (nextZoom === 1) setPanOffset({ x: 0, y: 0 });
        }
    };

    const handleTouchEnd = () => {
        initialTouchDistanceRef.current = null;
    };

    // -------------------------------------------------------------
    // Keyboard Shortcuts (WCAG 2.1 AA Compliance)
    // -------------------------------------------------------------
    useEffect(() => {
        if (!isLightboxOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                closeLightbox();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                handleNext();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                handlePrev();
            } else if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                handleZoomIn();
            } else if (e.key === "-") {
                e.preventDefault();
                handleZoomOut();
            } else if (e.key === "0" || e.key === "r" || e.key === "R") {
                e.preventDefault();
                handleResetZoom();
            } else if (e.key === "f" || e.key === "F") {
                e.preventDefault();
                toggleFullscreen();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isLightboxOpen, handleNext, handlePrev, closeLightbox]);

    // Active image to display
    const currentMainImage = images[currentIndex] || activeImage;
    const currentLightboxImage = images[lightboxIndex] || currentMainImage;

    return (
        <div className="space-y-4 select-none">
            {/* 1. Main Portrait / Landscape Image Display with Inline Hover Zoom */}
            <div
                ref={imageContainerRef}
                onMouseEnter={() => enableInlineZoom && setIsHovered(true)}
                onMouseLeave={() => {
                    setIsHovered(false);
                    setMouseOrigin({ x: 50, y: 50 });
                }}
                onMouseMove={handleMouseMove}
                onClick={() => currentMainImage && openLightbox(currentIndex)}
                className={`relative ${aspectRatio} w-full bg-stone-100 dark:bg-slate-800 rounded-none sm:rounded-sm overflow-hidden border border-karima-brand/10 dark:border-stone-800 flex items-center justify-center group shadow-xs cursor-zoom-in`}
                title="Klik untuk membuka tampilan resolusi penuh"
                aria-label={`Foto utama produk: ${productTitle}. Klik untuk memperbesar.`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (currentMainImage) openLightbox(currentIndex);
                    }
                }}
            >
                {/* Badges Slot (e.g. SOLD OUT or Discount) */}
                {badge}

                {/* Wishlist Button Slot */}
                {wishlistButton}

                {/* Subtle Floating Zoom Pill Indicator */}
                <div className="absolute bottom-4 right-4 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 bg-black/65 backdrop-blur-md text-white text-[11px] font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-white/10">
                    <IconArrowsMaximize size={14} />
                    <span>Perbesar</span>
                </div>

                {/* Main Product Image with Interactive 60fps Pan-Zoom */}
                {currentMainImage ? (
                    <img
                        src={currentMainImage}
                        alt={productTitle}
                        draggable={false}
                        style={{
                            transformOrigin: `${mouseOrigin.x}% ${mouseOrigin.y}%`,
                            transform: isHovered ? `scale(${inlineZoomScale})` : "scale(1.0)",
                        }}
                        className={`w-full h-full object-cover object-top will-change-transform transition-transform duration-200 ease-out pointer-events-none ${isSoldOut ? "grayscale opacity-50 contrast-75" : ""
                            }`}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-stone-400">
                        <IconPhotoOff size={48} strokeWidth={1.5} />
                        <span className="text-xxs uppercase tracking-wider mt-2">Foto Tidak Tersedia</span>
                    </div>
                )}
            </div>

            {/* 2. Interactive Thumbnails Strip */}
            {images.length > 1 && (
                <div
                    className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide pt-1"
                    role="tablist"
                    aria-label="Pilihan foto galeri"
                >
                    {images.map((img, idx) => {
                        const isSelected = idx === currentIndex;
                        return (
                            <button
                                key={`${img}-${idx}`}
                                type="button"
                                role="tab"
                                aria-selected={isSelected}
                                aria-label={`Pilih foto ${idx + 1} dari ${images.length}`}
                                onClick={() => onSelectImage(img, idx)}
                                className={`w-20 ${aspectRatio} rounded-xs overflow-hidden border-2 shrink-0 transition-all cursor-pointer bg-stone-100 relative group/thumb ${isSelected
                                    ? "border-karima-brand shadow-sm scale-102 ring-1 ring-karima-brand/30 opacity-100"
                                    : "border-transparent opacity-60 hover:opacity-100 hover:border-stone-300"
                                    }`}
                            >
                                <img
                                    src={img}
                                    alt={`Thumbnail ${idx + 1}`}
                                    draggable={false}
                                    className="w-full h-full object-cover object-top group-hover/thumb:scale-105 transition-transform duration-300"
                                />
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 3. Cinematic Fullscreen Lightbox Modal */}
            {isLightboxOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Galeri foto resolusi penuh: ${productTitle}`}
                    className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 backdrop-blur-xl animate-fade-in select-none text-white"
                >
                    {/* Lightbox Header Bar */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-4 z-30 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs uppercase tracking-widest text-stone-400 font-mono shrink-0">
                                {lightboxIndex + 1} / {images.length}
                            </span>
                            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-stone-600" />
                            <span className="hidden sm:inline-block text-xs text-stone-300 font-medium truncate max-w-xs sm:max-w-md">
                                {productTitle}
                            </span>
                        </div>

                        {/* Top Action Controls Pill */}
                        <div className="flex items-center gap-1.5 sm:gap-2.5 bg-stone-900/80 border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 backdrop-blur-md shadow-2xl">
                            {/* Zoom Out Button */}
                            <button
                                type="button"
                                onClick={handleZoomOut}
                                disabled={zoomLevel <= 1}
                                className="p-1 sm:p-1.5 text-stone-300 hover:text-white disabled:opacity-30 disabled:hover:text-stone-300 transition-colors cursor-pointer rounded-full"
                                title="Zoom Out (-)"
                                aria-label="Perkecil"
                            >
                                <IconZoomOut size={18} />
                            </button>

                            {/* Zoom Level Indicator */}
                            <span className="text-[11px] font-mono font-medium text-stone-300 min-w-[38px] text-center">
                                {Math.round(zoomLevel * 100)}%
                            </span>

                            {/* Zoom In Button */}
                            <button
                                type="button"
                                onClick={handleZoomIn}
                                disabled={zoomLevel >= maxZoom}
                                className="p-1 sm:p-1.5 text-stone-300 hover:text-white disabled:opacity-30 disabled:hover:text-stone-300 transition-colors cursor-pointer rounded-full"
                                title="Zoom In (+)"
                                aria-label="Perbesar"
                            >
                                <IconZoomIn size={18} />
                            </button>

                            <div className="w-px h-3.5 bg-white/20" />

                            {/* Reset Zoom Button */}
                            <button
                                type="button"
                                onClick={handleResetZoom}
                                disabled={zoomLevel === 1 && panOffset.x === 0 && panOffset.y === 0}
                                className="p-1 sm:p-1.5 text-stone-300 hover:text-white disabled:opacity-30 transition-colors cursor-pointer rounded-full"
                                title="Reset Zoom (0 atau R)"
                                aria-label="Reset zoom"
                            >
                                <IconRotate size={18} />
                            </button>

                            {/* Fullscreen Button */}
                            <button
                                type="button"
                                onClick={toggleFullscreen}
                                className="hidden sm:inline-flex p-1.5 text-stone-300 hover:text-white transition-colors cursor-pointer rounded-full"
                                title="Fullscreen (F)"
                                aria-label="Layar penuh"
                            >
                                {isFullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
                            </button>

                            <div className="w-px h-3.5 bg-white/20" />

                            {/* Close Button */}
                            <button
                                type="button"
                                onClick={closeLightbox}
                                className="p-1 sm:p-1.5 text-stone-300 hover:text-rose-400 transition-colors cursor-pointer rounded-full"
                                title="Tutup (ESC)"
                                aria-label="Tutup"
                            >
                                <IconX size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Lightbox Middle Container with Absolute Controls */}
                    <div className="relative flex-1 flex items-center justify-center overflow-hidden w-full">
                        {/* Previous Slide Button */}
                        {images.length > 1 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handlePrev();
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                className="absolute left-3 sm:left-6 z-40 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 active:bg-black text-white backdrop-blur-md transition-all cursor-pointer hover:scale-110 active:scale-95 border border-white/20 shadow-2xl focus:outline-hidden focus:ring-2 focus:ring-karima-brand group/btn"
                                aria-label="Foto Sebelumnya"
                                title="Foto Sebelumnya (Panah Kiri)"
                            >
                                <IconChevronLeft size={28} className="group-hover/btn:-translate-x-0.5 transition-transform" />
                            </button>
                        )}

                        {/* Lightbox Main Stage (Viewport Canvas) */}
                        <div
                            ref={lightboxStageRef}
                            onWheel={handleWheel}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onDoubleClick={handleDoubleTap}
                            className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
                            style={{
                                cursor: zoomLevel > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
                            }}
                        >
                            {/* Centered Image with Hardware-Accelerated 3D Transform */}
                            <div
                                style={{
                                    transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel})`,
                                }}
                                className="transition-transform duration-100 ease-out flex items-center justify-center max-h-[80vh] max-w-[90vw]"
                            >
                                <img
                                    src={currentLightboxImage}
                                    alt={`${productTitle} - Foto ${lightboxIndex + 1}`}
                                    draggable={false}
                                    className="max-h-[80vh] max-w-[90vw] object-contain rounded-xs shadow-2xl select-none will-change-transform"
                                />
                            </div>
                        </div>

                        {/* Next Slide Button */}
                        {images.length > 1 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleNext();
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                className="absolute right-3 sm:right-6 z-40 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 active:bg-black text-white backdrop-blur-md transition-all cursor-pointer hover:scale-110 active:scale-95 border border-white/20 shadow-2xl focus:outline-hidden focus:ring-2 focus:ring-karima-brand group/btn"
                                aria-label="Foto Selanjutnya"
                                title="Foto Selanjutnya (Panah Kanan)"
                            >
                                <IconChevronRight size={28} className="group-hover/btn:translate-x-0.5 transition-transform" />
                            </button>
                        )}
                    </div>

                    {/* Lightbox Bottom Thumbnails Carousel Bar */}
                    {images.length > 1 && (
                        <div
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="z-40 px-4 py-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-center gap-2.5 sm:gap-3 overflow-x-auto scrollbar-hide"
                        >
                            {images.map((img, idx) => {
                                const isCurrent = idx === lightboxIndex;
                                return (
                                    <button
                                        key={`lightbox-thumb-${idx}`}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLightboxIndex(idx);
                                            handleResetZoom();
                                            if (typeof onSelectImage === "function" && images[idx]) {
                                                onSelectImage(images[idx], idx);
                                            }
                                        }}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        className={`w-12 h-16 sm:w-14 sm:h-20 rounded-xs overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${isCurrent
                                            ? "border-karima-brand scale-110 shadow-lg ring-2 ring-karima-brand/50 opacity-100"
                                            : "border-transparent opacity-40 hover:opacity-90"
                                            }`}
                                        aria-label={`Lihat foto ${idx + 1}`}
                                    >
                                        <img
                                            src={img}
                                            alt={`Pratinjau ${idx + 1}`}
                                            draggable={false}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

