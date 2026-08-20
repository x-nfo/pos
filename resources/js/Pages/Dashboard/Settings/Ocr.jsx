import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, Link } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Input from "@/Components/Dashboard/Input";
import toast from "react-hot-toast";
import axios from "axios";
import {
    IconSparkles,
    IconDeviceFloppy,
    IconKey,
    IconCpu,
    IconPercentage,
    IconDatabase,
    IconPlugConnected,
    IconLoader2,
    IconCheck,
    IconAlertCircle,
    IconEye,
    IconEyeOff,
    IconExternalLink,
} from "@tabler/icons-react";

export default function Ocr({ settings }) {
    const { data, setData, post, processing, errors } = useForm({
        ocr_enabled: settings.ocr_enabled ?? true,
        ocr_provider: settings.ocr_provider || "gemini",
        ocr_gemini_api_key: settings.ocr_gemini_api_key || "",
        ocr_gemini_model: settings.ocr_gemini_model || "gemini-flash-lite-latest",
        ocr_openai_api_key: settings.ocr_openai_api_key || "",
        ocr_openai_model: settings.ocr_openai_model || "gpt-4o-mini",
        ocr_openrouter_api_key: settings.ocr_openrouter_api_key || "",
        ocr_openrouter_model: settings.ocr_openrouter_model || "openai/gpt-4o-mini",
        ocr_openrouter_base_url: settings.ocr_openrouter_base_url || "https://openrouter.ai/api/v1/chat/completions",
        ocr_default_margin_percentage: settings.ocr_default_margin_percentage || 20,
        ocr_auto_match_catalog: settings.ocr_auto_match_catalog ?? true,
    });

    const [showApiKey, setShowApiKey] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const submit = (e) => {
        e.preventDefault();
        post(route("settings.ocr.update"), {
            onSuccess: () => toast.success("Pengaturan OCR & AI berhasil disimpan"),
            onError: () => toast.error("Gagal menyimpan pengaturan OCR"),
        });
    };

    const handleTestConnection = async () => {
        setIsTestingConnection(true);
        setTestResult(null);

        let testPayload = {
            provider: data.ocr_provider,
        };

        if (data.ocr_provider === "gemini") {
            testPayload.api_key = data.ocr_gemini_api_key;
            testPayload.model = data.ocr_gemini_model;
        } else if (data.ocr_provider === "openai") {
            testPayload.api_key = data.ocr_openai_api_key;
            testPayload.model = data.ocr_openai_model;
        } else if (data.ocr_provider === "openrouter") {
            testPayload.api_key = data.ocr_openrouter_api_key;
            testPayload.model = data.ocr_openrouter_model;
            testPayload.base_url = data.ocr_openrouter_base_url;
        }

        try {
            const response = await axios.post(route("products.ocr.test-connection"), testPayload);
            setTestResult(response.data);
            if (response.data?.success) {
                toast.success(response.data.message || "Koneksi AI berhasil terhubung!");
            } else {
                toast.error(response.data?.message || "Gagal menguji koneksi AI.");
            }
        } catch (err) {
            console.error("Test connection error:", err);
            const msg = err.response?.data?.message || "Terjadi kesalahan saat menguji koneksi.";
            setTestResult({ success: false, message: msg });
            toast.error(msg);
        } finally {
            setIsTestingConnection(false);
        }
    };


    return (
        <>
            <Head title="Pengaturan OCR & AI Vision" />

            <div className="max-w-4xl">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                            <IconSparkles size={22} />
                        </div>
                        Pengaturan OCR & AI Vision
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Pilih engine kecerdasan buatan (Google Gemini, OpenAI GPT-4o, OpenRouter/Custom AI) untuk memindai kemasan produk dan faktur belanja supplier secara otomatis.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    {/* Status & Provider Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                    Fitur OCR & AI Scanner
                                </h3>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                    Aktifkan tombol scan kemasan di kasir POS, form tambah produk, dan import faktur belanja.
                                </p>
                            </div>

                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={data.ocr_enabled}
                                    onChange={(e) => setData("ocr_enabled", e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                            </label>
                        </div>

                        {/* AI Provider Selection */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <IconCpu size={16} />
                                <span>Engine / Provider AI Vision</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setData("ocr_provider", "gemini")}
                                    className={`p-4 rounded-2xl border text-left transition-all ${
                                        data.ocr_provider === "gemini"
                                            ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/40 ring-2 ring-primary-500/20"
                                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white">Google Gemini</span>
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                            Gratis
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Flash Lite &amp; 3.5 Flash, kuota harian besar (1.500x/hari).
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setData("ocr_provider", "openai")}
                                    className={`p-4 rounded-2xl border text-left transition-all ${
                                        data.ocr_provider === "openai"
                                            ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/40 ring-2 ring-primary-500/20"
                                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white">OpenAI (ChatGPT)</span>
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                                            Akurat
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        GPT-4o-mini &amp; GPT-4o, pembacaan tabel nota sangat presisi.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setData("ocr_provider", "openrouter")}
                                    className={`p-4 rounded-2xl border text-left transition-all ${
                                        data.ocr_provider === "openrouter"
                                            ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/40 ring-2 ring-primary-500/20"
                                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white">OpenRouter / Custom</span>
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                                            Multi-AI
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Qwen-VL, Llama-Vision, DeepSeek proxies, Ollama lokal.
                                    </p>
                                </button>
                            </div>
                        </div>

                        {/* Provider Details: Google Gemini */}
                        {data.ocr_provider === "gemini" && (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                        Model Gemini AI
                                    </label>
                                    <select
                                        value={data.ocr_gemini_model}
                                        onChange={(e) => setData("ocr_gemini_model", e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="gemini-flash-lite-latest">gemini-flash-lite-latest (Direkomendasikan - Respon &lt;1s, Kuota Hemat &amp; Bebas Limit)</option>
                                        <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Flash Lite Generasi 3.5)</option>
                                        <option value="gemini-flash-latest">gemini-flash-latest (Flash Standar)</option>
                                        <option value="gemini-3.6-flash">gemini-3.6-flash (Generasi 3.6 Flash)</option>
                                        <option value="gemini-2.5-pro">gemini-2.5-pro (Penalaran Mendalam)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <IconKey size={16} />
                                            <span>Google Gemini API Key</span>
                                        </label>
                                        <a
                                            href="https://aistudio.google.com/app/apikey"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex items-center gap-1"
                                        >
                                            <span>Dapatkan API Key Gratis di Google AI Studio</span>
                                            <IconExternalLink size={13} />
                                        </a>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type={showApiKey ? "text" : "password"}
                                            value={data.ocr_gemini_api_key}
                                            onChange={(e) => setData("ocr_gemini_api_key", e.target.value)}
                                            placeholder="AIzaSy..."
                                            className="w-full pl-4 pr-24 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-semibold flex items-center gap-1"
                                        >
                                            {showApiKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                            <span>{showApiKey ? "Sembunyikan" : "Lihat"}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Provider Details: OpenAI */}
                        {data.ocr_provider === "openai" && (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                        Model OpenAI
                                    </label>
                                    <select
                                        value={data.ocr_openai_model}
                                        onChange={(e) => setData("ocr_openai_model", e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="gpt-4o-mini">gpt-4o-mini (Sangat Direkomendasikan - Cepat, Murah &amp; Sangat Akurat)</option>
                                        <option value="gpt-4o">gpt-4o (Model Vision Flagship)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <IconKey size={16} />
                                            <span>OpenAI API Key</span>
                                        </label>
                                        <a
                                            href="https://platform.openai.com/api-keys"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex items-center gap-1"
                                        >
                                            <span>OpenAI Dashboard Keys</span>
                                            <IconExternalLink size={13} />
                                        </a>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type={showApiKey ? "text" : "password"}
                                            value={data.ocr_openai_api_key}
                                            onChange={(e) => setData("ocr_openai_api_key", e.target.value)}
                                            placeholder="sk-proj-..."
                                            className="w-full pl-4 pr-24 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-semibold flex items-center gap-1"
                                        >
                                            {showApiKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                            <span>{showApiKey ? "Sembunyikan" : "Lihat"}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Provider Details: OpenRouter / Custom */}
                        {data.ocr_provider === "openrouter" && (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                            API Base URL (OpenAI-Compatible)
                                        </label>
                                        <input
                                            type="text"
                                            value={data.ocr_openrouter_base_url}
                                            onChange={(e) => setData("ocr_openrouter_base_url", e.target.value)}
                                            placeholder="https://openrouter.ai/api/v1/chat/completions"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                                            Model ID / Slug
                                        </label>
                                        <input
                                            type="text"
                                            value={data.ocr_openrouter_model}
                                            onChange={(e) => setData("ocr_openrouter_model", e.target.value)}
                                            placeholder="openai/gpt-4o-mini atau qwen/qwen-2.5-vl-72b-instruct"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                            <IconKey size={16} />
                                            <span>API Key (OpenRouter / Bearer Token)</span>
                                        </label>
                                        <a
                                            href="https://openrouter.ai/keys"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex items-center gap-1"
                                        >
                                            <span>OpenRouter Keys</span>
                                            <IconExternalLink size={13} />
                                        </a>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type={showApiKey ? "text" : "password"}
                                            value={data.ocr_openrouter_api_key}
                                            onChange={(e) => setData("ocr_openrouter_api_key", e.target.value)}
                                            placeholder="sk-or-v1-..."
                                            className="w-full pl-4 pr-24 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-semibold flex items-center gap-1"
                                        >
                                            {showApiKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                            <span>{showApiKey ? "Sembunyikan" : "Lihat"}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Operational Margins & Catalog Integration */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
                            Perhitungan Harga &amp; Pencocokan Data
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                                    <IconPercentage size={16} />
                                    <span>Default Margin Keuntungan (%)</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="500"
                                        step="0.5"
                                        value={data.ocr_default_margin_percentage}
                                        onChange={(e) =>
                                            setData("ocr_default_margin_percentage", e.target.value)
                                        }
                                        className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                        %
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Saat scan nota faktur yang hanya menampilkan harga beli (modal), harga jual akan otomatis dinaikkan sebesar persentase ini.
                                </p>
                            </div>

                            <div className="flex flex-col justify-center">
                                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={data.ocr_auto_match_catalog}
                                        onChange={(e) =>
                                            setData("ocr_auto_match_catalog", e.target.checked)
                                        }
                                        className="w-4 h-4 mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            <IconDatabase size={15} />
                                            Auto-Cocokkan Katalog Referensi (32k+ Data)
                                        </span>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            Jika OCR hanya menangkap sebagian teks atau barcode, sistem akan melengkapi nama dan satuan dari katalog referensi nasional.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Test Connection Banner */}
                    {testResult && (
                        <div
                            className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                                testResult.success
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                            }`}
                        >
                            {testResult.success ? (
                                <IconCheck size={18} className="shrink-0 text-emerald-600 mt-0.5" />
                            ) : (
                                <IconAlertCircle size={18} className="shrink-0 text-rose-600 mt-0.5" />
                            )}
                            <div>
                                <p className="font-bold">
                                    {testResult.success ? "Hasil Uji Koneksi: Berhasil" : "Hasil Uji Koneksi: Gagal"}
                                </p>
                                <p className="mt-0.5">{testResult.message}</p>
                            </div>
                        </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={isTestingConnection}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                        >
                            {isTestingConnection ? (
                                <IconLoader2 size={16} className="animate-spin text-primary-500" />
                            ) : (
                                <IconPlugConnected size={16} className="text-primary-500" />
                            )}
                            <span>Uji Koneksi AI</span>
                        </button>

                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-sm font-bold shadow-lg shadow-primary-500/25 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <IconDeviceFloppy size={18} />
                            <span>Simpan Pengaturan</span>
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

Ocr.layout = (page) => <DashboardLayout children={page} />;
