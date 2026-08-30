import React from "react";
import { Listbox, Transition } from "@headlessui/react";
import {
    IconBuildingStore,
    IconChevronDown,
    IconCheck,
} from "@tabler/icons-react";

export default function WarehouseSelect({
    warehouses = [],
    selectedId,
    onChange,
    label = "Cabang / Gudang",
    className = "",
    buttonClassName = "",
    size = "md",
}) {
    const selectedWarehouse =
        warehouses.find((w) => String(w.id) === String(selectedId)) ||
        warehouses[0] ||
        null;

    const sizeClasses =
        {
            sm: "h-10 px-3 text-xs rounded-xl",
            md: "h-12 px-3.5 text-sm rounded-2xl",
            lg: "h-14 px-4 text-base rounded-2xl",
        }[size] || "h-12 px-3.5 text-sm rounded-2xl";

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && (
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}
                </label>
            )}

            <div className="relative">
                <Listbox
                    value={selectedWarehouse}
                    onChange={(val) => {
                        if (val?.id) {
                            onChange(val.id);
                        }
                    }}
                >
                    {({ open }) => (
                        <>
                            <Listbox.Button
                                type="button"
                                className={`w-full flex items-center justify-between gap-3 border border-slate-200 bg-slate-50 text-left font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${sizeClasses} ${buttonClassName}`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <IconBuildingStore
                                        size={18}
                                        className="text-primary-500 shrink-0"
                                    />
                                    <span className="truncate">
                                        {selectedWarehouse
                                            ? selectedWarehouse.name
                                            : "Pilih Cabang / Gudang"}
                                    </span>
                                </div>
                                <IconChevronDown
                                    size={18}
                                    className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                                        open ? "rotate-180 text-primary-500" : ""
                                    }`}
                                />
                            </Listbox.Button>

                            <Transition
                                show={open}
                                enter="transition duration-100 ease-out"
                                enterFrom="transform scale-95 opacity-0"
                                enterTo="transform scale-100 opacity-100"
                                leave="transition duration-75 ease-out"
                                leaveFrom="transform scale-100 opacity-100"
                                leaveTo="transform scale-95 opacity-0"
                            >
                                <Listbox.Options className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 focus:outline-none">
                                    {warehouses.map((w) => {
                                        const isSelected =
                                            String(w.id) ===
                                            String(selectedWarehouse?.id);

                                        return (
                                            <Listbox.Option
                                                key={w.id}
                                                value={w}
                                                className={({ active }) =>
                                                    `flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs transition-colors ${
                                                        active
                                                            ? "bg-primary-50 dark:bg-primary-950/50 text-primary-900 dark:text-primary-100"
                                                            : "text-slate-700 dark:text-slate-200"
                                                    } ${
                                                        isSelected
                                                            ? "bg-primary-50/70 dark:bg-primary-950/30 font-bold"
                                                            : "font-medium"
                                                    }`
                                                }
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                                                        {w.code}
                                                    </span>
                                                    <span className="truncate text-xs sm:text-sm">
                                                        {w.name}
                                                    </span>
                                                    {w.type === "main" && (
                                                        <span className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-300 shrink-0">
                                                            Utama
                                                        </span>
                                                    )}
                                                </div>
                                                {isSelected && (
                                                    <IconCheck
                                                        size={16}
                                                        className="text-primary-600 dark:text-primary-400 shrink-0"
                                                    />
                                                )}
                                            </Listbox.Option>
                                        );
                                    })}
                                </Listbox.Options>
                            </Transition>
                        </>
                    )}
                </Listbox>
            </div>
        </div>
    );
}
