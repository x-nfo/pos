import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage, Link } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import InputSelect from "@/Components/Dashboard/InputSelect";
import Modal from "@/Components/Dashboard/Modal";
import toast from "react-hot-toast";
import axios from "axios";
import {
    IconPackage,
    IconDeviceFloppy,
    IconChevronLeft,
    IconPhoto,
    IconBarcode,
    IconCurrencyDollar,
    IconSearch,
    IconSparkles,
    IconCheck,
    IconLoader2,
    IconDatabase,
    IconCamera,
} from "@tabler/icons-react";
import ProductUnitsInput from "@/Components/Dashboard/ProductUnitsInput";
import ImageCaptureUpload from "@/Components/Dashboard/ImageCaptureUpload";
import BarcodeScanner from "@/Components/POS/BarcodeScanner";

export default function Create({ categories, units = [] }) {
    const { errors } = usePage().props;

    const { data, setData, post, processing } = useForm({
        image: "",
        barcode: "",
        sku: "",
        title: "",
        category_id: "",
        description: "",
        buy_price: "",
        sell_price: "",
        stock: "",
        units: [],
    });

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [catalogMatch, setCatalogMatch] = useState(null);
    const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

    // Search Modal States
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const setSelectedCategoryHandler = (value) => {
        setSelectedCategory(value);
        setData("category_id", value?.id || "");
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setData("image", file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const applyCatalogData = (productData) => {
        setData((prev) => ({
            ...prev,
            barcode: productData.barcode || prev.barcode,
            sku: prev.sku ? prev.sku : (productData.sku || productData.barcode || prev.barcode),
            title: productData.title || prev.title,
            buy_price: productData.buy_price > 0 ? productData.buy_price : prev.buy_price,
            sell_price: productData.sell_price > 0 ? productData.sell_price : prev.sell_price,
            category_id: productData.category_id || prev.category_id,
        }));

        if (productData.category_id) {
            const foundCat = categories.find((c) => c.id === productData.category_id);
            if (foundCat) {
                setSelectedCategory(foundCat);
            }
        }

        setCatalogMatch(productData);
    };

    const lookupBarcode = async (barcodeVal) => {
        const code = (barcodeVal ?? data.barcode).trim();
        if (!code) return;

        setIsLookingUp(true);
        try {
            const response = await axios.get(route("products.lookup-catalog"), {
                params: { barcode: code },
            });

            if (response.data?.success && response.data?.data) {
                const item = response.data.data;
                applyCatalogData(item);
                toast.success(`Ditemukan di katalog: ${item.title}`);
            }
        } catch (error) {
            if (error.response?.status === 404) {
                setCatalogMatch(null);
            } else {
                console.error("Gagal mencari katalog", error);
            }
        } finally {
            setIsLookingUp(false);
        }
    };

    const handleSearchCatalog = async (e) => {
        e?.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await axios.get(route("products.lookup-catalog"), {
                params: { search: searchQuery },
            });
            if (response.data?.success) {
                setSearchResults(response.data.data || []);
            }
        } catch (error) {
            toast.error("Gagal melakukan pencarian katalog.");
        } finally {
            setIsSearching(false);
        }
    };

    const selectCatalogItem = (item) => {
        applyCatalogData(item);
        setShowSearchModal(false);
        toast.success(`Produk "${item.title}" berhasil dimuat.`);
    };

    const submit = (e) => {
        e.preventDefault();
        post(route("products.store"), {
            onSuccess: () => toast.success("Produk berhasil ditambahkan"),
            onError: () => toast.error("Gagal menyimpan produk"),
        });
    };

    return (
        <>
            <Head title="Tambah Produk" />

            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <Link
                        href={route("products.index")}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 mb-2 transition-colors"
                    >
                        <IconChevronLeft size={18} strokeWidth={2.2} />
                        Kembali ke Produk
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <IconPackage size={28} className="text-primary-500" />
                        Tambah Produk Baru
                    </h1>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setShowSearchModal(true);
                        setSearchQuery(data.title || "");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary-200 dark:border-primary-900/50 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/60 font-medium text-sm transition-colors shadow-sm"
                >
                    <IconSearch size={18} />
                    Cari di Katalog Referensi (32k+ Data)
                </button>
            </div>

            <form onSubmit={submit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Image */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <ImageCaptureUpload
                                label="Gambar Produk"
                                currentPreview={imagePreview}
                                onImageSelected={(file, previewUrl) => {
                                    setData("image", file);
                                    setImagePreview(previewUrl);
                                }}
                                onImageRemoved={() => {
                                    setData("image", "");
                                    setImagePreview(null);
                                }}
                                error={errors.image}
                            />
                        </div>
                    </div>

                    {/* Right Column - Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Basic Info */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <IconBarcode size={18} />
                                    Informasi Dasar
                                </h3>

                                {catalogMatch && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                        <IconCheck size={14} />
                                        Katalog Referensi Terisi
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <InputSelect
                                        label="Kategori"
                                        data={categories}
                                        selected={selectedCategory}
                                        setSelected={setSelectedCategoryHandler}
                                        placeholder="Pilih kategori"
                                        errors={errors.category_id}
                                        searchable={true}
                                        displayKey="name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        Barcode / Kode Produk
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={data.barcode}
                                                onChange={(e) => setData("barcode", e.target.value)}
                                                onBlur={() => lookupBarcode(data.barcode)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        lookupBarcode(data.barcode);
                                                    }
                                                }}
                                                placeholder="Scan atau ketik barcode"
                                                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => lookupBarcode(data.barcode)}
                                                disabled={isLookingUp}
                                                title="Cari di Katalog Nasional"
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-primary-600 transition-colors"
                                            >
                                                {isLookingUp ? (
                                                    <IconLoader2 size={18} className="animate-spin text-primary-500" />
                                                ) : (
                                                    <IconSparkles size={18} className="text-primary-500" />
                                                )}
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowBarcodeScanner(true)}
                                            className="px-3.5 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/50 flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-all active:scale-95 shadow-sm"
                                            title="Pindai Barcode via Kamera HP/Webcam"
                                        >
                                            <IconCamera size={16} />
                                            <span>Scan Kamera</span>
                                        </button>
                                    </div>
                                    {errors.barcode && (
                                        <p className="text-xs text-rose-500 mt-1">{errors.barcode}</p>
                                    )}
                                    <p className="text-xs text-slate-400 mt-1">
                                        Tekan Enter atau pindah kolom untuk auto-fill dari katalog nasional.
                                    </p>
                                </div>

                                <Input
                                    type="text"
                                    label="SKU"
                                    value={data.sku}
                                    onChange={(e) => setData("sku", e.target.value)}
                                    errors={errors.sku}
                                    placeholder="Masukkan SKU unik"
                                />

                                <div className="md:col-span-2">
                                    <Input
                                        type="text"
                                        label="Nama Produk"
                                        value={data.title}
                                        onChange={(e) => setData("title", e.target.value)}
                                        errors={errors.title}
                                        placeholder="Masukkan nama produk"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <Textarea
                                        label="Deskripsi"
                                        placeholder="Deskripsi produk (opsional)"
                                        errors={errors.description}
                                        onChange={(e) =>
                                            setData(
                                                "description",
                                                e.target.value
                                            )
                                        }
                                        value={data.description}
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pricing & Stock */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconCurrencyDollar size={18} />
                                Harga & Stok
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input
                                    type="number"
                                    label="Harga Beli"
                                    value={data.buy_price}
                                    onChange={(e) =>
                                        setData("buy_price", e.target.value)
                                    }
                                    errors={errors.buy_price}
                                    placeholder="0"
                                />
                                <Input
                                    type="number"
                                    label="Harga Jual"
                                    value={data.sell_price}
                                    onChange={(e) =>
                                        setData("sell_price", e.target.value)
                                    }
                                    errors={errors.sell_price}
                                    placeholder="0"
                                />
                                <Input
                                    type="number"
                                    label="Stok Awal"
                                    value={data.stock}
                                    onChange={(e) =>
                                        setData("stock", e.target.value)
                                    }
                                    errors={errors.stock}
                                    placeholder="0"
                                />
                            </div>

                            {/* Profit Estimation */}
                            {data.buy_price > 0 && data.sell_price > 0 && (
                                <div className="mt-4 p-4 rounded-xl bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-900">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-success-700 dark:text-success-400 font-medium">
                                                Estimasi Profit per Item
                                            </p>
                                            <p className="text-2xl font-bold text-success-600 dark:text-success-500 mt-1">
                                                + Rp{" "}
                                                {(
                                                    data.sell_price -
                                                    data.buy_price
                                                ).toLocaleString("id-ID")}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-success-700 dark:text-success-400 font-medium">
                                                Margin
                                            </p>
                                            <p className="text-xl font-bold text-success-600 dark:text-success-500 mt-1">
                                                {(
                                                    ((data.sell_price -
                                                        data.buy_price) /
                                                        data.buy_price) *
                                                    100
                                                ).toFixed(1)}
                                                %
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Multi-Satuan (UOM) Card */}
                        <ProductUnitsInput
                            units={units}
                            value={data.units}
                            onChange={(val) => setData("units", val)}
                            defaultBuyPrice={data.buy_price}
                            defaultSellPrice={data.sell_price}
                            errors={errors}
                        />

                        {/* Submit */}
                        <div className="flex justify-end gap-3">
                            <Link
                                href={route("products.index")}
                                className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
                            >
                                Batal
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                            >
                                <IconDeviceFloppy size={18} />
                                {processing ? "Menyimpan..." : "Simpan Produk"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* Modal Pencarian Katalog Nasional */}
            <Modal
                show={showSearchModal}
                title="Pencarian Master Katalog Produk Nasional (32k+ Data)"
                maxWidth="2xl"
                onClose={() => setShowSearchModal(false)}
            >
                <div className="space-y-4">
                    <form onSubmit={handleSearchCatalog} className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Ketik nama produk atau barcode (contoh: Indomie, Aqua, Teh Botol...)"
                                className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-primary-500"
                            />
                            <IconSearch
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                        >
                            {isSearching ? (
                                <IconLoader2 size={16} className="animate-spin" />
                            ) : (
                                "Cari"
                            )}
                        </button>
                    </form>

                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {searchResults.length > 0 ? (
                            searchResults.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl flex items-center justify-between transition-colors cursor-pointer group"
                                    onClick={() => selectCatalogItem(item)}
                                >
                                    <div className="space-y-1">
                                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 group-hover:text-primary-600">
                                            {item.title}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                Barcode: {item.barcode}
                                            </span>
                                            {item.category_name && (
                                                <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-0.5 rounded">
                                                    {item.category_name}
                                                </span>
                                            )}
                                            {item.unit && (
                                                <span>Satuan: {item.unit}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {item.sell_price > 0 && (
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                Rp {item.sell_price.toLocaleString("id-ID")}
                                            </p>
                                        )}
                                        <span className="text-xs text-primary-500 font-medium group-hover:underline">
                                            Pilih Produk →
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : searchQuery && !isSearching ? (
                            <div className="py-8 text-center text-sm text-slate-500">
                                Tidak ada produk yang cocok dengan pencarian "{searchQuery}".
                            </div>
                        ) : (
                            <div className="py-8 text-center text-sm text-slate-400">
                                Ketik kata kunci di atas untuk mencari dari 32.192 produk referensi.
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {showBarcodeScanner && (
                <BarcodeScanner
                    onScan={(code) => {
                        setShowBarcodeScanner(false);
                        setData("barcode", code);
                        lookupBarcode(code);
                        toast.success(`Barcode berhasil dipindai: ${code}`);
                    }}
                    onClose={() => setShowBarcodeScanner(false)}
                />
            )}
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;
