---
type: trd
slug: 2026-04-15-认证基础架构
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 10:05:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:05:00Z"
---

# TRD · 认证基础架构

## 1. 概述

把 Supabase JWT 作为 hub admin 面板鉴权的根。在其上叠加三态用户模型（pending/user|admin/rejected），通过 `app_metadata.role` 服务端字段控制权限。三层中间件（`requireAuth` / `requireApproved` / `requireAdmin`）保护所有 `/api/*`。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| 后端 auth 中间件 | `src/admin/auth.js` | 新增 |
| 后端 admin 入口 | `src/admin/index.js` | 修改（应用三层中间件） |
| 前端 Supabase client | `src/admin/frontend/src/lib/supabase.js` | 新增 |
| 前端 auth 页 | `src/admin/frontend/src/pages/{Register,Login,Rejected}Page.jsx` | 新增 |
| 前端入口 | `src/admin/frontend/src/App.jsx` | 修改（auth gate） |

## 3. 数据变更

不在 hub 端存用户表，所有用户数据在 Supabase。

`app_metadata.role` 字段语义：
- 缺失或 null → pending
- `"user"` → 已审批普通用户
- `"admin"` → 已审批管理员
- `"rejected"` → 已拒绝

终端 token 仍存 `config/terminals.json`，含 `userId`/`userEmail` 字段（在终端 CRUD Story 加入，本 Story 仅打基础）。

## 4. 接口变更

- 所有 `/api/*` 走 `requireAuth + requireApproved`
- `/api/admin/*`（如有）加 `requireAdmin`
- 401 / 403 错误格式统一

## 5. 状态一致性

- JWT 是无状态的 → admin 重启不影响登录态
- role 改了之后下一次 token 刷新生效；用户可手动刷新页面立即生效
- terminals.json 中的 `userId` 在用户被删除/拒绝后变成孤儿（仅 admin 可见）

## 6. 依赖关系

- 依赖：Supabase 项目 + 配 SUPABASE_URL / SUPABASE_ANON_KEY 环境变量
- 被依赖：所有后续 admin 功能（账号管理、终端、用量等）

## 7. 复用检查

- 中间件设计参照 Express 标准 next() 链
- 前端 auth gate 在 App.jsx 顶层，路由前生效

## 8. 性能影响

- 每次请求一次 Supabase getUser 调用（远程） → 影响延迟
- 缓解：JWT 本地解码 + 定期 refresh，无需每次远程验证（如需进一步优化可加内存缓存）

## 9. 测试策略

- 单测：requireAuth 缺 token / 错 token / 过期 token / 正常 token
- 单测：requireApproved 各 role 状态
- 单测：requireAdmin 仅 admin 通过
- 手动：注册 → pending → SQL 改 role → user 全流程

## 10. 风险与回滚

- 风险：误从 user_metadata 读 role → 用户可绕权限
  - 缓解：代码 review 显式禁止；CLAUDE.md 写明
- 风险：Supabase 短时不可用 → 全面 503
  - 缓解：监控 + 降级提示
- 回滚：基础架构无法回滚，但单点修改可 revert

## Changelog
- backfill-v1（2026-04-29）从 CLAUDE.md "Auth System" 段 + src/admin/auth.js 反向梳理
