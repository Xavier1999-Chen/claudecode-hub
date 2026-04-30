---
type: story
slug: 2026-04-21-OAuth撤销检测
title: "OAuth 撤销检测：账号被 Anthropic 封禁/降级时立即下线"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 09:35:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:35:00Z"
started_at_local: "2026-04-21 19:00:00 Asia/Shanghai"
started_at_utc: "2026-04-21T11:00:00Z"
confirmed_at_local: "2026-04-21 21:02:47 Asia/Shanghai"
confirmed_at_utc: "2026-04-21T13:02:47Z"
completed_at_local: "2026-04-21 21:02:47 Asia/Shanghai"
completed_at_utc: "2026-04-21T13:02:47Z"
epic_ref: account-management
sprint_refs: [sprint-0]
pr_refs: [20]
issue_refs: [19]
notes: "事后归档：scrum 引入前的 PR；PRD/TRD 从 PR #20 + issue #19 + 现网代码反向还原"
---

# PRD · OAuth 撤销检测

## 1. 背景与目标

Anthropic 在用户违反使用条款（多账号共享 Pro / 滥用）或 org 降级到 free 时，会撤销 OAuth 授权。撤销后 API 返回：

```
HTTP 403 + x-should-retry: false
{"type":"error","error":{"type":"permission_error","message":"OAuth authentication is currently not allowed for this organization."}}
```

修前：proxy forwarder 只处理 401/429/529，403 直接透传给客户端；admin syncRateLimit 也忽略 403。所以账号在 UI 上仍显示绿色可用，auto 模式终端继续 pin 在上面，用户每次发请求都直接吃到 403。

**目标**：让 hub 主动识别 OAuth 撤销，立即把账号标记为 exhausted + 把绑在上面的终端迁走，用户感知不到。

## 2. 用户故事

### 2.1 普通用户
**故事**：作为终端用户，我不想因为某个底层账号被 Anthropic 封了就吃到 403 错误，希望 hub 自动绕开。
**验收标准**：
- [x] 账号被撤销后，下一次请求自动 fallback 到其它热账号
- [x] 客户端看到正常 200 响应，不感知底层切换

### 2.2 Admin
**故事**：作为 admin，我希望被封号的账号在面板上立即变红/灰，方便我决定是否重新 OAuth 登录或下线。
**验收标准**：
- [x] 被撤销账号 status 变为 exhausted（红色）
- [x] auto 模式终端自动迁移到其它热账号，UI 显示新绑定

## 3. 功能需求

- **proxy 检测点**：`forwarder.js` 在收到 upstream 403 响应时解析 body，判断 `error.type === 'permission_error'` 即触发
- **状态变更**：调用 `pool.markUnauthorized(accountId)` → 内部设 `status: 'exhausted'`
- **请求自救**：检测到撤销后立即 `selectFallback` 到下一个热账号重试当前请求，客户端无感
- **admin 同步限流路径**：定期 probe 时也要处理 403（之前只处理 200/401/429）
- **持久化**：proxy 检测到撤销 → `/_internal/report-exhausted` → admin 写盘 `accounts.json` 的 status

## 4. Out of Scope

- 重新 OAuth 登录自动化（撤销后需 admin 手动重新登录）
- 区分撤销 vs 临时降级（统一按 exhausted 处理）
- 通知/告警（邮件、webhook 等）

## 5. 边界情况与异常处理

- 非 permission_error 的 403（比如某 model 不允许）继续透传，不当作撤销
- 撤销发生在 SSE 流中途的可能性低（凭证检查是请求开始时），但若发生，按已有 SSE 错误处理透传
- 多用户同时打到同一个被撤销账号：第一个请求触发 markUnauthorized，后续请求直接走 fallback

## 6. 验收标准

- [x] PR #20 merged 2026-04-21T13:02:47Z
- [x] Issue #19 closed
- [x] forwarder 单测覆盖 403 + permission_error 路径
- [x] account-pool 单测覆盖 markUnauthorized 状态变更
