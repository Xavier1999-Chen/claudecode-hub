# Decisions · 认证基础架构

> 事后归档。原始实施跨基础架构期，未留 L2 决策记录；此处补 2 条事后梳理的关键决策点。

---

## 2026-04-15 11:25:16 · 选 Supabase 作为 JWT 提供方

### Trigger
项目启动时需要 admin 面板的用户鉴权，自己写 vs 用第三方。

### Options Considered
- A · 自己写（bcrypt + JWT 库）
  - + 完全可控
  - - 重复造轮子；密码安全/重置/MFA 都要自己做
  - - 需要 DB 表存用户
- B · Supabase auth
  - + 注册 / 邮件验证 / 重置密码免费
  - + JWT 标准实现
  - + 与 RLS 兼容（虽然本项目不用 RLS）
  - - 增加外部依赖
- C · Auth0 / Clerk
  - + 功能更全
  - - 价格高，本项目早期不需要

### Decision
选 B。Supabase free tier 满足初期需求；hub 不需要复杂的 RBAC，三态 role 足够；社区生态好。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3）
- trd.md：无（事后归档时明确写入 TRD §6）
- 链接：CLAUDE.md "Auth System" 段

---

## 2026-04-18 · role 读 app_metadata 而非 user_metadata

### Trigger
Supabase 的用户对象有两个 metadata 字段：`user_metadata`（客户端可写）和 `app_metadata`（仅服务端写）。决定 role 放哪个。

### Options Considered
- A · `user_metadata.role`
  - + 客户端可读（前端能拿到）
  - - 客户端**也能写** → 用户可自提权 admin
- B · `app_metadata.role`
  - + 仅 service_role key 能改
  - + 客户端 JWT 也能读到（解码 token）
  - - admin 改 role 必须用 service key

### Decision
选 B。安全是 hard requirement，灵活性可让步。改 role 走 Supabase dashboard SQL；故意保持有摩擦感（admin 操作门槛）。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3）
- trd.md：无（事后归档时明确写入 TRD §3、§10）
- 链接：CLAUDE.md "Auth System"、`src/admin/auth.js`

> 注：上述决策为事后梳理，原始实施未留 decisions.md。Sprint 0 归档时按代码痕迹还原。
