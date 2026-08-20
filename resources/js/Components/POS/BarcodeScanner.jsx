import React, { useEffect, useRef, useState } from "react";
import { IconCamera, IconBarcode, IconX } from "@tabler/icons-react";

export default function BarcodeScanner({ onScan, onClose }) {
    const scannerRef = useRef(null);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState("");
    const html5QrCodeRef = useRef(null);

    const startScanner = async () => {
        try {
            setError("");
            setScanning(false);

            if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
                setError("Akses kamera membutuhkan protokol HTTPS. Pastikan URL diawali https://");
                return;
            }

            if (!navigator?.mediaDevices?.getUserMedia) {
                setError("Browser tidak mendukung atau memblokir akses media kamera. Pastikan membuka via HTTPS di Chrome/Safari.");
                return;
            }

            // Wait a brief moment to ensure DOM element is rendered
            await new Promise((resolve) => setTimeout(resolve, 150));

            const elem = document.getElementById("barcode-scanner-element");
            if (!elem) {
                setError("Elemen pemindai belum siap.");
                return;
            }

            const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

            // Stop existing instance if running
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
                scanner.stop().catch(() => {});
                setScanning(false);
                onScan(decodedText);
            };

            const qrConfig = {
                fps: 15,
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const width = Math.min(viewfinderWidth - 20, 280);
                    const height = Math.min(viewfinderHeight - 20, 160);
                    return { width, height };
                },
                aspectRatio: 1.0,
            };

            // 1. First attempt: standard environment facingMode
            try {
                await scanner.start(
                    { facingMode: "environment" },
                    qrConfig,
                    qrCodeSuccessCallback,
                    () => {}
                );
                setScanning(true);
                return;
            } catch (facingErr) {
                console.warn("facingMode: environment failed, falling back to camera list...", facingErr);
            }

            // 2. Second attempt: enumerate cameras and pick rear or first camera
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
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col justify-between">
            <div className="flex items-center justify-between p-4 text-white">
                <span className="text-sm font-medium">
                    {scanning ? "Arahkan ke barcode" : "Memulai kamera..."}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <IconX size={24} />
                </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-8">
                <div
                    id="barcode-scanner-element"
                    className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden"
                />
            </div>

            {error && (
                <div className="p-4 text-center max-w-md mx-auto">
                    <p className="text-sm text-danger-400 mb-4 bg-danger-950/50 p-3 rounded-xl border border-danger-800/50">{error}</p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={startScanner}
                            className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 transition-colors shadow-lg"
                        >
                            Coba Lagi
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            <div className="p-4 text-center text-xs text-white/50">
                Atau tutup untuk input manual
            </div>
        </div>
    );
}
