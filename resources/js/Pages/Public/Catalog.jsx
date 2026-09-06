import React, { useState, useEffect, useMemo } from "react";
import { Head, router } from "@inertiajs/react";
import axios from "axios";
import PublicLayout from "@/Layouts/PublicLayout";
import {
    IconSearch,
    IconShoppingCart,
    IconPlus,
    IconMinus,
    IconTrash,
    IconBrandWhatsapp,
    IconX,
    IconMapPin,
    IconPhone,
    IconBuildingStore,
    IconPackage,
    IconPhotoOff,
    IconSparkles,
    IconTruckDelivery,
    IconArrowRight,
    IconChevronDown,
    IconAlertCircle,
    IconCheck,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import PromoBannerCarousel from "@/Components/Public/PromoBannerCarousel";
import BranchSelectorModal from "@/Components/Public/BranchSelectorModal";
import StorefrontHeader from "@/Components/Public/StorefrontHeader";
import StaticPromoBanner from "@/Components/Public/StaticPromoBanner";
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
    } catch (_) {}
    return "/katalog/order";
};

const resolveCatalogStatusUrl = (token) => {
    try {
        if (typeof route === "function" && route().has("catalog.order.status")) {
            return route("catalog.order.status", token);
        }
    } catch (_) {}
    return `/katalog/order/${token}`;
};

export default function Catalog({
    categories = [],
    products = [],
    store = {},
    filters = {},
    promoBanners = [],
    staticBanner = null,
    branches = [],
    activeBranch = null,
}) {
    const [searchTerm, setSearchTerm] = useState(filters.q || "");
    const [activeCategory, setActiveCategory] = useState(filters.category_id || "all");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

    // Cart state with localStorage persistence
    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem(CART_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Customer checkout form state
    const isDeliveryAllowed = store.delivery_enabled !== false;
    const isPickupAllowed = store.pickup_enabled !== false;
    const opStatus = activeBranch?.operating_status || store.operating_status || {
        is_open: true,
        status: "open",
        label: "Buka",
        badge_text: "Buka",
        badge_color: "emerald",
    };
    const isStoreOpen = opStatus.is_open !== false;

    // Load saved customer info from localStorage for returning customers
    const [savedCustomer, setSavedCustomer] = useState(() => {
        try {
            const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    });
    const [isAutoFilled, setIsAutoFilled] = useState(() => !!savedCustomer?.name);

    const [customerName, setCustomerName] = useState(() => savedCustomer?.name || "");
    const [customerPhone, setCustomerPhone] = useState(() => savedCustomer?.phone || "");
    const [deliveryAddress, setDeliveryAddress] = useState(() => savedCustomer?.address || "");
    const [rememberCustomer, setRememberCustomer] = useState(true);

    const [deliveryMethod, setDeliveryMethod] = useState(() => {
        if (store.delivery_enabled === false) return "pickup";
        return "delivery";
    });
    const [orderNotes, setOrderNotes] = useState("");
    const [submittingOrder, setSubmittingOrder] = useState(false);

    // Recent orders stored on device
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

    // Latest active order (status not completed / cancelled)
    const latestActiveOrder = useMemo(() => {
        return (
            recentOrders.find(
                (o) => !["completed", "cancelled"].includes(o.status)
            ) || null
        );
    }, [recentOrders]);

    // Poll live status for latest active order
    useEffect(() => {
        if (!latestActiveOrder?.access_token) return;

        let isMounted = true;
        axios
            .get(`/katalog/order/${latestActiveOrder.access_token}/check`)
            .then((res) => {
                if (!isMounted) return;
                const fresh = res.data;
                if (fresh?.status && fresh.status !== latestActiveOrder.status) {
                    setRecentOrders((prev) => {
                        const updated = prev.map((o) =>
                            o.access_token === latestActiveOrder.access_token
                                ? { ...o, status: fresh.status, status_label: fresh.status_label }
                                : o
                        );
                        try {
                            localStorage.setItem(RECENT_ORDERS_STORAGE_KEY, JSON.stringify(updated));
                        } catch (_) {}
                        return updated;
                    });
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
        };
    }, [latestActiveOrder?.access_token]);

    // Detail modal quantity & selected unit (UOM)
    const [modalQty, setModalQty] = useState(1);
    const [selectedUnit, setSelectedUnit] = useState(null);

    // Persist customer info to localStorage when rememberCustomer is enabled
    useEffect(() => {
        if (rememberCustomer && customerName.trim()) {
            try {
                const info = {
                    name: customerName.trim(),
                    phone: customerPhone.trim(),
                    address: deliveryAddress.trim(),
                    updated_at: new Date().toISOString(),
                };
                localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(info));
                setSavedCustomer(info);
            } catch (_) {}
        }
    }, [customerName, customerPhone, deliveryAddress, rememberCustomer]);

    const handleToggleRemember = (checked) => {
        setRememberCustomer(checked);
        if (!checked) {
            try {
                localStorage.removeItem(CUSTOMER_STORAGE_KEY);
                setSavedCustomer(null);
                setIsAutoFilled(false);
            } catch (_) {}
        } else if (customerName.trim()) {
            try {
                const info = {
                    name: customerName.trim(),
                    phone: customerPhone.trim(),
                    address: deliveryAddress.trim(),
                    updated_at: new Date().toISOString(),
                };
                localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(info));
                setSavedCustomer(info);
            } catch (_) {}
        }
    };

    const handleResetCustomerInfo = () => {
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSavedCustomer(null);
        setIsAutoFilled(false);
        try {
            localStorage.removeItem(CUSTOMER_STORAGE_KEY);
        } catch (_) {}
        toast.success("Data pemesan dibersihkan");
    };

    // Save cart to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        } catch (e) {
            console.error("Failed to save cart to localStorage", e);
        }
    }, [cart]);

    // Reset modal unit and quantity when selecting a different product
    useEffect(() => {
        if (selectedProduct) {
            const baseU = selectedProduct.units?.find((u) => u.is_base) || selectedProduct.units?.[0] || null;
            setSelectedUnit(baseU);
            const factor = Number(baseU?.conversion_factor) || 1;
            const maxUnitStock = factor > 0 ? Math.floor(selectedProduct.stock / factor) : 0;
            setModalQty(selectedProduct.stock <= 0 || maxUnitStock <= 0 ? 0 : 1);
        } else {
            setSelectedUnit(null);
            setModalQty(1);
        }
    }, [selectedProduct]);

    const activeModalUnit = useMemo(() => {
        if (!selectedProduct) return null;
        return selectedUnit || selectedProduct.units?.find((u) => u.is_base) || selectedProduct.units?.[0] || null;
    }, [selectedProduct, selectedUnit]);

    const activeModalUnitPrice = useMemo(() => {
        if (!selectedProduct) return 0;
        return activeModalUnit?.final_price || activeModalUnit?.sell_price || selectedProduct.final_price || selectedProduct.sell_price || 0;
    }, [selectedProduct, activeModalUnit]);

    const activeModalUnitOriginalPrice = useMemo(() => {
        if (!selectedProduct) return 0;
        return activeModalUnit?.sell_price || selectedProduct.sell_price || 0;
    }, [selectedProduct, activeModalUnit]);

    const activeModalMaxQty = useMemo(() => {
        if (!selectedProduct) return 0;
        const factor = Number(activeModalUnit?.conversion_factor) || 1;
        return factor > 0 ? Math.floor(selectedProduct.stock / factor) : 0;
    }, [selectedProduct, activeModalUnit]);

    // Filter products based on search term and category
    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesCategory =
                activeCategory === "all" ||
                String(product.category_id) === String(activeCategory);

            const term = searchTerm.toLowerCase().trim();
            const matchesSearch =
                !term ||
                (product.title && product.title.toLowerCase().includes(term)) ||
                (product.description && product.description.toLowerCase().includes(term)) ||
                (product.barcode && product.barcode.toLowerCase().includes(term)) ||
                (product.sku && product.sku.toLowerCase().includes(term));

            return matchesCategory && matchesSearch;
        });
    }, [products, activeCategory, searchTerm]);

    // Cart calculations
    const cartCount = useMemo(
        () => cart.reduce((sum, item) => sum + item.qty, 0),
        [cart]
    );

    const cartTotal = useMemo(
        () =>
            cart.reduce((sum, item) => {
                const price = item.final_price || item.sell_price || 0;
                return sum + price * item.qty;
            }, 0),
        [cart]
    );

    // Cart actions
    const addToCart = (product, quantity = 1, showToast = true, unit = null) => {
        if (!isStoreOpen) {
            toast.error(`Maaf, toko sedang tutup (${opStatus.badge_text || "Tutup"})`);
            return;
        }

        const chosenUnit = unit || product.units?.find((u) => u.is_base) || product.units?.[0] || null;
        const factor = Number(chosenUnit?.conversion_factor) || 1;
        const maxUnitQty = factor > 0 ? Math.floor(product.stock / factor) : 0;

        if (maxUnitQty <= 0 || product.stock <= 0) {
            toast.error("Maaf, stok untuk kemasan ini tidak mencukupi");
            return;
        }

        const cartKey = `${product.id}_${chosenUnit?.id || "base"}`;
        const unitPrice = chosenUnit?.final_price || chosenUnit?.sell_price || product.final_price || product.sell_price;
        const unitOriginalPrice = chosenUnit?.sell_price || product.sell_price;

        setCart((prev) => {
            const existingIndex = prev.findIndex(
                (item) =>
                    (item.cart_key || item.id) === cartKey ||
                    (item.id === product.id && (item.unit_id || null) === (chosenUnit?.id || null))
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
                    id: product.id,
                    cart_key: cartKey,
                    title: product.title,
                    sell_price: unitOriginalPrice,
                    final_price: unitPrice,
                    image: product.image,
                    category_name: product.category_name,
                    stock: product.stock,
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
            const unitLabel = chosenUnit?.name ? ` (${chosenUnit.name})` : "";
            toast.success(`${product.title}${unitLabel} ditambahkan`, {
                icon: "🛒",
                duration: 1500,
            });
        }
    };

    const updateCartQty = (itemOrKey, newQty) => {
        const cartKey = typeof itemOrKey === "object" ? (itemOrKey.cart_key || itemOrKey.id) : itemOrKey;

        if (newQty <= 0) {
            removeFromCart(cartKey);
            return;
        }

        const currentItem = cart.find((i) => (i.cart_key || i.id) === cartKey || i.id === cartKey);
        if (!isStoreOpen && currentItem && newQty > currentItem.qty) {
            toast.error(`Toko sedang tutup. Tidak dapat menambah jumlah item.`);
            return;
        }

        setCart((prev) =>
            prev.map((item) => {
                if ((item.cart_key || item.id) === cartKey || item.id === cartKey) {
                    const factor = Number(item.conversion_factor) || 1;
                    const maxStock = item.max_unit_stock || (factor > 0 ? Math.floor(item.stock / factor) : item.stock);
                    const finalQty = Math.min(maxStock, newQty);
                    return { ...item, qty: finalQty };
                }
                return item;
            })
        );
    };

    const removeFromCart = (itemOrKey) => {
        const cartKey = typeof itemOrKey === "object" ? (itemOrKey.cart_key || itemOrKey.id) : itemOrKey;
        setCart((prev) => prev.filter((item) => (item.cart_key || item.id) !== cartKey && item.id !== cartKey));
        toast("Item dihapus dari keranjang", { icon: "🗑️" });
    };

    const clearCart = () => {
        if (window.confirm("Kosongkan semua item di keranjang?")) {
            setCart([]);
            toast("Keranjang telah dikosongkan");
        }
    };

    // Select branch handler
    const handleSelectBranch = (branch) => {
        setIsBranchModalOpen(false);
        if (activeBranch && String(activeBranch.id) === String(branch.id)) {
            return;
        }

        router.get(
            route("catalog.index"),
            {
                ...filters,
                cabang: branch.code,
            },
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`Cabang aktif: ${branch.name}`);
                },
            }
        );
    };

    // WhatsApp Checkout handler
    const handleWhatsAppCheckout = async () => {
        if (!isStoreOpen) {
            toast.error(`Toko sedang tutup (${opStatus.badge_text || "Tutup"}). Pemesanan belum dapat diproses.`);
            return;
        }

        if (cart.length === 0) {
            toast.error("Keranjang belanja masih kosong!");
            return;
        }

        if (!customerName.trim()) {
            toast.error("Mohon isi Nama Pemesan terlebih dahulu");
            return;
        }

        if (isDeliveryAllowed && deliveryMethod === "delivery" && !deliveryAddress.trim()) {
            toast.error("Mohon lengkapi Alamat Pengiriman");
            return;
        }

        const effectiveDeliveryMethod = isDeliveryAllowed ? deliveryMethod : "pickup";
        const storeDisplayName = activeBranch
            ? `${store.name || "Toko"} (${activeBranch.name})`
            : (store.name || "Toko");

        setSubmittingOrder(true);
        const toastId = toast.loading("Memproses pesanan Anda...");

        try {
            const payload = {
                warehouse_id: activeBranch?.id || branches[0]?.id,
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim() || null,
                delivery_method: effectiveDeliveryMethod,
                delivery_address: effectiveDeliveryMethod === "delivery" ? deliveryAddress.trim() : null,
                notes: orderNotes.trim() || null,
                items: cart.map((item) => ({
                    product_id: item.id,
                    qty: item.qty,
                    unit_id: item.unit_id || null,
                })),
            };

            const res = await axios.post(resolveCatalogCheckoutUrl(), payload);
            const orderData = res.data?.order;

            toast.success("Pesanan berhasil dibuat!", { id: toastId });

            const trackingUrl = orderData?.status_url || (orderData?.access_token ? resolveCatalogStatusUrl(orderData.access_token) : "");

            const message = generateWhatsAppOrderMessage({
                orderNumber: orderData?.order_number,
                trackingUrl,
                storeName: storeDisplayName,
                items: cart,
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                deliveryMethod: effectiveDeliveryMethod,
                deliveryAddress: effectiveDeliveryMethod === "delivery" ? deliveryAddress.trim() : "",
                notes: orderNotes.trim(),
                totalAmount: cartTotal,
            });

            openWhatsAppOrder({
                phone: store.wa_number || store.phone,
                message,
            });

            setCart([]);
            try {
                localStorage.removeItem(CART_STORAGE_KEY);
            } catch (_) {}

            setIsCartOpen(false);

            if (rememberCustomer && customerName.trim()) {
                try {
                    const info = {
                        name: customerName.trim(),
                        phone: customerPhone.trim(),
                        address: deliveryAddress.trim(),
                        updated_at: new Date().toISOString(),
                    };
                    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(info));
                    setSavedCustomer(info);
                } catch (_) {}
            }

            if (orderData?.order_number && orderData?.access_token) {
                const newRecentOrder = {
                    order_number: orderData.order_number,
                    access_token: orderData.access_token,
                    status_url: trackingUrl,
                    status: orderData.status || "submitted",
                    status_label: "Menunggu Konfirmasi",
                    created_at: new Date().toISOString(),
                };
                setRecentOrders((prev) => {
                    const updated = [newRecentOrder, ...prev.filter((o) => o.order_number !== newRecentOrder.order_number)].slice(0, 5);
                    try {
                        localStorage.setItem(RECENT_ORDERS_STORAGE_KEY, JSON.stringify(updated));
                    } catch (_) {}
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
                "Gagal membuat pesanan. Silakan periksa kembali keranjang Anda.";
            toast.error(errMsg, { id: toastId, duration: 6000 });
            setSubmittingOrder(false);
        }
    };

    // Instant buy from modal
    const handleInstantBuy = async (product, qty, unit = null) => {
        if (!isStoreOpen) {
            toast.error(`Maaf, toko sedang tutup (${opStatus.badge_text || "Tutup"})`);
            return;
        }

        const chosenUnit = unit || product.units?.find((u) => u.is_base) || product.units?.[0] || null;
        const unitPrice = chosenUnit?.final_price || chosenUnit?.sell_price || product.final_price || product.sell_price;
        const unitOriginalPrice = chosenUnit?.sell_price || product.sell_price;

        if (!customerName.trim()) {
            addToCart(product, qty, false, chosenUnit);
            setSelectedProduct(null);
            setIsCartOpen(true);
            toast("Silakan lengkapi data pemesan di keranjang", { icon: "📝" });
            return;
        }

        const effectiveDeliveryMethod = isDeliveryAllowed ? deliveryMethod : "pickup";
        if (effectiveDeliveryMethod === "delivery" && !deliveryAddress.trim()) {
            addToCart(product, qty, false, chosenUnit);
            setSelectedProduct(null);
            setIsCartOpen(true);
            toast("Silakan lengkapi alamat pengiriman di keranjang", { icon: "📝" });
            return;
        }

        const storeDisplayName = activeBranch
            ? `${store.name || "Toko"} (${activeBranch.name})`
            : (store.name || "Toko");

        setSubmittingOrder(true);
        const toastId = toast.loading("Memproses pesanan langsung...");

        try {
            const payload = {
                warehouse_id: activeBranch?.id || branches[0]?.id,
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim() || null,
                delivery_method: effectiveDeliveryMethod,
                delivery_address: effectiveDeliveryMethod === "delivery" ? deliveryAddress.trim() : null,
                notes: orderNotes.trim() || null,
                items: [
                    {
                        product_id: product.id,
                        qty,
                        unit_id: chosenUnit?.id || null,
                    },
                ],
            };

            const res = await axios.post(resolveCatalogCheckoutUrl(), payload);
            const orderData = res.data?.order;

            toast.success("Pesanan berhasil dibuat!", { id: toastId });

            const trackingUrl = orderData?.status_url || (orderData?.access_token ? resolveCatalogStatusUrl(orderData.access_token) : "");

            const message = generateWhatsAppOrderMessage({
                orderNumber: orderData?.order_number,
                trackingUrl,
                storeName: storeDisplayName,
                items: [
                    {
                        id: product.id,
                        title: product.title,
                        sell_price: unitOriginalPrice,
                        final_price: unitPrice,
                        unit_name: chosenUnit?.name || chosenUnit?.code || "Pcs",
                        unit_symbol: chosenUnit?.symbol || "pcs",
                        qty,
                    },
                ],
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                deliveryMethod: effectiveDeliveryMethod,
                deliveryAddress: effectiveDeliveryMethod === "delivery" ? deliveryAddress.trim() : "",
                notes: orderNotes.trim(),
                totalAmount: unitPrice * qty,
            });

            openWhatsAppOrder({
                phone: store.wa_number || store.phone,
                message,
            });

            setSelectedProduct(null);

            if (orderData?.order_number && orderData?.access_token) {
                const newRecentOrder = {
                    order_number: orderData.order_number,
                    access_token: orderData.access_token,
                    status_url: trackingUrl,
                    status: orderData.status || "submitted",
                    status_label: "Menunggu Konfirmasi",
                    created_at: new Date().toISOString(),
                };
                setRecentOrders((prev) => {
                    const updated = [newRecentOrder, ...prev.filter((o) => o.order_number !== newRecentOrder.order_number)].slice(0, 5);
                    try {
                        localStorage.setItem(RECENT_ORDERS_STORAGE_KEY, JSON.stringify(updated));
                    } catch (_) {}
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
        >
            <Head title={`Katalog Toko Online — ${store.name || "Toko Kami"}`} />

            {/* ============ UNIFIED PROFESSIONAL STOREFRONT HEADER ============ */}
            <StorefrontHeader
                store={store}
                activeBranch={activeBranch}
                branches={branches}
                onOpenBranchModal={() => setIsBranchModalOpen(true)}
                searchTerm={searchTerm}
                onSearchChange={(val) => setSearchTerm(val)}
                onClearSearch={() => setSearchTerm("")}
                cartCount={cartCount}
                onOpenCart={() => setIsCartOpen(true)}
                isDeliveryAllowed={isDeliveryAllowed}
            />

            {/* ============ MAIN PRODUCTS SECTION ============ */}
            <main id="katalog-products" className="max-w-7xl mx-auto px-3.5 sm:px-6 py-3 sm:py-6 flex-1 w-full pb-36 sm:pb-28">
                {/* Promo Banners Slider */}
                <PromoBannerCarousel
                    banners={promoBanners}
                    onSelectCategory={(catId) => setActiveCategory(catId)}
                />

                {/* Static Secondary Promo Banner (Alfagift Style - below slider) */}
                {staticBanner && (
                    <StaticPromoBanner
                        banner={staticBanner}
                        onSelectCategory={(catId) => setActiveCategory(catId)}
                    />
                )}

                {/* Store Closure Notice Banner */}
                {!isStoreOpen && (
                    <div className="mb-4 p-3 sm:p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                                <IconAlertCircle size={18} />
                            </span>
                            <div className="min-w-0">
                                <p className="font-bold truncate">
                                    Toko Sedang Tutup ({opStatus.badge_text || "Tutup"})
                                </p>
                                <p className="text-[11px] text-amber-700 dark:text-amber-300/90 truncate">
                                    {opStatus.schedule_info || "Pemesanan ke keranjang dinonaktifkan sementara. Anda tetap dapat menjelajahi katalog produk."}
                                </p>
                            </div>
                        </div>
                        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[11px] font-bold shrink-0">
                            Hanya Lihat Katalog
                        </span>
                    </div>
                )}

                {/* Active Pending Order Banner */}
                {latestActiveOrder && !dismissedActiveBanner && (
                    <div className="mb-4 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-sky-950/40 border border-emerald-200/90 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <IconPackage size={18} />
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                        Pesanan Berjalan:
                                    </span>
                                    <span className="font-extrabold text-primary-700 dark:text-primary-300">
                                        {latestActiveOrder.order_number}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50">
                                        {latestActiveOrder.status_label || "Menunggu Konfirmasi"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    Pesanan Anda sedang dalam proses toko. Anda dapat memantau status secara live.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <a
                                href={latestActiveOrder.status_url || `/katalog/order/${latestActiveOrder.access_token}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white transition shadow-xs"
                            >
                                Pantau Status
                                <IconArrowRight size={13} />
                            </a>
                            <button
                                type="button"
                                onClick={() => setDismissedActiveBanner(true)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                                title="Sembunyikan"
                            >
                                <IconX size={15} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Category Chips (Horizontal Scroll) */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 mb-3 sm:mb-4 scrollbar-hide -mx-1 px-1">
                    <button
                        type="button"
                        onClick={() => setActiveCategory("all")}
                        className={`px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                            activeCategory === "all"
                                ? "bg-primary-600 text-white shadow-xs"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                    >
                        <span>Semua Kategori</span>
                        <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                activeCategory === "all"
                                    ? "bg-primary-700 text-primary-100"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            }`}
                        >
                            {products.length}
                        </span>
                    </button>

                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                                String(activeCategory) === String(cat.id)
                                    ? "bg-primary-600 text-white shadow-xs"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                        >
                            <span>{cat.name}</span>
                            {cat.products_count !== undefined && (
                                <span
                                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                        String(activeCategory) === String(cat.id)
                                            ? "bg-primary-700 text-primary-100"
                                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                                    }`}
                                >
                                    {cat.products_count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Result header */}
                <div className="flex items-center justify-between mb-3 sm:mb-6">
                    <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                        Menampilkan{" "}
                        <span className="font-bold text-slate-900 dark:text-white">
                            {filteredProducts.length}
                        </span>{" "}
                        produk
                        {searchTerm && (
                            <span>
                                {" "}
                                untuk "
                                <span className="text-primary-600 font-semibold">{searchTerm}</span>"
                            </span>
                        )}
                    </p>
                </div>

                {/* Product Grid (2-column on mobile with optimized spacing) */}
                {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-5">
                        {filteredProducts.map((product) => {
                            const inCartItems = cart.filter((item) => item.id === product.id);
                            const inCartQty = inCartItems.reduce((acc, item) => acc + item.qty, 0);
                            const inCart = inCartItems[0];
                            const price = product.final_price || product.sell_price;
                            const isSoldOut = product.stock <= 0;
                            const hasMultiUnits = Array.isArray(product.units) && product.units.length > 1;
                            const baseUnit = product.units?.find((u) => u.is_base) || product.units?.[0];

                            return (
                                <div
                                    key={product.id}
                                    className="group bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative"
                                >
                                    {/* Product Image & Badges */}
                                    <div
                                        onClick={() => setSelectedProduct(product)}
                                        className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800 cursor-pointer overflow-hidden flex items-center justify-center"
                                    >
                                        {product.image ? (
                                            <img
                                                src={product.image}
                                                alt={product.title}
                                                className={`w-full h-full object-cover transition-all duration-300 ${
                                                    isSoldOut
                                                        ? "opacity-45 grayscale contrast-75 brightness-90 group-hover:scale-100"
                                                        : "group-hover:scale-105"
                                                }`}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className={`flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 ${isSoldOut ? "opacity-40" : ""}`}>
                                                <IconPhotoOff size={32} />
                                                <span className="text-[10px] mt-1">No Image</span>
                                            </div>
                                        )}

                                        {/* Promo Badge */}
                                        {product.has_discount && !isSoldOut && (
                                            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 py-0.5 rounded-md bg-rose-500 text-white font-bold text-[10px] sm:text-[11px] shadow-xs flex items-center gap-0.5">
                                                <IconSparkles size={11} />
                                                <span>-{product.discount_percentage}%</span>
                                            </div>
                                        )}

                                        {/* Sold Out Overlay Badge or Stock indicator badge */}
                                        {isSoldOut ? (
                                            <div className="absolute inset-0 bg-slate-900/30 dark:bg-slate-950/50 flex items-center justify-center pointer-events-none p-2">
                                                <span className="px-3 py-1 sm:py-1.5 rounded-full bg-slate-900/90 dark:bg-black/90 text-white font-bold text-[10px] sm:text-xs tracking-wider uppercase shadow-md border border-white/20">
                                                    Sold Out
                                                </span>
                                            </div>
                                        ) : product.stock <= 5 && product.stock > 0 ? (
                                            <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 px-1.5 py-0.5 rounded-md bg-amber-500/90 text-white font-semibold text-[9px] sm:text-[10px] backdrop-blur-xs">
                                                Sisa {product.stock}
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Product Details */}
                                    <div className="p-2 sm:p-3.5 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                {product.category_name && (
                                                    <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block truncate">
                                                        {product.category_name}
                                                    </span>
                                                )}
                                                {hasMultiUnits && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/40 shrink-0">
                                                        {product.units.length} Satuan
                                                    </span>
                                                )}
                                            </div>

                                            <h3
                                                onClick={() => setSelectedProduct(product)}
                                                className={`text-xs sm:text-sm font-bold line-clamp-2 min-h-[30px] sm:min-h-[40px] leading-snug cursor-pointer transition-colors ${
                                                    isSoldOut
                                                        ? "text-slate-500 dark:text-slate-400"
                                                        : "text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                                                }`}
                                                title={product.title}
                                            >
                                                {product.title}
                                            </h3>

                                            {product.description && (
                                                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                                    {product.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Price & Action Row (Anti-overflow on mobile) */}
                                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1">
                                            <div className="min-w-0 flex-1 pr-1">
                                                {product.has_discount && !isSoldOut && (
                                                    <span className="text-[10px] text-slate-400 line-through block truncate">
                                                        {formatRupiah(product.sell_price)}
                                                    </span>
                                                )}
                                                <div className="flex items-baseline gap-1 truncate">
                                                    <span className={`text-xs sm:text-sm md:text-base font-extrabold block truncate ${
                                                        isSoldOut ? "text-slate-500 dark:text-slate-400" : "text-primary-600 dark:text-primary-400"
                                                    }`}>
                                                        {formatRupiah(price)}
                                                    </span>
                                                    {baseUnit?.name && (
                                                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                                            /{baseUnit.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Add to Cart / Multi-Unit / Stepper Button */}
                                            {isSoldOut ? (
                                                <span
                                                    className="px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-[10px] sm:text-xs border border-slate-200/80 dark:border-slate-700 cursor-not-allowed select-none shrink-0"
                                                    title="Stok Habis (Sold Out)"
                                                >
                                                    Habis
                                                </span>
                                            ) : hasMultiUnits ? (
                                                inCartQty > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedProduct(product);
                                                        }}
                                                        className="flex items-center gap-1 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 text-primary-700 dark:text-primary-300 rounded-lg px-2 py-1 border border-primary-200 dark:border-primary-800 text-[11px] font-bold shrink-0 transition"
                                                        title="Lihat / pilih satuan produk"
                                                    >
                                                        <span>{inCartQty}</span>
                                                        <span className="text-[10px] font-medium opacity-80">di Keranjang</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={!isStoreOpen}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedProduct(product);
                                                        }}
                                                        className={`px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0 shadow-xs transition-all ${
                                                            !isStoreOpen
                                                                ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                                                                : "bg-primary-600 hover:bg-primary-700 active:scale-95 text-white cursor-pointer"
                                                        }`}
                                                        title={
                                                            !isStoreOpen
                                                                ? `Toko Sedang Tutup (${opStatus.badge_text || "Tutup"})`
                                                                : "Pilih Satuan / Kemasan"
                                                        }
                                                    >
                                                        <IconPackage size={13} />
                                                        <span>Pilih</span>
                                                    </button>
                                                )
                                            ) : inCart ? (
                                                <div className="flex items-center bg-primary-50 dark:bg-primary-950/50 rounded-lg p-0.5 border border-primary-200 dark:border-primary-800 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateCartQty(inCart, inCart.qty - 1);
                                                        }}
                                                        className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs"
                                                    >
                                                        <IconMinus size={11} />
                                                    </button>
                                                    <span className="text-[11px] sm:text-xs font-bold text-primary-700 dark:text-primary-300 px-1 min-w-[16px] text-center">
                                                        {inCart.qty}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateCartQty(inCart, inCart.qty + 1);
                                                        }}
                                                        disabled={!isStoreOpen || inCart.qty >= product.stock}
                                                        className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-primary-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                                                        title={!isStoreOpen ? "Toko sedang tutup" : inCart.qty >= product.stock ? "Stok maksimal" : "Tambah"}
                                                    >
                                                        <IconPlus size={11} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={!isStoreOpen}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        addToCart(product, 1);
                                                    }}
                                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all ${
                                                        !isStoreOpen
                                                            ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                                                            : "bg-primary-600 hover:bg-primary-700 active:scale-90 text-white cursor-pointer"
                                                    }`}
                                                    title={
                                                        !isStoreOpen
                                                            ? `Toko Sedang Tutup (${opStatus.badge_text || "Tutup"})`
                                                            : "Tambah ke keranjang"
                                                    }
                                                >
                                                    <IconPlus size={16} strokeWidth={2.5} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Empty State */
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                            <IconPackage size={26} />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            Produk Tidak Ditemukan
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Silakan coba kata kunci lain atau pilih kategori Semua.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm("");
                                setActiveCategory("all");
                            }}
                            className="mt-4 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition"
                        >
                            Reset Pencarian
                        </button>
                    </div>
                )}
            </main>

            {/* ============ FLOATING CART BAR (OPTIMIZED MOBILE & DESKTOP) ============ */}
            {cart.length > 0 && (
                <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-xs z-40 animate-fade-in">
                    <button
                        type="button"
                        onClick={() => setIsCartOpen(true)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5 sm:py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xl shadow-emerald-950/20 active:scale-[0.98] transition-all"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                    <IconShoppingCart size={18} />
                                </div>
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                                    {cartCount}
                                </span>
                            </div>
                            <div className="text-left min-w-0">
                                <div className="text-[10px] font-normal text-emerald-100 leading-tight">
                                    {cartCount} item dipilih
                                </div>
                                <div className="text-xs sm:text-sm font-extrabold truncate">
                                    {formatRupiah(cartTotal)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 pl-3 border-l border-emerald-500/80 text-xs font-bold text-emerald-50 shrink-0">
                            <span>Keranjang</span>
                            <IconArrowRight size={15} />
                        </div>
                    </button>
                </div>
            )}

            {/* ============ CART DRAWER / BOTTOM SHEET ============ */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                        onClick={() => setIsCartOpen(false)}
                    />

                    {/* Bottom Sheet on Mobile, Slide-over on Desktop */}
                    <div className="fixed inset-x-0 bottom-0 max-h-[92vh] sm:max-h-full sm:inset-y-0 sm:right-0 sm:left-auto sm:w-screen sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col justify-between z-10 transition-all">
                        {/* Mobile Pull Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

                        {/* Drawer Header */}
                        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <IconShoppingCart size={16} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                                        Keranjang Belanja
                                    </h2>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {cartCount} item dipilih
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {cart.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearCart}
                                        className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    >
                                        Kosongkan
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsCartOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Drawer Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 sm:py-4 space-y-4">
                            {/* Operational Status Notice */}
                            {!isStoreOpen && (
                                <div
                                    className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                                        opStatus.status === "temporarily_closed"
                                            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200"
                                            : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200"
                                    }`}
                                >
                                    <IconAlertCircle
                                        size={18}
                                        className={`shrink-0 mt-0.5 ${
                                            opStatus.status === "temporarily_closed"
                                                ? "text-rose-600 dark:text-rose-400"
                                                : "text-amber-600 dark:text-amber-400"
                                        }`}
                                    />
                                    <div className="space-y-0.5 flex-1">
                                        <span className="font-bold block">
                                            {opStatus.status === "temporarily_closed"
                                                ? "Toko Sedang Tutup Sementara"
                                                : `Toko Sedang Tutup (${opStatus.badge_text})`}
                                        </span>
                                        <p className="text-[11px] leading-relaxed opacity-90">
                                            {opStatus.status === "temporarily_closed"
                                                ? `${opStatus.closure_reason || "Sedang libur operasional"}.${
                                                      opStatus.reopen_date_formatted
                                                          ? ` Buka kembali: ${opStatus.reopen_date_formatted}.`
                                                          : ""
                                                  } Pemesanan belanja ditutup sementara.`
                                                : "Pemesanan belum dapat diproses saat ini. Silakan kembali saat jam operasional toko dibuka."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Item List */}
                            {cart.length > 0 ? (
                                <div className="space-y-2.5">
                                    {cart.map((item) => {
                                        const price = item.final_price || item.sell_price || 0;
                                        const subtotal = price * item.qty;
                                        const maxStock = item.max_unit_stock || (item.conversion_factor ? Math.floor(item.stock / item.conversion_factor) : item.stock);

                                        return (
                                            <div
                                                key={item.cart_key || item.id}
                                                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800"
                                            >
                                                {item.image ? (
                                                    <img
                                                        src={item.image}
                                                        alt={item.title}
                                                        className="w-12 h-12 rounded-lg object-cover bg-white dark:bg-slate-700 shrink-0 border border-slate-200 dark:border-slate-700"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                                        <IconPackage size={18} />
                                                    </div>
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                                        {item.title}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                                                            {formatRupiah(price)}
                                                        </span>
                                                        {item.unit_name && (
                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200/60 dark:border-primary-800/60">
                                                                {item.unit_name}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Stepper */}
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCartQty(item, item.qty - 1)}
                                                                className="w-5 h-5 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                                                            >
                                                                <IconMinus size={11} />
                                                            </button>
                                                            <span className="text-xs font-bold text-slate-900 dark:text-white px-2">
                                                                {item.qty}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCartQty(item, item.qty + 1)}
                                                                disabled={!isStoreOpen || item.qty >= maxStock}
                                                                className="w-5 h-5 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                                                title={!isStoreOpen ? "Toko sedang tutup" : item.qty >= maxStock ? "Stok maksimal" : undefined}
                                                            >
                                                                <IconPlus size={11} />
                                                            </button>
                                                        </div>

                                                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                            {formatRupiah(subtotal)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => removeFromCart(item)}
                                                    className="text-slate-400 hover:text-rose-500 p-1"
                                                    title="Hapus"
                                                >
                                                    <IconTrash size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-400">
                                    <IconShoppingCart size={36} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-xs">Keranjang masih kosong.</p>
                                </div>
                            )}

                            {/* Customer Form */}
                            {cart.length > 0 && (
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                                    {/* Notice if user already has an active order */}
                                    {latestActiveOrder && (
                                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                            <IconAlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                                            <div>
                                                <span className="font-bold">Perhatian:</span> Anda memiliki pesanan aktif sebelumnya (
                                                <span className="font-bold">{latestActiveOrder.order_number}</span>). Pesanan baru ini akan diproses sebagai pesanan terpisah.
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            Data Pemesan
                                        </h3>
                                        {isAutoFilled && customerName && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40">
                                                <IconCheck size={12} />
                                                Tersimpan
                                            </span>
                                        )}
                                    </div>

                                    {/* Auto-fill notification if data was restored from localStorage */}
                                    {isAutoFilled && customerName && (
                                        <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50">
                                            <span className="flex items-center gap-1.5 font-medium">
                                                <IconCheck size={14} className="text-emerald-600 shrink-0" />
                                                Data terisi otomatis dari pesanan sebelumnya
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleResetCustomerInfo}
                                                className="text-slate-400 hover:text-rose-600 text-[10px] font-semibold underline shrink-0 ml-2"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Nama Lengkap <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            placeholder="Nama Anda"
                                            className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Nomor WhatsApp / HP
                                        </label>
                                        <input
                                            type="tel"
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            placeholder="0812xxxxxxx"
                                            className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    {/* Delivery Method Option */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Metode Pengambilan
                                        </label>
                                        {isDeliveryAllowed ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setDeliveryMethod("delivery")}
                                                    className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                                                        deliveryMethod === "delivery"
                                                            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                                                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                    }`}
                                                >
                                                    <IconTruckDelivery size={15} />
                                                    Kirim ke Alamat
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeliveryMethod("pickup")}
                                                    className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                                                        deliveryMethod === "pickup"
                                                            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                                                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                    }`}
                                                >
                                                    <IconBuildingStore size={15} />
                                                    Ambil di Toko
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                                                <IconBuildingStore size={17} className="shrink-0 text-amber-600" />
                                                <div>
                                                    <span className="font-bold">Khusus Ambil di Toko</span>
                                                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                                                        Layanan pengantaran kurir saat ini tidak tersedia untuk toko ini.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Delivery Address Field (Only shown when delivery is active and selected) */}
                                    {isDeliveryAllowed && deliveryMethod === "delivery" && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                Alamat Pengiriman <span className="text-rose-500">*</span>
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={deliveryAddress}
                                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                                placeholder="Nama jalan, nomor rumah, kelurahan, patokan..."
                                                className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-white"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Catatan (Opsional)
                                        </label>
                                        <input
                                            type="text"
                                            value={orderNotes}
                                            onChange={(e) => setOrderNotes(e.target.value)}
                                            placeholder="Contoh: Packing yang aman ya"
                                            className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    {/* Remember Customer Info Option */}
                                    <label className="flex items-center gap-2 cursor-pointer pt-1 select-none">
                                        <input
                                            type="checkbox"
                                            checked={rememberCustomer}
                                            onChange={(e) => handleToggleRemember(e.target.checked)}
                                            className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
                                        />
                                        <span className="text-xs text-slate-600 dark:text-slate-400">
                                            Ingat data saya di perangkat ini untuk pesanan berikutnya
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer Checkout Button */}
                        {cart.length > 0 && (
                            <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shrink-0">
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        Total Tagihan:
                                    </span>
                                    <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                                        {formatRupiah(cartTotal)}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    disabled={!isStoreOpen || submittingOrder}
                                    onClick={handleWhatsAppCheckout}
                                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                                        !isStoreOpen || submittingOrder
                                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                                            : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-md shadow-emerald-600/25 cursor-pointer"
                                    }`}
                                >
                                    {submittingOrder ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Memproses Pesanan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <IconBrandWhatsapp size={18} />
                                            {!isStoreOpen ? "Toko Tutup — Belum Dapat Memesan" : "Kirim Pesanan via WhatsApp"}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============ PRODUCT DETAIL MODAL / BOTTOM SHEET ============ */}
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                        onClick={() => setSelectedProduct(null)}
                    />

                    <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 max-h-[88vh] overflow-y-auto">
                        {/* Mobile Pull Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-3 sm:hidden" />

                        <button
                            type="button"
                            onClick={() => setSelectedProduct(null)}
                            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition z-20"
                        >
                            <IconX size={18} />
                        </button>

                        <div className="aspect-square sm:aspect-[4/3] max-h-[320px] sm:max-h-[380px] w-full rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3 sm:mb-4 flex items-center justify-center border border-slate-200/80 dark:border-slate-700 relative">
                            {selectedProduct.image ? (
                                <img
                                    src={selectedProduct.image}
                                    alt={selectedProduct.title}
                                    className={`w-full h-full object-cover object-center ${
                                        selectedProduct.stock <= 0
                                            ? "opacity-45 grayscale contrast-75 brightness-90"
                                            : ""
                                    }`}
                                />
                            ) : (
                                <div className={`flex flex-col items-center text-slate-400 ${selectedProduct.stock <= 0 ? "opacity-40" : ""}`}>
                                    <IconPhotoOff size={40} />
                                    <span className="text-xs mt-1">Foto Belum Tersedia</span>
                                </div>
                            )}

                            {/* Sold Out Overlay Badge in Modal */}
                            {selectedProduct.stock <= 0 && (
                                <div className="absolute inset-0 bg-slate-900/30 dark:bg-slate-950/50 flex items-center justify-center pointer-events-none p-4">
                                    <span className="px-4 py-2 rounded-full bg-slate-900/90 dark:bg-black/90 text-white font-bold text-xs sm:text-sm tracking-wider uppercase shadow-md border border-white/20">
                                        Sold Out · Stok Habis
                                    </span>
                                </div>
                            )}
                        </div>

                        {selectedProduct.category_name && (
                            <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                                {selectedProduct.category_name}
                            </span>
                        )}

                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                            {selectedProduct.title}
                        </h2>

                        {/* Price & Stock info */}
                        <div className="flex items-center gap-2.5 my-2">
                            <span className={`text-lg sm:text-xl font-extrabold ${
                                selectedProduct.stock <= 0 ? "text-slate-500 dark:text-slate-400" : "text-primary-600 dark:text-primary-400"
                            }`}>
                                {formatRupiah(activeModalUnitPrice)}
                            </span>
                            {activeModalUnitOriginalPrice > activeModalUnitPrice && (
                                <>
                                    <span className="text-xs text-slate-400 line-through">
                                        {formatRupiah(activeModalUnitOriginalPrice)}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                                        -{Math.round(((activeModalUnitOriginalPrice - activeModalUnitPrice) / activeModalUnitOriginalPrice) * 100)}%
                                    </span>
                                </>
                            )}
                            {activeModalUnit && (
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    / {activeModalUnit.name || activeModalUnit.code}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 py-1.5 border-y border-slate-100 dark:border-slate-800">
                            <span>
                                Stok:{" "}
                                {selectedProduct.stock <= 0 || activeModalMaxQty <= 0 ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
                                        {selectedProduct.stock <= 0 ? "Stok Habis (0 unit)" : "Stok Tidak Cukup untuk Satuan Ini"}
                                    </span>
                                ) : (
                                    <strong className="text-slate-800 dark:text-slate-200">
                                        {activeModalMaxQty} {activeModalUnit?.name || activeModalUnit?.code || "unit"}{" "}
                                        {activeModalUnit && !activeModalUnit.is_base && (
                                            <span className="font-normal text-slate-400">
                                                (Total {selectedProduct.stock} unit dasar)
                                            </span>
                                        )}
                                    </strong>
                                )}
                            </span>
                            {selectedProduct.sku && (
                                <span>
                                    SKU:{" "}
                                    <strong className="text-slate-800 dark:text-slate-200">
                                        {selectedProduct.sku}
                                    </strong>
                                </span>
                            )}
                        </div>

                        {/* UOM Selector Pills */}
                        {selectedProduct.units && selectedProduct.units.length > 1 && (
                            <div className="my-3">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
                                    Pilih Satuan / Kemasan:
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {selectedProduct.units.map((u) => {
                                        const isSelected = (activeModalUnit?.id || null) === (u.id || null);
                                        const factor = Number(u.conversion_factor) || 1;
                                        const maxAvail = factor > 0 ? Math.floor(selectedProduct.stock / factor) : 0;
                                        const isAvail = maxAvail > 0;
                                        return (
                                            <button
                                                key={u.id || "base"}
                                                type="button"
                                                disabled={!isAvail}
                                                onClick={() => {
                                                    setSelectedUnit(u);
                                                    setModalQty(1);
                                                }}
                                                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                                    isSelected
                                                        ? "border-primary-600 bg-primary-50/70 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100 ring-1 ring-primary-500 shadow-xs"
                                                        : isAvail
                                                        ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200 cursor-pointer"
                                                        : "border-slate-200/50 dark:border-slate-800/50 bg-slate-100/50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-xs capitalize">
                                                        {u.name || u.code}
                                                    </span>
                                                    {u.is_base ? (
                                                        <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold">
                                                            Utama
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] text-slate-400">
                                                            isi {factor}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] font-black text-primary-600 dark:text-primary-400">
                                                    {formatRupiah(u.final_price || u.sell_price)}
                                                </div>
                                                {!isAvail && (
                                                    <span className="text-[9px] text-rose-500 mt-0.5 font-medium">
                                                        Stok kurang
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {selectedProduct.description && (
                            <div className="my-3">
                                <h4 className="text-[11px] font-bold uppercase text-slate-400 mb-0.5">
                                    Deskripsi:
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                    {selectedProduct.description}
                                </p>
                            </div>
                        )}

                        {/* Sold Out or Store Closed Alert in Modal */}
                        {selectedProduct.stock <= 0 ? (
                            <div className="my-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
                                <IconAlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                                <span>
                                    <strong>Stok Sedang Habis:</strong> Produk ini saat ini belum tersedia untuk dipesan. Anda dapat menanyakan jadwal restock ke admin toko via WhatsApp.
                                </span>
                            </div>
                        ) : !isStoreOpen ? (
                            <div className="my-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                                <IconAlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                <span>
                                    <strong>Toko Sedang Tutup:</strong> {opStatus.schedule_info || opStatus.badge_text || "Pemesanan dinonaktifkan sementara."}
                                </span>
                            </div>
                        ) : null}

                        {/* Stepper & Action Buttons */}
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2">
                            <div className="flex items-center justify-between w-full sm:w-auto gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-medium text-slate-500 pl-2 sm:hidden">
                                    Jumlah:
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={!isStoreOpen || activeModalMaxQty <= 0 || modalQty <= 1}
                                        onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <IconMinus size={14} />
                                    </button>
                                    <span className="w-6 text-center font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                        {modalQty}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={!isStoreOpen || activeModalMaxQty <= 0 || modalQty >= activeModalMaxQty}
                                        onClick={() =>
                                            setModalQty((q) => Math.min(activeModalMaxQty, q + 1))
                                        }
                                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                                        title={
                                            activeModalMaxQty <= 0
                                                ? "Stok Habis"
                                                : !isStoreOpen
                                                ? "Toko sedang tutup"
                                                : undefined
                                        }
                                    >
                                        <IconPlus size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:flex sm:flex-1 gap-2 w-full">
                                <button
                                    type="button"
                                    disabled={!isStoreOpen || activeModalMaxQty <= 0}
                                    onClick={() => {
                                        if (activeModalMaxQty <= 0) {
                                            toast.error("Maaf, produk ini sedang habis.");
                                            return;
                                        }
                                        if (!isStoreOpen) {
                                            toast.error(`Maaf, toko sedang tutup (${opStatus.badge_text || "Tutup"})`);
                                            return;
                                        }
                                        addToCart(selectedProduct, modalQty, true, activeModalUnit);
                                        setSelectedProduct(null);
                                    }}
                                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition ${
                                        !isStoreOpen || activeModalMaxQty <= 0
                                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                                            : "bg-primary-600 hover:bg-primary-700 text-white cursor-pointer"
                                    }`}
                                    title={
                                        activeModalMaxQty <= 0
                                            ? "Stok Habis"
                                            : !isStoreOpen
                                            ? "Toko sedang tutup"
                                            : "Tambah ke keranjang"
                                    }
                                >
                                    <IconShoppingCart size={16} />
                                    {activeModalMaxQty <= 0
                                        ? "Stok Habis"
                                        : !isStoreOpen
                                        ? "Toko Tutup"
                                        : "+ Keranjang"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (activeModalMaxQty <= 0) {
                                            const targetNumber = store.wa_number || "6281234567890";
                                            const unitLabel = activeModalUnit ? ` (Satuan ${activeModalUnit.name || activeModalUnit.code})` : "";
                                            const text = encodeURIComponent(
                                                `Halo ${store.name || "Admin Toko"}, saya ingin menanyakan apakah produk *${selectedProduct.title}${unitLabel}* yang sedang habis akan segera restock/tersedia kembali? Terima kasih.`
                                            );
                                            window.open(`https://wa.me/${targetNumber}?text=${text}`, "_blank");
                                            return;
                                        }
                                        if (!isStoreOpen) {
                                            toast.error(`Maaf, toko sedang tutup (${opStatus.badge_text || "Tutup"})`);
                                            return;
                                        }
                                        handleInstantBuy(selectedProduct, modalQty, activeModalUnit);
                                    }}
                                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition ${
                                        activeModalMaxQty <= 0
                                            ? "bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
                                            : !isStoreOpen
                                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                                            : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                    }`}
                                    title={
                                        activeModalMaxQty <= 0
                                            ? "Tanya ketersediaan restock via WhatsApp"
                                            : !isStoreOpen
                                            ? "Toko sedang tutup"
                                            : "Beli via WhatsApp"
                                    }
                                >
                                    <IconBrandWhatsapp size={16} />
                                    {activeModalMaxQty <= 0
                                        ? "Tanya Stok via WA"
                                        : !isStoreOpen
                                        ? "Toko Tutup"
                                        : "Beli via WA"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Branch Selector Modal */}
            <BranchSelectorModal
                isOpen={isBranchModalOpen}
                onClose={() => setIsBranchModalOpen(false)}
                branches={branches}
                activeBranch={activeBranch}
                onSelectBranch={handleSelectBranch}
            />
        </PublicLayout>
    );
}
