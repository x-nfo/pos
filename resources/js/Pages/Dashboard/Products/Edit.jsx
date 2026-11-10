import React, { useEffect, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage, Link } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import InputSelect from "@/Components/Dashboard/InputSelect";
import toast from "react-hot-toast";
import {
    IconPackage,
    IconDeviceFloppy,
    IconArrowLeft,
    IconPhoto,
    IconBarcode,
    IconCurrencyDollar,
    IconCamera,
    IconPlus,
    IconColorSwatch,
} from "@tabler/icons-react";
import { getProductImageUrl } from "@/Utils/imageUrl";
import ProductUnitsInput from "@/Components/Dashboard/ProductUnitsInput";
import ImageCaptureUpload from "@/Components/Dashboard/ImageCaptureUpload";
import BarcodeScanner from "@/Components/POS/BarcodeScanner";
import QuickCategoryModal from "@/Components/Dashboard/QuickCategoryModal";
import FashionVariantMatrixGenerator from "@/Components/Dashboard/FashionVariantMatrixGenerator";

export default function Edit({ categories = [], product, units = [], sizeCharts = [] }) {
    const { errors } = usePage().props;

    const initialUnits = (product.units || []).map((u) => ({
        unit_id: u.id,
        is_base: Boolean(u.pivot?.is_base),
        conversion_factor:
            u.pivot?.conversion_factor != null
                ? Number(u.pivot.conversion_factor) || 1
                : 1,
        buy_price: u.pivot?.buy_price ?? product.buy_price ?? "",
        sell_price: u.pivot?.sell_price ?? product.sell_price ?? "",
        barcode: u.pivot?.barcode || "",
        sku_suffix: u.pivot?.sku_suffix || "",
    }));

    const { data, setData, post, processing } = useForm({
        image: "",
        barcode: product.barcode || "",
        sku: product.sku || "",
        title: product.title || "",
        category_id: product.category_id || "",
        size_chart_id: product.size_chart_id || "",
        description: product.description || "",
        buy_price: product.buy_price ?? "",
        sell_price: product.sell_price ?? "",
        min_stock: product.min_stock ?? 0,
        max_stock: product.max_stock ?? 0,
        has_variants: Boolean(product.has_variants),
        variant_display_type: product.variant_display_type || "color",
        variants: product.variants_data || [],
        color_images: product.color_images || {},
        units: initialUnits,
        _method: "PUT",
    });

    const [categoriesList, setCategoriesList] = useState(categories || []);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showQuickCategoryModal, setShowQuickCategoryModal] = useState(false);
    const [imagePreview, setImagePreview] = useState(
        product.image ? getProductImageUrl(product.image) : null
    );
    const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

    useEffect(() => {
        if (product.category_id) {
            setSelectedCategory(
                categoriesList.find((cat) => cat.id === product.category_id)
            );
        }
    }, [product.category_id, categoriesList]);

    const setSelectedCategoryHandler = (value) => {
        setSelectedCategory(value);
        setData("category_id", value?.id || "");
    };

    const handleCategoryCreated = (newCategory) => {
        setCategoriesList((prev) => [newCategory, ...prev]);
        setSelectedCategory(newCategory);
        setData("category_id", newCategory.id);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setData("image", file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // Derive current base unit symbol
    const baseUnitId = data.units?.find((u) => u.is_base)?.unit_id;
    const currentBaseUnit = units.find((u) => u.id === Number(baseUnitId)) || units.find((u) => u.code === "PCS") || units[0] || null;
    const baseUnitSymbol = currentBaseUnit?.symbol || currentBaseUnit?.code || "PCS";

    const submit = (e) => {
        e.preventDefault();
        post(route("products.update", product.id), {
            forceFormData: true,
            onSuccess: () => toast.success("Produk berhasil diperbarui"),
            onError: () => toast.error("Gagal memperbarui produk"),
        });
    };

    return (
        <>
            <Head title="Edit Produk" />

            <div className="mb-6">
                <Link
                    href={route("products.index")}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3"
                >
                    <IconArrowLeft size={16} />
                    Kembali ke Produk
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconPackage size={28} className="text-primary-500" />
                    Edit Produk
                </h1>
                <p className="text-sm text-slate-500 mt-1">{product.title}</p>
            </div>

            <form onSubmit={submit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left - Image */}
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

                    {/* Right - Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                <IconBarcode size={18} />
                                Informasi Dasar
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Kategori
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowQuickCategoryModal(true)}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors py-0.5 px-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/50"
                                        >
                                            <IconPlus size={14} strokeWidth={2.5} />
                                            <span>+ Kategori Baru</span>
                                        </button>
                                    </div>
                                    <InputSelect
                                        data={categoriesList}
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
                                        Panduan Ukuran (Size Guide)
                                    </label>
                                    <select
                                        value={data.size_chart_id || ""}
                                        onChange={(e) => setData("size_chart_id", e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 text-sm"
                                    >
                                        <option value="">— Ikuti Default Kategori —</option>
                                        {sizeCharts.map((sc) => (
                                            <option key={sc.id} value={sc.id}>
                                                {sc.name} ({sc.code})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Pilih template ukuran khusus atau kosongkan untuk mewarisi dari kategori.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        Barcode
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={data.barcode}
                                                onChange={(e) => setData("barcode", e.target.value)}
                                                placeholder="Kode produk"
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 text-sm"
                                            />
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
                                </div>
                                <Input
                                    type="text"
                                    label="SKU"
                                    value={data.sku}
                                    onChange={(e) => setData("sku", e.target.value)}
                                    errors={errors.sku}
                                    placeholder="SKU unik"
                                />
                                <Input
                                    type="text"
                                    label="Nama Produk"
                                    value={data.title}
                                    onChange={(e) =>
                                        setData("title", e.target.value)
                                    }
                                    errors={errors.title}
                                    placeholder="Nama produk"
                                />
                                <div className="md:col-span-2">
                                    <Textarea
                                        label="Deskripsi"
                                        placeholder="Deskripsi produk"
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

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <IconCurrencyDollar size={18} />
                                    Harga Produk
                                </h3>
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-900/50">
                                    Satuan Dasar: <strong>{baseUnitSymbol}</strong>
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    type="number"
                                    label={`Harga Beli (per ${baseUnitSymbol})`}
                                    value={data.buy_price}
                                    onChange={(e) =>
                                        setData("buy_price", e.target.value)
                                    }
                                    errors={errors.buy_price}
                                    placeholder="0"
                                />
                                <Input
                                    type="number"
                                    label={`Harga Jual (per ${baseUnitSymbol})`}
                                    value={data.sell_price}
                                    onChange={(e) =>
                                        setData("sell_price", e.target.value)
                                    }
                                    errors={errors.sell_price}
                                    placeholder="0"
                                />
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                                    Stok Saat Ini (Total: {product.stock} {baseUnitSymbol})
                                </p>
                                
                                {product.warehouses && product.warehouses.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                        {product.warehouses.map((wh) => (
                                            <div key={wh.id} className="flex justify-between items-center bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {wh.name}
                                                </span>
                                                <span className={`text-sm font-bold ${wh.pivot.stock <= product.min_stock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                                    {wh.pivot.stock} {baseUnitSymbol}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                        {product.stock} {baseUnitSymbol}
                                    </p>
                                )}

                                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                    Perubahan stok dilakukan melalui transaksi atau stock opname.
                                </p>
                            </div>

                            {/* Batas Stok Minimal & Maksimal */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                    <Input
                                        type="number"
                                        label={`Stok Minimum (${baseUnitSymbol})`}
                                        value={data.min_stock}
                                        onChange={(e) =>
                                            setData("min_stock", e.target.value)
                                        }
                                        errors={errors.min_stock}
                                        placeholder="0"
                                    />
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Batas peringatan stok menipis di dashboard (0 = tanpa batas).
                                    </p>
                                </div>
                                <div>
                                    <Input
                                        type="number"
                                        label={`Target Restock (${baseUnitSymbol})`}
                                        value={data.max_stock}
                                        onChange={(e) =>
                                            setData("max_stock", e.target.value)
                                        }
                                        errors={errors.max_stock}
                                        placeholder="0"
                                    />
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Target jumlah stok ideal saat rekomendasi restock PO (bukan pembatas pesanan, 0 = tanpa batas).
                                    </p>
                                </div>
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

                        {/* Varian Pakaian & Foto (Fashion Matrix) Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <IconColorSwatch size={18} />
                                        Varian Pakaian & Foto (Warna × Ukuran)
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Kelola variasi warna, ukuran, dan foto masing-masing varian.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={data.has_variants}
                                        onChange={(e) => setData("has_variants", e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                                </label>
                            </div>

                            {data.has_variants && (
                                <div className="pt-2 space-y-4">
                                    {/* Variant Display Mode Selector */}
                                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <div className="mb-2.5">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                Tampilan Varian di Katalog (Storefront)
                                            </span>
                                            <p className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">
                                                Pilih gaya tampilan pemilih varian warna untuk pelanggan di halaman katalog dan detail produk
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setData("variant_display_type", "color")}
                                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                                    data.variant_display_type === "color"
                                                        ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 ring-1 ring-primary-500"
                                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300"
                                                }`}
                                            >
                                                <div className="w-5 h-5 rounded-full border border-black/20 shrink-0 mt-0.5 shadow-2xs" style={{ background: "linear-gradient(135deg, #f43f5e, #8b5cf6, #06b6d4)" }} />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Lingkaran Warna</div>
                                                    <div className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">Bulatan warna saja tanpa foto & tanpa teks</div>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setData("variant_display_type", "image")}
                                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                                    data.variant_display_type === "image"
                                                        ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 ring-1 ring-primary-500"
                                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300"
                                                }`}
                                            >
                                                <IconPhoto size={18} className="text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Foto Baju Saja</div>
                                                    <div className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">Thumbnail foto baju tanpa tulisan teks</div>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setData("variant_display_type", "pill")}
                                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                                    data.variant_display_type === "pill"
                                                        ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 ring-1 ring-primary-500"
                                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300"
                                                }`}
                                            >
                                                <IconColorSwatch size={18} className="text-slate-500 shrink-0 mt-0.5" />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Pill Teks & Icon</div>
                                                    <div className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">Tombol pill berisi nama warna & icon</div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    <FashionVariantMatrixGenerator
                                        variants={data.variants}
                                        onChange={(newVariants) => setData("variants", newVariants)}
                                        colorImages={data.color_images || {}}
                                        onColorImagesChange={(newColorImages) => setData("color_images", newColorImages)}
                                        parentImage={imagePreview || product.image}
                                        baseBuyPrice={Number(data.buy_price) || 0}
                                        baseSellPrice={Number(data.sell_price) || 0}
                                        productTitle={data.title}
                                        productSku={data.sku}
                                    />
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
                                {processing
                                    ? "Menyimpan..."
                                    : "Simpan Perubahan"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {showBarcodeScanner && (
                <BarcodeScanner
                    onScan={(code) => {
                        setShowBarcodeScanner(false);
                        setData("barcode", code);
                        toast.success(`Barcode berhasil dipindai: ${code}`);
                    }}
                    onClose={() => setShowBarcodeScanner(false)}
                />
            )}

            <QuickCategoryModal
                show={showQuickCategoryModal}
                onClose={() => setShowQuickCategoryModal(false)}
                onSuccess={handleCategoryCreated}
            />
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;
