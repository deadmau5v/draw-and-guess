# AGENTS.md - 海龟汤多人联机游戏项目架构与协同指南

本文档专为接手、维护和迭代本项目的人工智能代理（AI Coding Agents）编写。在执行任何代码阅读、重构、功能扩展或 Bug 修复任务前，**必须首先通读本文档**。

---

## 1. 项目概览与业务定位

本项目是一个灵感源自 [tanghenre.com](https://tanghenre.com/) 的**多人在线海龟汤（情境推理 / Lateral Thinking Puzzle）网页游戏**。

### 核心玩法与游戏机制
1. **多房间联机**：支持玩家创建 6 位字母数字代码的房间（如 `K8P2V2`），多人实时加入。房主可挑选题目或随机抽题，设定游戏规则。
2. **AI 主持人（JEV 裁判）**：
   - 玩家提问：AI 仅依据谜题汤底回答「**是**」、「**不是**」、「**不相关**」或「**不确定**」。
   - 玩家还原猜测：AI 判断玩家的案情还原是否「**破解成功**」、「**接近真相**」、「**还没猜对**」或「**不确定**」。
3. **额度与轮次**：默认每人 8 次提问机会，可切换共享额度；支持轮流提问或自由提问模式。所有玩家额度用尽且无还原猜测时自动揭晓汤底。
4. **开源题库集成**：内置 105+ 道开源题库，自动清洗、去重（Bigram Jaccard 算法）、血腥/重口标记（NSFL Mask）以及合规许可证清单追踪（[NOTICE-puzzles.md](NOTICE-puzzles.md)）。

---

## 2. 关键架构规范与铁律（High Priority）

任何 Agent 在修改或新增代码时，必须无条件遵守以下铁律：

### 2.1 防剧透绝对隔离原则（Zero Bottom Leakage）
* **揭晓前绝对禁止下发汤底**：在游戏处于 `waiting` 或 `playing` 阶段时，任何通过 HTTP (`/api/puzzles`, `/api/puzzles/:id`) 或 WebSocket 广播的公开发送载荷（包括 `RoomView`、`PuzzleSummary`、`PuzzlePublic`）**绝不可包含 `bottom`（汤底）或未公开的 `hints`（补充提示）**。
* 服务端仅在两种情况下读取 `PuzzleSecret`：
  1. 调用 JEV 判题服务构造 Prompt 状态时（内部消费，不出服务端内存）。
  2. 游戏正式进入 `revealed` 阶段后，由 `setReveal` 显式广播 `game:revealed` 事件。
* 编写任何 e2e 测试时，必须包含反向断言：`JSON.stringify(payload).includes(secret.bottom) === false`。

### 2.2 额度预扣与异常退还
* 玩家提问或提交还原时，先扣除配额进入 `pending` 状态；若判题接口超时、出错或判定为非标准结果返回「出错」，**必须立即全额退还提问次数与额度**，并触发 Toast 通知。

### 2.3 房间串行判题队列
* 每个房间在服务端拥有唯一的 Promise 串行队列（`queues.get(code)`）。同一房间内无论多少玩家并发提问，判题任务必须串行入队执行，防止房间状态机竞争和上下文交错。

### 2.4 TypeScript 可擦除语法（Erasable Syntax Only）
* **背景**：Windows 沙箱环境下禁止子进程管道操作（EPERM），导致 `tsx`/`esbuild` 无法运行。项目采用 Node 24 原生 TypeScript 运行时（通过 `scripts/register-ts.mjs` 解析 `@shared/*` 别名）。
* **代码约束**：
  * **严禁使用 TypeScript 语法糖**：禁止使用 `enum`（改用 `const AS_CONST = [...] as const` + 联合类型）、禁止 `namespace`、禁止构造函数参数属性（如 `constructor(private repo: Repo)`）、禁止 `import = require`。
  * **类型导入规范**：导入纯类型必须使用显式 `import type { ... }`（配置了 `verbatimModuleSyntax: true`）。

### 2.5 共享契约唯一真理（Single Source of Truth）
* `shared/protocol.ts` 定义了前后端交互的所有数据类型、事件契约（`ClientToServer` / `ServerToClient`）以及默认常量（`DEFAULT_SETTINGS`, `LIMITS`）。
* 禁止在前端或后端代码中私自复制或修改通信协议接口；任何协议变更必须在 `shared/protocol.ts` 中先定义。

---

## 3. 技术栈与目录结构

### 技术栈
* **Runtime**: Node.js 24 (ESM native, `--import ./scripts/register-ts.mjs`)
* **Package Manager**: pnpm 11 (`nodeLinker: hoisted`, `enableGlobalVirtualStore: false`)
* **Backend**: Express 5, Socket.IO 4, SQLite (`node:sqlite` 内置 `DatabaseSync`), Zod 4
* **Frontend**: React 18, Mantine 7 (`@mantine/core`, `@mantine/hooks`), Vite 8, Socket.IO Client (设计系统：深灰蓝背景 `#0b1423` + 薄荷青强调色 `#5eead4`，极简流畅网页游戏风格)
* **Test**: Vitest 5, `@testing-library/react`, JSDOM

### 核心目录一览
```text
turtle-soup/
├── shared/
│   └── protocol.ts           # 前后端共享协议、数据模型、Socket 事件、常量（核心契约）
├── server/
│   ├── index.ts              # 服务端主入口（加载配置、初始化 DB、启动 HTTP & Socket）
│   ├── app.ts                # App 工厂函数（便于测试注入 Mock 依赖）
│   ├── config.ts             # 环境变量与 Zod 校验（loadConfig）
│   ├── db.ts                 # SQLite 初始化、建表与题库 Seed
│   ├── http/
│   │   └── routes.ts         # REST API 路由 (/api/health, /api/puzzles, /api/rooms)
│   ├── jev/
│   │   ├── client.ts         # OpenRouter /api/alpha/decisions JEV API 客户端（重试+退避）
│   │   └── judge.ts          # 判题服务封装（双级缓存：LRU + judge_cache 表、置信度阈值处理）
│   ├── puzzles/
│   │   └── repo.ts           # 题库数据访问层 PuzzleRepo（list, getPublic, getSecret, rate 等）
│   ├── rooms/
│   │   ├── roomManager.ts    # 纯状态机（房间生命周期、轮次、加入/退出/超时踢人/结算）
│   │   ├── socket.ts         # Socket.IO 事件总线、串行队列、限流与防剧透广播
│   │   └── types.ts          # 房间内部状态数据结构
│   └── util/
│       ├── lru.ts            # 内存 LRU 缓存实现
│       └── rateLimit.ts      # 基于时钟的滑动窗口限流器（按 playerKey）
├── web/
│   ├── src/
│   │   ├── api.ts            # 前端 HTTP 接口封装
│   │   ├── socket.ts         # Socket 客户端（断线自动重连与自动重进房间）
│   │   ├── pages/            # Home（首页/快速开始）、Library（题库大全）、Room（主对局室）
│   │   └── components/       # 卡片、提问流、还原弹窗、房主面板、结果徽章等组件
│   ├── index.html            # SPA 模版
│   └── vite.config.ts        # Vite 配置（含开发反向代理）
├── scripts/
│   ├── register-ts.mjs       # Node 24 原生 TS 运行 Hook（解析 @shared/ 与无后缀导入）
│   ├── jev-smoke.ts          # JEV 判题冒烟测试脚本
│   └── import/               # 题库导入工程（爬取、解析、归一化、去重、生成 NOTICE）
├── data/
│   ├── puzzles.json          # 清洗并去重后的标准种子题库
│   └── sources/              # 各上游开源项目的离线快照
├── tests/
│   ├── smoke.test.ts         # 基础健康测试
│   ├── import/               # 题库导入与去重测试（9 个测试套件）
│   ├── server/               # 服务端逻辑测试（config, db, repo, jev, roomManager 等）
│   └── e2e/                  # 真实联机流程与无剧透泄漏测试
├── SPEC.md                   # 详细需求与架构技术规格书（权威文档）
├── NOTICE-puzzles.md         # 逐题开源出处与许可证合规清单
├── .env.example              # 环境变量模板
└── pnpm-workspace.yaml       # pnpm 11 构建与虚拟存储策略配置
```

---

## 4. 运行与开发常用命令

必须在 PowerShell 中使用预置的 Node/pnpm 运行时：

```powershell
$NODE = "C:\Users\d5v\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
$PNPM = "C:\Users\d5v\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs"
$env:PATH = "$(Split-Path $NODE);$env:PATH"
```

| 任务 | 命令 | 说明 |
|---|---|---|
| **运行全量测试** | `& $NODE $PNPM test` | 包含单元测试、状态机测试与 e2e 测试（110+ Tests） |
| **类型检查** | `& $NODE $PNPM typecheck` | 执行 `tsc -p tsconfig.json --noEmit`，验证类型与擦除语法 |
| **前端打包** | `& $NODE $PNPM build` | 执行 Vite 构建（输出至 `dist/web`）并检查类型 |
| **启动生产服务** | `& $NODE $PNPM start` | 启动后端服务并静态托管 `dist/web`，监听端口 3001 |
| **启动开发模式** | `& $NODE $PNPM dev` | 前端 Vite (5173) + 后端 Node watch (3001) 并行开发 |
| **题库重新导入** | `& $NODE $PNPM import:puzzles` | 抓取/解析源题库，生成 `data/puzzles.json` 与 NOTICE |
| **JEV 判题测试** | `& $NODE $PNPM jev:smoke` | 验证 OpenRouter `typesafe/jev-1.13` 联通性与判定准确度 |

---

## 5. 关键模块实现与设计模式

### 5.1 JEV 判定引擎设计 (`server/jev/`)
* **Endpoint**: `POST https://openrouter.ai/api/alpha/decisions`
* **Model**: `typesafe/jev-1.13`
* **判定请求结构**:
  ```json
  {
    "model": "typesafe/jev-1.13",
    "state": {
      "汤面": "...",
      "汤底": "...",
      "补充事实": ["..."],
      "玩家提问": "..."
    },
    "instructions": "你是海龟汤主持人。仅依据汤底判断玩家提问的真假，只能选 是、不是、不相关。",
    "questions": {
      "verdict": {
        "type": "choice",
        "instructions": "...",
        "criteria": {
          "是": "汤底明确或可合理推出该提问为真。",
          "不是": "汤底明确或可合理推出该提问为假。",
          "不相关": "该提问与汤底中的人物、事件、因果无实质关系..."
        }
      }
    }
  }
  ```
* **阈值与降级**:
  * 提问判定：`confidence < 0.4` $\rightarrow$ 降级为 `'不确定'`。
  * 还原判定：`confidence < 0.4` $\rightarrow$ `'不确定'`；若模型返回 `'破解成功'` 但 `confidence < 0.55` $\rightarrow$ 降级为 `'接近真相'`。
* **重试机制**: 对 429、5xx 自动执行 2 次重试（退避间隔 300ms, 900ms）；400/401/403 立即抛出。

### 5.2 房间纯状态机 (`server/rooms/roomManager.ts`)
* `RoomManager` 采用纯内存不可变状态转换模式（所有方法返回 `Result<T>` 即 `{ ok: true, value } | { ok: false, code, msg }`）。
* **清理机制**：支持房主 60 秒无心跳自动移交房主权限；全员离线 10 分钟自动注销房间回收内存。
* **隔离汤底**：`RoomManager` 的状态流转方法在揭晓前**只记录游戏阶段与胜者**，不持有汤底实体，直至调用 `setReveal` 写入。

---

## 6. Agent 维护与排错清单（Troubleshooting）

1. **修改代码后测试报错 `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled`**：
   - 检查是否写了 `enum Foo {}`、`class A { constructor(public x: number) {} }` 或 `namespace Bar {}`。
   - 解决方法：改用普通对象常量联合类型，在构造函数体中显式赋值。
2. **测试或运行时提示 `ERR_MODULE_NOT_FOUND`**：
   - 检查相对路径导入是否使用了正确的相对路径，或是否依赖了无后缀/缺失扩展名文件。`scripts/register-ts.mjs` 支持解析 `.ts` / `.tsx` / `index.ts`，但在 `typecheck` 阶段也需满足 TS 解析规则。
3. **OpenRouter 判题返回 `出错`**：
   - 检查 `.env` 中的 `OPENROUTER_API_KEY` 是否有效。
   - 调用 `& $NODE $PNPM jev:smoke` 查看是否有余额不足（402）、鉴权失败（401）或网络阻断。
4. **端口占用排查**：
   - 服务默认监听 `3001`。若启动报错 `EADDRINUSE`，在 PowerShell 中排查并释放端口：
     ```powershell
     Get-Process -Id (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue).OwningProcess | Stop-Process -Force
     ```

---

*本文档由 Team Lead Agent 编写，基于规范 [SPEC.md](SPEC.md) 与实测运行成果生成，作为后续迭代的最高业务与工程上下文。*

## UI 按钮规范
- 全站按钮只能使用 [web/src/ui.tsx](web/src/ui.tsx) 的 GameButton（tone: blue/green/yellow/red/grey/ghost），禁止直接使用 Mantine Button 或自写按钮样式。
- 按钮皮肤来自 Kenney UI Pack 2.0（CC0，素材位于 web/public/kenney/，授权见同目录 License.txt）。
