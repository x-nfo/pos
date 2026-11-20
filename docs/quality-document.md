# Module Quality Document

This document records the health score of each subsystem across 5 dimensions: Correctness, Architecture Compliance, Test Coverage, Documentation, and Verification Evidence. Grades range from A (excellent) to D (critical debt).

New agent sessions read this document to understand technical debt and prioritize fixes.

## Subsystem Health Matrix

| Module | Correctness | Architecture | Test Coverage | Documentation | Verification | Overall Grade | Notes |
|--------|:-----------:|:------------:|:-------------:|:-------------:|:------------:|:-------------:|-------|
| **Auth & RBAC** (`app/Http/Controllers/Auth`, Spatie) | A | A | A | A | A | **A** | Stable, protected by step_up & bot.guard middleware |
| **Cashier Shift** (`app/Services/CashierShift.php`) | A | A | A | A | A | **A** | Active shift enforcement on transactions |
| **POS Cart & Checkout** (`app/Http/Controllers/Apps/TransactionController.php`) | A | A | A | A | A | **A** | Core calculation engine, stock mutation linkage |
| **Inventory & Stock** (`app/Services/StockMutation.php`) | A | A | B | A | A | **A-** | Multi-unit conversion and opname audit logs |
| **Payment Gateways** (`app/Services/Payments/`, Midtrans/Xendit) | A | A | B | B | B | **B** | Webhooks require public APP_URL in dev/testing |
| **WhatsApp Service** (`whatsapp-service/`, `app/Services/WhatsAppService.php`) | B | B | B | B | B | **B** | Decoupled Node service; needs separate daemon running |

## Scoring Scale
- **A (90–100%)**: Production-grade, fully tested with automated verification evidence.
- **B (80–89%)**: Functional and reliable; minor documentation or mock testing enhancements possible.
- **C (70–79%)**: Operational but carries tech debt; requires refactoring or coverage boost.
- **D (<70%)**: Unstable or unverified; must be remediated before adding dependent features.

## Update Protocol
At session clock-out, if you modified any code in a module, update its row in this document reflecting current reality.
