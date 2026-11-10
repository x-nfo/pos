import React from "react";
import { Link } from "@inertiajs/react";
import { IconArrowRight } from "@tabler/icons-react";

export default function HomePromoBanner({ banner }) {
    if (!banner) return null;

    const {
        title = "Edisi Terbatas & Penawaran Istimewa",
        subtitle = "Dapatkan potongan harga eksklusif untuk pesanan pertama Anda melalui WhatsApp atau katalog web.",
        imageUrl = "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1600&auto=format&fit=crop",
        linkUrl = "/katalog",
    } = banner;

    return (
        <section id="promo" className="py-12 sm:py-20 px-4 sm:px-6 bg-stone-50 dark:bg-stone-900/50">
            <div className="container mx-auto max-w-7xl">
                <div className="relative rounded-none overflow-hidden bg-stone-900 min-h-[380px] sm:min-h-[460px] flex items-center shadow-xl">
                    {/* Background Visual */}
                    {imageUrl && (
                        <div className="absolute inset-0">
                            <img
                                src={imageUrl}
                                alt={title}
                                className="w-full h-full object-cover object-center filter brightness-[0.7] contrast-[1.05] transition-transform duration-[4s] hover:scale-105"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
                        </div>
                    )}

                    {/* Content Box */}
                    <div className="relative z-10 max-w-2xl px-6 sm:px-12 md:px-16 py-12 text-white">
                        <span className="text-[10px] text-karima-gold uppercase tracking-[0.4em] font-semibold mb-3 block">
                            PROMOSI KHUSUS
                        </span>
                        <h3 className="text-3xl sm:text-5xl font-serif font-normal tracking-tight text-white mb-4 leading-tight">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="text-xs sm:text-sm text-stone-200 font-light max-w-lg mb-8 leading-relaxed">
                                {subtitle}
                            </p>
                        )}
                        <Link
                            href={linkUrl || "/katalog"}
                            className="group inline-flex items-center gap-3 px-8 py-3.5 border border-white/80 bg-white/10 hover:bg-white text-white hover:text-karima-brand backdrop-blur-md transition-all duration-300 text-xxs font-bold uppercase tracking-[0.25em]"
                        >
                            <span>Belanja Sekarang</span>
                            <IconArrowRight
                                size={15}
                                className="transition-transform duration-300 group-hover:translate-x-1"
                            />
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

