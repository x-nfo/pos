import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, usePage } from "@inertiajs/react";
import { IconBuildingStore, IconPalette, IconSparkles } from "@tabler/icons-react";
import hasAnyPermission from "@/Utils/Permission";
import StoreTab from "./Tabs/StoreTab";
import BrandingTab from "./Tabs/BrandingTab";
import PromoBannersTab from "./Tabs/PromoBannersTab";

export default function StoreIdentity({
    settings,
    brandingSettings,
    branding,
    promoBanners = [],
    categories = [],
    initialTab = "store",
}) {
    const { auth } = usePage().props;
    const isSuperAdmin = auth?.super === true;
    const canBranding = isSuperAdmin && hasAnyPermission(["branding-settings-access"]);
    const canStore = hasAnyPermission(["store-settings-access"]) || isSuperAdmin;

    const [activeTab, setActiveTab] = useState(
        initialTab === "promo-banners"
            ? "promo-banners"
            : canBranding && initialTab === "branding"
            ? "branding"
            : "store"
    );

    const getPageTitle = () => {
        if (activeTab === "promo-banners") return "Banner Promo Katalog";
        if (canBranding && activeTab === "branding") return "Branding & Tema";
        return "Profil Toko";
    };

    return (
        <>
            <Head title={getPageTitle()} />

            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {getPageTitle()}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {activeTab === "promo-banners"
                                ? "Unggah dan kelola gambar banner slider promosi untuk halaman katalog toko online."
                                : canBranding && activeTab === "branding"
                                ? "Kustomisasi nama brand, logo, favicon, dan palet warna White-Label."
                                : "Kelola informasi profil usaha, alamat, dan logo pada nota/laporan."}
                        </p>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="flex flex-wrap gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl w-max border border-slate-200 dark:border-slate-800">
                        {canStore && (
                            <button
                                onClick={() => setActiveTab("store")}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                    activeTab === "store"
                                        ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-slate-700"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"
                                }`}
                            >
                                <IconBuildingStore size={18} />
                                Profil Toko
                            </button>
                        )}

                        <button
                            onClick={() => setActiveTab("promo-banners")}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                activeTab === "promo-banners"
                                    ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-slate-700"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"
                            }`}
                        >
                            <IconSparkles size={18} />
                            Banner Promo
                        </button>

                        {canBranding && (
                            <button
                                onClick={() => setActiveTab("branding")}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                    activeTab === "branding"
                                        ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-slate-700"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"
                                }`}
                            >
                                <IconPalette size={18} />
                                Branding & Tema
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Content */}
                <div>
                    {activeTab === "store" && canStore && <StoreTab settings={settings} />}
                    {activeTab === "promo-banners" && (
                        <PromoBannersTab
                            settings={settings}
                            promoBanners={promoBanners}
                            categories={categories}
                        />
                    )}
                    {activeTab === "branding" && canBranding && (
                        <BrandingTab settings={brandingSettings} branding={branding} />
                    )}
                </div>
            </div>
        </>
    );
}

StoreIdentity.layout = (page) => <DashboardLayout children={page} />;
