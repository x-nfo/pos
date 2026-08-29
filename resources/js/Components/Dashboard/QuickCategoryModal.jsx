import React, { useState } from "react";
import Modal from "@/Components/Dashboard/Modal";
import Input from "@/Components/Dashboard/Input";
import Textarea from "@/Components/Dashboard/TextArea";
import ImageCaptureUpload from "@/Components/Dashboard/ImageCaptureUpload";
import { IconCategory, IconDeviceFloppy, IconLoader2, IconPlus } from "@tabler/icons-react";
import axios from "axios";
import toast from "react-hot-toast";

export default function QuickCategoryModal({ show, onClose, onSuccess }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [image, setImage] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setName("");
        setDescription("");
        setImage("");
        setImagePreview(null);
        setErrors({});
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrors({});

        try {
            const formData = new FormData();
            formData.append("name", name);
            if (description) formData.append("description", description);
            if (image instanceof File) formData.append("image", image);

            const response = await axios.post(route("categories.quick-store"), formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            if (response.data?.success && response.data?.data) {
                toast.success(`Kategori "${response.data.data.name}" berhasil ditambahkan!`);
                onSuccess?.(response.data.data);
                handleClose();
            }
        } catch (error) {
            if (error.response?.status === 422 && error.response?.data?.errors) {
                setErrors(error.response.data.errors);
                toast.error("Mohon periksa data kategori yang dimasukkan.");
            } else {
                toast.error(error.response?.data?.message || "Gagal menambahkan kategori.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal show={show} onClose={handleClose} title="Tambah Kategori Baru" maxWidth="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-100 dark:border-primary-900/50 text-xs text-primary-700 dark:text-primary-300">
                    <IconCategory size={18} className="shrink-0" />
                    <span>
                        Kategori yang ditambahkan akan langsung terpilih pada produk ini tanpa perlu memuat ulang halaman.
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <ImageCaptureUpload
                            label="Gambar (Opsional)"
                            currentPreview={imagePreview}
                            onImageSelected={(file, previewUrl) => {
                                setImage(file);
                                setImagePreview(previewUrl);
                            }}
                            onImageRemoved={() => {
                                setImage("");
                                setImagePreview(null);
                            }}
                            error={errors.image?.[0]}
                        />
                    </div>

                    <div className="space-y-3">
                        <div>
                            <Input
                                type="text"
                                label="Nama Kategori"
                                autoFocus
                                placeholder="Contoh: Makanan, Minuman..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                errors={errors.name?.[0]}
                            />
                        </div>

                        <div>
                            <Textarea
                                label="Deskripsi (Opsional)"
                                placeholder="Keterangan singkat kategori"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                errors={errors.description?.[0]}
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-5 py-2 text-sm rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50 shadow-sm"
                    >
                        {isSubmitting ? (
                            <>
                                <IconLoader2 size={16} className="animate-spin" />
                                <span>Menyimpan...</span>
                            </>
                        ) : (
                            <>
                                <IconPlus size={16} strokeWidth={2.5} />
                                <span>Tambah Kategori</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
