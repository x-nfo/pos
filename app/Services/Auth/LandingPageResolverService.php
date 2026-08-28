<?php

namespace App\Services\Auth;

use App\Models\User;

class LandingPageResolverService
{
    /**
     * Resolve the most appropriate landing route name for the given authenticated user.
     */
    public function resolveRouteName(?User $user): string
    {
        if (! $user) {
            return 'login';
        }

        // 1. Super Admin, Admin, and Manager with dashboard access land directly on Dashboard overview
        if ($user->can('dashboard-access')) {
            return 'dashboard';
        }

        // 2. Cashiers and POS operators land directly on POS checkout
        if ($user->can('transactions-access')) {
            return 'transactions.index';
        }

        // 3. Kitchen / Bar / Waiter staff land directly on Dine-in Kitchen Orders
        if ($user->can('dine-orders-access')) {
            return 'dine-orders.index';
        }

        // 4. Warehouse & Logistics staff land on Goods Receiving or Stock Transfers
        if ($user->can('goods-receivings-access')) {
            return 'goods-receivings.index';
        }

        if ($user->can('stock-transfers-access')) {
            return 'stock-transfers.index';
        }

        if ($user->can('purchase-orders-access')) {
            return 'purchase-orders.index';
        }

        // 5. Finance & Accounting staff land on Receivables / Debt Aging
        if ($user->can('receivables-access')) {
            return 'receivables.index';
        }

        if ($user->can('payables-access')) {
            return 'payables.index';
        }

        if ($user->can('reports-access')) {
            return 'reports.sales.index';
        }

        if ($user->can('profits-access')) {
            return 'reports.profits.index';
        }

        if ($user->can('customers-access')) {
            return 'customers.index';
        }

        if ($user->can('suppliers-access')) {
            return 'suppliers.index';
        }

        // Fallback: Access Hub with permitted modules
        return 'dashboard.access';
    }

    /**
     * Resolve the landing URL for the user.
     */
    public function resolveUrl(?User $user): string
    {
        $routeName = $this->resolveRouteName($user);

        return route($routeName, absolute: false);
    }
}
