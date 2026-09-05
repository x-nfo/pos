import React from "react";
import { Link } from "@inertiajs/react";
import {
    IconMapPin,
    IconBuildingStore,
    IconTruckDelivery,
    IconSearch,
    IconX,
    IconBrandWhatsapp,
    IconShoppingCart,
    IconChevronDown,
} from "@tabler/icons-react";

export default function StorefrontHeader({
    store = {},
    activeBranch = null,
    branches = [],
    onOpenBranchModal = null,
    searchTerm = "",
    onSearchChange = () => {},
    onClearSearch = () => {},
    cartCount = 0,
    onOpenCart = null,
    isDeliveryAllowed = true,
}) {
    const storeName = store.name || "Toko Kami";
    const branchName = activeBranch?.name || store.branch_name || "Gudang Utama";
    const branchAddress = activeBranch?.address || store.address || "";
    const waPhone = store.wa_number || store.phone;
    const waText = encodeURIComponent(
        `Halo kak, saya ingin bertanya mengenai produk di ${storeName}`
    );
    const opStatus = activeBranch?.operating_status || store.operating_status || {
        is_open: true,
        status: "open",
        label: "Buka",
        badge_text: "Buka",
        badge_color: "emerald",
    };

    return (
        <header className="sticky top-0 z-40 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 text-white shadow-md border-b border-white/10 transition-all">
            {/* Top Context Strip: Lokasi Cabang, Status Operasional & Layanan */}
            <div className="bg-black/15 border-b border-white/10 px-3.5 sm:px-6 py-1.5 text-[11px] sm:text-xs text-white/80">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
                    {/* Left: Branch Selector Pill & Operational Status */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {branches && branches.length > 0 ? (
                            <button
                                type="button"
                                onClick={onOpenBranchModal}
                                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/20 transition-all shadow-2xs group cursor-pointer backdrop-blur-xs"
                                title="Klik untuk mengubah cabang toko"
                            >
                                <IconBuildingStore size={13} className="text-white shrink-0" />
                                <span className="font-semibold truncate max-w-[120px] sm:max-w-[200px] text-white">
                                    {branchName}
                                </span>
                                {branches.length > 1 && (
                                    <IconChevronDown
                                        size={12}
                                        className="text-white/70 group-hover:text-white transition-transform group-hover:translate-y-0.5 shrink-0"
                                    />
                                )}
                            </button>
                        ) : (
                            <div className="flex items-center gap-1 text-white font-semibold">
                                <IconMapPin size={13} className="text-white/80" />
                                <span>{store.city || "Toko Pusat"}</span>
                            </div>
                        )}

                        <span className="text-white/30 hidden xs:inline">|</span>

                        {/* Dynamic Operational Status Badge */}
                        <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold shrink-0 transition-all ${
                                opStatus.is_open
                                    ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"
                                    : opStatus.status === "temporarily_closed"
                                    ? "bg-rose-500/30 text-rose-200 border border-rose-400/40"
                                    : "bg-amber-500/25 text-amber-200 border border-amber-400/40"
                            }`}
                            title={opStatus.schedule_info || opStatus.badge_text}
                        >
                            <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                    opStatus.is_open
                                        ? "bg-emerald-400 animate-pulse"
                                        : "bg-rose-400"
                                }`}
                            />
                            <span className="truncate max-w-[130px] sm:max-w-[220px]">
                                {opStatus.badge_text || (opStatus.is_open ? "Buka" : "Tutup")}
                            </span>
                        </span>

                        {/* City / Area */}
                        {store.city && (
                            <span className="hidden xs:inline-flex items-center gap-1 text-white/80 truncate">
                                <IconMapPin size={12} className="text-white/70 shrink-0" />
                                <span>{store.city}</span>
                            </span>
                        )}

                        {/* Fulfillment Badge */}
                        <span className="hidden md:inline-flex items-center gap-1 text-white/80 shrink-0">
                            {isDeliveryAllowed ? (
                                <>
                                    <IconTruckDelivery size={13} className="text-white/80 shrink-0" />
                                    <span>Siap Kirim & Ambil</span>
                                </>
                            ) : (
                                <>
                                    <IconBuildingStore size={13} className="text-white/80 shrink-0" />
                                    <span>Ambil di Toko Saja</span>
                                </>
                            )}
                        </span>
                    </div>

                    {/* Right: Quick Tagline */}
                    <div className="flex items-center gap-3 shrink-0 text-white/70">
                        <span className="hidden sm:inline text-[10px] sm:text-[11px] font-medium text-white/75">
                            Pemesanan Resmi via WhatsApp
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Bar: Single Store Identity + Search + Action Controls */}
            <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3">
                <div className="flex items-center justify-between gap-3">
                    {/* 1. Single Store Logo & Name */}
                    <Link
                        href="/katalog"
                        className="flex items-center gap-2.5 sm:gap-3 min-w-0 group"
                    >
                        {store.logo ? (
                            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white p-1 border border-white/20 shadow-xs shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <img
                                    src={store.logo}
                                    alt={storeName}
                                    className="w-full h-full object-contain rounded-lg"
                                />
                            </div>
                        ) : (
                            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white/20 text-white border border-white/25 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform backdrop-blur-xs">
                                <IconBuildingStore size={22} className="text-white" />
                            </div>
                        )}

                        <div className="min-w-0">
                            <h1 className="text-sm sm:text-lg md:text-xl font-black text-white tracking-tight leading-tight truncate">
                                {storeName}
                            </h1>
                            <p className="hidden sm:block text-[11px] text-white/80 truncate max-w-[200px] md:max-w-[280px]">
                                {store.tagline || "Katalog Resmi & Belanja Instan"}
                            </p>
                        </div>
                    </Link>

                    {/* 2. Desktop & Tablet Centered Search Bar */}
                    <div className="hidden sm:block flex-1 max-w-md lg:max-w-lg mx-2">
                        <div className="relative">
                            <IconSearch
                                size={17}
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                placeholder="Cari produk kebutuhanmu..."
                                className="w-full pl-10 pr-9 py-2 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm border-0 shadow-sm focus:ring-2 focus:ring-white/60 outline-hidden transition-all"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={onClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                    title="Bersihkan pencarian"
                                >
                                    <IconX size={14} />
                                </button>
                            )}
                        </div>

                        {/* Branch Address Strip (Address Only) */}
                        {branchAddress && (
                            <div className="flex items-center gap-1.5 mt-1.5 px-1 text-[11px] text-white/85 select-none">
                                <IconMapPin size={13} className="text-white/80 shrink-0" />
                                <span className="truncate">{branchAddress}</span>
                            </div>
                        )}
                    </div>

                    {/* 3. Action Buttons: WhatsApp & Shopping Cart */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                        {/* WhatsApp Contact */}
                        {waPhone && (
                            <a
                                href={`https://api.whatsapp.com/send?phone=${waPhone}&text=${waText}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 text-xs font-bold transition-all shadow-2xs backdrop-blur-xs active:scale-95"
                                title="Hubungi Toko via WhatsApp"
                            >
                                <IconBrandWhatsapp size={18} className="text-white shrink-0" />
                                <span className="hidden md:inline">WhatsApp</span>
                            </a>
                        )}

                        {/* Cart Button */}
                        {onOpenCart && (
                            <button
                                type="button"
                                onClick={onOpenCart}
                                className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
                                    cartCount > 0
                                        ? "bg-white text-slate-900 hover:bg-white/90 shadow-md"
                                        : "bg-white/15 text-white hover:bg-white/25 border border-white/25 backdrop-blur-xs"
                                }`}
                                title="Buka Keranjang Belanja"
                            >
                                <div className="relative">
                                    <IconShoppingCart size={18} className="shrink-0" />
                                    {cartCount > 0 && (
                                        <span className="sm:hidden absolute -top-2 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                                            {cartCount}
                                        </span>
                                    )}
                                </div>
                                <span className="hidden sm:inline">Keranjang</span>
                                {cartCount > 0 && (
                                    <span className="hidden sm:inline-flex min-w-[20px] h-[20px] px-1.5 rounded-full bg-primary-600 text-white text-[11px] font-black items-center justify-center">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Search Row (Only on mobile screens) */}
                <div className="sm:hidden mt-2.5">
                    <div className="relative">
                        <IconSearch
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Cari produk kebutuhanmu..."
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 text-xs border-0 shadow-sm focus:ring-2 focus:ring-white/60 outline-hidden transition-all"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={onClearSearch}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600"
                                title="Bersihkan pencarian"
                            >
                                <IconX size={14} />
                            </button>
                        )}
                    </div>

                    {/* Branch Address Bar (Mobile - Address Only) */}
                    {branchAddress && (
                        <div className="flex items-center gap-1.5 mt-2 px-1 text-[11px] text-white/85 select-none">
                            <IconMapPin size={14} className="text-white/80 shrink-0" />
                            <span className="truncate">{branchAddress}</span>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
