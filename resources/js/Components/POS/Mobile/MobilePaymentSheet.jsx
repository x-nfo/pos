import React, { useMemo } from "react";
import {
    IconX,
    IconCash,
    IconBuildingBank,
    IconCreditCard,
    IconClock,
    IconCheck,
    IconQrcode,
} from "@tabler/icons-react";
import MobileBottomSheet from "@/Components/Mobile/MobileBottomSheet";
import MobileNumpad from "@/Components/Mobile/MobileNumpad";
import { useHaptic } from "@/Hooks/useHaptic";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export default function MobilePaymentSheet({
    isOpen,
    onClose,
    payable = 0,
    paymentMethod = "cash",
    onPaymentMethodChange,
    paymentGateways = [],
    bankAccounts = [],
    selectedBankAccount = null,
    onSelectBankAccount,
    cashInput = "",
    onCashInputChange,
    payLater = false,
    onPayLaterChange,
    dueDate = "",
    onDueDateChange,
    selectedCustomer = null,
    onSubmit,
    isSubmitting = false,
    isLoadingPricing = false,
}) {
    const { triggerHaptic } = useHaptic();

    const cash = Number(cashInput || 0);
    const change = Math.max(0, cash - payable);
    const isCashSufficient = cash >= payable;

    const getGatewayIcon = (val) => {
        if (val === "cash") return IconCash;
        if (val === "bank_transfer") return IconBuildingBank;
        if (val === "qrisly") return IconQrcode;
        return IconCreditCard;
    };

    const paymentOptions = useMemo(() => {
        if (Array.isArray(paymentGateways) && paymentGateways.length > 0) {
            const nonCash = paymentGateways
                .filter((gw) => gw?.value && gw.value.toLowerCase() !== "cash")
                .map((gw) => ({
                    value: gw.value,
                    label: gw.value === "qrisly" ? "QRIS" : gw.label,
                    icon: getGatewayIcon(gw.value),
                }));
            return [
                { value: "cash", label: "Tunai", icon: IconCash },
                ...nonCash,
            ];
        }
        return [
            { value: "cash", label: "Tunai", icon: IconCash },
            { value: "bank_transfer", label: "Transfer", icon: IconBuildingBank },
            { value: "qrisly", label: "QRIS", icon: IconQrcode },
        ];
    }, [paymentGateways]);

    if (!isOpen) return null;

    const isReadyToSubmit =
        !isSubmitting &&
        !isLoadingPricing &&
        (payLater ? !!selectedCustomer?.id : paymentMethod === "cash" ? isCashSufficient : true);

    const handleFormSubmit = () => {
        if (!isReadyToSubmit) return;
        triggerHaptic("success");
        onSubmit();
    };

    return (
        <MobileBottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title="Pembayaran Transaksi"
            subtitle={`Total Tagihan: ${formatPrice(payable)}`}
            maxHeight="max-h-[92vh]"
            footer={
                <button
                    type="button"
                    onClick={handleFormSubmit}
                    disabled={!isReadyToSubmit}
                    className={`w-full h-14 py-3.5 px-4 rounded-2xl text-sm sm:text-base font-bold tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
                        isReadyToSubmit
                            ? "bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-primary-500/25"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none"
                    }`}
                >
                    {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <IconCheck size={20} strokeWidth={2.5} />
                            <span>
                                {payLater
                                    ? "Simpan Sebagai Piutang"
                                    : `Bayar ${formatPrice(paymentMethod === "cash" && isCashSufficient ? payable : payable)}`}
                            </span>
                        </>
                    )}
                </button>
            }
        >
            <div className="space-y-4">
                {/* Pay Later Toggle */}
                <div
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 ${
                        payLater
                            ? "border-primary-500/50 bg-primary-50/50 dark:bg-primary-950/20 dark:border-primary-500/40 shadow-sm"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                    }`}
                >
                    <div>
                        <div className="flex items-center gap-1.5">
                            <IconClock size={16} className="text-amber-500" />
                            <p className="text-xs font-bold text-slate-800 dark:text-white">
                                Bayar Nanti (Piutang)
                            </p>
                            {payLater && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-300">
                                    Aktif
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Catat invoice sebagai piutang customer
                        </p>
                    </div>
                    <input
                        type="checkbox"
                        checked={payLater}
                        onChange={(e) => {
                            triggerHaptic("tap");
                            onPayLaterChange(e.target.checked);
                            if (e.target.checked) {
                                onPaymentMethodChange("cash");
                            }
                        }}
                        className="w-5 h-5 rounded-lg text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                </div>

                {payLater ? (
                    <div className="space-y-3">
                        {!selectedCustomer?.id && (
                            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                                ⚠️ Wajib memilih pelanggan terdaftar untuk opsi piutang.
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Jatuh Tempo
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => onDueDateChange(e.target.value)}
                                className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Payment Method Selector */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Metode Pembayaran
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {paymentOptions.map((opt) => {
                                    const Icon = opt.icon;
                                    const isActive = paymentMethod === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                triggerHaptic("tap");
                                                onPaymentMethodChange(opt.value);
                                            }}
                                            className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all active:scale-95 ${
                                                isActive
                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-bold shadow-sm"
                                                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                                            }`}
                                        >
                                            <Icon size={20} />
                                            <span className="text-xs">{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bank Transfer Selection */}
                        {paymentMethod === "bank_transfer" && (
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    Pilih Rekening Bank
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {bankAccounts.map((bank) => {
                                        const isSelected = selectedBankAccount?.id === bank.id;
                                        return (
                                            <button
                                                key={bank.id}
                                                type="button"
                                                onClick={() => {
                                                    triggerHaptic("tap");
                                                    onSelectBankAccount(bank);
                                                }}
                                                className={`p-3 rounded-2xl border text-left flex items-center justify-between active:scale-[0.98] transition-all ${
                                                    isSelected
                                                        ? "border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 shadow-sm"
                                                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                }`}
                                            >
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                                                        {bank.bank_name}
                                                    </p>
                                                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {bank.account_number} a.n. {bank.account_name}
                                                    </p>
                                                </div>
                                                {isSelected && (
                                                    <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center">
                                                        <IconCheck size={14} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Cash Input with Numpad & Quick Presets */}
                        {paymentMethod === "cash" && (
                            <div className="space-y-3">
                                {/* Cash summary & Change box */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                                            Uang Diterima
                                        </span>
                                        <span className="font-black text-base text-slate-900 dark:text-white font-mono">
                                            {formatPrice(cash)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-700 text-xs">
                                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                                            Kembalian
                                        </span>
                                        <span
                                            className={`font-black text-base font-mono ${
                                                isCashSufficient
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-rose-500 dark:text-rose-400"
                                            }`}
                                        >
                                            {isCashSufficient
                                                ? formatPrice(change)
                                                : `Kurang ${formatPrice(payable - cash)}`}
                                        </span>
                                    </div>
                                </div>

                                {/* Integrated Mobile Numpad */}
                                <MobileNumpad
                                    value={cashInput}
                                    onChange={onCashInputChange}
                                    targetAmount={payable}
                                    showShortcuts={true}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </MobileBottomSheet>
    );
}
