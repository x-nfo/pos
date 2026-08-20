import React, { useState, useRef, useEffect } from "react";
import {
    IconCamera,
    IconPhoto,
    IconTrash,
    IconLoader2,
    IconSparkles,
    IconRefresh,
    IconDeviceFloppy,
    IconX,
    IconVideo,
} from "@tabler/icons-react";
import Modal from "@/Components/Dashboard/Modal";
import toast from "react-hot-toast";
import { compressImage } from "@/Utils/compressImage";

export default function ImageCaptureUpload({
    currentPreview = null,
    onImageSelected,
    onImageRemoved,
    error = null,
    label = "Gambar Produk",
    compressOptions = { maxWidth: 1200, maxHeight: 1200, quality: 0.82 },
}) {
    const [preview, setPreview] = useState(currentPreview);
    const [isCompressing, setIsCompressing] = useState(false);
    const [compressionInfo, setCompressionInfo] = useState(null);

    // Live webcam modal state
    const [showWebcamModal, setShowWebcamModal] = useState(false);
    const [webcamStream, setWebcamStream] = useState(null);
    const [webcamError, setWebcamError] = useState(null);
    const [facingMode, setFacingMode] = useState("environment"); // 'environment' (rear) or 'user' (front)
    const videoRef = useRef(null);

    // Hidden file inputs
    const cameraInputRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setPreview(currentPreview);
    }, [currentPreview]);

    // Handle file processing from either input
    const processFile = async (file) => {
        if (!file) return;

        setIsCompressing(true);
        try {
            const result = await compressImage(file, compressOptions);
            const previewUrl = URL.createObjectURL(result.file);
            setPreview(previewUrl);

            const savedPercent = result.originalSize > 0 
                ? Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100)
                : 0;

            setCompressionInfo({
                original: result.formattedOriginal,
                compressed: result.formattedCompressed,
                savedPercent: savedPercent > 0 ? savedPercent : 0,
            });

            if (onImageSelected) {
                onImageSelected(result.file, previewUrl);
            }

            if (savedPercent > 10) {
                toast.success(`Foto dioptimasi: ${result.formattedOriginal} → ${result.formattedCompressed} (-${savedPercent}%)`, {
                    id: "compress-toast",
                    duration: 3000,
                });
            }
        } catch (err) {
            console.error("Compression error:", err);
            // Fallback: use raw file
            const previewUrl = URL.createObjectURL(file);
            setPreview(previewUrl);
            if (onImageSelected) {
                onImageSelected(file, previewUrl);
            }
        } finally {
            setIsCompressing(false);
        }
    };

    const handleFileInputChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
        // Reset input value so re-selecting same file triggers change
        e.target.value = "";
    };

    // Native Camera trigger (works instantly on mobile devices)
    const triggerNativeCamera = () => {
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        }
    };

    // File / Gallery picker trigger
    const triggerFilePicker = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // Clear image
    const handleRemove = () => {
        setPreview(null);
        setCompressionInfo(null);
        if (onImageRemoved) {
            onImageRemoved();
        }
    };

    // Live Webcam Modal Management
    const startWebcam = async (mode = facingMode) => {
        setWebcamError(null);
        stopWebcam();
        try {
            const constraints = {
                video: {
                    facingMode: { ideal: mode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setWebcamStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Webcam error:", err);
            setWebcamError("Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser.");
        }
    };

    const stopWebcam = () => {
        if (webcamStream) {
            webcamStream.getTracks().forEach((track) => track.stop());
            setWebcamStream(null);
        }
    };

    const openWebcamModal = () => {
        setShowWebcamModal(true);
        startWebcam("environment");
    };

    const closeWebcamModal = () => {
        stopWebcam();
        setShowWebcamModal(false);
    };

    const toggleFacingMode = () => {
        const newMode = facingMode === "environment" ? "user" : "environment";
        setFacingMode(newMode);
        startWebcam(newMode);
    };

    const captureSnapshotFromWebcam = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
            if (blob) {
                const capturedFile = new File([blob], `camera_capture_${Date.now()}.jpg`, {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                });
                closeWebcamModal();
                await processFile(capturedFile);
            }
        }, "image/jpeg", 0.9);
    };

    // Attach stream to video tag whenever modal opens/stream updates
    useEffect(() => {
        if (showWebcamModal && videoRef.current && webcamStream) {
            videoRef.current.srcObject = webcamStream;
        }
    }, [showWebcamModal, webcamStream]);

    return (
        <div className="flex flex-col gap-3">
            {label && (
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>{label}</span>
                    {isCompressing && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 font-normal animate-pulse">
                            <IconLoader2 size={13} className="animate-spin" />
                            Mengoptimasi ukuran...
                        </span>
                    )}
                </label>
            )}

            {/* Hidden native inputs */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInputChange}
                className="hidden"
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
            />

            {/* Preview Box */}
            <div className="relative aspect-square rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden group transition-all duration-200 hover:border-primary-400/60 dark:hover:border-primary-500/60">
                {preview ? (
                    <>
                        <img
                            src={preview}
                            alt="Preview Produk"
                            className="w-full h-full object-cover"
                        />
                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={triggerNativeCamera}
                                className="p-2.5 bg-white/90 hover:bg-white text-slate-700 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
                                title="Foto Ulang via Kamera"
                            >
                                <IconCamera size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={triggerFilePicker}
                                className="p-2.5 bg-white/90 hover:bg-white text-slate-700 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
                                title="Pilih dari Galeri"
                            >
                                <IconPhoto size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={handleRemove}
                                className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
                                title="Hapus Gambar"
                            >
                                <IconTrash size={18} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-center p-6 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
                            <IconPhoto size={32} />
                        </div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            Belum ada gambar
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
                            Ambil foto langsung lewat kamera atau pilih dari galeri
                        </p>
                    </div>
                )}

                {/* Compression Info Badge */}
                {compressionInfo && (
                    <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur text-white text-[11px] flex items-center justify-between">
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <IconSparkles size={13} />
                            Teroptimasi
                        </span>
                        <span className="text-slate-300">
                            {compressionInfo.compressed} ({`-${compressionInfo.savedPercent}%`})
                        </span>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={triggerNativeCamera}
                    disabled={isCompressing}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 text-xs font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/50 active:scale-[0.98] transition-all shadow-sm"
                >
                    <IconCamera size={16} className="shrink-0" />
                    <span>Ambil Kamera</span>
                </button>

                <button
                    type="button"
                    onClick={triggerFilePicker}
                    disabled={isCompressing}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition-all shadow-sm"
                >
                    <IconPhoto size={16} className="shrink-0" />
                    <span>Pilih Galeri</span>
                </button>
            </div>

            {/* Optional Live Viewfinder trigger for desktop / webcam users */}
            {typeof navigator !== "undefined" && navigator?.mediaDevices?.getUserMedia && (
                <button
                    type="button"
                    onClick={openWebcamModal}
                    className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center gap-1.5 py-1 transition-colors"
                >
                    <IconVideo size={14} />
                    <span>Buka Jendela Kamera Langsung (Live View)</span>
                </button>
            )}

            {error && (
                <small className="text-xs text-danger-500 dark:text-danger-400">
                    {error}
                </small>
            )}

            {/* Live Webcam Modal */}
            <Modal
                show={showWebcamModal}
                onClose={closeWebcamModal}
                title="Kamera Langsung (Live Viewfinder)"
                maxWidth="lg"
            >
                <div className="space-y-4">
                    {webcamError ? (
                        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-sm text-center">
                            {webcamError}
                        </div>
                    ) : (
                        <div className="relative aspect-video rounded-xl bg-black overflow-hidden flex items-center justify-center shadow-inner">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                            {/* Grid overlay guideline */}
                            <div className="absolute inset-0 border border-white/20 pointer-events-none grid grid-cols-3 grid-rows-3">
                                <div className="border-r border-b border-white/10" />
                                <div className="border-r border-b border-white/10" />
                                <div className="border-b border-white/10" />
                                <div className="border-r border-b border-white/10" />
                                <div className="border-r border-b border-white/10" />
                                <div className="border-b border-white/10" />
                                <div className="border-r border-white/10" />
                                <div className="border-r border-white/10" />
                                <div />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                        <button
                            type="button"
                            onClick={toggleFacingMode}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            <IconRefresh size={15} />
                            Ganti Kamera ({facingMode === "environment" ? "Belakang" : "Depan"})
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={closeWebcamModal}
                                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={captureSnapshotFromWebcam}
                                disabled={!!webcamError}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white shadow-md active:scale-95 transition-all disabled:opacity-50"
                            >
                                <IconCamera size={16} />
                                Ambil Foto
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
