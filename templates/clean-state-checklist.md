# Clean State Checklist

A session is not complete until all five dimensions pass. Agents run this checklist and verify with `make clean-check` before committing.

## Dimension 1: Build Passes
- [ ] Frontend production build compiles cleanly without warnings: `npm run build` exits 0.
- [ ] No missing assets, unresolvable imports, or broken Vite dependencies.

## Dimension 2: Tests Pass
- [ ] Backend test suite passes completely: `php artisan test` exits 0.
- [ ] SQLite in-memory database assertions remain green with zero regressions.

## Dimension 3: Feature List Updated
- [ ] `feature_list.json` state accurately reflects passing vs active features.
- [ ] Verification evidence is recorded with commit hash and timestamp.
- [ ] Feature state machine strictly followed (`not_started` → `active` → `passing`).

## Dimension 4: No Debug Artifacts
- [ ] No leftover debugging calls: zero instances of `dd()`, `dump()`, `var_dump()`, or `console.log`.
- [ ] No temporary files, scratch scripts, `.bak`, `.orig`, or merge conflict markers.

## Dimension 5: Startup Path Works
- [ ] Artisan CLI and core application routes boot cleanly: `php artisan --version`.
- [ ] Web and API routes register without syntax errors or unhandled exceptions.
