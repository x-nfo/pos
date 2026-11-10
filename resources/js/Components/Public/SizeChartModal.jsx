import React, { useState, useMemo } from "react";
import {
    IconX,
    IconRulerMeasure,
    IconSparkles,
    IconInfoCircle,
    IconCheck,
    IconShirt,
} from "@tabler/icons-react";

export default function SizeChartModal({
    isOpen,
    onClose,
    product = null,
    sizeChart = null,
    availableSizeCharts = [],
}) {
    const [activeTab, setActiveTab] = useState("chart"); // 'chart' | 'calculator' | 'how-to'
    const [unit, setUnit] = useState("cm"); // 'cm' | 'inch'

    // Static fallback charts when no dynamic chart is bound yet
    const fallbackCharts = useMemo(
        () => [
            {
                id: "fallback-tops",
                name: "👕 Baju / Atasan",
                apparel_type: "tops",
                columns: [
                    { key: "ld", label: "Lingkar Dada (LD)" },
                    { key: "pb", label: "Panjang (PB)" },
                    { key: "lb", label: "Lebar Bahu" },
                ],
                measurements: [
                    { size: "S", ld: 96, pb: 68, lb: 42, est: "45-55 kg / 155-165 cm" },
                    { size: "M", ld: 100, pb: 70, lb: 44, est: "55-65 kg / 160-170 cm" },
                    { size: "L", ld: 104, pb: 72, lb: 46, est: "65-75 kg / 168-178 cm" },
                    { size: "XL", ld: 108, pb: 74, lb: 48, est: "75-85 kg / 172-182 cm" },
                    { size: "XXL", ld: 114, pb: 76, lb: 50, est: "85-95 kg / 175-188 cm" },
                ],
                fit_rules: [
                    { size: "S", min_height: 150, max_height: 165, min_weight: 45, max_weight: 55 },
                    { size: "M", min_height: 160, max_height: 172, min_weight: 55, max_weight: 65 },
                    { size: "L", min_height: 168, max_height: 178, min_weight: 65, max_weight: 75 },
                    { size: "XL", min_height: 172, max_height: 183, min_weight: 75, max_weight: 85 },
                    { size: "XXL", min_height: 175, max_height: 192, min_weight: 85, max_weight: 98 },
                ],
                how_to_measure_notes:
                    "Ukur lingkar dada mendatar tepat di bawah ketiak. Toleransi konveksi massal ±1 - 2 cm.",
            },
            {
                id: "fallback-bottoms",
                name: "👖 Celana / Bawahan",
                apparel_type: "bottoms",
                columns: [
                    { key: "lp", label: "Lingkar Pinggang (LP)" },
                    { key: "paha", label: "Lingkar Paha" },
                    { key: "pj", label: "Panjang Celana" },
                ],
                measurements: [
                    { size: "28 (S)", lp: 74, paha: 56, pj: 100, bb: "45-52 kg" },
                    { size: "30 (M)", lp: 78, paha: 58, pj: 100, bb: "53-60 kg" },
                    { size: "32 (L)", lp: 82, paha: 60, pj: 102, bb: "61-70 kg" },
                    { size: "34 (XL)", lp: 86, paha: 62, pj: 102, bb: "71-80 kg" },
                    { size: "36 (XXL)", lp: 92, paha: 66, pj: 104, bb: "81-90 kg" },
                ],
                fit_rules: [
                    { size: "28 (S)", min_height: 150, max_height: 168, min_weight: 45, max_weight: 52 },
                    { size: "30 (M)", min_height: 155, max_height: 172, min_weight: 53, max_weight: 60 },
                    { size: "32 (L)", min_height: 165, max_height: 178, min_weight: 61, max_weight: 70 },
                    { size: "34 (XL)", min_height: 170, max_height: 182, min_weight: 71, max_weight: 80 },
                    { size: "36 (XXL)", min_height: 172, max_height: 188, min_weight: 81, max_weight: 90 },
                ],
                how_to_measure_notes:
                    "Ukur pas keliling pinggang tepat di atas tulang pinggul.",
            },
            {
                id: "fallback-shoes",
                name: "👟 Sepatu",
                apparel_type: "footwear",
                columns: [
                    { key: "insole", label: "Panjang Insole" },
                    { key: "foot", label: "Panjang Kaki" },
                ],
                measurements: [
                    { size: "39", insole: 24.5, foot: 24.0 },
                    { size: "40", insole: 25.0, foot: 24.5 },
                    { size: "41", insole: 26.0, foot: 25.5 },
                    { size: "42", insole: 26.5, foot: 26.0 },
                    { size: "43", insole: 27.5, foot: 27.0 },
                    { size: "44", insole: 28.0, foot: 27.5 },
                ],
                fit_rules: [],
                how_to_measure_notes:
                    "Ukur panjang telapak kaki dari ujung tumit hingga ujung jari terpanjang.",
            },
        ],
        []
    );

    // Resolve which chart to display
    const resolvedChart = useMemo(() => {
        if (sizeChart) return sizeChart;
        if (product?.size_chart) return product.size_chart;
        return null;
    }, [sizeChart, product]);

    // Active chart state if multiple fallback/available charts exist
    const [selectedFallbackId, setSelectedFallbackId] = useState("fallback-tops");

    const activeChart = useMemo(() => {
        if (resolvedChart) return resolvedChart;
        return (
            fallbackCharts.find((c) => c.id === selectedFallbackId) ||
            fallbackCharts[0]
        );
    }, [resolvedChart, fallbackCharts, selectedFallbackId]);

    // Smart Fit Recommender Form State
    const [userHeight, setUserHeight] = useState("");
    const [userWeight, setUserWeight] = useState("");
    const [fitPreference, setFitPreference] = useState("regular"); // 'slim' | 'regular' | 'loose'

    // Format dimension value with unit conversion
    const formatValue = (val) => {
        if (val === null || val === undefined || val === "") return "-";
        if (typeof val === "string" && (val.includes("cm") || val.includes("kg"))) {
            return val;
        }
        const num = parseFloat(val);
        if (isNaN(num)) return val;

        if (unit === "inch") {
            return (num / 2.54).toFixed(1) + '"';
        }
        return `${num} cm`;
    };

    // Calculate smart recommended size
    const recommendedSize = useMemo(() => {
        const height = parseFloat(userHeight);
        const weight = parseFloat(userWeight);
        const rules = activeChart?.fit_rules || [];
        const measurements = activeChart?.measurements || [];

        if (!height || !weight || !rules.length) return null;

        const matchedRule = rules.find(
            (r) =>
                height >= Number(r.min_height) &&
                height <= Number(r.max_height) &&
                weight >= Number(r.min_weight) &&
                weight <= Number(r.max_weight)
        );

        if (!matchedRule) return null;

        let targetIndex = measurements.findIndex((m) => m.size === matchedRule.size);
        if (targetIndex !== -1) {
            if (fitPreference === "loose" && targetIndex < measurements.length - 1) {
                targetIndex += 1;
            } else if (fitPreference === "slim" && targetIndex > 0) {
                targetIndex -= 1;
            }
            return measurements[targetIndex].size;
        }

        return matchedRule.size;
    }, [userHeight, userWeight, fitPreference, activeChart]);

    if (!isOpen) return null;

    const columns = activeChart?.columns || [];
    const measurements = activeChart?.measurements || [];
    const hasFitRules = (activeChart?.fit_rules || []).length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shadow-xs">
                            <IconRulerMeasure size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                {activeChart?.name || "Panduan Ukuran (Size Guide)"}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {product?.title
                                    ? `Fitting untuk ${product.title}`
                                    : "Standar fitting apparel & fashion store"}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                        <IconX size={18} />
                    </button>
                </div>

                {/* Multi-chart fallback selector (only if generic/no product chart attached) */}
                {!resolvedChart && (
                    <div className="flex gap-2 mt-3 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                        {fallbackCharts.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedFallbackId(c.id)}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    selectedFallbackId === c.id
                                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Sub-Header: Mode Switcher & Unit Toggle */}
                <div className="flex items-center justify-between my-3 gap-2">
                    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => setActiveTab("chart")}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === "chart"
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            }`}
                        >
                            Tabel Ukuran
                        </button>
                        {hasFitRules && (
                            <button
                                type="button"
                                onClick={() => setActiveTab("calculator")}
                                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                                    activeTab === "calculator"
                                        ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-xs font-bold"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                            >
                                <IconSparkles size={14} />
                                <span>Cari Ukuran Saya</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setActiveTab("how-to")}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === "how-to"
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            }`}
                        >
                            Cara Ukur
                        </button>
                    </div>

                    {/* Unit Switcher */}
                    {activeTab === "chart" && (
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-bold">
                            <button
                                type="button"
                                onClick={() => setUnit("cm")}
                                className={`px-2 py-1 rounded-md transition ${
                                    unit === "cm"
                                        ? "bg-white dark:bg-slate-700 text-violet-600 shadow-xs"
                                        : "text-slate-500"
                                }`}
                            >
                                CM
                            </button>
                            <button
                                type="button"
                                onClick={() => setUnit("inch")}
                                className={`px-2 py-1 rounded-md transition ${
                                    unit === "inch"
                                        ? "bg-white dark:bg-slate-700 text-violet-600 shadow-xs"
                                        : "text-slate-500"
                                }`}
                            >
                                INCH
                            </button>
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="overflow-y-auto flex-1 pr-0.5">
                    {/* TAB 1: Tabel Ukuran Dinamis */}
                    {activeTab === "chart" && (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="p-2.5">Size</th>
                                        {columns.map((col) => (
                                            <th key={col.key} className="p-2.5">
                                                {col.label}
                                            </th>
                                        ))}
                                        {measurements[0]?.est && (
                                            <th className="p-2.5">Estimasi BB / TB</th>
                                        )}
                                        {measurements[0]?.bb && !measurements[0]?.est && (
                                            <th className="p-2.5">Estimasi BB</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                    {measurements.map((row) => (
                                        <tr
                                            key={row.size}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                                        >
                                            <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                                                {row.size}
                                            </td>
                                            {columns.map((col) => (
                                                <td
                                                    key={col.key}
                                                    className="p-2.5 text-slate-700 dark:text-slate-300"
                                                >
                                                    {formatValue(row[col.key])}
                                                </td>
                                            ))}
                                            {row.est && (
                                                <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">
                                                    {row.est}
                                                </td>
                                            )}
                                            {row.bb && !row.est && (
                                                <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">
                                                    {row.bb}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* TAB 2: Smart Fit Calculator */}
                    {activeTab === "calculator" && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                                Masukkan postur tubuh Anda untuk mendapatkan rekomendasi ukuran yang paling pas.
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                                        Tinggi Badan (cm)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="Contoh: 170"
                                        value={userHeight}
                                        onChange={(e) => setUserHeight(e.target.value)}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                                        Berat Badan (kg)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="Contoh: 65"
                                        value={userWeight}
                                        onChange={(e) => setUserWeight(e.target.value)}
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                                    Preferensi Fitting
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: "slim", label: "Pas Badan (Slim)" },
                                        { id: "regular", label: "Standar (Regular)" },
                                        { id: "loose", label: "Longgar (Oversize)" },
                                    ].map((pref) => (
                                        <button
                                            key={pref.id}
                                            type="button"
                                            onClick={() => setFitPreference(pref.id)}
                                            className={`p-2 rounded-xl text-[11px] font-medium border text-center transition ${
                                                fitPreference === pref.id
                                                    ? "border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 font-bold"
                                                    : "border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                                            }`}
                                        >
                                            {pref.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {recommendedSize ? (
                                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-between shadow-lg shadow-violet-500/20">
                                    <div>
                                        <p className="text-[11px] text-violet-200 uppercase tracking-wider font-semibold">
                                            Rekomendasi Terbaik Untuk Anda
                                        </p>
                                        <p className="text-xl font-black mt-0.5 flex items-center gap-2">
                                            <span>Ukuran: {recommendedSize}</span>
                                            <IconCheck size={20} className="text-emerald-300" />
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                        <IconShirt size={24} />
                                    </div>
                                </div>
                            ) : (
                                userHeight &&
                                userWeight && (
                                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                                        Data tinggi/berat belum cocok dengan rentang standar. Silakan cek tabel ukuran manual di tab <strong>Tabel Ukuran</strong>.
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* TAB 3: Cara Mengukur */}
                    {activeTab === "how-to" && (
                        <div className="space-y-3 p-1">
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <IconInfoCircle size={16} className="text-violet-500" />
                                    Tips Pengukuran Akurat:
                                </p>
                                <ul className="list-disc pl-4 space-y-1.5 text-[11px] leading-relaxed">
                                    <li>
                                        <strong>Lingkar Dada:</strong> Ukur melingkari bagian dada terluas tepat di bawah ketiak dengan pita meteran mendatar.
                                    </li>
                                    <li>
                                        <strong>Panjang Baju:</strong> Ukur tegak lurus dari titik tertinggi pundak/kerah hingga ujung jahitan bawah baju.
                                    </li>
                                    <li>
                                        <strong>Lingkar Pinggang:</strong> Ukur keliling bagian terkecil pinggang Anda (tepat di atas pusar).
                                    </li>
                                    <li>
                                        <strong>Sepatu:</strong> Ukur panjang telapak kaki dari ujung tumit hingga ujung jari terpanjang.
                                    </li>
                                </ul>
                            </div>
                            {activeChart?.how_to_measure_notes && (
                                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300">
                                    {activeChart.how_to_measure_notes}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Notes */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                        * Toleransi jahitan konveksi massal ±1 - 2 cm.
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs hover:opacity-90 transition"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
