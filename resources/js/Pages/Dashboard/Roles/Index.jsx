import React from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, useForm, usePage } from "@inertiajs/react";
import Button from "@/Components/Dashboard/Button";
import Input from "@/Components/Dashboard/Input";
import ListBox from "@/Components/Dashboard/ListBox";
import Modal from "@/Components/Dashboard/Modal";
import Search from "@/Components/Dashboard/Search";
import Pagination from "@/Components/Dashboard/Pagination";
import { useAuthorization } from "@/Utils/authorization";
import { usePasswordConfirmation } from "@/Context/PasswordConfirmationContext";
import {
    IconDatabaseOff,
    IconCirclePlus,
    IconTrash,
    IconUserShield,
    IconPencilCog,
    IconPencilCheck,
    IconShield,
} from "@tabler/icons-react";

// Role Card Component
function RoleCard({ role, onEdit, onDelete, canUpdate, canDelete }) {
    const isProtected = role.name === "super-admin";

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white">
                        <IconUserShield size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 capitalize">
                                {role.name}
                            </h3>
                            {isProtected && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400">
                                    <IconShield size={12} />
                                    Sistem
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {role.permissions.length} hak akses
                        </p>
                    </div>
                </div>
            </div>

            {/* Permissions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                    {role.permissions.slice(0, 8).map((permission, index) => (
                        <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-400"
                        >
                            <IconShield size={10} />
                            {permission.name}
                        </span>
                    ))}
                    {role.permissions.length > 8 && (
                        <span className="px-2 py-0.5 text-xs font-medium text-slate-500">
                            +{role.permissions.length - 8} lainnya
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            {isProtected ? (
                <div className="p-3 text-center text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5">
                    <IconShield size={14} className="text-primary-500" />
                    <span>Role sistem terlindungi</span>
                </div>
            ) : (
                (canUpdate || canDelete) && (
                    <div className="flex border-t border-slate-100 dark:border-slate-800">
                        {canUpdate && (
                            <button
                                onClick={onEdit}
                                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-950/50 text-sm font-medium transition-colors"
                            >
                                <IconPencilCog size={16} />
                                <span>Edit</span>
                            </button>
                        )}
                        {canUpdate && canDelete && (
                            <div className="w-px bg-slate-100 dark:bg-slate-800" />
                        )}
                        {canDelete && (
                            <button
                                onClick={onDelete}
                                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/50 text-sm font-medium transition-colors"
                            >
                                <IconTrash size={16} />
                                <span>Hapus</span>
                            </button>
                        )}
                    </div>
                )
            )}
        </div>
    );
}

export default function Index() {
    const { roles, permissions, errors } = usePage().props;
    const { can } = useAuthorization();
    const { requirePasswordConfirmation } = usePasswordConfirmation();
    const canCreateRoles = can("roles-create");
    const canUpdateRoles = can("roles-update");
    const canDeleteRoles = can("roles-delete");

    const {
        data,
        setData,
        transform,
        post,
        delete: destroy,
    } = useForm({
        id: "",
        name: "",
        selectedPermission: [],
        isUpdate: false,
        isOpen: false,
    });

    const setSelectedPermission = (value) =>
        setData("selectedPermission", value);

    transform((data) => ({
        ...data,
        selectedPermission: data.selectedPermission.map(
            (permission) => permission.id
        ),
        _method: data.isUpdate === true ? "put" : "post",
    }));

    const saveRole = async (e) => {
        e.preventDefault();

        requirePasswordConfirmation({
            title: "Konfirmasi Tambah Role",
            description: "Masukkan password akun Anda untuk menyimpan role baru.",
            challenge: "Tambah Role",
            onConfirmed: () => {
                post(route("roles.store"), {
                    onSuccess: () =>
                        setData({ selectedPermission: [], name: "", isOpen: false }),
                });
            },
        });
    };

    const updateRole = async (e) => {
        e.preventDefault();

        requirePasswordConfirmation({
            title: "Konfirmasi Perbarui Role",
            description: `Masukkan password akun Anda untuk memperbarui role ${data.name}.`,
            challenge: "Ubah Role",
            onConfirmed: () => {
                post(route("roles.update", data.id), {
                    onSuccess: () =>
                        setData({
                            id: "",
                            name: "",
                            selectedPermission: [],
                            isUpdate: false,
                            isOpen: false,
                        }),
                });
            },
        });
    };

    const handleEdit = (role) => {
        setData({
            id: role.id,
            selectedPermission: role.permissions,
            name: role.name,
            isUpdate: true,
            isOpen: true,
        });
    };

    const handleDelete = (roleId) => {
        if (confirm("Hapus role ini?")) {
            requirePasswordConfirmation({
                title: "Konfirmasi Hapus Role",
                description: "Masukkan password akun Anda untuk menghapus role ini.",
                challenge: "Hapus Role",
                onConfirmed: () => {
                    destroy(route("roles.destroy", roleId));
                },
            });
        }
    };

    return (
        <>
            <Head title="Akses Group" />

            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <IconUserShield
                                size={28}
                                className="text-primary-500"
                            />
                            Akses Group
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {roles.total || roles.data?.length || 0} group
                            terdaftar
                        </p>
                    </div>
                    {canCreateRoles && (
                        <Button
                            type={"button"}
                            icon={
                                <IconCirclePlus
                                    size={18}
                                    strokeWidth={1.5}
                                />
                            }
                            className={
                                "bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                            }
                            label={"Tambah Group"}
                            onClick={() => setData({
                                id: "",
                                name: "",
                                selectedPermission: [],
                                isUpdate: false,
                                isOpen: true,
                            })}
                        />
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="mb-4 w-full sm:w-80">
                <Search
                    url={route("roles.index")}
                    placeholder="Cari akses group..."
                />
            </div>

            {/* Modal */}
            <Modal
                show={data.isOpen}
                onClose={() => setData("isOpen", false)}
                title={
                    data.isUpdate ? "Ubah Akses Group" : "Tambah Akses Group"
                }
                icon={<IconUserShield size={20} strokeWidth={1.5} />}
                maxWidth="4xl"
            >
                <form onSubmit={data.isUpdate ? updateRole : saveRole} className="space-y-4">
                    <div>
                        <Input
                            label={"Nama Akses Group / Role"}
                            type={"text"}
                            placeholder={"Contoh: Kasir Senior, Supervisor, Admin Gudang"}
                            value={data.name}
                            onChange={(e) => setData("name", e.target.value)}
                            errors={errors.name}
                        />
                    </div>
                    <div>
                        <ListBox
                            label={"Pilih Hak Akses"}
                            data={permissions}
                            selected={data.selectedPermission}
                            setSelected={setSelectedPermission}
                            errors={errors.selectedPermission}
                        />
                    </div>
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={() =>
                                setData({
                                    isOpen: false,
                                    id: "",
                                    name: "",
                                    selectedPermission: [],
                                    isUpdate: false,
                                })
                            }
                            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
                        >
                            Batal
                        </button>
                        <Button
                            type={"submit"}
                            icon={<IconPencilCheck size={18} />}
                            className={
                                "bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 shadow-md shadow-primary-500/20"
                            }
                            label={data.isUpdate ? "Simpan Perubahan" : "Simpan Akses Group"}
                        />
                    </div>
                </form>
            </Modal>

            {/* Content */}
            {roles.data.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {roles.data.map((role) => (
                        <RoleCard
                            key={role.id}
                            role={role}
                            onEdit={() => handleEdit(role)}
                            onDelete={() => handleDelete(role.id)}
                            canUpdate={canUpdateRoles}
                            canDelete={canDeleteRoles}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                        <IconDatabaseOff
                            size={32}
                            className="text-slate-400"
                            strokeWidth={1.5}
                        />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">
                        Belum Ada Group
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Tambahkan group akses pertama.
                    </p>
                    <Button
                        type={"button"}
                        icon={<IconCirclePlus size={18} />}
                        className={
                            "bg-primary-500 hover:bg-primary-600 text-white"
                        }
                        label={"Tambah Group"}
                        onClick={() => setData({
                                id: "",
                                name: "",
                                selectedPermission: [],
                                isUpdate: false,
                                isOpen: true,
                            })}
                    />
                </div>
            )}

            {roles.last_page !== 1 && <Pagination links={roles.links} />}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
