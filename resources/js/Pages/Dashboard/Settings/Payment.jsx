import React, { useEffect, useRef, useState } from "react";
import { Head, router, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Input from "@/Components/Dashboard/Input";
import Checkbox from "@/Components/Dashboard/Checkbox";
import { useAuthorization } from "@/Utils/authorization";
import {
    IconCreditCard,
    IconDeviceFloppy,
    IconBrandStripe,
    IconCash,
    IconQrcode,
    IconUpload,
    IconLoader2,
    IconCheck,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

export default function Payment({
    setting,
    paymentSettingSources = {},
    supportedGateways = [],
    webhookUrls = {},
    webhookWarnings = [],
}) {
    const { flash } = usePage().props;
    const { can } = useAuthorization();
    const canUpdatePaymentSettings = can("payment-settings-update");

    const [isUploadingQris, setIsUploadingQris] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const fileInputRef = useRef(null);

    const { data, setData, put, errors, processing } = useForm({
        default_gateway: setting?.default_gateway ?? "cash",
        bank_transfer_enabled: setting?.bank_transfer_enabled ?? false,
        midtrans_enabled: setting?.midtrans_enabled ?? false,
        midtrans_server_key: "",
        midtrans_client_key: setting?.midtrans_client_key ?? "",
        midtrans_production: setting?.midtrans_production ?? false,
        xendit_enabled: setting?.xendit_enabled ?? false,
        xendit_secret_key: "",
        xendit_public_key: setting?.xendit_public_key ?? "",
        xendit_callback_token: "",
        xendit_production: setting?.xendit_production ?? false,
        qrisly_enabled: setting?.qrisly_enabled ?? false,
        qrisly_api_key: "",
        qrisly_qris_id: setting?.qrisly_qris_id ?? "",
        qrisly_production: setting?.qrisly_production ?? false,
        qrisly_use_unique_amount: setting?.qrisly_use_unique_amount ?? true,
        receivable_approval_threshold: setting?.receivable_approval_threshold ?? 1000000,
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const handleSubmit = (e) => {
        e.preventDefault();
        put(route("settings.payments.update"), { preserveScroll: true });
    };

    const isGatewaySelectable = (gateway) => {
        if (gateway === "cash") return true;
        if (gateway === "midtrans") return data.midtrans_enabled;
        if (gateway === "xendit") return data.xendit_enabled;
        if (gateway === "qrisly") return data.qrisly_enabled;
        if (gateway === "bank_transfer") return data.bank_transfer_enabled;
        return false;
    };

    const renderSecretHint = (field, keepMessage) => {
        const source = paymentSettingSources?.[field];

        if (!source) {
            return null;
        }

        if (source.managed_by_environment) {
            return (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    Secret dikelola oleh environment dan tidak bisa diubah dari dashboard.
                </p>
            );
        }

        if (source.configured) {
            return (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tersimpan: <span className="font-medium">{source.masked}</span>. {keepMessage}
                </p>
            );
        }

        return null;
    };

    const handleQrisFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError("");
        setIsUploadingQris(true);

        const formData = new FormData();
        formData.append("qris_image", file);
        formData.append("name", "Store QRIS");
        if (data.qrisly_api_key) {
            formData.append("api_key", data.qrisly_api_key);
        }
        formData.append("is_production", data.qrisly_production ? "1" : "0");

        router.post(route("settings.payments.qrisly-upload"), formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page) => {
                setIsUploadingQris(false);
                if (page.props?.setting?.qrisly_qris_id) {
                    setData("qrisly_qris_id", page.props.setting.qrisly_qris_id);
                }
                if (fileInputRef.current) fileInputRef.current.value = "";
            },
            onError: (errs) => {
                setIsUploadingQris(false);
                setUploadError(errs?.qris_image || "Gagal mengunggah QRIS.");
                toast.error(errs?.qris_image || "Gagal mengunggah QRIS.");
                if (fileInputRef.current) fileInputRef.current.value = "";
            },
        });
    };

    return (
        <>
            <Head title="Pengaturan Payment" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconCreditCard size={28} className="text-primary-500" />
                    Pengaturan Payment Gateway
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Konfigurasi metode pembayaran dan gateway
                </p>
            </div>

            <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
                {/* Default Gateway */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <IconCash size={18} />
                        Gateway Default
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Gateway pembayaran default yang digunakan kasir saat
                        membuka halaman transaksi.
                    </p>
                    {!canUpdatePaymentSettings && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                            Anda hanya memiliki akses lihat. Perubahan payment settings memerlukan permission update dan konfirmasi password ulang.
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Pilih Gateway
                        </label>
                        <select
                            value={data.default_gateway}
                            onChange={(e) =>
                                setData("default_gateway", e.target.value)
                            }
                            disabled={!canUpdatePaymentSettings}
                            className="w-full h-11 px-4 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        >
                            {supportedGateways.map((gw) => (
                                <option
                                    key={gw.value}
                                    value={gw.value}
                                    disabled={!isGatewaySelectable(gw.value)}
                                >
                                    {gw.label}
                                    {!isGatewaySelectable(gw.value) &&
                                        " (nonaktif)"}
                                </option>
                            ))}
                        </select>
                        {errors?.default_gateway && (
                            <small className="text-xs text-danger-500 mt-1">
                                {errors.default_gateway}
                            </small>
                        )}
                    </div>
                </div>

                {/* Bank Transfer */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            🏦 Transfer Bank
                        </h3>
                        <label
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                                data.bank_transfer_enabled
                                    ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                        >
                            <Checkbox
                                checked={data.bank_transfer_enabled}
                                onChange={(e) =>
                                    setData(
                                        "bank_transfer_enabled",
                                        e.target.checked
                                    )
                                }
                                disabled={!canUpdatePaymentSettings}
                            />
                            {data.bank_transfer_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Pembayaran manual via transfer bank. Kasir akan
                        memasukkan transaksi dengan status pending, kemudian
                        admin mengkonfirmasi setelah dana diterima.
                    </p>
                    <a
                        href={route("settings.bank-accounts.index")}
                        className="inline-flex items-center gap-2 text-sm text-primary-500 hover:text-primary-600 font-medium"
                    >
                        Kelola Rekening Bank →
                    </a>
                </div>

                {/* QRISLY (RajaOngkir) */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <IconQrcode size={20} className="text-teal-500" />
                            QRIS (QRISLY by RajaOngkir)
                        </h3>
                        <label
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                                data.qrisly_enabled
                                    ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                        >
                            <Checkbox
                                checked={data.qrisly_enabled}
                                onChange={(e) =>
                                    setData(
                                        "qrisly_enabled",
                                        e.target.checked
                                    )
                                }
                                disabled={!canUpdatePaymentSettings}
                            />
                            {data.qrisly_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Dynamic QRIS otomatis berbasis Static QRIS merchant.
                        Membutuhkan API Key dari Komerce Collaborator & aplikasi listener notifikasi. Biaya Rp 100 per generate QRIS.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <Input
                                label="QRISLY API Key"
                                type="password"
                                value={data.qrisly_api_key}
                                onChange={(e) =>
                                    setData("qrisly_api_key", e.target.value)
                                }
                                errors={errors?.qrisly_api_key}
                                placeholder={
                                    paymentSettingSources?.qrisly_api_key?.configured
                                        ? "Kosongkan untuk mempertahankan nilai saat ini"
                                        : "your-qrisly-api-key"
                                }
                                disabled={
                                    !canUpdatePaymentSettings ||
                                    paymentSettingSources?.qrisly_api_key?.managed_by_environment
                                }
                            />
                            {renderSecretHint(
                                "qrisly_api_key",
                                "Isi ulang hanya jika ingin mengganti API Key."
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                QRIS ID Toko
                            </label>
                            <div className="flex gap-2 items-start">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={data.qrisly_qris_id}
                                        onChange={(e) =>
                                            setData("qrisly_qris_id", e.target.value)
                                        }
                                        placeholder="UUID QRIS ID dari QRISLY"
                                        disabled={!canUpdatePaymentSettings}
                                        className="w-full h-11 px-4 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors?.qrisly_qris_id && (
                                        <small className="text-xs text-danger-500 mt-1 block">
                                            {errors.qrisly_qris_id}
                                        </small>
                                    )}
                                </div>
                                <div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/png,image/jpeg,image/jpg"
                                        onChange={handleQrisFileUpload}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploadingQris || !canUpdatePaymentSettings}
                                        className="inline-flex items-center gap-1.5 h-11 px-4 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
                                    >
                                        {isUploadingQris ? (
                                            <IconLoader2 size={18} className="animate-spin text-primary-500" />
                                        ) : (
                                            <IconUpload size={18} />
                                        )}
                                        {isUploadingQris ? "Mengunggah..." : "Unggah QRIS"}
                                    </button>
                                </div>
                            </div>
                            {uploadError && (
                                <small className="text-xs text-danger-500 mt-1 block">
                                    {uploadError}
                                </small>
                            )}
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Masukkan QRIS ID secara manual atau unggah gambar QRIS statis toko (PNG/JPG maks 5MB) untuk didaftarkan secara otomatis.
                            </p>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    checked={data.qrisly_use_unique_amount}
                                    onChange={(e) =>
                                        setData(
                                            "qrisly_use_unique_amount",
                                            e.target.checked
                                        )
                                    }
                                    disabled={!canUpdatePaymentSettings}
                                />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    Tambahkan kode unik nominal otomatis (direkomendasikan untuk verifikasi pembayaran yang akurat)
                                </span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    checked={data.qrisly_production}
                                    onChange={(e) =>
                                        setData(
                                            "qrisly_production",
                                            e.target.checked
                                        )
                                    }
                                    disabled={!canUpdatePaymentSettings}
                                />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                    Mode Produksi (Production Base URL)
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Midtrans */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <IconBrandStripe size={18} />
                            Midtrans (Snap)
                        </h3>
                        <label
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                                data.midtrans_enabled
                                    ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                        >
                            <Checkbox
                                checked={data.midtrans_enabled}
                                onChange={(e) =>
                                    setData(
                                        "midtrans_enabled",
                                        e.target.checked
                                    )
                                }
                                disabled={!canUpdatePaymentSettings}
                            />
                            {data.midtrans_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Pembayaran online via Midtrans Snap (QRIS, GoPay, OVO,
                        Virtual Account, Kartu Kredit).
                    </p>

                    <div className="space-y-4">
                        <Input
                            label="Server Key"
                            type="password"
                            value={data.midtrans_server_key}
                            onChange={(e) =>
                                setData("midtrans_server_key", e.target.value)
                            }
                            errors={errors?.midtrans_server_key}
                            placeholder={
                                paymentSettingSources?.midtrans_server_key?.configured
                                    ? "Kosongkan untuk mempertahankan nilai saat ini"
                                    : "SB-Mid-server-..."
                            }
                            disabled={
                                !canUpdatePaymentSettings ||
                                paymentSettingSources?.midtrans_server_key?.managed_by_environment
                            }
                        />
                        {renderSecretHint(
                            "midtrans_server_key",
                            "Isi ulang hanya jika ingin mengganti server key."
                        )}
                        <Input
                            label="Client Key"
                            value={data.midtrans_client_key}
                            onChange={(e) =>
                                setData("midtrans_client_key", e.target.value)
                            }
                            errors={errors?.midtrans_client_key}
                            placeholder="SB-Mid-client-..."
                            disabled={!canUpdatePaymentSettings}
                        />
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                                checked={data.midtrans_production}
                                onChange={(e) =>
                                    setData(
                                        "midtrans_production",
                                        e.target.checked
                                    )
                                }
                                disabled={!canUpdatePaymentSettings}
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                Mode Produksi
                            </span>
                        </label>
                    </div>
                </div>

                {/* Xendit */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <IconCreditCard size={18} />
                            Xendit (Invoice)
                        </h3>
                        <label
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                                data.xendit_enabled
                                    ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                        >
                            <Checkbox
                                checked={data.xendit_enabled}
                                onChange={(e) =>
                                    setData("xendit_enabled", e.target.checked)
                                }
                                disabled={!canUpdatePaymentSettings}
                            />
                            {data.xendit_enabled ? "Aktif" : "Nonaktif"}
                        </label>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Pembayaran online via Xendit Invoice (QRIS, VA, E-Wallet,
                        Kartu Kredit).
                    </p>

                    <div className="space-y-4">
                        <Input
                            label="Secret Key"
                            type="password"
                            value={data.xendit_secret_key}
                            onChange={(e) =>
                                setData("xendit_secret_key", e.target.value)
                            }
                            errors={errors?.xendit_secret_key}
                            placeholder={
                                paymentSettingSources?.xendit_secret_key?.configured
                                    ? "Kosongkan untuk mempertahankan nilai saat ini"
                                    : "xnd_development_..."
                            }
                            disabled={
                                !canUpdatePaymentSettings ||
                                paymentSettingSources?.xendit_secret_key?.managed_by_environment
                            }
                        />
                        {renderSecretHint(
                            "xendit_secret_key",
                            "Isi ulang hanya jika ingin mengganti secret key."
                        )}
                        <Input
                            label="Public Key (Opsional)"
                            value={data.xendit_public_key}
                            onChange={(e) =>
                                setData("xendit_public_key", e.target.value)
                            }
                            errors={errors?.xendit_public_key}
                            placeholder="xnd_public_development_..."
                            disabled={!canUpdatePaymentSettings}
                        />
                        <Input
                            label="Callback Token"
                            type="password"
                            value={data.xendit_callback_token}
                            onChange={(e) =>
                                setData("xendit_callback_token", e.target.value)
                            }
                            errors={errors?.xendit_callback_token}
                            placeholder={
                                paymentSettingSources?.xendit_callback_token?.configured
                                    ? "Kosongkan untuk mempertahankan nilai saat ini"
                                    : "xendit-callback-token"
                            }
                            disabled={
                                !canUpdatePaymentSettings ||
                                paymentSettingSources?.xendit_callback_token?.managed_by_environment
                            }
                        />
                        {renderSecretHint(
                            "xendit_callback_token",
                            "Isi ulang hanya jika ingin mengganti token."
                        )}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                                checked={data.xendit_production}
                                onChange={(e) =>
                                    setData(
                                        "xendit_production",
                                        e.target.checked
                                    )
                                }
                                disabled={!canUpdatePaymentSettings}
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                Mode Produksi
                            </span>
                        </label>
                    </div>
                </div>

                {/* Kebijakan Approval Pelunasan Piutang */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                            <IconCreditCard size={22} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 dark:text-white">
                                Kebijakan Approval Pelunasan Piutang
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Atur batas nominal dan metode pembayaran pelunasan piutang yang memerlukan persetujuan Supervisor/Manager.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Batas Nominal Approval Tunai (Rp)"
                            type="number"
                            min="0"
                            step="10000"
                            value={data.receivable_approval_threshold}
                            onChange={(e) =>
                                setData("receivable_approval_threshold", e.target.value)
                            }
                            errors={errors?.receivable_approval_threshold}
                            placeholder="1000000"
                            disabled={!canUpdatePaymentSettings}
                        />
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        * Pembayaran dengan metode non-tunai (Transfer Bank, QRIS) atau tunai dengan nominal $\ge$ batas di atas akan otomatis masuk ke antrean persetujuan (status: Pending).
                    </p>
                </div>

                {/* Webhook URLs Info */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        🔗 Webhook URLs
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Salin URL berikut dan paste ke dashboard Midtrans, Xendit, atau QRISLY (Komerce)
                        sebagai Notification / Callback URL.
                    </p>
                    {webhookWarnings.length > 0 && (
                        <div className="mb-4 space-y-2">
                            {webhookWarnings.map((warning) => (
                                <div
                                    key={warning}
                                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                                >
                                    {warning}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                QRISLY (RajaOngkir) Webhook URL
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={webhookUrls.qrisly || ""}
                                    className="flex-1 h-10 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            webhookUrls.qrisly || ""
                                        );
                                        toast.success("URL disalin!");
                                    }}
                                    className="px-3 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Salin
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                Midtrans Notification URL
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={webhookUrls.midtrans || ""}
                                    className="flex-1 h-10 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            webhookUrls.midtrans || ""
                                        );
                                        toast.success("URL disalin!");
                                    }}
                                    className="px-3 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Salin
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                Xendit Callback URL
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={webhookUrls.xendit || ""}
                                    className="flex-1 h-10 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            webhookUrls.xendit || ""
                                        );
                                        toast.success("URL disalin!");
                                    }}
                                    className="px-3 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Salin
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={processing || !canUpdatePaymentSettings}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
                    >
                        <IconDeviceFloppy size={18} />
                        {processing ? "Menyimpan..." : "Simpan Konfigurasi"}
                    </button>
                </div>
            </form>
        </>
    );
}

Payment.layout = (page) => <DashboardLayout children={page} />;
