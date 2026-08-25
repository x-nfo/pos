import React, { useEffect, useMemo, useState } from "react";
import { Head, Link, router, useForm } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import Button from "@/Components/Dashboard/Button";
import Table from "@/Components/Dashboard/Table";
import {
    IconAlertCircle,
    IconArrowLeft,
    IconArrowsExchange,
    IconCheck,
    IconDeviceFloppy,
    IconPlus,
    IconPrinter,
    IconSearch,
    IconTrash,
} from "@tabler/icons-react";
import toast from "react-hot-toast";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const formatDateTime = (value) =>
    value
        ? new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
          }).format(new Date(value))
        : "-";

export default function SalesReturnForm({
    title,
    transaction,
    salesReturn = null,
    availableProducts = [],
    submitRoute,
    submitMethod = "post",
    canEdit = true,
    canComplete = false,
    completeRoute = null,
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

    const itemDefaults = useMemo(
        () =>
            transaction.details.map((detail) => ({
                transaction_detail_id: detail.id,
                qty_return: detail.draft_item?.qty_return ?? 0,
                return_reason: detail.draft_item?.return_reason ?? "",
                restock_to_inventory:
                    detail.draft_item?.restock_to_inventory ?? true,
            })),
        [transaction.details]
    );

    const exchangeItemDefaults = useMemo(() => {
        if (!salesReturn?.exchange_items) return [];
        return salesReturn.exchange_items.map((item) => ({
            product_id: item.product_id,
            product: item.product,
            qty: item.qty,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
        }));
    }, [salesReturn?.exchange_items]);

    const form = useForm({
        return_type:
            salesReturn?.return_type ||
            (transaction.customer ? "refund_cash" : "refund_cash"),
        notes: salesReturn?.notes ?? "",
        items: itemDefaults,
        exchange_items: exchangeItemDefaults,
        exchange_payment_method:
            salesReturn?.exchange_payment_method || "cash",
        exchange_cash: salesReturn?.exchange_cash ?? 0,
        exchange_change: salesReturn?.exchange_change ?? 0,
    });

    useEffect(() => {
        form.setData({
            return_type:
                salesReturn?.return_type ||
                (transaction.customer ? "refund_cash" : "refund_cash"),
            notes: salesReturn?.notes ?? "",
            items: itemDefaults,
            exchange_items: exchangeItemDefaults,
            exchange_payment_method:
                salesReturn?.exchange_payment_method || "cash",
            exchange_cash: salesReturn?.exchange_cash ?? 0,
            exchange_change: salesReturn?.exchange_change ?? 0,
        });
    }, [salesReturn, itemDefaults, exchangeItemDefaults]);

    const itemStates = useMemo(() => {
        const itemMap = new Map(
            form.data.items.map((item) => [item.transaction_detail_id, item])
        );

        return transaction.details.map((detail) => {
            const current = itemMap.get(detail.id) ?? {
                qty_return: 0,
                return_reason: "",
                restock_to_inventory: true,
            };
            const qtyReturn = Number(current.qty_return || 0);
            const subtotal = qtyReturn * Number(detail.price || 0);

            return {
                ...detail,
                qty_return: qtyReturn,
                return_reason: current.return_reason || "",
                restock_to_inventory: Boolean(current.restock_to_inventory),
                subtotal,
            };
        });
    }, [form.data.items, transaction.details]);

    // Summary calculations
    const summary = useMemo(() => {
        const selectedItems = itemStates.filter((item) => item.qty_return > 0);
        const totalItems = selectedItems.reduce(
            (carry, item) => carry + item.qty_return,
            0
        );
        const totalReturnAmount = selectedItems.reduce(
            (carry, item) => carry + item.subtotal,
            0
        );
        const restockQty = selectedItems.reduce(
            (carry, item) =>
                carry + (item.restock_to_inventory ? item.qty_return : 0),
            0
        );

        // Exchange Items summary
        const exchangeItems = form.data.exchange_items || [];
        const exchangeQty = exchangeItems.reduce(
            (carry, item) => carry + Number(item.qty || 0),
            0
        );
        const totalExchangeAmount = exchangeItems.reduce(
            (carry, item) =>
                carry + Number(item.qty || 0) * Number(item.unit_price || 0),
            0
        );

        const diffAmount =
            form.data.return_type === "product_exchange"
                ? totalExchangeAmount - totalReturnAmount
                : 0;

        let receivableAfter = null;
        let settlementAmount = 0;

        if (
            transaction.payment_method === "pay_later" &&
            transaction.receivable
        ) {
            receivableAfter = Math.max(
                0,
                Number(transaction.receivable.total || 0) - totalReturnAmount
            );
            settlementAmount = Math.max(
                0,
                Number(transaction.receivable.paid || 0) - receivableAfter
            );
        } else if (transaction.payment_status === "paid") {
            settlementAmount = totalReturnAmount;
        }

        const effectiveReturnType =
            !transaction.customer && form.data.return_type === "store_credit"
                ? "refund_cash"
                : form.data.return_type;

        let finalRefund = 0;
        let finalCredit = 0;

        if (form.data.return_type === "product_exchange") {
            if (diffAmount < 0) {
                const overpaid = Math.abs(diffAmount);
                if (
                    form.data.exchange_payment_method === "store_credit" &&
                    transaction.customer
                ) {
                    finalCredit = overpaid;
                } else {
                    finalRefund = overpaid;
                }
            }
        } else {
            finalRefund =
                effectiveReturnType === "refund_cash" ? settlementAmount : 0;
            finalCredit =
                effectiveReturnType === "store_credit" ? settlementAmount : 0;
        }

        return {
            selectedItemsCount: selectedItems.length,
            totalItems,
            totalReturnAmount,
            restockQty,
            receivableAfter,
            exchangeQty,
            totalExchangeAmount,
            diffAmount,
            refundAmount: finalRefund,
            creditedAmount: finalCredit,
            hasSelectedItems: selectedItems.length > 0,
            hasExchangeItems: exchangeItems.length > 0,
        };
    }, [
        itemStates,
        form.data.return_type,
        form.data.exchange_items,
        form.data.exchange_payment_method,
        transaction.customer,
        transaction.payment_method,
        transaction.payment_status,
        transaction.receivable,
    ]);

    const updateItem = (transactionDetailId, key, value) => {
        form.setData(
            "items",
            form.data.items.map((item) =>
                item.transaction_detail_id === transactionDetailId
                    ? { ...item, [key]: value }
                    : item
            )
        );
    };

    const addExchangeProduct = (product) => {
        const existing = form.data.exchange_items.find(
            (item) => item.product_id === product.id
        );
        if (existing) {
            form.setData(
                "exchange_items",
                form.data.exchange_items.map((item) =>
                    item.product_id === product.id
                        ? {
                              ...item,
                              qty: item.qty + 1,
                              subtotal: (item.qty + 1) * item.unit_price,
                          }
                        : item
                )
            );
        } else {
            form.setData("exchange_items", [
                ...form.data.exchange_items,
                {
                    product_id: product.id,
                    product,
                    qty: 1,
                    unit_price: product.sell_price,
                    subtotal: product.sell_price,
                },
            ]);
        }
        setSearchQuery("");
        setIsProductDropdownOpen(false);
    };

    const updateExchangeItemQty = (productId, newQty) => {
        const qty = Math.max(1, Number(newQty || 1));
        form.setData(
            "exchange_items",
            form.data.exchange_items.map((item) =>
                item.product_id === productId
                    ? {
                          ...item,
                          qty,
                          subtotal: qty * item.unit_price,
                      }
                    : item
            )
        );
    };

    const removeExchangeItem = (productId) => {
        form.setData(
            "exchange_items",
            form.data.exchange_items.filter(
                (item) => item.product_id !== productId
            )
        );
    };

    const filteredAvailableProducts = useMemo(() => {
        if (!searchQuery.trim()) return availableProducts.slice(0, 10);
        const q = searchQuery.toLowerCase();
        return availableProducts
            .filter(
                (p) =>
                    p.title.toLowerCase().includes(q) ||
                    (p.barcode && p.barcode.toLowerCase().includes(q)) ||
                    (p.sku && p.sku.toLowerCase().includes(q))
            )
            .slice(0, 10);
    }, [availableProducts, searchQuery]);

    const handleSaveDraft = (event) => {
        if (event) event.preventDefault();

        form.transform((data) => ({
            ...data,
            action: "draft",
        }));

        form[submitMethod](submitRoute, {
            preserveScroll: true,
            onSuccess: () =>
                toast.success(
                    salesReturn ? "Draft retur diperbarui" : "Draft retur dibuat"
                ),
            onError: (errors) => {
                const message =
                    errors?.items ||
                    errors?.exchange_items ||
                    errors?.sales_return ||
                    "Gagal menyimpan draft retur";
                toast.error(message);
            },
        });
    };

    const handleComplete = (event) => {
        if (event) event.preventDefault();

        form.transform((data) => ({
            ...data,
            action: "complete",
        }));

        form[submitMethod](submitRoute, {
            preserveScroll: true,
            onSuccess: () =>
                toast.success("Retur penjualan berhasil diselesaikan"),
            onError: (errors) => {
                const message =
                    errors?.items ||
                    errors?.exchange_items ||
                    errors?.sales_return ||
                    "Gagal menyelesaikan retur";
                toast.error(message);
            },
        });
    };

    const openReceipt = () => {
        if (!salesReturn) return;
        router.visit(route("sales-returns.print", salesReturn.id));
    };

    return (
        <>
            <Head title={title} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <Link
                            href={
                                salesReturn
                                    ? route("sales-returns.index")
                                    : route("transactions.history")
                            }
                            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                        >
                            <IconArrowLeft size={16} />
                            {salesReturn
                                ? "Kembali ke daftar retur"
                                : "Kembali ke riwayat transaksi"}
                        </Link>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {title}
                            </h1>
                            {salesReturn?.return_type ===
                                "product_exchange" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">
                                    <IconArrowsExchange size={14} />
                                    Tukar Barang
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Invoice {transaction.invoice} •{" "}
                            {formatDateTime(transaction.created_at)}
                        </p>
                    </div>

                    {salesReturn && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                    salesReturn.status === "completed"
                                        ? "bg-success-100 text-success-700 dark:bg-success-950/30 dark:text-success-400"
                                        : "bg-warning-100 text-warning-700 dark:bg-warning-950/30 dark:text-warning-400"
                                }`}
                            >
                                {salesReturn.status === "completed"
                                    ? "Completed"
                                    : "Draft"}
                            </span>
                            {salesReturn.completed_at && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatDateTime(salesReturn.completed_at)}
                                </span>
                            )}
                            {salesReturn.status === "completed" && (
                                <Button
                                    type="button"
                                    icon={<IconPrinter size={16} />}
                                    className="bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
                                    label="Cetak Struk"
                                    onClick={openReceipt}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Summary Info Cards */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoCard
                        label="Pelanggan"
                        value={transaction.customer?.name || "Umum"}
                    />
                    <InfoCard
                        label="Metode Bayar Asal"
                        value={transaction.payment_method
                            ?.replaceAll("_", " ")
                            .toUpperCase()}
                    />
                    <InfoCard
                        label="Total Transaksi Asal"
                        value={formatCurrency(transaction.grand_total)}
                    />
                    <InfoCard
                        label="Nominal Retur"
                        value={formatCurrency(summary.totalReturnAmount)}
                        highlight={summary.totalReturnAmount > 0}
                    />
                </div>

                <form
                    onSubmit={handleSaveDraft}
                    className="grid gap-6 xl:grid-cols-[1.7fr_1fr]"
                >
                    {/* Left Column: Return Items & Exchange Items */}
                    <div className="space-y-6">
                        {/* Section 1: Return Items */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        1. Barang yang Dikembalikan
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Tentukan kuantitas dan alasan pengembalian barang dari pelanggan
                                    </p>
                                </div>
                                {canEdit && (
                                    <Button
                                        type="submit"
                                        icon={<IconDeviceFloppy size={18} />}
                                        className="bg-primary-500 text-white hover:bg-primary-600"
                                        label={
                                            salesReturn
                                                ? "Simpan Draft"
                                                : "Buat Draft"
                                        }
                                        disabled={form.processing}
                                    />
                                )}
                            </div>

                            <Table>
                                <Table.Thead>
                                    <tr>
                                        <Table.Th>Produk</Table.Th>
                                        <Table.Th>Beli</Table.Th>
                                        <Table.Th>Sisa</Table.Th>
                                        <Table.Th>Qty Retur</Table.Th>
                                        <Table.Th>Alasan Retur</Table.Th>
                                        <Table.Th>Restock</Table.Th>
                                        <Table.Th>Subtotal</Table.Th>
                                    </tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {itemStates.map((item) => (
                                        <tr key={item.id}>
                                            <Table.Td>
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-slate-100">
                                                        {item.product?.title ||
                                                            "-"}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {item.product?.barcode ||
                                                            item.product?.sku ||
                                                            "-"}
                                                    </p>
                                                </div>
                                            </Table.Td>
                                            <Table.Td>{item.qty}</Table.Td>
                                            <Table.Td>
                                                {item.remaining_returnable_qty}
                                            </Table.Td>
                                            <Table.Td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={
                                                        item.remaining_returnable_qty
                                                    }
                                                    value={item.qty_return}
                                                    disabled={!canEdit}
                                                    onChange={(event) =>
                                                        updateItem(
                                                            item.id,
                                                            "qty_return",
                                                            event.target.value
                                                        )
                                                    }
                                                    className="h-10 w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 text-center text-sm font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                />
                                            </Table.Td>
                                            <Table.Td>
                                                <input
                                                    type="text"
                                                    value={item.return_reason}
                                                    disabled={
                                                        !canEdit ||
                                                        item.qty_return === 0
                                                    }
                                                    onChange={(event) =>
                                                        updateItem(
                                                            item.id,
                                                            "return_reason",
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Alasan retur"
                                                    className="h-10 min-w-36 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                />
                                            </Table.Td>
                                            <Table.Td>
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        item.restock_to_inventory
                                                    }
                                                    disabled={
                                                        !canEdit ||
                                                        item.qty_return === 0
                                                    }
                                                    onChange={(event) =>
                                                        updateItem(
                                                            item.id,
                                                            "restock_to_inventory",
                                                            event.target.checked
                                                        )
                                                    }
                                                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                />
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                    {formatCurrency(
                                                        item.subtotal
                                                    )}
                                                </span>
                                            </Table.Td>
                                        </tr>
                                    ))}
                                </Table.Tbody>
                            </Table>

                            {form.errors.items && (
                                <p className="mt-3 text-sm text-danger-600">
                                    {form.errors.items}
                                </p>
                            )}
                        </div>

                        {/* Section 2: Replacement Exchange Items (Only when return_type === 'product_exchange') */}
                        {form.data.return_type === "product_exchange" && (
                            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-5 dark:border-cyan-900/50 dark:bg-cyan-950/20">
                                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h2 className="flex items-center gap-2 text-lg font-semibold text-cyan-950 dark:text-cyan-200">
                                            <IconArrowsExchange size={20} />
                                            2. Barang Pengganti (Tukar Baru)
                                        </h2>
                                        <p className="text-xs text-cyan-700 dark:text-cyan-400">
                                            Pilih produk/varian baru yang diambil oleh pelanggan
                                        </p>
                                    </div>

                                    {/* Product search picker */}
                                    {canEdit && (
                                        <div className="relative">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => {
                                                        setSearchQuery(
                                                            e.target.value
                                                        );
                                                        setIsProductDropdownOpen(
                                                            true
                                                        );
                                                    }}
                                                    onFocus={() =>
                                                        setIsProductDropdownOpen(
                                                            true
                                                        )
                                                    }
                                                    placeholder="Cari produk pengganti..."
                                                    className="h-10 w-full min-w-64 rounded-xl border border-cyan-300 bg-white pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-cyan-800 dark:bg-slate-900 dark:text-slate-200"
                                                />
                                                <IconSearch
                                                    size={16}
                                                    className="absolute left-3 top-3 text-slate-400"
                                                />
                                            </div>

                                            {isProductDropdownOpen &&
                                                filteredAvailableProducts.length >
                                                    0 && (
                                                    <div className="absolute right-0 z-30 mt-2 max-h-60 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                                        {filteredAvailableProducts.map(
                                                            (p) => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        addExchangeProduct(
                                                                            p
                                                                        )
                                                                    }
                                                                    className="flex w-full items-center justify-between rounded-lg p-2 text-left text-sm transition hover:bg-cyan-50 dark:hover:bg-slate-800"
                                                                >
                                                                    <div>
                                                                        <p className="font-medium text-slate-800 dark:text-slate-200">
                                                                            {
                                                                                p.title
                                                                            }
                                                                        </p>
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                            Stok:{" "}
                                                                            <span
                                                                                className={
                                                                                    p.stock >
                                                                                    0
                                                                                        ? "font-semibold text-success-600"
                                                                                        : "font-semibold text-danger-600"
                                                                                }
                                                                            >
                                                                                {
                                                                                    p.stock
                                                                                }
                                                                            </span>
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="font-semibold text-primary-600 dark:text-primary-400">
                                                                            {formatCurrency(
                                                                                p.sell_price
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                </div>

                                {form.data.exchange_items.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-cyan-300 py-8 text-center dark:border-cyan-800">
                                        <IconArrowsExchange
                                            size={32}
                                            className="mx-auto text-cyan-400"
                                        />
                                        <p className="mt-2 text-sm font-medium text-cyan-800 dark:text-cyan-300">
                                            Belum ada barang pengganti yang dipilih
                                        </p>
                                        <p className="text-xs text-cyan-600 dark:text-cyan-400">
                                            Gunakan kolom pencarian di atas untuk menambahkan produk pengganti.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <Table.Thead>
                                                <tr>
                                                    <Table.Th>Produk Pengganti</Table.Th>
                                                    <Table.Th>Harga Satuan</Table.Th>
                                                    <Table.Th>Qty</Table.Th>
                                                    <Table.Th>Subtotal</Table.Th>
                                                    {canEdit && (
                                                        <Table.Th>Aksi</Table.Th>
                                                    )}
                                                </tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {form.data.exchange_items.map(
                                                    (item) => (
                                                        <tr key={item.product_id}>
                                                            <Table.Td>
                                                                <div>
                                                                    <p className="font-medium text-slate-800 dark:text-slate-100">
                                                                        {item.product
                                                                            ?.title ||
                                                                            `Produk #${item.product_id}`}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                        {item.product
                                                                            ?.barcode ||
                                                                            item.product
                                                                                ?.sku ||
                                                                            "-"}
                                                                    </p>
                                                                </div>
                                                            </Table.Td>
                                                            <Table.Td>
                                                                {formatCurrency(
                                                                    item.unit_price
                                                                )}
                                                            </Table.Td>
                                                            <Table.Td>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={
                                                                        item.qty
                                                                    }
                                                                    disabled={
                                                                        !canEdit
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        updateExchangeItemQty(
                                                                            item.product_id,
                                                                            e
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                    className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                                />
                                                            </Table.Td>
                                                            <Table.Td>
                                                                <span className="font-semibold text-cyan-900 dark:text-cyan-200">
                                                                    {formatCurrency(
                                                                        item.qty *
                                                                            item.unit_price
                                                                    )}
                                                                </span>
                                                            </Table.Td>
                                                            {canEdit && (
                                                                <Table.Td>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            removeExchangeItem(
                                                                                item.product_id
                                                                            )
                                                                        }
                                                                        className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                                    >
                                                                        <IconTrash
                                                                            size={16}
                                                                        />
                                                                    </button>
                                                                </Table.Td>
                                                            )}
                                                        </tr>
                                                    )
                                                )}
                                            </Table.Tbody>
                                        </Table>
                                    </div>
                                )}

                                {form.errors.exchange_items && (
                                    <p className="mt-3 text-sm text-danger-600">
                                        {form.errors.exchange_items}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Settlement & Impact Preview */}
                    <div className="space-y-6">
                        {/* Settlement Configuration Card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                                Metode Penyelesaian
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Tipe Retur
                                    </label>
                                    <select
                                        value={form.data.return_type}
                                        disabled={!canEdit}
                                        onChange={(event) =>
                                            form.setData(
                                                "return_type",
                                                event.target.value
                                            )
                                        }
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        <option value="refund_cash">
                                            Refund Tunai (Uang Kembali)
                                        </option>
                                        {transaction.customer && (
                                            <option value="store_credit">
                                                Saldo Toko (Store Credit)
                                            </option>
                                        )}
                                        <option value="product_exchange">
                                            Tukar Barang (Product Exchange)
                                        </option>
                                    </select>
                                    {!transaction.customer && (
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            Transaksi tanpa data pelanggan dapat menggunakan Refund Tunai atau Tukar Barang.
                                        </p>
                                    )}
                                </div>

                                {/* Dynamic Settlement Form for Product Exchange */}
                                {form.data.return_type ===
                                    "product_exchange" && (
                                    <div className="space-y-3 rounded-xl border border-cyan-100 bg-cyan-50/50 p-4 dark:border-cyan-900/40 dark:bg-cyan-950/20">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                                            Status Selisih Harga
                                        </h3>

                                        {summary.diffAmount === 0 && (
                                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                <IconCheck size={18} />
                                                Tukar Pas (Selisih Rp 0)
                                            </div>
                                        )}

                                        {summary.diffAmount > 0 && (
                                            <div className="space-y-3">
                                                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                                    <span className="font-semibold">
                                                        Kurang Bayar (Pelanggan Tambah):
                                                    </span>{" "}
                                                    {formatCurrency(
                                                        summary.diffAmount
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                                                        Metode Bayar Kekurangan
                                                    </label>
                                                    <select
                                                        value={
                                                            form.data
                                                                .exchange_payment_method
                                                        }
                                                        disabled={!canEdit}
                                                        onChange={(e) =>
                                                            form.setData(
                                                                "exchange_payment_method",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                    >
                                                        <option value="cash">
                                                            Tunai (Cash)
                                                        </option>
                                                        <option value="bank_transfer">
                                                            Transfer Bank
                                                        </option>
                                                        <option value="qris">
                                                            QRIS
                                                        </option>
                                                        <option value="edc">
                                                            Kartu Debit / EDC
                                                        </option>
                                                    </select>
                                                </div>

                                                {form.data
                                                    .exchange_payment_method ===
                                                    "cash" && (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                                                                Tunai Diterima
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min={
                                                                    summary.diffAmount
                                                                }
                                                                value={
                                                                    form.data
                                                                        .exchange_cash ||
                                                                    summary.diffAmount
                                                                }
                                                                disabled={
                                                                    !canEdit
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    const val =
                                                                        Number(
                                                                            e
                                                                                .target
                                                                                .value ||
                                                                                0
                                                                        );
                                                                    form.setData(
                                                                        (
                                                                            prev
                                                                        ) => ({
                                                                            ...prev,
                                                                            exchange_cash:
                                                                                val,
                                                                            exchange_change:
                                                                                Math.max(
                                                                                    0,
                                                                                    val -
                                                                                        summary.diffAmount
                                                                                ),
                                                                        })
                                                                    );
                                                                }}
                                                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                                                                Kembalian
                                                            </label>
                                                            <input
                                                                type="text"
                                                                disabled
                                                                value={formatCurrency(
                                                                    Math.max(
                                                                        0,
                                                                        (form.data
                                                                            .exchange_cash ||
                                                                            summary.diffAmount) -
                                                                            summary.diffAmount
                                                                    )
                                                                )}
                                                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-emerald-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-emerald-400"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {summary.diffAmount < 0 && (
                                            <div className="space-y-3">
                                                <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                    <span className="font-semibold">
                                                        Lebih Bayar (Toko Refund):
                                                    </span>{" "}
                                                    {formatCurrency(
                                                        Math.abs(
                                                            summary.diffAmount
                                                        )
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                                                        Metode Pengembalian Selisih
                                                    </label>
                                                    <select
                                                        value={
                                                            form.data
                                                                .exchange_payment_method ===
                                                            "store_credit"
                                                                ? "store_credit"
                                                                : "refund_cash"
                                                        }
                                                        disabled={
                                                            !canEdit ||
                                                            !transaction.customer
                                                        }
                                                        onChange={(e) =>
                                                            form.setData(
                                                                "exchange_payment_method",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                                    >
                                                        <option value="refund_cash">
                                                            Refund Tunai
                                                        </option>
                                                        {transaction.customer && (
                                                            <option value="store_credit">
                                                                Saldo Toko (Store Credit)
                                                            </option>
                                                        )}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Catatan
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={form.data.notes}
                                        disabled={!canEdit}
                                        onChange={(event) =>
                                            form.setData(
                                                "notes",
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                        placeholder="Catatan retur / tukar barang"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Impact Preview Card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                                Preview Dampak Transaksi
                            </h2>

                            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                <PreviewRow
                                    label="Item retur dipilih"
                                    value={`${summary.selectedItemsCount} produk (${summary.totalItems} item)`}
                                />
                                <PreviewRow
                                    label="Stok dikembalikan"
                                    value={`${summary.restockQty} item`}
                                />

                                {form.data.return_type ===
                                "product_exchange" ? (
                                    <>
                                        <PreviewRow
                                            label="Barang pengganti"
                                            value={`${summary.exchangeQty} item`}
                                        />
                                        <PreviewRow
                                            label="Total Nilai Retur"
                                            value={formatCurrency(
                                                summary.totalReturnAmount
                                            )}
                                        />
                                        <PreviewRow
                                            label="Total Nilai Pengganti"
                                            value={formatCurrency(
                                                summary.totalExchangeAmount
                                            )}
                                        />
                                        <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                                        <PreviewRow
                                            label="Selisih Akhir"
                                            value={
                                                summary.diffAmount === 0
                                                    ? "Rp 0 (Tukar Pas)"
                                                    : summary.diffAmount > 0
                                                    ? `+ ${formatCurrency(
                                                          summary.diffAmount
                                                      )} (Tambah)`
                                                    : `- ${formatCurrency(
                                                          Math.abs(
                                                              summary.diffAmount
                                                          )
                                                      )} (Refund)`
                                            }
                                            strong
                                        />
                                    </>
                                ) : (
                                    <>
                                        <PreviewRow
                                            label="Refund Tunai"
                                            value={formatCurrency(
                                                summary.refundAmount
                                            )}
                                        />
                                        <PreviewRow
                                            label="Saldo Toko"
                                            value={formatCurrency(
                                                summary.creditedAmount
                                            )}
                                        />
                                        {transaction.receivable && (
                                            <>
                                                <PreviewRow
                                                    label="Piutang Saat Ini"
                                                    value={formatCurrency(
                                                        transaction.receivable
                                                            .total
                                                    )}
                                                />
                                                <PreviewRow
                                                    label="Piutang Setelah Retur"
                                                    value={formatCurrency(
                                                        summary.receivableAfter ??
                                                            0
                                                    )}
                                                />
                                            </>
                                        )}
                                        <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                                        <PreviewRow
                                            label="Nominal Retur"
                                            value={formatCurrency(
                                                summary.totalReturnAmount
                                            )}
                                            strong
                                        />
                                    </>
                                )}
                            </div>

                            {canComplete && (
                                <div className="mt-5">
                                    <Button
                                        type="button"
                                        icon={<IconCheck size={18} />}
                                        className="w-full bg-success-500 text-white hover:bg-success-600 disabled:opacity-50"
                                        label="Selesaikan Retur"
                                        onClick={handleComplete}
                                        disabled={
                                            !summary.hasSelectedItems ||
                                            (form.data.return_type ===
                                                "product_exchange" &&
                                                !summary.hasExchangeItems) ||
                                            form.processing
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

function InfoCard({ label, value, highlight = false }) {
    return (
        <div
            className={`rounded-2xl border p-4 transition ${
                highlight
                    ? "border-primary-300 bg-primary-50/50 dark:border-primary-900/50 dark:bg-primary-950/30"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            }`}
        >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {value}
            </p>
        </div>
    );
}

function PreviewRow({ label, value, strong = false }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400">{label}</span>
            <span
                className={
                    strong
                        ? "font-semibold text-slate-900 dark:text-white"
                        : "font-medium text-slate-800 dark:text-slate-200"
                }
            >
                {value}
            </span>
        </div>
    );
}

SalesReturnForm.layout = (page) => <DashboardLayout children={page} />;
