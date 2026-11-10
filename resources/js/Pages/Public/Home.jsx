import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Head, router } from "@inertiajs/react";
import axios from "axios";
import toast from "react-hot-toast";
import { IconChevronUp } from "@tabler/icons-react";

// Home Components
import PublicHeader from "@/Components/Public/Home/PublicHeader";
import EditorialHero from "@/Components/Public/Home/EditorialHero";
import TheEssentials from "@/Components/Public/Home/TheEssentials";
import CuratedCollections from "@/Components/Public/Home/CuratedCollections";
import HomePromoBanner from "@/Components/Public/Home/HomePromoBanner";
import FeaturesBar from "@/Components/Public/Home/FeaturesBar";
import NewsletterSection from "@/Components/Public/Home/NewsletterSection";
import EditorialFooter from "@/Components/Public/Home/EditorialFooter";

// Shared Catalog Components for Drawers & Modals
import CatalogQuickViewModal from "@/Components/Public/Catalog/CatalogQuickViewModal";
import CatalogCartTray from "@/Components/Public/Catalog/CatalogCartTray";
import CatalogWishlistDrawer from "@/Components/Public/Catalog/CatalogWishlistDrawer";
import CatalogCheckoutDrawer from "@/Components/Public/Catalog/CatalogCheckoutDrawer";
import BranchSelectorModal from "@/Components/Public/BranchSelectorModal";

// Hooks & Helpers
import { useWishlist } from "@/Hooks/useWishlist";
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

export default function Home({
    heroBanner = null,
    featuredProducts = [],
    featuredCollections = [],
    activePromoBanners = [],
    store = {},
    branches = [],
    activeBranch = null,
    bankAccounts = [],
    availableCoupons = [],
    sizeCharts = [],
}) {
    // 1. Modals & Drawers States
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isWishlistOpen, setIsWishlistOpen] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showBackToTop, setShowBackToTop] = useState(false);

    // 2. Wishlist Hook
    const {
        wishlist,
        wishlistCount,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist,
    } = useWishlist();

    // 3. Cart State & LocalStorage
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

    const cartCount = useMemo(() => {
        return cart.reduce((acc, item) => acc + (item.qty || 1), 0);
    }, [cart]);

    const cartTotal = useMemo(() => {
        return cart.reduce((acc, item) => {
            const price = Number(item.final_price || item.sell_price || 0);
            return acc + price * (item.qty || 1);
        }, 0);
    }, [cart]);

    // 4. Coupon Hook
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

    const opStatus = activeBranch?.operating_status || store.operating_status || {
        is_open: true,
        status: "open",
        label: "Buka",
        badge_text: "Buka",
        badge_color: "emerald",
    };
    const isStoreOpen = opStatus.is_open !== false;

    // 6. RajaOngkir States
    const [isRajaongkirActive, setIsRajaongkirActive] = useState(false);
    const [destinationQuery, setDestinationQuery] = useState("");
    const [destinationResults, setDestinationResults] = useState([]);
    const [selectedDestination, setSelectedDestination] = useState(null);
    const [isSearchingDestination, setIsSearchingDestination] = useState(false);
    const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
    const [shippingRates, setShippingRates] = useState([]);
    const [selectedShippingRate, setSelectedShippingRate] = useState(null);
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
    const [shippingCalculationError, setShippingCalculationError] = useState(null);

    const shippingWeight = useMemo(() => {
        return cart.reduce((acc, item) => {
            const itemWeight = Number(item.weight || item.berat || 250);
            return acc + itemWeight * (item.qty || 1);
        }, 0);
    }, [cart]);

    const shippingCost = useMemo(() => {
        if (deliveryMethod === "pickup") return 0;
        return selectedShippingRate ? (selectedShippingRate.cost || 0) : 0;
    }, [deliveryMethod, selectedShippingRate]);

    const grandTotal = useMemo(() => {
        return Math.max(0, cartTotal - discountAmount + shippingCost);
    }, [cartTotal, discountAmount, shippingCost]);

    // Check RajaOngkir status on mount
    useEffect(() => {
        let isMounted = true;
        axios
            .get(resolveShippingDestinationsUrl(), { params: { search: "test" } })
            .then(() => {
                if (isMounted) setIsRajaongkirActive(true);
            })
            .catch((err) => {
                if (err.response && err.response.status !== 503) {
                    if (isMounted) setIsRajaongkirActive(true);
                } else {
                    if (isMounted) setIsRajaongkirActive(false);
                }
            });
        return () => {
            isMounted = false;
        };
    }, []);

    // Destination search debounce
    const destinationSearchTimeout = useRef(null);
    useEffect(() => {
        if (!destinationQuery || destinationQuery.trim().length < 3 || selectedDestination) {
            setDestinationResults([]);
            return;
        }

        if (destinationSearchTimeout.current) {
            clearTimeout(destinationSearchTimeout.current);
        }

        destinationSearchTimeout.current = setTimeout(async () => {
            setIsSearchingDestination(true);
            try {
                const res = await axios.get(resolveShippingDestinationsUrl(), {
                    params: { search: destinationQuery },
                });
                setDestinationResults(res.data?.data || []);
                setShowDestinationDropdown(true);
            } catch (err) {
                console.error("Gagal mencari destinasi", err);
                setDestinationResults([]);
            } finally {
                setIsSearchingDestination(false);
            }
        }, 400);

        return () => clearTimeout(destinationSearchTimeout.current);
    }, [destinationQuery, selectedDestination]);

    const fetchShippingRates = useCallback(
        async (destinationId, currentCart) => {
            if (!destinationId || !currentCart || currentCart.length === 0) {
                setShippingRates([]);
                setSelectedShippingRate(null);
                return;
            }

            setIsCalculatingShipping(true);
            setShippingCalculationError(null);

            try {
                const itemsPayload = currentCart.map((i) => ({
                    product_id: i.id,
                    qty: i.qty,
                }));

                const res = await axios.post(resolveShippingCalculateUrl(), {
                    warehouse_id: activeBranch?.id || branches[0]?.id,
                    destination_id: destinationId,
                    items: itemsPayload,
                });

                const rates = res.data?.rates || [];
                setShippingRates(rates);
                if (rates.length > 0) {
                    setSelectedShippingRate(rates[0]);
                } else {
                    setSelectedShippingRate(null);
                }
            } catch (err) {
                console.error("Gagal kalkulasi ongkir", err);
                const msg = err.response?.data?.message || "Gagal memuat tarif ongkir kurir.";
                setShippingCalculationError(msg);
                setShippingRates([]);
                setSelectedShippingRate(null);
            } finally {
                setIsCalculatingShipping(false);
            }
        },
        [activeBranch, branches]
    );

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
        setShippingCalculationError(null);
    };

    // 7. Payment State
    const [selectedBankId, setSelectedBankId] = useState(() => bankAccounts[0]?.id || "");
    const [paymentProofFile, setPaymentProofFile] = useState(null);
    const [paymentProofPreview, setPaymentProofPreview] = useState(null);
    const [paymentProofError, setPaymentProofError] = useState(null);
    const [copiedRekening, setCopiedRekening] = useState(false);
    const [copiedTotal, setCopiedTotal] = useState(false);
    const [submittingOrder, setSubmittingOrder] = useState(false);

    useEffect(() => {
        if (bankAccounts.length > 0 && !selectedBankId) {
            setSelectedBankId(bankAccounts[0].id);
        }
    }, [bankAccounts, selectedBankId]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setPaymentProofError("Ukuran file maksimal 5MB");
            return;
        }

        const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
        if (!validTypes.includes(file.type)) {
            setPaymentProofError("Format file harus JPG, PNG, atau WEBP");
            return;
        }

        setPaymentProofError(null);
        setPaymentProofFile(file);

        const reader = new FileReader();
        reader.onloadend = () => {
            setPaymentProofPreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveProof = () => {
        setPaymentProofFile(null);
        setPaymentProofPreview(null);
        setPaymentProofError(null);
    };

    const handleCopyRekening = (accNumber) => {
        if (!accNumber) return;
        navigator.clipboard.writeText(accNumber).then(() => {
            setCopiedRekening(true);
            toast.success("Nomor rekening berhasil disalin");
            setTimeout(() => setCopiedRekening(false), 2000);
        });
    };

    const handleCopyTotal = (amount) => {
        if (!amount) return;
        navigator.clipboard.writeText(String(amount)).then(() => {
            setCopiedTotal(true);
            toast.success("Nominal pembayaran berhasil disalin");
            setTimeout(() => setCopiedTotal(false), 2000);
        });
    };

    // 8. Cart Item Actions
    const addToCart = (productToAdd, variant = null, qtyToAdd = 1) => {
        const targetId = variant ? variant.id : productToAdd.id;
        const targetPrice = variant ? variant.final_price || variant.sell_price : productToAdd.final_price || productToAdd.sell_price;
        const targetTitle = variant
            ? `${productToAdd.title} - ${variant.title || variant.name || "Varian"}`
            : productToAdd.title;
        const targetImage = variant?.image || productToAdd.image;
        const targetWeight = variant?.weight || productToAdd.weight || 250;

        setCart((prevCart) => {
            const existingIndex = prevCart.findIndex((item) => item.id === targetId);
            if (existingIndex > -1) {
                const updated = [...prevCart];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    qty: updated[existingIndex].qty + qtyToAdd,
                };
                return updated;
            } else {
                return [
                    ...prevCart,
                    {
                        id: targetId,
                        parent_id: variant ? productToAdd.id : null,
                        title: targetTitle,
                        image: targetImage,
                        sell_price: targetPrice,
                        final_price: targetPrice,
                        weight: targetWeight,
                        qty: qtyToAdd,
                        variant_name: variant ? variant.title || variant.name : null,
                    },
                ];
            }
        });

        toast.success(`Ditambahkan ke keranjang: ${targetTitle}`);
    };

    const handleUpdateQty = (itemId, newQty) => {
        if (newQty <= 0) {
            handleRemoveItem(itemId);
            return;
        }
        setCart((prev) =>
            prev.map((item) => (item.id === itemId ? { ...item, qty: newQty } : item))
        );
    };

    const handleRemoveItem = (itemId) => {
        setCart((prev) => prev.filter((item) => item.id !== itemId));
    };

    const handleClearCart = () => {
        setCart([]);
        removeCoupon(true);
        try {
            localStorage.removeItem(CART_STORAGE_KEY);
        } catch (_) { }
    };

    const saveCustomerInfo = () => {
        if (rememberCustomer) {
            const dataToSave = {
                name: customerName.trim(),
                phone: customerPhone.trim(),
                address: deliveryAddress.trim(),
            };
            try {
                localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(dataToSave));
                setSavedCustomer(dataToSave);
                setIsAutoFilled(true);
            } catch (_) { }
        }
    };

    const handleResetCustomerInfo = () => {
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setIsAutoFilled(false);
        try {
            localStorage.removeItem(CUSTOMER_STORAGE_KEY);
            setSavedCustomer(null);
        } catch (_) { }
        toast.success("Data tersimpan dibersihkan");
    };

    const handleToggleRemember = (checked) => {
        setRememberCustomer(checked);
        if (!checked) {
            try {
                localStorage.removeItem(CUSTOMER_STORAGE_KEY);
                setSavedCustomer(null);
                setIsAutoFilled(false);
            } catch (_) { }
        }
    };

    // 9. Checkout Validation & Submission
    const validateCheckout = () => {
        if (cart.length === 0) {
            toast.error("Keranjang belanja masih kosong!");
            return false;
        }
        if (!customerName.trim()) {
            toast.error("Mohon lengkapi Nama Anda");
            return false;
        }

        const effectiveMethod = isDeliveryAllowed && isPickupAllowed
            ? deliveryMethod
            : isDeliveryAllowed
                ? "delivery"
                : "pickup";

        if (effectiveMethod === "delivery" && !isDeliveryAllowed) {
            toast.error("Layanan pengiriman kurir sedang nonaktif untuk toko ini.");
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

        const effectiveDeliveryMethod = isDeliveryAllowed && !isPickupAllowed
            ? "delivery"
            : !isDeliveryAllowed && isPickupAllowed
                ? "pickup"
                : isDeliveryAllowed
                    ? deliveryMethod
                    : "pickup";

        const storeDisplayName = activeBranch
            ? `${store.name || "Toko"} (${activeBranch.name})`
            : store.name || "Toko";

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
            formData.append(
                "shipping_cost",
                effectiveDeliveryMethod === "delivery" && selectedShippingRate
                    ? selectedShippingRate.cost || 0
                    : 0
            );
            if (effectiveDeliveryMethod === "delivery" && selectedShippingRate?.courier_code) {
                formData.append("shipping_courier", selectedShippingRate.courier_code);
            }
            if (effectiveDeliveryMethod === "delivery" && selectedShippingRate?.service) {
                formData.append("shipping_service", selectedShippingRate.service);
            }
            if (effectiveDeliveryMethod === "delivery" && selectedShippingRate?.etd) {
                formData.append("shipping_etd", selectedShippingRate.etd);
            }
            formData.append(
                "shipping_weight",
                effectiveDeliveryMethod === "delivery" ? shippingWeight || 0 : 0
            );
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
            formData.append(
                "items",
                JSON.stringify(
                    cart.map((item) => ({
                        product_id: item.id,
                        qty: item.qty,
                        unit_id: item.unit_id || null,
                    }))
                )
            );

            const res = await axios.post(resolveCatalogCheckoutUrl(), formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const orderData = res.data?.order;

            toast.success("Pesanan berhasil dibuat!", { id: toastId });

            const trackingUrl =
                orderData?.status_url ||
                (orderData?.access_token ? resolveCatalogStatusUrl(orderData.access_token) : "");
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
                    deliveryAddress:
                        effectiveDeliveryMethod === "delivery" ? deliveryAddress.trim() : "",
                    shippingCourier:
                        effectiveDeliveryMethod === "delivery" && selectedShippingRate
                            ? selectedShippingRate.courier_code?.toUpperCase()
                            : "",
                    shippingService:
                        effectiveDeliveryMethod === "delivery" && selectedShippingRate
                            ? selectedShippingRate.service
                            : "",
                    shippingCost:
                        effectiveDeliveryMethod === "delivery" && selectedShippingRate
                            ? selectedShippingRate.cost || 0
                            : 0,
                    shippingEtd:
                        effectiveDeliveryMethod === "delivery" && selectedShippingRate
                            ? selectedShippingRate.etd
                            : "",
                    shippingDestination:
                        effectiveDeliveryMethod === "delivery" && selectedDestination
                            ? selectedDestination.label
                            : "",
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

            // Cleanup
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

    // Scroll listener for back-to-top
    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const pageTitle = store.name
        ? `${store.name} — ${store.tagline || "Kemewahan Dalam Kesederhanaan"}`
        : "Butik Busana & Koleksi Pilihan";

    return (
        <div className="min-h-screen bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col antialiased selection:bg-karima-accent/20 selection:text-karima-brand">
            <Head title={pageTitle}>
                <meta
                    name="description"
                    content={
                        store.description ||
                        "Koleksi busana muslimah dan pakaian elegan berkualitas butik terbaik dengan jahitan presisi dan bahan premium."
                    }
                />
            </Head>

            {/* 1. Transparent to Solid Public Header */}
            <PublicHeader
                store={store}
                activeBranch={activeBranch}
                branches={branches}
                onOpenBranchModal={() => setIsBranchModalOpen(true)}
                cartCount={cartCount}
                onOpenCart={() => setIsCartOpen(true)}
                wishlistCount={wishlistCount}
                onOpenWishlist={() => setIsWishlistOpen(true)}
                isTransparentVariant={true}
            />

            {/* 2. Fullscreen Editorial Hero */}
            <EditorialHero
                subtitle={heroBanner?.subtitle}
                headline={heroBanner?.headline}
                imageUrl={heroBanner?.imageUrl}
                mobileImageUrl={heroBanner?.mobileImageUrl}
                ctaText={heroBanner?.ctaText}
                ctaLink={heroBanner?.ctaLink}
            />

            {/* 3. The Essentials (New Arrivals 6 Products) */}
            <TheEssentials
                products={featuredProducts}
                cart={cart}
                onSelectProduct={(p) => setSelectedProduct(p)}
                isInWishlist={isInWishlist}
                onToggleWishlist={toggleWishlist}
            />

            {/* 4. Curated Collections (Tall Categories Cards) */}
            <CuratedCollections collections={featuredCollections} />

            {/* 5. Mid-page Promo Banner */}
            {activePromoBanners.length > 0 && (
                <HomePromoBanner banner={activePromoBanners[0]} />
            )}


            {/* 6. Newsletter Section (The Inner Circle) */}
            <NewsletterSection />


            {/* 7. Features Bar (Brand Pillars) */}
            <FeaturesBar />


            {/* 8. Luxury Editorial Footer */}
            <EditorialFooter store={store} activeBranch={activeBranch} />

            {/* Modals & Drawers */}
            {/* Quick View Modal */}
            <CatalogQuickViewModal
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAddToCart={addToCart}
                isWishlisted={selectedProduct ? isInWishlist(selectedProduct.id) : false}
                onToggleWishlist={toggleWishlist}
                isStoreOpen={isStoreOpen}
            />

            {/* Cart Slide-over Tray */}
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

            {/* Wishlist Slide-over Tray */}
            <CatalogWishlistDrawer
                isOpen={isWishlistOpen}
                onClose={() => setIsWishlistOpen(false)}
                wishlist={wishlist}
                onRemoveItem={removeFromWishlist}
                onClearWishlist={clearWishlist}
                onAddToCart={addToCart}
                onSelectProduct={(item) => {
                    setIsWishlistOpen(false);
                    const fullProd =
                        featuredProducts.find((p) => String(p.id) === String(item.id)) || item;
                    setSelectedProduct(fullProd);
                }}
                isStoreOpen={isStoreOpen}
            />

            {/* Checkout Drawer */}
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

            {/* Branch Selector Modal */}
            <BranchSelectorModal
                isOpen={isBranchModalOpen}
                onClose={() => setIsBranchModalOpen(false)}
                branches={branches}
                activeBranch={activeBranch}
            />

            {/* Floating Back to Top */}
            {showBackToTop && (
                <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="fixed bottom-8 right-6 z-30 p-2.5 rounded-full bg-white/90 dark:bg-stone-900/90 backdrop-blur-md text-karima-brand dark:text-stone-200 border border-karima-brand/20 dark:border-stone-700 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                    title="Kembali ke atas"
                    aria-label="Kembali ke atas"
                >
                    <IconChevronUp size={20} />
                </button>
            )}
        </div>
    );
}
