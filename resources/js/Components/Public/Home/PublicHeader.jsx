import React, { useState, useEffect } from "react";
import { Link } from "@inertiajs/react";
import {
    IconBuildingStore,
    IconSearch,
    IconX,
    IconShoppingCart,
    IconHeart,
    IconChevronDown,
    IconBrandWhatsapp,
} from "@tabler/icons-react";

export default function PublicHeader({
    store = {},
    activeBranch = null,
    branches = [],
    onOpenBranchModal = () => { },
    cartCount = 0,
    onOpenCart = () => { },
    wishlistCount = 0,
    onOpenWishlist = () => { },
    isTransparentVariant = true,
}) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const storeName = store.name || "Toko Kami";
    const branchName = activeBranch?.name || store.branch_name || "Gudang Utama";
    const waPhone = store.wa_number || store.phone;

    useEffect(() => {
        if (!isTransparentVariant) {
            setIsScrolled(true);
            return;
        }

        const handleScroll = () => {
            const currentScrolled = window.scrollY > 40;
            setIsScrolled(currentScrolled);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        return () => window.removeEventListener("scroll", handleScroll);
    }, [isTransparentVariant]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            window.location.href = `/katalog?q=${encodeURIComponent(searchQuery.trim())}`;
        }
    };

    // Style tokens depending on scroll
    const headerBg = isScrolled
        ? "bg-white/95 dark:bg-stone-950/95 backdrop-blur-md shadow-xs border-b border-karima-brand/10 dark:border-stone-800 text-karima-ink dark:text-stone-100"
        : "bg-gradient-to-b from-black/60 via-black/20 to-transparent text-white border-b border-white/10";

    const navLinkClass = isScrolled
        ? "text-karima-ink/75 dark:text-stone-300 hover:text-karima-brand dark:hover:text-karima-gold"
        : "text-white/80 hover:text-white";

    const buttonBorder = isScrolled
        ? "border-karima-brand/20 dark:border-stone-700 bg-white dark:bg-slate-900 text-karima-brand dark:text-stone-200 hover:bg-karima-base/30"
        : "border-white/30 bg-black/20 text-white hover:bg-white/20 backdrop-blur-md";

    return (
        <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${headerBg}`}>
            {/* Top Micro Context Bar */}
            <div className={`px-4 sm:px-6 py-1.5 text-xxs uppercase tracking-wider transition-colors duration-500 border-b ${isScrolled
                    ? "border-karima-brand/5 dark:border-stone-800/60 bg-karima-base/30 dark:bg-stone-900/40 text-karima-ink/70 dark:text-stone-400"
                    : "border-white/10 bg-black/25 text-white/80"
                }`}>
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
                    {/* Branch Switcher Button */}
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        {branches && branches.length > 0 ? (
                            <button
                                type="button"
                                onClick={onOpenBranchModal}
                                className="inline-flex items-center gap-1.5 py-0.5 font-medium cursor-pointer transition-colors hover:opacity-80"
                                title="Ganti cabang"
                            >
                                <IconBuildingStore size={13} className="shrink-0 opacity-80" />
                                <span className="truncate max-w-[140px] sm:max-w-[220px]">
                                    {branchName}
                                </span>
                                {branches.length > 1 && (
                                    <IconChevronDown size={11} className="opacity-70 shrink-0" />
                                )}
                            </button>
                        ) : (
                            <span className="truncate">{branchName}</span>
                        )}
                        <span className="opacity-30 hidden xs:inline">|</span>
                        <span className="hidden xs:inline tracking-widest text-[9px]">
                            {store.city || "Official Storefront"}
                        </span>
                    </div>

                    {/* WhatsApp Toko */}
                    {waPhone && (
                        <a
                            href={`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent("Halo " + storeName + ", saya ingin bertanya tentang produk.")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-medium shrink-0 hover:opacity-80 transition-opacity"
                        >
                            <IconBrandWhatsapp size={13} className="text-emerald-400 shrink-0" />
                            <span className="hidden sm:inline">WhatsApp CS</span>
                        </a>
                    )}
                </div>
            </div>

            {/* Main Navigation Bar */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
                {/* Brand Logo & Name */}
                <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
                    {store.logo ? (
                        <img
                            src={store.logo}
                            alt={storeName}
                            className={`h-8 sm:h-10 max-w-[140px] sm:max-w-[180px] object-contain shrink-0 transition-all ${!isScrolled ? "filter brightness-0 invert" : ""
                                }`}
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-karima-brand text-white flex items-center justify-center font-serif text-base font-bold shadow-xs">
                                {storeName.charAt(0)}
                            </span>
                            <span className={`font-serif text-xl sm:text-2xl tracking-tight font-medium transition-colors ${isScrolled ? "text-karima-brand dark:text-stone-100 group-hover:text-karima-gold" : "text-white group-hover:text-stone-200"
                                }`}>
                                {storeName}
                            </span>
                        </div>
                    )}
                </Link>

                {/* Center Navigation Links (Desktop) */}
                <nav className="hidden md:flex items-center gap-8 text-[11px] font-semibold uppercase tracking-[0.25em]">
                    <Link href="/" className={`transition-colors py-1 ${navLinkClass}`}>
                        Home
                    </Link>
                    <Link href="/katalog" className={`transition-colors py-1 ${navLinkClass}`}>
                        Koleksi
                    </Link>
                    <a href="#categories" className={`transition-colors py-1 ${navLinkClass}`}>
                        Kategori
                    </a>
                    <a href="#promo" className={`transition-colors py-1 ${navLinkClass}`}>
                        Promo
                    </a>
                </nav>

                {/* Right Action Icons: Search, Wishlist, Cart */}
                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                    {/* Search Trigger */}
                    <div className="relative">
                        {isSearchOpen ? (
                            <form
                                onSubmit={handleSearchSubmit}
                                className="flex items-center relative animate-fade-in"
                            >
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari busana..."
                                    autoFocus
                                    className="w-36 sm:w-56 pl-7 pr-7 py-1.5 text-xs rounded-full bg-white dark:bg-stone-900 border border-karima-brand/30 dark:border-stone-700 text-karima-ink dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-karima-brand"
                                />
                                <IconSearch
                                    size={14}
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-karima-ink/40"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSearchOpen(false);
                                        setSearchQuery("");
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-karima-ink/40 hover:text-karima-brand p-0.5 cursor-pointer"
                                >
                                    <IconX size={13} />
                                </button>
                            </form>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsSearchOpen(true)}
                                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer ${buttonBorder}`}
                                title="Cari Produk"
                                aria-label="Cari Produk"
                            >
                                <IconSearch size={16} />
                            </button>
                        )}
                    </div>

                    {/* Wishlist Button */}
                    <button
                        type="button"
                        onClick={onOpenWishlist}
                        className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer ${buttonBorder}`}
                        title="Lihat Wishlist"
                        aria-label="Wishlist"
                    >
                        <IconHeart
                            size={16}
                            className={wishlistCount > 0 ? "text-rose-500 fill-rose-500" : ""}
                        />
                        {wishlistCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                                {wishlistCount}
                            </span>
                        )}
                    </button>

                    {/* Cart Bag Button */}
                    <button
                        type="button"
                        onClick={onOpenCart}
                        className={`relative inline-flex items-center gap-1.5 px-3 sm:px-3.5 h-9 rounded-full border transition-all cursor-pointer ${buttonBorder}`}
                        title="Buka Keranjang"
                        aria-label="Keranjang Belanja"
                    >
                        <IconShoppingCart size={16} />
                        <span className="hidden sm:inline text-xxs uppercase tracking-widest font-semibold">
                            Bag
                        </span>
                        {cartCount > 0 && (
                            <span className="min-w-4 h-4 px-1 rounded-full bg-karima-brand text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </header>
    );
}

