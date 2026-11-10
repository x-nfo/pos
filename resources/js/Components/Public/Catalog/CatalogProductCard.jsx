import React, { useMemo } from "react";
import { Link } from "@inertiajs/react";
import { IconPhotoOff, IconSparkles, IconHeart } from "@tabler/icons-react";
import { formatRupiah } from "@/Utils/whatsappOrder";

const parseVariantAttrs = (variant) => {
    let attrs = variant?.variant_attributes;
    if (typeof attrs === "string") {
        try {
            attrs = JSON.parse(attrs);
        } catch (_) {
            attrs = {};
        }
    }
    return attrs && typeof attrs === "object" ? attrs : {};
};

export default function CatalogProductCard({
    product,
    inCartQty = 0,
    onSelectProduct = () => { },
    isWishlisted = false,
    onToggleWishlist = () => { },
}) {
    const isSoldOut = product.stock <= 0;
    const price = product.final_price || product.sell_price;
    const hasDiscount = Boolean(product.has_discount) && !isSoldOut;

    // Extract color swatches from variants if fashion product
    const colorSwatches = useMemo(() => {
        if (!product.variants || !Array.isArray(product.variants)) return [];
        const map = new Map();
        product.variants.forEach((v) => {
            const attrs = parseVariantAttrs(v);
            const colorName = attrs.color_name || attrs.warna;
            const colorHex = attrs.color_hex || attrs.hex;
            if (colorName && colorHex && !map.has(colorName)) {
                map.set(colorName, colorHex);
            }
        });
        return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
    }, [product.variants]);

    const productUrl = `/katalog/produk/${product.id}`;

    return (
        <div className="group flex flex-col h-full select-none">
            {/* Image Container (Editorial 2:3 Aspect Ratio) */}
            <Link
                href={productUrl}
                className="relative w-full aspect-[2/3] bg-stone-100 dark:bg-slate-800 overflow-hidden mb-3.5 transition-all duration-500 group-hover:shadow-lg group-hover:shadow-karima-brand/5 block"
            >
                {/* Out of Stock Overlay */}
                {isSoldOut && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[1px] z-10 pointer-events-none" />
                )}

                {/* SOLD OUT Badge */}
                {isSoldOut && (
                    <div className="absolute top-2.5 left-2.5 z-20 bg-karima-brand text-white text-[9px] font-bold px-2 py-1 tracking-widest uppercase border border-karima-brand shadow-sm">
                        SOLD OUT
                    </div>
                )}

                {/* PROMO / DISCOUNT Badge */}
                {hasDiscount && (
                    <div className="absolute top-2.5 left-2.5 z-20 bg-rose-600 text-white text-[9px] font-bold px-2 py-1 tracking-widest uppercase shadow-sm flex items-center gap-1">
                        <IconSparkles size={10} />
                        <span>{product.discount_percentage}% OFF</span>
                    </div>
                )}

                {/* Wishlist Heart Button */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleWishlist(product);
                    }}
                    className={`absolute top-2.5 right-2.5 z-30 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-xs ${isWishlisted
                            ? "bg-rose-500 text-white border border-rose-500 scale-105"
                            : "bg-white/85 dark:bg-black/70 text-stone-600 dark:text-stone-300 border border-white/60 dark:border-stone-700 hover:text-rose-500 hover:scale-110 backdrop-blur-md"
                        }`}
                    title={isWishlisted ? "Hapus dari Wishlist" : "Simpan ke Wishlist"}
                    aria-label={isWishlisted ? "Hapus dari Wishlist" : "Simpan ke Wishlist"}
                >
                    <IconHeart size={15} fill={isWishlisted ? "currentColor" : "none"} />
                </button>

                {/* In Cart Indicator Pill */}
                {inCartQty > 0 && (
                    <div className="absolute bottom-2.5 left-2.5 z-20 bg-karima-brand text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs tracking-wider uppercase">
                        {inCartQty} di Keranjang
                    </div>
                )}

                {/* Product Image */}
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.title}
                        className={`w-full h-full object-cover object-top transition-all duration-700 ease-out group-hover:scale-105 ${isSoldOut ? "grayscale opacity-50 contrast-75" : ""
                            }`}
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 dark:text-stone-600">
                        <IconPhotoOff size={28} />
                        <span className="text-[10px] mt-1 uppercase tracking-wider">No Image</span>
                    </div>
                )}

                {/* Desktop Quick View Overlay */}
                <div className="hidden lg:flex absolute inset-0 bg-black/10 transition-opacity duration-300 opacity-0 group-hover:opacity-100 items-end justify-center pb-5 z-20">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectProduct(product);
                        }}
                        className="inline-block border border-white/90 text-white px-6 py-2.5 text-[9px] uppercase tracking-[0.25em] font-medium backdrop-blur-md bg-black/20 hover:bg-white hover:text-karima-brand transition-all duration-300 shadow-sm cursor-pointer"
                    >
                        Lihat Opsi
                    </button>
                </div>
            </Link>

            {/* Product Meta (Centered Clean Editorial Hierarchy) */}
            <div className="flex flex-col items-center text-center px-1">
                {/* Category Subtitle */}
                <p className="text-[9px] sm:text-xxs uppercase tracking-[0.2em] text-karima-ink/40 dark:text-stone-400 font-medium mb-1">
                    {product.category_name || "Koleksi"}
                </p>

                {/* Product Title */}
                <Link
                    href={productUrl}
                    className="font-serif text-sm sm:text-base md:text-lg text-karima-brand dark:text-stone-100 group-hover:text-karima-gold transition-colors duration-300 line-clamp-2 leading-snug"
                >
                    {product.title}
                </Link>

                {/* Price Row */}
                <div className="mt-1 flex items-baseline justify-center gap-1.5 flex-wrap">
                    {hasDiscount ? (
                        <>
                            <span className="text-[10px] sm:text-xs text-karima-ink/40 dark:text-stone-500 line-through decoration-karima-ink/30">
                                {formatRupiah(product.sell_price)}
                            </span>
                            <span className="text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400">
                                {formatRupiah(price)}
                            </span>
                        </>
                    ) : (
                        <span className={`text-xs sm:text-sm font-semibold ${isSoldOut
                            ? "text-karima-ink/40 dark:text-stone-500"
                            : "text-karima-ink/80 dark:text-stone-200"
                            }`}>
                            {formatRupiah(price)}
                        </span>
                    )}
                </div>

                {/* Color Swatch Dots */}
                {colorSwatches.length > 0 && (
                    <div className="flex items-center justify-center gap-1.5 mt-2 h-4">
                        {colorSwatches.slice(0, 5).map((color, idx) => (
                            <span
                                key={`${color.name}-${idx}`}
                                className="w-2.5 h-2.5 rounded-full border border-stone-300 dark:border-stone-700 shadow-2xs"
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                            />
                        ))}
                        {colorSwatches.length > 5 && (
                            <span className="text-nano font-mono text-karima-ink/50 dark:text-stone-500">
                                +{colorSwatches.length - 5}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

