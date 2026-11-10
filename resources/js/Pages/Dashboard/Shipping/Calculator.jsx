import React, { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link } from "@inertiajs/react";
import axios from "axios";
import toast from "react-hot-toast";
import {
    IconTruckDelivery,
    IconSearch,
    IconScale,
    IconMapPin,
    IconClock,
    IconAlertCircle,
    IconLoader2,
    IconX,
    IconCheck,
    IconArrowRight,
    IconSettings,
} from "@tabler/icons-react";

export default function ShippingCalculator({
    isConfigured = false,
    defaultOrigin = {},
    defaultWeight = 1000,
    couriers = [],
    allCouriers = [],
}) {
    // Origin state
    const [originQuery, setOriginQuery] = useState(defaultOrigin?.label || "");
    const [originResults, setOriginResults] = useState([]);
    const [selectedOrigin, setSelectedOrigin] = useState(
        defaultOrigin?.id
            ? { id: defaultOrigin.id, label: defaultOrigin.label }
            : null
    );
    const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
    const [showOriginDropdown, setShowOriginDropdown] = useState(false);

    // Destination state
    const [destQuery, setDestQuery] = useState("");
    const [destResults, setDestResults] = useState([]);
    const [selectedDest, setSelectedDest] = useState(null);
    const [isSearchingDest, setIsSearchingDest] = useState(false);
    const [showDestDropdown, setShowDestDropdown] = useState(false);

    // Weight and Courier
    const [weight, setWeight] = useState(defaultWeight || 1000);
    const [selectedCourier, setSelectedCourier] = useState("all");

    // Results
    const [loading, setLoading] = useState(false);
    const [rates, setRates] = useState([]);
    const [hasCalculated, setHasCalculated] = useState(false);

    const originTimerRef = useRef(null);
    const destTimerRef = useRef(null);
    const originDropdownRef = useRef(null);
    const destDropdownRef = useRef(null);

    // Close dropdowns on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (originDropdownRef.current && !originDropdownRef.current.contains(event.target)) {
                setShowOriginDropdown(false);
            }
            if (destDropdownRef.current && !destDropdownRef.current.contains(event.target)) {
                setShowDestDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleOriginChange = (e) => {
        const val = e.target.value;
        setOriginQuery(val);
        setSelectedOrigin(null);

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
                console.error(e);
            } finally {
                setIsSearchingOrigin(false);
            }
        }, 350);
    };

    const handleDestChange = (e) => {
        const val = e.target.value;
        setDestQuery(val);
        setSelectedDest(null);

        if (destTimerRef.current) clearTimeout(destTimerRef.current);
        if (val.trim().length < 3) {
            setDestResults([]);
            setShowDestDropdown(false);
            return;
        }

        destTimerRef.current = setTimeout(async () => {
            setIsSearchingDest(true);
            try {
                const res = await axios.get(route("shipping.rajaongkir.destinations"), {
                    params: { search: val.trim(), limit: 8 },
                });
                if (res.data.success) {
                    setDestResults(res.data.data || []);
                    setShowDestDropdown(true);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearchingDest(false);
            }
        }, 350);
    };

    const handleCalculate = async (e) => {
        e.preventDefault();
        if (!selectedOrigin?.id) {
            toast.error("Pilih lokasi asal pengiriman.");
            return;
        }
        if (!selectedDest?.id) {
            toast.error("Pilih destinasi tujuan pengiriman.");
            return;
        }
        if (!weight || Number(weight) <= 0) {
            toast.error("Berat harus lebih dari 0 gram.");
            return;
        }

        setLoading(true);
        setRates([]);
        setHasCalculated(true);

        try {
            const res = await axios.post(route("shipping.rajaongkir.calculate"), {
                origin_id: selectedOrigin.id,
                destination_id: selectedDest.id,
                weight: Number(weight),
                courier: selectedCourier,
            });

            if (res.data.success) {
                setRates(res.data.options || []);
                if (!res.data.options || res.data.options.length === 0) {
                    toast("Tidak ada opsi ongkir ditemukan untuk rute ini.", { icon: "⚠️" });
                }
            } else {
                toast.error(res.data.message || "Gagal menghitung ongkos kirim.");
            }
        } catch (e) {
            toast.error(e.response?.data?.message || "Terjadi kesalahan koneksi.");
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (p) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(p || 0);

    return (
        <DashboardLayout>
            <Head title="Kalkulator Ongkos Kirim (RajaOngkir)" />

            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                            <IconTruckDelivery size={28} strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                                Cek Ongkos Kirim (RajaOngkir)
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                Cek dan bandingkan tarif pengiriman domestik seluruh Indonesia secara real-time.
                            </p>
                        </div>
                    </div>

                    <Link
                        href={route("settings.shipping.edit")}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                        <IconSettings size={16} />
                        <span>Pengaturan RajaOngkir</span>
                    </Link>
                </div>

                {!isConfigured && (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
                        <IconAlertCircle size={20} className="shrink-0 mt-0.5 text-amber-600" />
                        <div>
                            <span className="font-bold">API Key RajaOngkir belum dikonfigurasi.</span>
                            <p className="text-xs mt-0.5">
                                Silakan masukkan API Key Anda di{" "}
                                <Link
                                    href={route("settings.shipping.edit")}
                                    className="font-bold underline hover:text-amber-950 dark:hover:text-amber-100"
                                >
                                    Pengaturan Pengiriman
                                </Link>{" "}
                                agar fitur cek ongkir dapat bekerja.
                            </p>
                        </div>
                    </div>
                )}

                {/* Form Card */}
                <form
                    onSubmit={handleCalculate}
                    className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-5"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Origin */}
                        <div className="relative" ref={originDropdownRef}>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Kota / Kecamatan Asal
                            </label>
                            <div className="relative">
                                <IconMapPin
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                />
                                <input
                                    type="text"
                                    value={originQuery}
                                    onChange={handleOriginChange}
                                    onFocus={() => {
                                        if (originResults.length > 0) setShowOriginDropdown(true);
                                    }}
                                    placeholder="Ketik minimal 3 huruf kota asal..."
                                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                                {isSearchingOrigin && (
                                    <IconLoader2
                                        size={18}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 animate-spin"
                                    />
                                )}
                            </div>

                            {showOriginDropdown && originResults.length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
                                    {originResults.map((dest) => (
                                        <button
                                            key={dest.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedOrigin(dest);
                                                setOriginQuery(dest.label);
                                                setShowOriginDropdown(false);
                                            }}
                                            className="w-full text-left px-3.5 py-2 hover:bg-primary-50 dark:hover:bg-primary-950/40 border-b border-slate-100 dark:border-slate-700/60 last:border-0 text-xs"
                                        >
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                {dest.district_name}, {dest.city_name}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {dest.province_name} • {dest.zip_code}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {selectedOrigin && (
                                <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                    <IconCheck size={14} /> Asal: {selectedOrigin.label}
                                </p>
                            )}
                        </div>

                        {/* Destination */}
                        <div className="relative" ref={destDropdownRef}>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Kota / Kecamatan Tujuan
                            </label>
                            <div className="relative">
                                <IconMapPin
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                />
                                <input
                                    type="text"
                                    value={destQuery}
                                    onChange={handleDestChange}
                                    onFocus={() => {
                                        if (destResults.length > 0) setShowDestDropdown(true);
                                    }}
                                    placeholder="Ketik minimal 3 huruf kota tujuan..."
                                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                                {isSearchingDest && (
                                    <IconLoader2
                                        size={18}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 animate-spin"
                                    />
                                )}
                            </div>

                            {showDestDropdown && destResults.length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
                                    {destResults.map((dest) => (
                                        <button
                                            key={dest.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedDest(dest);
                                                setDestQuery(dest.label);
                                                setShowDestDropdown(false);
                                            }}
                                            className="w-full text-left px-3.5 py-2 hover:bg-primary-50 dark:hover:bg-primary-950/40 border-b border-slate-100 dark:border-slate-700/60 last:border-0 text-xs"
                                        >
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                {dest.district_name}, {dest.city_name}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {dest.province_name} • {dest.zip_code}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {selectedDest && (
                                <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                    <IconCheck size={14} /> Tujuan: {selectedDest.label}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Weight */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Berat Paket (Gram)
                            </label>
                            <div className="relative">
                                <IconScale size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="number"
                                    min="1"
                                    step="100"
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    className="w-full h-11 pl-10 pr-16 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-mono transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                    {Number(weight) > 0 ? `${(Number(weight) / 1000).toFixed(1)} kg` : "g"}
                                </span>
                            </div>
                        </div>

                        {/* Courier */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Filter Kurir Ekspedisi
                            </label>
                            <select
                                value={selectedCourier}
                                onChange={(e) => setSelectedCourier(e.target.value)}
                                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            >
                                <option value="all">⚡ Semua Kurir (Bandingkan Seluruh Harga)</option>
                                {(couriers.length > 0 ? couriers : allCouriers).map((c) => (
                                    <option key={c.code} value={c.code}>
                                        {c.name} ({c.code.toUpperCase()})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={loading || !selectedOrigin || !selectedDest}
                            className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <IconLoader2 size={18} className="animate-spin" />
                                    <span>Menghitung Tarif...</span>
                                </>
                            ) : (
                                <>
                                    <IconSearch size={18} />
                                    <span>Cek Ongkos Kirim</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Rates Output */}
                {loading && (
                    <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <IconLoader2 size={36} className="animate-spin text-primary-500 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            Mengambil tarif ongkir dari ekspedisi...
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Membandingkan biaya kirim secara paralel dari berbagai kurir.
                        </p>
                    </div>
                )}

                {!loading && hasCalculated && rates.length === 0 && (
                    <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <IconAlertCircle size={40} className="mx-auto mb-2 text-slate-400" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            Tidak ada layanan ongkir yang ditemukan
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Silakan coba pilihan kurir lain atau cek kembali tujuan pengiriman.
                        </p>
                    </div>
                )}

                {!loading && rates.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                                Hasil Perhitungan ({rates.length} Opsi Layanan)
                            </h2>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Diurutkan dari biaya termurah
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {rates.map((rate) => (
                                <div
                                    key={rate.id}
                                    className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 shadow-xs flex flex-col justify-between transition-all"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 font-extrabold text-xs uppercase text-slate-800 dark:text-slate-200">
                                                {rate.courier_code}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold text-xs">
                                                {rate.service}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            {rate.courier_name}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                            {rate.description || "Layanan Reguler"}
                                        </p>
                                    </div>

                                    <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-end justify-between">
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {rate.etd && (
                                                <div className="flex items-center gap-1">
                                                    <IconClock size={13} />
                                                    <span>{rate.etd.includes("day") || rate.etd.includes("hari") ? rate.etd : `${rate.etd} hari`}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-primary-600 dark:text-primary-400">
                                                {formatPrice(rate.cost)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

