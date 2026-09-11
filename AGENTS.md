# AGENTS.md — Point of Sales

Open-source POS system (200+ stars). Laravel 13 + Inertia 3.0 + React 19.

## Important: This Repo

**Remote:** `git@github.com:aryadwiputra/point-of-sales.git`

**Branch structure:**
- `main` — production. Protected. PR only from `development`.
- `development` — integration branch. Feature branches merge here via PR.
- `release/*` — release candidates. Created from `development`, merged to `main` + tagged.
- `revamp-frontend` — legacy UI overhaul branch (inactive).
- `feature/*` — individual feature work. Branch from `development`, PR to `development`.
- `fix/*` — hotfixes. Branch from `main`, PR to `main` + `development`.

**Tags follow semver:** `v1.0.0`, `v2.1.0`, etc.

## Stack

- **Backend**: Laravel 13 (PHP 8.3+)
- **Frontend**: Inertia.js 3.0 + React 19, Vite 5
- **Styling**: Tailwind CSS 3 (custom theme in `tailwind.config.js`)
- **Auth/RBAC**: Spatie Laravel Permission + Laravel Breeze
- **DB**: MySQL (default); SQLite in-memory for tests
- **Payment gateways**: Midtrans, Xendit (webhooks in `routes/api.php`)
- **WhatsApp**: whatsapp-web.js via separate Node service (`whatsapp-service/`)

## Developer Commands

```bash
# Initial setup
cp .env.example .env
composer install && npm install
php artisan key:generate
php artisan migrate --seed
php artisan storage:link

# Dev servers — run BOTH
npm run dev          # Vite HMR
php artisan serve    # Laravel

# Testing
php artisan test                     # all
php artisan test --filter=FooTest    # one class
php artisan test --filter=test_name  # one method

# WhatsApp Service (separate terminal)
cd whatsapp-service
npm install && npm start             # port 3001

# PM2 for production
pm2 start whatsapp-service/server.js --name wa-service

# Import/Export
php artisan make:export ProductsExport --model=Product
php artisan make:import ProductsImport --model=Product

# Formatting
vendor/bin/pint

# Production build
npm run build
```

## Architecture

- **Controllers**: `app/Http/Controllers/Apps/` — per-module controllers
- **Services**: `app/Services/` — business logic: AuditLog, CashierShift, StockMutation, Payments/, PricingService, CrmAutomationService, etc.
- **Layouts**: `POSLayout.jsx` (POS), `DashboardLayout.jsx` (admin), `AuthenticatedLayout.jsx` (profile), `GuestLayout.jsx` (auth)
- **Routes**: `routes/web.php` (~50+ dashboard routes), `routes/api.php` (webhooks), `routes/auth.php` (Breeze)
- **Inertia shared props**: `HandleInertiaRequests.php` — auth, permissions, notifications (low stock, receivables, payables aging), active shift, store profile, appVersion
- **Services**: `app/Services/` — ~21 services, latest: WhatsAppService (HTTP wrapper to Node)

## Middleware

| Alias | Class | Applied to |
|-------|-------|------------|
| `permission` | Spatie PermissionMiddleware | Every dashboard route |
| `step_up` | EnsureRecentPasswordConfirmation | Sensitive create/update/delete: roles, users, payment settings, bank accounts, payment confirm |
| `active_shift` | EnsureActiveCashierShift | All POS transaction actions (cart CRUD, hold/resume, checkout) |
| `bot.guard` | EnsureBotGuard | Login/register/forgot-password (honeypot + timer) |
| `registration.enabled` | EnsurePublicRegistrationEnabled | Register route (default: off) |

## Seeder Chain

`DatabaseSeeder` runs in exact order with permission cache reset before & after:

```
PermissionSeeder → RoleSeeder → UserSeeder → PaymentSettingSeeder → SampleDataSeeder → OperationalCoreSeeder → FeatureCoverageSeeder
```

**Default users:** `admin@mail.com` / `password` (admin), `kasir@mail.com` / `password` (cashier)

## Critical Gotchas

1. **Permission cache stale after seed** — logout + login again. Seeder resets cache but session still holds old permissions.
2. **Webhooks need public APP_URL** — Midtrans/Xendit won't work with localhost.
3. **Product images need storage:link** — `php artisan storage:link` or images won't render.
4. **Missing migrations cause 500 on new modules** — run `php artisan migrate` for newer modules (purchase orders, goods receiving, supplier returns, stock opname, etc.).
5. **Tests force SQLite in-memory** — `phpunit.xml` sets `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`. Don't assume MySQL features. **Set `tax_rate=0` on test Product::create** to avoid PPN changing grand_total.
6. **Both dev servers required** — Vite serves JS/CSS via HMR. `php artisan serve` alone won't work.
7. **WhatsApp service separate** — `whatsapp-service/` needs `npm start` in another terminal + `WA_SERVICE_URL` in .env
8. **CRM campaign auto-send** — requires `wa_enabled=true` + connected device in Settings > WhatsApp
9. **Version bump on release** — update `APP_VERSION` in `.env` + `.env.example` when tagging

## Release Process

1. `development` accumulates features → branch `release/X.Y.Z`
2. QA/fix on `release/X.Y.Z` → merge to `main`
3. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"` on `main`
4. Merge `release/X.Y.Z` back to `development`
5. GitHub Release created from tag

## Frontend

- **Icons**: `@tabler/icons-react`
- **Alerts/confirm**: `react-hot-toast` + `sweetalert2`
- **Charts**: `chart.js`
- **Routing**: Ziggy `route()` helper available
- **Tailwind tokens**: `primary` (indigo), `accent` (cyan), `success` (emerald), `warning` (amber), `danger` (rose)

## Docs

- Modules: `docs/features/`
- Architecture: `docs/architecture-overview.md`
- Config: `docs/configuration.md`
- Planning: `planning/improvement-planning.md`

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
