import { useForm } from "@inertiajs/react";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import toast from "react-hot-toast";
import { useState, useEffect, useRef } from "react";
import {
    IconBuildingStore,
    IconDeviceFloppy,
    IconPhone,
    IconMapPin,
    IconWorld,
    IconMail,
    IconPhoto,
    IconFileCertificate,
    IconReceiptTax,
    IconUpload,
    IconTrash,
} from "@tabler/icons-react";
import { getStoreLogoUrl } from "@/Utils/imageUrl";

export default function StoreTab({ settings }) {
    const initialLogo = getStoreLogoUrl(settings.store_logo);
    const [logoPreview, setLogoPreview] = useState(initialLogo);
    const [imageError, setImageError] = useState(false);
    const fileInputRef = useRef(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        store_name: settings.store_name || "",
        store_logo: null,
        remove_store_logo: false,
        store_address: settings.store_address || "",
        store_phone: settings.store_phone || "",
        store_email: settings.store_email || "",
        store_website: settings.store_website || "",
        store_city: settings.store_city || "",
        store_npwp: settings.store_npwp || "",
        store_nib: settings.store_nib || "",
        tax_default_rate: settings.tax_default_rate || "11.00",
    });

    useEffect(() => {
        const resolved = getStoreLogoUrl(settings.store_logo);
        setLogoPreview(resolved);
        setImageError(false);
    }, [settings.store_logo]);

    useEffect(() => {
        return () => {
            if (logoPreview && logoPreview.startsWith("blob:")) {
                URL.revokeObjectURL(logoPreview);
            }
        };
    }, [logoPreview]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setData((prev) => ({
                ...prev,
                store_logo: file,
                remove_store_logo: false,
            }));
            setImageError(false);
            if (logoPreview && logoPreview.startsWith("blob:")) {
                URL.revokeObjectURL(logoPreview);
            }
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveLogo = () => {
        if (logoPreview && logoPreview.startsWith("blob:")) {
            URL.revokeObjectURL(logoPreview);
        }
        setLogoPreview(null);
        setImageError(false);
        setData((prev) => ({
            ...prev,
            store_logo: null,
            remove_store_logo: true,
        }));
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const submit = (e) => {
        e.preventDefault();
        post(route("settings.store.update"), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                toast.success("Profil toko disimpan");
                reset("store_logo");
                setData("remove_store_logo", false);
            },
            onError: () => toast.error("Gagal menyimpan profil toko"),
        });
    };

    return (
        <>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Pengaturan Toko
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Atur identitas toko yang muncul di struk dan laporan.
                    </p>
                </div>

                <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Logo */}
                        <div className="lg:w-1/3">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                <IconPhoto size={18} />
                                Logo Toko
                            </label>
                            <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center p-2 overflow-hidden mb-3 shadow-inner">
                                {logoPreview && !imageError ? (
                                    <img
                                        src={logoPreview}
                                        alt="Logo Toko"
                                        className="max-w-full max-h-full object-contain"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <div className="text-center text-slate-400 dark:text-slate-500">
                                        <IconBuildingStore size={40} className="mx-auto" />
                                        <span className="text-[11px] block mt-1 font-medium">Tanpa Logo</span>
                                    </div>
                                )}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                id="store_logo_input"
                                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <label
                                    htmlFor="store_logo_input"
                                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
                                >
                                    <IconUpload size={16} />
                                    {logoPreview ? "Ganti Logo" : "Pilih Logo"}
                                </label>

                                {logoPreview && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveLogo}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-950/30 transition-colors"
                                    >
                                        <IconTrash size={16} />
                                        Hapus
                                    </button>
                                )}
                            </div>

                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                Format: PNG, JPG, JPEG, SVG, atau WEBP. Maksimal 2MB.
                            </p>
                            {errors.store_logo && (
                                <p className="text-xs text-danger-500 mt-1 font-medium">
                                    {errors.store_logo}
                                </p>
                            )}
                        </div>

                        {/* Info */}
                        <div className="lg:flex-1 space-y-4">
                            <Input
                                label="Nama Toko"
                                value={data.store_name}
                                errors={errors.store_name}
                                onChange={(e) => setData("store_name", e.target.value)}
                                placeholder="Nama toko"
                            />
                            <Textarea
                                label="Alamat Lengkap"
                                value={data.store_address}
                                errors={errors.store_address}
                                onChange={(e) => setData("store_address", e.target.value)}
                                rows={3}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Kota/Kabupaten"
                                    value={data.store_city}
                                    errors={errors.store_city}
                                    onChange={(e) => setData("store_city", e.target.value)}
                                    placeholder="contoh: Surabaya"
                                    icon={<IconMapPin size={16} />}
                                />
                                <Input
                                    label="Nomor Telepon"
                                    value={data.store_phone}
                                    errors={errors.store_phone}
                                    onChange={(e) => setData("store_phone", e.target.value)}
                                    placeholder="0812xxxxxxx"
                                    icon={<IconPhone size={16} />}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Email"
                                    type="email"
                                    value={data.store_email}
                                    errors={errors.store_email}
                                    onChange={(e) => setData("store_email", e.target.value)}
                                    placeholder="email@toko.com"
                                    icon={<IconMail size={16} />}
                                />
                                <Input
                                    label="Website / Sosial Media"
                                    value={data.store_website}
                                    errors={errors.store_website}
                                    onChange={(e) => setData("store_website", e.target.value)}
                                    placeholder="https://"
                                    icon={<IconWorld size={16} />}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tax & Legal Section */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <IconReceiptTax size={20} className="text-primary-500" />
                            Informasi Pajak & Legal
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="NPWP Toko"
                                value={data.store_npwp}
                                errors={errors.store_npwp}
                                onChange={(e) => setData("store_npwp", e.target.value)}
                                placeholder="XX.XXX.XXX.X-XXX.XXX"
                                icon={<IconFileCertificate size={16} />}
                            />
                            <Input
                                label="NIB"
                                value={data.store_nib}
                                errors={errors.store_nib}
                                onChange={(e) => setData("store_nib", e.target.value)}
                                placeholder="Nomor Induk Berusaha"
                            />
                        </div>
                        <div className="mt-4">
                            <Input
                                label="Tarif PPN Default (%)"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={data.tax_default_rate}
                                errors={errors.tax_default_rate}
                                onChange={(e) => setData("tax_default_rate", e.target.value)}
                                placeholder="11.00"
                            />
                            <p className="mt-1 text-xs text-slate-400">
                                Tarif default untuk produk baru. Dapat diubah per produk.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                        >
                            <IconDeviceFloppy size={18} />
                            {processing ? "Menyimpan..." : "Simpan Profil"}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

