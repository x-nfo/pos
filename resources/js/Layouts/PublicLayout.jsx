import { Link, usePage } from "@inertiajs/react";
import {
    IconShoppingCart,
    IconArrowRight,
} from "@tabler/icons-react";

export const NAV_LINKS = [
    { label: "Fitur", href: "/fitur" },
    { label: "Dokumentasi", href: "/dokumentasi" },
    { label: "Roadmap", href: "/roadmap" },
];

export default function PublicLayout({ children, active = "" }) {
    const { branding } = usePage().props;
    const appName = branding?.appName || "Rekasir";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
            {/* ============ NAVBAR ============ */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5">
                        {branding?.logoLight ? (
                            <img src={branding.logoLight} alt={appName} className="h-8 max-w-[150px] object-contain" />
                        ) : (
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
                                    <IconShoppingCart size={20} className="text-white" />
                                </div>
                                <span className="text-lg font-bold text-slate-900 dark:text-white">
                                    {appName}
                                </span>
                            </div>
                        )}
                    </Link>

                    <div className="hidden md:flex items-center gap-7">
                        {NAV_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-sm transition-colors ${
                                    active === link.href
                                        ? "text-primary-600 dark:text-primary-400 font-semibold"
                                        : "text-slate-600 dark:text-slate-400 hover:text-primary-500"
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/login"
                            className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/25 transition-all"
                        >
                            Masuk Aplikasi
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ============ CONTENT ============ */}
            <main className="flex-1 pt-[68px]">{children}</main>

            {/* ============ FOOTER ============ */}
            <footer className="py-10 px-6 border-t border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        {branding?.logoLight ? (
                            <img src={branding.logoLight} alt={appName} className="h-7 max-w-[130px] object-contain" />
                        ) : (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                                <IconShoppingCart size={16} className="text-white" />
                            </div>
                        )}
                        <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-300">
                                {appName}
                            </div>
                            <div className="text-xs text-slate-500">
                                {branding?.tagline || "Sistem kasir online untuk UMKM"}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                        <Link href="/fitur" className="hover:text-primary-500 transition-colors">
                            Fitur
                        </Link>
                        <Link href="/dokumentasi" className="hover:text-primary-500 transition-colors">
                            Dokumentasi
                        </Link>
                        <Link href="/login" className="hover:text-primary-500 transition-colors">
                            Login
                        </Link>
                    </div>

                    <div className="text-xs text-slate-400 text-center md:text-right">
                        <div>{branding?.footerText || `© ${new Date().getFullYear()} ${appName}. All rights reserved.`}</div>
                        {branding?.poweredBy?.show && branding?.poweredBy?.text && (
                            <div className="mt-1 text-[11px] text-slate-500">
                                {branding?.poweredBy?.url ? (
                                    <a href={branding.poweredBy.url} target="_blank" rel="noreferrer" className="hover:underline hover:text-primary-500">
                                        {branding.poweredBy.text}
                                    </a>
                                ) : (
                                    branding.poweredBy.text
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );
}
