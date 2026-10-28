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

/**
 * 10大你画我猜与进阶派对玩法模式：
 * - classic: 经典你画我猜（轮流/自由作画 + 实时猜词 + JEV 多模态鉴画）
 * - drawful: 妙笔生谎（画怪异题 -> 全员编假题目骗票 -> 混合盲投）
 * - doodle-puzzle: 猜拆画画（多人分块拼图 + 坏坏内鬼擦改破坏 + 揪出内鬼）
 * - pictomania: 妙笔神猜（公开近似词库 + 全员同步作画与极速抢答）
 * - monsdrawsity: 怪兽目击者（20秒瞬时记忆猎奇目击图 + 口述全员画像 + 双盲评选）
 * - secret-ink: 隐形墨水模式（Gartic 变体：落笔 2 秒后自动隐形盲画，揭晓全显）
 * - knock-off: 高仿山寨模式（Gartic 变体：60s -> 30s -> 15s -> 8s 极限临摹退化）
 * - complement: 残缺补全模式（Gartic 变体：基于初始残缺线条脑洞补全整幅作品）
 * - sandwich: 三明治模式（Gartic 变体：写词 -> 连续多轮看画重画畸变 -> 最终猜词）
 * - animation: 逐帧动画接力（Gartic 变体：仅看上一帧半透明洋葱皮残影，合成 5fps 魔性动画）
 */
export type PartyMode =
  | 'classic'
  | 'drawful'
  | 'doodle-puzzle'
  | 'pictomania'
  | 'monsdrawsity'
  | 'secret-ink'
  | 'knock-off'
  | 'complement'
  | 'sandwich'
  | 'animation';

export const PARTY_MODES: readonly PartyMode[] = [
  'classic', 'drawful', 'doodle-puzzle', 'pictomania', 'monsdrawsity',
  'secret-ink', 'knock-off', 'complement', 'sandwich', 'animation',
] as const;

export interface PartyModeInfo {
  id: PartyMode;
  name: string;
  subtitle: string;
  description: string;
}

export const PARTY_MODE_INFO: readonly PartyModeInfo[] = [
  { id: 'classic', name: '经典你画我猜', subtitle: '看画抢答 + AI 看画点评', description: '画手根据机密题目作画，猜词玩家实时猜词或提问，支持 AI 看画点评传神度。' },
  { id: 'drawful', name: '妙笔生谎 Drawful', subtitle: '全员瞎掰骗票 · 骗票+2分', description: '画手画奇趣脑洞题，其他玩家编造假题目混入真答案，全员盲投。' },
  { id: 'doodle-puzzle', name: '猜拆画画', subtitle: '4象限分块合画 + 抓内鬼', description: '4人分块拼图作画，隐藏内鬼「坏坏」暗中破坏，猜词同时投票抓内鬼。' },
  { id: 'pictomania', name: '妙笔神猜', subtitle: '公开16近似词 · 极速抢答', description: '全员公开16个易混淆候选词，同步作画与竞速抢答，越早猜中得分越高。' },
  { id: 'monsdrawsity', name: '怪兽目击者', subtitle: '20秒瞬时记忆 + 口述画像', description: '目击者限时20秒观察猎奇异兽并口述特征，全员还原画像并投票评选最佳画师。' },
  { id: 'secret-ink', name: '隐形墨水', subtitle: '传声筒变体 · 落笔2秒消失', description: '画手落笔2秒后线条自动隐形，考验空间记忆盲画，揭晓时全部显形。' },
  { id: 'knock-off', name: '高仿山寨', subtitle: '传声筒变体 · 60→30→15→8秒', description: '逐帧递减时间接力临摹上一幅画，看名画如何一步步退化成火柴人。' },
  { id: 'complement', name: '残缺补全', subtitle: '传声筒变体 · 初始线条脑洞补全', description: '画板自带神秘初始残缺线条，发挥脑洞将其补全为完整主题作品。' },
  { id: 'sandwich', name: '三明治传声筒', subtitle: '传声筒变体 · 多帧重画畸变', description: '写词 → 多轮看画重画畸变 → 最终猜词，抽象传话快乐翻倍。' },
  { id: 'animation', name: '逐帧定格动画', subtitle: '传声筒变体 · 洋葱皮 + 5fps连播', description: '仅看上一帧24%半透明洋葱皮残影接力作画，完成后自动5fps循环播放。' },
] as const;

export type DeviceKind = 'desktop' | 'tablet' | 'mobile' | 'stylus';
export interface DeviceInfo {
  kind: DeviceKind;
  os: string;      // 如 'macOS', 'Windows', 'iPadOS', 'iOS', 'Android', 'Linux'
  browser: string; // 如 'Chrome', 'Safari', 'Firefox', 'Edge'
  label: string;   // 如 'macOS · Chrome', 'iPad · Apple Pencil'
}

export type ErrorCode =
  | 'NOT_FOUND' | 'ROOM_FULL' | 'NOT_HOST' | 'BAD_PHASE' | 'QUOTA_EXCEEDED' | 'NOT_YOUR_TURN'
  | 'PENDING' | 'INVALID' | 'RATE_LIMITED' | 'NOT_IN_ROOM' | 'INTERNAL';

export type Ack<T = undefined> = { ok: true; value: T } | { ok: false; code: ErrorCode; msg: string };

export interface PuzzleSource { key: string; repo: string; url: string; license: string }

/** data/puzzles.json 的元素（你画我猜词条：surface 为公开提示如“4个字 · 动物”，bottom 为保密目标词） */
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
  surfacePreview: string; // 公开提示前 60 字
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

/** 仅服务端使用，绝不发送给非画手客户端（揭晓后只发 bottom/hints） */
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
  turnSeconds: number; // 15..600，默认90；判题暂停、超时跳过
  maxGuesses: number;  // 1..10，默认 3
  excludeNsfl: boolean; // 默认 true（影响随机选题）
  partyMode?: PartyMode; // 默认 'classic'
}

export const DEFAULT_SETTINGS: Settings = {
  quotaMode: 'perPlayer',
  quota: 8,
  turnMode: 'free',
  turnSeconds: 90,
  maxGuesses: 3,
  excludeNsfl: true,
};

export const LIMITS = {
  maxPlayers: 8,
  questionMax: 120,
  guessMax: 400,
  nameMax: 16,
  highlightsMax: 100,
  turnSecondsMin: 15,
  turnSecondsMax: 600,
  strokesMax: 300,
  pointsPerStrokeMax: 500,
  brushSizeMin: 2,
  brushSizeMax: 48,
} as const;

/** UTF-16 offsets into the public surface, never secret text. Scoped to a round by requests. */
export interface SurfaceHighlight {
  id: string;
  start: number;
  end: number;
  playerKey: string;
  playerName: string;
}
export interface HighlightRequest { round: number; start: number; end: number }
export interface RemoveHighlightRequest { round: number; id: string }
export interface HintAnnouncement { id: string; round: number; index: number; playerKey: string; playerName: string }
export interface LeaderboardEntry { rank: number; name: string; avatar: string; points: number; questions: number; bestProximity: number }
export interface LeaderboardResponse { entries: LeaderboardEntry[]; self: LeaderboardEntry | null }

/** 你画我猜：画板笔触与同步数据结构（支持 perfect-freehand 压感 p） */
export type DrawTool = 'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle';
export interface DrawPoint { x: number; y: number; p?: number }
export interface CanvasStroke {
  id: string;
  tool: DrawTool;
  color: string;
  size: number; // 2..48
  points: DrawPoint[]; // 归一化坐标 0..1000
  playerKey: string;
  playerName: string;
  at: number;
  frameIndex?: number;    // 用于逐帧动画 / 接力重画帧序号
  quadrant?: 0 | 1 | 2 | 3; // 用于《猜拆画画》四宫格分块位置
  sabotage?: boolean;     // 是否为内鬼破坏笔触（揭晓前对普通玩家隐藏标记）
}
export interface StrokeInput {
  round?: number;
  tool: DrawTool;
  color: string;
  size: number;
  points: DrawPoint[];
  frameIndex?: number;
  quadrant?: 0 | 1 | 2 | 3;
  sabotage?: boolean;
}
export interface AiCanvasGuess {
  guess: string;
  comment: string;
  confidence: number;
  similarity: number; // 0..100
  multimodal?: boolean; // 是否通过 JEV 真实视觉图像输入判定
  at: number;
}

/** 《Drawful》妙笔生谎选项（投票阶段打乱顺序，绝不标记哪项是真答案，揭晓后才显示 authorName 与 isTruth） */
export interface DrawfulChoiceView {
  id: string;
  text: string;
  votes: string[]; // 投票给该项的玩家昵称列表
  authorName?: string; // 仅 revealed 阶段暴露；真题为 '系统真题'
  isTruth?: boolean;   // 仅 revealed 阶段暴露
}

/** 进阶派对模式公开状态视图（严守防剧透原则，绝不含未揭晓的真题 bottom 或内鬼真实身份） */
export interface PartyStateView {
  mode: PartyMode;
  stageDescription: string;
  // Drawful 妙笔生谎
  bluffSubmittedNames?: string[]; // 已提交假答案的玩家昵称
  drawfulChoices?: DrawfulChoiceView[]; // 收集满或进入投票后公开的混合选项
  votedNames?: string[];
  // Doodle Puzzle 猜拆画画
  quadrantOwners?: { quadrant: 0 | 1 | 2 | 3; playerKey: string; playerName: string }[];
  sabotagedQuadrant?: 0 | 1 | 2 | 3 | null; // 被做手脚的象限（仅揭晓后或抓内鬼后公开）
  accusedVotes?: { voterName: string; suspectName: string }[];
  saboteurName?: string | null; // 仅 revealed 阶段公开内鬼身份
  // Pictomania 妙笔神猜
  candidateWords?: string[]; // 桌面公开的 16~20 个近似干扰词
  solvedRankings?: { playerName: string; points: number; at: number }[];
  // MonsDRAWsity 怪兽目击者
  witnessKey?: string | null;
  witnessName?: string | null;
  memoryDeadline?: number | null; // 20秒目击记忆截止时间
  monsterFeatures?: string[];     // 怪兽公开外貌维度提示（目击阶段仅目击者可见完整奇葩组合）
  bestArtistWinner?: string | null;
  // Gartic 变体（隐形墨水 / 山寨临摹 / 残缺补全 / 三明治 / 逐帧动画）
  inkFadeMs?: number | null;      // secret-ink: 2000ms 自动消隐
  currentFrame?: number;          // animation / sandwich / knock-off 当前帧
  totalFrames?: number;           // 总帧数
  knockOffSeconds?: number | null; // knock-off 当前接力者限时秒数 (60 -> 30 -> 15 -> 8)
}

export interface PlayerView {
  key: string; // playerKey；仅用于房内识别/踢人
  name: string;
  avatar?: string;
  device?: DeviceInfo; // 玩家当前使用的设备标识（如 macOS · Chrome / iPad · 触控笔）
  online: boolean;
  isHost: boolean;
  asked: number;
  guesses: number;
  pending: boolean;
  roundPoints?: number;
  totalPoints?: number;
}

export interface QAView {
  id: string;
  playerKey: string;
  playerName: string;
  avatar?: string;
  text: string;
  verdict: Verdict;
  at: number;
  proximity?: number; // 0..100，独立评估本问与目标词的接近程度，不含解释
  points?: number; // 本次实际获得0..10积分；重复问题不重复加分
}

export interface GuessView {
  id: string;
  playerKey: string;
  playerName: string;
  avatar?: string;
  text: string;
  outcome: Outcome;
  at: number;
  points?: number;
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
  highlights: SurfaceHighlight[]; // 当前题面提示的共享高亮
  hints: string[];        // 已公开的提示
  hintAnnouncement?: HintAnnouncement | null;
  hintCount: number;      // 题目提示总数
  sharedUsed: number;
  turnKey: string | null;
  turnDeadline: number | null; // 服务端绝对截止时间；暂停时为null
  turnRemainingMs: number | null; // 判题暂停时冻结的余量
  serverNow: number; // 投影时的服务端时间，用于客户端时钟偏差校正
  round: number;
  reveal: RevealView | null; // 仅 phase==='revealed' 时非 null
  wordCategory?: string;
  wordLength?: number;
  progress?: ProgressView | null;
  drawerKey?: string | null; // 当前主画手玩家 key
  strokes?: CanvasStroke[];  // 当前画板笔触列表（重连全量同步）
  aiGuess?: AiCanvasGuess | null; // JEV 多模态 AI 识图猜画最新结论
  party?: PartyStateView | null;  // 进阶聚会模式专属公开状态
}

export interface DrawerSecretView {
  word: string;
  category: string;
  hints: string[];
  role?: 'drawer' | 'guesser' | 'saboteur' | 'witness';
  roleHint?: string;
}

export interface ClientToServer {
  'room:join': (p: JoinRoomRequest, ack: (r: Ack<RoomView>) => void) => void;
  'room:leave': (ack?: (r: Ack) => void) => void;
  'room:settings': (p: Partial<Settings>, ack: (r: Ack) => void) => void;
  'room:kick': (p: { playerKey: string }, ack: (r: Ack) => void) => void;
  'game:start': (p: { puzzleId?: string }, ack: (r: Ack) => void) => void; // 无 puzzleId 则随机（排除本房已玩）
  'q:ask': (p: { text: string }, ack: (r: Ack<{ id: string }>) => void) => void;
  'guess:submit': (p: { text: string; round: number }, ack: (r: Ack<{ id: string }>) => void) => void;
  'hint:show': (ack: (r: Ack) => void) => void;
  'surface:highlight': (p: HighlightRequest, ack: (r: Ack) => void) => void;
  'surface:unhighlight': (p: RemoveHighlightRequest, ack: (r: Ack) => void) => void;
  'canvas:stroke': (p: StrokeInput, ack: (r: Ack<CanvasStroke>) => void) => void;
  'canvas:undo': (p: { round?: number }, ack: (r: Ack) => void) => void;
  'canvas:clear': (p: { round?: number }, ack: (r: Ack) => void) => void;
  'canvas:next-frame': (p: { round?: number }, ack: (r: Ack) => void) => void;
  'canvas:ai-guess': (p: { snapshotDataUrl?: string }, ack: (r: Ack<AiCanvasGuess>) => void) => void;
  'drawer:word': (ack: (r: Ack<DrawerSecretView>) => void) => void;
  'party:bluff': (p: { text: string }, ack: (r: Ack) => void) => void;
  'party:vote': (p: { targetId: string }, ack: (r: Ack) => void) => void;
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
export interface CreateRoomRequest { name: string; playerKey: string; avatar?: string; device?: DeviceInfo }
export interface JoinRoomRequest extends CreateRoomRequest { code: string }
export interface CreateRoomResponse { code: string }
