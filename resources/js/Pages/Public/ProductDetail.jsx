import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Head, Link, router } from "@inertiajs/react";
import axios from "axios";
import PublicLayout from "@/Layouts/PublicLayout";
import toast from "react-hot-toast";
import {
    IconArrowLeft,
    IconShoppingCart,
    IconBrandWhatsapp,
    IconPhotoOff,
    IconSparkles,
    IconRulerMeasure,
    IconPlus,
    IconMinus,
    IconCheck,
    IconChevronDown,
    IconTruckDelivery,
    IconBuildingStore,
    IconShieldCheck,
    IconHeart,
} from "@tabler/icons-react";

import CatalogNavbar from "@/Components/Public/Catalog/CatalogNavbar";
import CatalogCartTray from "@/Components/Public/Catalog/CatalogCartTray";
import CatalogWishlistDrawer from "@/Components/Public/Catalog/CatalogWishlistDrawer";
import CatalogCheckoutDrawer from "@/Components/Public/Catalog/CatalogCheckoutDrawer";
import CatalogProductCard from "@/Components/Public/Catalog/CatalogProductCard";
import ProductImageGallery from "@/Components/Public/Catalog/ProductImageGallery";
import BranchSelectorModal from "@/Components/Public/BranchSelectorModal";
import SizeChartModal from "@/Components/Public/SizeChartModal";
import CatalogVariantColorSelector from "@/Components/Public/Catalog/CatalogVariantColorSelector";
import EditorialFooter from "@/Components/Public/Home/EditorialFooter";

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

const getVariantColor = (variant) => {
    const attrs = parseVariantAttrs(variant);
    return attrs.color_name || attrs.warna || "Default";
};

const getVariantColorHex = (variant) => {
    const attrs = parseVariantAttrs(variant);
    return attrs.color_hex || attrs.hex || "#1e293b";
};

const getVariantSize = (variant) => {
    const attrs = parseVariantAttrs(variant);
    return attrs.size || attrs.ukuran || "All";
};

export default function ProductDetail({
    product,
    initialVariantId = null,
    relatedProducts = [],
    store = {},
    branches = [],
    activeBranch = null,
    bankAccounts = [],
    availableCoupons = [],
    categories = [],
}) {
    // 1. Variant & Options State
    const hasVariants = Boolean(product?.has_variants) && Array.isArray(product?.variants) && product.variants.length > 0;
    const hasMultiUnits = Array.isArray(product?.units) && product.units.length > 1;

    const [selectedVariant, setSelectedVariant] = useState(() => {
        if (!hasVariants) return null;
        if (initialVariantId) {
            const match = product.variants.find((v) => v.id === initialVariantId);
            if (match) return match;
        }
        return product.variants.find((v) => v.stock > 0) || product.variants[0] || null;
    });

    const [selectedUnit, setSelectedUnit] = useState(() => {
        return product?.units?.find((u) => u.is_base) || product?.units?.[0] || null;
    });

    const [qty, setQty] = useState(1);
    const [activeImage, setActiveImage] = useState(() => {
        return selectedVariant?.image || product?.image || null;
    });

    // Modals & Drawers
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isWishlistOpen, setIsWishlistOpen] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [showSizeChart, setShowSizeChart] = useState(false);

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

    const isWishlisted = isInWishlist(product.id);

    // Accordions
    const [openAccordion, setOpenAccordion] = useState("description");

    const toggleAccordion = (section) => {
        setOpenAccordion((prev) => (prev === section ? null : section));
    };

    // Color swatches mapping
    const availableColors = useMemo(() => {
        if (!hasVariants) return [];
        const map = new Map();
        product.variants.forEach((v) => {
            const col = getVariantColor(v);
            const hex = getVariantColorHex(v);
            if (!map.has(col)) {
                map.set(col, { name: col, hex, image: v.image || null });
            } else if (!map.get(col).image && v.image) {
                map.set(col, { name: col, hex, image: v.image });
            }
        });
        return Array.from(map.values());
    }, [product, hasVariants]);

    const activeColor = selectedVariant ? getVariantColor(selectedVariant) : (availableColors[0]?.name || "");

    // Sizes for the active color
    const availableSizesForColor = useMemo(() => {
        if (!hasVariants || !Array.isArray(product?.variants)) return [];
        const sizeMap = new Map();
        product.variants
            .filter((v) => getVariantColor(v) === activeColor)
            .forEach((v) => {
                const sName = getVariantSize(v);
                if (!sizeMap.has(sName)) {
                    sizeMap.set(sName, { ...v, stock: Number(v.stock) || 0 });
                } else {
                    const existing = sizeMap.get(sName);
                    const mergedStock = (existing.stock || 0) + (Number(v.stock) || 0);
                    if ((existing.stock || 0) <= 0 && (Number(v.stock) || 0) > 0) {
                        sizeMap.set(sName, { ...v, stock: mergedStock });
                    } else {
                        existing.stock = mergedStock;
                    }
                }
            });
        return Array.from(sizeMap.values());
    }, [product, hasVariants, activeColor]);

    const handleSelectColor = (colorName) => {
        if (!hasVariants || !Array.isArray(product?.variants)) return;
        const currentSize = getVariantSize(selectedVariant);
        const match =
            product.variants.find((v) => getVariantColor(v) === colorName && getVariantSize(v) === currentSize) ||
            product.variants.find((v) => getVariantColor(v) === colorName && v.stock > 0) ||
            product.variants.find((v) => getVariantColor(v) === colorName);
        setSelectedVariant(match || null);
        if (match?.image) {
            setActiveImage(match.image);
        }
        setQty(match && match.stock > 0 ? 1 : 0);
    };

    const handleSelectSizeVariant = (variant) => {
        setSelectedVariant(variant);
        if (variant?.image) {
            setActiveImage(variant.image);
        }
        setQty(variant && variant.stock > 0 ? 1 : 0);
    };

    // All gallery images (main product image + all variant images)
    const galleryImages = useMemo(() => {
        const list = [];
        if (product?.image) list.push(product.image);
        if (product?.gallery_images && Array.isArray(product.gallery_images)) {
            product.gallery_images.forEach((img) => {
                if (img && !list.includes(img)) list.push(img);
            });
        }
        if (product?.variants && Array.isArray(product.variants)) {
            product.variants.forEach((v) => {
                if (v.image && !list.includes(v.image)) list.push(v.image);
            });
        }
        return list;
    }, [product]);

    // Pricing & Stock
    const activeUnit = selectedUnit || product?.units?.find((u) => u.is_base) || product?.units?.[0] || null;

    const unitPrice = useMemo(() => {
        if (hasVariants && selectedVariant) {
            return selectedVariant.final_price || selectedVariant.sell_price || 0;
        }
        return activeUnit?.final_price || activeUnit?.sell_price || product?.final_price || product?.sell_price || 0;
    }, [product, activeUnit, hasVariants, selectedVariant]);

    const originalPrice = useMemo(() => {
        if (hasVariants && selectedVariant) {
            return selectedVariant.sell_price || 0;
        }
        return activeUnit?.sell_price || product?.sell_price || 0;
    }, [product, activeUnit, hasVariants, selectedVariant]);

    const maxStock = useMemo(() => {
        if (hasVariants) return selectedVariant?.stock || 0;
        const factor = Number(activeUnit?.conversion_factor) || 1;
        return factor > 0 ? Math.floor((product?.stock || 0) / factor) : 0;
    }, [product, activeUnit, hasVariants, selectedVariant]);

    const isSoldOut = maxStock <= 0;
    const hasDiscount = originalPrice > unitPrice && !isSoldOut;
    const discountPercentage = hasDiscount && originalPrice > 0
        ? Math.round(((originalPrice - unitPrice) / originalPrice) * 100)
        : 0;

    // Cart state with localStorage
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

    // Customer & Checkout Form states
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

    // RajaOngkir States
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

    // Bank Payment
    const [selectedBankId, setSelectedBankId] = useState(() => (bankAccounts.length > 0 ? bankAccounts[0].id : null));
    const [paymentProofFile, setPaymentProofFile] = useState(null);
    const [paymentProofPreview, setPaymentProofPreview] = useState(null);
    const [paymentProofError, setPaymentProofError] = useState(null);
    const [copiedRekening, setCopiedRekening] = useState(null);
    const [copiedTotal, setCopiedTotal] = useState(false);
    const [submittingOrder, setSubmittingOrder] = useState(false);

    // Cart operations
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

    const addToCart = (targetProduct, quantity = 1, showToast = true) => {
        if (!isStoreOpen) {
            toast.error(`Maaf, toko sedang tutup (${opStatus.badge_text || "Tutup"})`);
            return;
        }

        const chosenUnit = selectedUnit || targetProduct.units?.find((u) => u.is_base) || targetProduct.units?.[0] || null;
        const factor = Number(chosenUnit?.conversion_factor) || 1;
        const maxUnitQty = factor > 0 ? Math.floor(targetProduct.stock / factor) : 0;

        if (maxUnitQty <= 0 || targetProduct.stock <= 0) {
            toast.error("Maaf, stok barang tidak mencukupi");
            return;
        }

        const cartKey = `${targetProduct.id}_${chosenUnit?.id || "base"}`;
        const uPrice = chosenUnit?.final_price || chosenUnit?.sell_price || targetProduct.final_price || targetProduct.sell_price;
        const uOrigPrice = chosenUnit?.sell_price || targetProduct.sell_price;

        setCart((prev) => {
            const existingIndex = prev.findIndex((item) => (item.cart_key || item.id) === cartKey);
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
                    sell_price: uOrigPrice,
                    final_price: uPrice,
                    image: targetProduct.image || product?.image,
                    category_name: product?.category_name || "",
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
            setIsCartOpen(true);
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

    // RajaOngkir Search & Rates
    useEffect(() => {
        if (!isRajaongkirActive || !destinationQuery || destinationQuery.trim().length < 3) {
            setDestinationResults([]);
            return;
        }
        if (selectedDestination && destinationQuery === selectedDestination.label) return;

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
        if (isRajaongkirActive && deliveryMethod === "delivery" && selectedDestination?.id && cart.length > 0) {
            fetchShippingRates(selectedDestination.id, cart);
        }
    }, [cart, selectedDestination?.id, deliveryMethod, isRajaongkirActive]);

    // Payment proof upload
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!validTypes.includes(file.type)) {
            setPaymentProofError("Format file harus JPG, PNG, atau WEBP.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setPaymentProofError("Ukuran file maksimal 5MB.");
            return;
        }
        setPaymentProofFile(file);
        setPaymentProofError(null);
        const reader = new FileReader();
        reader.onloadend = () => setPaymentProofPreview(reader.result);
        reader.readAsDataURL(file);
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

    const handleDirectWhatsAppBuy = () => {
        if (!isStoreOpen) {
            toast.error(`Toko sedang tutup (${opStatus.badge_text || "Tutup"})`);
            return;
        }
        if (isSoldOut) {
            toast.error("Maaf, produk ini sedang habis.");
            return;
        }

        const target = hasVariants && selectedVariant ? selectedVariant : product;
        const storeName = store.name || "Toko";
        const message = `Halo ${storeName}, saya tertarik untuk memesan:\n\n*${target.title}*\nJumlah: ${qty} ${selectedUnit?.name || "Pcs"}\nHarga: ${formatRupiah(unitPrice * qty)}\nLink: ${window.location.href}\n\nApakah stok masih tersedia? Terima kasih!`;

        openWhatsAppOrder({
            phone: store.wa_number || store.phone,
            message,
        });
    };

    const handleSubmitCheckout = async (isWhatsApp = false) => {
        if (!isStoreOpen) {
            toast.error(`Toko sedang tutup (${opStatus.badge_text || "Tutup"})`);
            return;
        }
        if (!isDeliveryAllowed && !isPickupAllowed) {
            toast.error("Layanan pemesanan (pengiriman & ambil di toko) sedang nonaktif untuk toko ini.");
            return;
        }
        if (cart.length === 0) {
            toast.error("Keranjang belanja masih kosong!");
            return;
        }
        if (!customerName.trim()) {
            toast.error("Mohon isi Nama Pemesan");
            return;
        }

        const effectiveMethod = (isDeliveryAllowed && !isPickupAllowed)
            ? "delivery"
            : (!isDeliveryAllowed && isPickupAllowed)
                ? "pickup"
                : deliveryMethod;

        if (effectiveMethod === "delivery" && !isDeliveryAllowed) {
            toast.error("Layanan pengiriman ke alamat sedang nonaktif untuk toko ini.");
            return;
        }
        if (effectiveMethod === "pickup" && !isPickupAllowed) {
            toast.error("Layanan ambil di toko sedang nonaktif untuk toko ini.");
            return;
        }

        if (effectiveMethod === "delivery") {
            if (isRajaongkirActive && !selectedDestination) {
                toast.error("Mohon pilih kecamatan / kota tujuan pengiriman");
                return;
            }
            if (isRajaongkirActive && !selectedShippingRate) {
                toast.error("Mohon pilih opsi kurir pengiriman");
                return;
            }
            if (!deliveryAddress.trim()) {
                toast.error("Mohon lengkapi Alamat Pengiriman");
                return;
            }
        }
        if (!paymentProofFile) {
            setPaymentProofError("Wajib melampirkan foto bukti transfer pembayaran");
            toast.error("Silakan unggah bukti transfer pembayaran terlebih dahulu!");
            return;
        }

        const effectiveDeliveryMethod = (isDeliveryAllowed && !isPickupAllowed)
            ? "delivery"
            : (!isDeliveryAllowed && isPickupAllowed)
                ? "pickup"
                : (isDeliveryAllowed ? deliveryMethod : "pickup");
        const storeDisplayName = activeBranch ? `${store.name || "Toko"} (${activeBranch.name})` : (store.name || "Toko");

        setSubmittingOrder(true);
        const toastId = toast.loading("Memproses pesanan Anda...");

        try {
            const formData = new FormData();
            formData.append("warehouse_id", activeBranch?.id || branches[0]?.id || "");
            formData.append("customer_name", customerName.trim());
            if (customerPhone.trim()) formData.append("customer_phone", customerPhone.trim());
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
            if (orderNotes.trim()) formData.append("notes", orderNotes.trim());
            if (appliedCoupon?.code) formData.append("coupon_code", appliedCoupon.code);
            formData.append("payment_method", "bank_transfer");
            if (selectedBankId) formData.append("bank_account_id", selectedBankId);
            if (paymentProofFile) formData.append("payment_proof", paymentProofFile);
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

            setCart([]);
            removeCoupon(true);
            setPaymentProofFile(null);
            setPaymentProofPreview(null);
            setPaymentProofError(null);
            handleClearDestination();
            setIsCheckoutOpen(false);

            if (orderData?.order_number && orderData?.access_token) {
                const newRecentOrder = {
                    order_number: orderData.order_number,
                    access_token: orderData.access_token,
                    status_url: trackingUrl,
                    status: orderData.status || "submitted",
                    status_label: orderData.status_label || "Menunggu Konfirmasi",
                    created_at: new Date().toISOString(),
                };
                try {
                    const saved = localStorage.getItem(RECENT_ORDERS_STORAGE_KEY);
                    const list = saved ? JSON.parse(saved) : [];
                    localStorage.setItem(RECENT_ORDERS_STORAGE_KEY, JSON.stringify([newRecentOrder, ...list].slice(0, 5)));
                } catch (_) { }
            }

            if (trackingUrl) router.visit(trackingUrl);
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.message || "Gagal membuat pesanan.";
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
            <Head title={`${product.title} — ${store.name || "Toko Kami"}`} />

            {/* 1. Header Navbar */}
            <CatalogNavbar
                store={store}
                activeBranch={activeBranch}
                branches={branches}
                onOpenBranchModal={() => setIsBranchModalOpen(true)}
                cartCount={cartCount}
                onOpenCart={() => setIsCartOpen(true)}
                wishlistCount={wishlistCount}
                onOpenWishlist={() => setIsWishlistOpen(true)}
                isDeliveryAllowed={isDeliveryAllowed}
                isPickupAllowed={isPickupAllowed}
            />

            {/* 2. Main Product Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-36">
                {/* Breadcrumbs */}
                <nav className="flex items-center gap-2 text-xxs uppercase tracking-[0.2em] text-karima-ink/40 dark:text-stone-400 mb-8 sm:mb-12">
                    <Link href="/katalog" className="hover:text-karima-brand transition-colors">
                        Katalog
                    </Link>
                    <span>/</span>
                    {product.category_name && (
                        <>
                            <Link
                                href={`/katalog?category_id=${product.category_id}`}
                                className="hover:text-karima-brand transition-colors"
                            >
                                {product.category_name}
                            </Link>
                            <span>/</span>
                        </>
                    )}
                    <span className="text-karima-brand dark:text-stone-200 font-medium truncate max-w-[200px] sm:max-w-xs">
                        {product.title}
                    </span>
                </nav>

                {/* 12-Column Editorial Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
                    {/* Left Column: Image Gallery (Col 7) */}
                    <div className="lg:col-span-7">
                        <ProductImageGallery
                            images={galleryImages}
                            activeImage={activeImage}
                            onSelectImage={(img) => {
                                setActiveImage(img);
                                // If this image matches a variant, select it
                                if (hasVariants) {
                                    const match = product.variants.find((v) => v.image === img);
                                    if (match) setSelectedVariant(match);
                                }
                            }}
                            productTitle={product.title}
                            isSoldOut={isSoldOut}
                            badge={
                                isSoldOut ? (
                                    <div className="absolute top-4 left-4 z-20 bg-karima-brand text-white text-[10px] font-bold px-3 py-1.5 uppercase tracking-widest border border-karima-brand shadow-sm">
                                        SOLD OUT
                                    </div>
                                ) : hasDiscount ? (
                                    <div className="absolute top-4 left-4 z-20 bg-rose-600 text-white text-[10px] font-bold px-3 py-1.5 uppercase tracking-widest shadow-sm flex items-center gap-1">
                                        <IconSparkles size={12} />
                                        <span>{discountPercentage}% OFF</span>
                                    </div>
                                ) : null
                            }
                            wishlistButton={
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleWishlist(product);
                                    }}
                                    className={`absolute top-4 right-4 z-20 w-10 h-10 rounded-full border border-white/60 backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${isWishlisted
                                        ? "bg-rose-500 text-white border-rose-500 shadow-sm scale-105"
                                        : "bg-white/80 dark:bg-black/60 text-stone-700 dark:text-stone-300 hover:text-rose-500 hover:scale-110"
                                        }`}
                                    title={isWishlisted ? "Hapus dari Wishlist" : "Simpan ke Wishlist"}
                                    aria-label="Wishlist"
                                >
                                    <IconHeart size={18} fill={isWishlisted ? "currentColor" : "none"} />
                                </button>
                            }
                        />
                    </div>

                    {/* Right Column: Sticky Product Information Panel (Col 5) */}
                    <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6 text-left">
                        {/* Category & Title */}
                        <div>
                            <span className="text-xxs uppercase tracking-[0.35em] text-karima-accent dark:text-stone-400 font-semibold mb-2 block">
                                {product.category_name || "Koleksi Eksklusif"}
                            </span>
                            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-karima-brand dark:text-stone-100 font-normal leading-tight tracking-tight">
                                {product.title}
                            </h1>
                        </div>

                        {/* Price Row */}
                        <div className="flex items-baseline gap-3 flex-wrap">
                            <span className="font-serif text-2xl sm:text-3xl font-bold text-karima-brand dark:text-stone-100">
                                {formatRupiah(unitPrice)}
                            </span>
                            {hasDiscount && (
                                <>
                                    <span className="text-sm sm:text-base text-stone-400 line-through decoration-stone-300">
                                        {formatRupiah(originalPrice)}
                                    </span>
                                    <span className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase">
                                        Hemat {discountPercentage}%
                                    </span>
                                </>
                            )}
                            {activeUnit && !hasVariants && (
                                <span className="text-xxs uppercase tracking-wider text-stone-400">
                                    / {activeUnit.name || activeUnit.code}
                                </span>
                            )}
                        </div>

                        {/* Hairline Divider */}
                        <div className="w-full h-px bg-karima-brand/10 dark:bg-stone-800" />

                        {/* Variant Selector: Color & Size */}
                        {hasVariants && (
                            <div className="space-y-6">
                                {/* Color Swatches */}
                                {availableColors.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-xxs uppercase tracking-[0.25em] font-bold text-karima-brand dark:text-stone-300">
                                                Warna:
                                            </label>
                                            <span className="text-xs font-semibold text-karima-brand dark:text-white capitalize">
                                                {activeColor}
                                            </span>
                                        </div>
                                        <CatalogVariantColorSelector
                                            availableColors={availableColors}
                                            activeColor={activeColor}
                                            onSelectColor={handleSelectColor}
                                            displayType={product?.variant_display_type || "color"}
                                            size="md"
                                        />
                                    </div>
                                )}

                                {/* Size Pills */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xxs uppercase tracking-[0.25em] font-bold text-karima-brand dark:text-stone-300">
                                            Ukuran:
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowSizeChart(true)}
                                            className="text-xxs uppercase tracking-wider font-semibold text-karima-accent hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <IconRulerMeasure size={14} />
                                            <span>Panduan Ukuran</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2.5">
                                        {availableSizesForColor.map((v) => {
                                            const sName = getVariantSize(v);
                                            const isSelected = selectedVariant && getVariantSize(selectedVariant) === sName;
                                            const sizeStock = Number(v.stock) || 0;
                                            const isOut = sizeStock <= 0;

                                            return (
                                                <button
                                                    key={`${v.id}-${sName}`}
                                                    type="button"
                                                    disabled={isOut}
                                                    onClick={() => handleSelectSizeVariant(v)}
                                                    className={`min-w-12 h-11 px-4 rounded border text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer ${isOut
                                                        ? "border-stone-200 text-stone-300 dark:border-stone-800 dark:text-stone-600 line-through cursor-not-allowed bg-stone-50"
                                                        : isSelected
                                                            ? "border-karima-brand bg-karima-brand text-white shadow-xs"
                                                            : "border-karima-brand/20 dark:border-stone-700 bg-white dark:bg-slate-900 text-karima-ink/80 dark:text-stone-300 hover:border-karima-brand"
                                                        }`}
                                                >
                                                    {sName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Multi-unit UOM selector */}
                        {hasMultiUnits && !hasVariants && (
                            <div>
                                <label className="text-xxs uppercase tracking-[0.25em] font-bold text-karima-brand dark:text-stone-300 mb-2 block">
                                    Kemasan / Satuan:
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {product.units.map((u) => {
                                        const isSelected = activeUnit?.id === u.id;
                                        return (
                                            <button
                                                key={u.id}
                                                type="button"
                                                onClick={() => setSelectedUnit(u)}
                                                className={`p-3 rounded border text-left transition-all cursor-pointer ${isSelected
                                                    ? "border-karima-brand bg-karima-base/40 text-karima-brand"
                                                    : "border-stone-200 dark:border-stone-800 hover:border-karima-brand/40"
                                                    }`}
                                            >
                                                <div className="text-xs font-bold">{u.name || u.code}</div>
                                                <div className="text-xs text-karima-accent font-serif font-bold">
                                                    {formatRupiah(u.final_price || u.sell_price)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Availability and SKU */}
                        <div className="flex items-center justify-between text-xxs uppercase tracking-wider text-karima-ink/50 dark:text-stone-400 pt-2">
                            <span>
                                Status:{" "}
                                <strong className={isSoldOut ? "text-rose-600 font-bold" : "text-emerald-700 dark:text-emerald-400 font-bold"}>
                                    {isSoldOut ? "Stok Habis" : `Tersedia (${maxStock} unit)`}
                                </strong>
                            </span>
                            {((hasVariants && selectedVariant?.sku) || product.sku) && (
                                <span>
                                    SKU: <strong>{(hasVariants && selectedVariant?.sku) || product.sku}</strong>
                                </span>
                            )}
                        </div>

                        {/* Purchase Actions Row */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center gap-3">
                                {/* Stepper */}
                                <div className="flex items-center border border-karima-brand/20 dark:border-stone-700 rounded h-12 bg-stone-50 dark:bg-slate-900 w-32 shrink-0">
                                    <button
                                        type="button"
                                        disabled={qty <= 1 || isSoldOut}
                                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                                        className="w-10 h-full flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-karima-brand disabled:opacity-30 cursor-pointer"
                                    >
                                        <IconMinus size={16} />
                                    </button>
                                    <span className="flex-1 text-center font-serif font-bold text-base text-karima-brand dark:text-stone-200">
                                        {qty}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={qty >= maxStock || isSoldOut}
                                        onClick={() => setQty((q) => Math.min(maxStock, q + 1))}
                                        className="w-10 h-full flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-karima-brand disabled:opacity-30 cursor-pointer"
                                    >
                                        <IconPlus size={16} />
                                    </button>
                                </div>

                                {/* Add to Bag Button */}
                                <button
                                    type="button"
                                    disabled={isSoldOut || !isStoreOpen}
                                    onClick={() => {
                                        const target = hasVariants && selectedVariant ? selectedVariant : product;
                                        addToCart(target, qty, true);
                                    }}
                                    className={`flex-1 h-12 py-3 px-6 rounded flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-xs font-semibold shadow-xs transition-all ${isSoldOut || !isStoreOpen
                                        ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                                        : "bg-karima-brand hover:bg-karima-accent text-white active:scale-[0.99] cursor-pointer"
                                        }`}
                                >
                                    <IconShoppingCart size={18} />
                                    <span>{isSoldOut ? "Stok Habis" : "Tambah ke Keranjang"}</span>
                                </button>
                            </div>

                            {/* Direct WhatsApp Order Button */}
                            <button
                                type="button"
                                disabled={isSoldOut || !isStoreOpen}
                                onClick={handleDirectWhatsAppBuy}
                                className="w-full h-12 rounded border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 uppercase tracking-[0.15em] text-xxs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                <IconBrandWhatsapp size={18} />
                                <span>Pesan Langsung via WhatsApp</span>
                            </button>
                        </div>

                        {/* Accordion Tabs */}
                        <div className="pt-6 border-t border-karima-brand/10 dark:border-stone-800 space-y-4">
                            {/* 1. Description */}
                            <div className="border-b border-karima-brand/10 dark:border-stone-800 pb-4">
                                <button
                                    type="button"
                                    onClick={() => toggleAccordion("description")}
                                    className="w-full flex items-center justify-between text-left py-1 cursor-pointer group"
                                >
                                    <span className="text-xxs uppercase tracking-[0.25em] font-bold text-karima-brand dark:text-stone-300 group-hover:text-karima-accent">
                                        Deskripsi Produk
                                    </span>
                                    <IconChevronDown
                                        size={16}
                                        className={`text-stone-400 transition-transform duration-300 ${openAccordion === "description" ? "rotate-180" : ""
                                            }`}
                                    />
                                </button>
                                {openAccordion === "description" && (
                                    <div className="pt-3 text-xs text-karima-ink/70 dark:text-stone-300 leading-relaxed space-y-2">
                                        <p>{product.description || "Tidak ada deskripsi detail untuk produk ini."}</p>
                                    </div>
                                )}
                            </div>

                            {/* 2. Shipping & Pickup */}
                            <div className="border-b border-karima-brand/10 dark:border-stone-800 pb-4">
                                <button
                                    type="button"
                                    onClick={() => toggleAccordion("shipping")}
                                    className="w-full flex items-center justify-between text-left py-1 cursor-pointer group"
                                >
                                    <span className="text-xxs uppercase tracking-[0.25em] font-bold text-karima-brand dark:text-stone-300 group-hover:text-karima-accent">
                                        Pengiriman & Pengambilan
                                    </span>
                                    <IconChevronDown
                                        size={16}
                                        className={`text-stone-400 transition-transform duration-300 ${openAccordion === "shipping" ? "rotate-180" : ""
                                            }`}
                                    />
                                </button>
                                {openAccordion === "shipping" && (
                                    <div className="pt-3 text-xs text-karima-ink/70 dark:text-stone-300 leading-relaxed space-y-2">
                                        <div className="flex items-start gap-2">
                                            <IconTruckDelivery size={16} className="text-karima-brand shrink-0 mt-0.5" />
                                            <span>
                                                <strong>Kirim ke Alamat:</strong> Pengiriman reguler dan kilat melalui kurir terpercaya (JNE, SiCepat, J&T, Lion Parcel) dengan kalkulasi otomatis RajaOngkir.
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <IconBuildingStore size={16} className="text-karima-brand shrink-0 mt-0.5" />
                                            <span>
                                                <strong>Ambil di Toko:</strong> Pesanan dapat diambil langsung di gerai {activeBranch?.name || store.name}.
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3. Assurance & Warranty */}
                            <div className="border-b border-karima-brand/10 dark:border-stone-800 pb-4">
                                <button
                                    type="button"
                                    onClick={() => toggleAccordion("guarantee")}
                                    className="w-full flex items-center justify-between text-left py-1 cursor-pointer group"
                                >
                                    <span className="text-xxs uppercase tracking-[0.25em] font-bold text-karima-brand dark:text-stone-300 group-hover:text-karima-accent">
                                        Jaminan Kualitas & Keaslian
                                    </span>
                                    <IconChevronDown
                                        size={16}
                                        className={`text-stone-400 transition-transform duration-300 ${openAccordion === "guarantee" ? "rotate-180" : ""
                                            }`}
                                    />
                                </button>
                                {openAccordion === "guarantee" && (
                                    <div className="pt-3 text-xs text-karima-ink/70 dark:text-stone-300 leading-relaxed space-y-2">
                                        <div className="flex items-start gap-2">
                                            <IconShieldCheck size={16} className="text-karima-brand shrink-0 mt-0.5" />
                                            <span>
                                                100% Produk Asli. Kami menjamin keaslian bahan, jahitan rapi, dan kontrol mutu ketat sebelum dikemas.
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Related Products Section */}
                {relatedProducts && relatedProducts.length > 0 && (
                    <section className="mt-24 pt-16 border-t border-karima-brand/10 dark:border-stone-800">
                        <div className="text-center mb-12">
                            <span className="text-xxs uppercase tracking-[0.35em] text-karima-accent font-semibold mb-2 block">
                                Rekomendasi
                            </span>
                            <h2 className="font-serif text-3xl sm:text-4xl text-karima-brand dark:text-stone-100 font-medium">
                                Koleksi Serupa
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                            {relatedProducts.map((p) => (
                                <CatalogProductCard
                                    key={p.id}
                                    product={p}
                                    inCartQty={cart.filter((i) => i.id === p.id).reduce((sum, i) => sum + i.qty, 0)}
                                    onSelectProduct={() => router.visit(`/katalog/produk/${p.id}`)}
                                    isWishlisted={isInWishlist(p.id)}
                                    onToggleWishlist={toggleWishlist}
                                />
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {/* Editorial Footer (matching Home) */}
            <EditorialFooter store={store} activeBranch={activeBranch} />

            {/* 4. Mobile Sticky Bottom Action Bar */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 border-t border-karima-brand/10 shadow-xl flex items-center justify-between gap-3">
                <div className="text-left">
                    <span className="text-[10px] uppercase tracking-wider text-stone-400 block">Total</span>
                    <span className="font-serif text-base font-bold text-karima-brand dark:text-stone-100">
                        {formatRupiah(unitPrice * qty)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={isSoldOut || !isStoreOpen}
                        onClick={handleDirectWhatsAppBuy}
                        className="h-11 px-3 rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold flex items-center justify-center cursor-pointer"
                        title="Chat WhatsApp"
                    >
                        <IconBrandWhatsapp size={18} />
                    </button>
                    <button
                        type="button"
                        disabled={isSoldOut || !isStoreOpen}
                        onClick={() => {
                            const target = hasVariants && selectedVariant ? selectedVariant : product;
                            addToCart(target, qty, true);
                        }}
                        className={`h-11 px-5 rounded uppercase tracking-[0.15em] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm ${isSoldOut || !isStoreOpen
                            ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                            : "bg-karima-brand hover:bg-karima-accent text-white cursor-pointer"
                            }`}
                    >
                        <IconShoppingCart size={16} />
                        <span>{isSoldOut ? "Habis" : "Beli"}</span>
                    </button>
                </div>
            </div>

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
                    router.visit(`/katalog/produk/${item.id}`);
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
                onToggleRemember={(v) => setRememberCustomer(v)}
                isAutoFilled={isAutoFilled}
                onResetCustomerInfo={() => {
                    setCustomerName("");
                    setCustomerPhone("");
                    setDeliveryAddress("");
                }}
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
                onSubmitOrder={() => handleSubmitCheckout(false)}
                onOrderWhatsApp={() => handleSubmitCheckout(true)}
                isStoreOpen={isStoreOpen}
            />

            {/* 7. Modals: Size Chart & Branch */}
            <SizeChartModal
                isOpen={showSizeChart}
                onClose={() => setShowSizeChart(false)}
                sizeChart={product?.size_chart || null}
                productTitle={product?.title || ""}
            />

            <BranchSelectorModal
                isOpen={isBranchModalOpen}
                onClose={() => setIsBranchModalOpen(false)}
                branches={branches}
                activeBranch={activeBranch}
            />
        </PublicLayout>
    );
}

