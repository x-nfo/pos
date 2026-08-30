import React, {
    useEffect,
    useMemo,
    useState,
    useCallback,
    useRef,
} from "react";
import { Head, router, usePage } from "@inertiajs/react";
import axios from "axios";
import toast from "react-hot-toast";
import POSLayout from "@/Layouts/POSLayout";
import ProductGrid from "@/Components/POS/ProductGrid";
import CartPanel from "@/Components/POS/CartPanel";
import PaymentPanel from "@/Components/POS/PaymentPanel";
import CustomerSelect, {
    WALK_IN_CUSTOMER,
} from "@/Components/POS/CustomerSelect";
import NumpadModal from "@/Components/POS/NumpadModal";
import HeldTransactions, {
    HoldButton,
} from "@/Components/POS/HeldTransactions";
import QuickAddProductModal from "@/Components/POS/QuickAddProductModal";
import OfflineReceiptModal from "@/Components/POS/OfflineReceiptModal";
import WarehouseSelect from "@/Components/POS/WarehouseSelect";
import useBarcodeScanner from "@/Hooks/useBarcodeScanner";
import { getProductImageUrl, getBankLogoUrl } from "@/Utils/imageUrl";
import { useAuthorization } from "@/Utils/authorization";
import { queueTransaction, cacheProducts, cacheCustomers, cacheCategories, getCachedProducts, getCachedCustomers, getCachedCategories } from "@/Utils/offlineDb";
import {
    IconUser,
    IconShoppingCart,
    IconReceipt,
    IconKeyboard,
    IconBarcode,
    IconTrash,
    IconMinus,
    IconPlus,
    IconCash,
    IconCreditCard,
    IconBuildingBank,
    IconAlertTriangle,
    IconWallet,
    IconTag,
    IconChevronDown,
    IconChevronUp,
    IconSparkles,
} from "@tabler/icons-react";

const formatPrice = (value = 0) =>
    Number(value || 0).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    });

export default function Index({
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
    warehouses = [],
    loyaltyTierOptions = [],
}) {
    const {
        auth,
        errors,
        flash,
        lowStockNotifications = [],
        activeCashierShift,
    } = usePage().props;
    const { can } = useAuthorization();
    const canOpenShift = can("cashier-shifts-open");

    // State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [addingProductId, setAddingProductId] = useState(null);
    const [removingItemId, setRemovingItemId] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(WALK_IN_CUSTOMER);
    const [pricingPreview, setPricingPreview] = useState(initialPricingPreview);
    const [isLoadingPricing, setIsLoadingPricing] = useState(false);
    const [discountType, setDiscountType] = useState("nominal");
    const [discountInput, setDiscountInput] = useState("");
    const [redeemPointsInput, setRedeemPointsInput] = useState("");
    const [cashInput, setCashInput] = useState("");
    const [shippingInput, setShippingInput] = useState("");
    const [showDiscounts, setShowDiscounts] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(
        defaultPaymentGateway ?? "cash"
    );
    const [payLater, setPayLater] = useState(false);
    const [dueDate, setDueDate] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mobileView, setMobileView] = useState("products"); // 'products' | 'cart'
    const [numpadOpen, setNumpadOpen] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [selectedBankAccount, setSelectedBankAccount] = useState(null);
    const [selectedVoucherId, setSelectedVoucherId] = useState("");
    const [openingCashInput, setOpeningCashInput] = useState("");
    const [shiftNotesInput, setShiftNotesInput] = useState("");
    const [shiftWarehouseId, setShiftWarehouseId] = useState(
        warehouses.length > 0 ? String(warehouses[0].id) : ""
    );
    const [productList, setProductList] = useState(products);
    const [customerList, setCustomerList] = useState(customers);
    const [categoryList, setCategoryList] = useState(categories);
    const [activeCarts, setActiveCarts] = useState(carts);
    const [editingQtyId, setEditingQtyId] = useState(null);
    const [tempQtyInput, setTempQtyInput] = useState("");
    const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
    const [quickAddInitialData, setQuickAddInitialData] = useState({});
    const [offlineReceiptData, setOfflineReceiptData] = useState(null);

    useEffect(() => {
        if (warehouses.length > 0 && !shiftWarehouseId) {
            setShiftWarehouseId(String(warehouses[0].id));
        }
    }, [warehouses]);

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

    // Offline fallback: load cached products/customers/categories from IndexedDB if props are empty
    useEffect(() => {
        if (!products || products.length === 0) {
            getCachedProducts().then((cached) => {
                if (cached && cached.length > 0) {
                    setProductList(cached);
                }
            }).catch(() => {});
        }
        if (!customers || customers.length === 0) {
            getCachedCustomers().then((cached) => {
                if (cached && cached.length > 0) {
                    setCustomerList(cached);
                }
            }).catch(() => {});
        }
        if (!categories || categories.length === 0) {
            getCachedCategories().then((cached) => {
                if (cached && cached.length > 0) {
                    setCategoryList(cached);
                }
            }).catch(() => {});
        }
    }, [products, customers, categories]);

    // Auto-redirect to Mobile POS on mobile viewport
    useEffect(() => {
        if (
            typeof window !== "undefined" &&
            window.innerWidth < 768 &&
            !window.location.search.includes("desktop")
        ) {
            router.visit(route("transactions.mobile"), { replace: true });
        }
    }, []);

    const normalizedSelectedCategory =
        selectedCategory === null ? null : Number(selectedCategory);
    const pricingItemsByCartId = useMemo(() => {
        const items = pricingPreview?.items || [];

        return items.reduce((accumulator, item) => {
            accumulator[item.cart_id] = item;

            return accumulator;
        }, {});
    }, [pricingPreview]);

    // Ref for search input to enable keyboard focus
    const searchInputRef = useRef(null);

    // Set default payment method
    useEffect(() => {
        setPaymentMethod(defaultPaymentGateway ?? "cash");
    }, [defaultPaymentGateway]);

    useEffect(() => {
        setPricingPreview(initialPricingPreview);
    }, [initialPricingPreview]);

    // Show flash messages
    useEffect(() => {
        if (flash?.error) toast.error(flash.error);
        if (flash?.success) toast.success(flash.success);
    }, [flash]);

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

    const LowStockAlerts = () => null;

    const baseSubtotal = useMemo(
        () => Number(pricingPreview?.summary?.base_subtotal ?? (activeCarts.reduce((acc, c) => acc + Number(c.price || 0), 0)) ?? 0),
        [pricingPreview, activeCarts]
    );
    const subtotalBeforeManual = useMemo(
        () => Number(pricingPreview?.summary?.subtotal_after_promo ?? (activeCarts.reduce((acc, c) => acc + Number(c.price || 0), 0)) ?? 0),
        [pricingPreview, activeCarts]
    );
    const discount = useMemo(() => {
        const rawVal = Number(discountInput) || 0;
        if (rawVal <= 0) return 0;
        if (discountType === "percentage") {
            const percent = Math.min(100, Math.max(0, rawVal));
            return Math.min(subtotalBeforeManual, Math.round((subtotalBeforeManual * percent) / 100));
        }
        return Math.min(subtotalBeforeManual, Math.max(0, rawVal));
    }, [discountInput, discountType, subtotalBeforeManual]);
    const shipping = useMemo(
        () => Math.max(0, Number(shippingInput) || 0),
        [shippingInput]
    );
    const promoDiscount = useMemo(
        () => Number(pricingPreview?.summary?.promo_discount_total ?? 0),
        [pricingPreview]
    );
    const voucherDiscount = useMemo(
        () => Number(pricingPreview?.summary?.voucher_discount_total ?? 0),
        [pricingPreview]
    );
    const loyaltyDiscount = useMemo(
        () => Number(pricingPreview?.summary?.loyalty_discount_total ?? 0),
        [pricingPreview]
    );
    const taxTotal = useMemo(
        () => Number(pricingPreview?.summary?.tax_total ?? 0),
        [pricingPreview]
    );
    const subtotal = useMemo(
        () => Number(pricingPreview?.summary?.subtotal_after_promo ?? 0),
        [pricingPreview]
    );
    const payable = useMemo(
        () => Number(pricingPreview?.summary?.grand_total ?? 0),
        [pricingPreview]
    );
    const isCashPayment = !payLater && paymentMethod === "cash";
    const cash = useMemo(
        () => (isCashPayment ? Math.max(0, Number(cashInput) || 0) : payable),
        [cashInput, isCashPayment, payable]
    );
    const cartCount = useMemo(
        () => activeCarts.reduce((total, item) => total + Number(item.qty || 1), 0),
        [activeCarts]
    );
    const pricingDependency = useMemo(
        () => activeCarts.map((item) => `${item.id || item.cart_id}:${item.qty}:${item.price}`).join("|"),
        [activeCarts]
    );

    useEffect(() => {
        if (activeCarts.length === 0) {
            setPricingPreview({
                items: [],
                summary: {
                    base_subtotal: 0,
                    promo_discount_total: 0,
                    subtotal_after_promo: 0,
                    voucher_discount_total: 0,
                    loyalty_discount_total: 0,
                    manual_discount_total: 0,
                    shipping_cost: 0,
                    tax_total: 0,
                    grand_total: 0,
                },
            });

            return;
        }

        // Calculate locally when offline to avoid network failure
        if (!navigator.onLine) {
            const localSubtotal = activeCarts.reduce((acc, c) => acc + (Number(c.price) || 0), 0);
            setPricingPreview({
                items: activeCarts.map((c) => ({
                    cart_id: c.id || c.cart_id,
                    base_unit_price: Number(c.unit_price || c.product?.sell_price || 0),
                    effective_unit_price: Number(c.unit_price || c.product?.sell_price || 0),
                    line_total: Number(c.price || 0),
                    line_discount_total: 0,
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
                    grand_total: Math.max(0, localSubtotal - discount + shipping),
                },
            });
            return;
        }

        let cancelled = false;
        setIsLoadingPricing(true);

        axios
            .post(route("transactions.pricing-preview"), {
                customer_id: selectedCustomer?.id ?? null,
                discount,
                shipping_cost: shipping,
                redeem_points: Number(redeemPointsInput || 0),
                customer_voucher_id: selectedVoucherId || null,
            })
            .then((response) => {
                if (!cancelled) {
                    setPricingPreview(response.data?.data ?? initialPricingPreview);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    // Fallback to local calculation on error
                    const localSubtotal = activeCarts.reduce((acc, c) => acc + (Number(c.price) || 0), 0);
                    setPricingPreview({
                        items: activeCarts.map((c) => ({
                            cart_id: c.id || c.cart_id,
                            base_unit_price: Number(c.unit_price || c.product?.sell_price || 0),
                            effective_unit_price: Number(c.unit_price || c.product?.sell_price || 0),
                            line_total: Number(c.price || 0),
                            line_discount_total: 0,
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
                            grand_total: Math.max(0, localSubtotal - discount + shipping),
                        },
                    });
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingPricing(false);
                }
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

    useEffect(() => {
        if (!selectedCustomer?.is_loyalty_member) {
            setRedeemPointsInput("");
            setSelectedVoucherId("");
        }
    }, [selectedCustomer?.id, selectedCustomer?.is_loyalty_member]);

    useEffect(() => {
        const eligibleVoucherIds = new Set(
            (pricingPreview?.eligible_vouchers || []).map((voucher) =>
                String(voucher.id)
            )
        );

        if (selectedVoucherId && !eligibleVoucherIds.has(selectedVoucherId)) {
            setSelectedVoucherId("");
        }
    }, [pricingPreview?.eligible_vouchers, selectedVoucherId]);

    // Payment options
    const paymentOptions = useMemo(() => {
        const options = Array.isArray(paymentGateways)
            ? paymentGateways.filter(
                  (gateway) =>
                      gateway?.value && gateway.value.toLowerCase() !== "cash"
              )
            : [];

        return [
            {
                value: "cash",
                label: "Tunai",
                description: "Pembayaran tunai langsung di kasir.",
            },
            ...options,
        ];
    }, [paymentGateways]);

    // Auto-set cash input for non-cash payment
    useEffect(() => {
        if (!isCashPayment && payable >= 0) {
            setCashInput(String(payable));
        }
    }, [isCashPayment, payable]);

    const handleOpenShift = () => {
        router.post(route("cashier-shifts.store"), {
            opening_cash: Number(openingCashInput || 0),
            warehouse_id: shiftWarehouseId ? Number(shiftWarehouseId) : undefined,
            notes: shiftNotesInput,
            redirect_to: "transactions",
        });
    };

    // Handle add product to cart
    const handleAddToCart = async (product, selectedUnit = null) => {
        if (!product?.id || addingProductId) return;

        const unitObj = selectedUnit || product.units?.find((u) => u.is_base) || product.units?.[0] || null;
        const targetUnitId = unitObj?.id || product.unit_id || null;
        const targetSellPrice = Number(unitObj?.sell_price || product.sell_price || 0);
        const targetConversion = Number(unitObj?.conversion_factor || 1);
        const unitLabel = unitObj?.symbol || unitObj?.code || "";

        if (!navigator.onLine) {
            const existingIndex = activeCarts.findIndex(
                (c) => c.product_id === product.id && (targetUnitId ? c.unit_id === targetUnitId : true)
            );
            let updated;
            if (existingIndex > -1) {
                updated = [...activeCarts];
                const current = updated[existingIndex];
                const newQty = (current.qty || 1) + 1;
                const unitPrice = Number(current.unit_price || targetSellPrice);
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
                    toast.success(`${product.title} ${unitLabel ? `(${unitLabel})` : ""} ditambahkan`);
                    setAddingProductId(null);
                },
                onError: () => {
                    // Fallback to local cart on network error
                    const existingIndex = activeCarts.findIndex(
                        (c) => c.product_id === product.id && (targetUnitId ? c.unit_id === targetUnitId : true)
                    );
                    let updated;
                    if (existingIndex > -1) {
                        updated = [...activeCarts];
                        const current = updated[existingIndex];
                        const newQty = (current.qty || 1) + 1;
                        const unitPrice = Number(current.unit_price || targetSellPrice);
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
                    toast.success(`${product.title} ${unitLabel ? `(${unitLabel})` : ""} ditambahkan (offline)`);
                    setAddingProductId(null);
                },
            }
        );
    };

    // Barcode scanner integration with Reference Catalog lookup
    const handleBarcodeScan = useCallback(
        async (barcode) => {
            if (!barcode) return;
            const cleanBarcode = String(barcode).trim();
            const product = productList.find(
                (p) =>
                    p.barcode?.toLowerCase() === cleanBarcode.toLowerCase() ||
                    p.units?.some((u) => u.barcode?.toLowerCase() === cleanBarcode.toLowerCase())
            );

            if (product) {
                if (product.stock > 0 || !navigator.onLine) {
                    const matchedUnit = product.units?.find(
                        (u) => u.barcode?.toLowerCase() === cleanBarcode.toLowerCase()
                    );
                    handleAddToCart(product, matchedUnit || null);
                } else {
                    toast.error(`${product.title} stok habis`);
                }
                return;
            }

            if (!navigator.onLine) {
                toast.error(`Produk barcode "${cleanBarcode}" tidak ditemukan di database lokal`);
                return;
            }

            // Product not in store: lookup in Reference Catalog
            const lookupToast = toast.loading(`Mencari "${cleanBarcode}" di katalog referensi...`);
            try {
                const response = await axios.get(route("products.lookup-catalog"), {
                    params: { barcode: cleanBarcode },
                });
                toast.dismiss(lookupToast);

                if (response.data?.success && response.data?.data) {
                    const item = response.data.data;
                    setQuickAddInitialData({
                        barcode: cleanBarcode,
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
                        barcode: cleanBarcode,
                        title: "",
                        stock: 10,
                        fromCatalog: false,
                    });
                    setQuickAddModalOpen(true);
                }
            } catch (err) {
                toast.dismiss(lookupToast);
                setQuickAddInitialData({
                    barcode: cleanBarcode,
                    title: "",
                    stock: 10,
                    fromCatalog: false,
                });
                setQuickAddModalOpen(true);
            }
        },
        [productList, handleAddToCart]
    );

    const { isScanning } = useBarcodeScanner(handleBarcodeScan, {
        enabled: true,
        minLength: 3,
    });

    const handleQuickAddSuccess = (newProduct) => {
        setProductList((prev) => {
            const exists = prev.some((p) => p.id === newProduct.id);
            if (exists) return prev;
            return [newProduct, ...prev];
        });
        handleAddToCart(newProduct);
    };

    // Handle update cart quantity
    const [updatingCartId, setUpdatingCartId] = useState(null);

    const handleUpdateQty = (cartId, newQty) => {
        if (newQty < 1) return;

        const targetCart = activeCarts.find(
            (c) => c.id === cartId || c.cart_id === cartId
        );

        if (targetCart?.product) {
            const availableStock = Number(targetCart.product.stock || 0);
            if (availableStock > 0 && newQty > availableStock) {
                toast.error(
                    `Stok tidak mencukupi. Tersedia: ${availableStock}`
                );
                return;
            }
        }

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

        setUpdatingCartId(cartId);

        router.patch(
            route("transactions.updateCart", cartId),
            { qty: newQty },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setUpdatingCartId(null);
                },
                onError: (errors) => {
                    if (errors?.message) toast.error(errors.message);
                    else if (errors?.qty) toast.error(errors.qty);
                    else toast.error("Gagal mengubah kuantitas");
                    setUpdatingCartId(null);
                },
            }
        );
    };

    // Handle numpad confirm for cash input
    const handleNumpadConfirm = useCallback((value) => {
        setCashInput(String(value));
    }, []);

    // Handle hold transaction
    const [isHolding, setIsHolding] = useState(false);

    const handleHoldCart = async (label = null) => {
        if (isHolding) return;

        if (activeCarts.length === 0) {
            toast.error("Keranjang kosong");
            return;
        }

        if (!navigator.onLine) {
            toast.error("Fitur tahan transaksi memerlukan koneksi online");
            return;
        }

        setIsHolding(true);

        router.post(
            route("transactions.hold"),
            { label },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Transaksi ditahan");
                    setIsHolding(false);
                },
                onError: (errors) => {
                    toast.error(errors?.message || "Gagal menahan transaksi");
                    setIsHolding(false);
                },
            }
        );
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
                return;

            switch (e.key) {
                case "/":
                case "F5":
                    e.preventDefault();
                    if (searchInputRef.current) {
                        searchInputRef.current.focus();
                    }
                    break;
                case "F1":
                    e.preventDefault();
                    setNumpadOpen(true);
                    break;
                case "F2":
                    e.preventDefault();
                    if (activeCarts.length > 0 && !isSubmitting)
                        handleSubmitTransaction();
                    break;
                case "F3":
                    e.preventDefault();
                    setMobileView(
                        mobileView === "products" ? "cart" : "products"
                    );
                    break;
                case "F4":
                    e.preventDefault();
                    setShowShortcuts(!showShortcuts);
                    break;
                case "Escape":
                    setNumpadOpen(false);
                    setShowShortcuts(false);
                    setSearchQuery("");
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeCarts, selectedCustomer, mobileView, showShortcuts, isSubmitting]);

    // Handle remove from cart
    const handleRemoveFromCart = (cartId) => {
        if (!navigator.onLine) {
            const updated = activeCarts.filter((c) => c.id !== cartId && c.cart_id !== cartId);
            setActiveCarts(updated);
            toast.success("Item dihapus dari keranjang");
            return;
        }

        setRemovingItemId(cartId);

        router.delete(route("transactions.destroyCart", cartId), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Item dihapus dari keranjang");
                setRemovingItemId(null);
            },
            onError: () => {
                const updated = activeCarts.filter((c) => c.id !== cartId && c.cart_id !== cartId);
                setActiveCarts(updated);
                toast.success("Item dihapus dari keranjang");
                setRemovingItemId(null);
            },
        });
    };

    // Handle submit transaction
    const handleSubmitTransaction = () => {
        if (isSubmitting) return;

        if (activeCarts.length === 0) {
            toast.error("Keranjang masih kosong");
            return;
        }

        if (payLater && !selectedCustomer?.id) {
            toast.error("Pilih pelanggan terdaftar untuk nota barang / piutang");
            return;
        }

        if (payLater && !dueDate) {
            toast.error("Isi tanggal jatuh tempo untuk nota barang");
            return;
        }

        if (!payLater && isCashPayment && cash < payable) {
            toast.error("Jumlah pembayaran kurang dari total");
            return;
        }

        // Validate bank transfer requires bank selection
        const isBankTransfer = paymentMethod === "bank_transfer";
        if (isBankTransfer && !selectedBankAccount) {
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
                unit_price: cart.unit_price || (cart.product ? cart.product.sell_price : Math.round(cart.price / (cart.qty || 1))),
                price: cart.price,
                discount_total: cart.discount_total || 0,
            }));

            const payload = {
                customer_id: selectedCustomer?.id ?? null,
                discount,
                redeem_points: Number(redeemPointsInput || 0),
                customer_voucher_id: selectedCustomer?.id ? (selectedVoucherId || null) : null,
                shipping_cost: shipping,
                grand_total: payable,
                cash: isCashPayment ? cash : payable,
                payment_gateway: payLater ? null : isCashPayment ? null : paymentMethod,
                pay_later: payLater,
                due_date: payLater ? dueDate : null,
                bank_account_id: isBankTransfer ? selectedBankAccount : null,
                customer_npwp: selectedCustomer?.npwp || null,
                items,
            };

            queueTransaction(payload).then((res) => {
                const receiptInfo = {
                    ...payload,
                    client_tx_id: res?.client_tx_id,
                    customer: selectedCustomer,
                    cashier_name: auth?.user?.name,
                    change: isCashPayment ? Math.max(cash - payable, 0) : 0,
                    created_at: new Date().toISOString(),
                    items: [...activeCarts],
                };
                setOfflineReceiptData(receiptInfo);
                setActiveCarts([]);
                setDiscountInput("");
                setRedeemPointsInput("");
                setCashInput("");
                setShippingInput("");
                setShowDiscounts(false);
                setSelectedCustomer(WALK_IN_CUSTOMER);
                setPricingPreview(initialPricingPreview);
                window.dispatchEvent(new CustomEvent("pos:sync-change"));
                toast.success("Transaksi disimpan offline. Akan dikirim otomatis saat online.");
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
                customer_voucher_id: selectedCustomer?.id ? (selectedVoucherId || null) : null,
                shipping_cost: shipping,
                grand_total: payable,
                cash: isCashPayment ? cash : payable,
                change: isCashPayment ? Math.max(cash - payable, 0) : 0,
                payment_gateway: payLater ? null : isCashPayment ? null : paymentMethod,
                bank_account_id: isBankTransfer
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
                    setShowDiscounts(false);
                    setSelectedCustomer(WALK_IN_CUSTOMER);
                    setSelectedBankAccount(null);
                    setSelectedVoucherId("");
                    setPaymentMethod(defaultPaymentGateway ?? "cash");
                    setPayLater(false);
                    setDueDate("");
                    setIsSubmitting(false);
                    toast.success("Transaksi berhasil!");
                },
                onError: () => {
                    setIsSubmitting(false);
                    toast.error("Gagal menyimpan transaksi");
                },
            }
        );
    };

    // Filter products including out of stock
    const allProducts = useMemo(() => {
        return productList.filter((product) => {
            const matchesCategory =
                normalizedSelectedCategory === null ||
                Number(product.category_id) === normalizedSelectedCategory;
            const matchesSearch =
                !searchQuery ||
                product.title
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                product.barcode
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [productList, normalizedSelectedCategory, searchQuery]);

    if (!activeCashierShift) {
        return (
            <>
                <Head title="Buka Shift Kasir" />

                <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10">
                    <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <IconWallet size={28} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Shift kasir belum dibuka
                        </h1>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Buka shift terlebih dulu untuk mengaktifkan transaksi, keranjang, dan cash closing.
                        </p>

                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                            {warehouses.length > 0 && (
                                <WarehouseSelect
                                    warehouses={warehouses}
                                    selectedId={shiftWarehouseId}
                                    onChange={(id) => setShiftWarehouseId(String(id))}
                                />
                            )}
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Modal Awal
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={openingCashInput}
                                    onChange={(event) => setOpeningCashInput(event.target.value)}
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    placeholder="0"
                                />
                                {errors?.opening_cash && (
                                    <p className="mt-2 text-xs text-rose-500">{errors.opening_cash}</p>
                                )}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Catatan
                                </label>
                                <input
                                    type="text"
                                    value={shiftNotesInput}
                                    onChange={(event) => setShiftNotesInput(event.target.value)}
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                    placeholder="Opsional"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            {canOpenShift && (
                                <button
                                    type="button"
                                    onClick={handleOpenShift}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                                >
                                    <IconWallet size={18} />
                                    <span>Buka Shift Sekarang</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => router.visit(route("cashier-shifts.index"))}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <span>Lihat Histori Shift</span>
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Transaksi" />

            <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
                {/* Mobile Tab Switcher */}
                <div className="lg:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <button
                        onClick={() => setMobileView("products")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                            mobileView === "products"
                                ? "text-primary-600 border-b-2 border-primary-500"
                                : "text-slate-500"
                        }`}
                    >
                        <IconShoppingCart size={18} />
                        <span>Produk</span>
                    </button>
                    <button
                        onClick={() => setMobileView("cart")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                            mobileView === "cart"
                                ? "text-primary-600 border-b-2 border-primary-500"
                                : "text-slate-500"
                        }`}
                    >
                        <IconReceipt size={18} />
                        <span className="relative inline-flex items-center gap-1">
                            Keranjang
                            {cartCount > 0 && (
                                <span className="inline-flex items-center justify-center px-1.5 min-w-[20px] h-5 text-[11px] font-bold bg-primary-500 text-white rounded-full">
                                    {cartCount}
                                </span>
                            )}
                        </span>
                    </button>
                </div>

                {/* Left Panel - Products */}
                <div
                    className={`flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden ${
                        mobileView !== "products"
                            ? "hidden lg:flex lg:flex-col"
                            : "flex flex-col"
                    }`}
                >
                    <ProductGrid
                        products={allProducts}
                        categories={categoryList}
                        selectedCategory={selectedCategory}
                        onCategoryChange={(categoryId) =>
                            setSelectedCategory(
                                categoryId === null ? null : Number(categoryId)
                            )
                        }
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onBarcodeScan={handleBarcodeScan}
                        isSearching={isSearching}
                        onAddToCart={handleAddToCart}
                        addingProductId={addingProductId}
                        searchInputRef={searchInputRef}
                        onAddNewProduct={() => router.get(route('products.create'))}
                    />
                </div>

                {/* Right Panel - Cart & Payment */}
                <div
                    className={`w-full lg:w-[420px] xl:w-[480px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 min-h-0 overflow-hidden ${
                        mobileView !== "cart" ? "hidden lg:flex" : "flex"
                    }`}
                    style={{ height: "calc(100vh - 4rem)" }}
                >
                    {/* Customer Select - Fixed */}
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                        <CustomerSelect
                            customers={customerList}
                            selected={selectedCustomer}
                            onSelect={setSelectedCustomer}
                            placeholder="Pilih pelanggan..."
                            error={errors?.customer_id}
                            label="Pelanggan"
                            tierOptions={loyaltyTierOptions}
                        />
                    </div>

                    {/* Held Transactions & Alerts */}
                    {heldCarts.length > 0 && (
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                            <HeldTransactions
                                heldCarts={heldCarts}
                                hasActiveCart={activeCarts.length > 0}
                            />
                        </div>
                    )}

                    {/* Cart Items - Scrollable */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {/* Hold Button - at top of cart section */}
                        {activeCarts.length > 0 && (
                            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                                <HoldButton
                                    hasItems={activeCarts.length > 0}
                                    onHold={handleHoldCart}
                                    isHolding={isHolding}
                                />
                            </div>
                        )}

                        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <IconShoppingCart size={16} />
                                    Keranjang
                                </h3>
                                {activeCarts.length > 0 && (
                                    <span className="px-2.5 py-0.5 text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 rounded-full whitespace-nowrap">
                                        {cartCount} item
                                    </span>
                                )}
                            </div>

                            {activeCarts.length > 0 ? (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                    {activeCarts.map((item) => (
                                        (() => {
                                            const pricingItem =
                                                pricingItemsByCartId[item.id];
                                            const baseLineTotal = Number(
                                                pricingItem?.line_base_total ??
                                                    item.price ??
                                                    0
                                            );
                                            const itemQty = Number(item.qty || 1);
                                            const itemPrice = Number(item.price || 0);
                                            const fallbackUnitPrice = Number(
                                                item.unit_price ||
                                                    (itemQty > 0 ? itemPrice / itemQty : item.product?.sell_price) ||
                                                    0
                                            );
                                            const effectiveLineTotal = Number(
                                                pricingItem?.line_total ??
                                                    itemPrice
                                            );
                                            const baseUnitPrice = Number(
                                                pricingItem?.base_unit_price ??
                                                    fallbackUnitPrice
                                            );
                                            const effectiveUnitPrice = Number(
                                                pricingItem?.effective_unit_price ??
                                                    baseUnitPrice
                                            );
                                            const pricingRule =
                                                pricingItem?.pricing_rule;

                                            return (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 group"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                                                <img
                                                    src={getProductImageUrl(
                                                        item.product?.image,
                                                        true
                                                    )}
                                                    alt={item.product?.title || "Item"}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.src =
                                                            "/images/product-placeholder.svg";
                                                    }}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                                                        {item.product?.title ||
                                                            "Produk"}
                                                    </p>
                                                    {(item.unit?.symbol || item.unit?.code) && (
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 flex-shrink-0">
                                                            {item.unit.symbol || item.unit.code}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {pricingRule &&
                                                        effectiveUnitPrice <
                                                            baseUnitPrice && (
                                                            <p className="line-through text-slate-400">
                                                                {formatPrice(
                                                                    baseUnitPrice
                                                                )}{" "}
                                                                × {item.qty}
                                                            </p>
                                                        )}
                                                    <p>
                                                        {formatPrice(
                                                            effectiveUnitPrice
                                                        )}{" "}
                                                        × {item.qty}
                                                    </p>
                                                    {pricingRule && (
                                                        <p className="mt-0.5 text-[11px] font-medium text-rose-500">
                                                            {pricingRule.name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Stepper with Direct Numeric Input */}
                                            <div className="flex items-center bg-slate-200/80 dark:bg-slate-700/80 rounded-lg p-0.5 border border-slate-300/80 dark:border-slate-600/80">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleUpdateQty(
                                                            item.id,
                                                            Math.max(
                                                                1,
                                                                item.qty - 1
                                                            )
                                                        )
                                                    }
                                                    disabled={item.qty <= 1}
                                                    className="w-6 h-6 rounded-md bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-30 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-500 active:scale-95 transition-all"
                                                    title="Kurangi kuantitas"
                                                >
                                                    <IconMinus size={12} strokeWidth={2.5} />
                                                </button>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={
                                                        editingQtyId === item.id
                                                            ? tempQtyInput
                                                            : item.qty
                                                    }
                                                    onFocus={(e) => {
                                                        setEditingQtyId(item.id);
                                                        setTempQtyInput(String(item.qty));
                                                        e.target.select();
                                                    }}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^\d]/g, "");
                                                        setTempQtyInput(val);
                                                    }}
                                                    onBlur={() => {
                                                        const finalVal = parseInt(tempQtyInput, 10);
                                                        if (!isNaN(finalVal) && finalVal >= 1) {
                                                            handleUpdateQty(item.id, finalVal);
                                                        }
                                                        setEditingQtyId(null);
                                                        setTempQtyInput("");
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.target.blur();
                                                        } else if (e.key === "Escape") {
                                                            setEditingQtyId(null);
                                                            setTempQtyInput("");
                                                            e.target.blur();
                                                        }
                                                    }}
                                                    className="w-9 h-6 text-center text-xs font-bold text-slate-900 dark:text-white bg-transparent border-0 focus:ring-1 focus:ring-primary-500 rounded p-0"
                                                    title="Ketik jumlah langsung"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleUpdateQty(
                                                            item.id,
                                                            item.qty + 1
                                                        )
                                                    }
                                                    className="w-6 h-6 rounded-md bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs hover:bg-slate-50 dark:hover:bg-slate-500 active:scale-95 transition-all"
                                                    title="Tambah kuantitas"
                                                >
                                                    <IconPlus size={12} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleRemoveFromCart(
                                                        item.id
                                                    )
                                                }
                                                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/50 transition-colors"
                                                title="Hapus dari keranjang"
                                            >
                                                <IconTrash size={14} />
                                            </button>
                                            <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 w-16 text-right">
                                                {formatPrice(
                                                    effectiveLineTotal
                                                )}
                                            </p>
                                        </div>
                                            );
                                        })()
                                    ))}
                                </div>
                            ) : (
                                <div className="py-6 text-center">
                                    <IconShoppingCart
                                        size={32}
                                        className="mx-auto text-slate-300 dark:text-slate-600 mb-2"
                                    />
                                    <p className="text-sm text-slate-400">
                                        Keranjang kosong
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Payment Details - Scrollable */}
                        <div className="p-3 space-y-4">
                            {/* Pay later toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                        Bayar Belakangan (Nota Barang)
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Tidak perlu bayar sekarang, catat sebagai piutang.
                                    </p>
                                </div>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={payLater}
                                        onChange={(e) => {
                                            setPayLater(e.target.checked);
                                            if (e.target.checked) {
                                                setSelectedBankAccount(null);
                                                setPaymentMethod("cash");
                                            }
                                        }}
                                    />
                                    <span
                                        className={`w-11 h-6 flex items-center bg-slate-300 rounded-full p-1 transition ${
                                            payLater ? "bg-primary-500" : ""
                                        }`}
                                    >
                                        <span
                                            className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                                                payLater ? "translate-x-5" : ""
                                            }`}
                                        />
                                    </span>
                                </label>
                            </div>

                            {payLater && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                        Tanggal Jatuh Tempo
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    />
                                </div>
                            )}

                            {/* Payment Method Selection */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    Metode Pembayaran
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentOptions.map((method) => (
                                        <button
                                            key={method.value}
                                            onClick={() =>
                                                !payLater &&
                                                setPaymentMethod(method.value)
                                            }
                                            disabled={payLater}
                                            className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                                                paymentMethod === method.value && !payLater
                                                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                            } ${payLater ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            <div
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                    paymentMethod ===
                                                        method.value &&
                                                    !payLater
                                                        ? "bg-primary-500 text-white"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                                }`}
                                            >
                                                {method.value === "cash" ? (
                                                    <IconCash size={16} />
                                                ) : method.value ===
                                                  "bank_transfer" ? (
                                                    <IconBuildingBank
                                                        size={16}
                                                    />
                                                ) : (
                                                    <IconCreditCard size={16} />
                                                )}
                                            </div>
                                            <div className="text-left">
                                                <p
                                                    className={`text-sm font-semibold ${
                                                        paymentMethod ===
                                                        method.value
                                                            ? "text-primary-700 dark:text-primary-300"
                                                            : "text-slate-700 dark:text-slate-300"
                                                    }`}
                                                >
                                                    {method.label}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Bank Selector - Only for bank_transfer */}
                            {paymentMethod === "bank_transfer" &&
                                bankAccounts.length > 0 &&
                                !payLater && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                            Rekening Tujuan
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {bankAccounts.map((bank) => {
                                                const isActive =
                                                    selectedBankAccount?.id ===
                                                    bank.id;
                                                return (
                                                    <button
                                                        key={bank.id}
                                                        onClick={() =>
                                                            setSelectedBankAccount(
                                                                bank
                                                            )
                                                        }
                                                        className={`p-3 rounded-xl border-2 transition-colors flex items-center gap-3 text-left ${
                                                            isActive
                                                                ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                                                                : "border-slate-200 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-800"
                                                        }`}
                                                    >
                                                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 overflow-hidden shrink-0">
                                                            {getBankLogoUrl(bank.logo_url || bank.logo) ? (
                                                                <img
                                                                    src={getBankLogoUrl(bank.logo_url || bank.logo)}
                                                                    alt={bank.bank_name}
                                                                    className="max-w-full max-h-full object-contain"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = "none";
                                                                        if (e.currentTarget.nextElementSibling) {
                                                                            e.currentTarget.nextElementSibling.style.display = "block";
                                                                        }
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <IconBuildingBank
                                                                size={18}
                                                                className={`text-slate-500 ${getBankLogoUrl(bank.logo_url || bank.logo) ? "hidden" : ""}`}
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                {
                                                                    bank.bank_name
                                                                }
                                                            </p>
                                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                                {
                                                                    bank.account_number
                                                                }
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-500">
                                                                a.n.{" "}
                                                                {
                                                                    bank.account_name
                                                                }
                                                            </p>
                                                        </div>
                                                        {isActive && (
                                                            <span className="text-[11px] font-semibold text-primary-600">
                                                                Dipilih
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                            {/* Quick Amounts - Only for cash */}
                            {paymentMethod === "cash" && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                        Nominal Cepat
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[10000, 20000, 50000, 100000].map(
                                            (amt) => (
                                                <button
                                                    key={amt}
                                                    onClick={() =>
                                                        setCashInput(
                                                            String(amt)
                                                        )
                                                    }
                                                    className={`py-2 px-1 rounded-lg text-xs font-semibold transition-all ${
                                                        Number(cashInput) ===
                                                        amt
                                                            ? "bg-primary-500 text-white"
                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                                                    }`}
                                                >
                                                    {formatPrice(amt)}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Discount Input */}
                            {promoDiscount > 0 && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                                Promo otomatis aktif
                                            </p>
                                            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                                                Harga item sudah disesuaikan berdasarkan rule promo yang berlaku.
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                            -{formatPrice(promoDiscount)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Collapsible Discounts, Voucher & Shipping Options */}
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => setShowDiscounts(!showDiscounts)}
                                    className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                                        <IconTag size={16} className="text-primary-500" />
                                        <span>Diskon, Voucher & Ongkir</span>
                                        {discount > 0 || shipping > 0 || loyaltyDiscount > 0 || voucherDiscount > 0 ? (
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                    (Aktif)
                                                </span>
                                            </span>
                                        ) : null}
                                    </div>
                                    {showDiscounts ? (
                                        <IconChevronUp size={16} className="text-slate-400" />
                                    ) : (
                                        <IconChevronDown size={16} className="text-slate-400" />
                                    )}
                                </button>

                                {showDiscounts && (
                                    <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-3 mt-2">
                                        {/* Loyalty Member info & Redeem Poin */}
                                        {selectedCustomer?.is_loyalty_member && (
                                            <div className="p-3 bg-primary-50 dark:bg-primary-950/40 rounded-xl border border-primary-200 dark:border-primary-800 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-primary-700 dark:text-primary-300 flex items-center gap-1.5">
                                                        <IconSparkles size={14} />
                                                        Member Tier {selectedCustomer.loyalty_tier}
                                                    </span>
                                                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                                                        Saldo: {pricingPreview?.summary?.available_loyalty_points ?? 0} poin
                                                    </span>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                        Redeem Poin
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={redeemPointsInput}
                                                        onChange={(e) =>
                                                            setRedeemPointsInput(
                                                                e.target.value.replace(/[^\d]/g, "")
                                                            )
                                                        }
                                                        placeholder={`Maks ${
                                                            pricingPreview?.summary
                                                                ?.available_loyalty_points ?? 0
                                                        } poin`}
                                                        className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Voucher Customer */}
                                        {selectedCustomer?.is_loyalty_member &&
                                            (pricingPreview?.eligible_vouchers || []).length > 0 && (
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                                                        Voucher Customer
                                                    </label>
                                                    <select
                                                        value={selectedVoucherId}
                                                        onChange={(e) =>
                                                            setSelectedVoucherId(e.target.value)
                                                        }
                                                        className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                    >
                                                        <option value="">Tanpa voucher</option>
                                                        {(pricingPreview?.eligible_vouchers || []).map(
                                                            (voucher) => (
                                                                <option
                                                                    key={voucher.id}
                                                                    value={voucher.id}
                                                                >
                                                                    {voucher.code} - {voucher.name}
                                                                </option>
                                                            )
                                                        )}
                                                    </select>
                                                </div>
                                            )}

                                        {/* Diskon Manual */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                                    Diskon Manual
                                                </label>
                                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDiscountType("nominal");
                                                            setDiscountInput("");
                                                        }}
                                                        className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                                                            discountType === "nominal"
                                                                ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm font-semibold"
                                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                                        }`}
                                                    >
                                                        Rp
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDiscountType("percentage");
                                                            setDiscountInput("");
                                                        }}
                                                        className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                                                            discountType === "percentage"
                                                                ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm font-semibold"
                                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                                        }`}
                                                    >
                                                        %
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                                                    {discountType === "nominal" ? "Rp" : "%"}
                                                </span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={discountInput}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^\d]/g, "");
                                                        if (discountType === "percentage" && Number(val) > 100) {
                                                            return;
                                                        }
                                                        setDiscountInput(val);
                                                    }}
                                                    placeholder={discountType === "nominal" ? "0" : "0%"}
                                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                />
                                            </div>
                                            {Number(discountInput) > 0 && subtotalBeforeManual > 0 && (
                                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                                    <span>
                                                        {discountType === "percentage"
                                                            ? `Setara Rp ${discount.toLocaleString("id-ID")}`
                                                            : `Setara ${((discount / subtotalBeforeManual) * 100).toFixed(1)}%`}
                                                    </span>
                                                    <span className="text-primary-600 dark:text-primary-400 font-medium">
                                                        -Rp {discount.toLocaleString("id-ID")}
                                                    </span>
                                                </p>
                                            )}
                                        </div>

                                        {/* Shipping Cost */}
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                                                Ongkos Kirim (Rp)
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                                    Rp
                                                </span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={shippingInput}
                                                    onChange={(e) =>
                                                        setShippingInput(
                                                            e.target.value.replace(/[^\d]/g, "")
                                                        )
                                                    }
                                                    placeholder="0"
                                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                                />
                                            </div>
                                            {/* Quick Shipping Amounts */}
                                            <div className="grid grid-cols-4 gap-2 mt-2">
                                                {[10000, 15000, 20000, 25000].map((amt) => (
                                                    <button
                                                        key={amt}
                                                        type="button"
                                                        onClick={() =>
                                                            setShippingInput(String(amt))
                                                        }
                                                        className={`py-1.5 px-1 rounded-lg text-xs font-medium transition-all ${
                                                            Number(shippingInput) === amt
                                                                ? "bg-primary-500 text-white"
                                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                                                        }`}
                                                    >
                                                        {formatPrice(amt)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Cash Input - Only for cash */}
                            {paymentMethod === "cash" && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                        Jumlah Bayar (Rp)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                            Rp
                                        </span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={cashInput}
                                            onChange={(e) =>
                                                setCashInput(
                                                    e.target.value.replace(
                                                        /[^\d]/g,
                                                        ""
                                                    )
                                                )
                                            }
                                            placeholder="0"
                                            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base font-semibold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary & Submit - Fixed at bottom */}
                    <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3">
                        {/* Summary Row */}
                        <div className="flex justify-between items-center mb-2 text-sm">
                            <span className="text-slate-500">Subtotal Dasar</span>
                            <span className="font-medium">
                                {formatPrice(baseSubtotal)}
                            </span>
                        </div>
                        {promoDiscount > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">
                                    Promo Otomatis
                                </span>
                                <span className="text-emerald-600">
                                    -{formatPrice(promoDiscount)}
                                </span>
                            </div>
                        )}
                        {(pricingPreview?.applied_groups || []).length > 0 && (
                            <div className="mb-3 rounded-xl border border-slate-200 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/60">
                                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Grup Promo Aktif
                                </div>
                                <div className="space-y-1.5">
                                    {(pricingPreview?.applied_groups || []).map(
                                        (group) => (
                                            <div
                                                key={group.key}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className="truncate pr-3 text-slate-600 dark:text-slate-300">
                                                    {group.label}
                                                </span>
                                                <span className="font-medium text-emerald-600">
                                                    -{formatPrice(group.discount_total)}
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                        {voucherDiscount > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">Voucher</span>
                                <span className="text-primary-600">
                                    -{formatPrice(voucherDiscount)}
                                </span>
                            </div>
                        )}
                        {loyaltyDiscount > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">
                                    Redeem Poin
                                </span>
                                <span className="text-primary-600">
                                    -{formatPrice(loyaltyDiscount)}
                                </span>
                            </div>
                        )}
                        {discount > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">Diskon Manual</span>
                                <span className="text-danger-500">
                                    -{formatPrice(discount)}
                                </span>
                            </div>
                        )}
                        {shipping > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">Ongkir</span>
                                <span className="font-medium">
                                    +{formatPrice(shipping)}
                                </span>
                            </div>
                        )}
                        {taxTotal > 0 && (
                            <div className="flex justify-between items-center mb-2 text-sm">
                                <span className="text-slate-500">PPN</span>
                                <span className="font-medium">
                                    +{formatPrice(taxTotal)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-semibold text-slate-800 dark:text-white">
                                Total
                            </span>
                            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                {formatPrice(payable)}
                            </span>
                        </div>

                        {paymentMethod === "cash" &&
                            !payLater &&
                            cash >= payable &&
                            payable > 0 && (
                                <div className="flex justify-between items-center mb-3 p-2 rounded-lg bg-success-50 dark:bg-success-950/30">
                                    <span className="text-sm text-success-700 dark:text-success-400">
                                        Kembalian
                                    </span>
                                    <span className="font-bold text-success-600">
                                        {formatPrice(cash - payable)}
                                    </span>
                                </div>
                            )}

                        {/* Submit Button - Always visible */}
                        <button
                            onClick={handleSubmitTransaction}
                            disabled={
                                !activeCarts.length ||
                                (payLater && !selectedCustomer?.id) ||
                                (!payLater &&
                                    paymentMethod === "cash" &&
                                    cash < payable) ||
                                isLoadingPricing ||
                                isSubmitting
                            }
                            className={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                                activeCarts.length &&
                                (!payLater || selectedCustomer?.id) &&
                                (paymentMethod !== "cash" || cash >= payable) &&
                                !isLoadingPricing
                                    ? "bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/30"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                            }`}
                        >
                            {isSubmitting || isLoadingPricing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <IconReceipt size={18} />
                                    <span>
                                        {!activeCarts.length
                                            ? "Keranjang Kosong"
                                            : payLater && !selectedCustomer?.id
                                            ? "Pilih Pelanggan Terdaftar"
                                            : paymentMethod === "cash" &&
                                              cash < payable
                                            ? `Kurang ${formatPrice(
                                                  payable - cash
                                              )}`
                                            : isLoadingPricing
                                            ? "Menghitung Promo..."
                                            : "Selesaikan Transaksi"}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Numpad Modal */}
            <NumpadModal
                isOpen={numpadOpen}
                onClose={() => setNumpadOpen(false)}
                onConfirm={handleNumpadConfirm}
                title="Jumlah Bayar"
                initialValue={Number(cashInput) || 0}
                isCurrency={true}
            />

            {/* Keyboard Shortcuts Help */}
            {showShortcuts && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/60"
                        onClick={() => setShowShortcuts(false)}
                    />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <IconKeyboard size={24} />
                            Keyboard Shortcuts
                        </h3>
                        <div className="space-y-3">
                            {[
                                ["F1", "Buka Numpad"],
                                ["F2", "Selesaikan Transaksi"],
                                ["F3", "Toggle Produk/Keranjang"],
                                ["F4", "Tampilkan Bantuan"],
                                ["Esc", "Tutup Modal"],
                            ].map(([key, desc]) => (
                                <div
                                    key={key}
                                    className="flex items-center justify-between"
                                >
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {desc}
                                    </span>
                                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {key}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowShortcuts(false)}
                            className="mt-6 w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}
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
        </>
    );
}

Index.layout = (page) => <POSLayout children={page} />;
