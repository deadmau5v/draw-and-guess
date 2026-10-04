# 海龟汤多人联机版：实现规格（实现方必须遵守）

完整背景见 `../.hermes/plans/2026-10-04_234941-turtle-soup-multiplayer.md`。若本文件与那份方案冲突，**以本文件为准**。共享协议定义在 `shared/protocol.ts`，那是前后端的唯一契约，**不得擅自修改**；确需修改时，在 `NOTES.md` 中写明原因。

## 0. 已定决策
- 提问额度：默认每人 8 问。房主可在大厅修改为「全房共享 N 问」或「无限」。
- 题库：4 个来源全部收录，仅供本地或私用；在 `NOTICE-puzzles.md` 中逐题标注来源和许可证。
- 技术栈：Node 24 + TypeScript (ESM) + Express + Socket.IO + `node:sqlite` + React 18 + Vite + Vitest。
- 第一版不做：投稿（/lab）、英文题库、账号系统。

## 1. 运行环境（Windows，PATH 中没有 node）
```powershell
$NODE = "C:\Users\d5v\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
$PNPM = "C:\Users\d5v\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs"
& $NODE $PNPM install
& $NODE $PNPM test
```
- `package.json` 中的 scripts 会调用 `tsx`、`vite`、`vitest`。pnpm 会把 node_modules/.bin 加入 PATH，但这些 bin 内部还会调用 `node`。如果报「找不到 node」，就在当前命令里先执行 `$env:PATH = "$(Split-Path $NODE);$env:PATH"`。
- 网络：`raw.githubusercontent.com` 和 `huggingface.co` 在本机不可达，用 `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/<path>` 代替。
- 所有代码都放在 `turtle-soup/` 目录下。工作区的其他文件不要动。

## 2. 目录与归属（并行开发时只写自己负责的目录）
| 范围 | 负责阶段 |
|---|---|
| `package.json` `tsconfig*.json` `vite.config.ts` `vitest.config.ts` `.gitignore` `.env.example` `README.md` | scaffold |
| `scripts/import/**` `data/**` `NOTICE-puzzles.md` `tests/import/**` | import |
| `server/config.ts` `server/db.ts` `server/puzzles/**` `server/jev/**` `server/rooms/roomManager.ts` `server/util/**` `scripts/jev-smoke.ts` `tests/server/**` | core |
| `web/**` | web |
| `server/http/**` `server/rooms/socket.ts` `server/index.ts` `tests/e2e/**` | integrate |
| `shared/protocol.ts` | 只读（Lead 维护） |

## 3. 题库导入（import）
- 输出：`data/puzzles.json`，类型为 `SeedPuzzle[]`（见 protocol.ts）。
- 来源：

| key | URL | 解析方式 | license |
|---|---|---|---|
| `anchor` | `https://cdn.jsdelivr.net/gh/anchorAnc/astrbot_plugin_TurtleSoup@master/questions_database.txt` | 按 `\n---\n` 切块；逐行匹配 `^(ID\|标题\|汤面\|汤底\|难度\|标签):\s*(.*)$`；不带键名的行接到上一个字段后面；以 `#` 开头的是注释，跳过 | AGPL-3.0 |
| `zerotang` | `https://cdn.jsdelivr.net/gh/ZeroTang05/Situation-Puzzle@main/data/library.json` | JSON 字段 `{id,title,story,answer,hints[]}` | GPL-3.0 |
| `haiguitang` | `https://cdn.jsdelivr.net/gh/nbdhhzh/haiguitang@master/haiguitang.db` | 下载到 `data/sources/haiguitang.db`，用 `node:sqlite` 打开。先 `PRAGMA table_info` 探测列名（汤面候选 `content/surface/question/story/description`，汤底候选 `answer/bottom/truth/solution`，标题候选 `title/name`） | MIT |
| `deepturtle` | 本地 `data/sources/deepturtle.jsonl` 或 `.json`（字段 `id,title,surface,truth`），可选 | 文件不存在时打印警告并跳过；按 title+surface 去重 | MIT |

- 每个来源下载成功后都把原始内容存到 `data/sources/`。下载失败时用已有快照；连快照也没有，就跳过并打印警告。**导入过程不得因为单个来源失败而整体失败。**
- 归一化：
  - trim，并去掉全角空格；
  - 标签按 `[,，、]` 拆分；
  - `difficulty` 取 1–5 的整数，否则为 null；
  - `nsfl`：标签或汤底命中 `/恐怖|食人|吃人|谋杀|血腥|尸体|分尸|肢解|人肉|自杀/` 即为 true；
  - 标题为空时取汤面前 8 个字。
- id 格式：`${key}-${原id或序号}`，只允许 `[a-z0-9-]` 这些字符；中文等其他字符用序号替代。
- 去重：
  - 文本规范化：去掉所有标点和空白，转小写；
  - 判重条件：汤面的字符 bigram Jaccard ≥ 0.6，**或**标题规范化后相同且汤底 Jaccard ≥ 0.5；
  - 保留哪一条，依次比较：有 hints 优先 → 许可证宽松度 MIT > GPL-3.0 > AGPL-3.0 → 汤底更长；
  - 被合并掉的来源记到 `alsoIn: string[]`。
- 必须通过的测试：
  - 「酒吧的枪」(anchor) 与「酒保的枪」(zerotang) 合并，保留 zerotang 版本；
  - 「半根火柴」两个版本合并；
  - 「一巴掌」和「酒吧的枪」不合并。
- 还要生成 `NOTICE-puzzles.md`：按来源分组列出 标题｜id｜仓库 URL｜许可证，并加一段声明：「题目版权归原作者；程序许可证不等于故事授权；仅供学习与私用」。
- 命令：`pnpm import:puzzles`。结束时打印统计：每个来源的条数、合并数、最终题数、nsfl 题数。

## 4. Jev 判题（core）
- 接口：`POST https://openrouter.ai/api/alpha/decisions`
- 请求头：`Authorization: Bearer ${OPENROUTER_API_KEY}`、`Content-Type: application/json`、`HTTP-Referer: http://localhost`、`X-Title: Turtle Soup`
- 请求体：`{ model: JUDGE_MODEL, state: {...}, questions: { verdict: { type: 'choice', instructions, criteria } } }`
- 响应：`{ answers: { verdict: { choice, probabilities: {选项: 概率} } }, usage: { cost? } }`。实现上要容忍 `probabilities` 缺失，此时 confidence 取 `answers.verdict.confidence ?? 0`。
- 校验：choice 必须是 criteria 的某个 key，confidence ∈ [0,1]，否则抛错。
- 重试：遇到 429、5xx 或网络错误时重试 2 次，间隔 300ms、900ms（测试中可注入 sleep）；401/400/403 直接抛错。
- `judgeQuestion(puzzle, question)`：
  - state：`{汤面, 汤底, 补充事实: hints, 玩家提问}`
  - instructions：「你是海龟汤主持人。仅依据汤底判断玩家提问的真假，只能选 是、不是、不相关。」
  - criteria：
    - 是：「汤底明确或可合理推出该提问为真。」
    - 不是：「汤底明确或可合理推出该提问为假。」
    - 不相关：「该提问与汤底中的人物、事件、因果无实质关系，或汤底无法判断且不影响推理。」
  - confidence < `JUDGE_THRESHOLD`（默认 0.4）时，返回 verdict `'不确定'`。
- `judgeSolution(puzzle, text)`：
  - criteria：
    - 破解成功：「覆盖了汤底的核心事件、关键原因与因果链（不要求逐字一致）」
    - 接近真相：「抓住主要方向，但遗漏一个关键原因或因果环节」
    - 还没猜对：「与汤底核心事实不一致或过于笼统」
  - 「破解成功」要求 confidence ≥ `SOLVE_THRESHOLD`（默认 0.55），否则降级为「接近真相」；整体 confidence < `JUDGE_THRESHOLD` 时返回 `'不确定'`。
- 缓存：key 为 `(puzzleId, kind, normalize(text))`，先查进程内 LRU（500 条），再查 SQLite 的 `judge_cache` 表。`normalize` 的规则：去掉首尾空白和末尾的 `？?。.!！`，内部空白折叠，转小写。只有 confidence ≥ 阈值的结果才写缓存。
- 记账：累加 `usage.cost` 到内存计数器，由 `/api/health` 暴露。
- `scripts/jev-smoke.ts`：用 zerotang 的「酒保的枪」（找不到就用硬编码文本）测 3 个提问加 1 次还原，打印结果；没有 key 时打印提示并 exit 0。

## 5. 数据库（core）
用 `node:sqlite` 的 `DatabaseSync`，路径取自 `DB_PATH`，测试中用 `:memory:`。表结构如下：
```sql
CREATE TABLE IF NOT EXISTS puzzles(id TEXT PRIMARY KEY, title TEXT NOT NULL, surface TEXT NOT NULL, bottom TEXT NOT NULL,
  hints TEXT NOT NULL DEFAULT '[]', difficulty INTEGER, tags TEXT NOT NULL DEFAULT '[]', nsfl INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL, also_in TEXT NOT NULL DEFAULT '[]', plays INTEGER NOT NULL DEFAULT 0, solves INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ratings(puzzle_id TEXT NOT NULL, player_key TEXT NOT NULL, score INTEGER NOT NULL CHECK(score IN (1,0,-1)),
  funny INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY(puzzle_id, player_key));
CREATE TABLE IF NOT EXISTS judge_cache(puzzle_id TEXT NOT NULL, kind TEXT NOT NULL, norm_text TEXT NOT NULL, choice TEXT NOT NULL,
  confidence REAL NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(puzzle_id, kind, norm_text));
CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY, room_code TEXT NOT NULL, puzzle_id TEXT NOT NULL, started_at INTEGER NOT NULL,
  ended_at INTEGER, outcome TEXT, winner_name TEXT, log TEXT NOT NULL DEFAULT '[]');
```
- 启动时如果 puzzles 表为空，就从 `data/puzzles.json` 灌入。
- `PuzzleRepo` 提供以下方法：
  - `list(q: PuzzleListQuery): PuzzleSummary[]`
  - `getPublic(id): PuzzlePublic | null`
  - `getSecret(id): PuzzleSecret | null`
  - `random(opts: {excludeNsfl:boolean; excludeIds:string[]}): string | null`
  - `rate(puzzleId, playerKey, score, funny)`：upsert
  - `recordGame(...)`
  - `count()`
- 评分统计：
  - `goodRate = (好评数 − 差评数) / 总数 → 映射到 0..1`，即 `(good - bad) / total * 0.5 + 0.5`；没有评价时为 null；
  - 分档：`tier = goodRate==null ? 'none' : ≥0.7 'high' : ≥0.4 'mid' : 'low'`；
  - `sort=good|mid|low` 表示只筛选对应档位并按 goodRate 降序；`new` 按 created_at 降序；`hot` 按 plays 降序。
- **铁律**：`list` 和 `getPublic` 返回的对象里**不能有** `bottom` 和 `hints` 字段（测试中用 `not.toHaveProperty` 断言）。

## 6. 房间状态机（core：`server/rooms/roomManager.ts`）
- 纯逻辑实现，不做 IO，可注入时钟和随机数。对外导出 `class RoomManager`，每个方法返回 `Result<T> = {ok:true, value:T} | {ok:false, code: ErrorCode, msg: string}`。
- 方法清单：
  - `createRoom(hostName, playerKey) → {code}`
  - `join(code, name, playerKey, socketId)`：已在房内的 playerKey 视为重连，恢复身份和计数
  - `disconnect(socketId)`、`leave(code, playerKey)`
  - `updateSettings(code, playerKey, partial)`：仅房主、仅 lobby 阶段可用
  - `start(code, playerKey, puzzleId)`：仅房主；可以从 lobby 或 revealed 阶段开始；会重置计数和日志，并把题目加入 `playedIds`
  - `beginAsk(code, playerKey, text) → QA`：校验阶段、额度、轮次、在途请求、长度（1–120 字），预扣额度，返回 verdict 为「判定中」的 QA
  - `applyVerdict(code, qaId, verdict, confidence)`：verdict 为「不确定」或「出错」时退还额度；在 turns 模式下推进轮次
  - `beginGuess(code, playerKey, text) → Guess`：长度 1–400 字，并检查 `maxGuesses`
  - `applyOutcome(code, guessId, outcome)`：outcome 为「破解成功」时进入 revealed 阶段，设置 winner，`revealReason='solved'`；「不确定」或「出错」时退还猜测次数
  - `showHint(code, playerKey)`：仅房主，hintsShown+1，不超过题目的 hints 数量（由调用方传入 hintCount）
  - `reveal(code, playerKey)`：仅房主，`revealReason='host'`
  - `kick(code, hostKey, targetKey)`
  - `sweep(now)`：房主离线超过 60 秒时，转给最早加入的在线玩家；房间内全员离线超过 10 分钟时，销毁房间
  - `toPublicView(code) → RoomView`
- 自动揭晓：所有在线玩家的额度和猜测次数都用完，且没有在途请求时，自动揭晓，`revealReason='exhausted'`。shared 模式下，额度用尽并且所有人的猜测次数也用尽，才自动揭晓。
- 房间码：6 位，字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`，不能与现有房间重复。
- 同名玩家：加入时自动加后缀，如 `名字(2)`。房间最多 8 人。
- turns 模式：`turnKey` 指向当前轮到的玩家；在线顺序以加入顺序为准；当前玩家离线时跳到下一位。
- 必测项（每条至少一个测试）：
  1. 房间码格式；
  2. 第 9 人加入被拒；
  3. 非房主不能 start；
  4. perPlayer 模式下，第 9 问被拒，其他人仍可问；
  5. 「不确定」退还额度；
  6. turns 模式下，非当前玩家被拒，提问后轮次推进；
  7. 破解成功后进入 revealed；
  8. 资源耗尽后自动揭晓；
  9. 房主离线 60 秒后移交；
  10. 全员离线 10 分钟后销毁；
  11. 有在途请求时不能再问；
  12. **非 revealed 阶段，`JSON.stringify(toPublicView())` 不含汤底**（RoomManager 本身不保存汤底，只保存 puzzleId，汤底由 socket 层在揭晓时查询）；
  13. shared 模式下额度共享。

## 7. HTTP 与 Socket（integrate）
- HTTP 接口：
  - `GET /api/health → {ok, puzzles, model, cost}`
  - `GET /api/puzzles?sort=&q=&nsfl=0|1&limit=&offset= → PuzzleSummary[]`
  - `GET /api/puzzles/:id → PuzzlePublic | 404`
  - `POST /api/rooms {name, playerKey} → {code}`
- 生产环境：Express 静态托管 `dist/web`，前端 SPA 路由回退到 index.html。
- Socket 事件：名称和载荷见 `shared/protocol.ts` 中的 `ClientToServer` 和 `ServerToClient`。所有带回调（ack）的事件统一返回 `Ack<T>`。
- 提问流程：
  1. `beginAsk` 成功后，广播 `room:state`；
  2. 把判题任务放进该房间的串行 Promise 队列；
  3. 调用 `judgeQuestion`；
  4. `applyVerdict`；
  5. 广播 `room:state`；
  6. 如果因此进入了 revealed 阶段，再广播 `game:revealed`。
  - 判题抛错时，verdict 记为 `'出错'` 并退还额度。
- 揭晓：只有在 phase 变成 revealed 时，才查询 `getSecret`，并通过 `game:revealed` 发送 `{bottom, hints, winnerName, reason}`。之后的 `room:state` 也会带上 `reveal` 字段。
- 提示：`hint:show` 由房主触发，服务端把 `hints.slice(0, hintsShown)` 写进 RoomView 的 `hints` 字段。这是揭晓前唯一允许下发的汤底相关内容。
- 结束后写入 games 表、plays+1，破解成功时 solves+1。
- 限流（每个 playerKey）：提问间隔至少 2 秒，每分钟最多 20 次判题请求；超限返回 `RATE_LIMITED`。
- `JudgeService` 用接口注入，e2e 测试中替换成假实现。
- e2e 测试用例：
  - 两个 socket.io-client 加入同一房间 → 房主开局 → B 提问 → 两边都收到 verdict → A 猜测（假实现返回破解成功）→ 两边都收到 `game:revealed`；
  - 在 `game:revealed` 之前，所有收到的载荷里都不含汤底字符串；
  - 断线后重连能恢复身份。

## 8. 前端（web）
- Vite 根目录为 `web/`，开发时 `/api` 和 `/socket.io`（含 ws）代理到 `http://localhost:3001`，构建输出到 `dist/web`。
- 不用 UI 库，手写 CSS。深色主题，强调色为汤色（暖橙 `#e8a23a`）。移动端适配：宽度 < 900px 时三栏改为纵向排列。
- 路由（简单 hash 路由即可）：
  - `#/`：首页。昵称输入（存 localStorage）、创建房间、输入房间码加入、单人随机一碗（建房后自动随机开局）、跳转题库。另外，`?room=CODE` 或 `#/room/CODE` 可直接进房。
  - `#/library`：题库页。排序 tab（高 / 中 / 低好评、最热、最新）、搜索框、「排除重口」开关（默认开启）。卡片展示标题、汤面前 60 字、难度星级、标签、好评率百分比、😂 数和重口角标。卡片上的「用这题开房」会建房并在进房后用该题开局。
  - `#/room/CODE`：房间页。
    - 左栏：汤面卡（重口题先显示遮罩，点「我已了解，继续」后才展开）、已公开的提示、提问框（显示剩余额度，turns 模式下显示轮到谁）、「还原真相」按钮（打开弹窗）。
    - 中栏：问答流。每条显示名字、问题和彩色结果标签（是=绿、不是=红、不相关=灰、不确定=黄、判定中=转圈、出错=暗红）；猜测也穿插显示在流里。
    - 右栏：房间码和复制邀请链接、玩家列表（在线点、已用额度、房主皇冠、房主可踢人）、房主控制（大厅设置、选题：随机或输入 id 或从题库跳转、提示、揭晓、再来一碗）。
    - 揭晓面板：汤底、胜者或揭晓原因、评价（👍 / 😐 / 👎 + 😂），评价通过 socket 的 `rate` 事件提交。
- playerKey：首次访问时用 `crypto.randomUUID()` 生成，存在 localStorage。
- 交互细节：Enter 提交，Shift+Enter 换行；输入框做字数限制；错误用 toast 提示；断线时显示「重连中」横幅。
- 前端只能从 `shared/protocol.ts` 引入类型（Vite 中配置 alias `@shared` 指向 `../shared`）。

## 9. 配置（`.env`）
```
OPENROUTER_API_KEY=
JUDGE_MODEL=typesafe/jev-1.13
JUDGE_THRESHOLD=0.4
SOLVE_THRESHOLD=0.55
PORT=3001
DB_PATH=./turtle.db
```
- 缺少 key 时服务仍可启动，但判题会返回「出错」，同时打印醒目警告。这样不影响本地开发和 e2e 测试。
- **严禁**把任何真实 key 写进源码、测试或 README。

## 10. 完成定义
- `& $NODE $PNPM test` 全部通过；`& $NODE $PNPM build` 通过，包含 `tsc --noEmit`。
- `& $NODE $PNPM import:puzzles` 产出至少 60 题。
- `& $NODE $PNPM start` 启动后，`/api/health` 返回 ok，且 puzzles > 0。
