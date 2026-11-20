#!/usr/bin/env bash
# scripts/session-trace.sh — Runtime session event collector
set -euo pipefail

EVENT="${1:-session_start}"
TRACE_DIR=".harness/traces"
TRACE_FILE="$TRACE_DIR/traces.jsonl"

mkdir -p "$TRACE_DIR"

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
SESSION_ID="${SESSION_ID:-$(date +%s)}"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo "baseline")"
BRANCH="$(git branch --show-current 2>/dev/null || echo "detached")"

JSON_EVENT=$(python3 -c "
import json
print(json.dumps({
    'timestamp': '$TIMESTAMP',
    'session_id': '$SESSION_ID',
    'event': '$EVENT',
    'git_commit': '$COMMIT',
    'branch': '$BRANCH'
}))
")

echo "$JSON_EVENT" >> "$TRACE_FILE"
echo "Recorded trace event: $EVENT at $TIMESTAMP (commit: $COMMIT)"
