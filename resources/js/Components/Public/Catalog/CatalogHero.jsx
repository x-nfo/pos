import React from "react";
import { Link } from "@inertiajs/react";
import { IconAlertCircle, IconChevronRight } from "@tabler/icons-react";

export default function CatalogHero({
    title = "Semua Koleksi",
    productCount = 0,
    isStoreOpen = true,
    opStatus = null,
}) {
    return (
        <section className="pt-6 sm:pt-10 pb-8 sm:pb-12 text-center">
            <div className="max-w-4xl mx-auto px-4 flex flex-col items-center">
                {/* Minimalist Editorial Breadcrumb */}
                <nav className="flex items-center gap-1.5 mb-4 text-xxs tracking-[0.25em] uppercase text-karima-ink/50 dark:text-stone-400 font-medium">
                    <Link
                        href="/"
                        className="hover:text-karima-brand dark:hover:text-stone-200 transition-colors"
                    >
                        Beranda
                    </Link>
                    <IconChevronRight size={12} className="opacity-50" />
                    <span className="text-karima-brand dark:text-stone-200">Katalog</span>
                </nav>

                {/* Main Serif Headline */}
                <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-serif text-karima-brand dark:text-stone-100 font-normal leading-tight tracking-tight">
                    {title}
                </h1>

                {/* Hairline Divider */}
                <div className="w-20 sm:w-28 h-px bg-karima-brand/20 dark:bg-stone-700 my-5 sm:my-6" />

                {/* Piece Counter */}
                <p className="text-xxs sm:text-xs uppercase tracking-[0.35em] text-karima-accent dark:text-stone-400 font-medium">
                    {productCount} {productCount === 1 ? "PRODUK" : "KOLEKSI PRODUK"}
                </p>

                {/* Store Closure Notice if store is closed */}
                {!isStoreOpen && opStatus && (
                    <div className="mt-6 max-w-xl w-full p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900/60 flex items-center justify-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                        <IconAlertCircle size={17} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="font-medium text-left">
                            Toko sedang tutup ({opStatus.badge_text || "Tutup"}). {opStatus.schedule_info || "Pemesanan dinonaktifkan sementara, Anda tetap dapat menjelajahi katalog."}
                        </span>
                    </div>
                )}
            </div>
        </section>
    );
}

