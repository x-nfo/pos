import React, { useState, useMemo } from 'react';
import {
    IconSearch,
    IconX,
    IconChecks,
    IconCheck,
    IconShield,
    IconShieldCheck,
    IconLayoutDashboard,
    IconReportAnalytics,
    IconCoins,
    IconHistory,
    IconShoppingCart,
    IconClockPlay,
    IconToolsKitchen2,
    IconToolsKitchen,
    IconPercentage,
    IconReceiptRefund,
    IconPackage,
    IconCategory,
    IconTags,
    IconListNumbers,
    IconUsers,
    IconTicket,
    IconUsersGroup,
    IconSpeakerphone,
    IconBellRinging,
    IconArrowsExchange,
    IconClipboardCheck,
    IconTruckLoading,
    IconBuildingWarehouse,
    IconBuildingStore,
    IconFileInvoice,
    IconTruckDelivery,
    IconArrowBackUp,
    IconReceiptTax,
    IconCreditCard,
    IconUser,
    IconUserShield,
    IconKey,
    IconPrinter,
    IconAward,
    IconTarget,
    IconBrandWhatsapp,
    IconCash,
    IconFilter,
} from '@tabler/icons-react';

// Module metadata mapping for icons and titles
const MODULE_CONFIG = {
    dashboard: {
        category: 'Dashboard & Laporan',
        icon: IconLayoutDashboard,
        title: 'Dashboard Utama',
    },
    reports: {
        category: 'Dashboard & Laporan',
        icon: IconReportAnalytics,
        title: 'Laporan Penjualan',
    },
    profits: {
        category: 'Dashboard & Laporan',
        icon: IconCoins,
        title: 'Laporan Keuntungan',
    },
    'audit-logs': {
        category: 'Dashboard & Laporan',
        icon: IconHistory,
        title: 'Audit Log Aktivitas',
    },
    transactions: {
        category: 'Penjualan & Kasir',
        icon: IconShoppingCart,
        title: 'Transaksi POS',
    },
    'cashier-shifts': {
        category: 'Penjualan & Kasir',
        icon: IconClockPlay,
        title: 'Shift Kasir',
    },
    'dine-tables': {
        category: 'Penjualan & Kasir',
        icon: IconToolsKitchen2,
        title: 'Dine-In: Meja',
    },
    'dine-orders': {
        category: 'Penjualan & Kasir',
        icon: IconToolsKitchen,
        title: 'Dine-In: Pesanan',
    },
    discounts: {
        category: 'Penjualan & Kasir',
        icon: IconPercentage,
        title: 'Approval Diskon',
    },
    'sales-returns': {
        category: 'Penjualan & Kasir',
        icon: IconReceiptRefund,
        title: 'Retur Penjualan',
    },
    products: {
        category: 'Produk & Katalog',
        icon: IconPackage,
        title: 'Master Produk',
    },
    categories: {
        category: 'Produk & Katalog',
        icon: IconCategory,
        title: 'Kategori Produk',
    },
    'pricing-rules': {
        category: 'Produk & Katalog',
        icon: IconTags,
        title: 'Aturan Harga Grosir/Bertingkat',
    },
    'price-lists': {
        category: 'Produk & Katalog',
        icon: IconListNumbers,
        title: 'Daftar Harga Khusus',
    },
    customers: {
        category: 'Pelanggan & CRM',
        icon: IconUsers,
        title: 'Data Pelanggan',
    },
    'customer-vouchers': {
        category: 'Pelanggan & CRM',
        icon: IconTicket,
        title: 'Voucher & Diskon Pelanggan',
    },
    'customer-segments': {
        category: 'Pelanggan & CRM',
        icon: IconUsersGroup,
        title: 'Segmentasi Pelanggan',
    },
    'crm-campaigns': {
        category: 'Pelanggan & CRM',
        icon: IconSpeakerphone,
        title: 'Kampanye Promo CRM',
    },
    'crm-reminders': {
        category: 'Pelanggan & CRM',
        icon: IconBellRinging,
        title: 'Pengingat Otomatis CRM',
    },
    'stock-mutations': {
        category: 'Inventori & Stok',
        icon: IconArrowsExchange,
        title: 'Riwayat Mutasi Stok',
    },
    'stock-opnames': {
        category: 'Inventori & Stok',
        icon: IconClipboardCheck,
        title: 'Stok Opname',
    },
    'stock-transfers': {
        category: 'Inventori & Stok',
        icon: IconTruckLoading,
        title: 'Transfer Antar Gudang',
    },
    warehouses: {
        category: 'Inventori & Stok',
        icon: IconBuildingWarehouse,
        title: 'Master Gudang',
    },
    suppliers: {
        category: 'Pembelian & Supplier',
        icon: IconBuildingStore,
        title: 'Data Supplier',
    },
    'purchase-orders': {
        category: 'Pembelian & Supplier',
        icon: IconFileInvoice,
        title: 'Purchase Order (PO)',
    },
    'goods-receivings': {
        category: 'Pembelian & Supplier',
        icon: IconTruckDelivery,
        title: 'Penerimaan Barang (GR)',
    },
    'supplier-returns': {
        category: 'Pembelian & Supplier',
        icon: IconArrowBackUp,
        title: 'Retur ke Supplier',
    },
    receivables: {
        category: 'Keuangan & Hutang-Piutang',
        icon: IconReceiptTax,
        title: 'Piutang Usaha',
    },
    payables: {
        category: 'Keuangan & Hutang-Piutang',
        icon: IconCreditCard,
        title: 'Hutang Usaha',
    },
    users: {
        category: 'Pengguna & Otorisasi',
        icon: IconUser,
        title: 'Manajemen Pengguna',
    },
    roles: {
        category: 'Pengguna & Otorisasi',
        icon: IconUserShield,
        title: 'Akses Group / Roles',
    },
    permissions: {
        category: 'Pengguna & Otorisasi',
        icon: IconKey,
        title: 'Kelola Hak Akses',
    },
    'store-settings': {
        category: 'Pengaturan Sistem',
        icon: IconBuildingStore,
        title: 'Pengaturan Toko & Brand',
    },
    'payment-settings': {
        category: 'Pengaturan Sistem',
        icon: IconCash,
        title: 'Metode Pembayaran',
    },
    'printer-settings': {
        category: 'Pengaturan Sistem',
        icon: IconPrinter,
        title: 'Printer & Struk',
    },
    'loyalty-settings': {
        category: 'Pengaturan Sistem',
        icon: IconAward,
        title: 'Loyalty & Poin',
    },
    'target-settings': {
        category: 'Pengaturan Sistem',
        icon: IconTarget,
        title: 'Target Penjualan',
    },
    'whatsapp-settings': {
        category: 'Pengaturan Sistem',
        icon: IconBrandWhatsapp,
        title: 'Integrasi WhatsApp',
    },
};

// Friendly labels for permission actions
const ACTION_LABELS = {
    access: 'Lihat / Akses',
    create: 'Tambah',
    edit: 'Ubah',
    update: 'Ubah / Edit',
    delete: 'Hapus',
    import: 'Impor Data',
    export: 'Ekspor Data',
    pay: 'Proses Bayar',
    approve: 'Setujui (Approve)',
    complete: 'Selesaikan',
    finalize: 'Finalisasi',
    send: 'Kirim',
    receive: 'Terima',
    cancel: 'Batalkan',
    process: 'Proses Pesanan',
    open: 'Buka Shift',
    close: 'Tutup Shift',
    'force-close': 'Tutup Paksa',
    'confirm-payment': 'Konfirmasi Pembayaran',
};

// Helper to determine module key from permission name
function getModuleKey(permissionName) {
    if (MODULE_CONFIG[permissionName]) {
        return permissionName;
    }

    const matchedKey = Object.keys(MODULE_CONFIG)
        .sort((a, b) => b.length - a.length)
        .find((key) => permissionName.startsWith(`${key}-`) || permissionName === key);

    if (matchedKey) return matchedKey;

    const parts = permissionName.split('-');
    if (parts.length > 1) {
        return parts.slice(0, -1).join('-');
    }

    return 'other';
}

// Helper to format human-friendly label
function formatActionLabel(permissionName, moduleKey) {
    let actionKey = permissionName;
    if (moduleKey && permissionName.startsWith(`${moduleKey}-`)) {
        actionKey = permissionName.slice(moduleKey.length + 1);
    } else {
        const parts = permissionName.split('-');
        actionKey = parts[parts.length - 1];
    }

    return ACTION_LABELS[actionKey] || actionKey.replace(/-/g, ' ');
}

export default function ListBox({ selected = [], data = [], setSelected, label, errors }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'selected', or category name

    // Helper to test if item is selected
    const isItemSelected = (item) => {
        return selected.some((s) => (typeof s === 'object' ? s.id === item.id : s === item.id));
    };

    // Toggle single permission
    const togglePermission = (item) => {
        if (isItemSelected(item)) {
            setSelected(
                selected.filter((s) => (typeof s === 'object' ? s.id !== item.id : s !== item.id))
            );
        } else {
            setSelected([...selected, item]);
        }
    };

    // Select all available
    const handleSelectAll = () => {
        setSelected([...data]);
    };

    // Deselect all
    const handleDeselectAll = () => {
        setSelected([]);
    };

    // Grouping logic
    const groupedModules = useMemo(() => {
        const groups = {};

        data.forEach((item) => {
            const modKey = getModuleKey(item.name);
            const conf = MODULE_CONFIG[modKey] || {
                category: 'Lainnya',
                icon: IconShield,
                title: modKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            };

            const categoryName = conf.category || 'Lainnya';

            if (!groups[categoryName]) {
                groups[categoryName] = {};
            }

            if (!groups[categoryName][modKey]) {
                groups[categoryName][modKey] = {
                    key: modKey,
                    title: conf.title || modKey,
                    icon: conf.icon || IconShield,
                    category: categoryName,
                    items: [],
                };
            }

            groups[categoryName][modKey].items.push(item);
        });

        return groups;
    }, [data]);

    // Categories list for tab filter
    const categories = useMemo(() => {
        return ['all', 'selected', ...Object.keys(groupedModules)];
    }, [groupedModules]);

    // Filtered data based on search and tab
    const filteredGroups = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const result = {};

        Object.entries(groupedModules).forEach(([categoryName, modulesObj]) => {
            if (activeTab !== 'all' && activeTab !== 'selected' && activeTab !== categoryName) {
                return;
            }

            const matchedModules = {};

            Object.entries(modulesObj).forEach(([modKey, modData]) => {
                const filteredItems = modData.items.filter((item) => {
                    if (activeTab === 'selected' && !isItemSelected(item)) {
                        return false;
                    }

                    if (!query) return true;

                    const matchName = item.name.toLowerCase().includes(query);
                    const matchModule = modData.title.toLowerCase().includes(query);
                    const matchAction = formatActionLabel(item.name, modKey).toLowerCase().includes(query);

                    return matchName || matchModule || matchAction;
                });

                if (filteredItems.length > 0) {
                    matchedModules[modKey] = {
                        ...modData,
                        items: filteredItems,
                    };
                }
            });

            if (Object.keys(matchedModules).length > 0) {
                result[categoryName] = matchedModules;
            }
        });

        return result;
    }, [groupedModules, searchQuery, activeTab, selected]);

    // Toggle all in module
    const toggleModule = (items) => {
        const allSelected = items.every((item) => isItemSelected(item));
        if (allSelected) {
            const itemIds = new Set(items.map((i) => i.id));
            setSelected(
                selected.filter((s) => {
                    const id = typeof s === 'object' ? s.id : s;
                    return !itemIds.has(id);
                })
            );
        } else {
            const currentSelectedMap = new Map(
                selected.map((s) => [typeof s === 'object' ? s.id : s, s])
            );
            items.forEach((item) => {
                if (!currentSelectedMap.has(item.id)) {
                    currentSelectedMap.set(item.id, item);
                }
            });
            setSelected(Array.from(currentSelectedMap.values()));
        }
    };

    const totalSelected = selected.length;
    const totalPermissions = data.length;
    const progressPercent = totalPermissions ? Math.round((totalSelected / totalPermissions) * 100) : 0;

    return (
        <div className="flex flex-col gap-2">
            {/* Header & Stats */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                <div>
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <IconShieldCheck size={18} className="text-primary-500" />
                        {label || 'Hak Akses Role'}
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pilih hak akses yang diizinkan untuk group/role ini.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60">
                        <IconCheck size={14} className="text-primary-500 stroke-[3]" />
                        {totalSelected} / {totalPermissions} Terpilih ({progressPercent}%)
                    </span>
                </div>
            </div>

            {/* Main Interactive Box */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                {/* Search Bar & Quick Actions Toolbar */}
                <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <IconSearch
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
                                size={16}
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari hak akses, modul, atau aksi..."
                                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded-md"
                                >
                                    <IconX size={14} />
                                </button>
                            )}
                        </div>

                        {/* Bulk Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="px-3 py-2 text-xs font-semibold rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60 hover:bg-primary-100 dark:hover:bg-primary-900/50 active:scale-95 transition-all flex items-center gap-1.5"
                                title="Pilih Semua Hak Akses"
                            >
                                <IconChecks size={15} />
                                <span>Pilih Semua</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleDeselectAll}
                                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-1.5"
                                title="Kosongkan Pilihan"
                            >
                                <IconX size={15} />
                                <span>Kosongkan</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Category Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                        <button
                            type="button"
                            onClick={() => setActiveTab('all')}
                            className={`px-3 py-1 rounded-lg font-medium transition-all shrink-0 select-none ${
                                activeTab === 'all'
                                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            Semua ({totalPermissions})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('selected')}
                            className={`px-3 py-1 rounded-lg font-medium transition-all shrink-0 flex items-center gap-1 select-none ${
                                activeTab === 'selected'
                                    ? 'bg-primary-600 text-white shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            <IconCheck size={13} className="stroke-[3]" />
                            Terpilih ({totalSelected})
                        </button>
                        {Object.keys(groupedModules).map((catName) => {
                            const catTotal = Object.values(groupedModules[catName]).reduce(
                                (acc, curr) => acc + curr.items.length,
                                0
                            );
                            const catSelected = Object.values(groupedModules[catName]).reduce(
                                (acc, curr) =>
                                    acc + curr.items.filter((it) => isItemSelected(it)).length,
                                0
                            );

                            return (
                                <button
                                    key={catName}
                                    type="button"
                                    onClick={() => setActiveTab(catName)}
                                    className={`px-3 py-1 rounded-lg font-medium transition-all shrink-0 select-none ${
                                        activeTab === catName
                                            ? 'bg-primary-500 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {catName} ({catSelected}/{catTotal})
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Permissions Content Area */}
                <div className="p-3 sm:p-4 max-h-[58vh] overflow-y-auto space-y-6 scrollbar-thin">
                    {Object.keys(filteredGroups).length > 0 ? (
                        Object.entries(filteredGroups).map(([categoryName, modulesObj]) => (
                            <div key={categoryName} className="space-y-3">
                                {/* Category Section Header */}
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        {categoryName}
                                    </h3>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                                </div>

                                {/* Modules in this category */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    {Object.entries(modulesObj).map(([modKey, modData]) => {
                                        const ModuleIcon = modData.icon || IconShield;
                                        const selectedCount = modData.items.filter((it) =>
                                            isItemSelected(it)
                                        ).length;
                                        const isAllSelected =
                                            modData.items.length > 0 &&
                                            selectedCount === modData.items.length;
                                        const isPartial =
                                            selectedCount > 0 &&
                                            selectedCount < modData.items.length;

                                        return (
                                            <div
                                                key={modKey}
                                                className={`rounded-2xl border transition-all duration-200 p-3.5 bg-white dark:bg-slate-900 ${
                                                    selectedCount > 0
                                                        ? 'border-slate-300 dark:border-slate-700 shadow-xs'
                                                        : 'border-slate-200/80 dark:border-slate-800/80 opacity-90'
                                                }`}
                                            >
                                                {/* Module Card Header */}
                                                <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div
                                                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                                selectedCount > 0
                                                                    ? 'bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                            }`}
                                                        >
                                                            <ModuleIcon size={18} strokeWidth={1.8} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                                {modData.title}
                                                            </h4>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                {selectedCount} dari {modData.items.length} terpilih
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Quick select/deselect module button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleModule(modData.items)}
                                                        className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors shrink-0 ${
                                                            isAllSelected
                                                                ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                                                                : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/50'
                                                        }`}
                                                    >
                                                        {isAllSelected ? 'Batal' : 'Pilih Semua'}
                                                    </button>
                                                </div>

                                                {/* Permission Action Badges / Checkboxes */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                    {modData.items.map((item) => {
                                                        const active = isItemSelected(item);
                                                        const actionLabel = formatActionLabel(item.name, modKey);

                                                        return (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() => togglePermission(item)}
                                                                className={`group relative flex items-start gap-2.5 p-2 rounded-xl text-left border transition-all select-none cursor-pointer ${
                                                                    active
                                                                        ? 'bg-primary-50/70 dark:bg-primary-950/40 border-primary-300 dark:border-primary-700/80 text-slate-900 dark:text-white shadow-xs'
                                                                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/80'
                                                                }`}
                                                            >
                                                                {/* Checkbox box */}
                                                                <div
                                                                    className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center shrink-0 transition-all ${
                                                                        active
                                                                            ? 'bg-primary-500 text-white shadow-xs ring-2 ring-primary-500/20'
                                                                            : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 group-hover:border-slate-400 dark:group-hover:border-slate-500'
                                                                    }`}
                                                                >
                                                                    {active && (
                                                                        <IconCheck
                                                                            size={12}
                                                                            className="stroke-[3]"
                                                                        />
                                                                    )}
                                                                </div>

                                                                {/* Label details */}
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-xs font-semibold leading-snug text-slate-800 dark:text-slate-200 truncate">
                                                                        {actionLabel}
                                                                    </div>
                                                                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate opacity-80">
                                                                        {item.name}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                                <IconSearch size={24} />
                            </div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Tidak ada hak akses ditemukan
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                                Coba kata kunci pencarian lain atau ganti tab filter kategori di atas.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {errors && (
                <div className="flex items-center gap-1.5 text-xs text-rose-500 mt-1">
                    <span>{errors}</span>
                </div>
            )}
        </div>
    );
}
