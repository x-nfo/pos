# System Under Review: Point of Sales (POS) System

## Run Metadata
- **Project**: Point of Sales (Laravel 13 + Inertia 3.0 + React 19)
- **Git Commit**: `3b45d8a` (branch `pos-fashion`)
- **Review Date**: 2026-11-20
- **Mode**: `quick`
- **Primary Architecture**: `payments-transactions`
- **Secondary Architecture**: `web`
- **Review Scope**: `security`
- **Library Root**: `~/.local/share/grim-prompter`
- **Run Directory**: `threat-model/2026-11-20-quick-payments-transactions`

---

## 1. System Overview & Core Invariants
The system is an open-source retail and wholesale Point of Sales (POS) engine.
Key business and security invariants:
1. **Transaction Integrity**: Every completed checkout must reconcile exact pricing, applied discounts/vouchers, customer loyalty points, tax rates, and warehouse-specific inventory deductions wrapped in `DB::transaction(...)`.
2. **Shift Accountability**: A cashier cannot initiate or complete transactions without an active, verified cashier shift (`active_shift` middleware). Cash drawer balances cannot be reconciled concurrently (`lockForUpdate` on shift records).
3. **Webhook Verification**: Payment gateway callbacks (Midtrans, Xendit, QRISLY) must authenticate payload integrity and authenticity before transitioning invoice status to `paid` or triggering auto-printing and stock mutations.
4. **Step-Up Authorization**: High-privilege administrative settings (payment gateway credentials, roles, bank accounts) require password re-authentication (`step_up` middleware).

---

## 2. Trust Boundaries & Entry Points

```
[Untrusted Public Internet]
        │
        ├─► (EP-01) POST /api/webhooks/midtrans  ─── [Trust Boundary T1: Webhook Auth]
        ├─► (EP-02) POST /api/webhooks/xendit    ─── [Trust Boundary T1: Webhook Auth]
        ├─► (EP-03) POST /api/webhooks/qrisly    ─── [Trust Boundary T1: Webhook Auth]
        ├─► (EP-04) POST /api/v1/auth/login      ─── [Trust Boundary T2: Public Auth / BotGuard]
        │
[Cashier Terminal / Client Device]
        │
        └─► (EP-05) POST /api/v1/pos/checkout    ─── [Trust Boundary T3: Cashier Role / Active Shift]
                    POST /apps/transactions
```

### Trust Boundaries
- **T1 (Public Internet to Webhook Receiver)**: Requests arrive without session cookies. Authenticated exclusively via cryptographic signatures (`signature_key` or `X-CALLBACK-TOKEN`).
- **T2 (Public Internet to Login Endpoints)**: Rate-limited and guarded by `bot.guard` (honeypot + response timer).
- **T3 (Cashier Client to POS Core)**: Requires Sanctum Bearer token or web session, Spatie `permission:transactions.index`, and `EnsureActiveCashierShift`.
- **T4 (Application to Payment Gateway APIs)**: Outbound HTTPS API calls carrying merchant credentials (server key, secret API key).
- **T5 (Application to Database Engine)**: Local relational storage enforcing row-level locking (`lockForUpdate`) during stock and shift state transitions.

---

## 3. Inspection Ledger

| File Locator | Inspection Extent | Findings Summary |
|---|---|---|
| `routes/api.php` | Full read (Lines 1–105) | Public webhook routes mapped to `PaymentWebhookController`; protected POS endpoints behind Sanctum. |
| `app/Http/Controllers/Api/PaymentWebhookController.php` | Full read (Lines 1–280) | Signature validation for Midtrans, Xendit, and QRISLY; status transition logic; restock triggers. |
| `app/Services/CheckoutService.php` | Full read (Lines 1–320) | Pessimistic locking on shifts and products; loyalty points validation; `DB::transaction` wrapping. |
| `app/Http/Middleware/EnsureActiveCashierShift.php` | Full read | Enforces cashier shift presence on POS routes. |
| `app/Http/Middleware/EnsureRecentPasswordConfirmation.php` | Full read | Step-up re-authentication within 15-minute window for sensitive actions. |
| `app/Models/PaymentSetting.php` | Full read | Secret resolution via `resolvedSecret(...)` fallback to environment config. |
| `.harness/arch-rules.json` | Full read | Prevents secret leakage and direct DB execution in frontend JS. |

---

## 4. Key Assets & Threat Targets
- **A-01**: Cash drawer physical currency & shift accounting balances (`cashier_shifts`).
- **A-02**: Warehouse inventory quantities (`product_warehouses`, `stock_mutations`).
- **A-03**: Payment settlement status (`transactions.payment_status = 'paid'`).
- **A-04**: Third-party payment gateway credentials (`midtrans_server_key`, `xendit_secret_key`).
- **A-05**: Customer receivable balances for pay-later orders (`receivables`).
