# Threat Modeling Report: Point of Sales (POS) System

> **Analysis Scope & Method**: Quick Payments and Transactions Threat Analysis (`payments-transactions` with `web` lens).  
> **Target Revision**: Git commit `3b45d8a` (branch `pos-fashion`).  
> **Tool & Framework**: Grim Prompter (Agent Skill `threat-model`, created by Jim Manico).  
> **Notice**: This report is a static design and source-code threat analysis. It does *not* constitute a dynamic penetration test, runtime vulnerability scan, or compliance certification. Planned verifications remain `not_run` until explicitly executed.

---

## 1. Inspection Coverage

The threat analysis inspected the core transactional and payment ingestion pathways of the application:
- **Routes & Entrypoints**: `routes/api.php` (Lines 1–105), `routes/web.php` (reviewed).
- **Payment Ingestion Controller**: `app/Http/Controllers/Api/PaymentWebhookController.php` (Lines 1–280).
- **Checkout & Transaction Logic**: `app/Services/CheckoutService.php` (Lines 1–320).
- **Security Middleware**: `app/Http/Middleware/EnsureActiveCashierShift.php`, `EnsureRecentPasswordConfirmation.php`.
- **Architectural Guardrails**: `.harness/arch-rules.json`.

*Exclusions*: Third-party vendor dependencies inside `vendor/` and `node_modules/` were excluded from deep static tracing.

---

## 2. System Overview & Trust Boundaries

The Point of Sales system handles money, physical cash drawers, customer debts (*receivables*), and real-time inventory balances.

### Core Trust Boundaries Mapped:
1. **Boundary T1 (Public Internet ↔ Webhook Receivers)**:
   - Separates arbitrary internet callers from `/api/webhooks/*` endpoints.
   - Authentication must rely strictly on cryptographic hash verification (`signature_key` or `X-CALLBACK-TOKEN`).
2. **Boundary T2 (Cashier Client ↔ POS Transaction Core)**:
   - Separates POS hardware/browser terminals from transaction creation and cash shift balances.
   - Protected by Spatie permissions, Sanctum bearer tokens, and `active_shift` middleware.
3. **Boundary T3 (POS Core ↔ Database & Stock Mutations)**:
   - Protected via atomic `DB::transaction(...)` blocks with row-level locks (`lockForUpdate`) on shifts and stock items.

---

## 3. Grounded Threat Scenarios

### [THREAT-001] Timing Attack on Midtrans Webhook Signature Verification
- **Category**: Tampering / Elevation of Privilege
- **Affected Elements**: `PaymentWebhookController.php#L65-L72`, Boundary T1
- **Objective**: Prevent unauthorized adversaries from forging payment callbacks and marking transactions as `paid` without true settlement.
- **Evidence**:
  ```php
  // app/Http/Controllers/Api/PaymentWebhookController.php:70
  if ($signatureKey !== $expectedSignature) {
      return response()->json(['status' => 'error', 'message' => 'Invalid signature'], 403);
  }
  ```
  The code uses non-constant-time string comparison (`!==`). In high-precision timing measurements, non-constant-time comparison can theoretically expose matching prefix bytes.
- **Existing Control**: Signature calculation formula matches Midtrans specs (`sha512(orderId + statusCode + grossAmount + serverKey)`).
- **Proposed Treatment [TRT-001]**:
  Replace `!==` with `hash_equals($expectedSignature, (string) $signatureKey)`. (Contrast with Xendit handler at L130 which correctly uses `hash_equals`).

---

### [THREAT-002] Ambiguous Order Match via Price Collision in QRISLY Webhooks
- **Category**: Spoofing / Data Integrity Race Condition
- **Affected Elements**: `PaymentWebhookController.php#L168-L178`, Boundary T1
- **Objective**: Maintain strictly deterministic 1:1 invoice to transaction settlement.
- **Evidence**:
  ```php
  // app/Http/Controllers/Api/PaymentWebhookController.php:170
  if (! $transaction && ! empty($data['original_amount'])) {
      $transaction = Transaction::where('payment_method', PaymentSetting::GATEWAY_QRISLY)
          ->where('payment_status', 'pending')
          ->where('grand_total', (int) $data['original_amount'])
          ->latest()
          ->first();
  }
  ```
  If a QRISLY notification is missing an explicit invoice ID, the system falls back to matching the *latest pending transaction with the exact same grand total*. If multiple shoppers purchase identical items concurrently, Customer A's payment could mark Customer B's order as paid.
- **Proposed Treatment [TRT-002]**:
  Deprecate and remove amount-only fallback. Require a verified invoice or unique order reference; if absent, reject the webhook with HTTP 422/404 and log for manual reconciliation.

---

### [THREAT-003] Physical Terminal Impersonation on Unattended Cashier Stations
- **Category**: Unauthorized Action / Physical Security
- **Affected Elements**: `CheckoutService.php#L80-L95`, `EnsureActiveCashierShift.php`, Boundary T2
- **Objective**: Prevent unauthorized sales processing or drawer operations during temporary cashier absence.
- **Evidence**:
  The system verifies that the authenticated user has an active shift (`EnsureActiveCashierShift`), but POS web sessions remain active indefinitely without client-side screen lock or transaction-level PIN prompts.
- **Proposed Treatment [TRT-003]**:
  Introduce a lightweight idle-screen lock on the POS frontend after 3 minutes of inactivity, requiring the cashier to enter a quick 4-digit PIN before resuming cart actions.

---

## 4. Protective Controls Implemented

| Control ID | Component | Status | Protection Description |
|---|---|:---:|---|
| **CTRL-001** | `PaymentWebhookController.php` (Xendit) | Implemented | Constant-time token verification using `hash_equals($expectedToken, $callbackToken)`. |
| **CTRL-002** | `CheckoutService.php` | Implemented | Concurrency protection using `lockForUpdate()` on cashier shift and inventory items inside `DB::transaction(...)`. |
| **CTRL-003** | `HandleInertiaRequests.php` & `.harness/arch-rules.json` | Implemented | Architectural boundary preventing server API secrets from leaking into client-side JS bundles. |

---

## 5. Verification Plan

| Verification ID | Target Threat | Command / Test Plan | Expected Criteria |
|---|---|---|---|
| **VERIF-001** | THREAT-001 | `php artisan test --filter=PaymentWebhookTest` | Assert Midtrans webhook rejects invalid signatures with HTTP 403 via `hash_equals`. |
| **VERIF-002** | THREAT-002 | `php artisan test --filter=PaymentWebhookTest::test_qrisly_webhook` | Assert ambiguous QRISLY webhook without invoice fails safely without settling arbitrary orders. |
| **VERIF-003** | THREAT-003 | `npx playwright test tests/e2e/pos-shift.spec.js` | Validate cashier session behavior and shift boundary controls. |

---

## 6. Open Gaps & Technical Debt
- **GAP-001 (Network Ingress Whitelisting)**: Midtrans and Xendit IP range whitelisting is not enforced at the application middleware level. If server firewalls allow open ingress, any IP can send probing packets to `/api/webhooks/*`.
  - *Recommendation*: Add an optional IP-filtering middleware for known payment provider IP ranges or rely on reverse proxy (Cloudflare/Nginx) IP restrictions.
