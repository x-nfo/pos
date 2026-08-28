import React, {
    useEffect,
    useMemo,
    useState,
    useCallback,
    useRef,
} from "react";
import { Head, router, usePage } from "@inertiajs/react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import MobileHeader from "@/Components/POS/Mobile/MobileHeader";
import MobileProductGrid from "@/Components/POS/Mobile/MobileProductGrid";
import MobileFloatingCartBar from "@/Components/POS/Mobile/MobileFloatingCartBar";
import MobileCartSheet from "@/Components/POS/Mobile/MobileCartSheet";
import MobilePaymentSheet from "@/Components/POS/Mobile/MobilePaymentSheet";
import { WALK_IN_CUSTOMER } from "@/Components/POS/CustomerSelect";
import QuickAddProductModal from "@/Components/POS/QuickAddProductModal";
import OfflineReceiptModal from "@/Components/POS/OfflineReceiptModal";
import useBarcodeScanner from "@/Hooks/useBarcodeScanner";
import { useHaptic } from "@/Hooks/useHaptic";
import { useWebShare } from "@/Hooks/useWebShare";
import { useAuthorization } from "@/Utils/authorization";
import {
    queueTransaction,
    cacheProducts,
    cacheCustomers,
    cacheCategories,
    getCachedProducts,
    getCachedCustomers,
    getCachedCategories,
} from "@/Utils/offlineDb";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export default function Mobile({
    carts = [],
    carts_total = 0,
    heldCarts = [],
    customers = [],
    products = [],
    categories = [],
    initialPricingPreview = { items: [], summary: {} },
    paymentGateways = [],
    defaultPaymentGateway = "cash",
    bankAccounts = [],
    loyaltyTierOptions = [],
}) {
    const { auth, activeCashierShift, flash, errors } = usePage().props;
    const { can } = useAuthorization();
    const { triggerHaptic } = useHaptic();
    const { share: nativeShare, isSupported: isShareSupported } = useWebShare();

    useEffect(() => {
        if (flash?.error) {
            triggerHaptic("error");
            toast.error(flash.error);
        }
        if (flash?.success) {
            triggerHaptic("success");
            toast.success(flash.success);
        }
    }, [flash]);

    useEffect(() => {
        if (errors && Object.keys(errors).length > 0) {
            Object.values(errors).forEach((err) => {
                if (typeof err === "string") toast.error(err);
            });
        }
    }, [errors]);

    // UI State: 'catalog' | 'cart'
    const [currentTab, setCurrentTab] = useState("catalog");
    const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);

    // Search & Category Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [addingProductId, setAddingProductId] = useState(null);

    // Customer & Pricing State
    const [selectedCustomer, setSelectedCustomer] = useState(WALK_IN_CUSTOMER);
    const [pricingPreview, setPricingPreview] = useState(initialPricingPreview);
    const [isLoadingPricing, setIsLoadingPricing] = useState(false);
    const [discountInput, setDiscountInput] = useState("");
    const [redeemPointsInput, setRedeemPointsInput] = useState("");
    const [cashInput, setCashInput] = useState("");
    const [shippingInput, setShippingInput] = useState("");
    const [paymentMethod, setPaymentMethod] = useState(
        defaultPaymentGateway ?? "cash"
    );
    const [selectedBankAccount, setSelectedBankAccount] = useState(null);
    const [selectedVoucherId, setSelectedVoucherId] = useState("");
    const [payLater, setPayLater] = useState(false);
    const [dueDate, setDueDate] = useState("");

    // Submit state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isHolding, setIsHolding] = useState(false);

    // Shift modal
    const [shiftModalOpen, setShiftModalOpen] = useState(false);
    const [openingCashInput, setOpeningCashInput] = useState("");
    const [shiftNotesInput, setShiftNotesInput] = useState("");

    // Local cached lists
    const [productList, setProductList] = useState(products);
    const [customerList, setCustomerList] = useState(customers);
    const [categoryList, setCategoryList] = useState(categories);
    const [activeCarts, setActiveCarts] = useState(carts);

    // Quick Add Product Modal
    const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
    const [quickAddInitialData, setQuickAddInitialData] = useState({});
    const [offlineReceiptData, setOfflineReceiptData] = useState(null);

    const searchInputRef = useRef(null);

    useEffect(() => {
        setProductList(products);
    }, [products]);

    useEffect(() => {
        setCustomerList(customers);
    }, [customers]);

    useEffect(() => {
        setCategoryList(categories);
    }, [categories]);

    useEffect(() => {
        setActiveCarts(carts);
    }, [carts]);

    // Offline cached fallbacks
    useEffect(() => {
        if (!products || products.length === 0) {
            getCachedProducts()
                .then((cached) => {
                    if (cached && cached.length > 0) {
                        setProductList(cached);
                    }
                })
                .catch(() => {});
        }
        if (!customers || customers.length === 0) {
            getCachedCustomers()
                .then((cached) => {
                    if (cached && cached.length > 0) {
                        setCustomerList(cached);
                    }
                })
                .catch(() => {});
        }
        if (!categories || categories.length === 0) {
            getCachedCategories()
                .then((cached) => {
                    if (cached && cached.length > 0) {
                        setCategoryList(cached);
                    }
                })
                .catch(() => {});
        }
    }, [products, customers, categories]);

    // Cache products, customers, and categories for offline POS capability
    useEffect(() => {
        if (products && products.length > 0) {
            cacheProducts(products).catch(() => {});
        }
        if (customers && customers.length > 0) {
            cacheCustomers(customers).catch(() => {});
        }
        if (categories && categories.length > 0) {
            cacheCategories(categories).catch(() => {});
        }
    }, [products, customers, categories]);

    const pricingItemsByCartId = useMemo(() => {
        const items = pricingPreview?.items || [];
        return items.reduce((acc, item) => {
            acc[item.cart_id] = item;
            return acc;
        }, {});
    }, [pricingPreview]);

    const cartCount = useMemo(() => {
        return activeCarts.reduce(
            (sum, item) => sum + (Number(item.qty) || 0),
            0
        );
    }, [activeCarts]);

    const localSubtotal = useMemo(() => {
        return activeCarts.reduce(
            (sum, item) => sum + Number(item.price || 0),
            0
        );
    }, [activeCarts]);

    const discount = Number(discountInput || 0);
    const shipping = Number(shippingInput || 0);
    const summary = pricingPreview?.summary || {};
    const baseSubtotal = Number(
        summary?.base_subtotal ?? summary?.subtotal ?? localSubtotal
    );
    const promoDiscount = Number(
        summary?.promo_discount ?? summary?.promo_discount_total ?? 0
    );
    const voucherDiscount = Number(
        summary?.voucher_discount ?? summary?.voucher_discount_total ?? 0
    );
    const loyaltyDiscount = Number(
        summary?.loyalty_discount ?? summary?.loyalty_discount_total ?? 0
    );
    const taxTotal = Number(summary?.tax_total ?? 0);
    const payable = Number(
        summary?.payable ??
            summary?.grand_total ??
            Math.max(
                0,
                baseSubtotal -
                    promoDiscount -
                    voucherDiscount -
                    loyaltyDiscount -
                    discount +
                    shipping +
                    taxTotal
            )
    );

    // Pricing preview calculation
    const pricingDependency = useMemo(() => {
        return activeCarts
            .map((item) => `${item.id}:${item.qty}:${item.price}`)
            .join("|");
    }, [activeCarts]);

    useEffect(() => {
        let cancelled = false;

        if (activeCarts.length === 0) {
            setPricingPreview(initialPricingPreview);
            return;
        }

        setIsLoadingPricing(true);

        axios
            .post(route("transactions.pricing-preview"), {
                customer_id: selectedCustomer?.id ?? null,
                discount,
                shipping_cost: shipping,
                redeem_points: Number(redeemPointsInput || 0),
                customer_voucher_id: selectedCustomer?.id
                    ? selectedVoucherId || null
                    : null,
            })
            .then((res) => {
                if (!cancelled && res.data) {
                    const data = res.data.data ?? res.data;
                    setPricingPreview(data);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    const localSubtotal = activeCarts.reduce(
                        (sum, i) => sum + Number(i.price || 0),
                        0
                    );
                    setPricingPreview({
                        items: activeCarts.map((item) => ({
                            cart_id: item.id,
                            line_base_total: item.price,
                            line_total: item.price,
                            effective_unit_price: Number(
                                item.unit_price ||
                                    (item.qty ? item.price / item.qty : item.product?.sell_price) ||
                                    0
                            ),
                            base_unit_price: Number(
                                item.unit_price ||
                                    (item.qty ? item.price / item.qty : item.product?.sell_price) ||
                                    0
                            ),
                        })),
                        summary: {
                            base_subtotal: localSubtotal,
                            promo_discount_total: 0,
                            subtotal_after_promo: localSubtotal,
                            voucher_discount_total: 0,
                            loyalty_discount_total: 0,
                            manual_discount_total: discount,
                            shipping_cost: shipping,
                            tax_total: 0,
                            grand_total: Math.max(
                                0,
                                localSubtotal - discount + shipping
                            ),
                            payable: Math.max(
                                0,
                                localSubtotal - discount + shipping
                            ),
                        },
                    });
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoadingPricing(false);
            });

        return () => {
            cancelled = true;
        };
    }, [
        selectedCustomer?.id,
        pricingDependency,
        discount,
        shipping,
        redeemPointsInput,
        selectedVoucherId,
        activeCarts,
    ]);

    // Handle add to cart
    const handleAddToCart = async (product, selectedUnit = null) => {
        if (!product?.id || addingProductId) return;

        const unitObj = selectedUnit || product.units?.find((u) => u.is_base) || product.units?.[0] || null;
        const targetUnitId = unitObj?.id || product.unit_id || null;
        const targetSellPrice = Number(unitObj?.sell_price || product.sell_price || 0);
        const targetConversion = Number(unitObj?.conversion_factor || 1);
        const unitLabel = unitObj?.symbol || unitObj?.code || "";

        const existingItem = activeCarts.find(
            (c) => c.product_id === product.id && (targetUnitId ? c.unit_id === targetUnitId : true)
        );
        const currentQty = existingItem ? Number(existingItem.qty || 0) : 0;
        const availableStock = Number(product.stock || 0);
        const neededBaseStock = (currentQty + 1) * targetConversion;

        if (availableStock > 0 && neededBaseStock > availableStock) {
            triggerHaptic("warning");
            toast.error(
                `Stok ${product.title} tidak mencukupi. Tersedia: ${availableStock} (dasar)`
            );
            return;
        }

        triggerHaptic("light");

        if (!navigator.onLine) {
            const existingIndex = activeCarts.findIndex(
                (c) => c.product_id === product.id && (targetUnitId ? c.unit_id === targetUnitId : true)
            );
            let updated;
            if (existingIndex > -1) {
                updated = [...activeCarts];
                const current = updated[existingIndex];
                const newQty = (current.qty || 1) + 1;
                const unitPrice = Number(
                    current.unit_price || targetSellPrice
                );
                updated[existingIndex] = {
                    ...current,
                    qty: newQty,
                    price: unitPrice * newQty,
                };
            } else {
                const unitPrice = targetSellPrice;
                const newCart = {
                    id: "local-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
                    cart_id: "local-" + Date.now(),
                    product_id: product.id,
                    product: product,
                    qty: 1,
                    unit_id: targetUnitId,
                    unit: unitObj ? { id: unitObj.id, code: unitObj.code, name: unitObj.name, symbol: unitObj.symbol } : null,
                    conversion_factor: targetConversion,
                    unit_price: unitPrice,
                    price: unitPrice,
                };
                updated = [newCart, ...activeCarts];
            }
            setActiveCarts(updated);
            toast.success(`${product.title} ${unitLabel ? `(${unitLabel})` : ""} ditambahkan`);
            return;
        }

        setAddingProductId(product.id);

        router.post(
            route("transactions.addToCart"),
            {
                product_id: product.id,
                unit_id: targetUnitId,
                sell_price: targetSellPrice,
                qty: 1,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    triggerHaptic("tap");
                    toast.success(`${product.title} ${unitLabel ? `(${unitLabel})` : ""} ditambahkan`);
                    setAddingProductId(null);
                },
                onError: (err) => {
                    triggerHaptic("error");
                    setAddingProductId(null);
                    if (err?.message) toast.error(err.message);
                    else toast.error("Gagal menambahkan produk");
                },
            }
        );
    };

    // Handle update qty
    const handleUpdateQty = (cartId, newQty) => {
        if (newQty < 1) return;

        const targetCart = activeCarts.find(
            (c) => c.id === cartId || c.cart_id === cartId
        );

        if (targetCart?.product) {
            const availableStock = Number(targetCart.product.stock || 0);
            if (availableStock > 0 && newQty > availableStock) {
                triggerHaptic("warning");
                toast.error(
                    `Stok tidak mencukupi. Tersedia: ${availableStock}`
                );
                return;
            }
        }

        triggerHaptic("tap");

        if (!navigator.onLine) {
            const updated = activeCarts.map((c) => {
                if (c.id === cartId || c.cart_id === cartId) {
                    const unitPrice = Number(
                        c.unit_price ||
                            c.product?.sell_price ||
                            Math.round(c.price / (c.qty || 1))
                    );
                    return {
                        ...c,
                        qty: newQty,
                        price: unitPrice * newQty,
                    };
                }
                return c;
            });
            setActiveCarts(updated);
            return;
        }

        router.patch(
            route("transactions.updateCart", cartId),
            { qty: newQty },
            {
                preserveScroll: true,
                onError: (err) => {
                    triggerHaptic("error");
                    if (err?.message) toast.error(err.message);
                    else if (err?.qty) toast.error(err.qty);
                    else toast.error("Gagal mengubah kuantitas");
                },
            }
        );
    };

    // Handle remove from cart
    const handleRemoveFromCart = (cartId) => {
        triggerHaptic("medium");

        if (!navigator.onLine) {
            const updated = activeCarts.filter(
                (c) => c.id !== cartId && c.cart_id !== cartId
            );
            setActiveCarts(updated);
            toast.success("Item dihapus");
            return;
        }

        router.delete(route("transactions.destroyCart", cartId), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Item dihapus");
            },
        });
    };

    // Barcode Scan Handler
    const handleBarcodeScan = useCallback(
        async (barcode) => {
            if (!barcode) return;
            const clean = String(barcode).trim();
            const product = productList.find(
                (p) =>
                    p.barcode?.toLowerCase() === clean.toLowerCase() ||
                    p.units?.some((u) => u.barcode?.toLowerCase() === clean.toLowerCase())
            );

            if (product) {
                triggerHaptic("scan");
                if (product.stock > 0 || !navigator.onLine) {
                    const matchedUnit = product.units?.find(
                        (u) => u.barcode?.toLowerCase() === clean.toLowerCase()
                    );
                    handleAddToCart(product, matchedUnit || null);
                } else {
                    toast.error(`${product.title} stok habis`);
                }
                return;
            }

            if (!navigator.onLine) {
                toast.error(`Barcode "${clean}" tidak ditemukan di database lokal`);
                return;
            }

            const lookupToast = toast.loading(`Mencari "${clean}" di katalog referensi...`);
            try {
                const response = await axios.get(route("products.lookup-catalog"), {
                    params: { barcode: clean },
                });
                toast.dismiss(lookupToast);

                if (response.data?.success && response.data?.data) {
                    const item = response.data.data;
                    setQuickAddInitialData({
                        barcode: clean,
                        title: item.title || "",
                        category_id: item.category_id || "",
                        buy_price: item.buy_price || 0,
                        sell_price: item.sell_price || "",
                        stock: 10,
                        description: item.description || item.title || "",
                        image: item.image || "",
                        fromCatalog: true,
                    });
                    setQuickAddModalOpen(true);
                } else {
                    setQuickAddInitialData({
                        barcode: clean,
                        title: "",
                        stock: 10,
                        fromCatalog: false,
                    });
                    setQuickAddModalOpen(true);
                }
            } catch (err) {
                toast.dismiss(lookupToast);
                setQuickAddInitialData({
                    barcode: clean,
                    title: "",
                    stock: 10,
                    fromCatalog: false,
                });
                setQuickAddModalOpen(true);
            }
        },
        [productList, handleAddToCart]
    );

    useBarcodeScanner(handleBarcodeScan, {
        enabled: true,
        minLength: 3,
    });

    const handleQuickAddSuccess = (newProduct) => {
        setProductList((prev) => [newProduct, ...prev]);
        handleAddToCart(newProduct);
    };

    // Hold Cart Handler
    const handleHoldCart = (label = null) => {
        if (isHolding || activeCarts.length === 0) return;

        if (!navigator.onLine) {
            toast.error("Fitur tahan transaksi memerlukan koneksi internet");
            return;
        }

        setIsHolding(true);
        router.post(
            route("transactions.hold"),
            { label },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Transaksi berhasil ditahan");
                    setIsHolding(false);
                    setCurrentTab("catalog");
                },
                onError: () => {
                    toast.error("Gagal menahan transaksi");
                    setIsHolding(false);
                },
            }
        );
    };

    // Checkout Submit
    const handleSubmitTransaction = () => {
        if (isSubmitting || activeCarts.length === 0) return;

        const isCash = paymentMethod === "cash";
        const cash = Number(cashInput || 0);

        if (payLater && !selectedCustomer?.id) {
            toast.error("Pilih pelanggan terdaftar untuk opsi piutang");
            return;
        }

        if (payLater && !dueDate) {
            toast.error("Isi tanggal jatuh tempo");
            return;
        }

        if (!payLater && isCash && cash < payable) {
            toast.error("Jumlah pembayaran tunai kurang");
            return;
        }

        if (paymentMethod === "bank_transfer" && !selectedBankAccount) {
            toast.error("Pilih rekening bank tujuan");
            return;
        }

        setIsSubmitting(true);

        if (!navigator.onLine) {
            const items = activeCarts.map((cart) => ({
                product_id: cart.product_id,
                qty: cart.qty,
                unit_id: cart.unit_id || null,
                conversion_factor: cart.conversion_factor || 1,
                unit_price:
                    cart.unit_price ||
                    cart.product?.sell_price ||
                    Math.round(cart.price / (cart.qty || 1)),
                price: cart.price,
                discount_total: cart.discount_total || 0,
            }));

            const payload = {
                customer_id: selectedCustomer?.id ?? null,
                discount,
                redeem_points: Number(redeemPointsInput || 0),
                customer_voucher_id: selectedCustomer?.id
                    ? selectedVoucherId || null
                    : null,
                shipping_cost: shipping,
                grand_total: payable,
                cash: isCash ? cash : payable,
                payment_gateway: payLater ? null : isCash ? null : paymentMethod,
                pay_later: payLater,
                due_date: payLater ? dueDate : null,
                bank_account_id:
                    paymentMethod === "bank_transfer"
                        ? selectedBankAccount?.id
                        : null,
                customer_npwp: selectedCustomer?.npwp || null,
                items,
            };

            queueTransaction(payload).then((res) => {
                const receiptInfo = {
                    ...payload,
                    client_tx_id: res?.client_tx_id,
                    customer: selectedCustomer,
                    cashier_name: auth?.user?.name,
                    change: isCash ? Math.max(cash - payable, 0) : 0,
                    created_at: new Date().toISOString(),
                    items: [...activeCarts],
                };
                setOfflineReceiptData(receiptInfo);
                setActiveCarts([]);
                setDiscountInput("");
                setRedeemPointsInput("");
                setCashInput("");
                setShippingInput("");
                setSelectedCustomer(WALK_IN_CUSTOMER);
                setPricingPreview(initialPricingPreview);
                setIsPaymentSheetOpen(false);
                setCurrentTab("catalog");
                window.dispatchEvent(new CustomEvent("pos:sync-change"));
                toast.success(
                    "Transaksi disimpan offline! Otomatis disinkronkan saat online."
                );
            });
            setIsSubmitting(false);
            return;
        }

        router.post(
            route("transactions.store"),
            {
                customer_id: selectedCustomer?.id ?? null,
                discount,
                redeem_points: Number(redeemPointsInput || 0),
                customer_voucher_id: selectedCustomer?.id
                    ? selectedVoucherId || null
                    : null,
                shipping_cost: shipping,
                grand_total: payable,
                cash: isCash ? cash : payable,
                change: isCash ? Math.max(cash - payable, 0) : 0,
                payment_gateway: payLater ? null : isCash ? null : paymentMethod,
                bank_account_id:
                    paymentMethod === "bank_transfer"
                        ? selectedBankAccount?.id
                        : null,
                pay_later: payLater,
                due_date: dueDate,
            },
            {
                onSuccess: () => {
                    setDiscountInput("");
                    setRedeemPointsInput("");
                    setCashInput("");
                    setShippingInput("");
                    setSelectedCustomer(WALK_IN_CUSTOMER);
                    setSelectedBankAccount(null);
                    setSelectedVoucherId("");
                    setPaymentMethod(defaultPaymentGateway ?? "cash");
                    setPayLater(false);
                    setDueDate("");
                    setIsSubmitting(false);
                    setIsPaymentSheetOpen(false);
                    setCurrentTab("catalog");
                    toast.success("Transaksi berhasil!");
                },
                onError: () => {
                    setIsSubmitting(false);
                    toast.error("Gagal memproses transaksi");
                },
            }
        );
    };

    // Open shift handler
    const handleOpenShift = () => {
        router.post(
            route("cashier-shifts.store"),
            {
                opening_cash: Number(openingCashInput || 0),
                notes: shiftNotesInput,
                redirect_to: "transactions.mobile",
            },
            {
                onSuccess: () => {
                    setShiftModalOpen(false);
                    toast.success("Shift kasir berhasil dibuka");
                },
            }
        );
    };

    return (
        <div className="min-h-screen bg-slate-900 flex justify-center">
            {/* Phone Container Shell */}
            <div className="w-full max-w-md min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col shadow-2xl relative overflow-hidden border-x border-slate-200 dark:border-slate-800">
                <Head title="Mobile POS" />
                <Toaster position="top-center" />

                {/* Top Header */}
                <MobileHeader
                    activeShift={activeCashierShift}
                    onOpenShiftModal={() => setShiftModalOpen(true)}
                    cartCount={cartCount}
                    onOpenCart={() => setCurrentTab("cart")}
                />

                {/* Shift Warning Banner */}
                {!activeCashierShift && (
                    <div className="bg-rose-500 text-white text-xs px-3 py-2 flex items-center justify-between shadow-xs flex-shrink-0">
                        <span className="font-bold truncate">
                            Shift kasir belum dibuka
                        </span>
                        <button
                            type="button"
                            onClick={() => setShiftModalOpen(true)}
                            className="px-2.5 py-1 bg-white text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-xs active:scale-95 transition-transform"
                        >
                            Buka Shift
                        </button>
                    </div>
                )}

                {/* Main Tab Screen */}
                <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
                    {currentTab === "catalog" ? (
                        <>
                            <MobileProductGrid
                                products={productList}
                                categories={categoryList}
                                selectedCategory={selectedCategory}
                                onCategoryChange={setSelectedCategory}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                onBarcodeScan={handleBarcodeScan}
                                isSearching={isSearching}
                                onAddToCart={handleAddToCart}
                                addingProductId={addingProductId}
                                searchInputRef={searchInputRef}
                                onAddNewProduct={() => router.get(route('products.create'))}
                            />

                            {/* Floating Cart Bar */}
                            <MobileFloatingCartBar
                                cartCount={cartCount}
                                totalPayable={payable}
                                onOpenCart={() => setCurrentTab("cart")}
                            />
                        </>
                    ) : (
                        <MobileCartSheet
                            carts={activeCarts}
                            pricingItemsByCartId={pricingItemsByCartId}
                            pricingPreview={pricingPreview}
                            customers={customerList}
                            selectedCustomer={selectedCustomer}
                            onSelectCustomer={setSelectedCustomer}
                            loyaltyTierOptions={loyaltyTierOptions}
                            heldCarts={heldCarts}
                            onHoldCart={handleHoldCart}
                            isHolding={isHolding}
                            onUpdateQty={handleUpdateQty}
                            onRemoveFromCart={handleRemoveFromCart}
                            discountInput={discountInput}
                            onDiscountChange={setDiscountInput}
                            shippingInput={shippingInput}
                            onShippingChange={setShippingInput}
                            redeemPointsInput={redeemPointsInput}
                            onRedeemPointsChange={setRedeemPointsInput}
                            selectedVoucherId={selectedVoucherId}
                            onVoucherChange={setSelectedVoucherId}
                            payLater={payLater}
                            onPayLaterChange={setPayLater}
                            dueDate={dueDate}
                            onDueDateChange={setDueDate}
                            onProceedToPayment={() => setIsPaymentSheetOpen(true)}
                            onClose={() => setCurrentTab("catalog")}
                        />
                    )}
                </main>



                {/* Payment Sheet */}
                <MobilePaymentSheet
                    isOpen={isPaymentSheetOpen}
                    onClose={() => setIsPaymentSheetOpen(false)}
                    payable={payable}
                    paymentMethod={paymentMethod}
                    onPaymentMethodChange={setPaymentMethod}
                    paymentGateways={paymentGateways}
                    bankAccounts={bankAccounts}
                    selectedBankAccount={selectedBankAccount}
                    onSelectBankAccount={setSelectedBankAccount}
                    cashInput={cashInput}
                    onCashInputChange={setCashInput}
                    payLater={payLater}
                    onPayLaterChange={setPayLater}
                    dueDate={dueDate}
                    onDueDateChange={setDueDate}
                    selectedCustomer={selectedCustomer}
                    onSubmit={handleSubmitTransaction}
                    isSubmitting={isSubmitting}
                    isLoadingPricing={isLoadingPricing}
                />

                {/* Quick Add Product Modal */}
                <QuickAddProductModal
                    isOpen={quickAddModalOpen}
                    onClose={() => setQuickAddModalOpen(false)}
                    onSuccess={handleQuickAddSuccess}
                    initialData={quickAddInitialData}
                    categories={categoryList}
                />

                {/* Offline Receipt Modal */}
                <OfflineReceiptModal
                    isOpen={Boolean(offlineReceiptData)}
                    onClose={() => setOfflineReceiptData(null)}
                    transactionData={offlineReceiptData}
                />

                {/* Open Shift Modal */}
                {shiftModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
                                Buka Shift Kasir
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">
                                Masukkan modal awal kasir untuk memulai transaksi
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Modal Awal (Kas Fisik)
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={openingCashInput}
                                        onChange={(e) =>
                                            setOpeningCashInput(
                                                e.target.value.replace(
                                                    /[^\d]/g,
                                                    ""
                                                )
                                            )
                                        }
                                        placeholder="Contoh: 100000"
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        Catatan (Opsional)
                                    </label>
                                    <textarea
                                        value={shiftNotesInput}
                                        onChange={(e) =>
                                            setShiftNotesInput(e.target.value)
                                        }
                                        placeholder="Catatan shift pagi / malam..."
                                        className="w-full h-16 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 mt-5">
                                <button
                                    type="button"
                                    onClick={() => setShiftModalOpen(false)}
                                    className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenShift}
                                    className="flex-1 py-3 rounded-xl bg-primary-600 text-white text-xs font-bold shadow-lg shadow-primary-600/30"
                                >
                                    Buka Shift
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
