import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, useForm } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import {
    IconArrowLeft,
    IconDeviceFloppy,
    IconPlus,
    IconTrash,
    IconRulerMeasure,
    IconSparkles,
    IconInfoCircle,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

export default function Create() {
    const { data, setData, post, processing, errors } = useForm({
        name: "",
        code: "",
        apparel_type: "tops",
        default_unit: "cm",
        columns: [
            { key: "ld", label: "Lingkar Dada (LD)" },
            { key: "pb", label: "Panjang Baju (PB)" },
            { key: "lb", label: "Lebar Bahu" },
        ],
        measurements: [
            { size: "S", ld: "96", pb: "68", lb: "42" },
            { size: "M", ld: "100", pb: "70", lb: "44" },
            { size: "L", ld: "104", pb: "72", lb: "46" },
            { size: "XL", ld: "108", pb: "74", lb: "48" },
        ],
        fit_rules: [
            { size: "S", min_height: 155, max_height: 165, min_weight: 45, max_weight: 55 },
            { size: "M", min_height: 160, max_height: 172, min_weight: 55, max_weight: 65 },
            { size: "L", min_height: 168, max_height: 178, min_weight: 65, max_weight: 75 },
            { size: "XL", min_height: 172, max_height: 183, min_weight: 75, max_weight: 85 },
        ],
        how_to_measure_notes: "Toleransi jahitan konveksi massal ±1 - 2 cm.",
        is_active: true,
    });

    // Column Management
    const addColumn = () => {
        const key = `col_${Date.now()}`;
        setData("columns", [...data.columns, { key, label: "Kolom Baru" }]);
    };

    const removeColumn = (indexToRemove) => {
        const removedKey = data.columns[indexToRemove].key;
        setData({
            ...data,
            columns: data.columns.filter((_, idx) => idx !== indexToRemove),
            measurements: data.measurements.map((row) => {
                const nextRow = { ...row };
                delete nextRow[removedKey];
                return nextRow;
            }),
        });
    };

    const updateColumnLabel = (index, label) => {
        const next = [...data.columns];
        next[index].label = label;
        setData("columns", next);
    };

    // Measurement Row Management
    const addRow = () => {
        const newRow = { size: "XXL" };
        data.columns.forEach((c) => {
            newRow[c.key] = "";
        });
        setData("measurements", [...data.measurements, newRow]);
    };

    const removeRow = (indexToRemove) => {
        setData(
            "measurements",
            data.measurements.filter((_, idx) => idx !== indexToRemove)
        );
    };

    const updateMeasurementCell = (rowIndex, key, value) => {
        const next = [...data.measurements];
        next[rowIndex] = { ...next[rowIndex], [key]: value };
        setData("measurements", next);
    };

    // Fit Rules Management
    const updateFitRule = (size, field, val) => {
        const existingIndex = data.fit_rules.findIndex((r) => r.size === size);
        let next = [...data.fit_rules];
        if (existingIndex >= 0) {
            next[existingIndex] = { ...next[existingIndex], [field]: Number(val) || 0 };
        } else {
            next.push({
                size,
                min_height: 0,
                max_height: 0,
                min_weight: 0,
                max_weight: 0,
                [field]: Number(val) || 0,
            });
        }
        setData("fit_rules", next);
    };

    const getFitRuleValue = (size, field) => {
        const r = data.fit_rules.find((item) => item.size === size);
        return r ? r[field] ?? "" : "";
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route("size-charts.store"), {
            onSuccess: () => toast.success("Panduan ukuran berhasil disimpan."),
            onError: () => toast.error("Periksa kembali isian formulir."),
        });
    };

    return (
        <DashboardLayout>
            <Head title="Tambah Panduan Ukuran" />

            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href={route("size-charts.index")}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition shadow-xs border border-slate-200 dark:border-slate-700"
                    >
                        <IconArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <IconRulerMeasure size={22} className="text-violet-600" />
                            Tambah Panduan Ukuran Baru
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Buat template ukuran dinamis dengan dimensi dan aturan fitting otomatis
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Informasi Dasar */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span>1. Informasi Umum</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                                Nama Panduan Ukuran <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={(e) => setData("name", e.target.value)}
                                placeholder="Contoh: Kaos Polos Reguler Dewasa"
                                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                required
                            />
                            {errors.name && (
                                <p className="text-xs text-rose-500 mt-1">{errors.name}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                                Kode Unik <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={data.code}
                                onChange={(e) => setData("code", e.target.value.toUpperCase())}
                                placeholder="TSHIRT-REG-01"
                                className="w-full px-3.5 py-2.5 text-xs font-mono uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                required
                            />
                            {errors.code && (
                                <p className="text-xs text-rose-500 mt-1">{errors.code}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                                Tipe Apparel <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={data.apparel_type}
                                onChange={(e) => setData("apparel_type", e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                            >
                                <option value="tops">👕 Atasan / Baju</option>
                                <option value="bottoms">👖 Bawahan / Celana</option>
                                <option value="footwear">👟 Sepatu / Alas Kaki</option>
                                <option value="headwear">🧢 Topi / Kepala</option>
                                <option value="accessories">💍 Aksesoris</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={data.is_active}
                                onChange={(e) => setData("is_active", e.target.checked)}
                                className="rounded text-violet-600 focus:ring-violet-500"
                            />
                            <span>Status Aktif</span>
                        </label>
                    </div>
                </div>

                {/* 2. Definisi Kolom & Tabel Ukuran */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                2. Tabel Dimensi Ukuran
                            </h2>
                            <p className="text-xs text-slate-500">
                                Atur nama kolom dan nilai dimensi (dalam cm) untuk setiap ukuran.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={addColumn}
                                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1"
                            >
                                <IconPlus size={14} /> Tambah Kolom Dimensi
                            </button>
                            <button
                                type="button"
                                onClick={addRow}
                                className="px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 text-xs font-bold hover:bg-violet-100 transition flex items-center gap-1"
                            >
                                <IconPlus size={14} /> Tambah Baris Ukuran
                            </button>
                        </div>
                    </div>

                    {/* Table Editor */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="p-3 w-28">Label Ukuran (Size)</th>
                                    {data.columns.map((col, cIdx) => (
                                        <th key={col.key} className="p-3 min-w-[150px]">
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="text"
                                                    value={col.label}
                                                    onChange={(e) => updateColumnLabel(cIdx, e.target.value)}
                                                    className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                                                />
                                                {data.columns.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeColumn(cIdx)}
                                                        className="text-slate-400 hover:text-rose-500 p-1"
                                                        title="Hapus Kolom"
                                                    >
                                                        <IconTrash size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="p-3 w-12 text-center">Hapus</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data.measurements.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                        <td className="p-2.5">
                                            <input
                                                type="text"
                                                value={row.size}
                                                onChange={(e) => updateMeasurementCell(rIdx, "size", e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                placeholder="S / M / L"
                                                required
                                            />
                                        </td>
                                        {data.columns.map((col) => (
                                            <td key={col.key} className="p-2.5">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={row[col.key] || ""}
                                                        onChange={(e) => updateMeasurementCell(rIdx, col.key, e.target.value)}
                                                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-8"
                                                        placeholder="0"
                                                    />
                                                    <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-bold">
                                                        cm
                                                    </span>
                                                </div>
                                            </td>
                                        ))}
                                        <td className="p-2.5 text-center">
                                            {data.measurements.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeRow(rIdx)}
                                                    className="p-1 text-slate-400 hover:text-rose-500 transition"
                                                >
                                                    <IconTrash size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. Aturan Smart Fit Recommender (TB & BB) */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
                    <div className="mb-4">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <IconSparkles size={18} className="text-violet-600" />
                            <span>3. Aturan Kalkulator Pintar (Smart Fit Recommender)</span>
                        </h2>
                        <p className="text-xs text-slate-500">
                            Digunakan oleh fitur "Cari Ukuran Saya" di katalog publik untuk merekomendasikan ukuran pas berdasarkan Tinggi Badan & Berat Badan pelanggan.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="p-3 w-28">Ukuran</th>
                                    <th className="p-3">Min Tinggi (cm)</th>
                                    <th className="p-3">Max Tinggi (cm)</th>
                                    <th className="p-3">Min Berat (kg)</th>
                                    <th className="p-3">Max Berat (kg)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data.measurements.map((row) => (
                                    <tr key={row.size} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                                            {row.size}
                                        </td>
                                        <td className="p-2.5">
                                            <input
                                                type="number"
                                                value={getFitRuleValue(row.size, "min_height")}
                                                onChange={(e) => updateFitRule(row.size, "min_height", e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                placeholder="155"
                                            />
                                        </td>
                                        <td className="p-2.5">
                                            <input
                                                type="number"
                                                value={getFitRuleValue(row.size, "max_height")}
                                                onChange={(e) => updateFitRule(row.size, "max_height", e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                placeholder="165"
                                            />
                                        </td>
                                        <td className="p-2.5">
                                            <input
                                                type="number"
                                                value={getFitRuleValue(row.size, "min_weight")}
                                                onChange={(e) => updateFitRule(row.size, "min_weight", e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                placeholder="45"
                                            />
                                        </td>
                                        <td className="p-2.5">
                                            <input
                                                type="number"
                                                value={getFitRuleValue(row.size, "max_weight")}
                                                onChange={(e) => updateFitRule(row.size, "max_weight", e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                placeholder="55"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Catatan / Cara Mengukur */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <IconInfoCircle size={18} className="text-slate-500" />
                        <span>4. Catatan Khusus & Tips Fitting</span>
                    </h2>
                    <textarea
                        rows={3}
                        value={data.how_to_measure_notes || ""}
                        onChange={(e) => setData("how_to_measure_notes", e.target.value)}
                        placeholder="Contoh: Toleransi jahitan ±1-2 cm. Bahan cotton combed 24s terasa lebih tebal."
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-3">
                    <Link href={route("size-charts.index")}>
                        <Button
                            type="button"
                            label="Batal"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        />
                    </Link>
                    <Button
                        type="submit"
                        disabled={processing}
                        label={processing ? "Menyimpan..." : "Simpan Panduan Ukuran"}
                        icon={<IconDeviceFloppy size={18} />}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-bold"
                    />
                </div>
            </form>
        </DashboardLayout>
    );
}

