#!/bin/bash
set -e

mkdir -p /Users/d5v/codes/draw-and-guess/logs

# 清理残留隧道进程（仅限 13002 -> 3002，绝不触碰 13001 海龟汤隧道）
pkill -f "127.0.0.1:13002:127.0.0.1:3002" 2>/dev/null || true

# 启动到 lisa 的持久化反向 TCP 隧道（走本机 7890 AnyTLS/TCP 专线，避开晚高峰跨网 UDP QoS 丢包）
(
  while true; do
    /usr/bin/ssh -N \
      -o ControlMaster=no \
      -o ControlPath=none \
      -o ProxyCommand="/usr/bin/nc -X 5 -x 127.0.0.1:7890 %h %p" \
      -o ExitOnForwardFailure=yes \
      -o ServerAliveInterval=10 \
      -o ServerAliveCountMax=3 \
      -o TCPKeepAlive=yes \
      -R 127.0.0.1:13002:127.0.0.1:3002 \
      lisa >> /Users/d5v/codes/draw-and-guess/logs/tunnel.log 2>&1 || true
    sleep 2
  done
) &
TUNNEL_PID=$!

cleanup() {
  kill "$TUNNEL_PID" 2>/dev/null || true
  pkill -f "127.0.0.1:13002:127.0.0.1:3002" 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

cd /Users/d5v/codes/draw-and-guess
export PORT="${PORT:-3002}"
exec /Users/d5v/.local/bin/node --import ./scripts/register-ts.mjs server/index.ts
