---
type: story
slug: 2026-04-21-QQ邮箱预扫描修复
title: "QQ 邮箱预扫描修复：避免邮箱验证 token 被扫描器消耗"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 09:55:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:55:00Z"
started_at_local: "2026-04-21 12:00:00 Asia/Shanghai"
started_at_utc: "2026-04-21T04:00:00Z"
confirmed_at_local: "2026-04-21 13:02:05 Asia/Shanghai"
confirmed_at_utc: "2026-04-21T05:02:05Z"
completed_at_local: "2026-04-21 13:02:05 Asia/Shanghai"
completed_at_utc: "2026-04-21T05:02:05Z"
epic_ref: auth-onboarding
sprint_refs: [sprint-0]
pr_refs: [7]
issue_refs: [6]
notes: "事后归档：scrum 引入前的 PR；PRD/TRD 从 PR #7 + issue #6 + 现网代码反向还原"
---

# PRD · QQ 邮箱预扫描修复

## 1. 背景与目标

Supabase 的邮箱验证链接是一次性 GET：第一个发起 GET 的请求消耗掉 token。

QQ 邮箱、微信内置浏览器在用户**点击前**会预扫描链接（用于反钓鱼/预览），扫描器的 GET 把 token 用掉了。用户真正点击时落地登录页，Supabase 后台仍显示 `Waiting for verification` —— 用户无法注册成功。

**目标**：把验证从"链接加载即触发"改为"用户主动点击触发"，让预扫描只能拿到静态 HTML，不能消耗 token。

## 2. 用户故事

### 2.1 普通用户（QQ 邮箱）
**故事**：作为 QQ 邮箱用户，我希望点击注册邮件中的验证链接能成功完成注册。
**验收标准**：
- [x] 用 QQ 邮箱注册 → 收到邮件 → 点击 → 验证成功
- [x] 即使邮箱客户端预扫描了链接，用户仍能正常完成验证
- [x] 验证失败（token 已用）时显示明确的错误页，不静默跳回登录

### 2.2 普通用户（跨设备）
**故事**：作为在 PC 上注册、用手机点邮件链接的用户，希望即使两端不共享 session 也能完成验证。
**验收标准**：
- [x] PC 注册 → 手机点邮件 → 手机端不需要 session 也能完成验证
- [x] 验证完成后手机端跳转友好页面（不要求重新登录 PC）

## 3. 功能需求

- **signUp 流程改造**：把 `emailRedirectTo` 指向 `/auth/confirm`（而非站点根）
- **新增 ConfirmEmailPage**：检测 URL 上的 `token_hash` + `type` 参数，渲染按钮，**用户点击**才调用 `supabase.auth.verifyOtp()`。预扫描器拿到的只是静态 HTML，不消耗 token
- **新增 VerifyErrorPage**：处理 token 已被消耗时的 `?error_code=otp_expired` 回跳，提示用户重发邮件
- **路由器**：`App.jsx` 用 `classifyAuthRedirect()` 在 session 检查之前路由 URL —— 跨设备点击不需要 session

## 4. Out of Scope

- 改变 Supabase 配置/插件（只在前端做事，后端零改动）
- 解决其它扫描器（Outlook safelinks 等） —— 同样的方案对它们也有效，但本次只针对 QQ/WeChat 验证
- 自动重发邮件按钮（VerifyErrorPage 暂时只显示错误，重发用户手动）

## 5. 边界情况与异常处理

- 用户多次点击 ConfirmEmailPage 按钮 → Supabase 已校验则返回错误，UI 提示
- 预扫描后立即由用户点击 → 用户拿到的也是静态 HTML，按钮触发后 Supabase 已无 token → 走 VerifyErrorPage
- 用户 URL 缺 token_hash → 回登录页

## 6. 验收标准

- [x] PR #7 merged 2026-04-21T05:02:05Z
- [x] Issue #6 closed
- [x] 手动：QQ 邮箱注册成功
- [x] 手动：故意先在浏览器加载链接（模拟扫描器）→ 再点击 → 走错误页（验证扫描器消耗了 token，但用户至少看到清晰错误）
