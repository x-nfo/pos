import React, { useState, useRef, useEffect } from "react";
import { router } from "@inertiajs/react";
import axios from "axios";
import {
    IconCrown,
    IconUser,
    IconSearch,
    IconCheck,
    IconChevronDown,
    IconUserPlus,
} from "@tabler/icons-react";
import { CustomerHistoryButton } from "./CustomerHistoryPanel";
import AddCustomerModal from "./AddCustomerModal";

export const WALK_IN_CUSTOMER = {
    id: null,
    name: "Pelanggan Umum",
    no_telp: "",
    is_loyalty_member: false,
    is_walk_in: true,
};

export default function CustomerSelect({
    customers = [],
    selected = WALK_IN_CUSTOMER,
    onSelect,
    placeholder = "Pilih pelanggan...",
    error,
    label,
    onCustomerAdded,
    tierOptions = [],
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    const isWalkInMatch =
        !search ||
        "pelanggan umum".includes(search.toLowerCase()) ||
        "umum".includes(search.toLowerCase()) ||
        "walk in".includes(search.toLowerCase()) ||
        "walk-in".includes(search.toLowerCase());

    // Filter customers by search
    const filteredCustomers = customers.filter(
        (customer) =>
            customer.name.toLowerCase().includes(search.toLowerCase()) ||
            customer.no_telp?.toLowerCase().includes(search.toLowerCase()) ||
            customer.member_code?.toLowerCase().includes(search.toLowerCase())
    );

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus search on open
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (customer) => {
        onSelect(customer);
        setIsOpen(false);
        setSearch("");
    };

    const handleAddCustomerSuccess = (newCustomer) => {
        setShowAddModal(false);
        // Reload page data to get updated customer list
        router.reload({ only: ["customers"] });
        onCustomerAdded?.(newCustomer);
        onSelect?.(newCustomer);
    };

    const handleUpgradeMember = async () => {
        if (!selected?.id || selected.is_loyalty_member) {
            return;
        }

        try {
            const response = await axios.post(
                route("customers.upgrade-member", selected.id),
                {
                    loyalty_tier: tierOptions[0]?.value || "regular",
                }
            );

            if (response.data.success) {
                onSelect?.(response.data.customer);
                router.reload({ only: ["customers"] });
            }
        } catch (error) {
            console.error("Upgrade member error:", error);
        }
    };

    const isWalkInSelected = !selected || !selected.id || selected.is_walk_in;

    return (
        <>
            <div ref={containerRef} className="relative">
                {/* Label */}
                {label && (
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {label}
                    </label>
                )}

                {/* Select Button with History and Add */}
                <div className="flex items-center gap-1.5 w-full">
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={`
                            flex-1 min-w-0 h-11 px-2.5 rounded-xl text-left
                            flex items-center gap-2
                            border transition-all duration-200
                            ${
                                isOpen
                                    ? "border-primary-500 ring-2 ring-primary-500/20"
                                    : error
                                    ? "border-danger-500"
                                    : "border-slate-200 dark:border-slate-700"
                            }
                            bg-white dark:bg-slate-900
                        `}
                    >
                        <div
                            className={`
                            w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                            ${
                                selected && !isWalkInSelected
                                    ? "bg-primary-100 dark:bg-primary-900/50"
                                    : "bg-slate-100 dark:bg-slate-800"
                            }
                        `}
                        >
                            <IconUser
                                size={15}
                                className={
                                    selected && !isWalkInSelected
                                        ? "text-primary-600 dark:text-primary-400"
                                        : "text-slate-500 dark:text-slate-400"
                                }
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            {selected ? (
                                <div className="flex items-center justify-between gap-1.5 min-w-0">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                        {selected.name || "Pelanggan Umum"}
                                    </p>
                                    {isWalkInSelected ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex-shrink-0">
                                            Umum
                                        </span>
                                    ) : selected.is_loyalty_member ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 capitalize flex-shrink-0">
                                            {selected.loyalty_tier || "Member"}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex-shrink-0">
                                            Non-member
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                                    {placeholder}
                                </p>
                            )}
                        </div>
                        <IconChevronDown
                            size={16}
                            className={`text-slate-400 flex-shrink-0 transition-transform ${
                                isOpen ? "rotate-180" : ""
                            }`}
                        />
                    </button>

                    {/* History Button - Show only when registered customer is selected */}
                    {selected?.id && (
                        <CustomerHistoryButton
                            customerId={selected.id}
                            customerName={selected.name}
                            className="h-11 w-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 active:scale-95"
                        />
                    )}

                    {selected?.id && !selected.is_loyalty_member ? (
                        <button
                            type="button"
                            onClick={handleUpgradeMember}
                            className="h-11 w-9 flex-shrink-0 rounded-xl border border-primary-200 bg-primary-50 text-primary-600 hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-300 flex items-center justify-center active:scale-95"
                            title="Upgrade pelanggan menjadi member"
                        >
                            <IconCrown size={17} />
                        </button>
                    ) : null}

                    {/* Add Customer Button */}
                    <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="h-11 w-9 flex-shrink-0 rounded-xl border border-dashed border-primary-300 dark:border-primary-700
                            text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30
                            flex items-center justify-center active:scale-95 transition-transform"
                        title="Tambah pelanggan baru"
                    >
                        <IconUserPlus size={17} />
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <p className="mt-1 text-xs text-danger-500">{error}</p>
                )}

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-50 animate-slide-up overflow-hidden">
                        {/* Search */}
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <IconSearch
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nama/telepon/nomor anggota..."
                                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Customer List */}
                        <div className="max-h-60 overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-800/60">
                            {/* Pelanggan Umum / Walk-in option */}
                            {isWalkInMatch && (
                                <button
                                    type="button"
                                    onClick={() => handleSelect(WALK_IN_CUSTOMER)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 text-left
                                        transition-colors
                                        ${
                                            isWalkInSelected
                                                ? "bg-primary-50 dark:bg-primary-950/30"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                        }
                                    `}
                                >
                                    <div
                                        className={`
                                        w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                                        ${
                                            isWalkInSelected
                                                ? "bg-primary-500 text-white"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                        }
                                    `}
                                    >
                                        {isWalkInSelected ? (
                                            <IconCheck size={16} />
                                        ) : (
                                            <IconUser size={18} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                Pelanggan Umum
                                            </p>
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                Walk-in
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            Tanpa data member • Transaksi langsung
                                        </p>
                                    </div>
                                </button>
                            )}

                            {filteredCustomers.length > 0 ? (
                                <ul>
                                    {filteredCustomers.map((customer) => {
                                        const isCustomerSelected = selected?.id === customer.id;
                                        return (
                                            <li key={customer.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSelect(customer)
                                                    }
                                                    className={`
                                                        w-full flex items-center gap-3 px-4 py-3 text-left
                                                        transition-colors
                                                        ${
                                                            isCustomerSelected
                                                                ? "bg-primary-50 dark:bg-primary-950/30"
                                                                : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                                        }
                                                    `}
                                                >
                                                    <div
                                                        className={`
                                                        w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                                                        ${
                                                            isCustomerSelected
                                                                ? "bg-primary-500 text-white"
                                                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                                        }
                                                    `}
                                                    >
                                                        {isCustomerSelected ? (
                                                            <IconCheck size={16} />
                                                        ) : (
                                                            <span className="text-sm font-medium">
                                                                {customer.name
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-0.5">
                                                        <div className="flex items-center justify-between gap-1.5">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                                                {customer.name}
                                                            </p>
                                                            {customer.is_loyalty_member ? (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 capitalize flex-shrink-0">
                                                                    {customer.loyalty_tier || "Member"}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex-shrink-0">
                                                                    Non-member
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Phone & Member Code */}
                                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                            {customer.no_telp && <span>{customer.no_telp}</span>}
                                                            {customer.member_code && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="font-mono">{customer.member_code}</span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Loyalty Points */}
                                                        {customer.is_loyalty_member && (
                                                            <p className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 truncate">
                                                                {customer.loyalty_points || 0} poin
                                                            </p>
                                                        )}
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : !isWalkInMatch ? (
                                <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                                    <IconUser
                                        size={24}
                                        className="mx-auto mb-2 opacity-50"
                                    />
                                    <p className="text-sm">
                                        Pelanggan tidak ditemukan
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsOpen(false);
                                            setShowAddModal(true);
                                        }}
                                        className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-medium"
                                    >
                                        + Tambah pelanggan baru
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Customer Modal */}
            <AddCustomerModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handleAddCustomerSuccess}
                tierOptions={tierOptions}
            />
        </>
    );
}
