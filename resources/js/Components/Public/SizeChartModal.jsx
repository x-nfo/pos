import React, { useState } from "react";
import { IconX, IconRulerMeasure, IconCheck } from "@tabler/icons-react";

export default function SizeChartModal({ isOpen, onClose }) {
    const [chartType, setChartType] = useState("atasan"); // 'atasan' | 'bawahan' | 'sepatu'

    if (!isOpen) return null;

    const atasanData = [
        { size: "S", ld: "96 cm", pb: "68 cm", lb: "42 cm", est: "45-55 kg / 155-165 cm" },
        { size: "M", ld: "100 cm", pb: "70 cm", lb: "44 cm", est: "55-65 kg / 160-170 cm" },
        { size: "L", ld: "104 cm", pb: "72 cm", lb: "46 cm", est: "65-75 kg / 168-178 cm" },
        { size: "XL", ld: "108 cm", pb: "74 cm", lb: "48 cm", est: "75-85 kg / 172-182 cm" },
        { size: "XXL", ld: "114 cm", pb: "76 cm", lb: "50 cm", est: "85-95 kg / 175-188 cm" },
    ];

    const bawahanData = [
        { size: "28 (S)", lp: "74 cm", paha: "56 cm", pj: "100 cm", bb: "45-52 kg" },
        { size: "30 (M)", lp: "78 cm", paha: "58 cm", pj: "100 cm", bb: "53-60 kg" },
        { size: "32 (L)", lp: "82 cm", paha: "60 cm", pj: "102 cm", bb: "61-70 kg" },
        { size: "34 (XL)", lp: "86 cm", paha: "62 cm", pj: "102 cm", bb: "71-80 kg" },
        { size: "36 (XXL)", lp: "92 cm", paha: "66 cm", pj: "104 cm", bb: "81-90 kg" },
    ];

    const sepatuData = [
        { size: "39", insole: "24.5 cm", foot: "24.0 cm" },
        { size: "40", insole: "25.0 cm", foot: "24.5 cm" },
        { size: "41", insole: "26.0 cm", foot: "25.5 cm" },
        { size: "42", insole: "26.5 cm", foot: "26.0 cm" },
        { size: "43", insole: "27.5 cm", foot: "27.0 cm" },
        { size: "44", insole: "28.0 cm", foot: "27.5 cm" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                            <IconRulerMeasure size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Panduan Ukuran (Size Chart)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Standar fitting apparel & fashion store
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

                {/* Tabs */}
                <div className="flex gap-2 my-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setChartType("atasan")}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            chartType === "atasan"
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        👕 Baju / Atasan
                    </button>
                    <button
                        type="button"
                        onClick={() => setChartType("bawahan")}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            chartType === "bawahan"
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        👖 Celana / Bawahan
                    </button>
                    <button
                        type="button"
                        onClick={() => setChartType("sepatu")}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            chartType === "sepatu"
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        👟 Sepatu
                    </button>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    {chartType === "atasan" && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="p-2.5">Size</th>
                                    <th className="p-2.5">Lingkar Dada (LD)</th>
                                    <th className="p-2.5">Panjang (PB)</th>
                                    <th className="p-2.5">Lebar Bahu</th>
                                    <th className="p-2.5">Estimasi BB / TB</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {atasanData.map((row) => (
                                    <tr key={row.size} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{row.size}</td>
                                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.ld}</td>
                                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.pb}</td>
                                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.lb}</td>
                                        <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">{row.est}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {chartType === "bawahan" && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="p-2.5">Size</th>
                                    <th className="p-2.5">Lingkar Pinggang (LP)</th>
                                    <th className="p-2.5">Lingkar Paha</th>
                                    <th className="p-2.5">Panjang Celana</th>
                                    <th className="p-2.5">Estimasi BB</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {bawahanData.map((row) => (
                                    <tr key={row.size} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{row.size}</td>
                                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.lp}</td>
                                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.paha}</td>
                                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.pj}</td>
                                        <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">{row.bb}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {chartType === "sepatu" && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="p-2.5">Size EU</th>
                                    <th className="p-2.5">Panjang Insole</th>
                                    <th className="p-2.5">Panjang Telapak Kaki</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {sepatuData.map((row) => (
                                    <tr key={row.size} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{row.size}</td>
                                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.insole}</td>
                                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.foot}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer Notes */}
                <div className="mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <p className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <span>ℹ️</span> Catatan Fitting:
                    </p>
                    <p>• Toleransi ukuran jahitan massal ±1 - 2 cm.</p>
                    <p>• Bila ragu antara dua ukuran, disarankan memilih 1 tingkat ukuran lebih besar untuk kenyamanan berbusana.</p>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs hover:opacity-90 transition"
                    >
                        Tutup Panduan
                    </button>
                </div>
            </div>
        </div>
    );
}

