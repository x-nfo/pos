import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
    IconCamera,
    IconPhoto,
    IconTrash,
    IconLoader2,
    IconSparkles,
    IconRefresh,
    IconX,
    IconBarcode,
    IconPackage,
    IconCheck,
    IconAlertCircle,
    IconArrowRight,
    IconSettings,
} from "@tabler/icons-react";
import Modal from "@/Components/Dashboard/Modal";
import { compressImage } from "@/Utils/compressImage";

export default function ProductOcrModal({
    isOpen,
    onClose,
    onSuccess,
    categories = [],
}) {
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [extractedData, setExtractedData] = useState(null);
    const [scanError, setScanError] = useState(null);

    // Live Webcam states
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isCameraStarting, setIsCameraStarting] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const [facingMode, setFacingMode] = useState("environment");
    const videoRef = useRef(null);

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            setImagePreview(null);
            setImageFile(null);
            setExtractedData(null);
            setScanError(null);
            setIsScanning(false);
        }
    }, [isOpen]);

    // Reliable video stream binding
    useEffect(() => {
        let isMounted = true;
        if (isCameraActive && cameraStream && videoRef.current) {
            const video = videoRef.current;
            video.srcObject = cameraStream;
            video.onloadedmetadata = () => {
                if (isMounted) {
                    video.play().catch((e) => console.warn("Video metadata play:", e));
                }
            };
            video.play().catch((e) => console.warn("Direct video play:", e));
        }
        return () => {
            isMounted = false;
        };
    }, [cameraStream, isCameraActive]);

    // Live camera management
    const startCamera = async (mode = facingMode) => {
        stopCamera();
        setScanError(null);
        setIsCameraStarting(true);
        setIsCameraActive(true);

        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            setScanError("Browser tidak mendukung atau memblokir akses media kamera. Pastikan izin kamera aktif atau gunakan tombol Kamera HP / Galeri.");
            setIsCameraActive(false);
            setIsCameraStarting(false);
            return;
        }

        try {
            let stream = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: mode === "environment" ? { ideal: "environment" } : "user",
                        width: { ideal: 1280, min: 640 },
                        height: { ideal: 720, min: 480 },
                    },
                    audio: false,
                });
            } catch (strictErr) {
                console.warn("Retrying with simple video constraint:", strictErr);
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });
            }

            setCameraStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {});
            }
        } catch (err) {
            console.error("Camera access error:", err);
            const errMsg = err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
                ? "Izin akses kamera ditolak di browser. Silakan izinkan akses kamera pada icon gembok URL browser, atau gunakan tombol Kamera HP."
                : `Tidak dapat membuka kamera: ${err.message || "Perangkat kamera sibuk/tidak tersedia."}`;
            setScanError(errMsg);
            setIsCameraActive(false);
            stopCamera();
        } finally {
            setIsCameraStarting(false);
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => {
                track.stop();
            });
            setCameraStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
        setIsCameraStarting(false);
    };

    const toggleFacingMode = () => {
        const nextMode = facingMode === "environment" ? "user" : "environment";
        setFacingMode(nextMode);
        startCamera(nextMode);
    };

    const captureSnapshot = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
            if (blob) {
                const captured = new File([blob], `ocr_capture_${Date.now()}.jpg`, {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                });
                stopCamera();
                await handleImageProcess(captured);
            }
        }, "image/jpeg", 0.9);
    };


    const handleFileInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageProcess(file);
        }
        e.target.value = "";
    };

    const handleImageProcess = async (file) => {
        if (!file) return;
        setScanError(null);
        setExtractedData(null);

        try {
            // Kompresi sebelum upload untuk menghemat bandwidth
            const compressed = await compressImage(file, {
                maxWidth: 1280,
                maxHeight: 1280,
                quality: 0.85,
            });

            setImageFile(compressed.file);
            setImagePreview(URL.createObjectURL(compressed.file));
            // Langsung jalankan proses AI scan
            await runOcrScan(compressed.file);
        } catch (err) {
            console.error("File processing error:", err);
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            await runOcrScan(file);
        }
    };

    const runOcrScan = async (fileToScan) => {
        const file = fileToScan || imageFile;
        if (!file) {
            toast.error("Silakan pilih atau ambil foto produk terlebih dahulu.");
            return;
        }

        setIsScanning(true);
        setScanError(null);

        const formData = new FormData();
        formData.append("image", file);

        try {
            const response = await axios.post(route("products.ocr.scan-single"), formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (response.data?.success && response.data?.data) {
                const data = response.data.data;
                setExtractedData(data);
                toast.success(`OCR Berhasil: "${data.title}"`, { id: "ocr-success-toast" });
            } else {
                setScanError(response.data?.message || "Gagal mengekstrak data dari foto.");
            }
        } catch (err) {
            console.error("OCR Scan error:", err);
            if (err.response?.data?.code === "API_KEY_MISSING") {
                setScanError("API Key Gemini belum disetel. Buka Pengaturan > OCR & AI untuk memasukkan API Key.");
            } else {
                setScanError(err.response?.data?.message || "Terjadi kesalahan saat memproses OCR.");
            }
        } finally {
            setIsScanning(false);
        }
    };

    const handleApply = () => {
        if (!extractedData) return;

        if (onSuccess) {
            onSuccess({
                ...extractedData,
                imageFile: imageFile,
                imagePreview: imagePreview,
            });
        }
        onClose();
    };

    return (
        <Modal
            show={isOpen}
            onClose={onClose}
            title="Scan Produk dengan AI (OCR Kemasan)"
            maxWidth="xl"
        >
            <div className="space-y-4">
                {/* Mode Selector & Camera Viewfinder */}
                {isCameraActive ? (
                    <div className="relative aspect-video rounded-2xl bg-black overflow-hidden flex items-center justify-center shadow-inner border border-slate-700">
                        <video
                            ref={(el) => {
                                videoRef.current = el;
                                if (el && cameraStream && el.srcObject !== cameraStream) {
                                    el.srcObject = cameraStream;
                                    el.play().catch(() => {});
                                }
                            }}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />

                        {isCameraStarting && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-20">
                                <IconLoader2 size={32} className="animate-spin text-primary-400 mb-2" />
                                <span className="text-xs font-semibold">Mengaktifkan sensor kamera...</span>
                            </div>
                        )}

                        {/* Scanning guideline overlay */}
                        <div className="absolute inset-4 border-2 border-primary-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                            <div className="flex justify-between">
                                <span className="w-5 h-5 border-t-2 border-l-2 border-primary-400" />
                                <span className="w-5 h-5 border-t-2 border-r-2 border-primary-400" />
                            </div>
                            <div className="text-center">
                                <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur text-white text-xs font-medium shadow">
                                    Posisikan teks merek / label produk di dalam bingkai
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="w-5 h-5 border-b-2 border-l-2 border-primary-400" />
                                <span className="w-5 h-5 border-b-2 border-r-2 border-primary-400" />
                            </div>
                        </div>

                        {/* Camera Controls */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                            <button
                                type="button"
                                onClick={toggleFacingMode}
                                className="p-2.5 rounded-xl bg-black/60 backdrop-blur text-white hover:bg-black/80 text-xs font-semibold flex items-center gap-1.5 transition-all"
                            >
                                <IconRefresh size={16} />
                                <span>{facingMode === "environment" ? "Belakang" : "Depan"}</span>
                            </button>

                            <button
                                type="button"
                                onClick={captureSnapshot}
                                className="p-3.5 rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-xl ring-4 ring-white/30 transition-transform active:scale-95 flex items-center justify-center"
                                title="Ambil Foto"
                            >
                                <IconCamera size={22} />
                            </button>

                            <button
                                type="button"
                                onClick={stopCamera}
                                className="p-2.5 rounded-xl bg-black/60 backdrop-blur text-white hover:bg-black/80 text-xs font-semibold transition-all"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="relative aspect-video rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden transition-all">
                        {imagePreview ? (
                            <>
                                <img
                                    src={imagePreview}
                                    alt="Foto Produk"
                                    className="w-full h-full object-contain bg-slate-950/50"
                                />

                                {/* Laser Scan Animation Overlay */}
                                {isScanning && (
                                    <div className="absolute inset-0 bg-primary-950/20 flex flex-col items-center justify-center pointer-events-none">
                                        <div className="w-full h-1 bg-gradient-to-r from-transparent via-primary-400 to-transparent absolute animate-bounce" />
                                        <div className="px-4 py-2 rounded-2xl bg-slate-900/90 text-white text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur">
                                            <IconLoader2 size={16} className="animate-spin text-primary-400" />
                                            <span>AI Vision sedang menganalisis kemasan...</span>
                                        </div>
                                    </div>
                                )}

                                {/* Overlay Buttons if not scanning */}
                                {!isScanning && (
                                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => startCamera("environment")}
                                            className="p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-white shadow-md transition-all text-xs font-medium flex items-center gap-1"
                                            title="Foto Ulang"
                                        >
                                            <IconCamera size={16} />
                                            <span>Foto Ulang</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setImagePreview(null);
                                                setImageFile(null);
                                                setExtractedData(null);
                                            }}
                                            className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white shadow-md transition-all"
                                            title="Hapus"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center p-6 flex flex-col items-center">
                                <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-3">
                                    <IconSparkles size={28} />
                                </div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                                    Ambil Foto Label / Kemasan Produk
                                </h4>
                                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mb-4">
                                    AI akan otomatis membaca Nama Produk, Barcode, Kategori, Satuan, dan Estimasi Harga.
                                </p>

                                <div className="flex flex-wrap items-center justify-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => startCamera("environment")}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-500/20 active:scale-95 transition-all"
                                    >
                                        <IconCamera size={16} />
                                        <span>Buka Kamera Live</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 text-xs font-bold transition-all active:scale-95"
                                    >
                                        <IconCamera size={16} />
                                        <span>Kamera HP Native</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                                    >
                                        <IconPhoto size={16} />
                                        <span>Pilih dari Galeri</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* Hidden File Inputs */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileInputChange}
                    className="hidden"
                />
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileInputChange}
                    className="hidden"
                />

                {/* Error Banner */}
                {scanError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs flex items-start gap-2.5">
                        <IconAlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />
                        <div className="flex-1">
                            <p className="font-semibold">Pemindaian OCR Terkendala</p>
                            <p className="mt-0.5 text-rose-600 dark:text-rose-400">{scanError}</p>
                        </div>
                    </div>
                )}

                {/* Extracted Data Result Card */}
                {extractedData && (
                    <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/60 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                                    <IconCheck size={16} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                                        Data Produk Terdeteksi
                                    </h4>
                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                        Periksa hasil ekstraksi sebelum diterapkan ke formulir.
                                    </p>
                                </div>
                            </div>

                            {extractedData.from_catalog && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    Katalog Referensi Nasional
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Nama Produk
                                </label>
                                <input
                                    type="text"
                                    value={extractedData.title || ""}
                                    onChange={(e) =>
                                        setExtractedData((prev) => ({ ...prev, title: e.target.value }))
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Barcode
                                </label>
                                <input
                                    type="text"
                                    value={extractedData.barcode || ""}
                                    onChange={(e) =>
                                        setExtractedData((prev) => ({ ...prev, barcode: e.target.value }))
                                    }
                                    placeholder="Tidak terdeteksi"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Satuan
                                </label>
                                <input
                                    type="text"
                                    value={extractedData.unit || "PCS"}
                                    onChange={(e) =>
                                        setExtractedData((prev) => ({ ...prev, unit: e.target.value }))
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Harga Beli (HPP)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={extractedData.buy_price || 0}
                                    onChange={(e) =>
                                        setExtractedData((prev) => ({ ...prev, buy_price: Number(e.target.value) }))
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Harga Jual
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={extractedData.sell_price || 0}
                                    onChange={(e) =>
                                        setExtractedData((prev) => ({ ...prev, sell_price: Number(e.target.value) }))
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                                />
                            </div>
                        </div>

                        {extractedData.is_existing && (
                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs flex items-center gap-2">
                                <IconAlertCircle size={16} />
                                <span>Barcode ini sudah terdaftar di database toko Anda (Stok saat ini: {extractedData.existing_product?.stock ?? 0}).</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Tutup
                    </button>

                    <div className="flex items-center gap-2">
                        {imageFile && !isScanning && !extractedData && (
                            <button
                                type="button"
                                onClick={() => runOcrScan(imageFile)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 hover:bg-primary-100 border border-primary-200 dark:border-primary-800 transition-all"
                            >
                                <IconRefresh size={15} />
                                <span>Scan Ulang</span>
                            </button>
                        )}

                        {extractedData && (
                            <button
                                type="button"
                                onClick={handleApply}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-lg shadow-primary-500/25 active:scale-95 transition-all"
                            >
                                <IconCheck size={16} />
                                <span>Terapkan ke Formulir</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
