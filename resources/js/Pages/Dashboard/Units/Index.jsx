import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, router, usePage } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import {
    IconCirclePlus,
    IconDatabaseOff,
    IconPencilCog,
    IconTrash,
    IconLayoutGrid,
    IconList,
    IconRulerMeasure,
    IconBox,
    IconSparkles,
    IconSearch,
    IconLayersLinked,
    IconInfoCircle,
    IconX,
    IconDeviceFloppy,
    IconScale,
} from "@tabler/icons-react";
import Search from "@/Components/Dashboard/Search";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import MobileDataCard from "@/Components/Mobile/MobileDataCard";
import { useAuthorization } from "@/Utils/authorization";
import Swal from "sweetalert2";
import toast from "react-hot-toast";

// Unit Card for Grid View
function UnitCard({ unit, canUpdate, canDelete, onQuickEdit }) {
    const productCount = unit.product_units_count || 0;

    return (
        <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-800/60 transition-all duration-200 flex flex-col justify-between">
            <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-base shadow-xs">
                            <IconRulerMeasure size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold px-2 py-0.5 rounded-lg bg-teal-100/70 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300 tracking-wider">
                                    {unit.code}
                                </span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                                {unit.name}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div>
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-0.5">
                            Simbol
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {unit.symbol}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-0.5">
                            Digunakan Di
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <IconBox size={14} className="text-slate-400" />
                            {productCount} Produk
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            {(canUpdate || canDelete) && (
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2">
                    {canUpdate && (
                        <button
                            type="button"
                            onClick={() => onQuickEdit(unit)}
                            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-warning-50 hover:text-warning-600 dark:hover:bg-warning-950/40 dark:hover:text-warning-400 transition-colors"
                            title="Edit Satuan"
                        >
                            <IconPencilCog size={16} />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            type="button"
                            onClick={() => {
                                Swal.fire({
                                    title: "Hapus Satuan?",
                                    text: `Satuan "${unit.name} (${unit.code})" akan dihapus.`,
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonColor: "#f43f5e",
                                    cancelButtonColor: "#64748b",
                                    confirmButtonText: "Ya, Hapus",
                                    cancelButtonText: "Batal",
                                }).then((result) => {
                                    if (result.isConfirmed) {
                                        router.delete(route("units.destroy", unit.id));
                                    }
                                });
                            }}
                            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                            title="Hapus Satuan"
                        >
                            <IconTrash size={16} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default function Index({ units }) {
    const { can } = useAuthorization();
    const [viewMode, setViewMode] = useState("table");
    const canCreateUnits = can("units-create");
    const canEditUnits = can("units-edit");
    const canDeleteUnits = can("units-delete");

    // Modal state for quick add/edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [form, setForm] = useState({
        code: "",
        name: "",
        symbol: "",
    });
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);

    const totalUnits = units.total || units.data?.length || 0;
    const usedUnitsCount = units.data?.filter((u) => (u.product_units_count || 0) > 0).length || 0;

    const openCreateModal = () => {
        setEditingUnit(null);
        setForm({ code: "", name: "", symbol: "" });
        setErrors({});
        setIsModalOpen(true);
    };

    const openEditModal = (unit) => {
        setEditingUnit(unit);
        setForm({
            code: unit.code,
            name: unit.name,
            symbol: unit.symbol,
        });
        setErrors({});
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUnit(null);
        setForm({ code: "", name: "", symbol: "" });
        setErrors({});
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});

        if (editingUnit) {
            router.put(route("units.update", editingUnit.id), form, {
                onSuccess: () => {
                    closeModal();
                    setProcessing(false);
                },
                onError: (err) => {
                    setErrors(err);
                    setProcessing(false);
                },
            });
        } else {
            router.post(route("units.store"), form, {
                onSuccess: () => {
                    closeModal();
                    setProcessing(false);
                },
                onError: (err) => {
                    setErrors(err);
                    setProcessing(false);
                },
            });
        }
    };

    const handleDelete = (unit) => {
        Swal.fire({
            title: "Hapus Satuan?",
            text: `Satuan "${unit.name} (${unit.code})" akan dihapus.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#f43f5e",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus",
            cancelButtonText: "Batal",
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route("units.destroy", unit.id));
            }
        });
    };

    return (
        <>
            <Head title="Satuan Barang (UOM)" />

            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                            <IconRulerMeasure size={28} className="text-teal-500" />
                            Satuan Barang (UOM)
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Kelola katalog master satuan barang dan unit konversi bertingkat (Pcs, Box, Pack, Dus, Cup, dll).
                        </p>
                    </div>
                    {canCreateUnits && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-lg shadow-primary-500/20 transition-all hover:scale-[1.02]"
                            >
                                <IconCirclePlus size={18} strokeWidth={2} />
                                Tambah Satuan
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                        <IconRulerMeasure size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Total Satuan Terdaftar
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                            {totalUnits} Satuan
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                        <IconLayersLinked size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Satuan Aktif di Produk
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                            {usedUnitsCount} Satuan
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        <IconScale size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Multi-UOM Ready
                        </div>
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
                            POS & Inventory Terintegrasi
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="w-full sm:w-80">
                    <Search
                        url={route("units.index")}
                        placeholder="Cari kode, nama, atau simbol satuan..."
                    />
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        onClick={() => setViewMode("table")}
                        className={`p-2.5 rounded-xl transition-colors ${
                            viewMode === "table"
                                ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        title="Tampilan Tabel"
                    >
                        <IconList size={20} />
                    </button>
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`p-2.5 rounded-xl transition-colors ${
                            viewMode === "grid"
                                ? "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
                                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                        title="Tampilan Grid"
                    >
                        <IconLayoutGrid size={20} />
                    </button>
                </div>
            </div>

            {/* Content Views */}
            {units.data.length > 0 ? (
                <>
                    {/* 1. Grid View */}
                    {viewMode === "grid" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {units.data.map((unit) => (
                                <UnitCard
                                    key={unit.id}
                                    unit={unit}
                                    canUpdate={canEditUnits}
                                    canDelete={canDeleteUnits}
                                    onQuickEdit={openEditModal}
                                />
                            ))}
                        </div>
                    )}

                    {/* 2. Table View (Desktop) */}
                    {viewMode === "table" && (
                        <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                            <Table>
                                <Table.Thead>
                                    <tr>
                                        <Table.Th className="w-14 text-center">No</Table.Th>
                                        <Table.Th>Kode Satuan</Table.Th>
                                        <Table.Th>Nama Satuan</Table.Th>
                                        <Table.Th>Simbol</Table.Th>
                                        <Table.Th className="text-center">Digunakan Di</Table.Th>
                                        {(canEditUnits || canDeleteUnits) && (
                                            <Table.Th className="text-right">Aksi</Table.Th>
                                        )}
                                    </tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {units.data.map((unit, index) => (
                                        <tr
                                            key={unit.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <Table.Td className="text-center font-medium text-slate-400">
                                                {(units.current_page - 1) * units.per_page + index + 1}
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-teal-100/70 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 tracking-wider">
                                                    {unit.code}
                                                </span>
                                            </Table.Td>
                                            <Table.Td className="font-semibold text-slate-900 dark:text-white">
                                                {unit.name}
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                                                    {unit.symbol}
                                                </span>
                                            </Table.Td>
                                            <Table.Td className="text-center">
                                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                    <IconBox size={14} className="text-slate-400" />
                                                    {unit.product_units_count || 0} Produk
                                                </span>
                                            </Table.Td>
                                            {(canEditUnits || canDeleteUnits) && (
                                                <Table.Td className="text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {canEditUnits && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditModal(unit)}
                                                                className="p-1.5 rounded-lg text-slate-500 hover:text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-950/40 dark:hover:text-warning-400 transition-colors"
                                                                title="Edit Satuan"
                                                            >
                                                                <IconPencilCog size={17} />
                                                            </button>
                                                        )}
                                                        {canDeleteUnits && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(unit)}
                                                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                                                                title="Hapus Satuan"
                                                            >
                                                                <IconTrash size={17} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </Table.Td>
                                            )}
                                        </tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </div>
                    )}

                    {/* 3. Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {units.data.map((unit) => (
                            <MobileDataCard
                                key={unit.id}
                                title={unit.name}
                                subtitle={`Kode: ${unit.code} • Simbol: ${unit.symbol}`}
                                avatar={
                                    <div className="w-full h-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                        <IconRulerMeasure size={22} />
                                    </div>
                                }
                                badge={
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                        <IconBox size={12} className="text-slate-400" />
                                        {unit.product_units_count || 0} Produk
                                    </span>
                                }
                                actions={[
                                    ...(canEditUnits
                                        ? [
                                              {
                                                  label: "Edit",
                                                  icon: <IconPencilCog size={15} />,
                                                  onClick: () => openEditModal(unit),
                                              },
                                          ]
                                        : []),
                                    ...(canDeleteUnits
                                        ? [
                                              {
                                                  label: "Hapus",
                                                  icon: <IconTrash size={15} />,
                                                  variant: "danger",
                                                  onClick: () => handleDelete(unit),
                                              },
                                          ]
                                        : []),
                                ]}
                            />
                        ))}
                    </div>

                    {/* Pagination */}
                    {units.last_page > 1 && (
                        <div className="mt-6">
                            <Pagination links={units.links} />
                        </div>
                    )}
                </>
            ) : (
                /* Empty State */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-4">
                        <IconDatabaseOff size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Belum Ada Satuan
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                        Daftarkan satuan dasar dan satuan kemasan barang untuk mendukung konversi multi-UOM.
                    </p>
                    {canCreateUnits && (
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-lg shadow-primary-500/20 transition-all"
                        >
                            <IconCirclePlus size={18} />
                            Tambah Satuan Sekarang
                        </button>
                    )}
                </div>
            )}

            {/* Quick Add / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                                    <IconRulerMeasure size={20} />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    {editingUnit ? "Edit Satuan Barang" : "Tambah Satuan Baru"}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <IconX size={18} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleFormSubmit}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Kode Satuan (Singkatan Unik) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={10}
                                        value={form.code}
                                        onChange={(e) =>
                                            setForm({ ...form, code: e.target.value.toUpperCase() })
                                        }
                                        placeholder="Contoh: PCS, PACK, DUS, CUP"
                                        className={`w-full h-10 px-3.5 text-sm font-mono uppercase rounded-xl border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                                            errors.code
                                                ? "border-rose-400 focus:border-rose-500"
                                                : "border-slate-200 dark:border-slate-700"
                                        }`}
                                    />
                                    {errors.code && (
                                        <p className="text-xs text-rose-500 mt-1 font-medium">
                                            {errors.code}
                                        </p>
                                    )}
                                    <span className="text-[11px] text-slate-400 mt-1 block">
                                        Maksimal 10 karakter huruf kapital tanpa spasi.
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Nama Lengkap Satuan <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={50}
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm({ ...form, name: e.target.value })
                                        }
                                        placeholder="Contoh: Pieces, Dus / Karton, Porsi Saji"
                                        className={`w-full h-10 px-3.5 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                                            errors.name
                                                ? "border-rose-400 focus:border-rose-500"
                                                : "border-slate-200 dark:border-slate-700"
                                        }`}
                                    />
                                    {errors.name && (
                                        <p className="text-xs text-rose-500 mt-1 font-medium">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Simbol Tampilan <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={10}
                                        value={form.symbol}
                                        onChange={(e) =>
                                            setForm({ ...form, symbol: e.target.value })
                                        }
                                        placeholder="Contoh: pcs, pak, dus, cup, prs"
                                        className={`w-full h-10 px-3.5 text-sm rounded-xl border bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                                            errors.symbol
                                                ? "border-rose-400 focus:border-rose-500"
                                                : "border-slate-200 dark:border-slate-700"
                                        }`}
                                    />
                                    {errors.symbol && (
                                        <p className="text-xs text-rose-500 mt-1 font-medium">
                                            {errors.symbol}
                                        </p>
                                    )}
                                    <span className="text-[11px] text-slate-400 mt-1 block">
                                        Simbol yang akan dicetak pada struk belanja dan nota.
                                    </span>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-500/20 transition-all disabled:opacity-50"
                                >
                                    <IconDeviceFloppy size={16} />
                                    {processing ? "Menyimpan..." : "Simpan Satuan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
