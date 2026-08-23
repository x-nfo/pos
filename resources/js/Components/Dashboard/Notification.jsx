import React, { useState, useEffect } from "react";
import { Menu, Transition } from "@headlessui/react";
import {
    IconBell,
    IconCircleCheck,
    IconPackage,
    IconReceipt,
    IconCurrencyDollar,
} from "@tabler/icons-react";
import { usePage, router } from "@inertiajs/react";
import { useHaptic } from "@/Hooks/useHaptic";

export default function Notification() {
    const {
        lowStockNotifications = [],
        receivableNotifications = [],
        payableNotifications = [],
    } = usePage().props;
    const { triggerHaptic } = useHaptic();

    const mapItems = (items) =>
        items.map((item) => ({
            ...item,
            type: item.type || "stock",
            icon:
                item.type === "receivable" ? (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                        <IconReceipt size={17} />
                    </span>
                ) : item.type === "payable" ? (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <IconCurrencyDollar size={17} />
                    </span>
                ) : (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                        <IconPackage size={17} />
                    </span>
                ),
        }));

    const mergeData = () => [
        ...mapItems(
            lowStockNotifications.map((n) => ({
                ...n,
                id: `stock-${n.id}`,
                originalId: n.id,
                title: `Stok habis: ${n.title}`,
                subtitle: `Stok: ${n.stock}`,
                type: "stock",
            }))
        ),
        ...mapItems(
            receivableNotifications.map((n) => ({
                ...n,
                id: `recv-${n.id}`,
                type: "receivable",
            }))
        ),
        ...mapItems(
            payableNotifications.map((n) => ({
                ...n,
                id: `pay-${n.id}`,
                type: "payable",
            }))
        ),
    ];

    const [data, setData] = useState(mergeData());

    // Sync when notifications props change
    useEffect(() => {
        setData(mergeData());
    }, [lowStockNotifications, receivableNotifications, payableNotifications]);

    const handleMarkRead = (id) => {
        setData((prev) => prev.filter((item) => item.id !== id));
        const item = data.find((d) => d.id === id);
        if (item?.type === "stock") {
            router.post(
                route("notifications.stock.read"),
                { product_id: item.originalId || id },
                { preserveScroll: true, preserveState: true }
            );
        }
    };

    const handleMarkAllRead = () => {
        setData([]);
        router.post(
            route("notifications.stock.readAll"),
            {},
            { preserveScroll: true, preserveState: true }
        );
    };

    const badgeCount = data.length;

    const NotificationList = () => (
        <div className="flex flex-col gap-2.5 items-stretch w-full">
            {badgeCount === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                    <IconBell size={32} className="mx-auto mb-2 opacity-25" />
                    <span>Tidak ada notifikasi baru</span>
                </div>
            )}
            {data.map((item) => (
                <div
                    className="flex items-center justify-between gap-3 w-full p-3 sm:p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 hover:border-primary-200 dark:hover:border-primary-800 shadow-2xs transition-all"
                    key={item.id}
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        {item.icon}
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                                {item.title}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs truncate mt-0.5">
                                {item.subtitle} {item.time && `• ${item.time}`}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("light");
                            handleMarkRead(item.id);
                        }}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/50 border border-primary-200/60 dark:border-primary-800/80 active:scale-95 transition-all"
                    >
                        <IconCircleCheck size={14} />
                        <span>Dibaca</span>
                    </button>
                </div>
            ))}
        </div>
    );

    return (
        <Menu className="relative z-50" as="div">
            <Menu.Button
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center relative text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all"
                aria-label="Notifikasi"
                onClick={() => triggerHaptic("tap")}
            >
                {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] px-1 bg-rose-500 text-white text-[9px] sm:text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                        {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                )}
                <IconBell
                    strokeWidth={1.8}
                    size={18}
                    className="text-slate-500 dark:text-slate-400"
                />
            </Menu.Button>
            <Transition
                enter="transition duration-150 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-100 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
            >
                <Menu.Items className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-14 sm:top-auto sm:mt-2 sm:w-[460px] max-w-[calc(100vw-1.5rem)] sm:max-w-lg rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 z-[100] bg-white dark:bg-slate-900 shadow-2xl overflow-hidden focus:outline-none">
                    {/* Header */}
                    <div className="flex justify-between items-center gap-2 p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span>Notifikasi</span>
                            {badgeCount > 0 && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                                    {badgeCount}
                                </span>
                            )}
                        </div>
                        {badgeCount > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("light");
                                    handleMarkAllRead();
                                }}
                                className="text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 transition-all"
                            >
                                Tandai semua dibaca
                            </button>
                        )}
                    </div>

                    {/* Notification Items List */}
                    <div className="p-3 sm:p-4 max-h-[60vh] sm:max-h-[420px] overflow-y-auto dashboard-scrollbar">
                        <NotificationList />
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
}
