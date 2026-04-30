---
type: story
slug: 2026-04-22-中转站fallback账号
title: "中转站 fallback 账号：第三方 relay 作为 OAuth 池兜底层"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 09:40:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:40:00Z"
started_at_local: "2026-04-22 20:00:00 Asia/Shanghai"
started_at_utc: "2026-04-22T12:00:00Z"
confirmed_at_local: "2026-04-23 00:23:50 Asia/Shanghai"
confirmed_at_utc: "2026-04-22T16:23:50Z"
completed_at_local: "2026-04-23 00:23:50 Asia/Shanghai"
completed_at_utc: "2026-04-22T16:23:50Z"
epic_ref: account-management
sprint_refs: [sprint-0]
pr_refs: [33]
issue_refs: [32]
notes: "事后归档：scrum 引入前的 PR；PRD/TRD 从 PR #33 + issue #32 + 现网代码反向还原"
---

# PRD · 中转站 fallback 账号

## 1. 背景与目标

OAuth 账号池在限流高峰或集体冷却时会出现"全员 cooling"窗口，这段时间用户请求只能排队等。引入第三方中转站（relay station）作为兜底层：

- 用静态 API Key + 自定义 Base URL 接入
- OAuth 池可用时优先 OAuth；OAuth 全员冷却或 exhausted 时自动降级到 relay
- 绝不在 OAuth 还有热账号时使用 relay（成本/质量考虑）

**目标**：让 hub 在极端限流场景下保持可用，同时保留 OAuth 优先的成本控制。

## 2. 用户故事

### 2.1 普通用户
**故事**：作为终端用户，我希望即使所有 OAuth 账号都冷却，也能继续发请求。
**验收标准**：
- [x] OAuth 全冷却时请求自动走 relay，不报错
- [x] OAuth 恢复后自动切回 OAuth，不需要手动操作

### 2.2 Admin
**故事**：作为 admin，我希望能像加 OAuth 一样方便地添加中转站，并配置可选的模型名映射（某些中转只接受非 Anthropic 命名）。
**验收标准**：
- [x] 管理面板新增"添加中转"按钮 → RelayModal 表单
- [x] 表单含 baseUrl / apiKey / 三档可选 modelMap（opus/sonnet/haiku）
- [x] 提交后写入 `config/accounts.json`，立即可用

## 3. 功能需求

- **账号类型**：`accounts.json` 单条记录新增 `type: 'relay'`，与 OAuth 账号（无 type 或 undefined）共存
- **凭证字段**：`apiKey`（静态）+ `baseUrl`（自定义，如 `https://relay.example.com/v1`）
- **可选 modelMap**：`{ opus?, sonnet?, haiku? }`，按 `body.model` 前缀匹配改写
- **调度优先级**（auto 模式）：warm OAuth → relay → cooling OAuth（按 resetAt 升序）
- **管理 API**：新增 `POST /api/accounts/relay`（仅 admin），body 含 baseUrl/apiKey/modelMap

## 4. Out of Scope

- 多 relay 之间的负载均衡（按添加顺序选第一个可用）
- relay 的健康主动探测（后续 PR #37 单独做）
- relay 的用量统计粒度（与 OAuth 等价对待，无特殊处理）

## 5. 边界情况与异常处理

- relay 返回 401/403 → 不触发 OAuth 撤销逻辑；relay 不会"封号"，只可能 key 错
- relay 5xx → 走 forwarder 已有重试 + circuit breaker
- modelMap 缺某 tier → 不改写，原 model 透传给 relay（relay 自行判断是否支持）

## 6. 验收标准

- [x] PR #33 merged 2026-04-22T16:23:50Z
- [x] Issue #32 closed
- [x] 16 个 relay 专项测试通过（共 88/88 全绿）
- [x] 手动验证：暂停所有 OAuth → 发请求 → 走 relay
- [x] 手动验证：恢复 OAuth → 调度回 OAuth
- [x] 手动验证：modelMap 改写 body.model 生效
