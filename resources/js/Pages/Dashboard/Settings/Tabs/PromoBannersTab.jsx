import React, { useState } from "react";
import { router } from "@inertiajs/react";
import {
    IconSparkles,
    IconPlus,
    IconPhoto,
    IconTrash,
    IconEdit,
    IconCheck,
    IconX,
    IconExternalLink,
    IconTag,
    IconEye,
    IconEyeOff,
    IconChevronLeft,
    IconChevronRight,
    IconArrowRight,
    IconDeviceFloppy,
    IconUpload,
    IconTicket,
} from "@tabler/icons-react";
import Swal from "sweetalert2";
import toast from "react-hot-toast";

export default function PromoBannersTab({
    settings = {},
    promoBanners = [],
    categories = [],
}) {
    const [globalEnabled, setGlobalEnabled] = useState(
        settings.promo_banner_enabled !== undefined
            ? Boolean(settings.promo_banner_enabled)
            : true
    );
    const [isSavingGlobal, setIsSavingGlobal] = useState(false);

    // Static Banner State
    const [staticEnabled, setStaticEnabled] = useState(
        settings.static_banner_enabled !== undefined
            ? Boolean(settings.static_banner_enabled)
            : true
    );
    const [staticBadge, setStaticBadge] = useState(settings.static_banner_badge || "PROMO SPESIAL");
    const [staticTitle, setStaticTitle] = useState(settings.static_banner_title || "Diskon & Penawaran Terbaik");
    const [staticSubtitle, setStaticSubtitle] = useState(
        settings.static_banner_subtitle ||
            "Pesan langsung via WhatsApp toko kami. Pengiriman cepat & produk berkualitas!"
    );
    const [staticActionText, setStaticActionText] = useState(
        settings.static_banner_action_text || "Belanja Sekarang"
    );
    const [staticLinkUrl, setStaticLinkUrl] = useState(settings.static_banner_link_url || "");
    const [staticImage, setStaticImage] = useState(null);
    const [staticImagePreview, setStaticImagePreview] = useState(settings.static_banner_image_url || "");
    const [removeStaticImage, setRemoveStaticImage] = useState(false);
    const [isSavingStatic, setIsSavingStatic] = useState(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formTitle, setFormTitle] = useState("");
    const [formSubtitle, setFormSubtitle] = useState("");
    const [formImage, setFormImage] = useState(null);
    const [formImagePreview, setFormImagePreview] = useState("");
    const [formLinkUrl, setFormLinkUrl] = useState("");
    const [formCategoryId, setFormCategoryId] = useState("");
    const [formSortOrder, setFormSortOrder] = useState(0);
    const [formIsActive, setFormIsActive] = useState(true);

    // Live preview slider state
    const [previewIndex, setPreviewIndex] = useState(0);

    const activeBanners = promoBanners.filter((b) => b.is_active);
    const currentPreviewBanner =
        activeBanners[previewIndex] || activeBanners[0] || promoBanners[0];

    const handleToggleGlobal = (e) => {
        const nextValue = e.target.checked;
        setGlobalEnabled(nextValue);
        setIsSavingGlobal(true);

        router.post(
            route("settings.branding.update"),
            {
                landing_page_mode: settings.landing_page_mode || "storefront",
                promo_banner_enabled: nextValue,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(
                        nextValue
                            ? "Hero banner promo katalog diaktifkan."
                            : "Hero banner promo katalog dinonaktifkan."
                    );
                },
                onError: () => {
                    setGlobalEnabled(!nextValue);
                    toast.error("Gagal memperbarui pengaturan banner.");
                },
                onFinish: () => setIsSavingGlobal(false),
            }
        );
    };

    const openCreateModal = () => {
        setEditingBanner(null);
        setFormTitle("");
        setFormSubtitle("");
        setFormImage(null);
        setFormImagePreview("");
        setFormLinkUrl("");
        setFormCategoryId("");
        setFormSortOrder(promoBanners.length);
        setFormIsActive(true);
        setIsModalOpen(true);
    };

    const openEditModal = (banner) => {
        setEditingBanner(banner);
        setFormTitle(banner.title || "");
        setFormSubtitle(banner.subtitle || "");
        setFormImage(null);
        setFormImagePreview(banner.image_url || "");
        setFormLinkUrl(banner.link_url || "");
        setFormCategoryId(banner.category_id ? String(banner.category_id) : "");
        setFormSortOrder(banner.sort_order || 0);
        setFormIsActive(Boolean(banner.is_active));
        setIsModalOpen(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
            toast.error("Ukuran gambar maksimal 3MB.");
            return;
        }

        setFormImage(file);
        setFormImagePreview(URL.createObjectURL(file));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!editingBanner && !formImage) {
            toast.error("Pilih file gambar banner terlebih dahulu.");
            return;
        }

        setIsSubmitting(true);

        const formData = new FormData();
        if (formTitle) formData.append("title", formTitle);
        if (formSubtitle) formData.append("subtitle", formSubtitle);
        if (formImage) formData.append("image", formImage);
        if (formLinkUrl) formData.append("link_url", formLinkUrl);
        if (formCategoryId) formData.append("category_id", formCategoryId);
        formData.append("sort_order", formSortOrder);
        formData.append("is_active", formIsActive ? "1" : "0");

        if (editingBanner) {
            router.post(
                route("settings.promo-banners.update", editingBanner.id),
                formData,
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success("Banner promo berhasil diperbarui!");
                        setIsModalOpen(false);
                    },
                    onError: (err) => {
                        const message = Object.values(err)[0] || "Gagal menyimpan banner.";
                        toast.error(message);
                    },
                    onFinish: () => setIsSubmitting(false),
                }
            );
        } else {
            router.post(route("settings.promo-banners.store"), formData, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Banner promo berhasil ditambahkan!");
                    setIsModalOpen(false);
                },
                onError: (err) => {
                    const message = Object.values(err)[0] || "Gagal menambahkan banner.";
                    toast.error(message);
                },
                onFinish: () => setIsSubmitting(false),
            });
        }
    };

    const handleToggleActive = (banner) => {
        router.patch(
            route("settings.promo-banners.toggle", banner.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success("Status banner diubah."),
            }
        );
    };

    const handleDelete = (banner) => {
        Swal.fire({
            title: "Hapus Banner Promo?",
            text: `Banner "${banner.title || "Promo"}" akan dihapus permanen.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#e11d48",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus",
            cancelButtonText: "Batal",
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route("settings.promo-banners.destroy", banner.id), {
                    preserveScroll: true,
                    onSuccess: () => toast.success("Banner berhasil dihapus."),
                });
            }
        });
    };

    const handleStaticImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
            toast.error("Ukuran gambar maksimal 3MB");
            return;
        }

        setStaticImage(file);
        setRemoveStaticImage(false);
        const reader = new FileReader();
        reader.onload = () => {
            setStaticImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveStaticImage = () => {
        setStaticImage(null);
        setStaticImagePreview("");
        setRemoveStaticImage(true);
    };

    const handleSaveStaticBanner = (e) => {
        e.preventDefault();
        setIsSavingStatic(true);

        const formData = new FormData();
        formData.append("static_banner_enabled", staticEnabled ? "1" : "0");
        formData.append("static_banner_badge", staticBadge);
        formData.append("static_banner_title", staticTitle);
        formData.append("static_banner_subtitle", staticSubtitle);
        formData.append("static_banner_action_text", staticActionText);
        formData.append("static_banner_link_url", staticLinkUrl);

        if (staticImage) {
            formData.append("static_banner_image", staticImage);
        }
        if (removeStaticImage) {
            formData.append("remove_static_banner_image", "1");
        }

        router.post(route("settings.static-banner.update"), formData, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Pengaturan banner promo statis berhasil disimpan.");
                setRemoveStaticImage(false);
                setStaticImage(null);
            },
            onError: (err) => {
                const message = Object.values(err)[0] || "Gagal menyimpan banner promo statis.";
                toast.error(message);
            },
            onFinish: () => setIsSavingStatic(false),
        });
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header & Global Toggle */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                            <IconSparkles size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Hero Section Banner Slider (Katalog)
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                Pasang gambar-gambar banner promosi (seperti promo Alfagift / Tokopedia) di etalase toko online.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {globalEnabled ? "Hero Slider Aktif" : "Dinonaktifkan"}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={globalEnabled}
                                onChange={handleToggleGlobal}
                                disabled={isSavingGlobal}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                        </label>
                    </div>
                </div>

                {/* Live Preview Slider */}
                {globalEnabled && (
                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Live Preview Tampilan di Katalog Pelanggan:
                            </p>
                            {activeBanners.length > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPreviewIndex(
                                                (prev) =>
                                                    (prev - 1 + activeBanners.length) %
                                                    activeBanners.length
                                            )
                                        }
                                        className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                                    >
                                        <IconChevronLeft size={16} />
                                    </button>
                                    <span className="text-[11px] font-bold text-slate-500 px-1">
                                        {previewIndex + 1} / {activeBanners.length}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPreviewIndex(
                                                (prev) => (prev + 1) % activeBanners.length
                                            )
                                        }
                                        className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                                    >
                                        <IconChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {currentPreviewBanner ? (
                            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-md border border-slate-200/80 dark:border-slate-800 bg-slate-900">
                                <div className="w-full aspect-[16/6] sm:aspect-[21/8] relative">
                                    {currentPreviewBanner.image_url ? (
                                        <img
                                            src={currentPreviewBanner.image_url}
                                            alt={currentPreviewBanner.title || "Banner"}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-r from-rose-500 via-pink-600 to-indigo-700 flex items-center justify-center p-6 text-white text-center">
                                            <div>
                                                <h3 className="text-xl sm:text-2xl font-black">
                                                    {currentPreviewBanner.title || "Promo Spesial Toko"}
                                                </h3>
                                                <p className="text-xs sm:text-sm text-white/90 mt-1">
                                                    {currentPreviewBanner.subtitle || "Belanja hemat dan cepat langsung via WhatsApp."}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Prev / Next buttons mock */}
                                    {activeBanners.length > 1 && (
                                        <>
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-md flex items-center justify-center text-slate-800">
                                                <IconChevronLeft size={18} />
                                            </div>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-md flex items-center justify-center text-slate-800">
                                                <IconChevronRight size={18} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                                Belum ada banner promo aktif. Klik tombol "Tambah Banner" di bawah untuk mengunggah gambar promo.
                            </div>
                        )}

                        {/* Dots Preview (Alfagift Style with Dynamic Branding) */}
                        {globalEnabled && activeBanners.length > 1 && (
                            <div className="flex items-center justify-center gap-1.5 mt-2.5">
                                {activeBanners.map((_, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setPreviewIndex(idx)}
                                        className={`h-2 rounded-full transition-all duration-300 ${
                                            idx === previewIndex
                                                ? "w-6 bg-primary-600 dark:bg-primary-500 shadow-sm shadow-primary-500/40 ring-1 ring-primary-500/30"
                                                : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                                        }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Banner List Section */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            Daftar Banner Promo ({promoBanners.length})
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            Urutan banner menentukan slide pertama hingga terakhir di katalog.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 self-start sm:self-auto"
                    >
                        <IconPlus size={18} />
                        Tambah Banner Promo
                    </button>
                </div>

                {promoBanners.length === 0 ? (
                    <div className="py-12 text-center">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mb-3">
                            <IconPhoto size={32} />
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">
                            Belum Ada Banner Promo
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1">
                            Unggah gambar banner promo toko Anda untuk mempercantik katalog pelanggan seperti banner e-commerce Alfagift.
                        </p>
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold shadow-sm"
                        >
                            <IconPlus size={16} />
                            Unggah Banner Pertama
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        {promoBanners.map((banner, index) => (
                            <div
                                key={banner.id}
                                className={`group rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                                    banner.is_active
                                        ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
                                        : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 opacity-60"
                                }`}
                            >
                                <div>
                                    {/* Image Container */}
                                    <div className="relative w-full aspect-[16/6] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3 border border-slate-200/60 dark:border-slate-700">
                                        {banner.image_url ? (
                                            <img
                                                src={banner.image_url}
                                                alt={banner.title || "Banner"}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                <IconPhoto size={28} />
                                            </div>
                                        )}

                                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                                            <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-white font-bold text-[10px]">
                                                #{index + 1}
                                            </span>
                                            {banner.is_active ? (
                                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/90 backdrop-blur-md text-white font-bold text-[10px] flex items-center gap-1">
                                                    <IconCheck size={11} /> Aktif
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-md bg-rose-500/90 backdrop-blur-md text-white font-bold text-[10px] flex items-center gap-1">
                                                    <IconX size={11} /> Nonaktif
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Meta Info */}
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                                        {banner.title || "Banner Tanpa Judul"}
                                    </h4>
                                    {banner.subtitle && (
                                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                            {banner.subtitle}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        {banner.category_name && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold border border-indigo-200/60 dark:border-indigo-800">
                                                <IconTag size={12} />
                                                Kategori: {banner.category_name}
                                            </span>
                                        )}
                                        {banner.link_url && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-mono line-clamp-1 max-w-[200px]">
                                                <IconExternalLink size={12} />
                                                {banner.link_url}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleActive(banner)}
                                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                                            banner.is_active
                                                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        }`}
                                    >
                                        {banner.is_active ? (
                                            <>
                                                <IconEyeOff size={14} /> Sembunyikan
                                            </>
                                        ) : (
                                            <>
                                                <IconEye size={14} /> Tampilkan
                                            </>
                                        )}
                                    </button>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(banner)}
                                            className="p-1.5 rounded-lg text-slate-600 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-all"
                                            title="Edit Banner"
                                        >
                                            <IconEdit size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(banner)}
                                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all"
                                            title="Hapus Banner"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Section 2: Banner Promo Statis (Di Bawah Slider — Model Alfagift) */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                <form onSubmit={handleSaveStaticBanner} className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                <IconTicket size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Banner Promo Statis (Di Bawah Slider)
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                    Banner promosi tetap (bukan slider) yang selalu tampil di bawah hero slider katalog (seperti banner promosi Alfagift).
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={staticEnabled}
                                    onChange={(e) => setStaticEnabled(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                                <span className="ml-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {staticEnabled ? "Aktif" : "Nonaktif"}
                                </span>
                            </label>
                        </div>
                    </div>

                    {staticEnabled && (
                        <div className="space-y-6">
                            {/* Inputs Row 1: Badge & Title */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                        Badge Teks
                                    </label>
                                    <input
                                        type="text"
                                        value={staticBadge}
                                        onChange={(e) => setStaticBadge(e.target.value)}
                                        placeholder="Contoh: PROMO SPESIAL"
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">Label kecil di atas judul banner.</p>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                        Judul Banner Promo
                                    </label>
                                    <input
                                        type="text"
                                        value={staticTitle}
                                        onChange={(e) => setStaticTitle(e.target.value)}
                                        placeholder="Contoh: Diskon & Penawaran Terbaik"
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">Judul utama banner promosi statis.</p>
                                </div>
                            </div>

                            {/* Inputs Row 2: Subtitle, Action Text & Link */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                        Subjudul / Keterangan
                                    </label>
                                    <input
                                        type="text"
                                        value={staticSubtitle}
                                        onChange={(e) => setStaticSubtitle(e.target.value)}
                                        placeholder="Contoh: Pesan langsung via WhatsApp toko kami. Pengiriman cepat & produk berkualitas!"
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                        Teks Tombol Aksi (CTA)
                                    </label>
                                    <input
                                        type="text"
                                        value={staticActionText}
                                        onChange={(e) => setStaticActionText(e.target.value)}
                                        placeholder="Contoh: Belanja Sekarang"
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                        Tautan Link (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        value={staticLinkUrl}
                                        onChange={(e) => setStaticLinkUrl(e.target.value)}
                                        placeholder="Contoh: https://wa.me/... atau #produk"
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            {/* Optional Image Upload */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Gambar Banner Statis (Opsional)
                                </label>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary-500 rounded-2xl p-4 text-center cursor-pointer transition-all bg-slate-50 dark:bg-slate-800/40 w-full sm:w-80">
                                        <input
                                            type="file"
                                            accept="image/png, image/jpeg, image/webp, image/jpg"
                                            onChange={handleStaticImageChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                        <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 text-xs font-bold">
                                            <IconUpload size={18} />
                                            <span>Unggah Gambar Banner</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, WebP hingga 3MB</p>
                                    </div>

                                    {staticImagePreview && (
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={staticImagePreview}
                                                alt="Preview"
                                                className="h-14 rounded-xl border border-slate-200 dark:border-slate-700 object-cover shadow-xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemoveStaticImage}
                                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold cursor-pointer"
                                            >
                                                Hapus Gambar
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    Jika gambar diunggah, banner akan merender grafis gambar penuh (seperti banner Alfagift). Jika tidak diunggah, banner otomatis merender kartu gradien teks yang elegan.
                                </p>
                            </div>

                            {/* Live Preview Card */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">
                                    Preview Tampilan Banner Statis di Katalog:
                                </p>
                                {staticImagePreview ? (
                                    <div className="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs relative bg-slate-900">
                                        <img
                                            src={staticImagePreview}
                                            alt={staticTitle || "Banner Statis"}
                                            className="w-full h-auto object-cover max-h-[160px]"
                                        />
                                    </div>
                                ) : (
                                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-primary-600 to-sky-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-sm">
                                        <div>
                                            {staticBadge && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white font-extrabold text-[9px] uppercase tracking-wider mb-1">
                                                    <IconSparkles size={11} className="text-amber-300" />
                                                    {staticBadge}
                                                </span>
                                            )}
                                            <h4 className="font-extrabold text-sm sm:text-base leading-tight">
                                                {staticTitle || "Penawaran Spesial Pelanggan"}
                                            </h4>
                                            <p className="text-xs text-white/90 mt-0.5">
                                                {staticSubtitle || "Pesan langsung mudah dan cepat via WhatsApp."}
                                            </p>
                                        </div>
                                        <span className="inline-flex self-start sm:self-center px-3.5 py-1.5 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-xs shrink-0">
                                            {staticActionText || "Belanja Sekarang"} →
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={isSavingStatic}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all cursor-pointer"
                                >
                                    <IconDeviceFloppy size={16} />
                                    <span>{isSavingStatic ? "Menyimpan..." : "Simpan Pengaturan Banner Statis"}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* Modal Tambah / Edit Banner */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                {editingBanner ? "Edit Banner Promo" : "Tambah Banner Promo Baru"}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* Upload Gambar */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Gambar Banner <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary-500 rounded-2xl p-4 text-center cursor-pointer transition-all bg-slate-50 dark:bg-slate-800/40">
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/webp, image/jpg"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                    {formImagePreview ? (
                                        <div className="space-y-2">
                                            <div className="aspect-[16/6] rounded-xl overflow-hidden bg-slate-200">
                                                <img
                                                    src={formImagePreview}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <p className="text-[11px] text-primary-600 font-bold">
                                                Klik untuk mengganti gambar
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="py-4">
                                            <IconPhoto size={36} className="mx-auto text-slate-400 mb-2" />
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                Pilih atau Tarik Gambar Banner ke Sini
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                Disarankan rasio lebar: 16:6 atau 21:9 (Contoh: 1200x450 piksel). Format JPG, PNG, WebP (Maks 3MB).
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Judul & Subjudul */}
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Judul Promo (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formTitle}
                                        onChange={(e) => setFormTitle(e.target.value)}
                                        placeholder="Contoh: Promo Gantung Gajian Untung"
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Subjudul / Periode Promo (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formSubtitle}
                                        onChange={(e) => setFormSubtitle(e.target.value)}
                                        placeholder="Contoh: Periode 1 - 7 September 2026 *S&K Berlaku"
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            {/* Target Kategori atau URL */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Filter Kategori (Saat Diklik)
                                    </label>
                                    <select
                                        value={formCategoryId}
                                        onChange={(e) => setFormCategoryId(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                    >
                                        <option value="">-- Tanpa Filter Kategori --</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Jika dipilih, klik banner akan menyaring produk kategori ini.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Tautan Eksternal / URL
                                    </label>
                                    <input
                                        type="url"
                                        value={formLinkUrl}
                                        onChange={(e) => setFormLinkUrl(e.target.value)}
                                        placeholder="https://wa.me/... atau link info"
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            {/* Urutan & Status */}
                            <div className="flex items-center justify-between pt-2">
                                <div className="w-1/3">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Nomor Urutan
                                    </label>
                                    <input
                                        type="number"
                                        value={formSortOrder}
                                        onChange={(e) => setFormSortOrder(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                                        min="0"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                                        Status Tampil
                                    </label>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formIsActive}
                                            onChange={(e) => setFormIsActive(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                                        <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            {formIsActive ? "Aktif" : "Nonaktif"}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all"
                                >
                                    {isSubmitting ? "Menyimpan..." : editingBanner ? "Simpan Perubahan" : "Unggah Banner"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
