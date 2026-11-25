# 任务卡（按顺序执行，一次只做一张）

通用要求（每张卡都适用）：
- 开始前重新阅读 `SPEC.md` 的相关章节。只做本卡范围内的事，不要顺手重构别的部分。
- 不修改 `/data` 中的字段名和数据内容。
- 完成后：`npm run build` 通过、`npm test` 通过（T1 之后），然后用一段话汇报：做了什么、改了哪些文件、有什么没做完或不确定的地方。
- 遇到与 SPEC 冲突或 SPEC 没写清的地方：停下来问，不要自行发挥。

---

## T0 项目骨架与首次部署

做：
1. Vite + React + TS 初始化；安装 Tailwind、shadcn/ui（按 SPEC §2 的组件列表添加）、lucide-react、zustand、react-router-dom、recharts、vitest。
2. 把 `/data` 放在项目根目录，前端通过 `import` 引入 JSON（`resolveJsonModule`）；`/public/architecture.png` 放好。
3. 按 SPEC §3 配置 Tailwind 主题色、字体、圆角；全局背景 `#F8FAFC`。
4. 做出空布局：侧边栏 + 顶栏 + 5 个路由的占位页面（只写页面标题）。
5. 添加 `vercel.json`：SPA rewrite（除 `/api/*` 外都指向 `index.html`）。
6. 添加 `api/health.ts`，先返回 `{ ok: false }`。
7. 推到 GitHub，在 Vercel 导入并部署。

验收：线上 https 链接能打开，5 个导航都能切换，刷新子页面不 404，`/api/health` 有返回。

---

## T1 核心逻辑层（纯 TS，带单元测试）

做：
1. `src/types.ts`：按 SPEC §9 和 `/data` 结构定义全部类型。
2. `src/core/scoring.ts`：总分计算（SPEC §5.3）。
3. `src/core/stateMachine.ts`：热点初始状态推导与合法流转（SPEC §5.1）、脚本状态流转（SPEC §5.2）。非法流转抛错。
4. `src/core/rules.ts`：R1–R7（SPEC §8）。
5. `src/core/time.ts`：基于 `meta.demoNow` 的相对时间与剩余窗口格式化（如「剩余 18 小时」「2 小时前」）。
6. `src/store.ts`（zustand + persist）：热点状态、脚本版本、评审结果、操作日志；初始化时 h01 为 selected，并载入 `presets.h01.final` 为已定稿；写入若干系统日志（采集 10 条、核验、拦截 h05/h06、过期 h09、h04 待核实）。提供 `resetDemo()`。
7. Vitest 测试：SPEC §8 列出的四个用例 + 初始状态分布（可选题 5、待核实 1、已拦截 2、已过期 1、已选题 1）+ 至少 3 个状态机非法流转用例。

验收：`npm test` 全绿；不涉及任何 UI。

---

## T2 热点工作台页面

做：SPEC §6.1 全部内容。列表数据来自 store，状态与分数来自 T1 的函数。行可点击（先只打开一个空 Sheet）。

视觉要求：这是评阅人第一眼看到的页面，要精致。统计卡数字大、标签小；列表行高充足（≥72px）；分数用大号等宽数字 + 细进度条；sparkline 用主色、无坐标轴。

验收：10 条热点按规则排序；Tabs 筛选正确；1280 宽无横向滚动；截图给我看。

---

## T3 热点详情与选题确认（人工节点①）

做：SPEC §6.2 全部内容。确认选题调用 store 的流转函数，写日志，跳转 `/topics/:hotspotId`。

验收：h04 确认按钮禁用并显示原因；h05、h06 显示拦截原因；h09 显示已过期；h10 可以确认选题并跳转；证据卡片「打开来源」新窗口打开；哈希点击可复制；截图给我看。

---

## T4 服务器函数与模型适配层

做：SPEC §7 全部内容。
- `api/_lib/llm.ts`（三种 provider 的 fetch 实现）、`api/_lib/data.ts`（服务器端读取 /data）、`api/_lib/prompts.ts`（生成、评审、修订三套 prompt）、`api/_lib/ratelimit.ts`。
- prompt 要求输出与 `Script` / `Review` 类型一致的 JSON；在 prompt 里给出一个完整的输出示例（可用 presets 中的 h10.v2 和 v2Review 作为格式示例）。
- 生成 prompt 必须包含：热点简报（`<hot_data>` 内）、证据 id 列表（要求脚本引用）、公开/内部设定卡、平台规范（时长、字数、必带提示、风格）、品牌调性、运营补充方向。
- `api/health.ts` 改为检查环境变量。
- 前端 `src/lib/api.ts` 封装调用与回退逻辑（SPEC §7 末段）。

验收：
1. 本地 `vercel dev` 下，配置 Key 后 `/api/generate` 对 h10 返回合法 Script JSON；`/api/review` 返回合法 Review JSON。
2. 去掉 Key 后，接口返回 `{ fallback: true }`，HTTP 200。
3. 前端打包产物中搜索不到 API Key。

---

## T5 脚本审阅台与终稿确认（人工节点②）

做：SPEC §6.3 全部内容。流水线编排写在 `src/core/pipeline.ts`：

```
generate → rules.check + review(带规则结果) →
  若 规则全部通过 且 review.passed → pending_final
  否则 若 轮次 < maxRevisionRounds → revise(issues + 规则失败项) → 回到检查
  否则 → pending_final（标记未解决问题）
```

回退模式下使用 presets：h10 走 v1 →（v1Review + 规则失败）→ v2 →（v2Review 通过）→ 待终审，修订记录使用 `v2Changes`。其他热点回退时使用 h10 的预置内容但替换 hotspotId（并在版本来源显示「预置」）。

退回修改：填写意见 → 调 revise（humanNote）→ 新版本 → 重新检查。

导出：定稿后导出 Markdown（标题、平台、分镜表、片尾、引用证据及其链接）。

验收：
1. 有 Key：h10 完整走通，步骤条逐步推进，结果真实来自模型。
2. 无 Key：h10 回退走通，v1 显示 R1/R3/R4/R7 失败，v2 全部通过。
3. 退回修改能生成新版本。
4. 每一步都写入操作日志。截图给我看。

---

## T6 知识库、操作日志、方案说明

做：SPEC §6.4、§6.5、§6.6。方案说明页的 Markdown 用 `react-markdown` + `remark-gfm` 渲染，排版做得像产品文档（行宽 ≤ 760px、标题层级清楚、表格好看）。架构图点击用 Dialog 放大。

验收：三页内容完整；未公开设定卡有锁标识；截图给我看。

---

## T7 打磨与最终验收

做：
1. 按 SPEC §10 逐条自查并修复。
2. 全站检查：最小字号、无脚注小字、空状态、加载状态（Skeleton）、错误提示统一用 Sonner。
3. 首屏性能：路由懒加载 Recharts 相关页面。
4. 页面 `<title>` 为「热点脚本工作台 · 云屿食堂」，加一个简洁的 favicon（主色圆角方块）。
5. 部署生产环境，在 Vercel 配置环境变量后重新部署。

验收：SPEC §10 全部通过，汇报清单逐条打勾。
