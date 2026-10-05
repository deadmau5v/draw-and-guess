// 前后端唯一契约。由 Lead 维护；实现方不得修改（如必须，改后在 NOTES.md 说明）。

export type Verdict = '是' | '不是' | '不相关' | '不确定' | '判定中' | '出错';
export type Outcome = '破解成功' | '接近真相' | '还没猜对' | '不确定' | '判定中' | '出错';
export type Phase = 'lobby' | 'playing' | 'revealed';
/** 房间大厅仅展示加入所需摘要，不包含题目、提示或玩家身份。 */
export interface RoomLobbySummary {
  code: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  phase: 'lobby' | 'playing';
}
export type QuotaMode = 'perPlayer' | 'shared' | 'unlimited';
export type TurnMode = 'free' | 'turns';
export type RevealReason = 'solved' | 'host' | 'exhausted';
export type Tier = 'high' | 'mid' | 'low' | 'none';
export type SortKey = 'good' | 'mid' | 'low' | 'hot' | 'new';

export type ErrorCode =
  | 'NOT_FOUND' | 'ROOM_FULL' | 'NOT_HOST' | 'BAD_PHASE' | 'QUOTA_EXCEEDED' | 'NOT_YOUR_TURN'
  | 'PENDING' | 'INVALID' | 'RATE_LIMITED' | 'NOT_IN_ROOM' | 'INTERNAL';

export type Ack<T = undefined> = { ok: true; value: T } | { ok: false; code: ErrorCode; msg: string };

export interface PuzzleSource { key: string; repo: string; url: string; license: string }

/** data/puzzles.json 的元素 */
export interface SeedPuzzle {
  id: string;
  title: string;
  surface: string;
  bottom: string;
  hints: string[];
  difficulty: number | null;
  tags: string[];
  nsfl: boolean;
  source: PuzzleSource;
  alsoIn: string[];
}

export interface PuzzleSummary {
  id: string;
  title: string;
  surfacePreview: string; // 汤面前 60 字
  difficulty: number | null;
  tags: string[];
  nsfl: boolean;
  hintCount: number;
  goodRate: number | null; // 0..1
  tier: Tier;
  funny: number;
  ratings: number;
  plays: number;
  solves: number;
  sourceKey: string;
}

export interface PuzzlePublic extends Omit<PuzzleSummary, 'surfacePreview'> {
  surface: string;
  source: PuzzleSource;
}

/** 仅服务端使用，绝不发送给客户端（揭晓后只发 bottom/hints） */
export interface PuzzleSecret extends PuzzlePublic {
  bottom: string;
  hints: string[];
}

export interface PuzzleListQuery {
  tag?: string;
  sort?: SortKey;
  q?: string;
  excludeNsfl?: boolean;
  limit?: number; // 默认 60，最大 200
  offset?: number;
}

export interface Settings {
  quotaMode: QuotaMode;
  quota: number;       // 1..50，默认 8
  turnMode: TurnMode;  // 默认 free
  maxGuesses: number;  // 1..10，默认 3
  excludeNsfl: boolean; // 默认 true（影响随机选题）
}

export const DEFAULT_SETTINGS: Settings = {
  quotaMode: 'perPlayer',
  quota: 8,
  turnMode: 'free',
  maxGuesses: 3,
  excludeNsfl: true,
};

export const LIMITS = { maxPlayers: 8, questionMax: 120, guessMax: 400, nameMax: 16 } as const;

export interface PlayerView {
  key: string; // playerKey；仅用于房内识别/踢人
  name: string;
  avatar?: string;
  online: boolean;
  isHost: boolean;
  asked: number;
  guesses: number;
  pending: boolean;
}

export interface QAView {
  id: string;
  playerKey: string;
  playerName: string;
  avatar?: string;
  text: string;
  verdict: Verdict;
  at: number;
}

export interface GuessView {
  id: string;
  playerKey: string;
  playerName: string;
  avatar?: string;
  text: string;
  outcome: Outcome;
  at: number;
}

export interface RevealView {
  bottom: string;
  hints: string[];
  winnerName: string | null;
  reason: RevealReason;
}

export interface ProgressView {
  score: number; // 0 - 100 整数或浮点百分比
  status: string; // 阶段描述，如「迷雾重重」「初见端倪」「渐入佳境」「临门一脚」「真相大白」
}

export interface RoomView {
  code: string;
  phase: Phase;
  hostKey: string;
  settings: Settings;
  players: PlayerView[];
  puzzle: PuzzlePublic | null;
  log: QAView[];
  guesses: GuessView[];
  hints: string[];        // 已公开的提示
  hintCount: number;      // 题目提示总数
  sharedUsed: number;
  turnKey: string | null;
  round: number;
  reveal: RevealView | null; // 仅 phase==='revealed' 时非 null
  progress?: ProgressView | null;
}

export interface ClientToServer {
  'room:join': (p: JoinRoomRequest, ack: (r: Ack<RoomView>) => void) => void;
  'room:leave': (ack?: (r: Ack) => void) => void;
  'room:settings': (p: Partial<Settings>, ack: (r: Ack) => void) => void;
  'room:kick': (p: { playerKey: string }, ack: (r: Ack) => void) => void;
  'game:start': (p: { puzzleId?: string }, ack: (r: Ack) => void) => void; // 无 puzzleId 则随机（排除本房已玩）
  'q:ask': (p: { text: string }, ack: (r: Ack<{ id: string }>) => void) => void;
  'guess:submit': (p: { text: string }, ack: (r: Ack<{ id: string }>) => void) => void;
  'hint:show': (ack: (r: Ack) => void) => void;
  'game:reveal': (ack: (r: Ack) => void) => void;
  'rate': (p: { score: 1 | 0 | -1; funny: boolean }, ack: (r: Ack) => void) => void;
}

export interface ServerToClient {
  'room:state': (room: RoomView) => void;
  'game:revealed': (r: RevealView) => void;
  'room:kicked': () => void;
  'toast': (t: { level: 'info' | 'warn' | 'error'; msg: string }) => void;
}

/** HTTP */
export interface HealthResponse { ok: true; puzzles: number; model: string; cost: number; judgeConfigured: boolean }
export interface CreateRoomRequest { name: string; playerKey: string; avatar?: string }
export interface JoinRoomRequest extends CreateRoomRequest { code: string }
export interface CreateRoomResponse { code: string }
