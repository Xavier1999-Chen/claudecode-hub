---
type: story
slug: 2026-04-15-认证基础架构
title: "认证基础架构：Supabase JWT + 三态用户审批模型"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 10:05:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:05:00Z"
started_at_local: "2026-04-15 11:25:16 Asia/Shanghai"
started_at_utc: "2026-04-15T03:25:16Z"
confirmed_at_local: "2026-04-20 11:00:00 Asia/Shanghai"
confirmed_at_utc: "2026-04-20T03:00:00Z"
completed_at_local: "2026-04-20 11:21:03 Asia/Shanghai"
completed_at_utc: "2026-04-20T03:21:03Z"
epic_ref: auth-onboarding
sprint_refs: [sprint-0]
pr_refs: []
issue_refs: []
notes: |
  事后归档：scrum 引入前的初始期工作（仓库首个 commit 至 PR #4 之前的基础设施期）。
  本 Story 没有特定 PR，是项目骨架的一部分。PRD/TRD 从现网 CLAUDE.md "Auth System" 段 + src/admin/auth.js 反向归纳。
---

# PRD · 认证基础架构

## 1. 背景与目标

claudecode-hub 是多用户共享 Anthropic 账号池的服务，admin 面板必须有可信的用户认证 + 审批机制。早期决策：

- 不自己写鉴权（避免重复造轮子 + 安全风险）
- 选 Supabase JWT 作为骨架
- 在 Supabase 之上叠加 hub 自己的审批模型（pending / approved / rejected 三态）

**目标**：把"谁能登录、谁能调 API、谁能管理"通过 Supabase JWT + role 字段稳定地表达，让后续所有 API 都能复用统一的 auth 中间件。

## 2. 用户故事

### 2.1 普通用户
**故事**：作为想用 hub 的用户，我希望能注册账号、收到 admin 审批后开始使用。
**验收标准**：
- [x] 注册成功后处于 pending 状态（role = null）
- [x] 未审批时所有 `/api/*` 请求返回 403 + 友好提示
- [x] 审批通过后立即可用，不需重新登录

### 2.2 Admin
**故事**：作为 admin，我希望能审批新注册用户、把别人提升为 admin、拒绝恶意注册。
**验收标准**：
- [x] 通过 Supabase dashboard 修改 `app_metadata.role` 给用户授权
- [x] role: user / admin / rejected 三态
- [x] 被拒绝用户登录后看到拒绝页（不是普通登录失败）

### 2.3 开发者（隐式角色）
**故事**：作为后端开发者，我希望所有 `/api/*` 路由能用统一的中间件保护。
**验收标准**：
- [x] `requireAuth` 验证 JWT
- [x] `requireApproved` 允许 user / admin
- [x] `requireAdmin` 仅允许 admin
- [x] 三层中间件可堆叠

## 3. 功能需求

- **JWT 验证中间件**：`requireAuth` —— 校验 Authorization Bearer，从 Supabase getUser 拿用户对象，设 `req.user = { id, email, role }`
- **role 来源**：始终从 `app_metadata.role` 读（服务端控制），永不从 `user_metadata`（用户可改）
- **三态语义**：
  - `null`（pending） —— 未审批
  - `user` / `admin` —— 已审批
  - `rejected` —— 拒绝（前端渲染独立页面）
- **三层中间件叠加**：`/api/*` → requireAuth → requireApproved → 业务逻辑；`/api/admin/*` 加 requireAdmin
- **审批流程**：通过 Supabase dashboard SQL 改 `app_metadata.role`（无 in-app 审批 UI，刻意保留 admin 操作门槛）
- **前端注册页 + 登录页 + 拒绝页**：基于 Supabase auth.signUp / signIn API
- **Hub 终端 token 独立**：`sk-hub-*` 由 admin 生成，与 Supabase JWT 解耦（终端用户不需要 Supabase session）

## 4. Out of Scope

- 自助审批 UI（admin 用 SQL 操作）
- OAuth login（Google/GitHub 等社交登录）
- 多租户隔离（hub 是单组织部署）
- 终端 token 的复杂权限（终端只有"能调 proxy"一种权限）

## 5. 边界情况与异常处理

- JWT 过期 → 401 + 触发前端重新登录
- 用户改 user_metadata 想绕过审批 → 我们只读 app_metadata，user_metadata 完全忽略
- Supabase 短时不可用 → 全部 `/api/*` 返回 503，admin 面板降级
- 终端 token 与 Supabase JWT 用法不同 → 前者只验本地 terminals.json，后者验 Supabase

## 6. 验收标准

- [x] 仓库初始化时即有 Supabase auth 集成
- [x] CLAUDE.md "Auth System" 段记录三层中间件
- [x] 注册 → pending → admin SQL 审批 → user 流程手动验证
- [x] role 始终读 app_metadata（grep 确认无 user_metadata.role 用法）
- [x] rejected 用户看到独立页面（前端 RejectedPage）
