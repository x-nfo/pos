# Sprint Contract Template

Use this contract before starting implementation on any feature. Scope and acceptance criteria must be negotiated and locked.

## Sprint Metadata
- **Feature ID**: F0X
- **Feature Name**: [Feature Title]
- **Session ID**: [session-timestamp-or-agent-id]
- **Target Module**: [app/Http/Controllers/Apps/... or app/Services/...]

## 1. Goal
[1-2 sentence description of the user-visible capability or subsystem behavior]

## 2. In Scope
- [Explicit item 1]
- [Explicit item 2]
- [Explicit item 3]

## 3. Exclusions (Out of Scope / Non-Goals)
- [Explicitly excluded item 1]
- [Explicitly excluded item 2]
- [Refactorings or peripheral changes prohibited during this sprint]

## 4. Definition of Done
A feature is complete when runtime evidence passes — not when code is written or the agent is confident.
- [ ] Layer 1 (Static/Lint): `vendor/bin/pint --test` passes
- [ ] Layer 2 (Runtime Tests): `php artisan test --filter=[RelevantTest]` passes
- [ ] Layer 3 (System/E2E): `npm run build` passes and UI reaches ready state

## 5. Verification Evidence Required
- Command run:
- Output summary / assertion results:
- Commit hash verified:
