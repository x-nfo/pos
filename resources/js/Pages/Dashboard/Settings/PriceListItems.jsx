import React, { useState, useMemo } from "react";
import { Head, Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Modal from "@/Components/Dashboard/Modal";
import {
    IconArrowLeft,
    IconTrash,
    IconPlus,
    IconPencil,
    IconSearch,
    IconFilter,
    IconCheck,
    IconX,
    IconPercentage,
    IconCalculator,
    IconSparkles,
    IconDeviceFloppy,
    IconRotate,
    IconTag,
    IconLayersLinked,
    IconPackage,
    IconArrowUpRight,
    IconArrowDownRight,
    IconCheckbox,
} from "@tabler/icons-react";
import { usePasswordConfirmation } from "@/Context/PasswordConfirmationContext";
import toast from "react-hot-toast";

const formatCurrency = (val = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(val) || 0);

const formatNumber = (val = 0) => Number(val || 0).toLocaleString("id-ID");

const resolveRoute = (name, params, fallback) => {
    try {
        return typeof route === "function" ? (params !== undefined ? route(name, params) : route(name)) : fallback;
    } catch {
        return fallback;
    }
};

export default function PriceListItems({ priceList, products = [], categories = [] }) {
    const { requirePasswordConfirmation } = usePasswordConfirmation();

    // Active tab: 'items' (Item Terdaftar) or 'catalog' (Katalog & Bulk)
    const [activeTab, setActiveTab] = useState("items");

    // Search and filters for Tab 1 (Items in price list)
    const [itemsSearch, setItemsSearch] = useState("");
    const [itemsCategory, setItemsCategory] = useState("all");
    const [selectedItemProductIds, setSelectedItemProductIds] = useState([]);

    // Search and filters for Tab 2 (All products catalog)
    const [catalogSearch, setCatalogSearch] = useState("");
    const [catalogCategory, setCatalogCategory] = useState("all");
    const [catalogStatus, setCatalogStatus] = useState("all"); // 'all' | 'priced' | 'unpriced'
    const [selectedCatalogProductIds, setSelectedCatalogProductIds] = useState([]);

    // Bulk formula generator state for Tab 2
    const [bulkFormulaType, setBulkFormulaType] = useState("discount_percent"); // 'discount_percent' | 'markup_hpp' | 'fixed_discount' | 'fixed_price'
    const [bulkFormulaValue, setBulkFormulaValue] = useState(10);

    // Staged custom prices in Catalog Tab: { [productId]: number }
    const [stagedPrices, setStagedPrices] = useState({});

    // Single product edit / add modal
    const [modalProduct, setModalProduct] = useState(null);
    const [modalPrice, setModalPrice] = useState("");

    // Map of existing items by product_id
    const existingItemsMap = useMemo(() => {
        const map = new Map();
        (priceList.items || []).forEach((item) => {
            map.set(Number(item.product_id), item);
        });
        return map;
    }, [priceList.items]);

    // Filtered items in Tab 1
    const filteredItems = useMemo(() => {
        return (priceList.items || []).filter((item) => {
            const prod = item.product || {};
            const matchesSearch =
                !itemsSearch ||
                (prod.title || "").toLowerCase().includes(itemsSearch.toLowerCase()) ||
                (prod.sku || "").toLowerCase().includes(itemsSearch.toLowerCase()) ||
                (prod.barcode || "").toLowerCase().includes(itemsSearch.toLowerCase());

            const matchesCategory =
                itemsCategory === "all" || String(prod.category_id) === String(itemsCategory);

            return matchesSearch && matchesCategory;
        });
    }, [priceList.items, itemsSearch, itemsCategory]);

    // Filtered products in Tab 2 (Catalog)
    const filteredCatalog = useMemo(() => {
        return products.filter((prod) => {
            const matchesSearch =
                !catalogSearch ||
                (prod.title || "").toLowerCase().includes(catalogSearch.toLowerCase()) ||
                (prod.sku || "").toLowerCase().includes(catalogSearch.toLowerCase()) ||
                (prod.barcode || "").toLowerCase().includes(catalogSearch.toLowerCase());

            const matchesCategory =
                catalogCategory === "all" || String(prod.category_id) === String(catalogCategory);

            const isPriced = existingItemsMap.has(prod.id);
            const matchesStatus =
                catalogStatus === "all" ||
                (catalogStatus === "priced" && isPriced) ||
                (catalogStatus === "unpriced" && !isPriced);

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [products, catalogSearch, catalogCategory, catalogStatus, existingItemsMap]);

    // Single modal handler
    const openSinglePriceModal = (product, currentPrice = null) => {
        setModalProduct(product);
        const existingItem = existingItemsMap.get(product.id);
        const initial =
            currentPrice !== null
                ? currentPrice
                : existingItem
                ? existingItem.price
                : product.sell_price;
        setModalPrice(String(initial || 0));
    };

    const closeSinglePriceModal = () => {
        setModalProduct(null);
        setModalPrice("");
    };

    const handleSaveSinglePrice = (e) => {
        e?.preventDefault?.();
        if (!modalProduct) return;

        const numPrice = Math.max(0, parseInt(String(modalPrice).replace(/[^\d]/g, ""), 10) || 0);

        requirePasswordConfirmation({
            title: "Konfirmasi Simpan Harga Produk",
            description: `Simpan harga ${formatCurrency(numPrice)} untuk "${modalProduct.title}" pada price list ini?`,
            challenge: "Simpan Harga Produk",
            onConfirmed: () => {
                router.post(
                    resolveRoute(
                        "price-lists.items.update",
                        priceList.id,
                        `/dashboard/settings/price-lists/${priceList.id}/items`
                    ),
                    { product_id: modalProduct.id, price: numPrice },
                    {
                        onSuccess: () => {
                            closeSinglePriceModal();
                            setStagedPrices((prev) => {
                                const next = { ...prev };
                                delete next[modalProduct.id];
                                return next;
                            });
                        },
                    }
                );
            },
        });
    };

    // Single item delete
    const handleDeleteSingleItem = (item) => {
        const prodTitle = item.product?.title || "produk ini";
        if (!confirm(`Hapus harga khusus "${prodTitle}" dari price list?`)) return;

        requirePasswordConfirmation({
            title: "Konfirmasi Hapus Item Price List",
            description: `Hapus harga khusus untuk ${prodTitle} dari price list ${priceList.name}?`,
            challenge: "Hapus Item Price List",
            onConfirmed: () => {
                router.delete(
                    resolveRoute(
                        "price-lists.items.destroy",
                        [priceList.id, item.product_id],
                        `/dashboard/settings/price-lists/${priceList.id}/items/${item.product_id}`
                    ),
                    {
                        onSuccess: () => {
                            setSelectedItemProductIds((prev) => prev.filter((id) => id !== item.product_id));
                        },
                    }
                );
            },
        });
    };

    // Bulk delete items in Tab 1
    const handleBulkDeleteItems = () => {
        if (selectedItemProductIds.length === 0) return;
        if (!confirm(`Hapus ${selectedItemProductIds.length} item terpilih dari price list?`)) return;

        requirePasswordConfirmation({
            title: "Konfirmasi Hapus Massal Item Price List",
            description: `Hapus ${selectedItemProductIds.length} produk dari price list ${priceList.name}?`,
            challenge: "Hapus Massal Item",
            onConfirmed: () => {
                router.delete(
                    resolveRoute(
                        "price-lists.items.bulk-destroy",
                        priceList.id,
                        `/dashboard/settings/price-lists/${priceList.id}/items/bulk`
                    ),
                    {
                        data: { product_ids: selectedItemProductIds },
                        onSuccess: () => {
                            setSelectedItemProductIds([]);
                        },
                    }
                );
            },
        });
    };

    // Bulk Formula Calculator for Tab 2
    const applyBulkFormula = () => {
        if (selectedCatalogProductIds.length === 0) {
            toast.error("Pilih setidaknya 1 produk dari daftar terlebih dahulu.");
            return;
        }

        const val = Number(bulkFormulaValue) || 0;
        const newStaged = { ...stagedPrices };

        products
            .filter((p) => selectedCatalogProductIds.includes(p.id))
            .forEach((p) => {
                let computed = Number(p.sell_price) || 0;
                const buyPrice = Number(p.buy_price) || 0;
                const sellPrice = Number(p.sell_price) || 0;

                if (bulkFormulaType === "discount_percent") {
                    computed = Math.round(sellPrice * (1 - val / 100));
                } else if (bulkFormulaType === "markup_hpp") {
                    computed = Math.round(buyPrice * (1 + val / 100));
                } else if (bulkFormulaType === "fixed_discount") {
                    computed = Math.max(0, sellPrice - val);
                } else if (bulkFormulaType === "fixed_price") {
                    computed = Math.max(0, val);
                }

                newStaged[p.id] = Math.max(0, computed);
            });

        setStagedPrices(newStaged);
        toast.success(`Formula diterapkan ke ${selectedCatalogProductIds.length} produk.`);
    };

    const handleResetStaged = () => {
        setStagedPrices({});
        toast("Perubahan harga katalog direset.", { icon: "🔄" });
    };

    // Save All Staged Changes (Bulk Update)
    const handleSaveBulkStaged = () => {
        const entries = Object.entries(stagedPrices);
        if (entries.length === 0) {
            toast.error("Belum ada perubahan harga untuk disimpan.");
            return;
        }

        const items = entries.map(([prodId, price]) => ({
            product_id: Number(prodId),
            price: Number(price),
        }));

        requirePasswordConfirmation({
            title: "Konfirmasi Simpan Massal Price List",
            description: `Simpan ${items.length} harga produk ke dalam price list ${priceList.name}?`,
            challenge: "Simpan Massal Price List",
            onConfirmed: () => {
                router.post(
                    resolveRoute(
                        "price-lists.items.bulk-update",
                        priceList.id,
                        `/dashboard/settings/price-lists/${priceList.id}/items/bulk`
                    ),
                    { items },
                    {
                        onSuccess: () => {
                            setStagedPrices({});
                            setSelectedCatalogProductIds([]);
                            setActiveTab("items");
                        },
                    }
                );
            },
        });
    };

    // Toggle Select All for Tab 1
    const toggleSelectAllItems = () => {
        if (selectedItemProductIds.length === filteredItems.length && filteredItems.length > 0) {
            setSelectedItemProductIds([]);
        } else {
            setSelectedItemProductIds(filteredItems.map((i) => i.product_id));
        }
    };

    // Toggle Select All for Tab 2
    const toggleSelectAllCatalog = () => {
        if (selectedCatalogProductIds.length === filteredCatalog.length && filteredCatalog.length > 0) {
            setSelectedCatalogProductIds([]);
        } else {
            setSelectedCatalogProductIds(filteredCatalog.map((p) => p.id));
        }
    };

    // Calculate summary statistics
    const stats = useMemo(() => {
        const totalItems = priceList.items?.length || 0;
        const totalProducts = products.length || 0;
        const coveragePct = totalProducts > 0 ? Math.round((totalItems / totalProducts) * 100) : 0;

        let totalDiscountNominal = 0;
        let discountedCount = 0;

        (priceList.items || []).forEach((item) => {
            const normal = Number(item.product?.sell_price) || 0;
            const plPrice = Number(item.price) || 0;
            if (normal > plPrice) {
                totalDiscountNominal += normal - plPrice;
                discountedCount++;
            }
        });

        const avgDiscount =
            discountedCount > 0 ? Math.round(totalDiscountNominal / discountedCount) : 0;

        return { totalItems, totalProducts, coveragePct, avgDiscount, discountedCount };
    }, [priceList.items, products]);

    const stagedCount = Object.keys(stagedPrices).length;

    return (
        <>
            <Head title={`Kelola Item: ${priceList.name}`} />
            <div className="space-y-6">
                {/* Header & Breadcrumb */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <Link
                            href={resolveRoute("price-lists.index", undefined, "/dashboard/settings/price-lists")}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                            title="Kembali ke Daftar Price List"
                        >
                            <IconArrowLeft size={20} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {priceList.name}
                                </h1>
                                <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    {priceList.slug}
                                </span>
                                {priceList.is_active ? (
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                        Aktif
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                        Nonaktif
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Prioritas {priceList.priority} • Scope:{" "}
                                <strong className="text-slate-700 dark:text-slate-300">
                                    {priceList.customer_scope}
                                </strong>
                                {priceList.segment && ` (${priceList.segment.name})`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab("catalog")}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer shadow-sm ${
                                activeTab === "catalog"
                                    ? "bg-primary-600 text-white shadow-primary-500/20"
                                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            <IconSparkles size={18} /> Katalog & Bulk Input
                        </button>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-medium text-slate-500">Produk di Price List</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                            {stats.totalItems}{" "}
                            <span className="text-xs font-normal text-slate-400">
                                / {stats.totalProducts} produk
                            </span>
                        </p>
                        <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-primary-500 h-full rounded-full transition-all"
                                style={{ width: `${stats.coveragePct}%` }}
                            />
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-medium text-slate-500">Cakupan Katalog</p>
                        <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">
                            {stats.coveragePct}%
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">dari total produk toko</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-medium text-slate-500">Item Dapat Diskon</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            {stats.discountedCount}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">harga di bawah normal</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-medium text-slate-500">Rata-rata Potongan</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                            {formatCurrency(stats.avgDiscount)}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">per item yang dipotong</p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-slate-200 dark:border-slate-800">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab("items")}
                            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                                activeTab === "items"
                                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            }`}
                        >
                            <IconTag size={18} />
                            Item Terdaftar ({priceList.items?.length || 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("catalog")}
                            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 relative ${
                                activeTab === "catalog"
                                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            }`}
                        >
                            <IconPackage size={18} />
                            Katalog Lengkap Toko ({products.length})
                            {stagedCount > 0 && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                                    {stagedCount} diedit
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* TAB 1: Item Terdaftar */}
                {activeTab === "items" && (
                    <div className="space-y-4">
                        {/* Filter Bar */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1">
                                    <IconSearch
                                        size={18}
                                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        type="text"
                                        value={itemsSearch}
                                        onChange={(e) => setItemsSearch(e.target.value)}
                                        placeholder="Cari item di price list (nama, SKU, barcode)..."
                                        className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-4 text-sm focus:bg-white dark:focus:bg-slate-900 dark:text-white"
                                    />
                                </div>

                                <select
                                    value={itemsCategory}
                                    onChange={(e) => setItemsCategory(e.target.value)}
                                    className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm dark:text-white"
                                >
                                    <option value="all">Semua Kategori</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                                {selectedItemProductIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleBulkDeleteItems}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                                    >
                                        <IconTrash size={16} /> Hapus Terpilih ({selectedItemProductIds.length})
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("catalog")}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 shadow-sm transition cursor-pointer"
                                >
                                    <IconPlus size={16} /> Tambah / Edit dari Katalog
                                </button>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            {filteredItems.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">
                                            <tr>
                                                <th className="p-4 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            filteredItems.length > 0 &&
                                                            selectedItemProductIds.length === filteredItems.length
                                                        }
                                                        onChange={toggleSelectAllItems}
                                                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                                    />
                                                </th>
                                                <th className="p-4">Produk</th>
                                                <th className="p-4 text-right">HPP (Modal)</th>
                                                <th className="p-4 text-right">Harga Normal</th>
                                                <th className="p-4 text-right">Harga Price List</th>
                                                <th className="p-4 text-center">Margin & Selisih</th>
                                                <th className="p-4 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredItems.map((item) => {
                                                const prod = item.product || {};
                                                const isSelected = selectedItemProductIds.includes(item.product_id);
                                                const buyPrice = Number(prod.buy_price) || 0;
                                                const sellPrice = Number(prod.sell_price) || 0;
                                                const plPrice = Number(item.price) || 0;
                                                const diff = sellPrice - plPrice;
                                                const discountPct =
                                                    sellPrice > 0 ? Math.round((diff / sellPrice) * 100) : 0;
                                                const marginPct =
                                                    plPrice > 0
                                                        ? Math.round(((plPrice - buyPrice) / plPrice) * 100)
                                                        : 0;

                                                return (
                                                    <tr
                                                        key={item.id}
                                                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                                                            isSelected ? "bg-primary-50/30 dark:bg-primary-950/20" : ""
                                                        }`}
                                                    >
                                                        <td className="p-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() =>
                                                                    setSelectedItemProductIds((prev) =>
                                                                        prev.includes(item.product_id)
                                                                            ? prev.filter((id) => id !== item.product_id)
                                                                            : [...prev, item.product_id]
                                                                    )
                                                                }
                                                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                                            />
                                                        </td>
                                                        <td className="p-4">
                                                            <div>
                                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                                    {prod.title || "-"}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                                                    {prod.sku && <span>SKU: {prod.sku}</span>}
                                                                    {prod.barcode && <span>Barcode: {prod.barcode}</span>}
                                                                    {prod.category && (
                                                                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium">
                                                                            {prod.category.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-xs text-slate-500">
                                                            {formatCurrency(buyPrice)}
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-xs text-slate-500">
                                                            {formatCurrency(sellPrice)}
                                                        </td>
                                                        <td className="p-4 text-right font-mono font-bold text-primary-600 dark:text-primary-400">
                                                            {formatCurrency(plPrice)}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="inline-flex flex-col items-center gap-1">
                                                                {diff > 0 ? (
                                                                    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                                                        <IconArrowDownRight size={12} /> Hemat {discountPct}% ({formatCurrency(diff)})
                                                                    </span>
                                                                ) : diff < 0 ? (
                                                                    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                                                                        <IconArrowUpRight size={12} /> +{Math.abs(discountPct)}% (+{formatCurrency(Math.abs(diff))})
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">Sama</span>
                                                                )}
                                                                <span className="text-[10px] text-slate-400">
                                                                    Margin: {marginPct}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openSinglePriceModal(prod, plPrice)}
                                                                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                                                    title="Edit Harga"
                                                                >
                                                                    <IconPencil size={17} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteSingleItem(item)}
                                                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                                                    title="Hapus dari Price List"
                                                                >
                                                                    <IconTrash size={17} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    <IconTag size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                    <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                                        Belum ada item di Price List ini
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                                        Gunakan tab <strong>Katalog & Bulk Input</strong> untuk memilih produk dan menetapkan harga khusus sekaligus.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("catalog")}
                                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition"
                                    >
                                        <IconSparkles size={16} /> Buka Katalog & Bulk Generator
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: Katalog Seluruh Produk & Bulk Input */}
                {activeTab === "catalog" && (
                    <div className="space-y-4">
                        {/* Bulk Formula Tool Card */}
                        <div className="bg-gradient-to-r from-primary-500/10 via-accent-500/10 to-primary-500/5 dark:from-primary-950/30 dark:to-slate-900 border border-primary-200 dark:border-primary-800/40 rounded-2xl p-5 shadow-sm">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="p-1.5 rounded-lg bg-primary-500 text-white">
                                            <IconCalculator size={18} />
                                        </span>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                            Alat Penyesuaian Harga Massal (Bulk Formula)
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Pilih produk di tabel bawah, tentukan formula diskon/markup, lalu terapkan secara instan.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        value={bulkFormulaType}
                                        onChange={(e) => setBulkFormulaType(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-medium dark:text-white"
                                    >
                                        <option value="discount_percent">Diskon % dari Harga Jual Normal</option>
                                        <option value="markup_hpp">Markup % dari HPP (Modal)</option>
                                        <option value="fixed_discount">Potongan Flat Rp dari Harga Jual</option>
                                        <option value="fixed_price">Set Harga Tetap Rp</option>
                                    </select>

                                    <div className="relative w-28">
                                        <input
                                            type="number"
                                            min="0"
                                            value={bulkFormulaValue}
                                            onChange={(e) => setBulkFormulaValue(e.target.value)}
                                            className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold dark:text-white"
                                            placeholder="10"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                            {bulkFormulaType.includes("percent") || bulkFormulaType === "markup_hpp"
                                                ? "%"
                                                : "Rp"}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={applyBulkFormula}
                                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                                    >
                                        <IconSparkles size={16} /> Terapkan ke ({selectedCatalogProductIds.length}) Terpilih
                                    </button>

                                    {stagedCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleResetStaged}
                                            className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                                            title="Reset semua harga yang belum disimpan"
                                        >
                                            <IconRotate size={15} /> Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Search & Filter Toolbar */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex flex-1 items-center gap-3 w-full md:w-auto flex-wrap">
                                <div className="relative flex-1 min-w-[220px]">
                                    <IconSearch
                                        size={18}
                                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        type="text"
                                        value={catalogSearch}
                                        onChange={(e) => setCatalogSearch(e.target.value)}
                                        placeholder="Cari katalog (nama produk, SKU, barcode)..."
                                        className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-4 text-sm focus:bg-white dark:focus:bg-slate-900 dark:text-white"
                                    />
                                </div>

                                <select
                                    value={catalogCategory}
                                    onChange={(e) => setCatalogCategory(e.target.value)}
                                    className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm dark:text-white"
                                >
                                    <option value="all">Semua Kategori</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={catalogStatus}
                                    onChange={(e) => setCatalogStatus(e.target.value)}
                                    className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm dark:text-white"
                                >
                                    <option value="all">Semua Status</option>
                                    <option value="unpriced">Belum Masuk Price List</option>
                                    <option value="priced">Sudah Masuk Price List</option>
                                </select>
                            </div>

                            <div className="text-xs text-slate-400 self-end md:self-center">
                                Menampilkan <strong>{filteredCatalog.length}</strong> dari {products.length} produk
                            </div>
                        </div>

                        {/* Catalog Interactive Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            {filteredCatalog.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800">
                                            <tr>
                                                <th className="p-4 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            filteredCatalog.length > 0 &&
                                                            selectedCatalogProductIds.length === filteredCatalog.length
                                                        }
                                                        onChange={toggleSelectAllCatalog}
                                                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                                    />
                                                </th>
                                                <th className="p-4">Produk</th>
                                                <th className="p-4 text-right">HPP (Modal)</th>
                                                <th className="p-4 text-right">Harga Normal</th>
                                                <th className="p-4 text-center">Status Saat Ini</th>
                                                <th className="p-4 w-60">Harga Price List (Diedit)</th>
                                                <th className="p-4 text-center">Aksi Cepat</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredCatalog.map((prod) => {
                                                const isSelected = selectedCatalogProductIds.includes(prod.id);
                                                const existingItem = existingItemsMap.get(prod.id);
                                                const hasStaged = prod.id in stagedPrices;
                                                const currentPrice = hasStaged
                                                    ? stagedPrices[prod.id]
                                                    : existingItem
                                                    ? existingItem.price
                                                    : prod.sell_price;

                                                const buyPrice = Number(prod.buy_price) || 0;
                                                const sellPrice = Number(prod.sell_price) || 0;
                                                const diff = sellPrice - Number(currentPrice);
                                                const discountPct =
                                                    sellPrice > 0 ? Math.round((diff / sellPrice) * 100) : 0;
                                                const marginPct =
                                                    currentPrice > 0
                                                        ? Math.round(
                                                              ((Number(currentPrice) - buyPrice) /
                                                                  Number(currentPrice)) *
                                                                  100
                                                          )
                                                        : 0;

                                                return (
                                                    <tr
                                                        key={prod.id}
                                                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                                                            hasStaged
                                                                ? "bg-amber-50/40 dark:bg-amber-950/20"
                                                                : isSelected
                                                                ? "bg-primary-50/30 dark:bg-primary-950/20"
                                                                : ""
                                                        }`}
                                                    >
                                                        <td className="p-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() =>
                                                                    setSelectedCatalogProductIds((prev) =>
                                                                        prev.includes(prod.id)
                                                                            ? prev.filter((id) => id !== prod.id)
                                                                            : [...prev, prod.id]
                                                                    )
                                                                }
                                                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                                                            />
                                                        </td>
                                                        <td className="p-4">
                                                            <div>
                                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                                    {prod.title}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                                                    {prod.sku && <span>SKU: {prod.sku}</span>}
                                                                    {prod.barcode && <span>Barcode: {prod.barcode}</span>}
                                                                    {prod.category && (
                                                                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium">
                                                                            {prod.category.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-xs text-slate-500">
                                                            {formatCurrency(buyPrice)}
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-xs text-slate-500">
                                                            {formatCurrency(sellPrice)}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {existingItem ? (
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300">
                                                                    <IconCheck size={12} /> Rp {formatNumber(existingItem.price)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] text-slate-400">
                                                                    Belum ada
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="space-y-1">
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                                        Rp
                                                                    </span>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={currentPrice}
                                                                        onChange={(e) => {
                                                                            const val = parseInt(e.target.value, 10) || 0;
                                                                            setStagedPrices((prev) => ({
                                                                                ...prev,
                                                                                [prod.id]: Math.max(0, val),
                                                                            }));
                                                                        }}
                                                                        className={`h-9 w-full rounded-xl border pl-9 pr-3 text-xs font-mono font-bold focus:ring-2 focus:ring-primary-500/20 dark:text-white ${
                                                                            hasStaged
                                                                                ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/40 dark:border-amber-600"
                                                                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                                                        }`}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                                                                    <span>
                                                                        {diff > 0
                                                                            ? `Hemat ${discountPct}%`
                                                                            : diff < 0
                                                                            ? `+${Math.abs(discountPct)}%`
                                                                            : "Sama"}
                                                                    </span>
                                                                    <span>Margin: {marginPct}%</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        // -10% preset
                                                                        const p = Math.round(sellPrice * 0.9);
                                                                        setStagedPrices((prev) => ({ ...prev, [prod.id]: p }));
                                                                    }}
                                                                    className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                                                                    title="Set Diskon 10%"
                                                                >
                                                                    -10%
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        // -20% preset
                                                                        const p = Math.round(sellPrice * 0.8);
                                                                        setStagedPrices((prev) => ({ ...prev, [prod.id]: p }));
                                                                    }}
                                                                    className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                                                                    title="Set Diskon 20%"
                                                                >
                                                                    -20%
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openSinglePriceModal(prod, currentPrice)}
                                                                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                                                    title="Dialog Lengkap"
                                                                >
                                                                    <IconPencil size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400">
                                    Tidak ada produk yang sesuai dengan filter pencarian.
                                </div>
                            )}
                        </div>

                        {/* Floating Bottom Bar for Staged Bulk Changes */}
                        {stagedCount > 0 && (
                            <div className="sticky bottom-6 z-20 flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom duration-200">
                                <div className="flex items-center gap-3">
                                    <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                                        <IconDeviceFloppy size={20} />
                                    </span>
                                    <div>
                                        <p className="font-bold text-sm">
                                            {stagedCount} Produk Telah Disesuaikan
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            Perubahan belum disimpan ke database price list.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleResetStaged}
                                        className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                                    >
                                        Batal / Reset
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveBulkStaged}
                                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold shadow-lg shadow-primary-500/30 transition cursor-pointer"
                                    >
                                        <IconCheck size={16} /> Simpan Semua ({stagedCount} Item)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MODAL: Input / Edit Harga Satuan */}
                <Modal
                    show={!!modalProduct}
                    onClose={closeSinglePriceModal}
                    title={`Atur Harga: ${modalProduct?.title || ""}`}
                    icon={<IconTag size={20} />}
                    maxWidth="lg"
                >
                    {modalProduct && (
                        <form onSubmit={handleSaveSinglePrice} className="space-y-4">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Kategori:</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                        {modalProduct.category?.name || "-"}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">HPP / Modal (Beli):</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300">
                                        {formatCurrency(modalProduct.buy_price)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Harga Jual Normal:</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                                        {formatCurrency(modalProduct.sell_price)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Harga Khusus di Price List ini (Rp) <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm text-slate-400">
                                        Rp
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={modalPrice}
                                        onChange={(e) => setModalPrice(e.target.value)}
                                        placeholder="0"
                                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-11 pr-4 text-base font-mono font-bold focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:text-white"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Preset Buttons */}
                            <div className="space-y-1.5">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Preset Cepat:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { label: "Sama (Normal)", val: modalProduct.sell_price },
                                        { label: "-5%", val: Math.round(modalProduct.sell_price * 0.95) },
                                        { label: "-10%", val: Math.round(modalProduct.sell_price * 0.9) },
                                        { label: "-15%", val: Math.round(modalProduct.sell_price * 0.85) },
                                        { label: "-20%", val: Math.round(modalProduct.sell_price * 0.8) },
                                        {
                                            label: "Modal + 10%",
                                            val: Math.round((modalProduct.buy_price || 0) * 1.1),
                                        },
                                        {
                                            label: "Modal + 20%",
                                            val: Math.round((modalProduct.buy_price || 0) * 1.2),
                                        },
                                    ].map((btn, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setModalPrice(String(btn.val))}
                                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer"
                                        >
                                            {btn.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Live calculations */}
                            {modalPrice !== "" && (
                                <div className="p-3 rounded-xl bg-primary-50/50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900/50 flex items-center justify-between text-xs">
                                    <div>
                                        <span className="text-slate-500">Selisih vs Normal: </span>
                                        <strong
                                            className={
                                                modalProduct.sell_price > Number(modalPrice)
                                                    ? "text-emerald-600"
                                                    : "text-slate-700 dark:text-slate-300"
                                            }
                                        >
                                            {formatCurrency(modalProduct.sell_price - Number(modalPrice))} (
                                            {modalProduct.sell_price > 0
                                                ? Math.round(
                                                      ((modalProduct.sell_price - Number(modalPrice)) /
                                                          modalProduct.sell_price) *
                                                          100
                                                  )
                                                : 0}
                                            %)
                                        </strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Margin Laba: </span>
                                        <strong className="text-slate-800 dark:text-slate-200">
                                            {Number(modalPrice) > 0
                                                ? Math.round(
                                                      ((Number(modalPrice) - (modalProduct.buy_price || 0)) /
                                                          Number(modalPrice)) *
                                                          100
                                                  )
                                                : 0}
                                            %
                                        </strong>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={closeSinglePriceModal}
                                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
                                >
                                    Simpan Harga
                                </button>
                            </div>
                        </form>
                    )}
                </Modal>
            </div>
        </>
    );
}

PriceListItems.layout = (page) => <DashboardLayout children={page} />;
