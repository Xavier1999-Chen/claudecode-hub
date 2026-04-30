# Tasks · 认证基础架构

> 事后归档。本 Story 是项目骨架的一部分，原始实施跨多个早期 commit，没有专门的 issue/PR 拆分。

## T1 · 接入 Supabase JWT + 三层中间件
- type: Task
- github: 无
- depends_on: []
- status: done
- pr: 无（基础架构期）
- merged_at_utc: 2026-04-20T03:21:03Z

### Goal
建立 hub admin 鉴权骨架，保护所有 `/api/*` 路由。

### Acceptance
- [x] `src/admin/auth.js` 实现 requireAuth / requireApproved / requireAdmin
- [x] role 始终读 `app_metadata.role`
- [x] 前端注册 / 登录 / 拒绝页面齐备
- [x] App.jsx 顶层 auth gate
- [x] 注册 → pending → SQL 审批 → user 流程通过

## T2 · 终端 token 独立鉴权
- type: Task
- github: 无
- depends_on: [T1]
- status: done
- pr: 无（基础架构期）
- merged_at_utc: 2026-04-20T03:21:03Z

### Goal
终端 `sk-hub-*` 由 admin 创建，与 Supabase JWT 解耦，proxy 单独验。

### Acceptance
- [x] proxy 验 Bearer/x-api-key 对应 `config/terminals.json`
- [x] 终端记录含 userId/userEmail（后续 Story 完善多用户隔离）
- [x] 终端 token 与 Supabase session 互不依赖
