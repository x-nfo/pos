import React, { useEffect, useState, useRef } from "react";
import { Head, useForm, Link, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconArrowLeft,
    IconCheck,
    IconBuildingBank,
    IconUpload,
    IconTrash,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import Input from "@/Components/Dashboard/Input";
import { useAuthorization } from "@/Utils/authorization";
import { getBankLogoUrl } from "@/Utils/imageUrl";

export default function BankAccountForm({ bankAccount = null }) {
    const isEdit = !!bankAccount;
    const { flash } = usePage().props;
    const { can } = useAuthorization();
    const canUpdatePaymentSettings = can("payment-settings-update");
    const fileInputRef = useRef(null);

    const initialLogo = getBankLogoUrl(bankAccount?.logo_url || bankAccount?.logo);
    const [logoPreview, setLogoPreview] = useState(initialLogo);
    const [imageError, setImageError] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        _method: isEdit ? "PUT" : "POST",
        bank_name: bankAccount?.bank_name || "",
        account_number: bankAccount?.account_number || "",
        account_name: bankAccount?.account_name || "",
        logo: null,
        remove_logo: false,
        is_active: bankAccount?.is_active ?? true,
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

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
                logo: file,
                remove_logo: false,
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
            logo: null,
            remove_logo: true,
        }));
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (isEdit) {
            post(route("settings.bank-accounts.update", bankAccount.id), {
                forceFormData: true,
            });
        } else {
            post(route("settings.bank-accounts.store"), {
                forceFormData: true,
            });
        }
    };

    return (
        <>
            <Head title={isEdit ? "Edit Rekening Bank" : "Tambah Rekening Bank"} />
            <div className="max-w-3xl space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <IconBuildingBank size={28} className="text-primary-500" />
                            {isEdit ? "Edit Rekening Bank" : "Tambah Rekening Bank"}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Masukkan detail rekening bank untuk pembayaran transfer.
                        </p>
                    </div>
                    <Link
                        href={route("settings.bank-accounts.index")}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                        <IconArrowLeft size={18} />
                        Kembali
                    </Link>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Nama Bank"
                            placeholder="BCA, Mandiri, BNI..."
                            value={data.bank_name}
                            onChange={(e) => setData("bank_name", e.target.value)}
                            errors={errors.bank_name}
                            disabled={!canUpdatePaymentSettings}
                        />
                        <Input
                            label="Nomor Rekening"
                            placeholder="1234567890"
                            value={data.account_number}
                            onChange={(e) => setData("account_number", e.target.value)}
                            errors={errors.account_number}
                            disabled={!canUpdatePaymentSettings}
                        />
                    </div>

                    <Input
                        label="Atas Nama"
                        placeholder="Nama pemilik rekening"
                        value={data.account_name}
                        onChange={(e) => setData("account_name", e.target.value)}
                        errors={errors.account_name}
                        disabled={!canUpdatePaymentSettings}
                    />

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Logo Bank (opsional)
                        </label>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center p-2 overflow-hidden shrink-0 shadow-inner">
                                {logoPreview && !imageError ? (
                                    <img
                                        src={logoPreview}
                                        alt={data.bank_name || "Logo Bank"}
                                        className="max-w-full max-h-full object-contain"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <div className="text-center text-slate-400 dark:text-slate-500">
                                        <IconBuildingBank size={28} className="mx-auto" />
                                        <span className="text-[10px] block mt-0.5 font-medium">Tanpa Logo</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 space-y-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    id="bank_logo_input"
                                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                                    onChange={handleFileChange}
                                    disabled={!canUpdatePaymentSettings}
                                    className="hidden"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    <label
                                        htmlFor="bank_logo_input"
                                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                                            !canUpdatePaymentSettings
                                                ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800"
                                                : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
                                        }`}
                                    >
                                        <IconUpload size={16} />
                                        {logoPreview ? "Ganti Logo" : "Pilih Logo"}
                                    </label>

                                    {logoPreview && canUpdatePaymentSettings && (
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
                                {errors.logo && (
                                    <p className="text-xs text-danger-500 font-medium">
                                        {errors.logo}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={data.is_active}
                                onChange={(e) => setData("is_active", e.target.checked)}
                                disabled={!canUpdatePaymentSettings}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                            />
                            Rekening Aktif (ditampilkan saat transaksi)
                        </label>
                    </div>

                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="submit"
                            disabled={processing || !canUpdatePaymentSettings}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                        >
                            <IconCheck size={18} />
                            {isEdit ? "Update" : "Simpan"}
                        </button>
                        <Link
                            href={route("settings.bank-accounts.index")}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                        >
                            Batal
                        </Link>
                    </div>
                </form>
            </div>
        </>
    );
}

BankAccountForm.layout = (page) => <DashboardLayout children={page} />;

