import React from "react";
import {
    IconX,
    IconCheck,
    IconTruckDelivery,
    IconBuildingStore,
    IconMapPin,
    IconSearch,
    IconScale,
    IconBuildingBank,
    IconCopy,
    IconUpload,
    IconCamera,
    IconBrandWhatsapp,
    IconArrowRight,
    IconTicket,
    IconTag,
    IconAlertCircle,
    IconFileText,
} from "@tabler/icons-react";
import { formatRupiah } from "@/Utils/whatsappOrder";

export default function CatalogCheckoutDrawer({
    isOpen = false,
    onClose = () => { },
    // Customer
    customerName = "",
    setCustomerName = () => { },
    customerPhone = "",
    setCustomerPhone = () => { },
    deliveryAddress = "",
    setDeliveryAddress = () => { },
    rememberCustomer = true,
    onToggleRemember = () => { },
    isAutoFilled = false,
    onResetCustomerInfo = () => { },
    orderNotes = "",
    setOrderNotes = () => { },
    // Delivery Method
    isDeliveryAllowed = true,
    isPickupAllowed = true,
    deliveryMethod = "delivery",
    setDeliveryMethod = () => { },
    // RajaOngkir
    isRajaongkirActive = false,
    destinationQuery = "",
    setDestinationQuery = () => { },
    destinationResults = [],
    selectedDestination = null,
    isSearchingDestination = false,
    showDestinationDropdown = false,
    setShowDestinationDropdown = () => { },
    onSelectDestination = () => { },
    onClearDestination = () => { },
    shippingRates = [],
    selectedShippingRate = null,
    setSelectedShippingRate = () => { },
    isCalculatingShipping = false,
    shippingWeight = 0,
    shippingCalculationError = null,
    onRetryShipping = () => { },
    // Bank Payment
    bankAccounts = [],
    selectedBankId = null,
    setSelectedBankId = () => { },
    paymentProofFile = null,
    paymentProofPreview = null,
    paymentProofError = null,
    onFileChange = () => { },
    onRemoveProof = () => { },
    copiedRekening = null,
    onCopyRekening = () => { },
    copiedTotal = false,
    onCopyTotal = () => { },
    // Coupon
    couponInput = "",
    setCouponInput = () => { },
    appliedCoupon = null,
    discountAmount = 0,
    isCheckingCoupon = false,
    couponError = null,
    setCouponError = () => { },
    onApplyCoupon = () => { },
    onRemoveCoupon = () => { },
    availableCoupons = [],
    // Totals
    cartTotal = 0,
    shippingCost = 0,
    grandTotal = 0,
    // Actions
    submittingOrder = false,
    onSubmitOrder = () => { },
    onOrderWhatsApp = () => { },
    isStoreOpen = true,
}) {
    const selectedBank = bankAccounts.find((b) => b.id === selectedBankId) || bankAccounts[0] || null;
    const isOrderingAllowed = isStoreOpen && (isDeliveryAllowed || isPickupAllowed);

    return (
        <div className={`fixed inset-0 z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"
                    }`}
                onClick={onClose}
            />

            {/* Slide-over Panel from Right */}
            <div
                className={`fixed inset-y-0 right-0 max-w-lg w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-in-out border-l border-karima-brand/10 dark:border-stone-800 ${isOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-karima-brand/10 dark:border-stone-800 flex items-center justify-between">
                    <div>
                        <h2 className="font-serif text-2xl text-karima-brand dark:text-stone-100 font-medium tracking-tight">
                            Informasi Pemesanan
                        </h2>
                        <p className="text-xxs uppercase tracking-[0.25em] text-karima-accent dark:text-stone-400 font-medium mt-0.5">
                            Lengkapi data pengiriman & pembayaran
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-karima-ink/40 hover:text-karima-brand dark:hover:text-white transition-colors cursor-pointer"
                    >
                        <IconX size={22} />
                    </button>
                </div>

                {/* Body Form */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-left">
                    {/* Data Pemesan */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-serif text-base text-karima-brand dark:text-stone-100 font-medium">
                                Data Kontak Pemesan
                            </h3>
                            {isAutoFilled && customerName && (
                                <button
                                    type="button"
                                    onClick={onResetCustomerInfo}
                                    className="text-xxs uppercase tracking-wider text-stone-400 hover:text-rose-600 underline"
                                >
                                    Reset
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="block text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400 mb-1">
                                Nama Lengkap <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={customerName}
                                maxLength={100}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Nama Anda"
                                className="w-full px-3.5 py-2 text-xs font-sans rounded border border-karima-brand/20 dark:border-stone-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-none focus:border-karima-brand"
                            />
                        </div>

                        <div>
                            <label className="block text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400 mb-1">
                                Nomor WhatsApp / HP <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="tel"
                                value={customerPhone}
                                maxLength={25}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                placeholder="0812xxxxxxxx"
                                className="w-full px-3.5 py-2 text-xs font-sans rounded border border-karima-brand/20 dark:border-stone-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-none focus:border-karima-brand"
                            />
                        </div>

                        <div className="pt-1">
                            <label className="flex items-center gap-2 cursor-pointer text-xxs uppercase tracking-wider text-karima-ink/60 dark:text-stone-400">
                                <input
                                    type="checkbox"
                                    checked={rememberCustomer}
                                    onChange={(e) => onToggleRemember(e.target.checked)}
                                    className="rounded border-karima-brand/30 text-karima-brand focus:ring-karima-brand"
                                />
                                <span>Simpan data pemesan untuk pesanan berikutnya</span>
                            </label>
                        </div>
                    </div>

                    {/* Metode Pengambilan */}
                    <div className="space-y-3 pt-4 border-t border-karima-brand/10 dark:border-stone-800">
                        <h3 className="font-serif text-base text-karima-brand dark:text-stone-100 font-medium">
                            Metode Pengiriman
                        </h3>
                        <div className="grid grid-cols-2 gap-2.5">
                            {/* Option 1: Kirim ke Alamat */}
                            {isDeliveryAllowed ? (
                                <button
                                    type="button"
                                    onClick={() => setDeliveryMethod("delivery")}
                                    className={`py-3 px-3 rounded border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${deliveryMethod === "delivery"
                                            ? "border-karima-brand bg-karima-base/40 text-karima-brand font-bold shadow-2xs ring-1 ring-karima-brand/20"
                                            : "border-stone-200 dark:border-stone-800 hover:border-karima-brand/40 text-karima-ink/70 dark:text-stone-400"
                                        }`}
                                >
                                    <IconTruckDelivery size={17} />
                                    <span>Kirim ke Alamat</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    title="Layanan pengiriman ke alamat dinonaktifkan di profil toko"
                                    className="py-3 px-2 rounded border border-dashed border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-slate-800/40 text-stone-400 dark:text-stone-500 text-xs font-medium flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed select-none"
                                >
                                    <IconTruckDelivery size={17} className="opacity-50" />
                                    <span className="truncate">Kirim ke Alamat</span>
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-stone-200/80 dark:bg-stone-700 text-stone-500 dark:text-stone-400 shrink-0 font-normal">
                                        Off
                                    </span>
                                </button>
                            )}

                            {/* Option 2: Ambil di Toko */}
                            {isPickupAllowed ? (
                                <button
                                    type="button"
                                    onClick={() => setDeliveryMethod("pickup")}
                                    className={`py-3 px-3 rounded border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${deliveryMethod === "pickup"
                                            ? "border-karima-brand bg-karima-base/40 text-karima-brand font-bold shadow-2xs ring-1 ring-karima-brand/20"
                                            : "border-stone-200 dark:border-stone-800 hover:border-karima-brand/40 text-karima-ink/70 dark:text-stone-400"
                                        }`}
                                >
                                    <IconBuildingStore size={17} />
                                    <span>Ambil di Toko</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    title="Layanan ambil di toko dinonaktifkan di profil toko"
                                    className="py-3 px-2 rounded border border-dashed border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-slate-800/40 text-stone-400 dark:text-stone-500 text-xs font-medium flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed select-none"
                                >
                                    <IconBuildingStore size={17} className="opacity-50" />
                                    <span className="truncate">Ambil di Toko</span>
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-stone-200/80 dark:bg-stone-700 text-stone-500 dark:text-stone-400 shrink-0 font-normal">
                                        Off
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Status notification alerts based on store profile settings */}
                        {!isDeliveryAllowed && !isPickupAllowed && (
                            <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                                <IconAlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                                <div>
                                    <strong>Layanan Pemesanan Nonaktif:</strong> Toko sedang tidak melayani pengiriman maupun ambil di toko saat ini.
                                </div>
                            </div>
                        )}

                        {/* RajaOngkir Destination & Courier */}
                        {isDeliveryAllowed && deliveryMethod === "delivery" && (
                            <div className="space-y-3 pt-2">
                                {isRajaongkirActive && (
                                    <>
                                        <div>
                                            <label className="block text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400 mb-1">
                                                Kecamatan / Kota Tujuan <span className="text-rose-500">*</span>
                                            </label>
                                            {selectedDestination ? (
                                                <div className="flex items-center justify-between p-2.5 rounded bg-karima-base/30 dark:bg-slate-800 border border-karima-brand/20 dark:border-stone-700 text-xs">
                                                    <div className="flex items-start gap-2 min-w-0 pr-2">
                                                        <IconMapPin size={16} className="text-karima-brand shrink-0 mt-0.5" />
                                                        <span className="font-medium text-karima-brand dark:text-stone-200">
                                                            {selectedDestination.label}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={onClearDestination}
                                                        className="text-stone-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                                        title="Ganti tujuan"
                                                    >
                                                        <IconX size={15} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={destinationQuery}
                                                        onChange={(e) => {
                                                            setDestinationQuery(e.target.value);
                                                            setShowDestinationDropdown(true);
                                                        }}
                                                        onFocus={() => setShowDestinationDropdown(true)}
                                                        placeholder="Cari kecamatan atau kota (min. 3 huruf)..."
                                                        className="w-full pl-8 pr-7 py-2 text-xs rounded border border-karima-brand/20 dark:border-stone-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-none focus:border-karima-brand"
                                                    />
                                                    <IconSearch
                                                        size={14}
                                                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
                                                    />
                                                    {isSearchingDestination && (
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-karima-brand border-t-transparent rounded-full animate-spin" />
                                                    )}

                                                    {showDestinationDropdown && destinationResults.length > 0 && (
                                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-stone-200 dark:border-stone-700 rounded shadow-xl max-h-48 overflow-y-auto z-30 divide-y divide-stone-100 dark:divide-stone-800">
                                                            {destinationResults.map((dest) => (
                                                                <button
                                                                    key={dest.id}
                                                                    type="button"
                                                                    onClick={() => onSelectDestination(dest)}
                                                                    className="w-full text-left p-2.5 hover:bg-stone-50 dark:hover:bg-slate-800 text-xs text-stone-800 dark:text-stone-200 flex items-start gap-2 cursor-pointer"
                                                                >
                                                                    <IconMapPin size={14} className="text-stone-400 shrink-0 mt-0.5" />
                                                                    <span>{dest.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Courier Rates */}
                                        {selectedDestination && (
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label className="text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400">
                                                        Pilih Layanan Kurir <span className="text-rose-500">*</span>
                                                    </label>
                                                    {shippingWeight > 0 && (
                                                        <span className="text-xxs text-stone-400 flex items-center gap-1">
                                                            <IconScale size={11} />
                                                            <span>{(shippingWeight / 1000).toFixed(2)} kg</span>
                                                        </span>
                                                    )}
                                                </div>

                                                {isCalculatingShipping ? (
                                                    <div className="p-3 rounded bg-stone-50 dark:bg-slate-800 text-xs text-stone-500 flex items-center justify-center gap-2">
                                                        <div className="w-3.5 h-3.5 border-2 border-karima-brand border-t-transparent rounded-full animate-spin" />
                                                        <span>Menghitung ongkir...</span>
                                                    </div>
                                                ) : shippingCalculationError ? (
                                                    <div className="p-2.5 rounded bg-rose-50 text-rose-700 text-xs">
                                                        <p>{shippingCalculationError}</p>
                                                        <button
                                                            type="button"
                                                            onClick={onRetryShipping}
                                                            className="mt-1 underline font-semibold text-xxs"
                                                        >
                                                            Hitung Ulang
                                                        </button>
                                                    </div>
                                                ) : shippingRates.length > 0 ? (
                                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                        {shippingRates.map((rate, idx) => {
                                                            const isSelected =
                                                                selectedShippingRate?.courier_code === rate.courier_code &&
                                                                selectedShippingRate?.service === rate.service;
                                                            return (
                                                                <div
                                                                    key={`${rate.courier_code}_${rate.service}_${idx}`}
                                                                    onClick={() => setSelectedShippingRate(rate)}
                                                                    className={`p-2.5 rounded border text-xs cursor-pointer flex items-center justify-between gap-2 transition-all ${isSelected
                                                                            ? "border-karima-brand bg-karima-base/30 text-karima-brand font-medium shadow-2xs"
                                                                            : "border-stone-200 dark:border-stone-800 hover:border-karima-brand/30"
                                                                        }`}
                                                                >
                                                                    <div>
                                                                        <div className="font-bold uppercase tracking-wider">
                                                                            {rate.courier_code} - {rate.service}
                                                                        </div>
                                                                        <div className="text-[10px] text-stone-400">
                                                                            {rate.etd ? `Estimasi ${rate.etd} hari` : rate.description}
                                                                        </div>
                                                                    </div>
                                                                    <div className="font-serif font-bold text-sm">
                                                                        {formatRupiah(rate.cost)}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="p-2.5 rounded bg-stone-50 text-stone-400 text-xs text-center">
                                                        Opsi kurir tidak ditemukan untuk wilayah ini.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div>
                                    <label className="block text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400 mb-1">
                                        Alamat Lengkap (Jalan, No. Rumah, RT/RW) <span className="text-rose-500">*</span>
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                        placeholder="Nama jalan, nomor rumah, patokan..."
                                        className="w-full px-3.5 py-2 text-xs font-sans rounded border border-karima-brand/20 dark:border-stone-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-none focus:border-karima-brand"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400 mb-1">
                                Catatan Pesanan (Opsional)
                            </label>
                            <input
                                type="text"
                                value={orderNotes}
                                onChange={(e) => setOrderNotes(e.target.value)}
                                placeholder="Contoh: Tolong bungkus pita ya kak"
                                className="w-full px-3.5 py-2 text-xs font-sans rounded border border-karima-brand/20 dark:border-stone-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-none focus:border-karima-brand"
                            />
                        </div>
                    </div>

                    {/* Kupon Diskon */}
                    <div className="space-y-3 pt-4 border-t border-karima-brand/10 dark:border-stone-800">
                        <div className="flex items-center justify-between">
                            <h3 className="font-serif text-base text-karima-brand dark:text-stone-100 font-medium flex items-center gap-2">
                                <IconTicket size={18} className="text-karima-brand dark:text-karima-accent" />
                                <span>Kupon Diskon</span>
                            </h3>
                            {appliedCoupon && (
                                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                    <IconCheck size={12} />
                                    <span>Terpasang</span>
                                </span>
                            )}
                        </div>

                        {appliedCoupon ? (
                            /* Applied Coupon Active Card */
                            <div className="p-3.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 transition-all">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <div className="p-1.5 rounded-md bg-emerald-600 text-white shrink-0 mt-0.5">
                                        <IconTag size={15} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                                                {appliedCoupon.code}
                                            </span>
                                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                Hemat {formatRupiah(discountAmount)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-1 truncate">
                                            {appliedCoupon.name}
                                            {appliedCoupon.minimum_order > 0 && ` · Min. belanja ${formatRupiah(appliedCoupon.minimum_order)}`}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={onRemoveCoupon}
                                    className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                                    title="Hapus kupon"
                                >
                                    <IconX size={16} />
                                </button>
                            </div>
                        ) : (
                            /* Coupon Input Box */
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={couponInput}
                                            onChange={(e) => {
                                                setCouponInput(e.target.value.toUpperCase());
                                                if (couponError) setCouponError(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    onApplyCoupon(couponInput);
                                                }
                                            }}
                                            placeholder="Masukkan kode kupon..."
                                            disabled={isCheckingCoupon}
                                            className="w-full pl-8 pr-3 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded border border-karima-brand/20 dark:border-stone-700 bg-stone-50/50 dark:bg-slate-800 text-karima-brand dark:text-white placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-karima-brand"
                                        />
                                        <IconTicket
                                            size={15}
                                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onApplyCoupon(couponInput)}
                                        disabled={isCheckingCoupon || !couponInput.trim()}
                                        className={`px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 ${isCheckingCoupon || !couponInput.trim()
                                                ? "bg-stone-200 dark:bg-slate-800 text-stone-400 cursor-not-allowed"
                                                : "bg-karima-brand hover:bg-karima-accent text-white cursor-pointer active:scale-98 shadow-2xs"
                                            }`}
                                    >
                                        {isCheckingCoupon ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                <span>Cek...</span>
                                            </>
                                        ) : (
                                            <span>Terapkan</span>
                                        )}
                                    </button>
                                </div>

                                {couponError && (
                                    <p className="text-rose-600 dark:text-rose-400 text-xxs flex items-center gap-1">
                                        <IconAlertCircle size={13} className="shrink-0" />
                                        <span>{couponError}</span>
                                    </p>
                                )}

                                {/* Available public coupons pills */}
                                {availableCoupons && availableCoupons.length > 0 && (
                                    <div className="pt-1">
                                        <div className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1.5">
                                            Kupon Promo Tersedia:
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {availableCoupons.map((coupon) => (
                                                <button
                                                    key={coupon.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setCouponInput(coupon.code);
                                                        onApplyCoupon(coupon.code);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-100 dark:bg-slate-800 hover:bg-karima-base/40 dark:hover:bg-slate-700 border border-dashed border-stone-300 dark:border-stone-700 text-xxs font-mono font-bold text-karima-brand dark:text-stone-300 transition-all cursor-pointer group"
                                                    title={coupon.name}
                                                >
                                                    <IconTag size={11} className="text-karima-accent" />
                                                    <span>{coupon.code}</span>
                                                    <span className="font-sans font-normal text-stone-400 text-[10px] ml-0.5">
                                                        {coupon.discount_type === "percentage"
                                                            ? `(${coupon.discount_value}%)`
                                                            : `(-${formatRupiah(coupon.discount_value)})`}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Pembayaran Transfer Bank & Bukti Transfer */}
                    <div className="space-y-3 pt-4 border-t border-karima-brand/10 dark:border-stone-800">
                        <div className="flex items-center justify-between">
                            <h3 className="font-serif text-base text-karima-brand dark:text-stone-100 font-medium flex items-center gap-2">
                                <IconBuildingBank size={18} />
                                <span>Pembayaran Transfer Bank</span>
                            </h3>
                            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-karima-base text-karima-brand">
                                Rekening Toko
                            </span>
                        </div>

                        {bankAccounts.length > 0 && (
                            <div className="p-3.5 rounded-lg bg-karima-base/30 dark:bg-slate-800 border border-karima-brand/15 dark:border-stone-700 space-y-3">
                                {bankAccounts.length > 1 && (
                                    <div className="flex flex-wrap gap-2">
                                        {bankAccounts.map((b) => (
                                            <button
                                                key={b.id}
                                                type="button"
                                                onClick={() => setSelectedBankId(b.id)}
                                                className={`px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider border transition-all ${selectedBankId === b.id
                                                        ? "border-karima-brand bg-karima-brand text-white shadow-2xs"
                                                        : "border-stone-200 dark:border-stone-700 bg-white dark:bg-slate-900"
                                                    }`}
                                            >
                                                {b.bank_name}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selectedBank && (
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-stone-500 uppercase tracking-wider text-[10px]">Bank:</span>
                                            <span className="font-bold text-karima-brand dark:text-stone-100">
                                                {selectedBank.bank_name}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-stone-500 uppercase tracking-wider text-[10px]">No. Rekening:</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-sm text-karima-brand dark:text-white">
                                                    {selectedBank.account_number}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => onCopyRekening(selectedBank.account_number)}
                                                    className="p-1 hover:text-karima-brand text-stone-400 cursor-pointer"
                                                    title="Salin No. Rekening"
                                                >
                                                    {copiedRekening === selectedBank.account_number ? (
                                                        <IconCheck size={14} className="text-emerald-600" />
                                                    ) : (
                                                        <IconCopy size={14} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-stone-500 uppercase tracking-wider text-[10px]">Atas Nama:</span>
                                            <span className="font-medium text-stone-800 dark:text-stone-200">
                                                {selectedBank.account_holder}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Upload Bukti Pembayaran */}
                        <div>
                            <label className="block text-xxs uppercase tracking-wider font-semibold text-karima-ink/60 dark:text-stone-400 mb-1.5 flex items-center justify-between">
                                <span>Unggah Bukti Transfer</span>
                                <span className="text-rose-500 font-normal normal-case text-[10px]">
                                    Format: JPG, PNG, WEBP, PDF (Maks 5MB)
                                </span>
                            </label>

                            {paymentProofPreview ? (
                                <div className="relative w-full aspect-[16/9] rounded border border-karima-brand/20 overflow-hidden bg-stone-100 dark:bg-slate-800 flex items-center justify-center p-2">
                                    {typeof paymentProofPreview === "object" && paymentProofPreview?.isPdf ? (
                                        <div className="flex flex-col items-center justify-center gap-1.5 text-center p-3">
                                            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                                                <IconFileText size={28} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-white max-w-[200px] truncate">
                                                {paymentProofPreview.name || "Dokumen Bukti Transfer.pdf"}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                Dokumen PDF Terpilih
                                            </span>
                                        </div>
                                    ) : (
                                        <img
                                            src={typeof paymentProofPreview === "string" ? paymentProofPreview : paymentProofPreview?.url}
                                            alt="Bukti Transfer"
                                            className="w-full h-full object-contain"
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={onRemoveProof}
                                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors"
                                    >
                                        <IconX size={15} />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center p-5 rounded border-2 border-dashed border-karima-brand/20 dark:border-stone-700 hover:border-karima-brand/50 bg-stone-50/50 dark:bg-slate-800/50 cursor-pointer transition-colors group">
                                    <IconCamera size={26} className="text-stone-400 group-hover:text-karima-brand mb-1.5" />
                                    <span className="text-xs font-semibold text-karima-brand dark:text-stone-200 uppercase tracking-wider">
                                        Klik untuk Unggah Foto / PDF Bukti
                                    </span>
                                    <span className="text-[10px] text-stone-400 mt-0.5">
                                        Screenshot m-Banking / Struk ATM / Dokumen PDF
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,application/pdf"
                                        onChange={onFileChange}
                                        className="hidden"
                                    />
                                </label>
                            )}
                            {paymentProofError && (
                                <p className="text-rose-600 text-xxs mt-1">{paymentProofError}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer / Summary & Actions */}
                <div className="p-5 sm:p-6 border-t border-karima-brand/10 dark:border-stone-800 bg-karima-base/20 dark:bg-slate-950/60 space-y-3">
                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-stone-600 dark:text-stone-400">
                            <span>Subtotal Produk</span>
                            <span>{formatRupiah(cartTotal)}</span>
                        </div>
                        {discountAmount > 0 && (
                            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                <span className="flex items-center gap-1">
                                    <IconTicket size={14} />
                                    <span>Diskon Kupon {appliedCoupon?.code ? `(${appliedCoupon.code})` : ""}</span>
                                </span>
                                <span className="font-semibold">-{formatRupiah(discountAmount)}</span>
                            </div>
                        )}
                        {deliveryMethod === "delivery" && isRajaongkirActive && (
                            <div className="flex justify-between text-stone-600 dark:text-stone-400">
                                <span>Ongkos Kirim</span>
                                <span>{shippingCost > 0 ? formatRupiah(shippingCost) : "Gratis / Dihitung"}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm sm:text-base font-bold text-karima-brand dark:text-stone-100 pt-2 border-t border-karima-brand/10 dark:border-stone-800">
                            <span className="font-serif">Total Tagihan</span>
                            <div className="flex items-center gap-1.5">
                                <span className="font-serif text-lg">{formatRupiah(grandTotal)}</span>
                                <button
                                    type="button"
                                    onClick={() => onCopyTotal(grandTotal)}
                                    className="p-1 text-stone-400 hover:text-karima-brand"
                                    title="Salin nominal total"
                                >
                                    {copiedTotal ? (
                                        <IconCheck size={14} className="text-emerald-600" />
                                    ) : (
                                        <IconCopy size={14} />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Actions: Primary Confirm + WhatsApp Order */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        {/* WhatsApp Fallback Order */}
                        <button
                            type="button"
                            disabled={!isOrderingAllowed}
                            onClick={onOrderWhatsApp}
                            className={`w-full sm:w-1/3 py-3 px-3 rounded border text-xxs uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5 transition-all ${!isOrderingAllowed
                                    ? "border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed"
                                    : "border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                                }`}
                        >
                            <IconBrandWhatsapp size={16} />
                            <span>Kirim WA</span>
                        </button>

                        {/* Direct Submit Online */}
                        <button
                            type="button"
                            disabled={submittingOrder || !isOrderingAllowed}
                            onClick={onSubmitOrder}
                            className={`flex-1 py-3 px-6 rounded flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-xs font-semibold shadow-xs transition-all ${submittingOrder || !isOrderingAllowed
                                    ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                                    : "bg-karima-brand hover:bg-karima-accent text-white cursor-pointer active:scale-[0.99]"
                                }`}
                        >
                            {submittingOrder ? (
                                <span>Memproses Pesanan...</span>
                            ) : (
                                <>
                                    <span>Konfirmasi Pesanan</span>
                                    <IconArrowRight size={15} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

