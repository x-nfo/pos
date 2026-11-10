import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const resolveCouponCheckUrl = () => {
    try {
        if (typeof route === "function" && route().has("catalog.coupon.check")) {
            return route("catalog.coupon.check");
        }
    } catch (_) { }
    return "/katalog/coupon/check";
};

export function useCoupon(initialSubtotal = 0) {
    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
    const [couponError, setCouponError] = useState(null);
    const [couponSuccess, setCouponSuccess] = useState(null);

    const calculateLocalDiscount = useCallback((voucher, subtotal) => {
        if (!voucher || subtotal <= 0) return 0;
        if (voucher.minimum_order > 0 && subtotal < voucher.minimum_order) {
            return 0;
        }

        let discount = 0;
        if (voucher.discount_type === "percentage") {
            const pct = Number(voucher.discount_value) || 0;
            discount = Math.round((subtotal * pct) / 100);
            if (voucher.max_discount && voucher.max_discount > 0) {
                discount = Math.min(discount, Number(voucher.max_discount));
            }
        } else {
            discount = Math.round(Number(voucher.discount_value) || 0);
        }

        return Math.min(subtotal, Math.max(0, discount));
    }, []);

    const applyCoupon = useCallback(
        async (rawCode, currentSubtotal, customerPhone = "", customerName = "") => {
            const code = String(rawCode || couponInput || "").trim().toUpperCase();

            if (!code) {
                setCouponError("Silakan masukkan kode kupon terlebih dahulu.");
                toast.error("Silakan masukkan kode kupon terlebih dahulu.");
                return false;
            }

            if (currentSubtotal <= 0) {
                setCouponError("Keranjang belanja masih kosong.");
                toast.error("Keranjang belanja masih kosong.");
                return false;
            }

            setIsCheckingCoupon(true);
            setCouponError(null);
            setCouponSuccess(null);

            try {
                const res = await axios.post(resolveCouponCheckUrl(), {
                    code,
                    subtotal: currentSubtotal,
                    customer_phone: customerPhone ? String(customerPhone).trim() : null,
                    customer_name: customerName ? String(customerName).trim() : null,
                });

                if (res.data?.valid && res.data?.voucher) {
                    const voucher = res.data.voucher;
                    const calculatedDiscount = Number(res.data.discount_amount) || calculateLocalDiscount(voucher, currentSubtotal);

                    setAppliedCoupon(voucher);
                    setDiscountAmount(calculatedDiscount);
                    setCouponInput(voucher.code);
                    const successMsg = res.data.message || `Kupon ${voucher.code} berhasil diterapkan!`;
                    setCouponSuccess(successMsg);
                    toast.success(successMsg);
                    return true;
                } else {
                    const msg = res.data?.message || "Kupon tidak valid.";
                    setCouponError(msg);
                    toast.error(msg);
                    return false;
                }
            } catch (err) {
                const errorMsg =
                    err.response?.data?.message ||
                    err.response?.data?.errors?.code?.[0] ||
                    err.response?.data?.errors?.subtotal?.[0] ||
                    "Gagal memeriksa kupon diskon.";
                setCouponError(errorMsg);
                toast.error(errorMsg);
                return false;
            } finally {
                setIsCheckingCoupon(false);
            }
        },
        [couponInput, calculateLocalDiscount]
    );

    const removeCoupon = useCallback((silent = false) => {
        setAppliedCoupon(null);
        setDiscountAmount(0);
        setCouponInput("");
        setCouponError(null);
        setCouponSuccess(null);
        if (!silent) {
            toast.success("Kupon berhasil dihapus.");
        }
    }, []);

    // Revalidate coupon when subtotal changes
    const revalidateWithSubtotal = useCallback(
        (newSubtotal) => {
            if (!appliedCoupon) return;

            if (newSubtotal <= 0) {
                removeCoupon(true);
                return;
            }

            if (appliedCoupon.minimum_order > 0 && newSubtotal < appliedCoupon.minimum_order) {
                const minFormatted = Number(appliedCoupon.minimum_order).toLocaleString("id-ID");
                toast.error(`Kupon ${appliedCoupon.code} dilepas karena subtotal kurang dari minimal belanja Rp ${minFormatted}`);
                removeCoupon(true);
                setCouponError(`Minimal belanja untuk kupon ${appliedCoupon.code} adalah Rp ${minFormatted}`);
                return;
            }

            const updatedDiscount = calculateLocalDiscount(appliedCoupon, newSubtotal);
            setDiscountAmount(updatedDiscount);
        },
        [appliedCoupon, calculateLocalDiscount, removeCoupon]
    );

    return {
        couponInput,
        setCouponInput,
        appliedCoupon,
        discountAmount,
        isCheckingCoupon,
        couponError,
        setCouponError,
        couponSuccess,
        applyCoupon,
        removeCoupon,
        revalidateWithSubtotal,
    };
}

