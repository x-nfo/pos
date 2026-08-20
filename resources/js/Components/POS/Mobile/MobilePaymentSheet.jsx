import React from "react";
import {
    IconX,
    IconCash,
    IconBuildingBank,
    IconCreditCard,
    IconClock,
    IconCheck,
    IconBackspace,
} from "@tabler/icons-react";

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
    if (!isOpen) return null;

    const cash = Number(cashInput || 0);
    const change = Math.max(0, cash - payable);
    const isCashSufficient = cash >= payable;

    const paymentOptions = [
        { value: "cash", label: "Tunai", icon: IconCash },
        { value: "bank_transfer", label: "Transfer", icon: IconBuildingBank },
        { value: "gateway", label: "QRIS / EDC", icon: IconCreditCard },
    ];

    const quickAmounts = [10000, 20000, 50000, 100000, 200000];

    const handleKeypadPress = (key) => {
        if (key === "CLEAR") {
            onCashInputChange("");
            return;
        }
        if (key === "BACKSPACE") {
            onCashInputChange((prev) => (prev.length > 1 ? prev.slice(0, -1) : ""));
            return;
        }
        if (key === "EXACT") {
            onCashInputChange(String(payable));
            return;
        }
        onCashInputChange((prev) => {
            const next = `${prev}${key}`.replace(/^0+(?=\d)/, "");
            return next;
        });
    };

    const isReadyToSubmit =
        !isSubmitting &&
        !isLoadingPricing &&
        (payLater ? !!selectedCustomer?.id : paymentMethod === "cash" ? isCashSufficient : true);

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            {/* Modal Sheet Container */}
            <div className="relative w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 flex flex-col max-h-[90dvh] safe-bottom select-none">
                {/* Header */}
                <div className="p-3.5 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Total Tagihan
                        </span>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                            {formatPrice(payable)}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center active:scale-90"
                    >
                        <IconX size={16} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                    {/* Pay Later Toggle */}
                    <div className="flex items-center justify-between p-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                        <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                <IconClock size={15} className="text-amber-500" />
                                Bayar Nanti (Piutang)
                            </p>
                            <p className="text-[10px] text-slate-500">
                                Catat sebagai piutang pelanggan
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={payLater}
                            onChange={(e) => {
                                onPayLaterChange(e.target.checked);
                                if (e.target.checked) {
                                    onPaymentMethodChange("cash");
                                }
                            }}
                            className="w-4.5 h-4.5 rounded text-primary-600 focus:ring-primary-500"
                        />
                    </div>

                    {payLater ? (
                        <div className="space-y-2.5">
                            {!selectedCustomer?.id && (
                                <p className="text-xs text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                                    ⚠️ Wajib memilih pelanggan terdaftar untuk opsi piutang.
                                </p>
                            )}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                    Jatuh Tempo
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => onDueDateChange(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Payment Methods */}
                            <div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {paymentOptions.map((opt) => {
                                        const Icon = opt.icon;
                                        const isActive = paymentMethod === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => onPaymentMethodChange(opt.value)}
                                                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all active:scale-95 ${
                                                    isActive
                                                        ? "border-primary-600 bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-bold shadow-xs"
                                                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                                                }`}
                                            >
                                                <Icon size={18} />
                                                <span className="text-[11px]">
                                                    {opt.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Bank Selection */}
                            {paymentMethod === "bank_transfer" && (
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase">
                                        Pilih Rekening
                                    </label>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {bankAccounts.map((bank) => {
                                            const isSelected = selectedBankAccount?.id === bank.id;
                                            return (
                                                <button
                                                    key={bank.id}
                                                    type="button"
                                                    onClick={() => onSelectBankAccount(bank)}
                                                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between active:scale-[0.98] ${
                                                        isSelected
                                                            ? "border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300"
                                                            : "border-slate-200 dark:border-slate-800"
                                                    }`}
                                                >
                                                    <div>
                                                        <p className="text-xs font-bold">{bank.bank_name}</p>
                                                        <p className="text-[11px] font-mono text-slate-500">{bank.account_number} ({bank.account_name})</p>
                                                    </div>
                                                    {isSelected && <IconCheck size={16} className="text-primary-600 font-bold" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Cash Input & Numpad */}
                            {paymentMethod === "cash" && (
                                <div className="space-y-2.5">
                                    {/* Display Cash & Change */}
                                    <div className="p-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-500">
                                                Uang Diterima:
                                            </span>
                                            <span className="font-black text-sm text-slate-900 dark:text-white">
                                                {formatPrice(cash)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700 text-xs">
                                            <span className="font-bold text-slate-500">
                                                Kembalian:
                                            </span>
                                            <span
                                                className={`font-black text-sm ${
                                                    isCashSufficient
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-rose-500"
                                                }`}
                                            >
                                                {isCashSufficient
                                                    ? formatPrice(change)
                                                    : `Kurang ${formatPrice(payable - cash)}`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Quick Amount Chips */}
                                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-0.5">
                                        <button
                                            type="button"
                                            onClick={() => handleKeypadPress("EXACT")}
                                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap bg-primary-600 text-white shadow-xs active:scale-95"
                                        >
                                            Uang Pas
                                        </button>
                                        {quickAmounts.map((amt) => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => onCashInputChange(String(amt))}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap active:scale-95 transition-all ${
                                                    cash === amt
                                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                                                }`}
                                            >
                                                {formatPrice(amt)}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Integrated Keypad */}
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "BACKSPACE"].map(
                                            (k) => (
                                                <button
                                                    key={k}
                                                    type="button"
                                                    onClick={() => handleKeypadPress(k)}
                                                    className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-90 transition-transform flex items-center justify-center shadow-xs"
                                                >
                                                    {k === "BACKSPACE" ? <IconBackspace size={18} /> : k}
                                                </button>
                                            )
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleKeypadPress("CLEAR")}
                                            className="col-span-3 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs active:scale-95"
                                        >
                                            Hapus / Reset
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Confirm Action Button */}
                <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={!isReadyToSubmit}
                        className={`w-full h-12 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] ${
                            isReadyToSubmit
                                ? "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        }`}
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <IconCheck size={18} strokeWidth={3} />
                                <span>Selesaikan Transaksi</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
