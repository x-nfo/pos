import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, usePage } from "@inertiajs/react";
import { IconBuildingStore, IconPalette } from "@tabler/icons-react";
import hasAnyPermission from "@/Utils/Permission";
import StoreTab from "./Tabs/StoreTab";
import BrandingTab from "./Tabs/BrandingTab";

export default function StoreIdentity({ settings, brandingSettings, branding, initialTab = "store" }) {
    const { auth } = usePage().props;
    const canBranding = auth?.super === true && hasAnyPermission(["branding-settings-access"]);
    const canStore = hasAnyPermission(["store-settings-access"]) || auth?.super === true;

    const [activeTab, setActiveTab] = useState(
        canBranding && initialTab === "branding" ? "branding" : "store"
    );

    return (
        <>
            <Head title="Identitas & Branding" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Identitas & Branding
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Atur profil toko dan kustomisasi tampilan aplikasi (White Label).
                    </p>
                </div>

                {/* Tabs Navigation */}
                <div className="flex space-x-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl w-max border border-slate-200 dark:border-slate-800">
                    {canStore && (
                        <button
                            onClick={() => setActiveTab("store")}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                                activeTab === "store"
                                    ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-slate-700"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"
                            }`}
                        >
                            <IconBuildingStore size={18} />
                            Profil Toko
                        </button>
                    )}
                    {canBranding && (
                        <button
                            onClick={() => setActiveTab("branding")}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
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

                {/* Tab Content */}
                <div className="mt-6">
                    {activeTab === "store" && canStore && <StoreTab settings={settings} />}
                    {activeTab === "branding" && canBranding && (
                        <BrandingTab settings={brandingSettings} branding={branding} />
                    )}
                </div>
            </div>
        </>
    );
}

StoreIdentity.layout = (page) => <DashboardLayout children={page} />;
