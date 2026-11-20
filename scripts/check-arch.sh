#!/usr/bin/env bash
# scripts/check-arch.sh — Architectural constraint runner
set -euo pipefail

RULES_FILE=".harness/arch-rules.json"

if [ ! -f "$RULES_FILE" ]; then
  echo "[FAIL] $RULES_FILE not found."
  exit 1
fi

echo "=== Architectural Boundary Checks ==="

python3 -c "
import json, subprocess, sys

with open('$RULES_FILE', 'r') as f:
    rules = json.load(f)

violations = 0
print(f'Evaluating {len(rules)} architectural rule(s)...\\n')

for rule in rules:
    rule_id = rule.get('id', 'UNKNOWN')
    desc = rule.get('description', '')
    cmd = rule.get('check', '')
    what = rule.get('what', 'Architectural rule violation detected.')
    why = rule.get('why', 'Violates structural boundary constraint.')
    fix = rule.get('fix', 'Remediate violating code to conform to architecture.')

    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        violations += 1
        print(f'❌ [ARCH-VIOLATION] Rule: {rule_id} — {desc}')
        print(f'   WHAT: {what}')
        print(f'   WHY:  {why}')
        print(f'   FIX:  {fix}')
        if res.stdout.strip():
            print(f'   OUTPUT: {res.stdout.strip()[:300]}')
        print('')
    else:
        print(f'✅ [PASS] {rule_id}: {desc}')

if violations > 0:
    print(f'\\n[FAIL] {violations} architectural constraint violation(s) found.')
    sys.exit(1)
else:
    print(f'\\n[PASS] All architectural constraints verified.')
    sys.exit(0)
"
