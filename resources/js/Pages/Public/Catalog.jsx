import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Head, router } from "@inertiajs/react";
import axios from "axios";
import PublicLayout from "@/Layouts/PublicLayout";
import toast from "react-hot-toast";
import { IconChevronUp } from "@tabler/icons-react";

// Sub-components
import PromoBannerCarousel from "@/Components/Public/PromoBannerCarousel";
import StaticPromoBanner from "@/Components/Public/StaticPromoBanner";
import BranchSelectorModal from "@/Components/Public/BranchSelectorModal";
import CatalogNavbar from "@/Components/Public/Catalog/CatalogNavbar";
import CatalogHero from "@/Components/Public/Catalog/CatalogHero";
import CatalogToolbar from "@/Components/Public/Catalog/CatalogToolbar";
import CatalogFilterDrawer from "@/Components/Public/Catalog/CatalogFilterDrawer";
import CatalogProductCard from "@/Components/Public/Catalog/CatalogProductCard";
import CatalogProductCardSkeleton from "@/Components/Public/Catalog/CatalogProductCardSkeleton";
import CatalogQuickViewModal from "@/Components/Public/Catalog/CatalogQuickViewModal";
import CatalogCartTray from "@/Components/Public/Catalog/CatalogCartTray";
import CatalogWishlistDrawer from "@/Components/Public/Catalog/CatalogWishlistDrawer";
import CatalogCheckoutDrawer from "@/Components/Public/Catalog/CatalogCheckoutDrawer";
import CatalogOrderStatusBanner from "@/Components/Public/Catalog/CatalogOrderStatusBanner";
import EditorialFooter from "@/Components/Public/Home/EditorialFooter";

import { useWishlist } from "@/Hooks/useWishlist";
import { useCatalogInfiniteScroll } from "@/Hooks/useCatalogInfiniteScroll";
import { useCoupon } from "@/Hooks/useCoupon";

import {
    formatRupiah,
    generateWhatsAppOrderMessage,
    openWhatsAppOrder,
} from "@/Utils/whatsappOrder";

const CART_STORAGE_KEY = "pos_catalog_cart_v1";
const CUSTOMER_STORAGE_KEY = "pos_catalog_customer_info_v1";
const RECENT_ORDERS_STORAGE_KEY = "pos_catalog_recent_orders_v1";

const resolveCatalogCheckoutUrl = () => {
    try {
        if (typeof route === "function" && route().has("catalog.checkout")) {
            return route("catalog.checkout");
        }
    } catch (_) { }
    return "/katalog/order";
};

const resolveCatalogStatusUrl = (token) => {
    try {
        if (typeof route === "function" && route().has("catalog.order.status")) {
            return route("catalog.order.status", token);
        }
    } catch (_) { }
    return `/katalog/order/${token}`;
};

const resolveCatalogStatusCheckUrl = (token) => {
    try {
        if (typeof route === "function" && route().has("catalog.order.status-check")) {
            return route("catalog.order.status-check", token);
        }
    } catch (_) { }
    return `/katalog/order/${token}/check`;
};

const resolveShippingDestinationsUrl = () => {
    try {
        if (typeof route === "function" && route().has("catalog.shipping.destinations")) {
            return route("catalog.shipping.destinations");
        }
    } catch (_) { }
    return "/katalog/shipping/destinations";
};

const resolveShippingCalculateUrl = () => {
    try {
        if (typeof route === "function" && route().has("catalog.shipping.calculate")) {
            return route("catalog.shipping.calculate");
        }
    } catch (_) { }
    return "/katalog/shipping/calculate";
};

const STATUS_CONFIG = {
    submitted: { label: "Menunggu Konfirmasi" },
    confirmed: { label: "Dikonfirmasi Toko" },
    processing: { label: "Sedang Disiapkan" },
    ready: { label: "Siap / Sedang Dikirim" },
    completed: { label: "Selesai" },
    cancelled: { label: "Dibatalkan" },
};

const parseVariantAttrs = (variant) => {
    let attrs = variant?.variant_attributes;
    if (typeof attrs === "string") {
        try {
            attrs = JSON.parse(attrs);
        } catch (_) {
            attrs = {};
        }
    }
    return attrs && typeof attrs === "object" ? attrs : {};
};

export default function Catalog({
    categories = [],
    products = [],
    availableColors: serverAvailableColors = [],
    maxPriceLimit: serverMaxPriceLimit = null,
    store = {},
    filters = {},
    promoBanners = [],
    staticBanner = null,
    branches = [],
    activeBranch = null,
    sizeCharts = [],
    bankAccounts = [],
    availableCoupons = [],
}) {
    // 1. Navigation & Search & Filter States
    const [searchTerm, setSearchTerm] = useState(filters.q || "");
    const [activeCategory, setActiveCategory] = useState(filters.category_id || "all");
    const [selectedColors, setSelectedColors] = useState(() => {
        if (Array.isArray(filters.colors)) return filters.colors;
        if (typeof filters.colors === "string" && filters.colors.trim() !== "") {
            return filters.colors.split(",").map((s) => s.trim()).filter(Boolean);
        }
        return [];
    });
    const [inStockOnly, setInStockOnly] = useState(Boolean(filters.in_stock));
    const [sortBy, setSortBy] = useState(filters.sort || "title");
    const [gridCols, setGridCols] = useState(3);

    // 2. Modals & Drawers States
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isWishlistOpen, setIsWishlistOpen] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Wishlist Hook & State
    const {
        wishlist,
        wishlistCount,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist,
    } = useWishlist();

    // Coupon Hook & State
    const {
        couponInput,
        setCouponInput,
        appliedCoupon,
        discountAmount,
        isCheckingCoupon,
        couponError,
        setCouponError,
        applyCoupon,
        removeCoupon,
        revalidateWithSubtotal,
    } = useCoupon();

    // 3. Dynamic Price Limit Calculation
    const maxPriceLimit = useMemo(() => {
        if (typeof serverMaxPriceLimit === "number" && serverMaxPriceLimit > 0) {
            return serverMaxPriceLimit;
        }
        const list = Array.isArray(products) ? products : (products?.data || []);
        if (!list.length) return 5000000;
        const prices = list.map((p) => Number(p.final_price || p.sell_price || 0));
        return Math.ceil(Math.max(...prices, 100000) * 1.1);
    }, [serverMaxPriceLimit, products]);

    const minPriceLimit = 0;
    const [maxPrice, setMaxPrice] = useState(() => {
        if (filters.max_price && Number(filters.max_price) > 0) {
            return Number(filters.max_price);
        }
        return maxPriceLimit;
    });

    useEffect(() => {
        if (!filters.max_price) {
            setMaxPrice(maxPriceLimit);
        }
    }, [maxPriceLimit, filters.max_price]);

    // 4. Cart State & LocalStorage
    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem(CART_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        } catch (e) {
            console.error("Gagal menyimpan keranjang ke localStorage", e);
        }
    }, [cart]);

    // 5. Customer Info & LocalStorage
    const [savedCustomer, setSavedCustomer] = useState(() => {
        try {
            const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    });

    const [customerName, setCustomerName] = useState(() => savedCustomer?.name || "");
    const [customerPhone, setCustomerPhone] = useState(() => savedCustomer?.phone || "");
    const [deliveryAddress, setDeliveryAddress] = useState(() => savedCustomer?.address || "");
    const [rememberCustomer, setRememberCustomer] = useState(true);
    const [isAutoFilled, setIsAutoFilled] = useState(() => !!savedCustomer?.name);
    const [orderNotes, setOrderNotes] = useState("");

    const isDeliveryAllowed = (activeBranch?.delivery_enabled ?? store?.delivery_enabled) !== false;
    const isPickupAllowed = (activeBranch?.pickup_enabled ?? store?.pickup_enabled) !== false;
    const [deliveryMethod, setDeliveryMethod] = useState(() => {
        if (isDeliveryAllowed) return "delivery";
        if (isPickupAllowed) return "pickup";
        return "delivery";
    });

    useEffect(() => {
        if (!isDeliveryAllowed && isPickupAllowed && deliveryMethod !== "pickup") {
            setDeliveryMethod("pickup");
        } else if (!isPickupAllowed && isDeliveryAllowed && deliveryMethod !== "delivery") {
            setDeliveryMethod("delivery");
        }
    }, [isDeliveryAllowed, isPickupAllowed, deliveryMethod]);

    const opStatus = activeBranch?.operating_status || store.operating_status || {
        is_open: true,
        status: "open",
        label: "Buka",
        badge_text: "Buka",
        badge_color: "emerald",
    };
    const isStoreOpen = opStatus.is_open !== false;

    // 6. RajaOngkir States
    const isRajaongkirActive = Boolean(store?.rajaongkir_enabled);
    const [destinationQuery, setDestinationQuery] = useState("");
    const [destinationResults, setDestinationResults] = useState([]);
    const [selectedDestination, setSelectedDestination] = useState(null);
    const [isSearchingDestination, setIsSearchingDestination] = useState(false);
    const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
    const [shippingRates, setShippingRates] = useState([]);
    const [selectedShippingRate, setSelectedShippingRate] = useState(null);
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
    const [shippingWeight, setShippingWeight] = useState(0);
    const [shippingCalculationError, setShippingCalculationError] = useState(null);

    // 7. Bank Transfer & Payment Proof States
    const [selectedBankId, setSelectedBankId] = useState(() => (bankAccounts.length > 0 ? bankAccounts[0].id : null));
    const [paymentProofFile, setPaymentProofFile] = useState(null);
    const [paymentProofPreview, setPaymentProofPreview] = useState(null);
    const [paymentProofError, setPaymentProofError] = useState(null);
    const [copiedRekening, setCopiedRekening] = useState(null);
    const [copiedTotal, setCopiedTotal] = useState(false);
    const [submittingOrder, setSubmittingOrder] = useState(false);

    // 8. Recent Orders & Live Tracking
    const [recentOrders, setRecentOrders] = useState(() => {
        try {
            const raw = localStorage.getItem(RECENT_ORDERS_STORAGE_KEY);
            if (!raw) return [];
            const list = JSON.parse(raw);
            const cutoff = Date.now() - 48 * 3600 * 1000;
            return list.filter((o) => new Date(o.created_at).getTime() > cutoff);
        } catch (_) {
            return [];
        }
    });
    const [dismissedActiveBanner, setDismissedActiveBanner] = useState(false);

    const latestActiveOrder = useMemo(() => {
        return (
            recentOrders.find((o) => !["completed", "cancelled"].includes(o.status)) || null
        );
    }, [recentOrders]);

    // Live order tracking polling
    useEffect(() => {
        if (!latestActiveOrder?.access_token) return;
        let isMounted = true;

        const checkStatus = () => {
            axios
                .get(resolveCatalogStatusCheckUrl(latestActiveOrder.access_token))
                .then((res) => {
                    if (!isMounted) return;
                    const freshOrder = res.data?.order || res.data;
                    const freshStatus = freshOrder?.status || res.data?.status;
                    const freshLabel =
                        freshOrder?.status_label ||
                        res.data?.status_label ||
                        STATUS_CONFIG[freshStatus]?.label;

                    if (
                        freshStatus &&
                        (freshStatus !== latestActiveOrder.status ||
                            (freshLabel && freshLabel !== latestActiveOrder.status_label))
                    ) {
                        if (freshStatus !== latestActiveOrder.status) {
                            if (freshStatus === "completed") {
                                toast.success(
                                    `Pesanan ${latestActiveOrder.order_number} telah selesai. Terima kasih!`,
                                    { id: `order-${latestActiveOrder.order_number}`, duration: 5000 }
                                );
                            } else if (freshStatus === "cancelled") {
                                toast.error(
                                    `Pesanan ${latestActiveOrder.order_number} telah dibatalkan.`,
                                    { id: `order-${latestActiveOrder.order_number}`, duration: 5000 }
                                );
                            } else if (freshLabel) {
                                toast.success(`Status pesanan: ${freshLabel}`, {
                                    id: `order-${latestActiveOrder.order_number}`,
                                    duration: 4000,
                                });
                            }
                        }

                        setRecentOrders((prev) => {
                            const updated = prev.map((o) =>
                                o.access_token === latestActiveOrder.access_token
                                    ? {
                                        ...o,
                                        status: freshStatus,
                                        status_label: freshLabel || o.status_label || STATUS_CONFIG[freshStatus]?.label || "Diproses",
                                    }
                                    : o
                            );
                            try {
                                localStorage.setItem(RECENT_ORDERS_STORAGE_KEY, JSON.stringify(updated));
                            } catch (_) { }
                            return updated;
                        });
                    }
                })
                .catch(() => { });
        };

        checkStatus();
        const interval = setInterval(checkStatus, 6000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [latestActiveOrder?.access_token, latestActiveOrder?.status]);

    // 9. Server Filter Sync & Infinite Scroll
    const applyFilters = useCallback(
        (overrides = {}) => {
            const merged = {
                q: searchTerm.trim() || undefined,
                category_id: activeCategory !== "all" ? activeCategory : undefined,
                cabang: activeBranch?.code,
                sort: sortBy !== "title" ? sortBy : undefined,
                in_stock: inStockOnly ? 1 : undefined,
                max_price: maxPrice < maxPriceLimit ? maxPrice : undefined,
                colors: selectedColors.length > 0 ? selectedColors.join(",") : undefined,
                ...overrides,
            };

            const params = new URLSearchParams();
            Object.entries(merged).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== "" && v !== false) {
                    params.set(k, String(v));
                }
            });

            // Reset page to 1 on filter changes
            params.delete("page");

            router.get(
                `${window.location.pathname}?${params.toString()}`,
                {},
                {
                    preserveState: true,
                    preserveScroll: true,
                    only: ["products", "filters"],
                    replace: true,
                }
            );
        },
        [searchTerm, activeCategory, activeBranch?.code, sortBy, inStockOnly, maxPrice, maxPriceLimit, selectedColors]
    );

    const activeFiltersForPaginator = useMemo(
        () => ({
            q: searchTerm.trim() || undefined,
            category_id: activeCategory !== "all" ? activeCategory : undefined,
            cabang: activeBranch?.code,
            sort: sortBy,
            in_stock: inStockOnly ? 1 : undefined,
            max_price: maxPrice < maxPriceLimit ? maxPrice : undefined,
            colors: selectedColors.length > 0 ? selectedColors.join(",") : undefined,
        }),
        [searchTerm, activeCategory, activeBranch?.code, sortBy, inStockOnly, maxPrice, maxPriceLimit, selectedColors]
    );

    const {
        items,
        total,
        hasMore,
        isLoadingMore,
        loadMore,
        sentinelRef,
        isAutoLoadThresholdReached,
    } = useCatalogInfiniteScroll(products, activeFiltersForPaginator);

    // Filter event handlers with debouncing
    const searchDebounceTimer = useRef(null);
    const handleSearchChange = (val) => {
        setSearchTerm(val);
        if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
        searchDebounceTimer.current = setTimeout(() => {
            applyFilters({ q: val.trim() || undefined });
        }, 350);
    };

    const handleClearSearch = () => {
        setSearchTerm("");
        if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
        applyFilters({ q: undefined });
    };

    const handleSelectCategory = (catId) => {
        setActiveCategory(catId);
        applyFilters({ category_id: catId === "all" ? undefined : catId });
    };

    const handleSortChange = (newSort) => {
        setSortBy(newSort);
        applyFilters({ sort: newSort });
    };

    const handleToggleInStock = (val) => {
        setInStockOnly(val);
        applyFilters({ in_stock: val ? 1 : undefined });
    };

    const handleToggleColor = (colorName) => {
        const next = selectedColors.includes(colorName)
            ? selectedColors.filter((c) => c !== colorName)
            : [...selectedColors, colorName];
        setSelectedColors(next);
        applyFilters({ colors: next.length > 0 ? next.join(",") : undefined });
    };

    const priceDebounceTimer = useRef(null);
    const handlePriceChange = (val) => {
        setMaxPrice(val);
        if (priceDebounceTimer.current) clearTimeout(priceDebounceTimer.current);
        priceDebounceTimer.current = setTimeout(() => {
            applyFilters({ max_price: val < maxPriceLimit ? val : undefined });
        }, 400);
    };

    const handleResetFilters = () => {
        setActiveCategory("all");
        setSelectedColors([]);
        setMaxPrice(maxPriceLimit);
        setInStockOnly(false);
        setSearchTerm("");
        setIsFilterOpen(false);

        const params = new URLSearchParams();
        if (activeBranch?.code) {
            params.set("cabang", activeBranch.code);
        }

        router.get(
            `${window.location.pathname}?${params.toString()}`,
            {},
            {
                preserveState: true,
                preserveScroll: true,
                only: ["products", "filters"],
            }
        );
    };

    // Extract Available Colors (from server if provided, otherwise from items)
    const availableColors = useMemo(() => {
        if (serverAvailableColors && serverAvailableColors.length > 0) {
            return serverAvailableColors;
        }
        const colorMap = new Map();
        items.forEach((p) => {
            if (p.variants && Array.isArray(p.variants)) {
                p.variants.forEach((v) => {
                    const attrs = parseVariantAttrs(v);
                    const name = attrs.color_name || attrs.warna;
                    const hex = attrs.color_hex || attrs.hex;
                    if (name && hex && !colorMap.has(name)) {
                        colorMap.set(name, { name, hex });
                    }
                });
            }
        });
        return Array.from(colorMap.values());
    }, [serverAvailableColors, items]);

    // Back to top floating button
    const [showBackToTop, setShowBackToTop] = useState(false);
    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 450);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Active filter counter
    const activeFilterCount =
        (activeCategory !== "all" ? 1 : 0) +
        (selectedColors.length > 0 ? selectedColors.length : 0) +
        (maxPrice < maxPriceLimit ? 1 : 0) +
        (inStockOnly ? 1 : 0);

    // Active Category Title
    const activeCategoryTitle = useMemo(() => {
        if (activeCategory === "all") return "Semua Koleksi";
        const cat = categories.find((c) => String(c.id) === String(activeCategory));
        return cat?.name || "Koleksi";
    }, [activeCategory, categories]);

    // Cart counts and totals
    const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
    const cartTotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const p = item.final_price || item.sell_price || 0;
            return sum + p * item.qty;
        }, 0);
    }, [cart]);

    // Revalidate applied coupon when cart total changes
    useEffect(() => {
        revalidateWithSubtotal(cartTotal);
    }, [cartTotal, revalidateWithSubtotal]);

    const shippingCost = useMemo(() => {
        if (deliveryMethod !== "delivery" || !isRajaongkirActive) return 0;
        return Number(selectedShippingRate?.cost) || 0;
    }, [deliveryMethod, isRajaongkirActive, selectedShippingRate]);

    const grandTotal = useMemo(() => Math.max(0, cartTotal - discountAmount) + shippingCost, [cartTotal, discountAmount, shippingCost]);

    // Cart actions
    const addToCart = (targetProduct, quantity = 1, showToast = true, unit = null) => {
        if (!isStoreOpen) {
            toast.error(`Maaf, toko sedang tutup (${opStatus.badge_text || "Tutup"})`);
            return;
        }

        const chosenUnit = unit || targetProduct.units?.find((u) => u.is_base) || targetProduct.units?.[0] || null;
        const factor = Number(chosenUnit?.conversion_factor) || 1;
        const maxUnitQty = factor > 0 ? Math.floor(targetProduct.stock / factor) : 0;

        if (maxUnitQty <= 0 || targetProduct.stock <= 0) {
            toast.error("Maaf, stok barang tidak mencukupi");
            return;
        }

        const cartKey = `${targetProduct.id}_${chosenUnit?.id || "base"}`;
        const unitPrice = chosenUnit?.final_price || chosenUnit?.sell_price || targetProduct.final_price || targetProduct.sell_price;
        const unitOriginalPrice = chosenUnit?.sell_price || targetProduct.sell_price;

        setCart((prev) => {
            const existingIndex = prev.findIndex(
                (item) => (item.cart_key || item.id) === cartKey
            );
            if (existingIndex > -1) {
                const current = prev[existingIndex];
                const newQty = Math.min(maxUnitQty, current.qty + quantity);
                const updated = [...prev];
                updated[existingIndex] = { ...current, qty: newQty };
                return updated;
            }

            return [
                ...prev,
                {
                    id: targetProduct.id,
                    parent_id: targetProduct.parent_id || null,
                    cart_key: cartKey,
                    title: targetProduct.title,
                    sell_price: unitOriginalPrice,
                    final_price: unitPrice,
                    image: targetProduct.image,
                    category_name: targetProduct.category_name || "",
                    stock: targetProduct.stock,
                    max_unit_stock: maxUnitQty,
                    unit_id: chosenUnit?.id || null,
                    unit_name: chosenUnit?.name || chosenUnit?.code || "Pcs",
                    unit_code: chosenUnit?.code || "PCS",
                    unit_symbol: chosenUnit?.symbol || "pcs",
                    conversion_factor: factor,
                    qty: Math.min(maxUnitQty, quantity),
                },
            ];
        });

        if (showToast) {
            toast.success(`${targetProduct.title} ditambahkan ke keranjang`, { icon: "🛍️" });
        }
    };

    const handleUpdateQty = (cartKey, newQty) => {
        if (newQty <= 0) {
            handleRemoveItem(cartKey);
            return;
        }
        setCart((prev) =>
            prev.map((item) =>
                (item.cart_key || item.id) === cartKey
                    ? { ...item, qty: Math.min(item.max_unit_stock || item.stock, newQty) }
                    : item
            )
        );
    };

    const handleRemoveItem = (cartKey) => {
        setCart((prev) => prev.filter((item) => (item.cart_key || item.id) !== cartKey));
    };

    const handleClearCart = () => {
        setCart([]);
        try {
            localStorage.removeItem(CART_STORAGE_KEY);
        } catch (_) { }
        toast.success("Keranjang belanja dikosongkan");
    };

    // Customer reset & remember
    const handleToggleRemember = (checked) => {
        setRememberCustomer(checked);
        if (!checked) {
            try {
                localStorage.removeItem(CUSTOMER_STORAGE_KEY);
                setSavedCustomer(null);
                setIsAutoFilled(false);
            } catch (_) { }
        } else if (customerName.trim()) {
            saveCustomerInfo();
        }
    };

    const saveCustomerInfo = () => {
        if (!rememberCustomer || !customerName.trim()) return;
        try {
            const info = {
                name: customerName.trim(),
                phone: customerPhone.trim(),
                address: deliveryAddress.trim(),
                updated_at: new Date().toISOString(),
            };
            localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(info));
            setSavedCustomer(info);
        } catch (_) { }
    };

    const handleResetCustomerInfo = () => {
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSavedCustomer(null);
        setIsAutoFilled(false);
        try {
            localStorage.removeItem(CUSTOMER_STORAGE_KEY);
        } catch (_) { }
        toast.success("Data pemesan dibersihkan");
    };

    // RajaOngkir Search & Calculations
    useEffect(() => {
        if (!isRajaongkirActive || !destinationQuery || destinationQuery.trim().length < 3) {
            setDestinationResults([]);
            return;
        }
        if (selectedDestination && destinationQuery === selectedDestination.label) {
            return;
        }
        const timer = setTimeout(() => {
            setIsSearchingDestination(true);
            axios
                .get(resolveShippingDestinationsUrl(), {
                    params: { search: destinationQuery.trim() },
                })
                .then((res) => {
                    const data = res.data?.data || res.data?.destinations || res.data || [];
                    setDestinationResults(Array.isArray(data) ? data : []);
                    setShowDestinationDropdown(true);
                })
                .catch(() => setDestinationResults([]))
                .finally(() => setIsSearchingDestination(false));
        }, 350);
        return () => clearTimeout(timer);
    }, [destinationQuery, isRajaongkirActive, selectedDestination]);

    const fetchShippingRates = async (destId, cartItems) => {
        if (!destId || !cartItems || cartItems.length === 0) {
            setShippingRates([]);
            setSelectedShippingRate(null);
            return;
        }
        setIsCalculatingShipping(true);
        setShippingCalculationError(null);
        try {
            const res = await axios.post(resolveShippingCalculateUrl(), {
                destination_id: destId,
                warehouse_id: activeBranch?.id || branches[0]?.id || null,
                items: cartItems.map((item) => ({
                    product_id: item.id,
                    qty: item.qty,
                    unit_id: item.unit_id || null,
                })),
            });
            const data = res.data;
            setShippingRates(Array.isArray(data.rates) ? data.rates : []);
            setShippingWeight(data.total_weight_grams || 0);
            if (data.rates && data.rates.length > 0) {
                setSelectedShippingRate(data.rates[0]);
            } else {
                setSelectedShippingRate(null);
            }
        } catch (err) {
            console.error("Gagal kalkulasi ongkir:", err);
            setShippingCalculationError(err.response?.data?.message || "Gagal menghitung ongkos kirim.");
            setShippingRates([]);
            setSelectedShippingRate(null);
        } finally {
            setIsCalculatingShipping(false);
        }
    };

    const handleSelectDestination = (dest) => {
        setSelectedDestination(dest);
        setDestinationQuery(dest.label);
        setShowDestinationDropdown(false);
        fetchShippingRates(dest.id, cart);
    };

    const handleClearDestination = () => {
        setSelectedDestination(null);
        setDestinationQuery("");
        setShippingRates([]);
        setSelectedShippingRate(null);
        setShippingWeight(0);
        setShippingCalculationError(null);
    };

    useEffect(() => {
        if (
            isRajaongkirActive &&
            deliveryMethod === "delivery" &&
            selectedDestination?.id &&
            cart.length > 0
        ) {
            fetchShippingRates(selectedDestination.id, cart);
        } else if (cart.length === 0) {
            setShippingRates([]);
            setSelectedShippingRate(null);
            setShippingWeight(0);
        }
    }, [cart, selectedDestination?.id, deliveryMethod, isRajaongkirActive]);

    // File Upload Handler
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!validTypes.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|pdf)$/i)) {
            setPaymentProofError("Format file harus JPG, PNG, WEBP, atau PDF.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setPaymentProofError("Ukuran file maksimal 5MB.");
            return;
        }
        setPaymentProofFile(file);
        setPaymentProofError(null);
        if (isPdf) {
            setPaymentProofPreview({ isPdf: true, name: file.name, size: file.size });
        } else {
            const reader = new FileReader();
            reader.onloadend = () => setPaymentProofPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveProof = () => {
        setPaymentProofFile(null);
        setPaymentProofPreview(null);
        setPaymentProofError(null);
    };

    const handleCopyRekening = (noRek) => {
        if (!noRek) return;
        navigator.clipboard.writeText(noRek).then(() => {
            setCopiedRekening(noRek);
            toast.success("Nomor rekening disalin!");
            setTimeout(() => setCopiedRekening(null), 2500);
        });
    };

    const handleCopyTotal = (amount) => {
        if (!amount) return;
        navigator.clipboard.writeText(String(amount)).then(() => {
            setCopiedTotal(true);
            toast.success("Total tagihan disalin!");
            setTimeout(() => setCopiedTotal(false), 2500);
        });
    };

    // Submit Order Handlers (Online & WhatsApp)
    const validateCheckout = () => {
        if (!isStoreOpen) {
            toast.error(`Toko sedang tutup (${opStatus.badge_text || "Tutup"})`);
            return false;
        }
        if (!isDeliveryAllowed && !isPickupAllowed) {
            toast.error("Layanan pemesanan (pengiriman & ambil di toko) sedang nonaktif untuk toko ini.");
            return false;
        }
        if (cart.length === 0) {
            toast.error("Keranjang belanja masih kosong!");
            return false;
        }
        if (!customerName.trim()) {
            toast.error("Mohon isi Nama Pemesan");
            return false;
        }
        if (customerName.trim().length < 2) {
            toast.error("Nama pemesan minimal 2 karakter");
            return false;
        }
        if (customerPhone.trim() && !/^(\+62|62|0)[0-9\s\-()]{7,18}$/.test(customerPhone.trim())) {
            toast.error("Nomor WhatsApp / telepon tidak valid (contoh: 081234567890)");
            return false;
        }

        const effectiveMethod = (isDeliveryAllowed && !isPickupAllowed)
            ? "delivery"
            : (!isDeliveryAllowed && isPickupAllowed)
                ? "pickup"
                : deliveryMethod;

        if (effectiveMethod === "delivery" && !isDeliveryAllowed) {
            toast.error("Layanan pengiriman ke alamat sedang nonaktif untuk toko ini.");
            return false;
        }
        if (effectiveMethod === "pickup" && !isPickupAllowed) {
            toast.error("Layanan ambil di toko sedang nonaktif untuk toko ini.");
            return false;
        }

        if (effectiveMethod === "delivery") {
            if (isRajaongkirActive && !selectedDestination) {
                toast.error("Mohon pilih kecamatan / kota tujuan pengiriman");
                return false;
            }
            if (isRajaongkirActive && !selectedShippingRate) {
                toast.error("Mohon pilih opsi kurir pengiriman");
                return false;
            }
            if (!deliveryAddress.trim()) {
                toast.error("Mohon lengkapi Alamat Pengiriman");
                return false;
            }
        }
        if (!paymentProofFile) {
            setPaymentProofError("Wajib melampirkan foto bukti transfer pembayaran");
            toast.error("Silakan unggah bukti transfer pembayaran terlebih dahulu!");
            return false;
        }
        return true;
    };

    const handleSubmitOrder = async (isWhatsApp = false) => {
        if (!validateCheckout()) return;

        const effectiveDeliveryMethod = (isDeliveryAllowed && !isPickupAllowed)
            ? "delivery"
            : (!isDeliveryAllowed && isPickupAllowed)
                ? "pickup"
                : (isDeliveryAllowed ? deliveryMethod : "pickup");
        const storeDisplayName = activeBranch
            ? `${store.name || "Toko"} (${activeBranch.name})`
            : (store.name || "Toko");

        setSubmittingOrder(true);
        const toastId = toast.loading("Memproses pesanan Anda...");

        try {
            const formData = new FormData();
            formData.append("warehouse_id", activeBranch?.id || branches[0]?.id || "");
            formData.append("customer_name", customerName.trim());
            if (customerPhone.trim()) {
                formData.append("customer_phone", customerPhone.trim());
            }
            formData.append("delivery_method", effectiveDeliveryMethod);
            if (effectiveDeliveryMethod === "delivery" && deliveryAddress.trim()) {
                formData.append("delivery_address", deliveryAddress.trim());
            }
            formData.append("shipping_cost", effectiveDeliveryMethod === "delivery" && selectedShippingRate ? (selectedShippingRate.cost || 0) : 0);
            if (effectiveDeliveryMethod === "delivery" && selectedShippingRate?.courier_code) {
                formData.append("shipping_courier", selectedShippingRate.courier_code);
            }
            if (effectiveDeliveryMethod === "delivery" && selectedShippingRate?.service) {
                formData.append("shipping_service", selectedShippingRate.service);
            }
            if (effectiveDeliveryMethod === "delivery" && selectedShippingRate?.etd) {
                formData.append("shipping_etd", selectedShippingRate.etd);
            }
            formData.append("shipping_weight", effectiveDeliveryMethod === "delivery" ? (shippingWeight || 0) : 0);
            if (effectiveDeliveryMethod === "delivery" && selectedDestination?.id) {
                formData.append("shipping_destination_id", selectedDestination.id);
            }
            if (effectiveDeliveryMethod === "delivery" && selectedDestination?.label) {
                formData.append("shipping_destination_label", selectedDestination.label);
            }
            if (orderNotes.trim()) {
                formData.append("notes", orderNotes.trim());
            }
            if (appliedCoupon?.code) {
                formData.append("coupon_code", appliedCoupon.code);
            }
            formData.append("payment_method", "bank_transfer");
            if (selectedBankId) {
                formData.append("bank_account_id", selectedBankId);
            }
            if (paymentProofFile) {
                formData.append("payment_proof", paymentProofFile);
            }
            formData.append("items", JSON.stringify(cart.map((item) => ({
                product_id: item.id,
                qty: item.qty,
                unit_id: item.unit_id || null,
            }))));

            const res = await axios.post(resolveCatalogCheckoutUrl(), formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const orderData = res.data?.order;

            toast.success("Pesanan berhasil dibuat!", { id: toastId });

            const trackingUrl = orderData?.status_url || (orderData?.access_token ? resolveCatalogStatusUrl(orderData.access_token) : "");
            const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);

            if (isWhatsApp) {
                const message = generateWhatsAppOrderMessage({
                    orderNumber: orderData?.order_number,
                    trackingUrl,
                    storeName: storeDisplayName,
                    items: cart,
                    customerName: customerName.trim(),
                    customerPhone: customerPhone.trim(),
                    deliveryMethod: effectiveDeliveryMethod,
                    deliveryAddress: effectiveDeliveryMethod === "delivery" ? deliveryAddress.trim() : "",
                    shippingCourier: effectiveDeliveryMethod === "delivery" && selectedShippingRate ? selectedShippingRate.courier_code?.toUpperCase() : "",
                    shippingService: effectiveDeliveryMethod === "delivery" && selectedShippingRate ? selectedShippingRate.service : "",
                    shippingCost: effectiveDeliveryMethod === "delivery" && selectedShippingRate ? (selectedShippingRate.cost || 0) : 0,
                    shippingEtd: effectiveDeliveryMethod === "delivery" && selectedShippingRate ? selectedShippingRate.etd : "",
                    shippingDestination: effectiveDeliveryMethod === "delivery" && selectedDestination ? selectedDestination.label : "",
                    notes: orderNotes.trim(),
                    totalAmount: cartTotal,
                    couponCode: appliedCoupon?.code || "",
                    discountAmount: discountAmount,
                    bankName: selectedBank?.bank_name || "",
                    bankAccountNumber: selectedBank?.account_number || "",
                    bankAccountName: selectedBank?.account_name || "",
                    hasPaymentProof: !!paymentProofFile,
                });

                openWhatsAppOrder({
                    phone: store.wa_number || store.phone,
                    message,
                });
            }

            // Cleanup & State Reset
            setCart([]);
            removeCoupon(true);
            setPaymentProofFile(null);
            setPaymentProofPreview(null);
            setPaymentProofError(null);
            handleClearDestination();
            saveCustomerInfo();
            try {
                localStorage.removeItem(CART_STORAGE_KEY);
            } catch (_) { }

            setIsCheckoutOpen(false);

            if (orderData?.order_number && orderData?.access_token) {
                const newRecentOrder = {
                    order_number: orderData.order_number,
                    access_token: orderData.access_token,
                    status_url: trackingUrl,
                    status: orderData.status || "submitted",
                    status_label: orderData.status_label || STATUS_CONFIG[orderData.status || "submitted"]?.label || "Menunggu Konfirmasi",
                    created_at: new Date().toISOString(),
                };
                setRecentOrders((prev) => {
                    const updated = [newRecentOrder, ...prev.filter((o) => o.order_number !== newRecentOrder.order_number)].slice(0, 5);
                    try {
                        localStorage.setItem(RECENT_ORDERS_STORAGE_KEY, JSON.stringify(updated));
                    } catch (_) { }
                    return updated;
                });
            }

            if (trackingUrl) {
                router.visit(trackingUrl);
            }
        } catch (err) {
            console.error(err);
            const errMsg =
                err.response?.data?.errors?.customer_phone?.[0] ||
                err.response?.data?.errors?.items?.[0] ||
                err.response?.data?.message ||
                "Gagal membuat pesanan.";
            toast.error(errMsg, { id: toastId, duration: 6000 });
            setSubmittingOrder(false);
        }
    };

    return (
        <PublicLayout
            active="/katalog"
            variant="storefront"
            store={store}
            cartCount={cartCount}
            onOpenCart={() => setIsCartOpen(true)}
            hideNavbar={true}
            hideFooter={true}
        >
            <Head title={`Koleksi Busana & Produk — ${store.name || "Toko Kami"}`} />

            {/* 1. Minimalist Top Navbar */}
            <CatalogNavbar
                store={store}
                activeBranch={activeBranch}
                branches={branches}
                onOpenBranchModal={() => setIsBranchModalOpen(true)}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                onClearSearch={handleClearSearch}
                cartCount={cartCount}
                onOpenCart={() => setIsCartOpen(true)}
                wishlistCount={wishlistCount}
                onOpenWishlist={() => setIsWishlistOpen(true)}
                isDeliveryAllowed={isDeliveryAllowed}
                isPickupAllowed={isPickupAllowed}
            />

            {/* 2. Main Storefront Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex-1 w-full pb-32">
                {/* Promo Banners Slider (Subtle top presence) */}
                {promoBanners && promoBanners.length > 0 && (
                    <div className="mb-6">
                        <PromoBannerCarousel
                            banners={promoBanners}
                            onSelectCategory={handleSelectCategory}
                        />
                    </div>
                )}

                {/* Secondary Static Banner */}
                {staticBanner && (
                    <div className="mb-6">
                        <StaticPromoBanner
                            banner={staticBanner}
                            onSelectCategory={handleSelectCategory}
                        />
                    </div>
                )}

                {/* Active Running Order Banner */}
                {latestActiveOrder && !dismissedActiveBanner && (
                    <CatalogOrderStatusBanner
                        latestActiveOrder={latestActiveOrder}
                        onDismiss={() => setDismissedActiveBanner(true)}
                    />
                )}

                {/* Hero Editorial Header */}
                <CatalogHero
                    title={activeCategoryTitle}
                    productCount={total}
                    isStoreOpen={isStoreOpen}
                    opStatus={opStatus}
                />

                {/* Sticky Toolbar: Filter Toggle, Sort, Grid Layout */}
                <CatalogToolbar
                    onOpenFilter={() => setIsFilterOpen(true)}
                    activeFilterCount={activeFilterCount}
                    sortBy={sortBy}
                    onSortChange={handleSortChange}
                    gridCols={gridCols}
                    onGridColsChange={(g) => setGridCols(g)}
                />

                {/* Main Content Area: Desktop Sidebar + Product Grid */}
                <div className="flex flex-col lg:flex-row gap-10 items-start">
                    {/* Desktop Filter Sidebar */}
                    <div className="hidden lg:block sticky top-[120px]">
                        <CatalogFilterDrawer
                            isDesktopSidebar={true}
                            categories={categories}
                            selectedCategoryId={activeCategory}
                            onSelectCategory={handleSelectCategory}
                            maxPrice={maxPrice}
                            priceLimit={maxPriceLimit}
                            onPriceChange={handlePriceChange}
                            availableColors={availableColors}
                            selectedColors={selectedColors}
                            onToggleColor={handleToggleColor}
                            inStockOnly={inStockOnly}
                            onToggleInStockOnly={handleToggleInStock}
                            onResetFilters={handleResetFilters}
                        />
                    </div>

                    {/* Product Grid Area */}
                    <div className="flex-1 w-full min-h-[50vh]">
                        {items.length > 0 ? (
                            <>
                                <div
                                    className={`grid gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-14 ${gridCols === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3"
                                        }`}
                                >
                                    {items.map((product) => {
                                        const inCartItems = cart.filter(
                                            (i) => i.id === product.id || (i.parent_id && i.parent_id === product.id)
                                        );
                                        const inCartQty = inCartItems.reduce((acc, i) => acc + i.qty, 0);

                                        return (
                                            <CatalogProductCard
                                                key={product.id}
                                                product={product}
                                                inCartQty={inCartQty}
                                                onSelectProduct={(p) => setSelectedProduct(p)}
                                                isWishlisted={isInWishlist(product.id)}
                                                onToggleWishlist={toggleWishlist}
                                            />
                                        );
                                    })}

                                    {/* Shimmer Skeletons when fetching next page */}
                                    {isLoadingMore && (
                                        <>
                                            <CatalogProductCardSkeleton />
                                            <CatalogProductCardSkeleton />
                                            <CatalogProductCardSkeleton />
                                        </>
                                    )}
                                </div>

                                {/* Sentinel for Infinite Scroll (Auto-trigger via IntersectionObserver) */}
                                {hasMore && !isAutoLoadThresholdReached && (
                                    <div ref={sentinelRef} className="h-6 w-full pointer-events-none" aria-hidden="true" />
                                )}

                                {/* Manual Load More Button after threshold (Page >= 4) */}
                                {hasMore && isAutoLoadThresholdReached && (
                                    <div className="mt-14 text-center">
                                        <button
                                            type="button"
                                            onClick={loadMore}
                                            disabled={isLoadingMore}
                                            className="px-8 py-3 text-xs uppercase tracking-widest font-semibold text-karima-brand dark:text-stone-200 border border-karima-brand/30 dark:border-stone-700 hover:border-karima-brand dark:hover:border-stone-400 bg-white dark:bg-slate-900 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            {isLoadingMore ? "Memuat Produk..." : "Muat Lebih Banyak Produk"}
                                        </button>
                                    </div>
                                )}

                                {/* End of Catalog Indicator */}
                                {!hasMore && items.length > 0 && (
                                    <div className="mt-16 pt-8 border-t border-karima-brand/10 dark:border-stone-800 text-center">
                                        <p className="text-xxs uppercase tracking-[0.25em] text-karima-ink/40 dark:text-stone-500 font-medium">
                                            Menampilkan seluruh {total} produk
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="py-24 text-center border-t border-karima-brand/10 dark:border-stone-800">
                                <p className="font-serif text-2xl text-karima-brand/60 dark:text-stone-400">
                                    Tidak ada produk yang cocok dengan pilihan filter Anda.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    className="mt-6 inline-block text-xxs uppercase tracking-[0.25em] font-bold text-karima-brand dark:text-stone-300 border-b border-karima-brand/40 pb-1 hover:border-karima-brand cursor-pointer"
                                >
                                    Hapus Semua Filter
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Editorial Footer (matching Home) */}
            <EditorialFooter store={store} activeBranch={activeBranch} />

            {/* 3. Mobile Filter Off-Canvas Drawer */}
            <CatalogFilterDrawer
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                categories={categories}
                selectedCategoryId={activeCategory}
                onSelectCategory={(id) => {
                    handleSelectCategory(id);
                    setIsFilterOpen(false);
                }}
                maxPrice={maxPrice}
                priceLimit={maxPriceLimit}
                onPriceChange={handlePriceChange}
                availableColors={availableColors}
                selectedColors={selectedColors}
                onToggleColor={handleToggleColor}
                inStockOnly={inStockOnly}
                onToggleInStockOnly={handleToggleInStock}
                onResetFilters={handleResetFilters}
            />

            {/* 4. Quick View & Variant Modal */}
            <CatalogQuickViewModal
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAddToCart={addToCart}
                isWishlisted={selectedProduct ? isInWishlist(selectedProduct.id) : false}
                onToggleWishlist={toggleWishlist}
                isStoreOpen={isStoreOpen}
            />

            {/* 5. Cart Slide-over Tray */}
            <CatalogCartTray
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                cart={cart}
                onUpdateQty={handleUpdateQty}
                onRemoveItem={handleRemoveItem}
                onClearCart={handleClearCart}
                onProceedToCheckout={() => setIsCheckoutOpen(true)}
                isStoreOpen={isStoreOpen}
            />

            {/* 5b. Wishlist Slide-over Tray */}
            <CatalogWishlistDrawer
                isOpen={isWishlistOpen}
                onClose={() => setIsWishlistOpen(false)}
                wishlist={wishlist}
                onRemoveItem={removeFromWishlist}
                onClearWishlist={clearWishlist}
                onAddToCart={addToCart}
                onSelectProduct={(item) => {
                    setIsWishlistOpen(false);
                    const fullProd = items.find((p) => String(p.id) === String(item.id)) || item;
                    setSelectedProduct(fullProd);
                }}
                isStoreOpen={isStoreOpen}
            />

            {/* 6. Checkout Drawer */}
            <CatalogCheckoutDrawer
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerPhone={customerPhone}
                setCustomerPhone={setCustomerPhone}
                deliveryAddress={deliveryAddress}
                setDeliveryAddress={setDeliveryAddress}
                rememberCustomer={rememberCustomer}
                onToggleRemember={handleToggleRemember}
                isAutoFilled={isAutoFilled}
                onResetCustomerInfo={handleResetCustomerInfo}
                orderNotes={orderNotes}
                setOrderNotes={setOrderNotes}
                isDeliveryAllowed={isDeliveryAllowed}
                isPickupAllowed={isPickupAllowed}
                deliveryMethod={deliveryMethod}
                setDeliveryMethod={setDeliveryMethod}
                isRajaongkirActive={isRajaongkirActive}
                destinationQuery={destinationQuery}
                setDestinationQuery={setDestinationQuery}
                destinationResults={destinationResults}
                selectedDestination={selectedDestination}
                isSearchingDestination={isSearchingDestination}
                showDestinationDropdown={showDestinationDropdown}
                setShowDestinationDropdown={setShowDestinationDropdown}
                onSelectDestination={handleSelectDestination}
                onClearDestination={handleClearDestination}
                shippingRates={shippingRates}
                selectedShippingRate={selectedShippingRate}
                setSelectedShippingRate={setSelectedShippingRate}
                isCalculatingShipping={isCalculatingShipping}
                shippingWeight={shippingWeight}
                shippingCalculationError={shippingCalculationError}
                onRetryShipping={() => fetchShippingRates(selectedDestination?.id, cart)}
                bankAccounts={bankAccounts}
                selectedBankId={selectedBankId}
                setSelectedBankId={setSelectedBankId}
                paymentProofFile={paymentProofFile}
                paymentProofPreview={paymentProofPreview}
                paymentProofError={paymentProofError}
                onFileChange={handleFileChange}
                onRemoveProof={handleRemoveProof}
                copiedRekening={copiedRekening}
                onCopyRekening={handleCopyRekening}
                copiedTotal={copiedTotal}
                onCopyTotal={handleCopyTotal}
                couponInput={couponInput}
                setCouponInput={setCouponInput}
                appliedCoupon={appliedCoupon}
                discountAmount={discountAmount}
                isCheckingCoupon={isCheckingCoupon}
                couponError={couponError}
                setCouponError={setCouponError}
                onApplyCoupon={(code) => applyCoupon(code, cartTotal, customerPhone, customerName)}
                onRemoveCoupon={() => removeCoupon(false)}
                availableCoupons={availableCoupons}
                cartTotal={cartTotal}
                shippingCost={shippingCost}
                grandTotal={grandTotal}
                submittingOrder={submittingOrder}
                onSubmitOrder={() => handleSubmitOrder(false)}
                onOrderWhatsApp={() => handleSubmitOrder(true)}
                isStoreOpen={isStoreOpen}
            />

            {/* 7. Branch Selector Modal */}
            <BranchSelectorModal
                isOpen={isBranchModalOpen}
                onClose={() => setIsBranchModalOpen(false)}
                branches={branches}
                activeBranch={activeBranch}
            />

            {/* 8. Floating Back-to-Top Button */}
            {showBackToTop && (
                <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-30 p-2.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-karima-brand dark:text-stone-200 border border-karima-brand/20 dark:border-stone-800 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                    title="Kembali ke atas"
                    aria-label="Kembali ke atas"
                >
                    <IconChevronUp size={20} />
                </button>
            )}
        </PublicLayout>
    );
}
