import React, { useState } from "react";
import axios from "axios";
import { IconMail } from "@tabler/icons-react";
import toast from "react-hot-toast";

export default function NewsletterSection() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("idle"); // idle | loading | success | error
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !email.includes("@")) {
            toast.error("Mohon masukkan alamat email yang valid.");
            return;
        }

        setStatus("loading");
        try {
            const res = await axios.post("/newsletter/subscribe", { email });
            setStatus("success");
            const successMsg = res.data?.message || "Selamat datang di The Inner Circle!";
            setMessage(successMsg);
            toast.success(successMsg);
            setEmail("");
        } catch (error) {
            console.error(error);
            setStatus("error");
            const errorMsg =
                error.response?.data?.errors?.email?.[0] ||
                error.response?.data?.message ||
                "Gagal berlangganan. Silakan coba lagi nanti.";
            setMessage(errorMsg);
            toast.error(errorMsg);
        }
    };

    return (
        <section className="py-20 sm:py-32 md:py-40 px-4 sm:px-6 bg-white dark:bg-stone-950 border-t border-karima-brand/10 dark:border-stone-800">
            <div className="container mx-auto max-w-7xl flex flex-col items-center">
                <div className="w-full max-w-xl text-center">
                    {/* Delicate Envelope Icon */}
                    <div className="flex justify-center mb-6 text-karima-brand dark:text-stone-300">
                        <IconMail size={28} strokeWidth={1} />
                    </div>

                    {/* Section Title */}
                    <h3 className="text-3xl sm:text-5xl md:text-6xl font-serif text-karima-brand dark:text-stone-100 mb-3 sm:mb-4 font-thin tracking-tight">
                        The Inner Circle
                    </h3>

                    {/* Subtitle */}
                    <p className="text-karima-ink/40 dark:text-stone-400 mb-8 sm:mb-12 font-light text-xxs sm:text-xs tracking-[0.3em] uppercase">
                        Akses awal ke koleksi busana terbaru & penawaran eksklusif.
                    </p>

                    {/* Minimalist Underline Form */}
                    <div className="w-full max-w-md mx-auto relative">
                        <form
                            className="flex flex-row items-center border-b border-karima-brand/30 dark:border-stone-700 focus-within:border-karima-brand dark:focus-within:border-stone-200 transition-colors w-full relative"
                            onSubmit={handleSubmit}
                        >
                            <input
                                type="email"
                                placeholder="Masukkan alamat email Anda"
                                className="bg-transparent border-none px-0 py-3.5 sm:py-4 text-center text-karima-ink dark:text-stone-100 text-xs sm:text-sm font-light tracking-wider placeholder:font-light placeholder:text-xs sm:placeholder:text-sm placeholder:text-karima-ink/30 dark:placeholder:text-stone-500 focus:outline-none focus:ring-0 w-full"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (status !== "idle") setStatus("idle");
                                }}
                                disabled={status === "loading" || status === "success"}
                                required
                            />
                            <button
                                type="submit"
                                disabled={status === "loading" || status === "success"}
                                className="absolute right-0 text-xxs sm:text-[10px] font-bold uppercase tracking-[0.25em] text-karima-brand dark:text-stone-200 hover:text-karima-accent dark:hover:text-karima-gold disabled:opacity-50 transition-colors cursor-pointer"
                            >
                                {status === "loading" ? "..." : "Join"}
                            </button>
                        </form>

                        {message && (
                            <p
                                className={`text-center mt-3 text-xxs tracking-widest uppercase transition-all ${status === "error"
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-emerald-700 dark:text-emerald-400"
                                    }`}
                            >
                                {message}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

