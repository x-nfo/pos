# Architecture Decision Records (ADRs)

This document records key architectural decisions made for the Point of Sales application. Cross-session durability relies on tracking these decisions in git.

---

## ADR-001: SQLite In-Memory for Automated Testing
- **Status**: Accepted
- **Context**: Running full integration tests against MySQL requires external database services and slows down agent verification loops.
- **Decision**: Configure `phpunit.xml` with `DB_CONNECTION=sqlite` and `DB_DATABASE=:memory:`.
- **Consequences**: Fast test execution (<2s). Tests must avoid MySQL-specific SQL dialects. Test seeders must set `tax_rate=0` on Product factories when asserting exact order totals to prevent PPN calculation deviations.

---

## ADR-002: Service Layer for POS Transactions and Stock Mutations
- **Status**: Accepted
- **Context**: Direct database mutations inside HTTP controllers lead to code duplication, transaction leakage, and untracked inventory drift.
- **Decision**: Encapsulate stock mutations, cashier shift reconciliations, and payment processing inside `app/Services/` classes (e.g. `StockMutation`, `CashierShift`, `AuditLog`).
- **Consequences**: Controllers remain thin orchestrators handling HTTP request validation and Inertia responses. Core domain operations are safely wrapped inside `DB::transaction`.

---

## ADR-003: Step-Up Authentication for Sensitive Actions
- **Status**: Accepted
- **Context**: In multi-user retail environments, cashier terminals are often left unattended.
- **Decision**: Introduce `EnsureRecentPasswordConfirmation` (`step_up` middleware) on destructive or financial routes (roles, payment settings, bank accounts, cashier adjustments).
- **Consequences**: Users must confirm their password within 15 minutes before executing high-risk administrative operations.

---

## ADR-004: Decoupled Node.js Microservice for WhatsApp CRM
- **Status**: Accepted
- **Context**: PHP execution model is request-response and cannot natively maintain persistent Chromium WebSocket sessions required by `whatsapp-web.js`.
- **Decision**: Run a separate Node.js daemon in `whatsapp-service/` communicating via HTTP REST with Laravel's `WhatsAppService`.
- **Consequences**: Prevents PHP worker starvation while enabling automated receipt delivery and marketing broadcast campaigns.
