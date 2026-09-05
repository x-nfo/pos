import { Link, usePage } from "@inertiajs/react";
import {
    IconShoppingCart,
    IconBrandWhatsapp,
    IconBuildingStore,
    IconMapPin,
    IconMail,
    IconClock,
    IconTruckDelivery,
    IconShieldCheck,
    IconBolt,
} from "@tabler/icons-react";

export const NAV_LINKS = [
    { label: "Katalog Toko", href: "/katalog" },
    { label: "Fitur", href: "/fitur" },
    { label: "Dokumentasi", href: "/dokumentasi" },
    { label: "Roadmap", href: "/roadmap" },
];

export default function PublicLayout({
    children,
    active = "",
    variant = "default",
    store = null,
    cartCount = 0,
    onOpenCart = null,
    hideNavbar = false,
}) {
    const { branding } = usePage().props;
    const isStorefront = variant === "storefront" || active === "/katalog";
    const appName = store?.name || branding?.appName || "Toko Kami";
    const storeLogo = store?.logo || branding?.logoLight;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
            {/* ============ NAVBAR ============ */}
            {!hideNavbar && (
                <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 text-white shadow-md border-b border-white/10 backdrop-blur-xl">
                    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
                        {/* Brand / Logo */}
                        <Link href={isStorefront ? "/katalog" : "/"} className="flex items-center gap-2 min-w-0">
                            {storeLogo ? (
                                <div className="h-8 sm:h-9 bg-white p-1 rounded-lg border border-white/20 shadow-2xs flex items-center shrink-0">
                                    <img src={storeLogo} alt={appName} className="h-full max-w-[110px] sm:max-w-[150px] object-contain shrink-0" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center text-white shadow-sm shrink-0 backdrop-blur-xs">
                                    {isStorefront ? <IconBuildingStore size={18} className="text-white" /> : <IconShoppingCart size={18} className="text-white" />}
                                </div>
                            )}
                            <span className="text-sm sm:text-lg font-bold text-white truncate">
                                {appName}
                            </span>
                        </Link>

                        {/* Marketing Navigation Links (Hidden on Storefront / Catalog) */}
                        {!isStorefront && (
                            <div className="hidden md:flex items-center gap-2 lg:gap-3">
                                {NAV_LINKS.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`text-xs sm:text-sm px-3 py-1.5 rounded-lg transition-colors ${
                                            active === link.href
                                                ? "text-white font-bold bg-white/20"
                                                : "text-white/80 hover:text-white hover:bg-white/10"
                                        }`}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        )}

                        {/* Right Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                            {isStorefront ? (
                                <>
                                    {/* Customer WhatsApp Contact Action */}
                                    {(store?.wa_number || store?.phone) && (
                                        <a
                                            href={`https://api.whatsapp.com/send?phone=${store.wa_number || store.phone}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/15 text-white border border-white/25 text-xs font-semibold hover:bg-white/25 transition-all shadow-2xs backdrop-blur-xs"
                                            title="Chat WhatsApp Toko"
                                        >
                                            <IconBrandWhatsapp size={18} className="text-white" />
                                            <span className="hidden sm:inline">WhatsApp</span>
                                        </a>
                                    )}

                                    {/* Compact Cart Button */}
                                    {cartCount > 0 && onOpenCart && (
                                        <button
                                            type="button"
                                            onClick={onOpenCart}
                                            className="relative inline-flex items-center justify-center p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-sm transition-all cursor-pointer"
                                            title="Buka Keranjang Belanja"
                                        >
                                            <IconShoppingCart size={18} />
                                            <span className="hidden sm:inline sm:ml-1.5">Keranjang</span>
                                            <span className="absolute -top-1.5 -right-1.5 sm:static sm:ml-1.5 min-w-[18px] h-[18px] sm:h-auto px-1 rounded-full bg-primary-600 text-white text-[10px] sm:text-xs flex items-center justify-center font-extrabold shadow-xs">
                                                {cartCount}
                                            </span>
                                        </button>
                                    )}
                                </>
                            ) : (
                                /* Marketing Login Link */
                                <Link
                                    href="/login"
                                    className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-primary-700 bg-white hover:bg-slate-100 rounded-xl shadow-xs transition-all"
                                >
                                    Masuk Aplikasi
                                </Link>
                            )}
                        </div>
                    </div>
                </nav>
            )}

            {/* ============ CONTENT ============ */}
            <main className={`flex-1 ${!hideNavbar ? "pt-14 sm:pt-16" : ""}`}>{children}</main>

            {/* ============ FOOTER ============ */}
            <footer className={`bg-gradient-to-r from-primary-700 via-primary-800 to-primary-900 text-white border-t border-white/10 shadow-lg pt-10 sm:pt-12 px-4 sm:px-6 ${
                isStorefront ? "pb-24 sm:pb-10" : "pb-8 sm:pb-10"
            }`}>
                <div className="max-w-7xl mx-auto">
                    {isStorefront ? (
                        /* ============ STOREFRONT FOOTER ============ */
                        <div>
                            {/* Main Storefront Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 pb-8 sm:pb-10">
                                {/* Col 1: Store Brand & Trust (5 cols) */}
                                <div className="md:col-span-5 space-y-4">
                                    <div className="flex items-center gap-3">
                                        {storeLogo ? (
                                            <div className="w-10 h-10 rounded-xl bg-white p-1 border border-white/20 shadow-2xs shrink-0 flex items-center justify-center">
                                                <img
                                                    src={storeLogo}
                                                    alt={appName}
                                                    className="w-full h-full object-contain rounded-lg"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center text-white shadow-2xs shrink-0 backdrop-blur-xs">
                                                <IconBuildingStore size={20} className="text-white" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="font-extrabold text-base text-white leading-tight truncate">
                                                {appName}
                                            </h3>
                                            <p className="text-xs text-white/80 truncate">
                                                {store?.branch_name ? `Cabang: ${store.branch_name}` : (store?.tagline || "Katalog Resmi & Belanja Instan")}
                                            </p>
                                        </div>
                                    </div>

                                    <p className="text-xs text-white/80 leading-relaxed max-w-sm">
                                        Nikmati kemudahan berbelanja kebutuhan langsung dari katalog resmi kami dengan konfirmasi pesanan cepat via WhatsApp.
                                    </p>

                                    {/* Trust Value Badges */}
                                    <div className="flex flex-wrap gap-2 pt-0.5">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 text-[11px] font-semibold border border-emerald-400/30">
                                            <IconBolt size={13} className="text-emerald-300" />
                                            Pesan Cepat via WA
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 text-white text-[11px] font-semibold border border-white/20 backdrop-blur-xs">
                                            <IconShieldCheck size={13} className="text-white" />
                                            Toko Resmi
                                        </span>
                                        {store?.delivery_enabled && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 text-[11px] font-semibold border border-amber-400/30">
                                                <IconTruckDelivery size={13} className="text-amber-300" />
                                                Siap Kirim
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Col 2: Hubungi Kami & Alamat (4 cols) */}
                                <div className="md:col-span-4 space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                        Kontak & Lokasi Toko
                                    </h4>
                                    <div className="space-y-2.5 text-xs text-white/80">
                                        {(store?.address || store?.city) && (
                                            <div className="flex items-start gap-2">
                                                <IconMapPin size={15} className="text-rose-300 shrink-0 mt-0.5" />
                                                <span className="leading-relaxed text-white/90">
                                                    {store.address}
                                                    {store.city ? `, ${store.city}` : ""}
                                                </span>
                                            </div>
                                        )}

                                        {(store?.wa_number || store?.phone) && (
                                            <div className="flex items-center gap-2">
                                                <IconBrandWhatsapp size={15} className="text-emerald-300 shrink-0" />
                                                <a
                                                    href={`https://api.whatsapp.com/send?phone=${store.wa_number || store.phone}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-semibold text-emerald-300 hover:text-emerald-200 hover:underline inline-flex items-center gap-1.5"
                                                >
                                                    <span>{store.phone || store.wa_number}</span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 font-bold">
                                                        Chat Sekarang
                                                    </span>
                                                </a>
                                            </div>
                                        )}

                                        {store?.email && (
                                            <div className="flex items-center gap-2">
                                                <IconMail size={15} className="text-white/60 shrink-0" />
                                                <span className="text-white/80">{store.email}</span>
                                            </div>
                                        )}

                                        {store?.operating_status && (
                                            <div className="flex items-center gap-2 pt-0.5">
                                                <IconClock size={15} className="text-white/70 shrink-0" />
                                                <span className="font-medium text-white/90">
                                                    Status: {store.operating_status.badge_text || (store.operating_status.is_open ? "Buka" : "Tutup")}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Col 3: Cara Pemesanan (3 cols) */}
                                <div className="md:col-span-3 space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                        Cara Pemesanan
                                    </h4>
                                    <ul className="space-y-2 text-xs text-white/80">
                                        <li className="flex items-start gap-2">
                                            <span className="w-4 h-4 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 backdrop-blur-xs">
                                                1
                                            </span>
                                            <span>Pilih barang & masukkan ke keranjang</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="w-4 h-4 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 backdrop-blur-xs">
                                                2
                                            </span>
                                            <span>Pilih opsi pengiriman & lengkapi data</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="w-4 h-4 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 backdrop-blur-xs">
                                                3
                                            </span>
                                            <span>Kirim pesanan via WhatsApp resmi</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Sub-Footer (Copyright) */}
                            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/70">
                                <p className="text-center sm:text-left">
                                    © {new Date().getFullYear()} <strong className="text-white font-semibold">{appName}</strong>. Seluruh hak cipta dilindungi.
                                </p>
                                <p className="text-center sm:text-right text-[11px] text-white/60">
                                    Pemesanan diproses langsung oleh staf toko resmi.
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* ============ MARKETING / GENERAL FOOTER ============ */
                        <div>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 sm:pb-10">
                                <div className="md:col-span-6 space-y-3">
                                    <div className="flex items-center gap-2.5">
                                        {storeLogo ? (
                                            <div className="h-8 bg-white p-1 rounded-md border border-white/20 shadow-2xs flex items-center shrink-0">
                                                <img src={storeLogo} alt={appName} className="h-full max-w-[140px] object-contain rounded-md" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center text-white shadow-2xs backdrop-blur-xs">
                                                <IconShoppingCart size={17} className="text-white" />
                                            </div>
                                        )}
                                        <span className="font-extrabold text-base text-white">
                                            {appName}
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/80 leading-relaxed max-w-sm">
                                        {branding?.tagline || "Solusi Point of Sale (POS) dan Katalog Online Terintegrasi untuk pertumbuhan bisnis Anda."}
                                    </p>
                                </div>

                                <div className="md:col-span-3 space-y-2.5">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                        Navigasi
                                    </h4>
                                    <div className="flex flex-col space-y-2 text-xs text-white/80">
                                        <Link href="/katalog" className="hover:text-white transition-colors">
                                            Katalog Toko Online
                                        </Link>
                                        <Link href="/fitur" className="hover:text-white transition-colors">
                                            Fitur Kasir
                                        </Link>
                                        <Link href="/dokumentasi" className="hover:text-white transition-colors">
                                            Dokumentasi
                                        </Link>
                                        <Link href="/roadmap" className="hover:text-white transition-colors">
                                            Roadmap
                                        </Link>
                                    </div>
                                </div>

                                <div className="md:col-span-3 space-y-2.5">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                        Aplikasi Kasir
                                    </h4>
                                    <div className="space-y-3">
                                        <p className="text-xs text-white/80">
                                            Masuk ke panel kasir untuk mengelola transaksi, stok, dan laporan.
                                        </p>
                                        <Link
                                            href="/login"
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-primary-700 hover:bg-slate-100 font-bold text-xs shadow-sm transition-all"
                                        >
                                            Masuk Aplikasi Kasir →
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/70">
                                <div>
                                    {branding?.footerText || `© ${new Date().getFullYear()} ${appName}. All rights reserved.`}
                                </div>
                                {!isStorefront && branding?.poweredBy?.show && branding?.poweredBy?.text && (
                                    <div className="text-[11px] text-white/60">
                                        {branding?.poweredBy?.url ? (
                                            <a href={branding.poweredBy.url} target="_blank" rel="noreferrer" className="hover:underline hover:text-white">
                                                {branding.poweredBy.text}
                                            </a>
                                        ) : (
                                            branding.poweredBy.text
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </footer>
        </div>
    );
}
