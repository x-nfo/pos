import React, { useState, useRef, useEffect } from "react";
import {
    IconPhoto,
    IconPlus,
    IconTrash,
    IconArrowLeft,
    IconArrowRight,
    IconUpload,
    IconLoader2,
    IconInfoCircle,
    IconSparkles,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { compressImage } from "@/Utils/compressImage";

export default function ProductGalleryUpload({
    existingImages = [],
    onExistingImagesChange = () => {},
    newFiles = [],
    onNewFilesChange = () => {},
    error = null,
    maxImages = 8,
    compressOptions = { maxWidth: 1200, maxHeight: 1200, quality: 0.82 },
}) {
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Track preview URLs for newly uploaded files so they don't leak memory
    const [newPreviews, setNewPreviews] = useState([]);

    useEffect(() => {
        // Generate blob previews for new files
        const urls = newFiles.map((file) => (file instanceof File ? URL.createObjectURL(file) : null));
        setNewPreviews(urls);

        return () => {
            urls.forEach((url) => {
                if (url && url.startsWith("blob:")) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [newFiles]);

    const totalCount = existingImages.length + newFiles.length;
    const canAddMore = totalCount < maxImages;

    // Process newly selected or dropped files
    const handleFiles = async (filesList) => {
        if (!filesList || filesList.length === 0) return;

        const availableSlots = maxImages - totalCount;
        if (availableSlots <= 0) {
            toast.error(`Maksimal ${maxImages} foto galeri.`);
            return;
        }

        const filesToProcess = Array.from(filesList).slice(0, availableSlots);
        setIsProcessing(true);

        const compressedFiles = [];
        let optimizedCount = 0;

        for (const file of filesToProcess) {
            if (!file.type.startsWith("image/")) {
                toast.error(`File "${file.name}" bukan gambar yang valid.`);
                continue;
            }

            try {
                const res = await compressImage(file, compressOptions);
                compressedFiles.push(res.file);
                if (res.originalSize > res.compressedSize) {
                    optimizedCount++;
                }
            } catch (err) {
                console.warn("Gallery image compress fallback:", err);
                compressedFiles.push(file);
            }
        }

        setIsProcessing(false);

        if (compressedFiles.length > 0) {
            onNewFilesChange([...newFiles, ...compressedFiles]);
            toast.success(
                `${compressedFiles.length} foto ditambahkan${
                    optimizedCount > 0 ? " (dioptimasi otomatis)" : ""
                }`
            );
        }
    };

    const handleInputChange = (e) => {
        handleFiles(e.target.files);
        e.target.value = "";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (canAddMore) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer?.files) {
            handleFiles(e.dataTransfer.files);
        }
    };

    // Remove an existing image
    const handleRemoveExisting = (indexToRemove) => {
        const updated = existingImages.filter((_, idx) => idx !== indexToRemove);
        onExistingImagesChange(updated);
    };

    // Remove a new file
    const handleRemoveNew = (indexToRemove) => {
        const updated = newFiles.filter((_, idx) => idx !== indexToRemove);
        onNewFilesChange(updated);
    };

    // Reorder existing images
    const handleMoveExisting = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= existingImages.length) return;

        const updated = [...existingImages];
        const [moved] = updated.splice(index, 1);
        updated.splice(targetIndex, 0, moved);
        onExistingImagesChange(updated);
    };

    // Reorder new files
    const handleMoveNew = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newFiles.length) return;

        const updated = [...newFiles];
        const [moved] = updated.splice(index, 1);
        updated.splice(targetIndex, 0, moved);
        onNewFilesChange(updated);
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <IconPhoto size={18} className="text-primary-500" />
                        Foto Galeri Tambahan
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Tampak depan, belakang, samping, atau detail bahan
                    </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {totalCount} / {maxImages} Foto
                </span>
            </div>

            {/* Error Message */}
            {error && (
                <p className="text-xs text-rose-500 font-medium bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                    {error}
                </p>
            )}

            {/* Gallery Grid */}
            {totalCount > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {/* Render Existing Images */}
                    {existingImages.map((imgUrl, idx) => (
                        <div
                            key={`existing-${idx}-${imgUrl}`}
                            className="group relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex flex-col justify-between shadow-xs transition-all hover:border-primary-400"
                        >
                            <img
                                src={imgUrl}
                                alt={`Foto Galeri ${idx + 1}`}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                            {/* Top Badges */}
                            <div className="relative z-10 flex items-center justify-between p-1.5">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                                    #{idx + 1}
                                </span>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-600/80 text-white backdrop-blur-xs">
                                    Tersimpan
                                </span>
                            </div>

                            {/* Bottom Controls */}
                            <div className="relative z-10 flex items-center justify-between p-1.5">
                                <div className="flex items-center gap-1">
                                    {idx > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleMoveExisting(idx, -1)}
                                            className="p-1 rounded bg-black/60 text-white hover:bg-black/90 transition-colors"
                                            title="Geser ke kiri"
                                        >
                                            <IconArrowLeft size={12} />
                                        </button>
                                    )}
                                    {idx < existingImages.length - 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleMoveExisting(idx, 1)}
                                            className="p-1 rounded bg-black/60 text-white hover:bg-black/90 transition-colors"
                                            title="Geser ke kanan"
                                        >
                                            <IconArrowRight size={12} />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveExisting(idx)}
                                    className="p-1 rounded bg-rose-600/90 hover:bg-rose-700 text-white transition-colors"
                                    title="Hapus foto ini"
                                >
                                    <IconTrash size={13} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Render Newly Added Files */}
                    {newFiles.map((file, idx) => {
                        const previewUrl = newPreviews[idx];
                        const orderNum = existingImages.length + idx + 1;
                        return (
                            <div
                                key={`new-${idx}-${file.name}`}
                                className="group relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-primary-400 dark:border-primary-500 bg-slate-100 dark:bg-slate-800 flex flex-col justify-between shadow-xs transition-all"
                            >
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt={`Foto Baru ${orderNum}`}
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                        <IconPhoto size={28} />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                                {/* Top Badges */}
                                <div className="relative z-10 flex items-center justify-between p-1.5">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                                        #{orderNum}
                                    </span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-600 text-white backdrop-blur-xs flex items-center gap-0.5">
                                        <IconSparkles size={10} /> Baru
                                    </span>
                                </div>

                                {/* Bottom Controls */}
                                <div className="relative z-10 flex items-center justify-between p-1.5">
                                    <div className="flex items-center gap-1">
                                        {idx > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleMoveNew(idx, -1)}
                                                className="p-1 rounded bg-black/60 text-white hover:bg-black/90 transition-colors"
                                                title="Geser ke kiri"
                                            >
                                                <IconArrowLeft size={12} />
                                            </button>
                                        )}
                                        {idx < newFiles.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleMoveNew(idx, 1)}
                                                className="p-1 rounded bg-black/60 text-white hover:bg-black/90 transition-colors"
                                                title="Geser ke kanan"
                                            >
                                                <IconArrowRight size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveNew(idx)}
                                        className="p-1 rounded bg-rose-600/90 hover:bg-rose-700 text-white transition-colors"
                                        title="Batalkan foto ini"
                                    >
                                        <IconTrash size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Dropzone / Upload Trigger */}
            {canAddMore && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !isProcessing && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                        isDragging
                            ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                            : "border-slate-300 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500 bg-slate-50/50 dark:bg-slate-900/40"
                    }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/jpg,image/webp"
                        onChange={handleInputChange}
                        className="hidden"
                    />

                    {isProcessing ? (
                        <div className="flex items-center justify-center gap-2 text-primary-600 dark:text-primary-400 py-1">
                            <IconLoader2 size={18} className="animate-spin" />
                            <span className="text-xs font-medium">Mengoptimasi foto...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5 py-1 text-slate-500 dark:text-slate-400">
                            <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400">
                                <IconUpload size={18} />
                            </div>
                            <div className="text-xs">
                                <span className="font-semibold text-primary-600 dark:text-primary-400">
                                    Klik upload
                                </span>{" "}
                                atau seret beberapa foto ke sini
                            </div>
                            <span className="text-[11px] text-slate-400">
                                JPG, PNG, WEBP (maks. 2MB per file, tersisa {maxImages - totalCount} slot)
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Fashion Hint */}
            <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <IconInfoCircle size={15} className="text-primary-500 flex-shrink-0 mt-0.5" />
                <span>
                    <strong>Tips Fashion:</strong> Tambahkan foto dari berbagai sudut (depan, belakang, samping, close-up jahitan/kain, dan on-model) untuk meningkatkan kepercayaan calon pembeli online.
                </span>
            </div>
        </div>
    );
}
