# Application Layer Architecture & Constraints

This document describes the design rules and constraints governing code inside the `app/` directory.

## Layer Boundaries

1. **HTTP Controllers (`app/Http/Controllers/Apps/`)**:
   - Thin presentation controllers.
   - Responsible for request validation, authorization checks via Spatie permissions or policies, and delegating to services.
   - Return Inertia responses (`Inertia::render(...)`) or JSON responses for API webhooks.
   - **Forbidden**: Direct raw SQL queries or complex business math inside controller actions.

2. **Domain Services (`app/Services/`)**:
   - Encapsulate all stateful business operations.
   - Examples: `AuditLog`, `CashierShift`, `StockMutation`, `PricingService`, `WhatsAppService`.
   - All multi-table updates must be wrapped in `DB::transaction(...)`.
   - Never generate HTTP redirects or Inertia responses directly from services.

3. **Models & Eloquent (`app/Models/`)**:
   - Define table schemas, relationships, accessors, and scopes.
   - Guarded fields: `$guarded = ['id']`.
   - Cascade soft deletes and audit logging where required.

4. **Middleware (`app/Http/Middleware/`)**:
   - `permission`: Spatie role-based access control on dashboard routes.
   - `active_shift`: Ensures cashier shift is active before processing cart or transactions.
   - `step_up`: Re-authenticates passwords for sensitive administrative operations.
   - `bot.guard`: Rate limits and detects bot submissions on authentication entrypoints.

## Proximity Constraints
- Any architectural constraint caught during review must be codified into `.harness/arch-rules.json` so `make check-arch` enforces it automatically.
