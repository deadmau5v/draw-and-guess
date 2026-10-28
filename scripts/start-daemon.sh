#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

mkdir -p logs

PID_FILE="logs/server.pid"
if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "draw-and-guess 已在运行 (PID: $PID)"
        exit 0
    fi
fi

NODE_BIN="/Users/d5v/.local/bin/node"
if [ ! -x "$NODE_BIN" ]; then
    NODE_BIN="$(which node)"
fi

echo "正在启动 draw-and-guess 服务 (PORT: 3002, NODE_ENV: production)..."
PORT=3002 NODE_ENV=production "$NODE_BIN" --import ./scripts/register-ts.mjs server/index.ts >> logs/server.log 2>> logs/server.error.log &
PID=$!
echo "$PID" > "$PID_FILE"
sleep 2

if kill -0 "$PID" 2>/dev/null; then
    echo "draw-and-guess 启动成功 (PID: $PID)！"
    curl -s http://127.0.0.1:3002/api/health || true
    echo ""
else
    echo "draw-and-guess 启动失败，请查看 logs/server.error.log"
    exit 1
fi
