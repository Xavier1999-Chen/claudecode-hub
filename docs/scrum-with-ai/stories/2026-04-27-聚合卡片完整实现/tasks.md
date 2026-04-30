# Tasks · 聚合卡片完整实现

> 事后归档。本 Story 在 PR #46 中作为大集成 PR 提交，原始拆分见关闭的 4 个 issue。

## T1 · 后端：聚合账号类型 + 路由 API
- type: Task
- github: #45
- depends_on: []
- status: done
- pr: #46
- merged_at_utc: 2026-04-27T13:25:46Z

### Goal
新增 `type: 'aggregated'`，提供创建/路由更新/探测更新 API。

### Acceptance
- [x] `POST /api/accounts/aggregated`（admin only）落盘
- [x] `PATCH /api/accounts/:id/aggregated/routing`
- [x] `PATCH /api/accounts/:id/aggregated/probes`
- [x] sanitiseAccount 暴露 hasApiKey + health 数组

## T2 · Proxy：aggregated 路由 + 图片检测
- type: Task
- github: #44
- depends_on: [T1]
- status: done
- pr: #46
- merged_at_utc: 2026-04-27T13:25:46Z

### Goal
新增 `aggregated-router.js`，按 model tier + image content 选择 provider，并重写 body.model。

### Acceptance
- [x] `resolveAggregatedProvider(account, body)` 处理 4 tier
- [x] `hasImageContent` 递归处理嵌套 tool_result.content
- [x] forwarder 识别 aggregated 类型，apply provider 凭证

## T3 · Proxy：mergeFromDisk 修复
- type: Bug
- github: 无（包含在 PR #46）
- depends_on: [T1]
- status: done
- pr: #46
- merged_at_utc: 2026-04-27T13:25:46Z

### Goal
修复 `mergeFromDisk` 之前只同步 accessToken，导致 admin 改聚合配置后 proxy 仍用旧 routing。

### Acceptance
- [x] mergeFromDisk 同步 routing/modelMap/providers/etc.
- [x] 单测：admin 改路由 → mergeFromDisk → 内存配置更新

## T4 · 前端三步向导 + 卡片渲染
- type: Task
- github: #44
- depends_on: [T1]
- status: done
- pr: #46
- merged_at_utc: 2026-04-27T13:25:46Z

### Goal
`AggregatedModal` 三步向导（基础 / providers / 路由）+ `AggregatedCardBody` 展示。

### Acceptance
- [x] 三步向导可创建聚合卡
- [x] 卡片显示 providers + 路由配置
- [x] 路由/探测可后续编辑（updateAggregatedRouting / updateAggregatedProbes）

## T5 · 中转站强制下线兜底（关联）
- type: Bug
- github: #38
- depends_on: []
- status: done
- pr: #46
- merged_at_utc: 2026-04-27T13:25:46Z

### Goal
中转站账号无法被强制下线 —— 顺带在本 PR 修复。

### Acceptance
- [x] 强制下线 relay 账号生效

## T6 · plan badge 不更新（关联）
- type: Bug
- github: #21
- depends_on: []
- status: done
- pr: #46
- merged_at_utc: 2026-04-27T13:25:46Z

### Goal
account plan badge 在 Anthropic 降级后仍显示 PRO（stale subscriptionType）。

### Acceptance
- [x] subscription 类型变化能正确反映到 UI
