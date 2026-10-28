# 🎨 你画我猜派对 · Draw & Guess Party (`draw.d5v.cc`)

基于 **Express 5 + Socket.IO 4 + Next.js 16 + CandyUI + `perfect-freehand` + OpenRouter JEV 多模态决策引擎 (`typesafe/jev-1.13`)** 构建的多人实时联机「你画我猜」与 10 大社交推理绘画派对游戏。

---

## ✨ 核心特性

1. **🖌️ 专业级压感同步画板 (`perfect-freehand`)**
   - 支持 **Apple Pencil / 数位笔真实压感 (`PointerEvent.pressure`)** 与笔速模拟压感，笔触丝滑自然。
   - 内置 **压感画笔、橡皮擦、油漆桶填充 (Flood Fill)、直线、矩形、圆形、颜色选择器与笔刷粗细调节**。
   - 实时增量同步所有笔触 (`canvas:stroke`)、单步撤销 (`canvas:undo`) 与画板清空 (`canvas:clear`)。

2. **🤖 JEV 多模态视觉鉴画与智能同义词裁判**
   - **JEV 多模态看画 (`recognizeCanvas`)**：直接将 HTML5 Canvas 导出为 `data:image/png;base64,...` 传入 OpenRouter `/api/alpha/decisions` 的多模态 `state` 数组 (`{ type: 'image_url', image_url: { url } }`)，实时评估画作传神度（0–100%）与趣味点评。
   - **零剧透与同义词裁判 (`judgeSolution`)**：精准答案直接短路秒判，近义词/别称由 JEV 智能裁定；对局揭晓前猜中答案自动脱敏广播（`🎉 猜中了机密答案（N个字）`），严守防剧透原则。

3. **📱 全端断线重连与玩家设备实时展示**
   - 自动识别并同步展示房内每位玩家的联机设备类型（如 `macOS · Chrome`、`iPadOS · Safari · 压感笔`、`iOS · 手机`、`Windows · Edge`）。
   - 当玩家使用 Apple Pencil 落笔时，实时升级房间内设备徽章为 **「✏️ 压感笔」**。
   - 支持服务端 SQLite 房间快照持久化与客户端指数退避自动重连。

4. **🎉 5 大核心派对模式 + 5 大传声筒 (Gartic Phone) 变体**
   - **`classic` 经典你画我猜**：画手根据机密词条作画，猜词玩家实时抢答或特征提问，支持 JEV 多模态识图。
   - **`drawful` 妙笔生谎 (Jackbox Drawful)**：画手描绘荒诞长句，全员编造以假乱真的假题目混入真题盲投，每骗到 1 票奖励 **+2 分**。
   - **`doodle-puzzle` 猜拆画画**：4 象限分块合作画同一题，隐藏内鬼「坏坏」暗中破坏，全员边猜词边投票抓内鬼（抓中 **+3 分**）。
   - **`pictomania` 妙笔神猜**：桌面公开 16 个易混淆近似词，全员同步作画与极速抢答，按猜中先后梯度得分（**+3 / +2 / +1 分**）。
   - **`monsdrawsity` 怪兽目击者**：目击者限时 **20 秒**观察猎奇异兽档案并口述外貌特征，全员还原画像并投票评选最佳画师。
   - **`secret-ink` 隐形墨水**：画手落笔 **2 秒后线条自动消隐**，全凭空间记忆盲画，揭晓时刻全部显形。
   - **`knock-off` 高仿山寨**：**60s ➔ 30s ➔ 15s ➔ 8s** 极限递减时间接力临摹上一幅画。
   - **`complement` 残缺补全**：画板开局自带神秘初始残缺线条，脑洞补全为完整主题作品。
   - **`sandwich` 三明治传声筒**：写词 ➔ 多帧看画重画畸变 ➔ 最终猜词。
   - **`animation` 逐帧定格动画**：仅看上一帧 **24% 半透明洋葱皮残影**接力作画，完成后支持 **5fps 循环连播**。

---

## 🚀 本地开发与测试

```bash
# 类型检查
pnpm run typecheck

# 运行全量单元与 e2e 测试（48 个测试套件 / 261 项断言）
pnpm test

# 构建生产前端产物（Vite + Next.js）
pnpm run build && pnpm run build:next

# 启动服务（默认端口 3002）
PORT=3002 pnpm start
```
