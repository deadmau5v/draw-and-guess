import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { createDrawServer } from "../server.ts";

async function jsonReq(base: string, path: string, body?: unknown, session?: { pid: string; token: string }, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(session ? { "X-Player": session.pid, "X-Token": session.token } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, headers: res.headers, data };
}

Deno.test("static dist, security headers, origin lock, and 404 /words", async () => {
  const kv = await Deno.openKv(":memory:");
  const { handler, shutdown } = createDrawServer(kv);
  const ac = new AbortController();
  const server = Deno.serve({ port: 0, hostname: "127.0.0.1", signal: ac.signal, onListen() {} }, (req, info) => handler(req, info));
  const addr = server.addr as Deno.NetAddr;
  const base = `http://127.0.0.1:${addr.port}`;

  try {
    const home = await fetch(base + "/");
    assertEquals(home.status, 200);
    const html = await home.text();
    assertMatch(html, /你画我猜/);

    const cats = await jsonReq(base, "/api/game/categories");
    assertEquals(cats.status, 200);
    assertEquals(cats.data.categories.length, 16);
    const total = cats.data.categories.reduce((s: number, c: { count: number }) => s + c.count, 0);
    assertEquals(total, 917);

    assertEquals((await jsonReq(base, "/api/game/words")).status, 404);
    assertEquals((await jsonReq(base, "/words")).status, 404);

    const badOrigin = await jsonReq(base, "/api/game/rooms", {}, undefined, { Origin: "https://evil.invalid" });
    assertEquals(badOrigin.status, 403);

    const goodOrigin = await jsonReq(base, "/api/game/categories", undefined, undefined, { Origin: "https://draw.d5v.cc" });
    assertEquals(goodOrigin.status, 200);
    assertEquals(goodOrigin.headers.get("access-control-allow-origin"), "https://draw.d5v.cc");
  } finally {
    shutdown();
    ac.abort();
    await server.finished;
    kv.close();
  }
});

Deno.test("multi-instance shared KV: cross-instance WebSocket sync, 64KiB stroke split, eviction survival", async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: "draw-kv-test-" });
  const kvPath = `${tmpDir}/kv.sqlite3`;
  const serverPath = new URL("../server.ts", import.meta.url).pathname;

  const spawnInstance = async (port: number) => {
    const cmd = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--unstable-kv", serverPath],
      env: { PORT: String(port), HOST: "127.0.0.1", DRAW_KV_PATH: kvPath },
      stdout: "null",
      stderr: "piped",
    });
    const proc = cmd.spawn();
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`${base}/api/game/health`);
        if (r.ok) {
          await r.body?.cancel();
          return { proc, base };
        }
        await r.body?.cancel();
      } catch {
        // wait
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    throw new Error(`Instance on ${port} failed to start`);
  };

  let inst1 = await spawnInstance(3191);
  let inst2 = await spawnInstance(3192);
  let inst3: Awaited<ReturnType<typeof spawnInstance>> | null = null;
  const sockets: WebSocket[] = [];

  try {
    // Player A creates room on Instance 1
    const a = (await jsonReq(inst1.base, "/api/game/rooms", {
      name: "跨实例A",
      settings: { isPublic: false, customWords: ["跨实例密码词"], customOnly: true, hints: false },
    })).data;
    // Player B joins room on Instance 2
    const b = (await jsonReq(inst2.base, `/api/game/rooms/${a.roomId}/join`, { name: "跨实例B" })).data;

    // Connect WS A to Instance 1, WS B to Instance 2
    const msgsA: any[] = [];
    const msgsB: any[] = [];
    const connectWs = (base: string, sess: { roomId: string; pid: string; token: string }, out: any[]) =>
      new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(base.replace("http://", "ws://") + "/api/game/ws");
        sockets.push(ws);
        ws.onopen = () => {
          ws.send(JSON.stringify(sess));
        };
        ws.onmessage = (e) => {
          const d = JSON.parse(String(e.data));
          out.push(d);
          resolve(ws);
        };
        ws.onerror = () => reject(new Error("ws error"));
      });

    await connectWs(inst1.base, a, msgsA);
    await connectWs(inst2.base, b, msgsB);

    // Start game on Instance 1
    const startRes = await jsonReq(inst1.base, `/api/game/rooms/${a.roomId}/start`, {}, a);
    assertEquals(startRes.status, 200);

    // Wait for Instance 2 WS B to receive choosing state
    let bState: any = null;
    for (let i = 0; i < 40; i++) {
      const latest = msgsB[msgsB.length - 1]?.state;
      if (latest?.phase === "choosing") {
        bState = latest;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assertEquals(bState?.phase, "choosing");
    const aState = (await jsonReq(inst1.base, `/api/game/rooms/${a.roomId}/poll?wait=0`, undefined, a)).data.state;
    if (bState.drawerId === b.pid) {
      assertEquals(bState.choices?.length, 1);
      assertEquals(aState.choices, null);
      assertEquals(JSON.stringify(aState).includes("跨实例密码词"), false);
    } else {
      assertEquals(bState.choices, null);
      assertEquals(JSON.stringify(bState).includes("跨实例密码词"), false);
      assertEquals(aState.choices?.length, 1);
    }
    const drawer = aState.drawerId === a.pid ? { sess: a, base: inst1.base } : { sess: b, base: inst2.base };
    const guesser = drawer.sess.pid === a.pid ? { sess: b, base: inst2.base, msgs: msgsB } : { sess: a, base: inst1.base, msgs: msgsA };

    // Choose word on drawer's instance
    const chooseRes = await jsonReq(drawer.base, `/api/game/rooms/${a.roomId}/choose`, { index: 0, turnId: aState.turnId }, drawer.sess);
    assertEquals(chooseRes.status, 200);

    // Drawer sends oversized stroke (10,000 numbers > 64KiB JSON) to test KV chunking!
    const hugeCoords: number[] = [];
    for (let i = 0; i < 5000; i++) {
      hugeCoords.push(Number((10 + (i % 900)).toFixed(2)), Number((20 + (i % 600)).toFixed(2)));
    }
    const drawRes = await jsonReq(
      drawer.base,
      `/api/game/rooms/${a.roomId}/draw`,
      { turnId: aState.turnId, ops: [{ k: "line", id: "huge-1", c: "#2b2350", s: 6, p: hugeCoords, e: 1 }] },
      drawer.sess,
    );
    assertEquals(drawRes.status, 200);

    // Wait for guesser WS on OTHER instance to receive the split draw ops
    let receivedCoords = 0;
    for (let i = 0; i < 40; i++) {
      receivedCoords = 0;
      for (const m of guesser.msgs) {
        for (const ev of m.events || []) {
          if (ev.type === "draw") {
            for (const op of ev.ops || []) {
              if (op.k === "line" && op.id === "huge-1") receivedCoords += op.p.length;
            }
          }
        }
      }
      if (receivedCoords === 10000) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assertEquals(receivedCoords, 10000);

    // Simulate eviction of Instance 1! Kill inst1 and start inst3 on same KV
    for (const s of sockets) {
      try { s.close(); } catch {}
    }
    inst1.proc.kill("SIGKILL");
    await inst1.proc.status;

    inst3 = await spawnInstance(3193);
    // Resync on Instance 3 should restore all ops and state intact!
    const resync = await jsonReq(inst3.base, `/api/game/rooms/${a.roomId}/poll?since=0&wait=0`, undefined, guesser.sess);
    assertEquals(resync.status, 200);
    assertEquals(resync.data.resync, true);
    const restoredCoords = (resync.data.ops || []).reduce((sum: number, o: any) => sum + (o.p?.length || 0), 0);
    assertEquals(restoredCoords, 10000);

    // Substring guess rejected, exact guess reveals & scores on Instance 3!
    await jsonReq(inst3.base, `/api/game/rooms/${a.roomId}/guess`, { turnId: aState.turnId, text: "猜跨实例密码词" }, guesser.sess);
    const afterSub = await jsonReq(inst3.base, `/api/game/rooms/${a.roomId}/poll?wait=0`, undefined, guesser.sess);
    assertEquals(afterSub.data.state.phase, "drawing");

    await jsonReq(inst3.base, `/api/game/rooms/${a.roomId}/guess`, { turnId: aState.turnId, text: "跨实例密码词" }, guesser.sess);
    const afterWin = await jsonReq(inst3.base, `/api/game/rooms/${a.roomId}/poll?wait=0`, undefined, guesser.sess);
    assertEquals(afterWin.data.state.phase, "reveal");
    assertEquals(afterWin.data.state.lastResult.word, "跨实例密码词");
  } finally {
    for (const s of sockets) {
      try { s.close(); } catch {}
    }
    try { inst1.proc.kill("SIGKILL"); await inst1.proc.status; } catch {}
    try { inst2.proc.kill("SIGKILL"); await inst2.proc.status; } catch {}
    if (inst3) {
      try { inst3.proc.kill("SIGKILL"); await inst3.proc.status; } catch {}
    }
    await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
  }
});
