import React from "react";
import { Link } from "@inertiajs/react";
import { IconArrowUpRight } from "@tabler/icons-react";
import CatalogProductCard from "@/Components/Public/Catalog/CatalogProductCard";

export default function TheEssentials({
    products = [],
    cart = [],
    onSelectProduct = () => { },
    isInWishlist = () => false,
    onToggleWishlist = () => { },
}) {
    if (!products || products.length === 0) {
        return null;
    }

    return (
        <section className="py-16 sm:py-24 bg-white dark:bg-stone-950">
            <div className="container mx-auto max-w-7xl px-4 lg:px-6">
                {/* Section Header */}
                <div className="flex flex-col items-center mb-14 sm:mb-20 text-center">
                    <span className="text-xxs sm:text-[10px] text-karima-accent dark:text-karima-gold uppercase tracking-[0.45em] mb-3 block font-semibold">
                        NEW ARRIVALS
                    </span>
                    <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-serif text-karima-brand dark:text-stone-100 leading-none text-center font-thin">
                        The <span className="opacity-70 italic font-serif">Essentials.</span>
                    </h2>
                    <div className="w-16 h-px bg-karima-brand/20 dark:bg-stone-700 mt-6" />
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-10 sm:gap-x-8 sm:gap-y-16 md:gap-x-12 md:gap-y-20">
                    {products.map((product) => {
                        const inCartItems = cart.filter(
                            (i) => i.id === product.id || (i.parent_id && i.parent_id === product.id)
                        );
                        const inCartQty = inCartItems.reduce((acc, i) => acc + i.qty, 0);

                        return (
                            <div key={product.id}>
                                <CatalogProductCard
                                    product={product}
                                    inCartQty={inCartQty}
                                    onSelectProduct={onSelectProduct}
                                    isWishlisted={isInWishlist(product.id)}
                                    onToggleWishlist={onToggleWishlist}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* View Full Collection Button */}
                <div className="mt-16 sm:mt-24 text-center">
                    <Link
                        href="/katalog"
                        className="group inline-flex items-center justify-center gap-3 text-xxs sm:text-xs font-bold uppercase tracking-[0.3em] text-karima-brand dark:text-stone-200 hover:text-karima-accent dark:hover:text-karima-gold transition-colors mx-auto py-3 px-6 border-b border-karima-brand/30 dark:border-stone-700 hover:border-karima-brand dark:hover:border-karima-gold"
                    >
                        <span>Lihat Semua Koleksi</span>
                        <IconArrowUpRight
                            size={16}
                            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                    </Link>
                </div>
            </div>
        </section>
    );
}

