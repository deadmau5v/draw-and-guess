#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

PID_FILE="logs/server.pid"
if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "turtle-soup 运行中 (PID: $PID)"
        curl -s http://127.0.0.1:3001/api/health || true
        echo ""
        exit 0
    fi
fi

echo "turtle-soup 未运行。"
exit 1
