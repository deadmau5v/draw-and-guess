import { createRequire } from "node:module";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const { WORDS, categories, pool } = require("./words.cjs") as {
  WORDS: Record<string, { name: string; icon: string; words: string[] }>;
  categories: () => { id: string; name: string; icon: string; count: number }[];
  pool: (cat: string, custom: string[], customOnly: boolean) => { word: string; cat: string }[];
};

export { WORDS, categories, pool };

export const AVATARS = ["cat", "shiba", "panda", "bunny", "chick", "fox"];

export interface Settings {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  category: string;
  customWords: string[];
  customOnly: boolean;
  isPublic: boolean;
  hints: boolean;
  password: string;
}

export interface Player {
  id: string;
  token: string;
  name: string;
  avatar: string;
  score: number;
  guessed: boolean;
  likes: number;
  lastSeen: number;
  joinedAt: number;
}

export interface DrawOp {
  k: "line" | "fill" | "clear" | "undo";
  id?: string;
  c?: string;
  s?: number;
  p?: number[];
  e?: number;
  x?: number;
  y?: number;
}

export interface GameEvent {
  seq: number;
  ts: number;
  type: "state" | "chat" | "draw" | "react";
  kind?: string;
  text?: string;
  from?: string;
  to?: string;
  name?: string;
  avatar?: string;
  vis?: string;
  turnId?: number;
  ops?: DrawOp[];
}

export interface RoomDoc {
  id: string;
  name: string;
  settings: Settings;
  players: Record<string, Player>;
  ownerId: string | null;
  phase: "waiting" | "choosing" | "drawing" | "reveal" | "ended";
  round: number;
  order: string[];
  turnIdx: number;
  turnId: number;
  drawerId: string | null;
  word: string | null;
  wordCat: string | null;
  choices: { word: string; cat: string }[];
  revealed: number[];
  deadline: number;
  turnStart: number;
  guessOrder: string[];
  turnDelta: Record<string, number>;
  lastResult: unknown;
  seq: number;
  oldestEvSeq: number;
  createdAt: number;
  emptySince: number;
}

export interface RoomSummary {
  id: string;
  name: string;
  phase: string;
  isPublic: boolean;
  hasPassword: boolean;
  maxPlayers: number;
  category: string;
  round: number;
  rounds: number;
  owner: string;
  avatars: string[];
  playerLastSeens: number[];
  emptySince: number;
  createdAt: number;
}

export interface SeqSignal {
  seq: number;
  phase: string;
  deadline: number;
  turnId: number;
  updatedAt: number;
}

export const now = () => Date.now();
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const clean = (s: unknown, n: number) =>
  String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
export const norm = (s: unknown) =>
  String(s || "").toLowerCase().replace(/[\s,，。.!！?？、~～]/g, "");

const token = () => crypto.randomBytes(12).toString("hex");
const pid = () => crypto.randomBytes(5).toString("hex");

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function defaultSettings(s: Record<string, unknown> = {}): Settings {
  const custom = Array.isArray(s.customWords)
    ? s.customWords
    : String(s.customWords || "").split(/[\s,，、;；\n]+/);
  return {
    maxPlayers: clamp(Number(s.maxPlayers) || 8, 2, 12),
    rounds: clamp(Number(s.rounds) || 3, 1, 10),
    drawTime: clamp(Number(s.drawTime) || 80, 30, 180),
    category: String(s.category || "mixed"),
    customWords: custom.map((w) => clean(w, 12)).filter(Boolean).slice(0, 200),
    customOnly: !!s.customOnly,
    isPublic: s.isPublic !== false,
    hints: s.hints !== false,
    password: clean(s.password, 12),
  };
}

export function isOnline(p: Player, t = now()): boolean {
  return t - p.lastSeen < 25000;
}

export function onlinePlayers(room: RoomDoc, t = now()): Player[] {
  return Object.values(room.players).filter((p) => isOnline(p, t));
}

export function viewState(room: RoomDoc, me: string, t = now()) {
  const p = room.players[me];
  const isDrawer = room.drawerId === me;
  const canSeeWord =
    isDrawer ||
    room.phase === "reveal" ||
    room.phase === "ended" ||
    (p && p.guessed && room.phase === "drawing");
  let hint: string[] | null = null;
  if (room.word && room.phase === "drawing") {
    hint = [...room.word].map((ch, i) => (room.revealed.includes(i) ? ch : "_"));
  }
  return {
    id: room.id,
    name: room.name,
    settings: {
      ...room.settings,
      password: undefined,
      hasPassword: !!room.settings.password,
      customWords: undefined,
      customCount: room.settings.customWords.length,
    },
    ownerId: room.ownerId,
    phase: room.phase,
    round: room.round,
    turnIdx: room.turnIdx,
    turnTotal: room.order.length,
    turnId: room.turnId,
    drawerId: room.drawerId,
    remain: room.deadline ? Math.max(0, room.deadline - t) : 0,
    word: canSeeWord ? room.word : null,
    wordLen: room.word ? [...room.word].length : 0,
    wordCat: room.phase === "drawing" || room.phase === "reveal" ? room.wordCat : null,
    hint,
    choices: isDrawer && room.phase === "choosing" ? room.choices.map((c) => c.word) : null,
    choicesCat: isDrawer && room.phase === "choosing" ? room.choices.map((c) => c.cat) : null,
    lastResult: room.lastResult,
    players: Object.values(room.players).map((x) => ({
      id: x.id,
      name: x.name,
      avatar: x.avatar,
      score: x.score,
      guessed: x.guessed,
      online: isOnline(x, t),
      likes: x.likes || 0,
    })),
  };
}

export function filterEvents(room: RoomDoc, evs: GameEvent[], me: string): GameEvent[] {
  const p = room.players[me];
  const insider = !!(p && (room.drawerId === me || p.guessed));
  return evs.filter((e) => {
    if (e.to && e.to !== me) return false;
    if (e.vis === "insiders" && !insider && e.from !== me) return false;
    if (e.type === "draw" && e.from === me) return false;
    return true;
  });
}

function buildSummary(room: RoomDoc, t = now()): RoomSummary {
  const on = onlinePlayers(room, t);
  return {
    id: room.id,
    name: room.name,
    phase: room.phase,
    isPublic: room.settings.isPublic,
    hasPassword: !!room.settings.password,
    maxPlayers: room.settings.maxPlayers,
    category: room.settings.category,
    round: room.round,
    rounds: room.settings.rounds,
    owner: (room.ownerId && room.players[room.ownerId]?.name) || "",
    avatars: on.slice(0, 4).map((p) => p.avatar),
    playerLastSeens: Object.values(room.players).map((p) => p.lastSeen),
    emptySince: room.emptySince,
    createdAt: room.createdAt,
  };
}

function splitDrawOps(rawOps: DrawOp[]): DrawOp[][] {
  const normalized: DrawOp[] = [];
  for (const o of rawOps) {
    if (o.k === "line" && o.p && o.p.length > 800) {
      for (let i = 0; i < o.p.length; i += 800) {
        const slice = o.p.slice(i, i + 800);
        const isLast = i + 800 >= o.p.length;
        normalized.push({
          k: "line",
          id: o.id,
          c: o.c,
          s: o.s,
          p: slice,
          e: isLast ? o.e : 0,
        });
      }
    } else {
      normalized.push(o);
    }
  }
  const batches: DrawOp[][] = [];
  let cur: DrawOp[] = [];
  let curSize = 2;
  for (const o of normalized) {
    const sz = JSON.stringify(o).length + 1;
    if (cur.length > 0 && curSize + sz > 20000) {
      batches.push(cur);
      cur = [];
      curSize = 2;
    }
    cur.push(o);
    curSize += sz;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

class RoomContext {
  newEvents: GameEvent[] = [];
  newDrawBatches: { seq: number; turnId: number; ops: DrawOp[] }[] = [];
  usedChanged = false;
  deleted = false;
  oldTurnIdsToClean: number[] = [];

  constructor(
    public room: RoomDoc,
    public used: Set<string>,
    public t: number,
  ) {}

  push(ev: Omit<GameEvent, "seq" | "ts">): GameEvent {
    const full: GameEvent = {
      ...ev,
      seq: ++this.room.seq,
      ts: this.t,
    };
    this.newEvents.push(full);
    if (this.room.seq - this.room.oldestEvSeq >= 2800) {
      this.room.oldestEvSeq = this.room.seq - 2000;
    }
    return full;
  }

  bump() {
    this.push({ type: "state" });
  }

  sys(text: string, kind = "system") {
    this.push({ type: "chat", kind, text });
  }

  changeOwner() {
    const on = onlinePlayers(this.room, this.t);
    const next = on[0] || Object.values(this.room.players)[0];
    if (next && next.id !== this.room.ownerId) {
      this.room.ownerId = next.id;
      this.sys(`${next.name} 成为新房主`);
      this.bump();
    }
  }

  addPlayer(body: Record<string, unknown>): Player {
    const p: Player = {
      id: pid(),
      token: token(),
      name: clean(body.name, 10) || "神秘画手",
      avatar: AVATARS.includes(String(body.avatar))
        ? String(body.avatar)
        : AVATARS[Math.floor(Math.random() * AVATARS.length)],
      score: 0,
      guessed: false,
      likes: 0,
      lastSeen: this.t,
      joinedAt: this.t,
    };
    this.room.players[p.id] = p;
    this.room.emptySince = 0;
    if (!this.room.ownerId || !this.room.players[this.room.ownerId]) {
      this.room.ownerId = p.id;
    }
    this.sys(`${p.name} 加入了房间`, "join");
    this.bump();
    return p;
  }

  startGame() {
    for (const p of Object.values(this.room.players)) {
      p.score = 0;
      p.guessed = false;
      p.likes = 0;
    }
    this.room.round = 1;
    this.room.order = shuffle(onlinePlayers(this.room, this.t).map((p) => p.id));
    this.room.turnIdx = -1;
    this.room.lastResult = null;
    this.used.clear();
    this.usedChanged = true;
    this.sys(`游戏开始！共 ${this.room.settings.rounds} 轮，每人轮流作画`);
    this.nextTurn();
  }

  nextTurn() {
    let guard = 0;
    while (guard++ < 50) {
      this.room.turnIdx++;
      if (this.room.turnIdx >= this.room.order.length) {
        this.room.round++;
        this.room.turnIdx = 0;
        const extra = onlinePlayers(this.room, this.t)
          .map((p) => p.id)
          .filter((id) => !this.room.order.includes(id));
        this.room.order = this.room.order
          .filter((id) => !!this.room.players[id])
          .concat(extra);
        if (this.room.round > this.room.settings.rounds) return this.endGame();
        if (!this.room.order.length) return this.endGame();
      }
      const d = this.room.players[this.room.order[this.room.turnIdx]];
      if (d && isOnline(d, this.t)) break;
    }
    if (onlinePlayers(this.room, this.t).length < 2) {
      this.sys("玩家不足 2 人，游戏暂停");
      return this.toWaiting();
    }
    if (this.room.turnId > 0) this.oldTurnIdsToClean.push(this.room.turnId);
    this.room.turnId++;
    this.room.drawerId = this.room.order[this.room.turnIdx];
    this.room.phase = "choosing";
    this.room.revealed = [];
    this.room.guessOrder = [];
    this.room.turnDelta = {};
    this.room.word = null;
    for (const p of Object.values(this.room.players)) p.guessed = false;
    const list = pool(
      this.room.settings.category,
      this.room.settings.customWords,
      this.room.settings.customOnly,
    );
    let cand = shuffle(list.filter((w) => !this.used.has(w.word)));
    if (cand.length < 3) {
      this.used.clear();
      this.usedChanged = true;
      cand = shuffle(list);
    }
    this.room.choices = cand.slice(0, 3);
    this.room.deadline = this.t + 15000;
    const d = this.room.players[this.room.drawerId];
    this.sys(`第 ${this.room.round} 轮 · 轮到 ${d.name} 选词作画`);
    this.bump();
  }

  chooseWord(idx: unknown) {
    const c =
      this.room.choices[clamp(Number(idx) || 0, 0, this.room.choices.length - 1)];
    this.room.word = c.word;
    this.room.wordCat = c.cat;
    this.used.add(c.word);
    this.usedChanged = true;
    this.room.phase = "drawing";
    this.room.turnStart = this.t;
    this.room.deadline = this.t + this.room.settings.drawTime * 1000;
    const drawerName = this.room.drawerId ? this.room.players[this.room.drawerId]?.name || "" : "";
    this.sys(`${drawerName} 开始作画啦，快来猜！`);
    this.bump();
  }

  endTurn(reason: string) {
    if (this.room.phase !== "drawing" && this.room.phase !== "choosing") return;
    const drawer = this.room.drawerId ? this.room.players[this.room.drawerId] : undefined;
    if (this.room.phase === "drawing" && drawer) {
      const n = this.room.guessOrder.length;
      const gain = n ? Math.min(10, 2 + n * 2) : 0;
      drawer.score += gain;
      this.room.turnDelta[drawer.id] = (this.room.turnDelta[drawer.id] || 0) + gain;
    }
    this.room.lastResult = {
      word: this.room.word,
      cat: this.room.wordCat,
      drawerId: this.room.drawerId,
      reason,
      delta: this.room.turnDelta,
      guessed: this.room.guessOrder.slice(),
    };
    if (this.room.word) this.sys(`答案是「${this.room.word}」`, "answer");
    this.room.phase = "reveal";
    this.room.deadline = this.t + 6000;
    this.bump();
  }

  endGame() {
    this.room.phase = "ended";
    this.room.drawerId = null;
    this.room.word = null;
    this.room.deadline = 0;
    const rank = Object.values(this.room.players).sort((a, b) => b.score - a.score);
    this.room.lastResult = {
      final: true,
      rank: rank.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        likes: p.likes || 0,
      })),
    };
    if (rank[0]) this.sys(`游戏结束！${rank[0].name} 获得冠军 🏆`);
    this.bump();
  }

  toWaiting() {
    if (this.room.turnId > 0) this.oldTurnIdsToClean.push(this.room.turnId);
    this.room.phase = "waiting";
    this.room.drawerId = null;
    this.room.word = null;
    this.room.deadline = 0;
    this.room.round = 0;
    for (const p of Object.values(this.room.players)) p.guessed = false;
    this.bump();
  }

  handleGuess(p: Player, text: unknown) {
    const t = clean(text, 60);
    if (!t) return;
    if (
      this.room.phase === "drawing" &&
      this.room.word &&
      p.id !== this.room.drawerId &&
      !p.guessed
    ) {
      const g = norm(t),
        w = norm(this.room.word);
      if (g === w) {
        p.guessed = true;
        this.room.guessOrder.push(p.id);
        const elapsed = (this.t - this.room.turnStart) / 1000;
        const ratio = Math.max(0, 1 - elapsed / this.room.settings.drawTime);
        const rankBonus = Math.max(0, 4 - this.room.guessOrder.length);
        const gain = 3 + Math.round(ratio * 5) + rankBonus;
        p.score += gain;
        this.room.turnDelta[p.id] = gain;
        this.push({
          type: "chat",
          kind: "correct",
          from: p.id,
          name: p.name,
          text: `${p.name} 猜对了！+${gain}`,
        });
        if (this.room.guessOrder.length === 1) {
          this.room.deadline = Math.min(
            this.room.deadline,
            this.t + Math.max(20000, (this.room.deadline - this.t) * 0.6),
          );
        }
        const others = onlinePlayers(this.room, this.t).filter(
          (x) => x.id !== this.room.drawerId,
        );
        if (others.every((x) => x.guessed)) this.endTurn("all");
        else this.bump();
        return;
      }
    }
    const secret =
      this.room.phase === "drawing" && (p.id === this.room.drawerId || p.guessed);
    if (secret && this.room.word && norm(t).includes(norm(this.room.word))) {
      this.push({
        type: "chat",
        kind: "close",
        to: p.id,
        text: "不能直接说出答案哦～",
      });
      return;
    }
    this.push({
      type: "chat",
      kind: "chat",
      from: p.id,
      name: p.name,
      avatar: p.avatar,
      text: t,
      vis: secret ? "insiders" : undefined,
    });
  }

  reconcile(): boolean {
    let changed = false;
    const on = onlinePlayers(this.room, this.t);
    if (!on.length) {
      if (!this.room.emptySince) {
        this.room.emptySince = this.t;
        changed = true;
      }
      if (this.t - this.room.emptySince > 10 * 60 * 1000) {
        this.deleted = true;
        return true;
      }
      return changed;
    }
    if (this.room.emptySince !== 0) {
      this.room.emptySince = 0;
      changed = true;
    }
    for (const p of Object.values(this.room.players)) {
      if (this.t - p.lastSeen > 90000) {
        delete this.room.players[p.id];
        this.sys(`${p.name} 离开了房间`);
        if (this.room.ownerId === p.id) this.changeOwner();
        this.bump();
        changed = true;
      }
    }
    const owner = this.room.ownerId ? this.room.players[this.room.ownerId] : undefined;
    if (!owner || !isOnline(owner, this.t)) {
      const prev = this.room.ownerId;
      this.changeOwner();
      if (this.room.ownerId !== prev) changed = true;
    }
    const onAfter = onlinePlayers(this.room, this.t);
    if ((this.room.phase === "drawing" || this.room.phase === "choosing") && onAfter.length < 2) {
      this.endTurn("few");
      return true;
    }
    const drawer = this.room.drawerId ? this.room.players[this.room.drawerId] : undefined;
    if ((this.room.phase === "drawing" || this.room.phase === "choosing") && (!drawer || !isOnline(drawer, this.t))) {
      this.sys("画手掉线了，跳过本回合");
      this.endTurn("drawer-left");
      return true;
    }
    if (!this.room.deadline || this.t < this.room.deadline) {
      if (this.room.phase === "drawing" && this.room.settings.hints && this.room.word) {
        const chars = [...this.room.word];
        const passed = (this.t - this.room.turnStart) / (this.room.settings.drawTime * 1000);
        const want =
          chars.length <= 1
            ? 0
            : passed > 0.75
            ? Math.min(2, chars.length - 1)
            : passed > 0.5
            ? 1
            : 0;
        if (this.room.revealed.length < want) {
          const left = chars.map((_, i) => i).filter((i) => !this.room.revealed.includes(i));
          this.room.revealed.push(left[Math.floor(Math.random() * left.length)]);
          this.sys("💡 提示：揭开了一个字", "hint");
          this.bump();
          changed = true;
        }
      }
      return changed;
    }
    if (this.room.phase === "choosing") {
      this.chooseWord(Math.floor(Math.random() * this.room.choices.length));
      return true;
    }
    if (this.room.phase === "drawing") {
      this.endTurn("timeout");
      return true;
    }
    if (this.room.phase === "reveal") {
      this.nextTurn();
      return true;
    }
    return changed;
  }
}

export class DrawKvEngine {
  private subscribers = new Map<string, Set<() => void>>();
  private roomWatchers = new Map<string, { stop: () => void }>();

  constructor(public kv: Deno.Kv) {}

  close() {
    for (const w of this.roomWatchers.values()) w.stop();
    this.roomWatchers.clear();
    this.subscribers.clear();
  }

  subscribe(roomId: string, fn: () => void): () => void {
    let set = this.subscribers.get(roomId);
    if (!set) {
      set = new Set();
      this.subscribers.set(roomId, set);
    }
    set.add(fn);
    this.ensureWatcher(roomId);
    return () => {
      const s = this.subscribers.get(roomId);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) {
        this.subscribers.delete(roomId);
        const w = this.roomWatchers.get(roomId);
        if (w) {
          w.stop();
          this.roomWatchers.delete(roomId);
        }
      }
    };
  }

  private wakeLocal(roomId: string) {
    const s = this.subscribers.get(roomId);
    if (!s) return;
    for (const fn of [...s]) {
      try {
        fn();
      } catch {
        // ignore listener errors
      }
    }
  }

  private ensureWatcher(roomId: string) {
    if (this.roomWatchers.has(roomId)) return;
    let stopped = false;
    let reader: ReadableStreamDefaultReader<[Deno.KvEntryMaybe<SeqSignal>]> | null = null;
    let lastCheckedAt = 0;

    const watchLoop = async () => {
      while (!stopped) {
        try {
          const stream = this.kv.watch<[SeqSignal]>([["draw", "seq", roomId]]);
          reader = stream.getReader();
          while (!stopped) {
            const { value, done } = await reader.read();
            if (done) break;
            lastCheckedAt = now();
            if (value?.[0]?.value) {
              this.wakeLocal(roomId);
            }
          }
        } catch {
          // retry watch after short delay if not stopped
        } finally {
          try {
            reader?.releaseLock();
          } catch {
            // ignore
          }
          reader = null;
        }
        if (!stopped) await new Promise((r) => setTimeout(r, 300));
      }
    };

    // Periodic timer for deadlines, player timeouts, and fallback signal polling
    // (never rely solely on kv.watch for room deadlines or cross-instance sync).
    const timer = setInterval(async () => {
      if (stopped) return;
      try {
        const t = now();
        const sig = await this.kv.get<SeqSignal>(["draw", "seq", roomId]);
        if (!sig.value) return;
        const needReconcile =
          (sig.value.deadline > 0 && t >= sig.value.deadline) ||
          sig.value.phase === "drawing" ||
          t - sig.value.updatedAt >= 2000;
        if (needReconcile) {
          await this.reconcileRoom(roomId);
        }
        if (t - lastCheckedAt >= 900) {
          lastCheckedAt = t;
          this.wakeLocal(roomId);
        }
      } catch {
        // ignore transient tick errors
      }
    }, 500);

    void watchLoop();

    this.roomWatchers.set(roomId, {
      stop: () => {
        stopped = true;
        clearInterval(timer);
        if (reader) {
          void reader.cancel().catch(() => {});
        }
      },
    });
  }

  private async cleanupRoomPrefix(prefix: Deno.KvKey) {
    try {
      const keys: Deno.KvKey[] = [];
      for await (const entry of this.kv.list({ prefix })) {
        keys.push(entry.key);
        if (keys.length >= 100) {
          const op = this.kv.atomic();
          for (const k of keys) op.delete(k);
          await op.commit();
          keys.length = 0;
        }
      }
      if (keys.length) {
        const op = this.kv.atomic();
        for (const k of keys) op.delete(k);
        await op.commit();
      }
    } catch {
      // best effort background cleanup
    }
  }

  private async pruneOldEvents(roomId: string, keepFromSeq: number) {
    if (keepFromSeq <= 1) return;
    try {
      const keys: Deno.KvKey[] = [];
      for await (const entry of this.kv.list({
        start: ["draw", "ev", roomId, 0],
        end: ["draw", "ev", roomId, keepFromSeq],
      }, { limit: 200 })) {
        keys.push(entry.key);
      }
      if (keys.length) {
        const op = this.kv.atomic();
        for (const k of keys) op.delete(k);
        await op.commit();
      }
    } catch {
      // ignore
    }
  }

  private async pruneOldChats(roomId: string) {
    try {
      const keys: Deno.KvKey[] = [];
      let count = 0;
      for await (const entry of this.kv.list({ prefix: ["draw", "chat", roomId] }, { reverse: true })) {
        count++;
        if (count > 80) keys.push(entry.key);
      }
      if (keys.length) {
        const op = this.kv.atomic();
        for (const k of keys) op.delete(k);
        await op.commit();
      }
    } catch {
      // ignore
    }
  }

  async mutateRoom<T>(
    roomId: string,
    fn: (ctx: RoomContext) => { ok: true; result: T } | { ok: false; status: number; error: string; code?: string },
  ): Promise<{ ok: true; result: T; room: RoomDoc } | { ok: false; status: number; error: string; code?: string }> {
    for (let attempt = 0; attempt < 15; attempt++) {
      const [roomEntry, usedEntry] = await this.kv.getMany<[RoomDoc, string[]]>([
        ["draw", "room", roomId],
        ["draw", "used", roomId],
      ]);
      if (!roomEntry.value) {
        return { ok: false, status: 404, error: "房间不存在或已解散", code: "NO_ROOM" };
      }
      const t = now();
      const room = structuredClone(roomEntry.value);
      const used = new Set<string>(usedEntry.value || []);
      const ctx = new RoomContext(room, used, t);
      ctx.reconcile();
      if (ctx.deleted) {
        const del = this.kv
          .atomic()
          .check(roomEntry)
          .delete(["draw", "room", roomId])
          .delete(["draw", "used", roomId])
          .delete(["draw", "seq", roomId])
          .delete(["draw", "summary", roomId]);
        const res = await del.commit();
        if (res.ok) {
          void this.cleanupRoomPrefix(["draw", "ev", roomId]);
          void this.cleanupRoomPrefix(["draw", "chat", roomId]);
          void this.cleanupRoomPrefix(["draw", "op", roomId]);
          this.wakeLocal(roomId);
          return { ok: false, status: 404, error: "房间不存在或已解散", code: "NO_ROOM" };
        }
        continue;
      }

      const out = fn(ctx);
      if (!out.ok) {
        // Still commit reconciliation if reconcile changed room state
        if (ctx.newEvents.length > 0 || ctx.usedChanged) {
          await this.commitContext(roomEntry, usedEntry, ctx);
        }
        return out;
      }

      const committed = await this.commitContext(roomEntry, usedEntry, ctx);
      if (committed) {
        return { ok: true, result: out.result, room: ctx.room };
      }
      await new Promise((r) => setTimeout(r, 2 + Math.floor(Math.random() * 12)));
    }
    return { ok: false, status: 503, error: "房间状态繁忙，请重试" };
  }

  private async commitContext(
    roomEntry: Deno.KvEntryMaybe<RoomDoc>,
    usedEntry: Deno.KvEntryMaybe<string[]>,
    ctx: RoomContext,
  ): Promise<boolean> {
    const roomId = ctx.room.id;
    let atomic = this.kv.atomic().check(roomEntry);
    atomic = atomic.set(["draw", "room", roomId], ctx.room);
    if (ctx.usedChanged) {
      atomic = atomic.check(usedEntry).set(["draw", "used", roomId], [...ctx.used]);
    }
    const sig: SeqSignal = {
      seq: ctx.room.seq,
      phase: ctx.room.phase,
      deadline: ctx.room.deadline,
      turnId: ctx.room.turnId,
      updatedAt: ctx.t,
    };
    atomic = atomic.set(["draw", "seq", roomId], sig);
    atomic = atomic.set(["draw", "summary", roomId], buildSummary(ctx.room, ctx.t));

    for (const ev of ctx.newEvents) {
      atomic = atomic.set(["draw", "ev", roomId, ev.seq], ev);
      if (ev.type === "chat") {
        atomic = atomic.set(["draw", "chat", roomId, ev.seq], ev);
      }
    }
    for (const b of ctx.newDrawBatches) {
      atomic = atomic.set(["draw", "op", roomId, b.turnId, b.seq], b.ops);
    }

    const res = await atomic.commit();
    if (!res.ok) return false;

    this.wakeLocal(roomId);
    for (const oldTurn of ctx.oldTurnIdsToClean) {
      void this.cleanupRoomPrefix(["draw", "op", roomId, oldTurn]);
    }
    if (ctx.newEvents.some((e) => e.type === "chat")) {
      void this.pruneOldChats(roomId);
    }
    if (ctx.room.oldestEvSeq > 1 && ctx.newEvents.length > 0) {
      void this.pruneOldEvents(roomId, ctx.room.oldestEvSeq);
    }
    return true;
  }

  async reconcileRoom(roomId: string): Promise<RoomDoc | null> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const [roomEntry, usedEntry] = await this.kv.getMany<[RoomDoc, string[]]>([
        ["draw", "room", roomId],
        ["draw", "used", roomId],
      ]);
      if (!roomEntry.value) return null;
      const t = now();
      const room = structuredClone(roomEntry.value);
      const used = new Set<string>(usedEntry.value || []);
      const ctx = new RoomContext(room, used, t);
      const changed = ctx.reconcile();
      if (ctx.deleted) {
        const res = await this.kv
          .atomic()
          .check(roomEntry)
          .delete(["draw", "room", roomId])
          .delete(["draw", "used", roomId])
          .delete(["draw", "seq", roomId])
          .delete(["draw", "summary", roomId])
          .commit();
        if (res.ok) {
          void this.cleanupRoomPrefix(["draw", "ev", roomId]);
          void this.cleanupRoomPrefix(["draw", "chat", roomId]);
          void this.cleanupRoomPrefix(["draw", "op", roomId]);
          this.wakeLocal(roomId);
          return null;
        }
        continue;
      }
      if (!changed) return room;
      const ok = await this.commitContext(roomEntry, usedEntry, ctx);
      if (ok) return ctx.room;
    }
    const latest = await this.kv.get<RoomDoc>(["draw", "room", roomId]);
    return latest.value;
  }

  async createRoom(name: unknown, settingsRaw: Record<string, unknown>, body: Record<string, unknown>) {
    const t = now();
    for (let attempt = 0; attempt < 15; attempt++) {
      const roomId = String(Math.floor(100000 + Math.random() * 900000));
      const existing = await this.kv.get<RoomDoc>(["draw", "room", roomId]);
      if (existing.value) continue;

      const room: RoomDoc = {
        id: roomId,
        name: clean(name, 16) || "欢乐画画房",
        settings: defaultSettings(settingsRaw),
        players: {},
        ownerId: null,
        phase: "waiting",
        round: 0,
        order: [],
        turnIdx: -1,
        turnId: 0,
        drawerId: null,
        word: null,
        wordCat: null,
        choices: [],
        revealed: [],
        deadline: 0,
        turnStart: 0,
        guessOrder: [],
        turnDelta: {},
        lastResult: null,
        seq: 0,
        oldestEvSeq: 1,
        createdAt: t,
        emptySince: 0,
      };
      const ctx = new RoomContext(room, new Set(), t);
      const p = ctx.addPlayer(body);

      let atomic = this.kv
        .atomic()
        .check(existing)
        .set(["draw", "room", roomId], ctx.room)
        .set(["draw", "used", roomId], [])
        .set(["draw", "seq", roomId], {
          seq: ctx.room.seq,
          phase: ctx.room.phase,
          deadline: ctx.room.deadline,
          turnId: ctx.room.turnId,
          updatedAt: t,
        } satisfies SeqSignal)
        .set(["draw", "summary", roomId], buildSummary(ctx.room, t));

      for (const ev of ctx.newEvents) {
        atomic = atomic.set(["draw", "ev", roomId, ev.seq], ev);
        if (ev.type === "chat") atomic = atomic.set(["draw", "chat", roomId, ev.seq], ev);
      }

      const res = await atomic.commit();
      if (res.ok) return { roomId, pid: p.id, token: p.token };
    }
    throw new Error("创建房间失败，请重试");
  }

  async countAndListPublicRooms() {
    const t = now();
    const list: {
      id: string;
      name: string;
      phase: string;
      players: number;
      maxPlayers: number;
      category: string;
      hasPassword: boolean;
      round: number;
      rounds: number;
      owner: string;
      avatars: string[];
    }[] = [];
    let totalOnline = 0;
    let totalRooms = 0;

    for await (const entry of this.kv.list<RoomSummary>({ prefix: ["draw", "summary"] })) {
      const s = entry.value;
      const onCount = s.playerLastSeens.filter((ls) => t - ls < 25000).length;
      if (onCount === 0 && s.emptySince > 0 && t - s.emptySince > 10 * 60 * 1000) {
        void this.reconcileRoom(s.id);
        continue;
      }
      totalRooms++;
      totalOnline += onCount;
      if (s.isPublic && onCount > 0) {
        list.push({
          id: s.id,
          name: s.name,
          phase: s.phase,
          players: onCount,
          maxPlayers: s.maxPlayers,
          category: s.category,
          hasPassword: s.hasPassword,
          round: s.round,
          rounds: s.rounds,
          owner: s.owner,
          avatars: s.avatars,
        });
      }
    }

    list.sort(
      (a, b) =>
        (a.phase === "waiting" ? -1 : 1) - (b.phase === "waiting" ? -1 : 1) ||
        b.players - a.players,
    );
    return {
      rooms: list.slice(0, 60),
      online: totalOnline,
      totalRooms,
    };
  }

  async quickJoin(body: Record<string, unknown>) {
    const t = now();
    const cands: { id: string; phase: string; onlineCount: number }[] = [];
    for await (const entry of this.kv.list<RoomSummary>({ prefix: ["draw", "summary"] })) {
      const s = entry.value;
      const onCount = s.playerLastSeens.filter((ls) => t - ls < 25000).length;
      if (s.isPublic && !s.hasPassword && onCount > 0 && onCount < s.maxPlayers) {
        cands.push({ id: s.id, phase: s.phase, onlineCount: onCount });
      }
    }
    cands.sort(
      (a, b) =>
        (a.phase === "waiting" ? 0 : 1) - (b.phase === "waiting" ? 0 : 1) ||
        b.onlineCount - a.onlineCount,
    );
    for (const c of cands) {
      const res = await this.mutateRoom(c.id, (ctx) => {
        if (!ctx.room.settings.isPublic || ctx.room.settings.password) {
          return { ok: false, status: 409, error: "房间不可快速加入" };
        }
        if (onlinePlayers(ctx.room, ctx.t).length >= ctx.room.settings.maxPlayers) {
          return { ok: false, status: 409, error: "房间已满", code: "FULL" };
        }
        const p = ctx.addPlayer(body);
        return { ok: true, result: { roomId: ctx.room.id, pid: p.id, token: p.token } };
      });
      if (res.ok) return res.result;
    }
    return await this.createRoom("快速匹配房", { isPublic: true }, body);
  }

  async getRoomPublicInfo(roomId: string) {
    const room = await this.reconcileRoom(roomId);
    if (!room) return null;
    const t = now();
    return {
      id: room.id,
      name: room.name,
      phase: room.phase,
      players: onlinePlayers(room, t).length,
      maxPlayers: room.settings.maxPlayers,
      hasPassword: !!room.settings.password,
    };
  }

  async pollResponse(room: RoomDoc, me: string, since: number) {
    const t = now();
    if (since <= 0 || since < room.oldestEvSeq - 1 || since > room.seq) {
      const ops: DrawOp[] = [];
      for await (const e of this.kv.list<DrawOp[]>({
        prefix: ["draw", "op", room.id, room.turnId],
      })) {
        // A concurrent writer may commit after the room snapshot was read.
        // Do not replay its operation here and again in the subsequent delta.
        if (Number(e.key[4]) > room.seq) continue;
        for (const op of e.value) ops.push(op);
      }
      const chatsRev: GameEvent[] = [];
      for await (const e of this.kv.list<GameEvent>(
        { prefix: ["draw", "chat", room.id] },
        { reverse: true, limit: 80 },
      )) {
        chatsRev.push(e.value);
      }
      const chats = chatsRev.reverse();
      return {
        resync: true,
        seq: room.seq,
        ops,
        chats: filterEvents(room, chats, me),
        state: viewState(room, me, t),
        now: t,
      };
    }
    const evs: GameEvent[] = [];
    for await (const e of this.kv.list<GameEvent>({
      start: ["draw", "ev", room.id, since + 1],
      end: ["draw", "ev", room.id, room.seq + 1],
    })) {
      evs.push(e.value);
    }
    return {
      seq: room.seq,
      events: filterEvents(room, evs, me),
      state: viewState(room, me, t),
      now: t,
    };
  }

  async touchLastSeen(roomId: string, pidVal: string, tokenVal: string, force = false): Promise<RoomDoc | null> {
    const entry = await this.kv.get<RoomDoc>(["draw", "room", roomId]);
    if (!entry.value) return null;
    const p = entry.value.players[pidVal];
    if (!p || p.token !== tokenVal) return null;
    const t = now();
    if (!force && t - p.lastSeen < 8000) {
      return await this.reconcileRoom(roomId);
    }
    const res = await this.mutateRoom(roomId, (ctx) => {
      const pl = ctx.room.players[pidVal];
      if (!pl || pl.token !== tokenVal) {
        return { ok: false, status: 401, error: "请重新加入房间", code: "AUTH" };
      }
      pl.lastSeen = ctx.t;
      ctx.room.emptySince = 0;
      return { ok: true, result: true };
    });
    return res.ok ? res.room : null;
  }

  async addDrawOps(
    roomId: string,
    pidVal: string,
    tokenVal: string,
    turnIdVal: number,
    rawOps: unknown,
  ): Promise<{ ok: true; result: { ok: boolean } } | { ok: false; status: number; error: string; code?: string }> {
    const ops = Array.isArray(rawOps) ? rawOps.slice(0, 200) : [];
    const okOps: DrawOp[] = ops.filter((o): o is DrawOp => {
      if (!o || !["line", "fill", "clear", "undo"].includes(o.k)) return false;
      if (o.k === "clear" || o.k === "undo") return true;
      if (!/^#[0-9a-f]{6}$/i.test(o.c) || typeof o.id !== "string" || o.id.length > 64) return false;
      if (o.k === "fill") {
        return Number.isFinite(o.x) && Number.isFinite(o.y) && o.x >= 0 && o.x <= 960 && o.y >= 0 && o.y <= 720;
      }
      return (
        Number.isFinite(o.s) &&
        o.s >= 1 &&
        o.s <= 80 &&
        Array.isArray(o.p) &&
        o.p.length <= 12000 &&
        o.p.length % 2 === 0 &&
        o.p.every((v: unknown, i: number) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= (i % 2 ? 720 : 960))
      );
    });
    if (!okOps.length) {
      // Still validate auth & phase/turnId!
      return await this.mutateRoom(roomId, (ctx) => {
        const p = ctx.room.players[pidVal];
        if (!p || p.token !== tokenVal) return { ok: false, status: 401, error: "请重新加入房间", code: "AUTH" };
        p.lastSeen = ctx.t;
        if (turnIdVal !== ctx.room.turnId) return { ok: false, status: 409, error: "回合已变化" };
        if (ctx.room.drawerId !== p.id || ctx.room.phase !== "drawing") {
          return { ok: false, status: 409, error: "现在不是你作画" };
        }
        return { ok: true, result: { ok: true } };
      });
    }

    const batches = splitDrawOps(okOps);
    // Commit in groups of <= 6 batches per atomic transaction to stay well under KV transaction limits
    for (let i = 0; i < batches.length; i += 6) {
      const slice = batches.slice(i, i + 6);
      const res = await this.mutateRoom<{ ok: boolean }>(roomId, (ctx) => {
        const p = ctx.room.players[pidVal];
        if (!p || p.token !== tokenVal) return { ok: false, status: 401, error: "请重新加入房间", code: "AUTH" };
        p.lastSeen = ctx.t;
        if (turnIdVal !== ctx.room.turnId) return { ok: false, status: 409, error: "回合已变化" };
        if (ctx.room.drawerId !== p.id || ctx.room.phase !== "drawing") {
          return { ok: false, status: 409, error: "现在不是你作画" };
        }
        for (const batch of slice) {
          const ev = ctx.push({ type: "draw", from: p.id, turnId: ctx.room.turnId, ops: batch });
          ctx.newDrawBatches.push({ seq: ev.seq, turnId: ctx.room.turnId, ops: batch });
        }
        return { ok: true, result: { ok: true } };
      });
      if (!res.ok) return res;
    }
    return { ok: true, result: { ok: true } };
  }
}
