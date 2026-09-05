import React from "react";
import { IconSparkles, IconArrowRight } from "@tabler/icons-react";

export default function StaticPromoBanner({ banner = null, onSelectCategory = null }) {
    if (!banner || (!banner.title && !banner.image_url)) {
        return null;
    }

    const handleClick = () => {
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
        }

        const productSection =
            document.getElementById("katalog-products") || document.querySelector("main");
        if (productSection) {
            productSection.scrollIntoView({ behavior: "smooth" });
        }
    };

    const hasImage = Boolean(banner.image_url);

    return (
        <aside
            aria-label="Banner Promosi Pilihan"
            onClick={handleClick}
            className="mb-5 sm:mb-7 select-none cursor-pointer group/static block"
        >
            {hasImage ? (
                /* Static Image Banner (Alfagift Style) */
                <div className="w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-xs group-hover/static:shadow-md transition-all duration-300 relative bg-slate-900">
                    <img
                        src={banner.image_url}
                        alt={banner.title || "Banner Promo Statis"}
                        className="w-full h-auto object-cover max-h-[160px] sm:max-h-[220px] group-hover/static:scale-[1.01] transition-transform duration-500"
                        loading="lazy"
                    />
                    {(banner.title || banner.subtitle) && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 sm:p-5 text-white flex flex-col justify-end">
                            {banner.title && (
                                <h3 className="text-xs sm:text-base font-black drop-shadow-md line-clamp-1">
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
                /* Static Gradient Announcement Card (Alfagift / Modern E-Commerce Style) */
                <div
                    className={`w-full rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-r ${
                        banner.gradient || "from-indigo-600 via-primary-600 to-sky-600"
                    } text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-xs group-hover/static:shadow-md transition-all duration-300 relative overflow-hidden`}
                >
                    {/* Decorative blurred background shapes */}
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-10 right-20 w-36 h-36 bg-white/15 rounded-full blur-xl pointer-events-none" />

                    <div className="relative z-10 min-w-0 pr-2">
                        {banner.badge && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white font-extrabold text-[9px] sm:text-xs border border-white/25 shadow-2xs mb-1.5 tracking-wider uppercase">
                                <IconSparkles size={11} className="text-amber-300" />
                                {banner.badge}
                            </span>
                        )}
                        {banner.title && (
                            <h3 className="text-sm sm:text-lg font-black text-white leading-tight drop-shadow-xs line-clamp-1">
                                {banner.title}
                            </h3>
                        )}
                        {banner.subtitle && (
                            <p className="text-[11px] sm:text-xs text-white/90 mt-0.5 line-clamp-2 max-w-2xl leading-relaxed">
                                {banner.subtitle}
                            </p>
                        )}
                    </div>

                    <div className="relative z-10 shrink-0 self-start sm:self-center pt-1 sm:pt-0">
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white text-slate-900 font-extrabold text-xs group-hover/static:bg-slate-100 shadow-sm active:scale-95 transition-all">
                            <span>{banner.action_text || "Belanja Sekarang"}</span>
                            <IconArrowRight size={14} className="group-hover/static:translate-x-0.5 transition-transform" />
                        </span>
                    </div>
                </div>
            )}
        </aside>
    );
}
