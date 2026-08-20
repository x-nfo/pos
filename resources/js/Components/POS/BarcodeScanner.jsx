import React, { useEffect, useRef, useState } from "react";
import { IconCamera, IconBarcode, IconX, IconBulb, IconBulbOff } from "@tabler/icons-react";
import { useHaptic } from "@/Hooks/useHaptic";

export default function BarcodeScanner({ onScan, onClose }) {
    const { triggerHaptic } = useHaptic();
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState("");
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const html5QrCodeRef = useRef(null);

    const toggleTorch = async () => {
        try {
            if (!html5QrCodeRef.current) return;
            const newTorchState = !isTorchOn;
            // Apply torch constraint
            await html5QrCodeRef.current.applyVideoConstraints({
                advanced: [{ torch: newTorchState }],
            });
            setIsTorchOn(newTorchState);
            triggerHaptic("tap");
        } catch (err) {
            console.warn("Torch not supported or failed:", err);
            setTorchSupported(false);
        }
    };

    const startScanner = async () => {
        try {
            setError("");
            setScanning(false);
            setIsTorchOn(false);

            if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
                setError("Akses kamera membutuhkan protokol HTTPS. Pastikan URL diawali https://");
                return;
            }

            if (!navigator?.mediaDevices?.getUserMedia) {
                setError("Browser tidak mendukung atau memblokir akses media kamera. Pastikan membuka via HTTPS di Chrome/Safari.");
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, 150));

            const elem = document.getElementById("barcode-scanner-element");
            if (!elem) {
                setError("Elemen pemindai belum siap.");
                return;
            }

            const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

            if (html5QrCodeRef.current) {
                try {
                    await html5QrCodeRef.current.stop();
                } catch (_) {}
            }

            const formatsToSupport = Html5QrcodeSupportedFormats ? [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
            ] : undefined;

            const scanner = new Html5Qrcode("barcode-scanner-element", {
                formatsToSupport,
                verbose: false,
            });
            html5QrCodeRef.current = scanner;

            const qrCodeSuccessCallback = (decodedText) => {
                triggerHaptic("scan");
                scanner.stop().catch(() => {});
                setScanning(false);
                onScan(decodedText);
            };

            const qrConfig = {
                fps: 20,
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const width = Math.min(viewfinderWidth - 20, 300);
                    const height = Math.min(viewfinderHeight - 20, 180);
                    return { width, height };
                },
                aspectRatio: 1.0,
            };

            // Attempt 1: Facing environment
            try {
                await scanner.start(
                    { facingMode: "environment" },
                    qrConfig,
                    qrCodeSuccessCallback,
                    () => {}
                );
                setScanning(true);
                // Check torch capabilities
                try {
                    const capabilities = scanner.getRunningTrackCameraCapabilities();
                    if (capabilities?.torchFeature()?.isSupported()) {
                        setTorchSupported(true);
                    }
                } catch (_) {}
                return;
            } catch (facingErr) {
                console.warn("facingMode: environment failed, trying camera list...", facingErr);
            }

            // Attempt 2: Enumerate devices
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
                const backCamera = devices.find((d) =>
                    /back|rear|environment|belakang/i.test(d.label)
                );
                const targetCameraId = backCamera ? backCamera.id : devices[0].id;
                await scanner.start(
                    targetCameraId,
                    qrConfig,
                    qrCodeSuccessCallback,
                    () => {}
                );
                setScanning(true);
            } else {
                throw new Error("Tidak ada kamera yang terdeteksi pada perangkat ini.");
            }
        } catch (err) {
            console.error("Camera scanner error:", err);
            let msg = "Kamera tidak dapat diakses atau izin ditolak.";
            const errStr = String(err?.message || err || "");

            if (err?.name === "NotAllowedError" || errStr.includes("Permission") || errStr.includes("denied") || errStr.includes("NotAllowed")) {
                msg = "Izin akses kamera ditolak. Silakan klik ikon gembok 🔒 di samping URL dan aktifkan izin Kamera, lalu tekan 'Coba Lagi'.";
            } else if (err?.name === "NotFoundError" || errStr.includes("NotFoundError") || errStr.includes("DevicesNotFound")) {
                msg = "Tidak ditemukan kamera yang aktif pada perangkat Anda.";
            } else if (err?.name === "NotReadableError" || errStr.includes("NotReadable")) {
                msg = "Kamera sedang digunakan oleh aplikasi lain.";
            } else if (errStr) {
                msg = `Gagal membuka kamera: ${errStr}`;
            }
            setError(msg);
            setScanning(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        startScanner();

        return () => {
            mounted = false;
            if (html5QrCodeRef.current) {
                try {
                    html5QrCodeRef.current.stop().catch(() => {});
                } catch (_) {}
            }
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col justify-between pt-safe pb-safe select-none">
            {/* Top Bar HUD */}
            <div className="flex items-center justify-between p-4 px-6 text-white z-10">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-sm font-semibold tracking-wide">
                        {scanning ? "Pindai Barcode / QR Produk" : "Menghubungkan kamera..."}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {torchSupported && (
                        <button
                            type="button"
                            onClick={toggleTorch}
                            className={`p-2.5 rounded-full backdrop-blur-md transition-all active:scale-90 ${
                                isTorchOn
                                    ? "bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/40"
                                    : "bg-white/15 text-white hover:bg-white/25"
                            }`}
                            title="Senter"
                        >
                            {isTorchOn ? <IconBulb size={20} /> : <IconBulbOff size={20} />}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("tap");
                            onClose();
                        }}
                        className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md active:scale-90 transition-all"
                    >
                        <IconX size={20} />
                    </button>
                </div>
            </div>

            {/* Viewfinder Center */}
            <div className="flex-1 relative flex items-center justify-center p-4">
                <div
                    id="barcode-scanner-element"
                    className="w-full max-w-sm aspect-square rounded-3xl overflow-hidden shadow-2xl relative"
                />

                {/* Laser animation indicator when scanning */}
                {scanning && (
                    <div className="absolute inset-x-8 max-w-sm mx-auto h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-pulse-subtle pointer-events-none" />
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="p-4 px-6 text-center max-w-md mx-auto z-10 animate-slide-up">
                    <p className="text-xs text-rose-300 mb-3 bg-rose-950/80 p-3 rounded-2xl border border-rose-800 backdrop-blur-md">
                        {error}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={startScanner}
                            className="px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-500 transition-colors shadow-lg active:scale-95"
                        >
                            Coba Lagi
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-2xl bg-white/15 text-white text-xs font-medium hover:bg-white/25 transition-colors active:scale-95"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Tip */}
            <div className="p-4 text-center text-xs text-white/60 tracking-wide pb-6">
                Arahkan kamera ke barcode atau kode QR produk
            </div>
        </div>
    );
}
