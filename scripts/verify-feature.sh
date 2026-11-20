#!/usr/bin/env bash
# scripts/verify-feature.sh — Multi-layer feature verifier and gate
set -euo pipefail

FEATURE_ID="${1:-}"

if [ -z "$FEATURE_ID" ]; then
  echo "Usage: ./scripts/verify-feature.sh <FEATURE_ID>"
  echo "Example: ./scripts/verify-feature.sh F01"
  exit 1
fi

FEATURE_FILE="feature_list.json"
if [ ! -f "$FEATURE_FILE" ]; then
  echo "[FAIL] $FEATURE_FILE not found."
  exit 1
fi

echo "=== Verifying Feature: $FEATURE_ID ==="

python3 -c "
import json, subprocess, sys

with open('$FEATURE_FILE', 'r') as f:
    data = json.load(f)

features = data.get('features', data if isinstance(data, list) else [])
target = None
for feat in features:
    if feat.get('id') == '$FEATURE_ID':
        target = feat
        break

if not target:
    print(f'[FAIL] Feature $FEATURE_ID not found in $FEATURE_FILE')
    sys.exit(1)

print(f\"Target: {target.get('name', '$FEATURE_ID')}\")
print(f\"Behavior: {target.get('behavior', '')}\")
layers = target.get('layers', [])

def run_layer(index, layer):
    label = layer.get('label', f'Layer {index+1}')
    cmd = layer.get('cmd', '')
    repair = layer.get('repair', 'Inspect command logs and repair failures.')
    print(f'\n--- Running: {label} ---')
    print(f'\$ {cmd}')
    res = subprocess.run(cmd, shell=True)
    if res.returncode != 0:
        print(f'\n[FAIL] {label} failed (exit code {res.returncode})')
        print(f'How to fix (repair instructions):')
        print(f'  {repair}\n')
        sys.exit(1)
    print(f'[PASS] {label}')

if layers:
    for i, layer in enumerate(layers):
        run_layer(i, layer)
else:
    # Fallback to single verification command if no layers
    v_cmd = target.get('verification', 'php artisan test')
    print(f'Running fallback verification: {v_cmd}')
    res = subprocess.run(v_cmd, shell=True)
    if res.returncode != 0:
        print('[FAIL] Verification command failed.')
        sys.exit(1)

# If all passed, update state to passing and record evidence
commit_hash = subprocess.run('git rev-parse --short HEAD 2>/dev/null || echo \"baseline\"', shell=True, capture_output=True, text=True).stdout.strip()
evidence = f'commit {commit_hash}, verified runtime'

target['state'] = 'passing'
target['status'] = 'passing'
target['evidence'] = evidence

with open('$FEATURE_FILE', 'w') as f:
    json.dump(data, f, indent=2)

print(f'\n[SUCCESS] Feature $FEATURE_ID verified across all layers!')
print(f'Updated state -> passing | Evidence -> {evidence}')
"
