import React, { useState, useEffect, useRef } from "react";
import {
    IconShieldLock,
    IconLock,
    IconEye,
    IconEyeOff,
    IconLoader2,
    IconAlertCircle,
    IconX,
} from "@tabler/icons-react";
import axios from "axios";

export default function PasswordConfirmModal({
    isOpen,
    title = "Konfirmasi Password",
    description = "Masukkan password akun Anda untuk mengonfirmasi dan melanjutkan tindakan ini.",
    challenge = null,
    onSuccess,
    onCancel,
}) {
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setPassword("");
            setError(null);
            setShowPassword(false);
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e?.preventDefault();
        if (!password || processing) return;

        setProcessing(true);
        setError(null);

        try {
            const response = await axios.post(
                route("password.confirm"),
                { password },
                {
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                }
            );

            if (response.data?.success) {
                onSuccess?.(response.data.step_up_fresh_until);
            } else {
                setError("Password yang Anda masukkan salah.");
            }
        } catch (err) {
            const message =
                err.response?.data?.errors?.password?.[0] ||
                err.response?.data?.message ||
                "Password yang Anda masukkan salah atau sesi telah kedaluwarsa.";
            setError(message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={() => !processing && onCancel?.()}
            />

            {/* Modal Box */}
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-sheet-up z-10">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                                <IconShieldLock size={22} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold">{title}</h3>
                                <p className="text-xs text-white/80">
                                    {challenge ? `Otorisasi: ${challenge}` : "Proteksi Aksi Sensitif"}
                                </p>
                            </div>
                        </div>
                        {!processing && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <IconX size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {description}
                    </p>

                    {error && (
                        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-danger-50 dark:bg-danger-950/40 border border-danger-200 dark:border-danger-800">
                            <IconAlertCircle
                                size={18}
                                className="text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5"
                            />
                            <p className="text-xs text-danger-700 dark:text-danger-300 font-medium leading-relaxed">
                                {error}
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Password Akun
                        </label>
                        <div className="relative">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                <IconLock size={18} />
                            </div>
                            <input
                                ref={inputRef}
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={processing}
                                placeholder="Masukkan password Anda..."
                                className={`w-full h-11 pl-10 pr-11 rounded-xl text-sm border ${
                                    error
                                        ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500/20"
                                        : "border-slate-200 dark:border-slate-700 focus:border-primary-500 focus:ring-primary-500/20"
                                } bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                            >
                                {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex gap-2.5">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={processing}
                            className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={processing || !password.trim()}
                            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {processing ? (
                                <>
                                    <IconLoader2 size={16} className="animate-spin" />
                                    <span>Memverifikasi...</span>
                                </>
                            ) : (
                                <span>Konfirmasi & Lanjutkan</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
