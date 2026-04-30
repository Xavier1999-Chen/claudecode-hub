---
type: epic
slug: auth-onboarding
title: "用户认证（Auth & Onboarding）"
status: active
created_at_local: "2026-04-28 19:38:00 Asia/Shanghai"
created_at_utc: "2026-04-28T11:38:00Z"
ended_at_local: ""
ended_at_utc: ""
---

# Epic · 用户认证

## Vision

让 hub 的多用户能力可信：注册、邮箱验证、登录、admin 审批、用户拒绝场景全部覆盖。Supabase JWT 是骨架，hub 在其上叠加 admin 审批逻辑（pending / approved / rejected 三态）。

## Strategic Themes

- **三态用户**：pending（null role）→ user / admin（approved）→ rejected
- **跨设备验证**：邮箱链接在 QQ Mail / WeChat 等扫描器场景下可用
- **admin 审批工具**：通过 Supabase dashboard SQL（未来：内建 UI）

## Member Stories

| Slug                          | Status | Sprint(s) | Notes              |
|-------------------------------|--------|-----------|--------------------|
| 2026-04-15-认证基础架构       | done   | sprint-0  | 基础架构期，无特定 PR |
| 2026-04-21-QQ邮箱预扫描修复   | done   | sprint-0  | PR #7 / issue #6   |
| 2026-04-21-微信浏览器图标修复 | done   | sprint-0  | PR #9 / issue #8   |

## Out of Scope

- 账号本身（在 `account-management` Epic）
- 用户终端（在 `terminal-management` Epic）

## Open Questions

- 内建审批 UI（avoid SQL 操作 Supabase dashboard，未来）
- 多租户隔离（远期）
