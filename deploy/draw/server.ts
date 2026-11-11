import {
  AVATARS,
  clean,
  categories,
  defaultSettings,
  DrawKvEngine,
  onlinePlayers,
  type RoomDoc,
} from "./kv-game.ts";

const DIST_DIR = new URL("./dist/", import.meta.url);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

function getAllowedOriginMatcher() {
  const exact = new Set<string>([
    "https://draw.d5v.cc",
    ...String(Deno.env.get("ALLOWED_ORIGINS") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ]);
  const orgSlug = Deno.env.get("DENO_DEPLOY_ORG_SLUG") || "";
  const escapedOrg = orgSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const orgRe = orgSlug
    ? new RegExp(`^https://draw-d5v(?:-[a-z0-9]+)?\\.${escapedOrg}\\.deno\\.net$`)
    : null;

  return (origin: string | null): boolean => {
    if (!origin) return true;
    if (exact.has(origin)) return true;
    if (!orgSlug && !Deno.env.get("DENO_DEPLOY") && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return true;
    if (orgRe && orgRe.test(origin)) return true;
    return false;
  };
}

function jsonResp(
  code: number,
  obj: unknown,
  origin: string | null,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "Content-Type,X-Player,X-Token");
    headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  return new Response(JSON.stringify(obj), { status: code, headers });
}

async function readJsonBody(req: Request, maxBytes = 128 * 1024): Promise<Record<string, unknown>> {
  try {
    const lenHeader = req.headers.get("content-length");
    if (lenHeader && Number(lenHeader) > maxBytes) {
      throw new Error("BODY_TOO_LARGE");
    }
    if (!req.body) return {};
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
    if (!total) return {};
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const text = new TextDecoder().decode(merged);
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch (err) {
    if (err instanceof Error && err.message === "BODY_TOO_LARGE") throw err;
    return {};
  }
}

export function createDrawServer(kv: Deno.Kv) {
  const engine = new DrawKvEngine(kv);
  const isAllowedOrigin = getAllowedOriginMatcher();
  const windows = new Map<string, { until: number; n: number }>();
  const activeSockets = new Set<WebSocket>();

  function limited(key: string, max: number, duration = 1000): boolean {
    const t = Date.now();
    const old = windows.get(key);
    const v = old && old.until > t ? old : { until: t + duration, n: 0 };
    windows.set(key, v);
    if (windows.size > 10000) {
      for (const [k, val] of windows) {
        if (val.until < t) windows.delete(k);
      }
    }
    return ++v.n > max;
  }

  function clientIp(req: Request, info: Deno.ServeHandlerInfo): string {
    const xri = req.headers.get("x-real-ip")?.trim();
    if (xri) return xri;
    const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (xff) return xff;
    if (info.remoteAddr.transport === "tcp") return info.remoteAddr.hostname;
    return "unknown";
  }

  async function serveStatic(pathname: string, method: string): Promise<Response | null> {
    if (method !== "GET" && method !== "HEAD") return null;
    if (pathname === "/" || pathname === "/index.html") {
      try {
        const data = await Deno.readFile(new URL("index.html", DIST_DIR));
        return new Response(method === "HEAD" ? null : data, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "same-origin",
          },
        });
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    }
    if (pathname.startsWith("/assets/")) {
      const name = pathname.slice("/assets/".length);
      if (!name || name.includes("/") || name.includes("..") || !/^[A-Za-z0-9_.-]+$/.test(name)) {
        return new Response("Not Found", { status: 404 });
      }
      const dot = name.lastIndexOf(".");
      const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
      const mime = MIME[ext] || "application/octet-stream";
      try {
        const data = await Deno.readFile(new URL(`assets/${name}`, DIST_DIR));
        return new Response(method === "HEAD" ? null : data, {
          status: 200,
          headers: {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch {
        return new Response("Not Found", { status: 404 });
      }
    }
    return null;
  }

  function handleWs(req: Request): Response {
    const origin = req.headers.get("origin");
    if (!isAllowedOrigin(origin)) {
      return new Response("Forbidden", { status: 403 });
    }
    const { socket, response } = Deno.upgradeWebSocket(req);
    activeSockets.add(socket);

    let roomId: string | null = null;
    let pidVal: string | null = null;
    let tokenVal: string | null = null;
    let last = -1;
    let unsub: (() => void) | null = null;
    let closed = false;
    let flushing = false;
    let queued = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearTimeout(authTimer);
      if (unsub) {
        unsub();
        unsub = null;
      }
      activeSockets.delete(socket);
    };

    const closeWith = (code: number, reason: string) => {
      try {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(code, reason);
        }
      } catch {
        // ignore
      }
      cleanup();
    };

    const authTimer = setTimeout(() => closeWith(1008, "auth required"), 5000);

    const flush = async () => {
      if (closed || !roomId || !pidVal || !tokenVal || socket.readyState !== WebSocket.OPEN) return;
      if (flushing) {
        queued = true;
        return;
      }
      flushing = true;
      try {
        do {
          queued = false;
          const room = await engine.reconcileRoom(roomId);
          if (!room) {
            closeWith(1008, "membership revoked");
            return;
          }
          const pl = room.players[pidVal];
          if (!pl || pl.token !== tokenVal) {
            closeWith(1008, "membership revoked");
            return;
          }
          if (last !== room.seq) {
            const payload = await engine.pollResponse(room, pl.id, last);
            if (closed || socket.readyState !== WebSocket.OPEN) return;
            socket.send(JSON.stringify(payload));
            last = payload.seq;
          }
        } while (queued && !closed);
      } catch {
        // transient read failure; next tick/wake will retry
      } finally {
        flushing = false;
      }
    };

    socket.onmessage = async (ev) => {
      try {
        const raw = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
        if (raw.length > 4096) {
          closeWith(1008, "invalid message");
          return;
        }
        const msg = JSON.parse(raw);
        if (!pidVal) {
          const rId = String(msg?.roomId || "");
          const pId = String(msg?.pid || "");
          const tk = String(msg?.token || "");
          if (!rId || !pId || !tk) {
            closeWith(1008, "auth");
            return;
          }
          const room = await engine.touchLastSeen(rId, pId, tk, true);
          if (!room) {
            closeWith(1008, "auth");
            return;
          }
          clearTimeout(authTimer);
          roomId = rId;
          pidVal = pId;
          tokenVal = tk;
          unsub = engine.subscribe(rId, () => {
            void flush();
          });
          await flush();
          return;
        }
        if (!roomId || !tokenVal) return;
        const room = await engine.touchLastSeen(roomId, pidVal, tokenVal, false);
        if (!room) {
          closeWith(1008, "membership revoked");
          return;
        }
        void flush();
      } catch {
        closeWith(1008, "invalid message");
      }
    };

    socket.onclose = cleanup;
    socket.onerror = cleanup;

    return response;
  }

  async function handler(req: Request, info: Deno.ServeHandlerInfo): Promise<Response> {
    const url = new URL(req.url, "http://x");
    const rawPath = url.pathname.replace(/\/+$/, "") || "/";
    const m = req.method;

    // WebSocket upgrade route (/api/game/ws or /ws)
    if (rawPath === "/api/game/ws" || rawPath === "/ws") {
      if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
        return handleWs(req);
      }
      return new Response("Upgrade Required", { status: 426 });
    }

    // Static frontend routes (unless explicitly under /api/game)
    const isApiPrefixed = rawPath === "/api/game" || rawPath.startsWith("/api/game/");
    if (!isApiPrefixed) {
      const staticRes = await serveStatic(rawPath, m);
      if (staticRes) return staticRes;
    }

    const path = isApiPrefixed ? rawPath.replace(/^\/api\/game/, "") || "/" : rawPath;
    const origin = req.headers.get("origin");
    if (!isAllowedOrigin(origin)) {
      return jsonResp(403, { error: "来源不允许" }, null);
    }
    if (m === "OPTIONS") {
      const h = new Headers();
      if (origin) {
        h.set("Access-Control-Allow-Origin", origin);
        h.set("Vary", "Origin");
        h.set("Access-Control-Allow-Headers", "Content-Type,X-Player,X-Token");
        h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      }
      return new Response(null, { status: 204, headers: h });
    }

    const ip = clientIp(req, info);
    if (m === "POST" && limited("ip:" + ip, 100)) {
      return jsonResp(429, { error: "操作太快，请稍后再试" }, origin);
    }
    if (m === "POST" && (path === "/rooms" || path === "/quick") && limited("create:" + ip, 30, 60000)) {
      return jsonResp(429, { error: "创建太快，请稍后再试" }, origin);
    }

    if (path === "/health" || (isApiPrefixed && path === "/")) {
      const { totalRooms } = await engine.countAndListPublicRooms();
      return jsonResp(200, { status: "ok", rooms: totalRooms }, origin);
    }
    if (m === "GET" && path === "/version") {
      try {
        const data = JSON.parse(await Deno.readTextFile(new URL("./build-info.json", import.meta.url)));
        return jsonResp(200, { commit: data.commit, run: data.run }, origin);
      } catch {
        return jsonResp(200, { commit: null, run: null }, origin);
      }
    }
    if (m === "GET" && path === "/categories") {
      return jsonResp(200, { categories: categories() }, origin);
    }
    if (path === "/words") {
      return jsonResp(404, { error: "接口不存在" }, origin);
    }
    if (m === "GET" && path === "/rooms") {
      const { rooms, online } = await engine.countAndListPublicRooms();
      return jsonResp(200, { rooms, online }, origin);
    }
    if (m === "POST" && path === "/rooms") {
      try {
        const body = await readJsonBody(req);
        const { totalRooms } = await engine.countAndListPublicRooms();
        if (totalRooms > 2000) {
          return jsonResp(503, { error: "房间太多啦，稍后再试" }, origin);
        }
        const created = await engine.createRoom(
          body.roomName,
          (body.settings as Record<string, unknown>) || {},
          body,
        );
        return jsonResp(200, created, origin);
      } catch (e) {
        if (e instanceof Error && e.message === "BODY_TOO_LARGE") {
          return jsonResp(413, { error: "请求体过大" }, origin);
        }
        throw e;
      }
    }
    if (m === "POST" && path === "/quick") {
      try {
        const body = await readJsonBody(req);
        const joined = await engine.quickJoin(body);
        return jsonResp(200, joined, origin);
      } catch (e) {
        if (e instanceof Error && e.message === "BODY_TOO_LARGE") {
          return jsonResp(413, { error: "请求体过大" }, origin);
        }
        throw e;
      }
    }

    const mm = path.match(/^\/rooms\/(\d{6})(?:\/([a-z]+))?$/);
    if (!mm) {
      return jsonResp(404, { error: "接口不存在" }, origin);
    }
    const roomId = mm[1];
    const action = mm[2] || "";

    if (m === "GET" && action === "") {
      const infoRes = await engine.getRoomPublicInfo(roomId);
      if (!infoRes) return jsonResp(404, { error: "房间不存在或已解散", code: "NO_ROOM" }, origin);
      return jsonResp(200, infoRes, origin);
    }

    if (m === "GET" && action === "poll") {
      const pidParam = req.headers.get("x-player") || url.searchParams.get("pid") || "";
      const tkParam = req.headers.get("x-token") || url.searchParams.get("token") || "";
      const room = await engine.touchLastSeen(roomId, pidParam, tkParam, true);
      if (!room) {
        const exists = await engine.getRoomPublicInfo(roomId);
        if (!exists) return jsonResp(404, { error: "房间不存在或已解散", code: "NO_ROOM" }, origin);
        return jsonResp(401, { error: "请重新加入房间", code: "AUTH" }, origin);
      }
      const since = Number(url.searchParams.get("since") || 0);
      const wait = url.searchParams.get("wait") !== "0";
      if (since <= 0 || room.seq > since || !wait) {
        return jsonResp(200, await engine.pollResponse(room, pidParam, since), origin);
      }

      return await new Promise<Response>((resolve) => {
        let done = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let unsub: (() => void) | null = null;

        const finish = async (timeoutTriggered = false) => {
          if (done) return;
          const latest = await engine.reconcileRoom(roomId);
          if (!latest) {
            done = true;
            clearTimeout(timer);
            unsub?.();
            resolve(jsonResp(404, { error: "房间不存在或已解散", code: "NO_ROOM" }, origin));
            return;
          }
          const pp = latest.players[pidParam];
          if (!pp || pp.token !== tkParam) {
            done = true;
            clearTimeout(timer);
            unsub?.();
            resolve(jsonResp(401, { error: "你已离开房间", code: "AUTH" }, origin));
            return;
          }
          if (!timeoutTriggered && latest.seq <= since) {
            return; // wait until seq actually advances or 20s timeout
          }
          done = true;
          clearTimeout(timer);
          unsub?.();
          const touched = (await engine.touchLastSeen(roomId, pidParam, tkParam, true)) || latest;
          resolve(jsonResp(200, await engine.pollResponse(touched, pidParam, since), origin));
        };

        timer = setTimeout(() => {
          void finish(true);
        }, 20000);

        unsub = engine.subscribe(roomId, () => {
          void finish(false);
        });

        req.signal.addEventListener("abort", () => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            unsub?.();
            resolve(new Response(null, { status: 499 }));
          }
        });
      });
    }

    if (m !== "POST") {
      return jsonResp(405, { error: "方法不支持" }, origin);
    }

    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      if (e instanceof Error && e.message === "BODY_TOO_LARGE") {
        return jsonResp(413, { error: "请求体过大" }, origin);
      }
      throw e;
    }

    if (action === "join") {
      const res = await engine.mutateRoom<{ roomId: string; pid: string; token: string; rejoin?: boolean }>(roomId, (ctx) => {
        if (body.pid && body.token) {
          const old = ctx.room.players[String(body.pid)];
          if (old && old.token === body.token) {
            old.lastSeen = ctx.t;
            ctx.room.emptySince = 0;
            if (body.name) old.name = clean(body.name, 10) || old.name;
            if (AVATARS.includes(String(body.avatar))) old.avatar = String(body.avatar);
            ctx.bump();
            return {
              ok: true,
              result: { roomId: ctx.room.id, pid: old.id, token: old.token, rejoin: true },
            };
          }
        }
        if (ctx.room.settings.password && clean(body.password, 12) !== ctx.room.settings.password) {
          return { ok: false, status: 403, error: "房间密码不正确", code: "PASSWORD" };
        }
        if (onlinePlayers(ctx.room, ctx.t).length >= ctx.room.settings.maxPlayers) {
          return { ok: false, status: 409, error: "房间已满", code: "FULL" };
        }
        const p = ctx.addPlayer(body);
        return { ok: true, result: { roomId: ctx.room.id, pid: p.id, token: p.token } };
      });
      if (!res.ok) return jsonResp(res.status, { error: res.error, ...(res.code ? { code: res.code } : {}) }, origin);
      return jsonResp(200, res.result, origin);
    }

    const pidVal = String(req.headers.get("x-player") || body.pid || url.searchParams.get("pid") || "");
    const tkVal = String(req.headers.get("x-token") || body.token || url.searchParams.get("token") || "");
    if (!pidVal || !tkVal) {
      return jsonResp(401, { error: "请重新加入房间", code: "AUTH" }, origin);
    }
    if (limited(`${pidVal}:${action}`, action === "draw" ? 40 : action === "guess" ? 5 : 10)) {
      return jsonResp(429, { error: "操作太快，请稍后再试" }, origin);
    }

    if (action === "draw") {
      const res = await engine.addDrawOps(roomId, pidVal, tkVal, Number(body.turnId), body.ops);
      if (!res.ok) return jsonResp(res.status, { error: res.error, ...(res.code ? { code: res.code } : {}) }, origin);
      return jsonResp(200, res.result, origin);
    }

    const res = await engine.mutateRoom(roomId, (ctx) => {
      const p = ctx.room.players[pidVal];
      if (!p || p.token !== tkVal) {
        return { ok: false, status: 401, error: "请重新加入房间", code: "AUTH" };
      }
      p.lastSeen = ctx.t;
      ctx.room.emptySince = 0;
      const isOwner = ctx.room.ownerId === p.id;
      if (["guess", "choose"].includes(action) && Number(body.turnId) !== ctx.room.turnId) {
        return { ok: false, status: 409, error: "回合已变化" };
      }

      switch (action) {
        case "leave": {
          delete ctx.room.players[p.id];
          ctx.room.order = ctx.room.order.filter((x) => x !== p.id);
          ctx.sys(`${p.name} 离开了房间`);
          if (isOwner) ctx.changeOwner();
          if (
            ctx.room.drawerId === p.id &&
            (ctx.room.phase === "drawing" || ctx.room.phase === "choosing")
          ) {
            ctx.endTurn("drawer-left");
          }
          ctx.bump();
          return { ok: true, result: { ok: true } };
        }
        case "settings": {
          if (!isOwner) return { ok: false, status: 403, error: "只有房主可以修改设置" };
          if (ctx.room.phase !== "waiting" && ctx.room.phase !== "ended") {
            return { ok: false, status: 409, error: "游戏进行中不能修改" };
          }
          const incoming = (body.settings as Record<string, unknown>) || {};
          const merged: Record<string, unknown> = { ...ctx.room.settings, ...incoming };
          if (incoming.customWords === undefined) merged.customWords = ctx.room.settings.customWords;
          if (incoming.password === undefined) merged.password = ctx.room.settings.password;
          ctx.room.settings = defaultSettings(merged);
          if (body.roomName) ctx.room.name = clean(body.roomName, 16) || ctx.room.name;
          ctx.sys("房主更新了房间设置");
          ctx.bump();
          return { ok: true, result: { ok: true } };
        }
        case "start": {
          if (!isOwner) return { ok: false, status: 403, error: "只有房主可以开始游戏" };
          if (ctx.room.phase !== "waiting" && ctx.room.phase !== "ended") {
            return { ok: false, status: 409, error: "游戏已经开始" };
          }
          if (onlinePlayers(ctx.room, ctx.t).length < 2) {
            return { ok: false, status: 409, error: "至少需要 2 名玩家才能开始" };
          }
          ctx.startGame();
          return { ok: true, result: { ok: true } };
        }
        case "back": {
          if (!isOwner) return { ok: false, status: 403, error: "只有房主可以操作" };
          if (ctx.room.phase === "ended") ctx.toWaiting();
          return { ok: true, result: { ok: true } };
        }
        case "choose": {
          if (ctx.room.drawerId !== p.id || ctx.room.phase !== "choosing") {
            return { ok: false, status: 409, error: "现在不能选词" };
          }
          ctx.chooseWord(body.index);
          return { ok: true, result: { ok: true } };
        }
        case "guess": {
          ctx.handleGuess(p, body.text);
          return { ok: true, result: { ok: true } };
        }
        case "react": {
          const kind = ["like", "flower", "egg", "lol"].includes(String(body.kind))
            ? String(body.kind)
            : "like";
          if (
            ctx.room.phase === "drawing" &&
            ctx.room.drawerId &&
            ctx.room.drawerId !== p.id &&
            (kind === "like" || kind === "flower")
          ) {
            const d = ctx.room.players[ctx.room.drawerId];
            if (d) d.likes = (d.likes || 0) + 1;
          }
          ctx.push({ type: "react", from: p.id, name: p.name, kind });
          return { ok: true, result: { ok: true } };
        }
        case "kick": {
          if (!isOwner) return { ok: false, status: 403, error: "只有房主可以踢人" };
          const target = ctx.room.players[String(body.target || "")];
          if (!target || target.id === p.id) {
            return { ok: false, status: 400, error: "无效的玩家" };
          }
          delete ctx.room.players[target.id];
          ctx.room.order = ctx.room.order.filter((x) => x !== target.id);
          ctx.sys(`${target.name} 被请出了房间`);
          if (
            ctx.room.drawerId === target.id &&
            (ctx.room.phase === "drawing" || ctx.room.phase === "choosing")
          ) {
            ctx.endTurn("drawer-left");
          }
          ctx.bump();
          return { ok: true, result: { ok: true } };
        }
        case "ping":
          return { ok: true, result: { ok: true } };
        default:
          return { ok: false, status: 404, error: "接口不存在" };
      }
    });

    if (!res.ok) {
      return jsonResp(res.status, { error: res.error, ...(res.code ? { code: res.code } : {}) }, origin);
    }
    return jsonResp(200, res.result, origin);
  }

  function shutdown() {
    for (const ws of [...activeSockets]) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.close(1001, "server restarting");
      } catch {
        // ignore
      }
    }
    engine.close();
  }

  return { handler, engine, shutdown };
}

if (import.meta.main) {
  const kvPath = Deno.env.get("DRAW_KV_PATH");
  const kv = await Deno.openKv(kvPath || undefined);
  const { handler, shutdown } = createDrawServer(kv);
  const port = Number(Deno.env.get("PORT") || "8000");
  const hostname = Deno.env.get("HOST") || "0.0.0.0";

  const server = Deno.serve({ port, hostname }, (req, info) => handler(req, info));

  try {
    Deno.addSignalListener("SIGINT", async () => {
      shutdown();
      await server.shutdown();
      kv.close();
      Deno.exit(0);
    });
  } catch {
    // ignore if SIGINT listener unsupported
  }
}
