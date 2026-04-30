---
type: trd
slug: 2026-04-21-QQ邮箱预扫描修复
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 09:55:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:55:00Z"
---

# TRD · QQ 邮箱预扫描修复

## 1. 概述

把 Supabase 验证从"链接加载即触发"改为"用户主动点击触发"。前端新增 ConfirmEmailPage / VerifyErrorPage，加 classifyAuthRedirect 在 session 检查之前路由。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| 注册流程 | `src/admin/frontend/src/pages/RegisterPage.jsx` | 修改（emailRedirectTo 指向 /auth/confirm） |
| 验证页 | `src/admin/frontend/src/pages/ConfirmEmailPage.jsx` | 新增 |
| 错误页 | `src/admin/frontend/src/pages/VerifyErrorPage.jsx` | 新增 |
| 路由分类器 | `src/admin/frontend/src/auth-redirect.js` | 新增（classifyAuthRedirect） |
| 主入口 | `src/admin/frontend/src/App.jsx` | 修改（在 session 检查前应用路由分类） |

## 3. 数据变更

无后端数据变更。前端不持久化任何额外状态。

## 4. 接口变更

无 API 变更。Supabase auth.verifyOtp 的调用方式从"页面加载自动调"改成"用户点击调"。

## 5. 状态一致性

- 跨设备点击：手机端不需要 PC session；ConfirmEmailPage 只用 URL token_hash 参数即可调 verifyOtp
- 验证成功后 Supabase 设 cookie；后续路由按 session 走（手机端进入面板，PC 端独立 session）

## 6. 依赖关系

- 依赖：`@supabase/supabase-js` 的 verifyOtp API
- 依赖：React Router 已有路由系统

## 7. 复用检查

- ConfirmEmailPage 复用通用 Page layout
- VerifyErrorPage 复用错误页样式

## 8. 性能影响

- 多 1 次用户点击 + 1 个静态 HTML 页面渲染
- 对正常用户路径几乎无感

## 9. 测试策略

- 手动：QQ 邮箱注册全流程
- 手动：模拟扫描器（curl 链接）+ 真实点击 → 验证 VerifyErrorPage 正确显示
- 手动：跨设备（PC 注册 / 手机点击）

## 10. 风险与回滚

- 风险：用户多了一次点击操作，如果不熟悉可能困惑 → ConfirmEmailPage 提供清晰文案
- 风险：classifyAuthRedirect 在 session 检查之前如果误判可能造成无限重定向 → 加单测覆盖各 URL 形态
- 回滚：单 PR commit revert，回到 emailRedirectTo 指根

## Changelog
- backfill-v1（2026-04-29）从 PR #7 + 现网代码反向生成
