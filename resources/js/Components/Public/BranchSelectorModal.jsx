import React, { useState } from "react";
import {
    IconMapPin,
    IconX,
    IconSearch,
    IconCheck,
    IconTruckDelivery,
    IconBuildingStore,
    IconPhone,
    IconAlertCircle,
    IconClock,
} from "@tabler/icons-react";

export default function BranchSelectorModal({
    isOpen = false,
    onClose = () => {},
    branches = [],
    activeBranch = null,
    onSelectBranch = () => {},
}) {
    const [search, setSearch] = useState("");

    if (!isOpen) return null;

    const filteredBranches = branches.filter((b) => {
        const query = search.toLowerCase();
        return (
            (b.name && b.name.toLowerCase().includes(query)) ||
            (b.code && b.code.toLowerCase().includes(query)) ||
            (b.address && b.address.toLowerCase().includes(query))
        );
    });

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 border border-slate-200/80 dark:border-slate-800">
                    {/* Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                                <IconMapPin size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                    Pilih Lokasi Cabang
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Pilih cabang terdekat untuk melihat stok & memesan
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                            <IconX size={18} />
                        </button>
                    </div>

                    {/* Search Bar */}
                    {branches.length > 3 && (
                        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <div className="relative">
                                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nama cabang atau alamat..."
                                    className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white transition"
                                />
                            </div>
                        </div>
                    )}

                    {/* Branch List */}
                    <div className="p-3.5 sm:p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredBranches.map((branch) => {
                            const isSelected = activeBranch && String(activeBranch.id) === String(branch.id);

                            return (
                                <div
                                    key={branch.id}
                                    onClick={() => onSelectBranch(branch)}
                                    className={`pt-2.5 first:pt-0 group cursor-pointer`}
                                >
                                    <div
                                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                                            isSelected
                                                ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/30 ring-2 ring-primary-500/20"
                                                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60"
                                        }`}
                                    >
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                                    {branch.name}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    {branch.code}
                                                </span>

                                                {branch.operating_status && (
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            branch.operating_status.status === "open"
                                                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40"
                                                                : branch.operating_status.status === "temporarily_closed"
                                                                ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/40"
                                                                : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/40"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`w-1.5 h-1.5 rounded-full ${
                                                                branch.operating_status.status === "open"
                                                                    ? "bg-emerald-500 animate-pulse"
                                                                    : branch.operating_status.status === "temporarily_closed"
                                                                    ? "bg-rose-500"
                                                                    : "bg-amber-500"
                                                            }`}
                                                        />
                                                        {branch.operating_status.badge_text || (branch.operating_status.is_open ? "Buka" : "Tutup")}
                                                    </span>
                                                )}
                                            </div>

                                            {branch.address && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                                    {branch.address}
                                                </p>
                                            )}

                                            {/* Temporary closure alert note */}
                                            {branch.operating_status?.status === "temporarily_closed" && (
                                                <div className="p-2 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-[11px] text-rose-800 dark:text-rose-300 flex items-start gap-1.5">
                                                    <IconAlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                                                    <div>
                                                        <span className="font-bold">Tutup Sementara:</span>{" "}
                                                        <span>{branch.operating_status.closure_reason || "Sedang libur operasional"}</span>
                                                        {branch.operating_status.reopen_date_formatted && (
                                                            <span className="block text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-semibold">
                                                                Buka kembali: {branch.operating_status.reopen_date_formatted}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                                                {branch.phone && (
                                                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                                        <IconPhone size={12} className="text-emerald-500" />
                                                        {branch.phone}
                                                    </span>
                                                )}
                                                {branch.delivery_enabled ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                                        <IconTruckDelivery size={13} />
                                                        Bisa Antar
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                                        <IconBuildingStore size={13} />
                                                        Ambil di Toko Saja
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="shrink-0 pt-0.5">
                                            {isSelected ? (
                                                <span className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-xs">
                                                    <IconCheck size={14} />
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-primary-50 group-hover:text-primary-600 transition">
                                                    Pilih
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {filteredBranches.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                <IconBuildingStore size={32} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-xs">Tidak ada cabang yang cocok dengan pencarian.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
