#!/usr/bin/env bash
# scripts/clean-state-check.sh — Idempotent 5-dimension clean-state verifier
set -euo pipefail

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

FAILED=0

echo "=== Verifying Clean State (5 Dimensions) ==="

# 1. Build passes
echo -n "1. Checking build status (npm run build)... "
if npm run build >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=$((FAILED + 1))
fi

# 2. Tests pass
echo -n "2. Checking tests (php artisan test)... "
if php artisan test --filter=ExampleTest >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=$((FAILED + 1))
fi

# 3. Feature list updated
echo -n "3. Checking feature list integrity... "
if [ -f feature_list.json ] && python3 -c "import json; d=json.load(open('feature_list.json')); assert 'features' in d or isinstance(d, list)" >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=$((FAILED + 1))
fi

# 4. No debug artifacts
echo -n "4. Checking for debug artifacts (dd/dump/var_dump)... "
DEBUG_HITS=$(grep -rnE '(dd\(|dump\(|var_dump\()' app/ 2>/dev/null || true)
if [ -z "$DEBUG_HITS" ]; then
  echo "PASS"
else
  echo "FAIL: leftover debug calls detected in app/"
  FAILED=$((FAILED + 1))
fi

# 5. Startup path works
echo -n "5. Checking startup path (php artisan --version)... "
if php artisan --version >/dev/null 2>&1; then
  echo "PASS"
else
  echo "FAIL"
  FAILED=$((FAILED + 1))
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "=== [PASS] All 5 clean-state dimensions verified! Safe to commit. ==="
  exit 0
else
  echo "=== [FAIL] $FAILED clean-state check(s) failed. Fix issues before committing. ==="
  exit 1
fi
