import React from "react";
import { Link } from "@inertiajs/react";
import {
    IconBrandWhatsapp,
    IconBrandInstagram,
    IconBuildingStore,
    IconMapPin,
    IconPhone,
    IconClock,
} from "@tabler/icons-react";

export default function EditorialFooter({ store = {}, activeBranch = null }) {
    const storeName = store.name || "Butik Busana";
    const waPhone = store.wa_number || store.phone;
    const branchName = activeBranch?.name || store.branch_name || "Gudang Utama";
    const branchAddress = activeBranch?.address || store.address || "Jakarta, Indonesia";

    return (
        <footer className="bg-karima-brand text-karima-base pt-20 sm:pt-28 pb-12 px-4 sm:px-6 relative overflow-hidden border-t border-karima-brand/40">
            <div className="container mx-auto max-w-7xl relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 mb-16 sm:mb-20">
                    {/* Brand Column (lg:col-span-4) */}
                    <div className="lg:col-span-4 space-y-6">
                        {store.logo ? (
                            <img
                                src={store.logo}
                                alt={storeName}
                                className="h-9 w-auto object-contain filter brightness-0 invert"
                            />
                        ) : (
                            <div className="flex items-center gap-2.5">
                                <span className="w-9 h-9 rounded-full bg-karima-gold text-karima-brand flex items-center justify-center font-serif text-lg font-bold shadow-xs">
                                    {storeName.charAt(0)}
                                </span>
                                <span className="font-serif text-2xl text-white tracking-wider font-medium">
                                    {storeName}
                                </span>
                            </div>
                        )}

                        <p className="text-xs font-light text-karima-base/70 max-w-sm leading-relaxed">
                            {store.description ||
                                "Menghadirkan busana berkualitas butik dengan perpaduan kenyamanan, keanggunan, dan kesederhanaan desain abadi."}
                        </p>

                        {/* Location */}
                        <div className="space-y-1.5 pt-2">
                            <h4 className="text-[10px] uppercase tracking-[0.25em] font-semibold text-karima-gold">
                                Lokasi Cabang
                            </h4>
                            <p className="text-xs font-light text-karima-base/75 flex items-start gap-1.5">
                                <IconMapPin size={15} className="text-karima-gold shrink-0 mt-0.5" />
                                <span>{branchAddress}</span>
                            </p>
                        </div>

                        {/* Social & Contact */}
                        <div className="flex items-center gap-4 pt-2">
                            {waPhone && (
                                <a
                                    href={`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent("Halo " + storeName + ", saya ingin konsultasi produk.")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-xs font-light tracking-wider text-karima-base/80 hover:text-white transition-colors py-1"
                                >
                                    <IconBrandWhatsapp size={17} className="text-emerald-400" />
                                    <span>WhatsApp</span>
                                </a>
                            )}
                            {store.instagram && (
                                <a
                                    href={store.instagram.startsWith("http") ? store.instagram : `https://instagram.com/${store.instagram.replace("@", "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-xs font-light tracking-wider text-karima-base/80 hover:text-white transition-colors py-1"
                                >
                                    <IconBrandInstagram size={17} className="text-rose-400" />
                                    <span>Instagram</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Links Columns (lg:col-span-8) */}
                    <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-8">
                        {/* Col 1: Koleksi */}
                        <div className="space-y-4">
                            <h4 className="text-xxs sm:text-xs uppercase tracking-[0.25em] font-semibold text-karima-gold">
                                Koleksi
                            </h4>
                            <ul className="space-y-2.5 text-xs font-light text-karima-base/75">
                                <li>
                                    <Link href="/katalog" className="hover:text-white transition-colors">
                                        Semua Produk
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/katalog?sort=newest" className="hover:text-white transition-colors">
                                        Koleksi Terbaru
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/katalog?in_stock=1" className="hover:text-white transition-colors">
                                        Tersedia (Ready Stock)
                                    </Link>
                                </li>
                                <li>
                                    <a href="#categories" className="hover:text-white transition-colors">
                                        Curated Categories
                                    </a>
                                </li>
                            </ul>
                        </div>

                        {/* Col 2: Bantuan & Layanan */}
                        <div className="space-y-4">
                            <h4 className="text-xxs sm:text-xs uppercase tracking-[0.25em] font-semibold text-karima-gold">
                                Bantuan
                            </h4>
                            <ul className="space-y-2.5 text-xs font-light text-karima-base/75">
                                <li>
                                    <span className="opacity-90">Pesanan via WhatsApp</span>
                                </li>
                                <li>
                                    <span className="opacity-90">Pengiriman se-Indonesia</span>
                                </li>
                                <li>
                                    <span className="opacity-90">Panduan Ukuran (Size Chart)</span>
                                </li>
                                <li>
                                    <span className="opacity-90">Garansi Kualitas Butik</span>
                                </li>
                            </ul>
                        </div>

                        {/* Col 3: Operasional */}
                        <div className="space-y-4 col-span-2 sm:col-span-1">
                            <h4 className="text-xxs sm:text-xs uppercase tracking-[0.25em] font-semibold text-karima-gold">
                                Operasional
                            </h4>
                            <div className="space-y-2 text-xs font-light text-karima-base/75">
                                <div className="flex items-center gap-2 text-karima-gold font-medium">
                                    <IconBuildingStore size={15} />
                                    <span>{branchName}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <IconClock size={15} className="shrink-0 mt-0.5 text-karima-base/60" />
                                    <span>Senin — Sabtu<br />09:00 — 21:00 WIB</span>
                                </div>
                                <p className="text-[11px] text-karima-base/60 pt-2">
                                    Pemesanan online web & WhatsApp tetap dilayani setiap saat.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar: Copyright & Attribution */}
                <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-light text-karima-base/50">
                    <p>
                        © {new Date().getFullYear()} {storeName}. Hak cipta dilindungi.
                    </p>
                    <div className="flex items-center gap-6 text-[10px] uppercase tracking-widest text-karima-base/60">
                        <span>Luxury Fashion & Apparel</span>
                        <span>•</span>
                        <span>Omnichannel POS</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}

