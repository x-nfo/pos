import React, { useState, useEffect, useMemo } from "react";
import { Head, router } from "@inertiajs/react";
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
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [deliveryMethod, setDeliveryMethod] = useState(() => {
        if (store.delivery_enabled === false) return "pickup";
        return "delivery";
    });
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [orderNotes, setOrderNotes] = useState("");

    // Detail modal quantity
    const [modalQty, setModalQty] = useState(1);

    // Save cart to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        } catch (e) {
            console.error("Failed to save cart to localStorage", e);
        }
    }, [cart]);

    // Reset modal quantity when selecting a different product
    useEffect(() => {
        if (selectedProduct) {
            const existing = cart.find((item) => item.id === selectedProduct.id);
            setModalQty(existing ? existing.qty : 1);
        }
    }, [selectedProduct]);

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
    const addToCart = (product, quantity = 1, showToast = true) => {
        if (product.stock <= 0) {
            toast.error("Maaf, stok produk ini habis");
            return;
        }

        setCart((prev) => {
            const existingIndex = prev.findIndex((item) => item.id === product.id);
            if (existingIndex > -1) {
                const current = prev[existingIndex];
                const newQty = Math.min(product.stock, current.qty + quantity);
                const updated = [...prev];
                updated[existingIndex] = { ...current, qty: newQty };
                return updated;
            }
            return [
                ...prev,
                {
                    id: product.id,
                    title: product.title,
                    sell_price: product.sell_price,
                    final_price: product.final_price,
                    image: product.image,
                    category_name: product.category_name,
                    stock: product.stock,
                    qty: Math.min(product.stock, quantity),
                },
            ];
        });

        if (showToast) {
            toast.success(`${product.title} ditambahkan`, {
                icon: "🛒",
                duration: 1500,
            });
        }
    };

    const updateCartQty = (productId, newQty) => {
        if (newQty <= 0) {
            removeFromCart(productId);
            return;
        }

        setCart((prev) =>
            prev.map((item) => {
                if (item.id === productId) {
                    const finalQty = Math.min(item.stock, newQty);
                    return { ...item, qty: finalQty };
                }
                return item;
            })
        );
    };

    const removeFromCart = (productId) => {
        setCart((prev) => prev.filter((item) => item.id !== productId));
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
    const handleWhatsAppCheckout = () => {
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

        const storeDisplayName = activeBranch
            ? `${store.name || "Toko"} (${activeBranch.name})`
            : (store.name || "Toko");

        const effectiveDeliveryMethod = isDeliveryAllowed ? deliveryMethod : "pickup";

        const message = generateWhatsAppOrderMessage({
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

        toast.success("Membuka obrolan WhatsApp...", { duration: 3000 });
    };

    // Instant buy from modal
    const handleInstantBuy = (product, qty) => {
        if (!customerName.trim()) {
            addToCart(product, qty, false);
            setSelectedProduct(null);
            setIsCartOpen(true);
            toast("Silakan lengkapi data pemesan di keranjang", { icon: "📝" });
            return;
        }

        const storeDisplayName = activeBranch
            ? `${store.name || "Toko"} (${activeBranch.name})`
            : (store.name || "Toko");

        const message = generateWhatsAppOrderMessage({
            storeName: storeDisplayName,
            items: [
                {
                    id: product.id,
                    title: product.title,
                    sell_price: product.sell_price,
                    final_price: product.final_price,
                    qty,
                },
            ],
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            deliveryMethod: isDeliveryAllowed ? deliveryMethod : "pickup",
            deliveryAddress: isDeliveryAllowed && deliveryMethod === "delivery" ? deliveryAddress.trim() : "",
            notes: orderNotes.trim(),
            totalAmount: (product.final_price || product.sell_price) * qty,
        });

        openWhatsAppOrder({
            phone: store.wa_number || store.phone,
            message,
        });

        setSelectedProduct(null);
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
                            const inCart = cart.find((item) => item.id === product.id);
                            const price = product.final_price || product.sell_price;

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
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                                <IconPhotoOff size={32} />
                                                <span className="text-[10px] mt-1">No Image</span>
                                            </div>
                                        )}

                                        {/* Promo Badge */}
                                        {product.has_discount && (
                                            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 py-0.5 rounded-md bg-rose-500 text-white font-bold text-[10px] sm:text-[11px] shadow-xs flex items-center gap-0.5">
                                                <IconSparkles size={11} />
                                                <span>-{product.discount_percentage}%</span>
                                            </div>
                                        )}

                                        {/* Stock indicator badge */}
                                        {product.stock <= 5 && product.stock > 0 && (
                                            <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 px-1.5 py-0.5 rounded-md bg-amber-500/90 text-white font-semibold text-[9px] sm:text-[10px] backdrop-blur-xs">
                                                Sisa {product.stock}
                                            </div>
                                        )}
                                    </div>

                                    {/* Product Details */}
                                    <div className="p-2 sm:p-3.5 flex-1 flex flex-col justify-between">
                                        <div>
                                            {product.category_name && (
                                                <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5 truncate">
                                                    {product.category_name}
                                                </span>
                                            )}

                                            <h3
                                                onClick={() => setSelectedProduct(product)}
                                                className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 min-h-[30px] sm:min-h-[40px] leading-snug hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer transition-colors"
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
                                                {product.has_discount && (
                                                    <span className="text-[10px] text-slate-400 line-through block truncate">
                                                        {formatRupiah(product.sell_price)}
                                                    </span>
                                                )}
                                                <span className="text-xs sm:text-sm md:text-base font-extrabold text-primary-600 dark:text-primary-400 block truncate">
                                                    {formatRupiah(price)}
                                                </span>
                                            </div>

                                            {/* Add to Cart / Stepper Button */}
                                            {inCart ? (
                                                <div className="flex items-center bg-primary-50 dark:bg-primary-950/50 rounded-lg p-0.5 border border-primary-200 dark:border-primary-800 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateCartQty(product.id, inCart.qty - 1);
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
                                                            updateCartQty(product.id, inCart.qty + 1);
                                                        }}
                                                        disabled={inCart.qty >= product.stock}
                                                        className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-primary-600 text-white flex items-center justify-center disabled:opacity-40 shadow-xs"
                                                    >
                                                        <IconPlus size={11} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        addToCart(product, 1);
                                                    }}
                                                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-90 text-white flex items-center justify-center shrink-0 shadow-xs transition-all"
                                                    title="Tambah ke keranjang"
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
                            {store?.operating_status && !store.operating_status.is_open && (
                                <div
                                    className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                                        store.operating_status.status === "temporarily_closed"
                                            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200"
                                            : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200"
                                    }`}
                                >
                                    <IconAlertCircle
                                        size={18}
                                        className={`shrink-0 mt-0.5 ${
                                            store.operating_status.status === "temporarily_closed"
                                                ? "text-rose-600 dark:text-rose-400"
                                                : "text-amber-600 dark:text-amber-400"
                                        }`}
                                    />
                                    <div className="space-y-0.5 flex-1">
                                        <span className="font-bold block">
                                            {store.operating_status.status === "temporarily_closed"
                                                ? "Toko Sedang Tutup Sementara"
                                                : `Toko Sedang Tutup (${store.operating_status.badge_text})`}
                                        </span>
                                        <p className="text-[11px] leading-relaxed opacity-90">
                                            {store.operating_status.status === "temporarily_closed"
                                                ? `${store.operating_status.closure_reason || "Sedang libur operasional"}.${
                                                      store.operating_status.reopen_date_formatted
                                                          ? ` Buka kembali: ${store.operating_status.reopen_date_formatted}.`
                                                          : ""
                                                  } Pesanan Anda tetap dapat dikirim via WhatsApp dan akan diproses saat toko beroperasi kembali.`
                                                : "Pesanan Anda via WhatsApp tetap dapat dikirim dan akan diproses segera saat jam operasional toko dibuka."}
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

                                        return (
                                            <div
                                                key={item.id}
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
                                                    <div className="text-xs font-semibold text-primary-600 dark:text-primary-400 mt-0.5">
                                                        {formatRupiah(price)}
                                                    </div>

                                                    {/* Stepper */}
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCartQty(item.id, item.qty - 1)}
                                                                className="w-5 h-5 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                                                            >
                                                                <IconMinus size={11} />
                                                            </button>
                                                            <span className="text-xs font-bold text-slate-900 dark:text-white px-2">
                                                                {item.qty}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateCartQty(item.id, item.qty + 1)}
                                                                disabled={item.qty >= item.stock}
                                                                className="w-5 h-5 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40"
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
                                                    onClick={() => removeFromCart(item.id)}
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
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Data Pemesan
                                    </h3>

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
                                    onClick={handleWhatsAppCheckout}
                                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
                                >
                                    <IconBrandWhatsapp size={18} />
                                    Kirim Pesanan via WhatsApp
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
                            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                            <IconX size={18} />
                        </button>

                        <div className="aspect-video w-full rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3 sm:mb-4 flex items-center justify-center border border-slate-200/80 dark:border-slate-700">
                            {selectedProduct.image ? (
                                <img
                                    src={selectedProduct.image}
                                    alt={selectedProduct.title}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="flex flex-col items-center text-slate-400">
                                    <IconPhotoOff size={40} />
                                    <span className="text-xs mt-1">Foto Belum Tersedia</span>
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
                            <span className="text-lg sm:text-xl font-extrabold text-primary-600 dark:text-primary-400">
                                {formatRupiah(selectedProduct.final_price || selectedProduct.sell_price)}
                            </span>
                            {selectedProduct.has_discount && (
                                <>
                                    <span className="text-xs text-slate-400 line-through">
                                        {formatRupiah(selectedProduct.sell_price)}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                                        -{selectedProduct.discount_percentage}%
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 py-1.5 border-y border-slate-100 dark:border-slate-800">
                            <span>
                                Stok:{" "}
                                <strong className="text-slate-800 dark:text-slate-200">
                                    {selectedProduct.stock} unit
                                </strong>
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

                        {/* Stepper & Action Buttons */}
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2">
                            <div className="flex items-center justify-between w-full sm:w-auto gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-medium text-slate-500 pl-2 sm:hidden">
                                    Jumlah:
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs"
                                    >
                                        <IconMinus size={14} />
                                    </button>
                                    <span className="w-6 text-center font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                        {modalQty}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setModalQty((q) => Math.min(selectedProduct.stock, q + 1))
                                        }
                                        disabled={modalQty >= selectedProduct.stock}
                                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs disabled:opacity-40"
                                    >
                                        <IconPlus size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:flex sm:flex-1 gap-2 w-full">
                                <button
                                    type="button"
                                    onClick={() => {
                                        addToCart(selectedProduct, modalQty);
                                        setSelectedProduct(null);
                                    }}
                                    className="py-2.5 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                                >
                                    <IconShoppingCart size={16} />
                                    + Keranjang
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleInstantBuy(selectedProduct, modalQty)}
                                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                                >
                                    <IconBrandWhatsapp size={16} />
                                    Beli via WA
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
