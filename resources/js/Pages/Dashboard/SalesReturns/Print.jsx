import React, { useEffect, useMemo, useRef, useState } from "react";
import { Head, Link, usePage } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconPrinter,
    IconReceipt,
    IconUsb,
    IconBluetooth,
    IconBolt,
    IconCheck,
} from "@tabler/icons-react";
import SalesReturnThermalReceipt, {
    SalesReturnThermalReceipt58mm,
} from "@/Components/Receipt/SalesReturnThermalReceipt";
import { printSalesReturnViaWebUsb } from "@/Utils/webUsbPrinter";
import { printSalesReturnViaBluetooth } from "@/Utils/webBluetoothPrinter";
import toast from "react-hot-toast";
import axios from "axios";

export default function Print({
    salesReturn,
    defaultPaperSize = "58mm",
    autoPrint = false,
    autoPrintDriver = "browser",
    enabledButtons = {
        bluetooth: true,
        webusb: true,
        server: true,
    },
}) {
    const { storeProfile, branding, flash } = usePage().props;
    const initialMode = defaultPaperSize === "80mm" ? "thermal80" : "thermal58";
    const [printMode, setPrintMode] = useState(initialMode);
    const [isDirectPrinting, setIsDirectPrinting] = useState(false);
    const [isWebUsbPrinting, setIsWebUsbPrinting] = useState(false);
    const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
    const hasAutoPrinted = useRef(false);

    const store = useMemo(
        () => ({
            name: storeProfile?.name || branding?.appName || "Rekasir",
            logo: storeProfile?.logo || branding?.logoLight || null,
            address: storeProfile?.address || "",
            phone: storeProfile?.phone || "",
            email: storeProfile?.email || "",
            website: storeProfile?.website || "",
        }),
        [storeProfile, branding]
    );

    const handleDirectPrint = async () => {
        setIsDirectPrinting(true);
        try {
            const res = await axios.post(
                route("sales-returns.print.direct", salesReturn.id)
            );
            if (res.data?.success) {
                toast.success(
                    res.data.message || "Struk retur berhasil dicetak langsung ke printer!"
                );
            }
        } catch (e) {
            toast.error(
                e.response?.data?.message ||
                    "Gagal mencetak struk langsung. Pastikan printer terhubung."
            );
        } finally {
            setIsDirectPrinting(false);
        }
    };

    const handleWebUsbPrint = async () => {
        setIsWebUsbPrinting(true);
        try {
            const paperSize = printMode === "thermal58" ? "58mm" : "80mm";
            await printSalesReturnViaWebUsb(salesReturn, store, paperSize);
            toast.success("Struk retur berhasil dikirim ke printer WebUSB!");
        } catch (e) {
            toast.error(
                e.message || "Gagal mencetak via WebUSB. Pastikan printer USB terhubung."
            );
        } finally {
            setIsWebUsbPrinting(false);
        }
    };

    const handleBluetoothPrint = async () => {
        setIsBluetoothPrinting(true);
        try {
            const paperSize = printMode === "thermal58" ? "58mm" : "80mm";
            await printSalesReturnViaBluetooth(salesReturn, store, paperSize);
            toast.success("Struk retur berhasil dikirim ke printer Bluetooth!");
        } catch (e) {
            toast.error(
                e.message || "Gagal mencetak via Bluetooth. Pastikan Bluetooth aktif."
            );
        } finally {
            setIsBluetoothPrinting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error, { duration: 6000 });
        if (flash?.info) toast(flash.info);
    }, [flash]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const shouldAutoPrint =
            autoPrint ||
            urlParams.get("auto_print") === "1" ||
            urlParams.get("autoprint") === "1";

        if (
            shouldAutoPrint &&
            salesReturn.status === "completed" &&
            !hasAutoPrinted.current
        ) {
            hasAutoPrinted.current = true;
            const timer = setTimeout(() => {
                if (autoPrintDriver === "bluetooth") {
                    toast.success("Memicu auto-print via Bluetooth...");
                    handleBluetoothPrint();
                } else if (autoPrintDriver === "webusb") {
                    toast.success("Memicu auto-print via WebUSB...");
                    handleWebUsbPrint();
                } else if (autoPrintDriver === "server") {
                    toast.success("Auto-print dikirim via Server Spooler (CUPS)");
                    handleDirectPrint();
                } else {
                    toast.success("Memicu cetak otomatis browser...");
                    window.print();
                }
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [autoPrint, autoPrintDriver, salesReturn.status]);

    return (
        <>
            <Head title={`Struk Retur - ${salesReturn.code}`} />

            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 print:bg-white print:p-0 print:m-0 print:min-h-0">
                <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:m-0 print:p-0 print:space-y-0">
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
                        <Link
                            href={route("sales-returns.show", salesReturn.id)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <IconArrowLeft size={18} />
                            Kembali ke Detail Retur
                        </Link>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            {/* Print Mode Selector */}
                            <div className="flex bg-slate-200 dark:bg-slate-800 rounded-xl p-1 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setPrintMode("thermal80")}
                                    className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "thermal80"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt
                                        size={16}
                                        className="inline mr-1"
                                    />
                                    Struk 80mm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintMode("thermal58")}
                                    className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                                        printMode === "thermal58"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt
                                        size={16}
                                        className="inline mr-1"
                                    />
                                    Struk 58mm
                                </button>
                            </div>

                            {enabledButtons?.bluetooth !== false && (
                                <button
                                    type="button"
                                    onClick={handleBluetoothPrint}
                                    disabled={isBluetoothPrinting}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-all shadow-sm w-full sm:w-auto disabled:opacity-50"
                                    title="Cetak Struk Langsung via Web Bluetooth ESC/POS"
                                >
                                    <IconBluetooth
                                        size={18}
                                        className="text-indigo-500"
                                    />
                                    {isBluetoothPrinting
                                        ? "Connecting..."
                                        : "Bluetooth"}
                                </button>
                            )}

                            {enabledButtons?.webusb !== false && (
                                <button
                                    type="button"
                                    onClick={handleWebUsbPrint}
                                    disabled={isWebUsbPrinting}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-all shadow-sm w-full sm:w-auto disabled:opacity-50"
                                    title="Cetak Struk Langsung via WebUSB ESC/POS"
                                >
                                    <IconUsb
                                        size={18}
                                        className="text-cyan-500"
                                    />
                                    {isWebUsbPrinting ? "Printing..." : "WebUSB"}
                                </button>
                            )}

                            {enabledButtons?.server !== false && (
                                <button
                                    type="button"
                                    onClick={handleDirectPrint}
                                    disabled={isDirectPrinting}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-sm font-semibold transition-all shadow-sm w-full sm:w-auto disabled:opacity-50"
                                    title="Cetak Langsung via Server Spooler / CUPS"
                                >
                                    <IconBolt size={18} />
                                    {isDirectPrinting
                                        ? "Printing..."
                                        : "Direct (CUPS)"}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handlePrint}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition-colors w-full sm:w-auto"
                            >
                                <IconPrinter size={18} />
                                Cetak Struk
                            </button>
                        </div>
                    </div>

                    {/* Receipt Preview Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center justify-center print:border-none print:shadow-none print:p-0 print:bg-transparent">
                        <div className="w-full max-w-sm flex justify-center">
                            {printMode === "thermal58" ? (
                                <SalesReturnThermalReceipt58mm
                                    salesReturn={salesReturn}
                                    storeName={store.name}
                                    storePhone={store.phone}
                                    storeEmail={store.email}
                                    storeWebsite={store.website}
                                />
                            ) : (
                                <SalesReturnThermalReceipt
                                    salesReturn={salesReturn}
                                    storeName={store.name}
                                    storeAddress={store.address}
                                    storePhone={store.phone}
                                    storeEmail={store.email}
                                    storeWebsite={store.website}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
