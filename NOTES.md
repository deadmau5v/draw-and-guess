# 实现笔记

## 待协调

- fix 第 1 轮最终验收：标准 `pnpm test` 退出 0，27 文件 / 108 测试全部通过（包括真实快照/真实题库及 NOTICE、限流业务拒绝、规格状态机与重连投影）；标准 `pnpm build` 退出 0，49 模块构建成功且内置 tsc 通过；独立 `pnpm exec tsc -p tsconfig.json --noEmit` 退出 0，无需忽略任何文件的类型错误。标准 `pnpm import:puzzles` 退出 0：anchor 41、zerotang 30、haiguitang 38、deepturtle 0，合并 4、最终 105、nsfl 29。可选 deepturtle 缺快照按规格警告跳过。未调用真实 Jev，未读取/打印 .env，未执行 add/install 或请求提权，未留下后台作业。协议 SHA256 与审查一致：690D63B7F0EAF9C77039F9C55A1D9BEE2CCDD3D62F8B4D27ED5743C28AC2F2C9。

- fix 第 1 轮决策：采用审查允许的「补充判重规则」，不使用无条件 ID 映射、不降低全库 0.6/0.5 阈值。仅两个经典题族同时满足标题和汤底核心事实时判重：酒吧/酒保的枪要求酒保、打嗝、惊吓；半根火柴要求热气球、抽火柴、跳下/坠落/离开吊篮。保留 hints → MIT/GPL/AGPL → 汤底长度的原优先级。真实快照回归均先观察失败，再实现规则；重生成题库共 105 题（合并 4），两组经典题保留 zerotang 且 alsoIn=['anchor']，NOTICE 在两个来源分组标注。此为范围授权内的规格补充实现，不声称获得另一个 Lead 的单独批准。
- fix 第 1 轮接口决定：按 SPEC §6 修正，不保留偏差接口。RoomManager.start(code,key,puzzleId,hintCount=0)、showHint(code,key,hintCount)，内部不再保存 PuzzlePublic 或提示文本。Socket 从 repo.getPublic 和已公开提示计数组装 RoomView，包括 join ack/重连/广播；状态机的裸视图 puzzle=null、hints=[]，揭晓仍由 Socket 查询并 setReveal。shared/protocol.ts 未修改。
- fix 第 1 轮限流：check 为只检查，commit 仅在 beginAsk/beginGuess 成功后同步调用；无 await 窗口。BAD_PHASE、INVALID、PENDING、NOT_YOUR_TURN 拒绝不计入 2 秒间隔或每分钟额度；成功入队（包括后来判题出错）的请求仍正常计数。新增 Socket 回归先确认失败，再实现并通过。

- integrate 最终验证：`pnpm exec vite build --configLoader native` 成功（49 模块、JS 212.52KB / gzip 68.82KB、CSS 22.06KB），随后全项目 tsc 通过。已后台执行标准 `pnpm start`，实测 `http://localhost:3001/api/health` 返回 `{ok:true,puzzles:107,model:"typesafe/jev-1.13",cost:0,judgeConfigured:false}`，生产 SPA 深链接返回 200；启动日志只有题数、模型与 key 配置状态。冒烟后已停止作业并确认 3001 不再监听。初次额外 SPA 检查遇到 PowerShell 非交互解析提示，补 `-UseBasicParsing` 后成功。不读取/打印 .env 内容，不使用真实 Jev key。
- integrate 接线接口：`createApp({config,repo,judge,rooms,db})` 返回 `{httpServer,io,broadcast(code),close()}`；close 幂等，等待房间判题队列后关闭 Socket.IO/HTTP 和注入数据库。入口每 15 秒 sweep 并广播房主变更；所有客户端事件均接线。E2E 共 7 项，覆盖两人判题/揭晓前载荷保密/重连隔离、房主操作与评分、串行队列/限流/异常退款、耗尽揭晓、HTTP 校验与真实启动。生产入口默认 NODE_ENV=production（未显式设置时），只有构建文件存在才托管 SPA。

- integrate：标准 `pnpm test` 已通过 27 文件 / 94 测试，`pnpm exec tsc -p tsconfig.json --noEmit` 全项目无错误。标准 `pnpm build` 仍在 Vite 默认配置打包的 `externalize-deps → child_process.exec → spawn EPERM` 失败。未提权、未重试相同被拒操作、未修改范围外 package.json；请 Lead 将 build 脚本改为 `vite build --configLoader native && tsc -p tsconfig.json --noEmit`。本阶段没有修改 core/web 源码或共享协议。

- web 最终验证：新增无障碍 skip-link 哈希路由回归的红绿测试后，标准 `pnpm exec vitest run tests/web` 为 6 文件 / 20 项全部通过；`pnpm exec vite build --configLoader native` 再次成功（JS 212.52KB / gzip 68.82KB，CSS 22.06KB / gzip 6.10KB）；标准 `pnpm exec tsc -p tsconfig.json --noEmit` 全项目无错误。页面/全部指定组件、typed socket 重连、API、配色/额度、输入限制与中文响应式主题均已完成。仍需 Lead 协调默认构建脚本的 native 配置加载参数；未做服务器或浏览器联调。

- core 最终验证更新：8 文件 / 41 项核心测试通过（RoomManager 18 项覆盖 SPEC 13 条必测及重连/迟到判定）；全项目 `pnpm test` 24 文件 / 87 项通过；标准 `pnpm exec tsc -p tsconfig.json --noEmit` 退出 0。下方早期 web mock 类型错误已由 web 修复。core 无待协调源码改动，真实 Jev 调用未执行。

- web 验证更新：`pnpm exec vitest run tests/web` 标准命令已通过 6 文件 / 19 测试；`pnpm exec vite build --configLoader native` 成功产出 dist/web（JS 212.43KB / gzip 68.79KB，CSS 22.06KB）；`pnpm exec tsc -p tsconfig.json --noEmit` 全项目退出 0。请 Lead 将范围外 package.json 的 build 脚本加 `--configLoader native`，避开下述默认配置打包的沙箱 EPERM。没有启动服务器联调，也没有读取 .env 或修改协议。

- web 构建：标准 `pnpm exec vite build` 加载根 Vite 配置时触发 `externalize-deps → windowsSafeRealPathSync → child_process.exec → spawn EPERM`，属于已知沙箱子进程管道边界（未提权、未重复相同命令）。web 将尝试 `--configLoader native` 绕过配置打包进程；如成功，请 Lead 考虑构建脚本采用此参数。现已移除依赖修复前的临时 React 测试 singleton/workaround；web 测试 PuzzlePublic mock 类型错误也已修复。

- core：范围内 8 个测试文件目前 40 项通过；`pnpm exec tsc -p tsconfig.json --noEmit` 仅有范围外 `tests/web/pages.test.tsx:36` TS2352（PuzzlePublic mock 缺少字段），core 无类型错误。初始标准 pnpm 测试触发自动依赖复核后 std-env 缺失，已随 Lead 的 hoisted 工具链修复解决；core 未运行 add/install、未改协议或其它源码范围。

- import 验证更新：Lead 改用 Node 原生 TS 后，标准 `pnpm import:puzzles` 已成功（anchor 41、zerotang 30、haiguitang 38、deepturtle 0；合并 2、最终 107、nsfl 29）。deepturtle 是规格允许的可选本地来源，缺文件时正常跳过。全项目 tsc 当前只有其他范围的 core/web 错误，import 源码与测试无类型错误。

- import：标准 `pnpm import:puzzles` 在当前沙箱中因顶层 tsx junction 未解析 esbuild 而失败；物理 tsx 路径又触发 esbuild 子进程 `spawn EPERM`（命名管道边界，不重试/不提权）。Vitest 可通过物理 vitest.mjs 路径运行，导入采用 tsc 编译后纯 Node 执行验证。请 Lead 在可正常解析 junction / 运行 esbuild 的环境复核标准脚本；未运行 pnpm add/install，也未修改脚手架文件。

- web：运行指定 pnpm exec 时 pnpm 自动进行了依赖校验，随后 Vitest 启动失败：`ERR_MODULE_NOT_FOUND: std-env`。加 `--config.verify-deps-before-run=false` 仍失败；请 Lead 修复 scaffold 依赖树（web 不运行 add/install、不改依赖配置）。在依赖恢复前无法验证 TDD 红灯、构建与类型检查。

- pnpm 11 默认拒绝 esbuild 安装脚本，且运行命令会自动检查并重新安装依赖。本范围不包含 pnpm-workspace.yaml 或 .npmrc，请 Lead 配置 pnpm 11 的 `allowBuilds: { esbuild: true }`、`enableGlobalVirtualStore: false`，再执行必要的 rebuild。当前依赖安装已完成，测试临时使用 `--config.verify-deps-before-run=false`；Vitest 使用 threads 避免 Windows 沙箱的 fork 命名管道限制。
- 安装自动生成 pnpm-lock.yaml 与 node_modules，属于任务授权的依赖安装产物；未手工修改范围外源码。

## Lead 工具链修复（重要，所有阶段必读；上方 3 条待协调已解决）

- 原 node_modules 的 junction 指向畸形 `Global\...` 路径 → `ERR_MODULE_NOT_FOUND std-env`。已改 `pnpm-workspace.yaml`（`nodeLinker: hoisted`、`enableGlobalVirtualStore: false`、`verifyDepsBeforeRun: false`）并重装。`& $NODE $PNPM test` 现在可直接运行。
- **esbuild 在沙箱中 spawn EPERM → tsx 不可用**。脚本已改为 Node 24 原生 TS：`node --import ./scripts/register-ts.mjs <file.ts>`（hook 处理 `@shared/*` 别名与无扩展名相对导入）。`pnpm start / import:puzzles / jev:smoke` 已更新。
  - 服务端/脚本代码必须是「可擦除语法」：**禁止 enum、namespace、参数属性（constructor(private x)）**；类型导入用 `import type`（tsconfig 已开 `verbatimModuleSyntax` + `erasableSyntaxOnly` + `allowImportingTsExtensions`）。
- 若 vite build 因 esbuild 失败请在此报告。

## 脚手架说明

- React 与类型包固定为 18 主版本，Node 类型固定为 24，以遵循 SPEC。
- TypeScript 使用 5.9，配合 baseUrl 支持规格指定的 @shared 路径写法；首次安装的 TypeScript 7 已不支持 baseUrl。
- 未读取 .env；仅创建无密钥的模板与初始配置。
- Vitest 配置使用纯对象与类型导入，避免打包配置时运行时导入触发 Windows 沙箱限制。

## 验证结果

- TDD 红灯：先写 smoke 与 TypeScript 配置验收测试；配置缺失时 1 通过、1 失败，失败原因为 tsconfig.json 不存在。
- 最终 `pnpm --config.verify-deps-before-run=false test`：1 个测试文件、2 个测试全部通过。
- 最终 `pnpm --config.verify-deps-before-run=false exec tsc -p tsconfig.json --noEmit`：退出码 0，无类型错误。
- 安装未出现网络失败，仅低速警告；首次开发依赖安装因 pnpm 11 拒绝 esbuild 构建退出 1，使用局部命令参数完成修复。默认 pnpm 命令策略仍需 Lead 协调。

## core 对外接口

```ts
// server/config.ts
loadConfig(env?: NodeJS.ProcessEnv): Config
// Config = {apiKey, judgeConfigured, model, judgeThreshold, solveThreshold, port, dbPath}
// 只在 env===process.env 时调用 dotenv；缺 key 警告但正常返回。

// server/db.ts
openDb(path: string): DatabaseSync
seedIfEmpty(db: DatabaseSync, seedPuzzles: SeedPuzzle[]): void
loadSeedFile(path = 'data/puzzles.json'): SeedPuzzle[] // ENOENT 返回 []

// server/puzzles/repo.ts
new PuzzleRepo(db: DatabaseSync)
repo.list(q?: PuzzleListQuery): PuzzleSummary[]
repo.getPublic(id: string): PuzzlePublic | null
repo.getSecret(id: string): PuzzleSecret | null
repo.random(opts: {excludeNsfl: boolean; excludeIds: string[]}): string | null
repo.rate(puzzleId: string, playerKey: string, score: 1 | 0 | -1, funny: boolean): void
repo.recordGame(g: GameRecord): void
// GameRecord = {id, roomCode, puzzleId, startedAt, endedAt, outcome, winnerName: string|null, log: unknown[]}
// outcome 用中文「破解成功」才增加 solves；同 game id 幂等。
repo.count(): number

// server/jev/judge.ts
interface JudgeService {
 judgeQuestion(p: PuzzleSecret, text: string): Promise<{verdict: Verdict; confidence: number}>;
 judgeSolution(p: PuzzleSecret, text: string): Promise<{outcome: Outcome; confidence: number}>;
 totalCost(): number;
}
createJevJudge(config: Config, db: DatabaseSync, fetchImpl?: typeof fetch): JudgeService
normalize(text: string): string
// server/jev/client.ts
decide(request: DecisionRequest, options?: {fetchImpl?: typeof fetch; sleep?: (ms:number)=>Promise<void>}): Promise<DecisionResult>
// DecisionRequest = {apiKey, model, state: Record<string,unknown>, instructions, criteria: Record<string,string>}
// DecisionResult = {choice:string, confidence:number, cost:number}

// server/util/rateLimit.ts
new RateLimiter({now?:()=>number, minIntervalMs?:number, maxPerMinute?:number}?)
limiter.check(playerKey: string): boolean // 默认 2000ms / 20次，只检查
limiter.commit(playerKey: string): void // beginAsk/beginGuess 成功后提交
limiter.allow(playerKey: string): boolean // 保留原子检查+提交便利接口，Socket 不使用
// server/util/lru.ts
new Lru<K,V>(capacity?: number) // 默认 500
lru.get(key:K): V | undefined
lru.set(key:K, value:V): void

// server/rooms/roomManager.ts：全部方法返回 Result<T>（与 Ack<T> 同构）
new RoomManager({now?:()=>number, random?:()=>number}?)
createRoom(hostName:string, playerKey:string): Result<{code:string}>
join(code:string, name:string, playerKey:string, socketId:string): Result<RoomView>
disconnect(socketId:string): Result<string[]> // 发生状态变化的房间码
leave(code:string, playerKey:string): Result<undefined>
updateSettings(code:string, playerKey:string, partial:Partial<Settings>): Result<undefined>
start(code:string, playerKey:string, puzzleId:string, hintCount?:number): Result<undefined>
beginAsk(code:string, playerKey:string, text:string): Result<QAView>
applyVerdict(code:string, qaId:string, verdict:Verdict, confidence:number): Result<undefined>
beginGuess(code:string, playerKey:string, text:string): Result<GuessView>
applyOutcome(code:string, guessId:string, outcome:Outcome): Result<undefined>
showHint(code:string, playerKey:string, hintCount:number): Result<undefined>
reveal(code:string, playerKey:string): Result<undefined>
setReveal(code:string, reveal:RevealView): Result<undefined>
kick(code:string, hostKey:string, targetKey:string): Result<undefined>
sweep(now?:number): Result<{changed:string[]; destroyed:string[]}>
toPublicView(code:string): Result<RoomView>
getRoom(code:string): Result<RoomState> // 隔离快照，仅服务端使用，不广播
```

- `start` 接收 puzzleId；hintCount 是可选计数元数据，Socket 开局传 repo.getPublic(id).hintCount。题面与提示文本不进入状态机存储。
- `getRoom` 可读取 `puzzleId / playedIds / startedAt / round / winner / revealReason` 给随机选题、揭晓和 recordGame 使用；不可当 RoomView 广播。
- 进入 revealed 只设置 phase、winner（玩家昵称）、revealReason；随后 integrate 查询 getSecret 并 `setReveal`，它使用状态机确定的胜者/原因，公开视图才出现 reveal。
- `showHint` 由调用方传 hintCount；状态机仅递增 hintsShown。Socket 的 publicView 投影仅将 hints.slice(0,hintsShown) 写入公开 hints；重连 ack 与广播使用同一投影。
- 各玩家 pending 同时覆盖提问与猜测；apply* 防重复扣退；请求 id 全实例递增，上一轮晚到的回复不会污染新轮。
- `RoomState` / `RoomOptions` / `Result` 在 roomManager.ts 和 types.ts 均导出。
- `scripts/jev-smoke.ts` 直接执行只在有 key 时触网；`runSmoke(config,db,fetchImpl?,print?)` 供离线测试，三问加一次还原；所有 Jev 测试 mock fetch，无外网调用。

- 房间大厅新增共享契约 `RoomLobbySummary` 与 `GET /api/rooms`：仅返回有在线玩家、未满且尚未揭晓的房间，最多 100 条；公开字段仅为房间码、房主昵称、人数、上限与阶段，不包含玩家身份、题目、提示或汤底。首页“加入游戏”按房间码加入，“房间大厅”可刷新列表并分页加入。
- `PuzzleListQuery.tag` 是可选的完整标签筛选，与难度和重口过滤组合使用。等待开局页的主题采用种子题库现有标签，房主选题后通过既有 `game:start` 传题目 ID；主题选择不修改共享房间设置，也不会公开汤底。
