---
sprint_id: sprint-0
retro_at_local: "2026-04-29 10:35:00 Asia/Shanghai"
retro_at_utc: "2026-04-29T02:35:00Z"
backfilled: true
---

# Sprint sprint-0 · Retrospective

> **事后归档 retro**。原始 sprint 期没有真实 retro ceremony；本文件按 scrum 标准 4 问题格式补完，
> 答案是 **AI 事后梳理 + 用户隐式确认**（W18 standup 中已聊到部分内容）。
> 后续 sprint 的 retro 会有真实用户回答；本文件主要价值是给后续 sprint 留下 velocity baseline 与 lessons 起点。

---

## 1. What Went Well（什么有效）

> 事后梳理。从 PR/issue 的"成功路径"提炼。

- **小步快跑节奏**：12 天 20 PR，每个 PR 单一意图；review 包袱小、回滚成本低
- **issue → PR 的强对应**：几乎每个 PR 都关闭具体 issue，可追溯性好
- **早期就引入测试**：PR #11 起单测覆盖关键路径，到 PR #43 已稳定到 153/153
- **架构契约边走边沉淀**：单一写入者原则（PR #43）不是早期设计的，是被 issue #42 倒逼出来；事后看是良性演进
- **多账号类型逐步引入**：OAuth → Relay → Aggregated 三阶段递进，每阶段独立可用，没有大爆炸式重写
- **AI 协作有效**：Claude Code 主体撰写 + 人类拍板；CLAUDE.md 的"项目知识"逐步累积让 AI 越来越能独立推进

## 2. What Didn't Go Well（什么没生效）

> 事后梳理。从 issue/PR 的"反复修改"轨迹提炼。

- **没有 sprint 框架**：导致今天回填非常痛苦 —— PRD/TRD/decisions 全是反向生成，质量不如 forward 写
- **决策不留痕**：所有 L2 决策（如熔断器错误分类、aggregated 路由策略）都没 decisions.md；只能从 PR 描述/代码反推
- **跨 PR 的关联弱**：例如 #11 和 #18 是同一 Story 的两个 Task，但当时没显式关联，现在归档时才发现
- **没有 standup**：12 天内没有日常状态梳理，"今天要做什么、blocker 是什么"全在脑子里
- **issue #14 / #15 被 #11 顺带修了**：原本是独立 bug，结果在 #11 PR 里悄悄解决；从 PR 描述看不出来，需要看 commit 内容
- **PR #46 / #53 在 sprint 边界跨期**：W18 启动后还在合并 pre-scrum 工作；标志着 scrum 引入时机选得太早或太晚（应在大 epic 收尾后再启动 sprint 1）

## 3. Blockers / Impediments（阻塞与障碍）

> 事后梳理。从 PR 描述识别"被卡住的事"。

- **预扫描器**（QQ Mail / WeChat）：注册流程被外部行为搞坏 → PR #7 解决
- **微信内置浏览器 SVG 不可靠**：品牌图标显示错误 → PR #9 解决
- **WSL2 fs.watch 不可靠**：导致需要 polling fallback（隐式约束，没有专门 PR）
- **`@resvg` 选型受 sudo 限制**：playwright 装不上 libnspr4 → 选 WASM 方案
- **Anthropic 风控不透明**：OAuth 撤销没有官方文档，只能从错误响应反推 → PR #20

## 4. Improvements for Next Sprint（下个 sprint 改进）

> 这一节是给 W18 及之后用的真正 actionable 输出。

- **提 issue 再写代码**：从 W18 起严格走 issue-first（已部分落地）
- **PRD/TRD 在实施前写完**：走 product-requirement-first → technical-requirement-to-issues → issue-first-dev 流程
- **decisions.md 实时落地**：每次"我们换个方案 / 原假设不成立"立刻追加，不要事后补
- **每日 standup**：W18 起强制每日 1 次 standup（已落地）
- **大 epic 收尾后再 commit 新 sprint**：W18 不应在聚合账号 epic 还有 #46 #53 未合并时启动；下次开 sprint 前先确认上一段工作收口
- **小 PR 更小**：1 PR 1 issue 1 用户价值；目前部分 PR（#46 #53）一次合并多 issue，review 难度高
- **velocity 暂不估算**：项目早期速度不稳定；至少跑 2-3 个 sprint 再开始量化
- **多用户共享 Pro 风控议题**（issue #41）和 thinking signature bug（#40）是已识别的技术债，纳入 backlog P2/P1 等待

---

## AI 协作维度（额外，scrum-with-ai 特有）

### HOW 决策方式

Sprint 0 期间无显式 HOW 决策协议。AI 经常独断（直接 implement）。**改进**：W18 起严格走"AI 提案 + 人类拍板"流程（CLAUDE.md 第 3 节铁律）。

事后归档时可识别的关键 HOW 决策（见 decisions.md 列表）：
- permission_error 用 type vs message 匹配（OAuth 撤销）
- 单一写入者用事件 vs 文件锁（PR #43）
- aggregated 路由 4 层固定 vs 规则引擎（PR #46）
- relay 优先级硬编码 vs 可配置（PR #33）
- 周期定义从注册起 30 天 vs 自然月（PR #35）
- 中转页 vs Supabase server-side 改造（PR #7）
- 选 @resvg WASM vs sharp/playwright（PR #9）
- 选 Supabase 作为 JWT 提供方（基础架构）
- role 用 app_metadata vs user_metadata（基础架构）

### 时间记录准确性

无显式时间记录。所有时间戳都是 PR mergedAt（git 自动记录），可信。

### 仪式执行情况

| 仪式 | 是否执行 |
|------|---------|
| Sprint Planning | ❌ 无（项目无 sprint 概念） |
| Daily Standup | ❌ 无 |
| Sprint Review | ❌ 无（事后归档补） |
| Sprint Retro | ❌ 无（事后归档补） |

整个 sprint 0 都没有 scrum 仪式 —— 这是引入 plugin 的根本动机。

---

## Action Items

| Action | Owner | Track In |
|--------|-------|----------|
| W18 起强制每日 standup | 人类（坚持） + AI（守仪式） | 每日 standup-log.md |
| 每个 Story 实施前先写 PRD/TRD | 人类（决策） + AI（撰写） | stories/<slug>/prd.md, trd.md |
| 每次 HOW 决策实时记 decisions.md | 共同 | stories/<slug>/decisions.md |
| 1 PR 1 issue 原则 | 人类（PR 拆分） | PR review checklist |
| W18 末做第一次真实 retro | 人类 + AI | sprints/2026-04-27-W18/retro.md |
| 攒满 3 个 sprint 再尝试 velocity 量化 | 共同 | retro 投入观察 |
| issue #41 / #40 / #54 进 backlog 排期 | 人类（PO） | backlog.md |
