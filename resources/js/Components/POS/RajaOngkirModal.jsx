import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
    IconTruckDelivery,
    IconSearch,
    IconX,
    IconScale,
    IconMapPin,
    IconClock,
    IconCheck,
    IconAlertCircle,
    IconLoader2,
    IconRefresh,
} from "@tabler/icons-react";

export default function RajaOngkirModal({
    isOpen,
    onClose,
    onSelectShipping,
    initialWeight = 1000,
    customerLocation = "",
}) {
    const [info, setInfo] = useState({
        enabled: true,
        has_api_key: true,
        origin_id: null,
        origin_label: "",
        default_weight: 1000,
        couriers: [],
    });

    const [destinationQuery, setDestinationQuery] = useState(customerLocation || "");
    const [destinationResults, setDestinationResults] = useState([]);
    const [selectedDestination, setSelectedDestination] = useState(null);
    const [isSearchingDest, setIsSearchingDest] = useState(false);
    const [showDestDropdown, setShowDestDropdown] = useState(false);

    const [weight, setWeight] = useState(initialWeight || 1000);
    const [selectedCourier, setSelectedCourier] = useState("all");
    const [loadingRates, setLoadingRates] = useState(false);
    const [rates, setRates] = useState([]);
    const [hasCalculated, setHasCalculated] = useState(false);

    const searchTimerRef = useRef(null);
    const dropdownRef = useRef(null);

    // Load initial info when modal opens
    useEffect(() => {
        if (!isOpen) return;

        axios
            .get(route("shipping.rajaongkir.info"))
            .then((res) => {
                setInfo(res.data);
                if (initialWeight > 0) {
                    setWeight(initialWeight);
                } else if (res.data.cart_weight > 0) {
                    setWeight(res.data.cart_weight);
                } else if (res.data.default_weight > 0) {
                    setWeight(res.data.default_weight);
                }
            })
            .catch(() => {
                toast.error("Gagal memuat konfigurasi RajaOngkir");
            });

        if (customerLocation && customerLocation.trim().length >= 3) {
            searchDestinations(customerLocation.trim());
        }
    }, [isOpen, initialWeight, customerLocation]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDestDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Search destination with debounce
    const handleDestinationInputChange = (e) => {
        const val = e.target.value;
        setDestinationQuery(val);
        setSelectedDestination(null);

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        if (val.trim().length < 3) {
            setDestinationResults([]);
            setShowDestDropdown(false);
            return;
        }

        searchTimerRef.current = setTimeout(() => {
            searchDestinations(val.trim());
        }, 350);
    };

    const searchDestinations = async (keyword) => {
        setIsSearchingDest(true);
        try {
            const res = await axios.get(route("shipping.rajaongkir.destinations"), {
                params: { search: keyword, limit: 8 },
            });
            if (res.data.success) {
                setDestinationResults(res.data.data || []);
                setShowDestDropdown(true);
            }
        } catch (e) {
            console.error("Destination search error:", e);
        } finally {
            setIsSearchingDest(false);
        }
    };

    const handleSelectDestinationItem = (dest) => {
        setSelectedDestination(dest);
        setDestinationQuery(dest.label);
        setShowDestDropdown(false);
        setRates([]);
        setHasCalculated(false);
    };

    const handleCalculate = async () => {
        if (!selectedDestination?.id) {
            toast.error("Pilih destinasi pengiriman terlebih dahulu");
            return;
        }

        if (!weight || Number(weight) <= 0) {
            toast.error("Berat harus lebih besar dari 0 gram");
            return;
        }

        setLoadingRates(true);
        setRates([]);
        setHasCalculated(true);

        try {
            const payload = {
                destination_id: selectedDestination.id,
                weight: Number(weight),
                courier: selectedCourier,
            };

            const res = await axios.post(route("shipping.rajaongkir.calculate"), payload);

            if (res.data.success) {
                setRates(res.data.options || []);
                if (!res.data.options || res.data.options.length === 0) {
                    toast("Tidak ada layanan ongkir yang tersedia untuk rute ini.", {
                        icon: "⚠️",
                    });
                }
            } else {
                toast.error(res.data.message || "Gagal menghitung ongkos kirim");
            }
        } catch (e) {
            const msg = e.response?.data?.message || "Terjadi kesalahan saat menghitung ongkir";
            toast.error(msg);
        } finally {
            setLoadingRates(false);
        }
    };

    const handleApplyShipping = (rate) => {
        if (onSelectShipping) {
            onSelectShipping({
                cost: rate.cost,
                courier: rate.courier_code,
                courier_name: rate.courier_name,
                service: rate.service,
                etd: rate.etd,
                weight: Number(weight),
                destination_id: selectedDestination?.id,
                destination_label: selectedDestination?.label || destinationQuery,
            });
        }
        toast.success(`Ongkir ${rate.courier_name} (${rate.service}) dipilih!`);
        onClose();
    };

    const formatPrice = (p) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(p || 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                            <IconTruckDelivery size={22} strokeWidth={2} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Cek Ongkos Kirim (RajaOngkir)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Asal:{" "}
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    {info.origin_label || "Toko Pusat (Default)"}
                                </span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <IconX size={20} />
                    </button>
                </div>

                {/* Form Inputs */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4 overflow-visible">
                    {!info.has_api_key && (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                            <IconAlertCircle size={18} className="shrink-0" />
                            <span>
                                API Key RajaOngkir belum dikonfigurasi di Pengaturan Toko.
                            </span>
                        </div>
                    )}

                    {/* Destination Search */}
                    <div className="relative" ref={dropdownRef}>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Destinasi Pengiriman (Kecamatan / Kota / Kode Pos)
                        </label>
                        <div className="relative">
                            <IconMapPin
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <input
                                type="text"
                                value={destinationQuery}
                                onChange={handleDestinationInputChange}
                                onFocus={() => {
                                    if (destinationResults.length > 0) setShowDestDropdown(true);
                                }}
                                placeholder="Ketik minimal 3 huruf (cth: Sukajadi, Bandung, 40162)..."
                                className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            />
                            {isSearchingDest && (
                                <IconLoader2
                                    size={18}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 animate-spin"
                                />
                            )}
                            {!isSearchingDest && destinationQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDestinationQuery("");
                                        setSelectedDestination(null);
                                        setDestinationResults([]);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <IconX size={16} />
                                </button>
                            )}
                        </div>

                        {/* Dropdown search results */}
                        {showDestDropdown && destinationResults.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
                                {destinationResults.map((dest) => (
                                    <button
                                        key={dest.id}
                                        type="button"
                                        onClick={() => handleSelectDestinationItem(dest)}
                                        className="w-full text-left px-3.5 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-950/40 border-b border-slate-100 dark:border-slate-700/60 last:border-0 transition-colors cursor-pointer"
                                    >
                                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                            {dest.subdistrict_name && dest.subdistrict_name !== "-"
                                                ? `${dest.subdistrict_name}, `
                                                : ""}
                                            {dest.district_name}, {dest.city_name}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                            {dest.province_name} • Kodepos: {dest.zip_code || "-"}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedDestination && (
                            <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                <IconCheck size={14} /> Terpilih: {selectedDestination.label} (ID: {selectedDestination.id})
                            </p>
                        )}
                    </div>

                    {/* Weight and Courier Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Weight */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Berat Paket (Gram)
                            </label>
                            <div className="relative">
                                <IconScale
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    type="number"
                                    min="1"
                                    step="100"
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    className="w-full h-11 pl-10 pr-14 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-mono"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                    {Number(weight) > 0 ? `${(Number(weight) / 1000).toFixed(1)} kg` : "g"}
                                </span>
                            </div>
                        </div>

                        {/* Courier Filter */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Pilihan Kurir
                            </label>
                            <select
                                value={selectedCourier}
                                onChange={(e) => setSelectedCourier(e.target.value)}
                                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            >
                                <option value="all">⚡ Semua Kurir (Bandingkan Harga)</option>
                                {(info.couriers || []).map((c) => (
                                    <option key={c.code} value={c.code}>
                                        {c.name} ({c.code.toUpperCase()})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-end pt-1">
                        <button
                            type="button"
                            onClick={handleCalculate}
                            disabled={loadingRates || !selectedDestination}
                            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loadingRates ? (
                                <>
                                    <IconLoader2 size={18} className="animate-spin" />
                                    <span>Menghitung Tarif...</span>
                                </>
                            ) : (
                                <>
                                    <IconSearch size={18} />
                                    <span>Hitung Ongkir</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Rates List (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
                    {loadingRates && (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                            <IconLoader2 size={36} className="animate-spin text-primary-500 mb-3" />
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                Mengambil tarif ongkir dari kurir ekspedisi...
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Membandingkan JNE, J&T, SiCepat, POS, TIKI, dll.
                            </p>
                        </div>
                    )}

                    {!loadingRates && hasCalculated && rates.length === 0 && (
                        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                            <IconAlertCircle size={36} className="mx-auto mb-2 text-slate-400" />
                            <p className="text-sm font-medium">
                                Tidak ada opsi pengiriman yang ditemukan untuk rute ini.
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Coba pilih kurir lain atau periksa kembali destinasi pengiriman.
                            </p>
                        </div>
                    )}

                    {!loadingRates && !hasCalculated && (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                            <IconTruckDelivery size={40} className="mx-auto mb-2 opacity-40" />
                            <p className="text-sm font-medium">
                                Cari kota/kecamatan dan klik "Hitung Ongkir"
                            </p>
                            <p className="text-xs mt-1">
                                Hasil perhitungan ongkos kirim akan muncul di sini.
                            </p>
                        </div>
                    )}

                    {!loadingRates && rates.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 px-1 mb-1">
                                <span>Ditemukan {rates.length} Pilihan Pengiriman (Termurah ke Termahal)</span>
                                <span>Pilih salah satu</span>
                            </div>

                            {rates.map((rate) => (
                                <div
                                    key={rate.id}
                                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-primary-500 dark:hover:border-primary-500 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 font-black text-xs uppercase text-slate-700 dark:text-slate-200 shrink-0">
                                            {rate.courier_code}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {rate.courier_name}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-semibold text-[11px]">
                                                    {rate.service}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {rate.description || "Layanan Reguler"}
                                            </p>
                                            {rate.etd && (
                                                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                    <IconClock size={13} />
                                                    <span>Estimasi: {rate.etd.includes("day") || rate.etd.includes("hari") ? rate.etd : `${rate.etd} hari`}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700">
                                        <div className="text-right">
                                            <div className="text-base font-extrabold text-primary-600 dark:text-primary-400">
                                                {formatPrice(rate.cost)}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleApplyShipping(rate)}
                                            className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                                        >
                                            Pilih Layanan
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center text-xs text-slate-500">
                    <span>Powered by RajaOngkir API</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}

