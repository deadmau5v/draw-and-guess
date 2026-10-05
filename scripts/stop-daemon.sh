#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

PID_FILE="logs/server.pid"
if [ ! -f "$PID_FILE" ]; then
    echo "未找到 PID 文件 ($PID_FILE)，服务可能未运行。"
    exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "正在停止 turtle-soup 服务 (PID: $PID)..."
    kill "$PID" 2>/dev/null || true
    for i in {1..10}; do
        if ! kill -0 "$PID" 2>/dev/null; then
            break
        fi
        sleep 0.5
    done
    if kill -0 "$PID" 2>/dev/null; then
        echo "强制停止 turtle-soup 服务 (PID: $PID)..."
        kill -9 "$PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    echo "turtle-soup 已停止。"
else
    echo "进程已不存在，清除过期 PID 文件。"
    rm -f "$PID_FILE"
fi
