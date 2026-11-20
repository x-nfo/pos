# AGENTS.md — Point of Sales System

This project is an open-source retail Point of Sales application built with Laravel 13, Inertia.js 3.0, and React 19.
Stack: PHP 8.3+, Inertia 3.0, React 19, Tailwind CSS 3, Spatie Permission, SQLite (testing) / MySQL (prod).
Detailed manuals: [Architecture](docs/architecture-overview.md) | [App Architecture](app/ARCHITECTURE.md) | [Config](docs/configuration.md) | [Quality](docs/quality-document.md)

## Verification Commands

- `./init.sh` — Single-command full environment setup and baseline health check.
- `make check` — Primary verification pipeline (lint + test + build + check-arch). Must exit 0 before every commit.
- `make test` — Runs backend PHPUnit suite (`php artisan test` using SQLite in-memory).
- `make clean-check` — Idempotent 5-dimension clean-state verifier before session clock-out.
- `make verify-feature F=<id>` — Harness gate running multi-layer validation for a feature.

## Startup Workflow

Before writing code (Clock-in routine):
1. Read `PROGRESS.md` to restore context, current state, and blockers.
2. Run `make check` to confirm a green baseline before making any edits.
3. Review `feature_list.json` to inspect current feature progress.

## Definition of Done

A task is complete when runtime evidence passes — not when code is written or the agent is confident. A feature is done only when all layers pass:
- **Three-layer verification model**:
  - **Layer 1 (syntax/static)**: `vendor/bin/pint --test` formatting check.
  - **Layer 2 (runtime behavior)**: `php artisan test` feature and unit assertions.
  - **Layer 3 (system confirmation / e2e)**: `npm run build` and UI ready state confirmation.
- **Layer ordering rule**: Do not proceed to Layer N+1 if Layer N fails.
- **Runtime signals**: Confirm app reaches ready state, side effects (DB writes, stock mutations) are correct, and no debug artifacts remain.

## Hard Constraints

- **MUST** run all financial mutations inside `DB::transaction(...)` (# source: financial-audit, why: avoid partial ledger corruption).
- **MUST NOT** import backend Eloquent models directly in React code (# source: client-server-boundary, why: violates Inertia protocol).
- **MUST** update documentation in the same commit as code changes — no stale documentation (# source: harness-staleness-rule, why: keep repo source of record).
- **MUST** create atomic commits: one logical operation per commit; the repo must be in a consistent state after every commit (# source: git-atomicity, why: bisectability).

## State Files & Repository as System of Record

Durability and consistency across agent sessions are guaranteed by tracking state in git:
- `PROGRESS.md`: Current state, active task, blockers, and next steps.
- `feature_list.json`: Granular feature registry with verification commands and evidence.
- `DECISIONS.md`: Architecture Decision Records (ADRs) explaining system choices.
- Consistent-state predicate: The repo is consistent when `make check` exits 0.

## Scope Boundaries

- **One feature at a time**: WIP=1 rule — only one feature may have state=active at a time. Complete and move to passing before activating the next.
- **Stay in scope**: Each feature must be completable in one session. If it spans multiple sessions, split it before proceeding.
- **Feature List Rules**: Never set state to passing directly — run `make verify-feature F=<id>` which automatically verifies layers and updates state.
- **State machine**: `not_started` → `active` → `passing` (no skipping allowed).

## Architecture Boundaries

- `make check-arch` runs rules from `.harness/arch-rules.json` enforcing layer dependency invariants and outputting WHAT/WHY/FIX on violations.
- Layer 3 (e2e) is required when changes cross component or domain boundaries.
- Review-to-automation promotion principle: Every new error category caught in code review becomes a rule in `.harness/arch-rules.json`.

## Observability

- Before starting a sprint, negotiate scope and DoD using `templates/sprint-contract.md`.
- Record runtime signals using `make session-start` and `make session-end` (wraps `scripts/session-trace.sh` into `.harness/traces/traces.jsonl`).
- Score each completed sprint against `templates/evaluator-rubric.md` — every dimension must reach B or above.

## End of Session

Before ending session (Clock-out routine):
1. Run `make clean-check` before committing — confirms build passes, tests pass, feature list updated, no debug artifacts, and startup path works.
2. Update `PROGRESS.md` with updated current state, accomplishments, and next steps.
3. Update `docs/quality-document.md` for the module you touched (A/B/C/D per dimension).
4. Dual-mode cleanup strategy: immediate cleanup at every session end + periodic (weekly/monthly) full-system sweep for structural drift.
5. Commit guidance: Write commit messages that explain WHY the change was made, not just what changed.
6. Context anxiety warning: If running low on context, do NOT rush to finish — stop, update `PROGRESS.md`, and commit a clean checkpoint.

## Tools and Scoped Capabilities

Tool permissions are scoped in `.claude/settings.json`. Bash execution, file manipulation, and verification runners are permitted within workspace boundaries.

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
  code spans inlined.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
- Browse `graft/INDEX.md` to see every indexed node.
- Refresh after large changes with `graft build`.
<!-- graft:end -->
