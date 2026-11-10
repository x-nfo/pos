import React from "react";
import { Link } from "@inertiajs/react";
import { IconArrowRight } from "@tabler/icons-react";

export default function EditorialHero({
    subtitle = "KOLEKSI BUSANA MUSLIMAH & ELEGAN",
    headline = "Kemewahan Dalam Kesederhanaan",
    imageUrl = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1920&auto=format&fit=crop",
    mobileImageUrl = null,
    ctaText = "Jelajahi Koleksi",
    ctaLink = "/katalog",
}) {
    const desktopSrc = imageUrl;
    const mobileSrc = mobileImageUrl || imageUrl;

    return (
        <section className="relative w-full h-[88vh] min-h-[580px] max-h-[920px] overflow-hidden bg-stone-900">
            {/* Background Image Layer with Zoom Effect */}
            <picture className="absolute inset-0 w-full h-full">
                <source media="(max-width: 767px)" srcSet={mobileSrc} />
                <source media="(min-width: 768px)" srcSet={desktopSrc} />
                <img
                    src={desktopSrc}
                    alt={headline}
                    className="w-full h-full object-cover object-top filter brightness-[0.82] contrast-[1.05] scale-100 transition-transform duration-[12s] ease-out hover:scale-105"
                    loading="eager"
                />
            </picture>

            {/* Gradient Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/30 pointer-events-none" />

            {/* Editorial Center/Bottom Content */}
            <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-16 sm:pb-24 items-center text-center">
                {/* Subtitle */}
                {subtitle && (
                    <span className="text-xxs sm:text-xs text-white/90 uppercase tracking-[0.45em] mb-4 sm:mb-6 font-medium drop-shadow-sm animate-fade-in">
                        {subtitle}
                    </span>
                )}

                {/* Primary Serif Headline */}
                <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-serif text-white font-thin tracking-tight max-w-4xl leading-[1.08] drop-shadow-md mb-8 sm:mb-10">
                    {headline}
                </h1>

                {/* Luxury CTA Button */}
                <div className="flex items-center justify-center gap-4">
                    <Link
                        href={ctaLink}
                        className="group inline-flex items-center gap-3 px-8 sm:px-10 py-3.5 sm:py-4 border border-white/80 bg-white/10 hover:bg-white text-white hover:text-karima-brand backdrop-blur-md transition-all duration-500 rounded-none text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] shadow-lg cursor-pointer"
                    >
                        <span>{ctaText}</span>
                        <IconArrowRight
                            size={16}
                            className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                    </Link>
                </div>
            </div>

            {/* Bottom Subtle Indicator Bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-50 z-10">
                <span className="w-8 h-[2px] bg-white/80" />
                <span className="w-2 h-[2px] bg-white/40" />
                <span className="w-2 h-[2px] bg-white/40" />
            </div>
        </section>
    );
}

