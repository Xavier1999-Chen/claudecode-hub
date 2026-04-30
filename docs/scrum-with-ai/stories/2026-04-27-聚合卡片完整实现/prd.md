---
type: story
slug: 2026-04-27-聚合卡片完整实现
title: "聚合卡片完整实现：多上游 provider 智能路由"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 09:50:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:50:00Z"
started_at_local: "2026-04-26 22:00:00 Asia/Shanghai"
started_at_utc: "2026-04-26T14:00:00Z"
confirmed_at_local: "2026-04-27 21:25:46 Asia/Shanghai"
confirmed_at_utc: "2026-04-27T13:25:46Z"
completed_at_local: "2026-04-27 21:25:46 Asia/Shanghai"
completed_at_utc: "2026-04-27T13:25:46Z"
epic_ref: account-management
sprint_refs: [sprint-0]
pr_refs: [46]
issue_refs: [45, 44, 38, 21]
notes: |
  事后归档：scrum 引入前的 PR（W18 transition 期合并）。聚合卡片是后续虚拟 MAX 计量（PR #53）的前置 Story。
  关闭的 issue：
  - #45 聚合卡片后端（路由 + 接入）
  - #44 聚合路由卡 — 多供应商智能路由
  - #38 中转站账号无法被强制下线（关联问题，本 PR 顺带修）
  - #21 account plan badge stays PRO after Anthropic downgrade（关联问题）
---

# PRD · 聚合卡片完整实现

## 1. 背景与目标

中转站（relay，PR #33）解决了"OAuth 全冷却时的兜底"，但每个 relay 是单一上游、单一 model。实际中第三方 relay 市场上：

- DeepSeek 擅长便宜的 sonnet 替代
- GLM 擅长 haiku 替代
- Kimi 在长上下文场景表现好
- 部分 relay 同时也跑 image 模型

如果给每个供应商都加一张独立 relay 卡片，admin 面板和路由会很碎。**聚合卡片**让 admin 可以把多个上游"绑成一张卡"，配置 4 层路由（opus/sonnet/haiku/image），按请求模型 tier 自动选 provider。

**目标**：让 admin 用一张卡片管理多个第三方 provider，让 proxy 按模型 tier 智能路由到对应 provider。

## 2. 用户故事

### 2.1 Admin
**故事**：作为 admin，我希望能新增一种"聚合卡片"，背后挂 N 个第三方 provider，并显式配置每个 tier（opus/sonnet/haiku/image）走哪个 provider 的哪个模型。
**验收标准**：
- [x] 管理面板"添加聚合"按钮 → 三步向导
- [x] 步骤 1：基础信息（卡名）
- [x] 步骤 2：添加多个 provider（每个含 baseUrl/apiKey/可选 probeModel）
- [x] 步骤 3：配置 4 层路由（每层选 providerIndex + 目标 model）
- [x] 提交后聚合卡作为单一账号进入调度池

### 2.2 普通用户
**故事**：作为终端用户，我发请求时希望 hub 自动选择合适的上游 —— 比如发图片请求自动走支持图片的 provider。
**验收标准**：
- [x] 发 opus 请求 → 路由到聚合卡的 opus tier provider
- [x] 发含图请求 → 路由到 image tier provider（即使原 model 是 sonnet）
- [x] 上游回包正常透传，目标 model 名被自动重写为 provider 接受的形式

## 3. 功能需求

- **账号类型**：`accounts.json` 新增 `type: 'aggregated'`
- **结构**：`providers: [{ name, baseUrl, apiKey, probeModel? }]` + `routing: { opus?, sonnet?, haiku?, image? }`，每层 `{ providerIndex, model }`
- **图片检测**：`hasImageContent(messages)` 递归扫描，包含 `tool_result.content` 嵌套（Claude Code 实际格式）
- **tier 解析**：`resolveAggregatedProvider(account, body)` 优先 image 路由 > 然后按 model 前缀匹配 opus/sonnet/haiku
- **model 重写**：选定 provider 后，把 `body.model` 替换成 `routing[tier].model`
- **mergeFromDisk 修复**：`account-pool.js` 之前只同步 `accessToken`，现需同步 `routing` / `modelMap` / `providers` 等所有 admin 修改的配置
- **前端三步向导**：`AggregatedModal` + `AggregatedCardBody` + 路由/探测编辑器
- **前端 API**：`updateAggregatedRouting` / `updateAggregatedProbes`

## 4. Out of Scope

- provider 之间的负载均衡（每 tier 一个固定 provider，不轮询）
- provider 失败时的 cross-provider 自动 fallback（依赖外部 retry 或换卡）
- 聚合卡的虚拟用量伪装（PR #53 单独做）

## 5. 边界情况与异常处理

- routing 某 tier 未配置 → 返回 400 提示 admin 补全
- providerIndex 越界 → 配置时前端校验拒绝；运行时 hard fail（不该出现）
- 嵌套图片：`tool_result.content` 也可能是 `[{type: 'image', ...}]`，递归扫描
- mergeFromDisk 之前只同步 token，导致 admin 改路由后 proxy 仍用旧路由 → 现在同步全字段

## 6. 验收标准

- [x] PR #46 merged 2026-04-27T13:25:46Z
- [x] Issue #45 / #44 / #38 / #21 全部 closed
- [x] 单测：`hasImageContent` 覆盖嵌套 tool_result.content
- [x] 单测：`resolveAggregatedProvider` 各 tier 命中
- [x] 单测：`mergeFromDisk` 同步 routing/modelMap/providers
- [x] 手动：admin 创建聚合卡 → 发不同 tier 请求 → 路由正确
