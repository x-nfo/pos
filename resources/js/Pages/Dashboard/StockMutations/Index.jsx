import React from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router } from "@inertiajs/react";
import Table from "@/Components/Dashboard/Table";
import Pagination from "@/Components/Dashboard/Pagination";
import { IconHistory } from "@tabler/icons-react";

const formatDateTime = (value) =>
    value
        ? new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
          }).format(new Date(value))
        : "-";

const getMutationBadge = (type) => {
    switch (type) {
        case "in":
            return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40";
        case "out":
            return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40";
        case "adjustment":
            return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40";
        default:
            return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
};

const getReferenceLabel = (refType) => {
    const map = {
        transaction: "Penjualan (POS)",
        transaction_restock: "Restock Transaksi (Batal/Expired)",
        dine_order: "Pesanan Meja",
        product_create: "Stok Awal",
        stock_opname: "Stock Opname",
        goods_receiving: "Penerimaan Barang",
        sales_return: "Retur Penjualan",
        supplier_return: "Retur Supplier",
        stock_transfer: "Transfer Stok",
    };
    return map[refType] || refType || "-";
};

export default function Index({ stockMutations, products, warehouses = [], filters }) {
    const updateFilter = (key, value) => {
        router.get(
            route("stock-mutations.index"),
            {
                ...filters,
                [key]: value,
            },
            {
                preserveState: true,
                replace: true,
            }
        );
    };

    return (
        <>
            <Head title="Mutasi Stok" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Mutasi Stok
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Histori pergerakan dan audit trail stok dari penjualan, penerimaan barang, transfer, dan penyesuaian stok.
                </p>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-5">
                <select
                    value={filters.product_id || ""}
                    onChange={(event) =>
                        updateFilter("product_id", event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                    <option value="">Semua Produk</option>
                    {products.map((product) => (
                        <option key={product.id} value={product.id}>
                            {product.title}
                        </option>
                    ))}
                </select>

                <select
                    value={filters.mutation_type || ""}
                    onChange={(event) =>
                        updateFilter("mutation_type", event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                    <option value="">Semua Tipe</option>
                    <option value="in">In (Masuk)</option>
                    <option value="out">Out (Keluar)</option>
                    <option value="adjustment">Adjustment (Penyesuaian)</option>
                </select>

                <select
                    value={filters.warehouse_id || ""}
                    onChange={(event) => updateFilter("warehouse_id", event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                    <option value="">Semua Gudang</option>
                    {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                    ))}
                </select>

                <input
                    type="date"
                    value={filters.date_from || ""}
                    onChange={(event) =>
                        updateFilter("date_from", event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />

                <input
                    type="date"
                    value={filters.date_to || ""}
                    onChange={(event) =>
                        updateFilter("date_to", event.target.value)
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
            </div>

            <Table.Card title="Histori Mutasi Stok">
                <Table>
                    <Table.Thead>
                        <tr>
                            <Table.Th>Produk</Table.Th>
                            <Table.Th>Tipe</Table.Th>
                            <Table.Th>Qty</Table.Th>
                            <Table.Th>Before / After</Table.Th>
                            <Table.Th>Gudang</Table.Th>
                            <Table.Th>Referensi</Table.Th>
                            <Table.Th>Dibuat Oleh</Table.Th>
                            <Table.Th>Waktu</Table.Th>
                        </tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {stockMutations.data.length > 0 ? (
                            stockMutations.data.map((mutation) => (
                                <tr
                                    key={mutation.id}
                                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                >
                                    <Table.Td>
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200">
                                                {mutation.product?.title || "-"}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {mutation.product?.barcode || mutation.product?.sku || "-"}
                                            </p>
                                        </div>
                                    </Table.Td>
                                    <Table.Td>
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${getMutationBadge(mutation.mutation_type)}`}>
                                            {mutation.mutation_type}
                                        </span>
                                    </Table.Td>
                                    <Table.Td>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {mutation.qty}
                                        </span>
                                    </Table.Td>
                                    <Table.Td>
                                        <span className="text-slate-600 dark:text-slate-300">
                                            {mutation.stock_before} → {mutation.stock_after}
                                        </span>
                                    </Table.Td>
                                    <Table.Td>{mutation.warehouse?.name || "-"}</Table.Td>
                                    <Table.Td>
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {getReferenceLabel(mutation.reference_type)}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {mutation.notes || "-"}
                                            </p>
                                        </div>
                                    </Table.Td>
                                    <Table.Td>{mutation.creator?.name || "-"}</Table.Td>
                                    <Table.Td>{formatDateTime(mutation.created_at)}</Table.Td>
                                </tr>
                            ))
                        ) : (
                                <Table.Empty
                                    colSpan={8}
                                message={
                                    <div className="text-slate-500 dark:text-slate-400">
                                        Belum ada mutasi stok.
                                    </div>
                                }
                            >
                                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                    <IconHistory size={28} className="text-slate-400" />
                                </div>
                            </Table.Empty>
                        )}
                    </Table.Tbody>
                </Table>
            </Table.Card>

            {stockMutations.last_page > 1 && (
                <Pagination links={stockMutations.links} />
            )}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;
