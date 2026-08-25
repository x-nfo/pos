import React, { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import Sidebar from "@/Components/Dashboard/Sidebar";
import Navbar from "@/Components/Dashboard/Navbar";
import DashboardBottomNav from "@/Components/Dashboard/DashboardBottomNav";
import MobileAppMenu from "@/Components/Mobile/MobileAppMenu";
import { Toaster, toast } from "react-hot-toast";
import { useTheme } from "@/Context/ThemeSwitcherContext";

export default function AppLayout({ children }) {
    const { darkMode, themeSwitcher } = useTheme();
    const { url } = usePage();
    const { auth, security, flash } = usePage().props;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error, { duration: 5000 });
        if (flash?.warning) toast(flash.warning, { icon: "⚠️" });
        if (flash?.info) toast(flash.info);
    }, [flash]);

    const getInitialSidebarState = () => {
        if (typeof window === "undefined") return false;
        const stored = localStorage.getItem("sidebarOpen");
        if (stored !== null) return stored === "true";
        return window.innerWidth >= 768;
    };

    const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState);
    const [isMobile, setIsMobile] = useState(
        typeof window !== "undefined" ? window.innerWidth < 768 : false
    );

    useEffect(() => {
        localStorage.setItem("sidebarOpen", sidebarOpen);
    }, [sidebarOpen]);

    // Auto-close sidebar on mobile after navigation
    useEffect(() => {
        if (isMobile) {
            setSidebarOpen(false);
        }
    }, [url]);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setSidebarOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const securityWarnings = security?.warnings ?? [];
    const showSecurityWarnings =
        auth?.super === true && securityWarnings.length > 0;

    const isDashboard =
        typeof route === "function" && route().current
            ? route().current("dashboard")
            : url === "/dashboard" || url.startsWith("/dashboard?");

    return (
        <div className="flex h-screen h-[100dvh] overflow-hidden bg-slate-100 dark:bg-slate-950 transition-colors duration-200 touch-action-manipulation">
            {/* Desktop Sidebar (>= 768px) */}
            <Sidebar sidebarOpen={sidebarOpen} />

            {/* Mobile Native App Menu Hub (< 768px) */}
            <MobileAppMenu
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <main className="dashboard-scrollbar flex-1 overflow-y-auto overscroll-contain flex flex-col">
                    <Navbar
                        toggleSidebar={toggleSidebar}
                        themeSwitcher={themeSwitcher}
                        darkMode={darkMode}
                        isDashboard={isDashboard}
                    />
                    <div className="w-full py-4 md:py-6 px-4 md:px-6 lg:px-8 pb-36 sm:pb-32 md:pb-8 flex-1">
                        {showSecurityWarnings && (
                            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                                <p className="text-sm font-semibold">
                                    Production security baseline warning
                                </p>
                                <ul className="mt-2 space-y-1 text-sm">
                                    {securityWarnings.map((warning) => (
                                        <li key={warning.key}>
                                            - {warning.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <Toaster
                            position="top-right"
                            toastOptions={{
                                className: "text-sm",
                                duration: 3000,
                                style: {
                                    background: darkMode ? "#1e293b" : "#fff",
                                    color: darkMode ? "#f1f5f9" : "#1e293b",
                                    border: `1px solid ${
                                        darkMode ? "#334155" : "#e2e8f0"
                                    }`,
                                    borderRadius: "12px",
                                },
                            }}
                        />
                        {children}
                    </div>
                </main>

                {/* Native Bottom Navigation for Mobile */}
                <DashboardBottomNav
                    toggleSidebar={toggleSidebar}
                    sidebarOpen={sidebarOpen}
                />
            </div>
        </div>
    );
}
