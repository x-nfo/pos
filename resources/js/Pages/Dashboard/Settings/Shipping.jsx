import React, { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm } from "@inertiajs/react";
import toast from "react-hot-toast";
import axios from "axios";
import {
    IconTruckDelivery,
    IconDeviceFloppy,
    IconSearch,
    IconMapPin,
    IconCheck,
    IconX,
    IconRefresh,
    IconPlugConnected,
    IconAlertCircle,
    IconLoader2,
    IconShieldCheck,
    IconKey,
    IconScale,
    IconWorld,
} from "@tabler/icons-react";

export default function Shipping({ settings, allCouriers = [] }) {
    const { data, setData, post, processing, errors } = useForm({
        rajaongkir_is_active: settings.rajaongkir_is_active ?? true,
        rajaongkir_api_key: settings.rajaongkir_api_key || "",
        rajaongkir_base_url: settings.rajaongkir_base_url || "https://rajaongkir.komerce.id/api/v1",
        rajaongkir_origin_id: settings.rajaongkir_origin_id || "",
        rajaongkir_origin_label: settings.rajaongkir_origin_label || "",
        rajaongkir_couriers: settings.rajaongkir_couriers || "jne,jnt,sicepat,pos,tiki,anteraja",
        rajaongkir_default_weight: settings.rajaongkir_default_weight || 1000,
    });

    const [showKey, setShowKey] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [clearingCache, setClearingCache] = useState(false);

    // Origin autocomplete search states
    const [originSearch, setOriginSearch] = useState(data.rajaongkir_origin_label || "");
    const [originResults, setOriginResults] = useState([]);
    const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
    const [showOriginDropdown, setShowOriginDropdown] = useState(false);
    const originTimerRef = useRef(null);
    const originDropdownRef = useRef(null);

    // Enabled couriers set
    const enabledCouriersSet = new Set(
        (data.rajaongkir_couriers || "")
            .split(",")
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean)
    );

    // Close origin dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (originDropdownRef.current && !originDropdownRef.current.contains(event.target)) {
                setShowOriginDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleOriginSearchChange = (e) => {
        const val = e.target.value;
        setOriginSearch(val);

        if (originTimerRef.current) clearTimeout(originTimerRef.current);

        if (val.trim().length < 3) {
            setOriginResults([]);
            setShowOriginDropdown(false);
            return;
        }

        originTimerRef.current = setTimeout(async () => {
            setIsSearchingOrigin(true);
            try {
                const res = await axios.get(route("shipping.rajaongkir.destinations"), {
                    params: { search: val.trim(), limit: 8 },
                });
                if (res.data.success) {
                    setOriginResults(res.data.data || []);
                    setShowOriginDropdown(true);
                }
            } catch (e) {
                console.error("Origin search error:", e);
            } finally {
                setIsSearchingOrigin(false);
            }
        }, 350);
    };

    const handleSelectOrigin = (item) => {
        setData((prev) => ({
            ...prev,
            rajaongkir_origin_id: item.id,
            rajaongkir_origin_label: item.label,
        }));
        setOriginSearch(item.label);
        setShowOriginDropdown(false);
        toast.success(`Asal pengiriman diset: ${item.label}`);
    };

    const toggleCourier = (code) => {
        const current = new Set(enabledCouriersSet);
        if (current.has(code)) {
            if (current.size === 1) {
                toast.error("Minimal harus mengaktifkan 1 kurir.");
                return;
            }
            current.delete(code);
        } else {
            current.add(code);
        }
        setData("rajaongkir_couriers", Array.from(current).join(","));
    };

    const handleTestConnection = async () => {
        setTestLoading(true);
        setTestResult(null);
        try {
            const res = await axios.post(route("settings.shipping.test"), {
                api_key: data.rajaongkir_api_key,
                base_url: data.rajaongkir_base_url,
            });
            setTestResult(res.data);
            if (res.data.success) {
                toast.success(res.data.message);
            } else {
                toast.error(res.data.message);
            }
        } catch (e) {
            setTestResult({
                success: false,
                message: e.response?.data?.message || "Gagal menghubungi API RajaOngkir.",
            });
            toast.error("Koneksi gagal.");
        } finally {
            setTestLoading(false);
        }
    };

    const handleClearCache = async () => {
        setClearingCache(true);
        try {
            const res = await axios.post(route("settings.shipping.clear-cache"));
            toast.success(res.data.message || "Cache berhasil dibersihkan");
        } catch (e) {
            toast.error("Gagal membersihkan cache");
        } finally {
            setClearingCache(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route("settings.shipping.update"), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Pengaturan RajaOngkir berhasil disimpan!");
            },
            onError: () => {
                toast.error("Mohon periksa kembali formulir.");
            },
        });
    };

    return (
        <DashboardLayout>
            <Head title="Pengaturan Pengiriman & RajaOngkir" />

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                            <IconTruckDelivery size={28} strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                                Pengaturan Pengiriman (RajaOngkir)
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                Konfigurasi API RajaOngkir / Komerce untuk perhitungan ongkos kirim otomatis di POS dan Katalog.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleClearCache}
                            disabled={clearingCache}
                            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <IconRefresh size={16} className={clearingCache ? "animate-spin" : ""} />
                            <span>Hapus Cache</span>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Status Toggle Card */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Aktifkan Perhitungan Ongkir RajaOngkir
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Izinkan kasir dan pelanggan mengecek tarif pengiriman ekspedisi secara real-time.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={data.rajaongkir_is_active}
                                onChange={(e) => setData("rajaongkir_is_active", e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                    </div>

                    {/* API Credentials Card */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                            <IconKey size={20} className="text-primary-600 dark:text-primary-400" />
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Kredensial API RajaOngkir / Komerce
                            </h3>
                        </div>

                        {/* API Key */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    API Key RajaOngkir
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
                                >
                                    {showKey ? "Sembunyikan" : "Tampilkan"}
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={data.rajaongkir_api_key}
                                    onChange={(e) => setData("rajaongkir_api_key", e.target.value)}
                                    placeholder="Masukkan API Key RajaOngkir / Komerce..."
                                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-mono transition-all"
                                />
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                Dapatkan API Key di portal Komerce / RajaOngkir (https://rajaongkir.komerce.id atau collaborator.komerce.id).
                            </p>
                            {errors.rajaongkir_api_key && (
                                <p className="mt-1 text-xs text-rose-500">{errors.rajaongkir_api_key}</p>
                            )}
                        </div>

                        {/* Base URL */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Base URL API
                            </label>
                            <div className="relative">
                                <IconWorld size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={data.rajaongkir_base_url}
                                    onChange={(e) => setData("rajaongkir_base_url", e.target.value)}
                                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-mono transition-all"
                                />
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                Default: <code>https://rajaongkir.komerce.id/api/v1</code> (Komerce v1 API)
                            </p>
                        </div>

                        {/* Test Connection Button */}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={testLoading || !data.rajaongkir_api_key}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {testLoading ? (
                                    <>
                                        <IconLoader2 size={16} className="animate-spin text-primary-500" />
                                        <span>Menguji Koneksi...</span>
                                    </>
                                ) : (
                                    <>
                                        <IconPlugConnected size={16} />
                                        <span>Uji Koneksi API</span>
                                    </>
                                )}
                            </button>

                            {testResult && (
                                <div
                                    className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                                        testResult.success
                                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                                            : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                                    }`}
                                >
                                    {testResult.success ? (
                                        <IconShieldCheck size={18} className="shrink-0 text-emerald-600" />
                                    ) : (
                                        <IconAlertCircle size={18} className="shrink-0 text-rose-600" />
                                    )}
                                    <span>{testResult.message}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Origin & Shipment Settings Card */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-5">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                            <IconMapPin size={20} className="text-primary-600 dark:text-primary-400" />
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Lokasi Asal & Parameter Pengiriman
                            </h3>
                        </div>

                        {/* Origin Search */}
                        <div className="relative" ref={originDropdownRef}>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Lokasi Asal Toko (Origin Destination ID)
                            </label>
                            <div className="relative">
                                <IconSearch
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                />
                                <input
                                    type="text"
                                    value={originSearch}
                                    onChange={handleOriginSearchChange}
                                    onFocus={() => {
                                        if (originResults.length > 0) setShowOriginDropdown(true);
                                    }}
                                    placeholder="Cari kecamatan / kota asal toko (cth: Sukajadi, Bandung)..."
                                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                                {isSearchingOrigin && (
                                    <IconLoader2
                                        size={18}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 animate-spin"
                                    />
                                )}
                            </div>

                            {/* Origin Dropdown results */}
                            {showOriginDropdown && originResults.length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
                                    {originResults.map((dest) => (
                                        <button
                                            key={dest.id}
                                            type="button"
                                            onClick={() => handleSelectOrigin(dest)}
                                            className="w-full text-left px-3.5 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-950/40 border-b border-slate-100 dark:border-slate-700/60 last:border-0 transition-colors cursor-pointer"
                                        >
                                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                {dest.subdistrict_name && dest.subdistrict_name !== "-"
                                                    ? `${dest.subdistrict_name}, `
                                                    : ""}
                                                {dest.district_name}, {dest.city_name}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {dest.province_name} • Kodepos: {dest.zip_code || "-"} (ID: {dest.id})
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {data.rajaongkir_origin_id && (
                                <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                                    <span className="font-medium">
                                        ✓ Origin ID: <strong>{data.rajaongkir_origin_id}</strong> &mdash;{" "}
                                        {data.rajaongkir_origin_label || originSearch}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Default Weight */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Berat Default Produk (Gram)
                            </label>
                            <div className="relative">
                                <IconScale size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="number"
                                    min="1"
                                    step="50"
                                    value={data.rajaongkir_default_weight}
                                    onChange={(e) => setData("rajaongkir_default_weight", e.target.value)}
                                    className="w-full h-11 pl-10 pr-16 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-mono transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                    {Number(data.rajaongkir_default_weight) / 1000} kg
                                </span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                Digunakan sebagai estimasi berat saat produk di katalog belum memiliki berat spesifik.
                            </p>
                        </div>

                        {/* Enabled Couriers */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Ekspedisi yang Diaktifkan
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                {allCouriers.map((courier) => {
                                    const isChecked = enabledCouriersSet.has(courier.code);
                                    return (
                                        <button
                                            key={courier.code}
                                            type="button"
                                            onClick={() => toggleCourier(courier.code)}
                                            className={`p-3 rounded-xl border text-left flex items-start justify-between transition-all cursor-pointer ${
                                                isChecked
                                                    ? "bg-primary-50/60 dark:bg-primary-950/40 border-primary-500 dark:border-primary-500 ring-1 ring-primary-500"
                                                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            <div>
                                                <div className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200">
                                                    {courier.name}
                                                </div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                                    {courier.description}
                                                </div>
                                            </div>
                                            <div
                                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ml-1.5 transition-colors ${
                                                    isChecked
                                                        ? "bg-primary-600 text-white"
                                                        : "border border-slate-300 dark:border-slate-600 text-transparent"
                                                }`}
                                            >
                                                <IconCheck size={14} strokeWidth={3} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Submit Bar */}
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <IconDeviceFloppy size={18} />
                            <span>{processing ? "Menyimpan..." : "Simpan Pengaturan"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}

