import React from "react";
import { Link } from "@inertiajs/react";
import { IconArrowUpRight } from "@tabler/icons-react";

export default function CuratedCollections({ collections = [] }) {
    if (!collections || collections.length === 0) {
        return null;
    }

    return (
        <section id="categories" className="bg-white dark:bg-stone-950 py-16 sm:py-24 border-b border-karima-brand/10 dark:border-stone-800">
            {/* Section Header */}
            <div className="container mx-auto max-w-7xl px-4 lg:px-6 flex flex-col items-center mb-12 sm:mb-16 text-center">
                <span className="text-xxs sm:text-[10px] text-karima-accent dark:text-karima-gold uppercase tracking-[0.45em] mb-3 block font-semibold">
                    EXPLORE
                </span>
                <h2 className="text-4xl sm:text-6xl lg:text-7xl font-serif text-karima-brand dark:text-stone-100 font-thin tracking-tight">
                    Curated Collections
                </h2>
                <div className="w-16 h-px bg-karima-brand/20 dark:bg-stone-700 mt-5" />
            </div>

            {/* Collections Grid / Carousel */}
            <div className="flex overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-4 w-full scroll-smooth no-scrollbar gap-4 px-4 md:gap-0 md:px-0">
                {collections.map((item) => (
                    <Link
                        key={item.id}
                        href={`/katalog?category_id=${item.id}`}
                        className="group relative h-[480px] sm:h-[540px] lg:h-[600px] w-[80vw] sm:w-[48vw] md:w-auto snap-start shrink-0 overflow-hidden bg-stone-100 dark:bg-stone-900 md:border-r md:border-white/10 block cursor-pointer"
                    >
                        {/* Background Category Image */}
                        <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover object-top transition-transform duration-[2s] ease-out grayscale-[15%] group-hover:grayscale-0 group-hover:scale-105"
                            loading="lazy"
                        />

                        {/* Elegant Dark Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent opacity-70 group-hover:opacity-85 transition-opacity duration-700" />

                        {/* Content Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 sm:pb-14 px-6 text-center z-10">
                            {/* Piece Count */}
                            {typeof item.products_count === "number" && (
                                <span className="text-[9px] uppercase tracking-[0.3em] text-white/70 mb-2 opacity-80">
                                    {item.products_count} {item.products_count === 1 ? "Item" : "Items"}
                                </span>
                            )}

                            {/* Category Name */}
                            <h3 className="text-3xl sm:text-4xl font-serif text-white tracking-wide group-hover:-translate-y-3 transition-transform duration-700 drop-shadow-md">
                                {item.name}
                            </h3>

                            {/* Hover Reveal Action */}
                            <div className="h-0 overflow-hidden group-hover:h-8 transition-all duration-700 flex items-center gap-1.5 mt-1">
                                <span className="text-[9px] text-white uppercase tracking-[0.3em] border-b border-white/60 pb-1">
                                    Shop Category
                                </span>
                                <IconArrowUpRight size={13} className="text-white pb-0.5" />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}

