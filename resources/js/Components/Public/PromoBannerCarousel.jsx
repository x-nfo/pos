import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    IconChevronLeft,
    IconChevronRight,
    IconSparkles,
    IconArrowRight,
    IconX,
    IconTicket,
    IconExternalLink,
} from "@tabler/icons-react";

export default function PromoBannerCarousel({
    banners = [],
    onSelectCategory = null,
}) {
    const [currentIndex, setCurrentIndex] = useState(1);
    const [isAnimating, setIsAnimating] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [isAllPromosOpen, setIsAllPromosOpen] = useState(false);

    // Touch swipe refs
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    const bannerCount = banners.length;

    // Cloned array for seamless infinite looping: [last, ...banners, first]
    const slides = useMemo(() => {
        if (bannerCount <= 1) return banners;
        return [banners[bannerCount - 1], ...banners, banners[0]];
    }, [banners, bannerCount]);

    // Active dot index (0-based)
    const activeDotIndex = bannerCount > 0
        ? (currentIndex - 1 + bannerCount) % bannerCount
        : 0;

    // Seamless loop reset when transition ends on a cloned slide
    const handleTransitionEnd = () => {
        if (bannerCount <= 1) return;

        if (currentIndex === 0) {
            setIsAnimating(false);
            setCurrentIndex(bannerCount);
        } else if (currentIndex === bannerCount + 1) {
            setIsAnimating(false);
            setCurrentIndex(1);
        }
    };

    // Re-enable smooth transition after instant position jump
    useEffect(() => {
        if (!isAnimating) {
            const frame = requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });
            return () => cancelAnimationFrame(frame);
        }
    }, [isAnimating]);

    // Auto-advance slide every 5 seconds
    useEffect(() => {
        if (bannerCount <= 1 || isPaused || isAllPromosOpen) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => prev + 1);
        }, 5000);

        return () => clearInterval(timer);
    }, [bannerCount, isPaused, isAllPromosOpen]);

    if (!banners || bannerCount === 0) {
        return null;
    }

    const handleBannerClick = (banner) => {
        if (banner.link_url) {
            if (banner.link_url.startsWith("http")) {
                window.open(banner.link_url, "_blank", "noopener,noreferrer");
            } else {
                window.location.href = banner.link_url;
            }
            return;
        }

        if (banner.category_id && onSelectCategory) {
            onSelectCategory(banner.category_id);
            const productSection = document.getElementById("katalog-products") || document.querySelector("main");
            if (productSection) {
                productSection.scrollIntoView({ behavior: "smooth" });
            }
            return;
        }

        // Smooth scroll to product grid
        const mainSection = document.getElementById("katalog-products") || document.querySelector("main");
        if (mainSection) {
            mainSection.scrollIntoView({ behavior: "smooth" });
        }
    };

    const nextSlide = (e) => {
        e?.stopPropagation();
        if (!isAnimating) setIsAnimating(true);
        setCurrentIndex((prev) => prev + 1);
    };

    const prevSlide = (e) => {
        e?.stopPropagation();
        if (!isAnimating) setIsAnimating(true);
        setCurrentIndex((prev) => prev - 1);
    };

    const goToSlide = (slideIndex) => {
        if (!isAnimating) setIsAnimating(true);
        setCurrentIndex(slideIndex + 1);
    };

    const handleTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;
        const diff = touchStartX.current - touchEndX.current;

        // Minimum swipe distance of 40px
        if (diff > 40) {
            nextSlide();
        } else if (diff < -40) {
            prevSlide();
        }

        touchStartX.current = 0;
        touchEndX.current = 0;
    };

    // Single banner layout (No peek, full width)
    if (bannerCount === 1) {
        const singleBanner = banners[0];
        const hasImage = Boolean(singleBanner.image_url);

        return (
            <section aria-label="Promo Banner" className="mt-2 mb-6 sm:mt-3 sm:mb-8 select-none">
                <div
                    onClick={() => handleBannerClick(singleBanner)}
                    className="w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-800 bg-slate-900 cursor-pointer relative"
                >
                    {hasImage ? (
                        <div className="relative w-full aspect-[16/7] sm:aspect-[16/6] md:aspect-[21/7] max-h-[500px] bg-slate-900">
                            <img
                                src={singleBanner.image_url}
                                alt={singleBanner.title || "Banner Promo"}
                                className="w-full h-full object-cover"
                            />
                            {(singleBanner.title || singleBanner.subtitle) && (
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 sm:p-6 text-white flex flex-col justify-end">
                                    {singleBanner.title && (
                                        <h3 className="text-sm sm:text-lg md:text-xl font-black drop-shadow-md line-clamp-1">
                                            {singleBanner.title}
                                        </h3>
                                    )}
                                    {singleBanner.subtitle && (
                                        <p className="text-[11px] sm:text-xs text-white/90 drop-shadow-sm line-clamp-1 mt-0.5">
                                            {singleBanner.subtitle}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div
                            className={`w-full aspect-[16/7] sm:aspect-[16/6] md:aspect-[21/7] max-h-[360px] bg-gradient-to-r ${singleBanner.gradient || "from-rose-500 via-pink-600 to-indigo-700"
                                } text-white p-5 sm:p-8 flex flex-col justify-between`}
                        >
                            <div className="relative z-10 pr-8">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold text-[10px] sm:text-xs mb-2">
                                    <IconSparkles size={12} className="text-amber-300" />
                                    {singleBanner.badge || "PROMO SPESIAL"}
                                </span>
                                <h2 className="text-base sm:text-2xl font-black leading-tight line-clamp-2">
                                    {singleBanner.title || "Penawaran Promo Spesial"}
                                </h2>
                                <p className="text-xs sm:text-sm text-white/90 line-clamp-2 mt-1">
                                    {singleBanner.subtitle || "Dapatkan harga promo terbaik untuk produk pilihan kami!"}
                                </p>
                            </div>
                            <div className="relative z-10 pt-2">
                                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-slate-900 font-extrabold text-xs">
                                    <span>{singleBanner.action_text || "Belanja Sekarang"}</span>
                                    <IconArrowRight size={14} />
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        );
    }

    return (
        <section
            aria-label="Promo Banner Slider"
            className="relative mt-2 mb-6 sm:mt-3 sm:mb-8 select-none group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Peeking responsive CSS styles */}
            <style>{`
                .alfagift-slider-track {
                    --slide-width: 85%;
                    --peek-offset: 7.5%;
                    --slide-gap: 10px;
                }
                @media (min-width: 640px) {
                    .alfagift-slider-track {
                        --slide-width: 88%;
                        --peek-offset: 6%;
                        --slide-gap: 14px;
                    }
                }
                @media (min-width: 1024px) {
                    .alfagift-slider-track {
                        --slide-width: 90%;
                        --peek-offset: 5%;
                        --slide-gap: 18px;
                    }
                }
            `}</style>

            {/* Peeking Carousel Viewport (Edge-to-edge on mobile with -mx-3.5) */}
            <div
                className="-mx-3.5 sm:mx-0 overflow-hidden relative py-1"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Slides Track */}
                <div
                    className="alfagift-slider-track flex w-full"
                    style={{
                        transform: `translateX(calc(var(--peek-offset) - ${currentIndex} * (var(--slide-width) + var(--slide-gap))))`,
                        transition: isAnimating ? "transform 500ms cubic-bezier(0.25, 1, 0.5, 1)" : "none",
                        gap: "var(--slide-gap)",
                    }}
                    onTransitionEnd={handleTransitionEnd}
                >
                    {slides.map((banner, index) => {
                        const hasImage = Boolean(banner.image_url);

                        return (
                            <div
                                key={`${banner.id || index}-${index}`}
                                onClick={() => handleBannerClick(banner)}
                                style={{ width: "var(--slide-width)", flexShrink: 0 }}
                                className="cursor-pointer relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs sm:shadow-sm border border-slate-200/80 dark:border-slate-800 bg-slate-900 group/card transition-all"
                            >
                                {hasImage ? (
                                    /* Image Banner Slide (Alfagift style) */
                                    <div className="relative w-full aspect-[16/7.5] sm:aspect-[16/6] md:aspect-[21/7] max-h-[360px] bg-slate-900 overflow-hidden">
                                        <img
                                            src={banner.image_url}
                                            alt={banner.title || "Banner Promo"}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-[1.015]"
                                            loading="lazy"
                                        />

                                        {/* Overlay text if provided */}
                                        {(banner.title || banner.subtitle) && (
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 sm:p-5 text-white flex flex-col justify-end">
                                                {banner.title && (
                                                    <h3 className="text-xs sm:text-base md:text-lg font-black drop-shadow-md line-clamp-1">
                                                        {banner.title}
                                                    </h3>
                                                )}
                                                {banner.subtitle && (
                                                    <p className="text-[10px] sm:text-xs text-white/90 drop-shadow-sm line-clamp-1 mt-0.5">
                                                        {banner.subtitle}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Gradient / Dynamic Pricing Rule Fallback Slide */
                                    <div
                                        className={`w-full aspect-[16/7.5] sm:aspect-[16/6] md:aspect-[21/7] max-h-[360px] bg-gradient-to-r ${banner.gradient || "from-rose-500 via-pink-600 to-indigo-700"
                                            } text-white p-4 sm:p-7 flex flex-col justify-between overflow-hidden relative`}
                                    >
                                        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                                        <div className="absolute -bottom-10 right-20 w-36 h-36 bg-white/15 rounded-full blur-xl pointer-events-none" />

                                        <div className="relative z-10 pr-6">
                                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white font-extrabold text-[9px] sm:text-xs border border-white/25 shadow-xs mb-1.5 sm:mb-2">
                                                <IconSparkles size={11} className="text-amber-300" />
                                                <span className="tracking-wider uppercase">
                                                    {banner.badge || "PROMO SPESIAL"}
                                                </span>
                                            </div>

                                            <h2 className="text-sm sm:text-xl md:text-2xl font-black text-white leading-tight drop-shadow-xs line-clamp-2">
                                                {banner.title || "Penawaran Promo Spesial"}
                                            </h2>

                                            <p className="text-[10px] sm:text-xs md:text-sm text-white/90 line-clamp-2 max-w-xl mt-1 leading-relaxed">
                                                {banner.subtitle || "Dapatkan harga promo terbaik untuk produk pilihan kami!"}
                                            </p>
                                        </div>

                                        <div className="relative z-10 flex items-center justify-between pt-1 sm:pt-2">
                                            <span className="inline-flex items-center gap-1 px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-white text-slate-900 font-extrabold text-[11px] sm:text-xs hover:bg-slate-100 shadow-md active:scale-95 transition-all">
                                                <span>{banner.action_text || "Belanja Sekarang"}</span>
                                                <IconArrowRight size={13} />
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Floating Navigation Arrows (Desktop / Tablet) */}
                <button
                    type="button"
                    onClick={prevSlide}
                    aria-label="Banner sebelumnya"
                    className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-md items-center justify-center transition-all z-20 hover:scale-105 active:scale-95 border border-slate-200/60 opacity-0 group-hover:opacity-100 duration-200"
                >
                    <IconChevronLeft size={18} />
                </button>
                <button
                    type="button"
                    onClick={nextSlide}
                    aria-label="Banner berikutnya"
                    className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-md items-center justify-center transition-all z-20 hover:scale-105 active:scale-95 border border-slate-200/60 opacity-0 group-hover:opacity-100 duration-200"
                >
                    <IconChevronRight size={18} />
                </button>
            </div>

            {/* Bottom Row: Circular Dots Indicator (Left) & "Lihat Semua >" (Right) */}
            <div className="flex items-center justify-between mt-3 sm:mt-4 px-1 sm:px-1 select-none">
                {/* Left: Circular Pagination Dots (Alfagift Style) */}
                <div className="flex items-center gap-1.5">
                    {banners.map((_, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => goToSlide(idx)}
                            aria-label={`Ke slide ${idx + 1}`}
                            className={`rounded-full transition-all duration-300 cursor-pointer ${idx === activeDotIndex
                                ? "w-2.5 h-2.5 bg-primary-600 dark:bg-primary-500 ring-2 ring-primary-500/25 scale-110"
                                : "w-2 h-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
                                }`}
                        />
                    ))}
                </div>

                {/* Right: "Lihat Semua >" Action Link */}
                <button
                    type="button"
                    onClick={() => setIsAllPromosOpen(true)}
                    className="inline-flex items-center gap-0.5 text-xs sm:text-sm font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors cursor-pointer group"
                    title="Lihat semua promo toko"
                >
                    <span>Lihat Semua</span>
                    <IconChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>

            {/* Modal: Semua Promo Toko (Triggered by "Lihat Semua") */}
            {isAllPromosOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                                    <IconTicket size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                                        Semua Promo & Penawaran
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Tersedia {banners.length} promo spesial untuk belanja hemat
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAllPromosOpen(false)}
                                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        {/* Modal Promo List */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                            {banners.map((promo, idx) => (
                                <div
                                    key={promo.id || idx}
                                    className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col sm:flex-row gap-3 sm:gap-4 p-3"
                                >
                                    {/* Thumbnail */}
                                    <div className="w-full sm:w-48 aspect-[16/8] sm:aspect-[16/9] rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                                        {promo.image_url ? (
                                            <img
                                                src={promo.image_url}
                                                alt={promo.title || "Promo"}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div
                                                className={`w-full h-full bg-gradient-to-r ${promo.gradient || "from-rose-500 to-indigo-600"
                                                    } flex items-center justify-center text-white font-bold text-xs p-2 text-center`}
                                            >
                                                {promo.badge || "PROMO SPESIAL"}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info & Action */}
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 mb-1">
                                                {promo.badge || "DISKON SPESIAL"}
                                            </span>
                                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                                                {promo.title || "Promo Menarik Toko"}
                                            </h4>
                                            {promo.subtitle && (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                                    {promo.subtitle}
                                                </p>
                                            )}
                                        </div>

                                        <div className="pt-2 sm:pt-0 mt-2 flex items-center justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsAllPromosOpen(false);
                                                    handleBannerClick(promo);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                                            >
                                                <span>Gunakan Promo</span>
                                                {promo.link_url ? (
                                                    <IconExternalLink size={13} />
                                                ) : (
                                                    <IconArrowRight size={13} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsAllPromosOpen(false)}
                                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
