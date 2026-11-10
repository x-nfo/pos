import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import {
    IconCirclePlus,
    IconDatabaseOff,
    IconPencilCog,
    IconTrash,
    IconRulerMeasure,
    IconEye,
    IconShirt,
    IconCheck,
    IconX,
} from "@tabler/icons-react";
import Search from "@/Components/Dashboard/Search";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import SizeChartModal from "@/Components/Public/SizeChartModal";

export default function Index({ sizeCharts }) {
    const { can } = useAuthorization();
    const canCreate = can("size-charts-create");
    const canUpdate = can("size-charts-edit");
    const canDelete = can("size-charts-delete");

    const [previewChart, setPreviewChart] = useState(null);

    const handleDelete = (chart) => {
        Swal.fire({
            title: "Hapus Panduan Ukuran?",
            text: `Apakah Anda yakin ingin menghapus "${chart.name}"?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Hapus",
            cancelButtonText: "Batal",
            confirmButtonColor: "#ef4444",
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route("size-charts.destroy", chart.id), {
                    onSuccess: () => toast.success("Panduan ukuran berhasil dihapus."),
                    onError: (err) => toast.error(err.message || "Gagal menghapus."),
                });
            }
        });
    };

    const apparelTypeLabel = (type) => {
        switch (type) {
            case "tops":
                return "👕 Atasan / Baju";
            case "bottoms":
                return "👖 Bawahan / Celana";
            case "footwear":
                return "👟 Sepatu / Alas Kaki";
            case "headwear":
                return "🧢 Topi / Kepala";
            case "accessories":
                return "💍 Aksesoris";
            default:
                return type;
        }
    };

    return (
        <DashboardLayout>
            <Head title="Panduan Ukuran (Size Charts)" />

            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <span className="p-2 bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 rounded-2xl">
                            <IconRulerMeasure size={24} />
                        </span>
                        Panduan Ukuran (Size Charts)
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Kelola template panduan ukuran produk fashion dinamis untuk toko online & POS.
                    </p>
                </div>
                {canCreate && (
                    <Link href={route("size-charts.create")}>
                        <Button
                            type="button"
                            label="Tambah Panduan Ukuran"
                            icon={<IconCirclePlus size={18} />}
                            className="bg-violet-600 hover:bg-violet-700 text-white font-bold"
                        />
                    </Link>
                )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <Search
                        url={route("size-charts.index")}
                        placeholder="Cari nama atau kode panduan..."
                    />
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <Table.Thead>
                            <tr>
                                <Table.Th className="w-12 text-center">No</Table.Th>
                                <Table.Th>Nama & Kode</Table.Th>
                                <Table.Th>Tipe Apparel</Table.Th>
                                <Table.Th>Unit</Table.Th>
                                <Table.Th>Ukuran Tersedia</Table.Th>
                                <Table.Th>Digunakan Di</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th className="text-right">Aksi</Table.Th>
                            </tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {sizeCharts.data.length > 0 ? (
                                sizeCharts.data.map((chart, idx) => (
                                    <Table.Tr key={chart.id}>
                                        <Table.Td className="text-center text-slate-400 font-mono text-xs">
                                            {(sizeCharts.current_page - 1) * sizeCharts.per_page + idx + 1}
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="font-bold text-slate-900 dark:text-white">
                                                {chart.name}
                                            </div>
                                            <div className="font-mono text-xs text-slate-400">
                                                {chart.code}
                                            </div>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                                                {apparelTypeLabel(chart.apparel_type)}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="uppercase text-xs font-bold text-slate-600 dark:text-slate-400">
                                                {chart.default_unit}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="flex flex-wrap gap-1">
                                                {(chart.measurements || []).map((m) => (
                                                    <span
                                                        key={m.size}
                                                        className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200/50 dark:border-violet-800/40"
                                                    >
                                                        {m.size}
                                                    </span>
                                                ))}
                                            </div>
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="text-xs space-y-0.5 text-slate-600 dark:text-slate-400">
                                                <div>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {chart.products_count || 0}
                                                    </span>{" "}
                                                    produk
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {chart.categories_count || 0}
                                                    </span>{" "}
                                                    kategori
                                                </div>
                                            </div>
                                        </Table.Td>
                                        <Table.Td>
                                            {chart.is_active ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                                                    <IconCheck size={12} /> Aktif
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                    <IconX size={12} /> Nonaktif
                                                </span>
                                            )}
                                        </Table.Td>
                                        <Table.Td className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewChart(chart)}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 transition"
                                                    title="Lihat Pratinjau Modal"
                                                >
                                                    <IconEye size={18} />
                                                </button>
                                                {canUpdate && (
                                                    <Link
                                                        href={route("size-charts.edit", chart.id)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/50 transition"
                                                        title="Edit"
                                                    >
                                                        <IconPencilCog size={18} />
                                                    </Link>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(chart)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                                                        title="Hapus"
                                                    >
                                                        <IconTrash size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </Table.Td>
                                    </Table.Tr>
                                ))
                            ) : (
                                <Table.Empty colSpan={8}>
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                        <IconDatabaseOff size={40} strokeWidth={1.5} />
                                        <p className="mt-2 text-sm font-semibold">
                                            Belum ada template panduan ukuran
                                        </p>
                                    </div>
                                </Table.Empty>
                            )}
                        </Table.Tbody>
                    </Table>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <Pagination links={sizeCharts.links} />
                </div>
            </div>

            {/* Pratinjau Modal */}
            <SizeChartModal
                isOpen={Boolean(previewChart)}
                onClose={() => setPreviewChart(null)}
                sizeChart={previewChart}
            />
        </DashboardLayout>
    );
}

