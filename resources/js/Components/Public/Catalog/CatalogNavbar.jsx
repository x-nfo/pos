import React from "react";
import { Link } from "@inertiajs/react";
import {
    IconMapPin,
    IconBuildingStore,
    IconSearch,
    IconX,
    IconBrandWhatsapp,
    IconShoppingCart,
    IconHeart,
    IconChevronDown,
    IconTruckDelivery,
    IconAlertCircle,
} from "@tabler/icons-react";

export default function CatalogNavbar({
    store = {},
    activeBranch = null,
    branches = [],
    onOpenBranchModal = null,
    searchTerm = "",
    onSearchChange = () => { },
    onClearSearch = () => { },
    cartCount = 0,
    onOpenCart = null,
    wishlistCount = 0,
    onOpenWishlist = null,
    isDeliveryAllowed = true,
    isPickupAllowed = true,
}) {
    const storeName = store.name || "Toko Kami";
    const branchName = activeBranch?.name || store.branch_name || "Gudang Utama";
    const waPhone = store.wa_number || store.phone;
    const opStatus = activeBranch?.operating_status || store.operating_status || {
        is_open: true,
        status: "open",
        label: "Buka",
        badge_text: "Buka",
        badge_color: "emerald",
    };

    return (
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-karima-brand/10 dark:border-stone-800 transition-all">
            {/* Top Minimalist Context Bar */}
            <div className="border-b border-karima-brand/5 dark:border-stone-800/60 bg-karima-base/30 dark:bg-slate-900/40 px-3.5 sm:px-6 py-1.5 text-xxs tracking-wider uppercase text-karima-ink/70 dark:text-stone-400">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
                    {/* Left: Branch & Status */}
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        {branches && branches.length > 0 ? (
                            <button
                                type="button"
                                onClick={onOpenBranchModal}
                                className="inline-flex items-center gap-1.5 py-0.5 text-karima-brand dark:text-stone-200 hover:text-karima-accent transition-colors font-medium cursor-pointer"
                                title="Klik untuk mengganti cabang"
                            >
                                <IconBuildingStore size={13} className="text-karima-brand/70 dark:text-stone-400 shrink-0" />
                                <span className="truncate max-w-[120px] sm:max-w-[200px]">
                                    {branchName}
                                </span>
                                {branches.length > 1 && (
                                    <IconChevronDown size={11} className="opacity-60 shrink-0" />
                                )}
                            </button>
                        ) : (
                            <div className="flex items-center gap-1">
                                <IconMapPin size={12} className="opacity-70" />
                                <span>{store.city || "Toko Pusat"}</span>
                            </div>
                        )}

                        <span className="opacity-20 hidden xs:inline">|</span>

                        {/* Store Open/Closed Badge */}
                        <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase shrink-0 ${opStatus.is_open
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                    : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                                }`}
                        >
                            <span
                                className={`w-1.5 h-1.5 rounded-full ${opStatus.is_open ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                                    }`}
                            />
                            <span>{opStatus.badge_text || (opStatus.is_open ? "Buka" : "Tutup")}</span>
                        </span>

                        {/* Delivery note (desktop) */}
                        <span className="hidden md:inline-flex items-center gap-1 text-karima-ink/50 dark:text-stone-400">
                            {isDeliveryAllowed && isPickupAllowed ? (
                                <>
                                    <IconTruckDelivery size={12} className="opacity-70" />
                                    <span>Kirim & Ambil di Toko</span>
                                </>
                            ) : isDeliveryAllowed ? (
                                <>
                                    <IconTruckDelivery size={12} className="opacity-70" />
                                    <span>Kirim ke Alamat Saja</span>
                                </>
                            ) : isPickupAllowed ? (
                                <>
                                    <IconBuildingStore size={12} className="opacity-70" />
                                    <span>Ambil di Toko Saja</span>
                                </>
                            ) : (
                                <>
                                    <IconAlertCircle size={12} className="opacity-70 text-rose-500" />
                                    <span className="text-rose-500">Pemesanan Nonaktif</span>
                                </>
                            )}
                        </span>
                    </div>

                    {/* Right: WhatsApp Link */}
                    {waPhone && (
                        <a
                            href={`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent("Halo, saya ingin bertanya tentang produk di " + storeName)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-karima-brand dark:text-stone-300 hover:text-karima-accent transition-colors font-medium shrink-0"
                        >
                            <IconBrandWhatsapp size={13} className="text-emerald-600" />
                            <span className="hidden sm:inline">WhatsApp Toko</span>
                        </a>
                    )}
                </div>
            </div>

            {/* Main Header Bar */}
            <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
                {/* Brand / Logo */}
                <Link
                    href="/"
                    className="flex items-center gap-2.5 shrink-0 group"
                    title="Kembali ke Beranda"
                >
                    {store.logo ? (
                        <img
                            src={store.logo}
                            alt={storeName}
                            className="h-8 sm:h-9 max-w-[130px] sm:max-w-[170px] object-contain shrink-0"
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-karima-brand text-white flex items-center justify-center font-serif text-base font-bold shadow-xs">
                                {storeName.charAt(0)}
                            </span>
                            <span className="font-serif text-lg sm:text-2xl text-karima-brand dark:text-stone-100 tracking-tight font-medium group-hover:text-karima-gold transition-colors">
                                {storeName}
                            </span>
                        </div>
                    )}
                </Link>

                {/* Center / Desktop Search Bar */}
                <div className="hidden md:flex flex-1 max-w-md mx-6">
                    <div className="relative w-full">
                        <IconSearch
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-karima-ink/40 dark:text-stone-500 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Cari busana, warna, atau produk..."
                            className="w-full pl-9 pr-8 py-2 text-xs font-sans bg-stone-50 dark:bg-slate-900 border border-karima-brand/15 dark:border-stone-800 rounded-full focus:outline-none focus:border-karima-brand dark:focus:border-stone-400 focus:bg-white dark:focus:bg-slate-950 transition-all text-karima-ink dark:text-stone-100 placeholder:text-karima-ink/40 dark:placeholder:text-stone-500"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={onClearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-karima-ink/40 hover:text-karima-brand dark:hover:text-white p-0.5 cursor-pointer"
                            >
                                <IconX size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Actions: Wishlist & Cart Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                    {onOpenWishlist && (
                        <button
                            type="button"
                            onClick={onOpenWishlist}
                            className="relative inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-full border border-karima-brand/20 dark:border-stone-700 hover:border-karima-brand bg-white dark:bg-slate-900 text-karima-brand dark:text-stone-200 hover:bg-karima-base/30 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs group"
                            title="Lihat Wishlist"
                            aria-label="Wishlist"
                        >
                            <IconHeart
                                size={18}
                                className={`transition-all duration-300 group-hover:scale-110 ${wishlistCount > 0
                                        ? "text-rose-500 fill-rose-500"
                                        : "text-karima-brand dark:text-stone-200"
                                    }`}
                            />
                            <span className="hidden sm:inline text-xxs uppercase tracking-widest font-semibold">
                                Wishlist
                            </span>
                            {wishlistCount > 0 && (
                                <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                                    {wishlistCount}
                                </span>
                            )}
                        </button>
                    )}

                    {onOpenCart && (
                        <button
                            type="button"
                            onClick={onOpenCart}
                            className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-karima-brand/20 dark:border-stone-700 hover:border-karima-brand bg-white dark:bg-slate-900 text-karima-brand dark:text-stone-200 hover:bg-karima-base/30 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs group"
                            title="Buka Keranjang Belanja"
                            aria-label="Keranjang Belanja"
                        >
                            <IconShoppingCart size={18} className="text-karima-brand dark:text-stone-200 group-hover:scale-105 transition-transform" />
                            <span className="hidden sm:inline text-xxs uppercase tracking-widest font-semibold">
                                Bag
                            </span>
                            {cartCount > 0 && (
                                <span className="min-w-5 h-5 px-1.5 rounded-full bg-karima-brand text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Search Bar (Full width below header) */}
            <div className="md:hidden px-3.5 pb-2.5 pt-0.5">
                <div className="relative w-full">
                    <IconSearch
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-karima-ink/40 dark:text-stone-500 pointer-events-none"
                    />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Cari busana, warna, produk..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs font-sans bg-stone-50 dark:bg-slate-900 border border-karima-brand/15 dark:border-stone-800 rounded-full focus:outline-none focus:border-karima-brand text-karima-ink dark:text-stone-100 placeholder:text-karima-ink/40"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={onClearSearch}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-karima-ink/40 p-0.5"
                        >
                            <IconX size={13} />
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

