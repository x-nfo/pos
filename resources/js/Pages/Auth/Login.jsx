import { useEffect, useState } from "react";
import { Head, Link, useForm, usePage } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import AuthBotGuardFields from "@/Components/AuthBotGuardFields";
import {
    IconBuildingStore,
    IconMail,
    IconLock,
    IconEye,
    IconEyeOff,
    IconLoader2,
    IconShieldLock,
    IconClock,
} from "@tabler/icons-react";

export default function Login({ status, canResetPassword, canRegister, botGuard }) {
    const { t } = useTranslation();
    const { branding } = usePage().props;
    const honeypotField = botGuard?.honeypot_field || "company_website";
    const tokenField = botGuard?.token_field || "bot_guard_token";
    const { data, setData, post, processing, errors, reset } = useForm({
        email: "",
        password: "",
        remember: false,
        [honeypotField]: "",
        [tokenField]: botGuard?.token || "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const isRateLimited = Boolean(
        errors.email &&
        (errors.email.toLowerCase().includes("terlalu banyak") ||
         errors.email.toLowerCase().includes("too many") ||
         errors.email.toLowerCase().includes("detik") ||
         errors.email.toLowerCase().includes("seconds"))
    );

    useEffect(() => {
        if (isRateLimited && errors.email) {
            const match = errors.email.match(/(\d+)\s*(?:detik|seconds)/i);
            const seconds = match ? parseInt(match[1], 10) : 60;
            setCountdown(seconds);
        }
    }, [errors.email, isRateLimited]);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    useEffect(() => {
        return () => reset("password");
    }, []);

    const submit = (e) => {
        e.preventDefault();
        if (countdown > 0) return;
        post(route("login"));
    };

    return (
        <>
            <Head title={branding?.appName ? `Login - ${branding.appName}` : t("auth.login.title")} />

            <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
                {/* Left - Form */}
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="w-full max-w-md">
                        {/* Logo */}
                        <div className="mb-8">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-3 mb-6"
                            >
                                {branding?.logoLight ? (
                                    <img
                                        src={branding.logoLight}
                                        alt={branding.appName}
                                        className="h-12 max-w-[180px] object-contain"
                                    />
                                ) : (
                                    <>
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                                            <IconBuildingStore
                                                size={24}
                                                className="text-white"
                                            />
                                        </div>
                                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                            {branding?.appName || t("auth.login.appName")}
                                        </span>
                                    </>
                                )}
                            </Link>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                                {t("auth.login.subtitle")}
                            </h1>
                            <p className="mt-2 text-slate-600 dark:text-slate-400">
                                {t("auth.login.description")}
                            </p>
                        </div>

                        {/* Status Message */}
                        {status && (
                            <div className="mb-6 p-4 rounded-xl bg-success-50 dark:bg-success-950/50 text-success-700 dark:text-success-400 text-sm">
                                {status}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={submit} className="space-y-5">
                            <AuthBotGuardFields
                                botGuard={botGuard}
                                data={data}
                                setData={setData}
                            />
                            {errors.human && (
                                <div className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-600 dark:bg-danger-950/40 dark:text-danger-300">
                                    {errors.human}
                                </div>
                            )}

                            {/* Rate Limiting / Lockout Alert Banner */}
                            {isRateLimited && (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50/95 p-4 dark:border-rose-900/50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-start gap-3.5">
                                        <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0">
                                            <IconShieldLock size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                                                Akses Login Terkunci Sementara
                                            </h4>
                                            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                                                Terlalu banyak percobaan login gagal. Demi keamanan sistem, akses diblokir sementara.
                                            </p>
                                            {countdown > 0 ? (
                                                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-200/80 dark:bg-rose-900/80 text-xs font-semibold text-rose-950 dark:text-rose-100 border border-rose-300/60 dark:border-rose-800">
                                                    <IconClock size={15} className="animate-spin text-rose-600 dark:text-rose-400" />
                                                    <span>Coba lagi dalam <strong className="font-extrabold text-rose-950 dark:text-white">{countdown}</strong> detik</span>
                                                </div>
                                            ) : (
                                                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-xs font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                    <span>Waktu tunggu selesai. Silakan coba login kembali.</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    {t("auth.login.email")}
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <IconMail size={20} />
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        onChange={(e) =>
                                            setData("email", e.target.value)
                                        }
                                        placeholder={t("auth.login.emailPlaceholder")}
                                        className={`w-full h-12 pl-12 pr-4 rounded-xl border-2 ${
                                            errors.email
                                                ? "border-danger-500 focus:border-danger-500"
                                                : "border-slate-200 dark:border-slate-700 focus:border-primary-500"
                                        } bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-primary-500/20 transition-all`}
                                    />
                                </div>
                                {errors.email && !isRateLimited && (
                                    <p className="mt-1.5 text-sm text-danger-500">
                                        {errors.email}
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    {t("auth.login.password")}
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <IconLock size={20} />
                                    </div>
                                    <input
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        name="password"
                                        value={data.password}
                                        onChange={(e) =>
                                            setData("password", e.target.value)
                                        }
                                        placeholder={t("auth.login.passwordPlaceholder")}
                                        className={`w-full h-12 pl-12 pr-12 rounded-xl border-2 ${
                                            errors.password
                                                ? "border-danger-500 focus:border-danger-500"
                                                : "border-slate-200 dark:border-slate-700 focus:border-primary-500"
                                        } bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-primary-500/20 transition-all`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? (
                                             <IconEyeOff size={20} />
                                        ) : (
                                            <IconEye size={20} />
                                        )}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="mt-1.5 text-sm text-danger-500">
                                        {errors.password}
                                    </p>
                                )}
                            </div>

                            {/* Remember & Forgot */}
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={data.remember}
                                        onChange={(e) =>
                                            setData(
                                                "remember",
                                                e.target.checked
                                            )
                                        }
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-500 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {t("auth.login.remember")}
                                    </span>
                                </label>

                                {canResetPassword && (
                                    <Link
                                        href={route("password.request")}
                                        className="text-sm text-primary-500 hover:text-primary-600 font-medium"
                                    >
                                        {t("auth.login.forgotPassword")}
                                    </Link>
                                )}
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={processing || countdown > 0}
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold hover:from-primary-600 hover:to-primary-700 focus:ring-4 focus:ring-primary-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25"
                            >
                                {processing ? (
                                    <>
                                        <IconLoader2
                                            size={20}
                                            className="animate-spin"
                                        />
                                        {t("common.labels.processing")}
                                    </>
                                ) : countdown > 0 ? (
                                    <>
                                        <IconShieldLock size={20} />
                                        <span>Terkunci ({countdown}s)</span>
                                    </>
                                ) : (
                                    t("auth.login.submit")
                                )}
                            </button>

                            {/* Register Link */}
                            {canRegister && (
                                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                                    {t("auth.login.noAccount")}{" "}
                                    <Link
                                        href="/register"
                                        className="text-primary-500 hover:text-primary-600 font-semibold"
                                    >
                                        {t("auth.login.registerLink")}
                                    </Link>
                                </p>
                            )}
                        </form>
                    </div>
                </div>

                {/* Right - Image/Decoration */}
                <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center p-12">
                    <div className="max-w-md text-center text-white">
                        <div className="w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-8">
                            <IconBuildingStore size={48} />
                        </div>
                        <h2 className="text-3xl font-bold mb-4">
                            {t("auth.login.heroTitle")}
                        </h2>
                        <p className="text-lg opacity-90">
                            {t("auth.login.heroDescription")}
                        </p>
                        <div className="mt-8 flex flex-wrap justify-center gap-3">
                            {t("auth.login.features", { returnObjects: true }).map((feature, i) => (
                                <span
                                    key={i}
                                    className="px-4 py-2 bg-white/20 rounded-full text-sm font-medium"
                                >
                                    {feature}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
