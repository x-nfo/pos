import { usePage } from "@inertiajs/react";
import { useTranslation } from "react-i18next";
import {
    IconAlertCircle,
    IconArrowsLeftRight,
    IconBox,
    IconBuildingBank,
    IconBuildingStore,
    IconBuildingWarehouse,
    IconChartArrowsVertical,
    IconChartBar,
    IconChartBarPopular,
    IconChartInfographic,
    IconCirclePlus,
    IconClipboardCheck,
    IconClockHour6,
    IconCreditCard,
    IconCrown,
    IconCurrencyDollar,
    IconFileCertificate,
    IconFileDescription,
    IconFileInvoice,
    IconFileSearch,
    IconFolder,
    IconGift,
    IconLayout2,
    IconListDetails,
    IconPrinter,
    IconRulerMeasure,
    IconShoppingCart,
    IconSpeakerphone,
    IconTable,
    IconTarget,
    IconToolsKitchen2,
    IconTruckDelivery,
    IconTruckReturn,
    IconUserBolt,
    IconUserShield,
    IconUsers,
    IconUsersPlus,
    IconWallet,
    IconBrandWhatsapp,
} from "@tabler/icons-react";
import hasAnyPermission from "./Permission";
import React from "react";

export default function Menu() {
    const { t } = useTranslation();
    const { url, props } = usePage();
    const cleanUrl = (url || "").split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

    const pendingApprovalCount = props?.pendingApprovalCount || 0;
    const pendingBankPaymentCount = props?.pendingBankPaymentCount || 0;

    // define grouped menu navigations
    const menuNavigation = [
        // 1. Overview
        {
            title: t("sidebar.sections.overview"),
            details: [
                {
                    title: t("sidebar.items.dashboard"),
                    href: route("dashboard"),
                    active: cleanUrl === "/dashboard",
                    icon: <IconLayout2 size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
            ],
        },

        // 2. Penjualan & Kasir
        {
            title: t("sidebar.sections.salesAndPos", { defaultValue: "Penjualan & Kasir" }),
            details: [
                {
                    title: t("sidebar.items.transactions"),
                    href: route("transactions.index"),
                    active:
                        (cleanUrl === "/dashboard/transactions" ||
                            cleanUrl === "/transactions" ||
                            cleanUrl === "/transactions/mobile" ||
                            cleanUrl === "/dashboard/transactions/mobile") &&
                        !cleanUrl.includes("/history"),
                    icon: <IconShoppingCart size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["transactions-access"]),
                },
                {
                    title: t("sidebar.items.transactionHistory"),
                    href: route("transactions.history"),
                    active: cleanUrl.startsWith("/dashboard/transactions/history"),
                    icon: <IconClockHour6 size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["transactions-access"]),
                    badge:
                        pendingBankPaymentCount > 0 &&
                        hasAnyPermission(["transactions-confirm-payment"])
                            ? pendingBankPaymentCount
                            : null,
                },
                {
                    title: t("sidebar.items.salesReturns"),
                    href: route("sales-returns.index"),
                    active: cleanUrl.startsWith("/dashboard/sales-returns"),
                    icon: <IconFileCertificate size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["sales-returns-access"]),
                },
                {
                    title: t("sidebar.items.receivablesGroup", { defaultValue: "Piutang & Aging" }),
                    icon: <IconFileInvoice size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["receivables-access"]),
                    subdetails: [
                        {
                            title: t("sidebar.items.receivables"),
                            href: route("receivables.index"),
                            active:
                                cleanUrl.startsWith("/dashboard/receivables") &&
                                !cleanUrl.startsWith("/dashboard/aging"),
                            icon: <IconFileInvoice size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["receivables-access"]),
                        },
                        {
                            title: t("sidebar.items.agingReminders"),
                            href: route("aging.index"),
                            active: cleanUrl.startsWith("/dashboard/aging"),
                            icon: <IconChartBar size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["receivables-access"]),
                        },
                    ],
                },
                {
                    title: t("sidebar.items.dineInGroup", { defaultValue: "Resto & Dine-In" }),
                    icon: <IconToolsKitchen2 size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dine-orders-access", "dine-tables-access"]),
                    subdetails: [
                        {
                            title: t("sidebar.items.dineOrders"),
                            href: route("dine-orders.index"),
                            active: cleanUrl.startsWith("/dashboard/dine-orders"),
                            icon: <IconToolsKitchen2 size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["dine-orders-access"]),
                        },
                        {
                            title: t("sidebar.items.dineTables"),
                            href: route("dine-tables.index"),
                            active: cleanUrl.startsWith("/dashboard/dine-tables"),
                            icon: <IconTable size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["dine-tables-access"]),
                        },
                        {
                            title: t("sidebar.items.dineAreas"),
                            href: route("dine-areas.index"),
                            active: cleanUrl.startsWith("/dashboard/dine-areas"),
                            icon: <IconFolder size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["dine-tables-access"]),
                        },
                    ],
                },
                {
                    title: t("sidebar.items.discountApproval"),
                    href: route("discount-approvals.pending"),
                    active: cleanUrl.startsWith("/dashboard/discount-approvals"),
                    icon: <IconAlertCircle size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["discounts-approve"]),
                    badge: pendingApprovalCount,
                },
            ],
        },

        // 3. Inventori & Produk
        {
            title: t("sidebar.sections.inventoryAndCatalog", { defaultValue: "Inventori & Produk" }),
            details: [
                {
                    title: t("sidebar.items.catalog", { defaultValue: "Katalog Produk" }),
                    icon: <IconBox size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission([
                        "products-access",
                        "categories-access",
                        "units-access",
                    ]),
                    subdetails: [
                        {
                            title: t("sidebar.items.products"),
                            href: route("products.index"),
                            active:
                                cleanUrl.startsWith("/dashboard/products") ||
                                cleanUrl.startsWith("/dashboard/catalog"),
                            icon: <IconBox size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["products-access"]),
                        },
                        {
                            title: t("sidebar.items.categories"),
                            href: route("categories.index"),
                            active: cleanUrl.startsWith("/dashboard/categories"),
                            icon: <IconFolder size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["categories-access"]),
                        },
                        {
                            title: t("sidebar.items.units"),
                            href: route("units.index"),
                            active: cleanUrl.startsWith("/dashboard/units"),
                            icon: <IconRulerMeasure size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["units-access"]),
                        },
                    ],
                },
                {
                    title: t("sidebar.items.stockManagement", { defaultValue: "Manajemen Stok" }),
                    icon: <IconClipboardCheck size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission([
                        "stock-opnames-access",
                        "stock-mutations-access",
                        "stock-transfers-access",
                    ]),
                    subdetails: [
                        {
                            title: t("sidebar.items.stockOpname"),
                            href: route("stock-opnames.index"),
                            active: cleanUrl.startsWith("/dashboard/stock-opnames"),
                            icon: <IconFileDescription size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["stock-opnames-access"]),
                        },
                        {
                            title: t("sidebar.items.stockMutations"),
                            href: route("stock-mutations.index"),
                            active: cleanUrl.startsWith("/dashboard/stock-mutations"),
                            icon: <IconChartArrowsVertical size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["stock-mutations-access"]),
                        },
                        {
                            title: t("sidebar.items.stockTransfers"),
                            href: route("stock-transfers.index"),
                            active: cleanUrl.startsWith("/dashboard/stock-transfers"),
                            icon: <IconArrowsLeftRight size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["stock-transfers-access"]),
                        },
                    ],
                },
            ],
        },

        // 4. Pengadaan & Supplier
        {
            title: t("sidebar.sections.procurementAndSuppliers", { defaultValue: "Pengadaan & Supplier" }),
            details: [
                {
                    title: t("sidebar.items.suppliers"),
                    href: route("suppliers.index"),
                    active: cleanUrl.startsWith("/dashboard/suppliers"),
                    icon: <IconBuildingWarehouse size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["suppliers-access"]),
                },
                {
                    title: t("sidebar.items.purchaseOrders"),
                    href: route("purchase-orders.index"),
                    active: cleanUrl.startsWith("/dashboard/purchase-orders"),
                    icon: <IconClipboardCheck size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["purchase-orders-access"]),
                },
                {
                    title: t("sidebar.items.goodsReceiving"),
                    href: route("goods-receivings.index"),
                    active: cleanUrl.startsWith("/dashboard/goods-receivings"),
                    icon: <IconTruckDelivery size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["goods-receivings-access"]),
                },
                {
                    title: t("sidebar.items.supplierReturns"),
                    href: route("supplier-returns.index"),
                    active: cleanUrl.startsWith("/dashboard/supplier-returns"),
                    icon: <IconTruckReturn size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["supplier-returns-access"]),
                },
                {
                    title: t("sidebar.items.supplierPayables"),
                    href: route("payables.index"),
                    active: cleanUrl.startsWith("/dashboard/payables"),
                    icon: <IconCurrencyDollar size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["payables-access"]),
                },
            ],
        },

        // 5. Pelanggan & CRM
        {
            title: t("sidebar.sections.customersAndCrm", { defaultValue: "Pelanggan & CRM" }),
            details: [
                {
                    title: t("sidebar.items.customers"),
                    href: route("customers.index"),
                    active: cleanUrl.startsWith("/dashboard/customers"),
                    icon: <IconUsersPlus size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["customers-access"]),
                },
                {
                    title: t("sidebar.items.memberLoyalty", { defaultValue: "Member & Loyalitas" }),
                    icon: <IconCrown size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["customers-access", "loyalty-settings-access"]),
                    subdetails: [
                        {
                            title: t("sidebar.items.members"),
                            href: route("members.index"),
                            active: cleanUrl.startsWith("/dashboard/members"),
                            icon: <IconCrown size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["customers-access"]),
                        },
                        {
                            title: t("sidebar.items.loyalty"),
                            href: route("settings.loyalty"),
                            active: cleanUrl.startsWith("/dashboard/settings/loyalty"),
                            icon: <IconGift size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["loyalty-settings-access"]),
                        },
                    ],
                },
                {
                    title: t("sidebar.items.promoDiscount", { defaultValue: "Promo & Diskon" }),
                    icon: <IconGift size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission([
                        "pricing-rules-access",
                        "customer-vouchers-access",
                        "price-lists-access",
                    ]),
                    subdetails: [
                        {
                            title: t("sidebar.items.pricePromos"),
                            href: route("pricing-rules.index"),
                            active: cleanUrl.startsWith("/dashboard/pricing-rules"),
                            icon: <IconChartInfographic size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["pricing-rules-access"]),
                        },
                        {
                            title: t("sidebar.items.customerVouchers"),
                            href: route("customer-vouchers.index"),
                            active: cleanUrl.startsWith("/dashboard/customer-vouchers"),
                            icon: <IconCreditCard size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["customer-vouchers-access"]),
                        },
                        {
                            title: t("sidebar.items.priceLists"),
                            href: route("price-lists.index"),
                            active: cleanUrl.startsWith("/dashboard/settings/price-lists"),
                            icon: <IconListDetails size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["price-lists-access"]),
                        },
                    ],
                },
                {
                    title: t("sidebar.items.crmBroadcast", { defaultValue: "CRM & Notifikasi" }),
                    icon: <IconSpeakerphone size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission([
                        "crm-campaigns-access",
                        "crm-reminders-access",
                        "customer-segments-access",
                    ]),
                    subdetails: [
                        {
                            title: t("sidebar.items.crmCampaigns"),
                            href: route("crm-campaigns.index"),
                            active: cleanUrl.startsWith("/dashboard/crm-campaigns"),
                            icon: <IconSpeakerphone size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["crm-campaigns-access"]),
                        },
                        {
                            title: t("sidebar.items.crmReminders"),
                            href: route("crm-reminders.index"),
                            active: cleanUrl.startsWith("/dashboard/crm-reminders"),
                            icon: <IconClockHour6 size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["crm-reminders-access"]),
                        },
                        {
                            title: t("sidebar.items.customerSegments"),
                            href: route("customer-segments.index"),
                            active: cleanUrl.startsWith("/dashboard/customer-segments"),
                            icon: <IconUsers size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["customer-segments-access"]),
                        },
                    ],
                },
            ],
        },

        // 6. Laporan & Analisis
        {
            title: t("sidebar.sections.reportsAndAnalytics", { defaultValue: "Laporan & Analisis" }),
            details: [
                {
                    title: t("sidebar.items.salesReport"),
                    href: route("reports.sales.index"),
                    active: cleanUrl.startsWith("/dashboard/reports/sales"),
                    icon: <IconChartArrowsVertical size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["reports-access"]),
                },
                {
                    title: t("sidebar.items.profitReport"),
                    href: route("reports.profits.index"),
                    active: cleanUrl.startsWith("/dashboard/reports/profits"),
                    icon: <IconChartBarPopular size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["profits-access"]),
                },
                {
                    title: t("sidebar.items.advancedInsights"),
                    href: route("reports.insights.index"),
                    active: cleanUrl.startsWith("/dashboard/reports/insights"),
                    icon: <IconChartBar size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["reports-access"]),
                },
            ],
        },

        // 7. Sistem & Pengaturan
        {
            title: t("sidebar.sections.systemAndSettings", { defaultValue: "Sistem & Pengaturan" }),
            details: [
                {
                    title: t("sidebar.sections.operations", { defaultValue: "Operasional" }),
                    icon: <IconWallet size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["cashier-shifts-access", "audit-logs-access"]),
                    subdetails: [
                        {
                            title: t("sidebar.items.cashierShifts"),
                            href: route("cashier-shifts.index"),
                            active: cleanUrl.startsWith("/dashboard/cashier-shifts"),
                            icon: <IconWallet size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["cashier-shifts-access"]),
                        },
                        {
                            title: t("sidebar.items.auditLogs"),
                            href: route("audit-logs.index"),
                            active: cleanUrl.startsWith("/dashboard/audit-logs"),
                            icon: <IconFileSearch size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["audit-logs-access"]),
                        },
                    ],
                },
                {
                    title: t("sidebar.sections.userManagement", { defaultValue: "Manajemen User" }),
                    icon: <IconUsers size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission([
                        "users-access",
                        "roles-access",
                        "permissions-access",
                    ]),
                    subdetails: [
                        {
                            title: t("sidebar.items.usersList"),
                            href: route("users.index"),
                            active:
                                (cleanUrl === "/dashboard/users" ||
                                    cleanUrl.startsWith("/dashboard/users?") ||
                                    cleanUrl.startsWith("/dashboard/users/")) &&
                                !cleanUrl.startsWith("/dashboard/users/create"),
                            icon: <IconTable size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["users-access"]),
                        },
                        {
                            title: t("sidebar.items.usersCreate"),
                            href: route("users.create"),
                            active: cleanUrl.startsWith("/dashboard/users/create"),
                            icon: <IconCirclePlus size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["users-create"]),
                        },
                        {
                            title: t("sidebar.items.roles"),
                            href: route("roles.index"),
                            active: cleanUrl.startsWith("/dashboard/roles"),
                            icon: <IconUserShield size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["roles-access"]),
                        },
                        {
                            title: t("sidebar.items.permissions"),
                            href: route("permissions.index"),
                            active: cleanUrl.startsWith("/dashboard/permissions"),
                            icon: <IconUserBolt size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["permissions-access"]),
                        },
                    ],
                },
                {
                    title: t("sidebar.items.storeSettings", { defaultValue: "Pengaturan Toko" }),
                    icon: <IconBuildingStore size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission([
                        "store-settings-access",
                        "printer-settings-access",
                        "payment-settings-access",
                        "whatsapp-settings-access",
                        "warehouses-access",
                        "target-settings-access",
                    ]),
                    subdetails: [
                        {
                            title: t("sidebar.items.storeProfile", { defaultValue: "Profil Toko" }),
                            href: route("settings.store"),
                            active:
                                cleanUrl.startsWith("/dashboard/settings/store") ||
                                cleanUrl.startsWith("/dashboard/settings/branding"),
                            icon: <IconBuildingStore size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["store-settings-access"]),
                        },
                        {
                            title: t("sidebar.items.printers"),
                            href: route("settings.printer"),
                            active: cleanUrl.startsWith("/dashboard/settings/printer"),
                            icon: <IconPrinter size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["printer-settings-access"]),
                        },
                        {
                            title: t("sidebar.items.paymentGateway"),
                            href: route("settings.payments.edit"),
                            active: cleanUrl.startsWith("/dashboard/settings/payments"),
                            icon: <IconCreditCard size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["payment-settings-access"]),
                        },
                        {
                            title: t("sidebar.items.bankAccounts"),
                            href: route("settings.bank-accounts.index"),
                            active: cleanUrl.startsWith("/dashboard/settings/bank-accounts"),
                            icon: <IconBuildingBank size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["payment-settings-access"]),
                        },
                        {
                            title: t("sidebar.items.whatsApp"),
                            href: route("settings.whatsapp"),
                            active: cleanUrl.startsWith("/dashboard/settings/whatsapp"),
                            icon: <IconBrandWhatsapp size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["whatsapp-settings-access"]),
                        },
                        {
                            title: t("sidebar.items.warehouses"),
                            href: route("settings.warehouses.index"),
                            active: cleanUrl.startsWith("/dashboard/settings/warehouses"),
                            icon: <IconBuildingWarehouse size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["warehouses-access"]),
                        },
                        {
                            title: t("sidebar.items.salesTarget"),
                            href: route("settings.target"),
                            active: cleanUrl.startsWith("/dashboard/settings/target"),
                            icon: <IconTarget size={18} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["target-settings-access"]),
                        },
                    ],
                },
            ],
        },
    ];

    return menuNavigation;
}
