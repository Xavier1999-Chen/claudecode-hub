# Tasks · QQ 邮箱预扫描修复

> 事后归档。原始实施未做 task 拆分，按 PR/issue 归纳为单个 Task。

## T1 · 引入"用户主动点击触发"的验证页
- type: Task
- github: #6
- depends_on: []
- status: done
- pr: #7
- merged_at_utc: 2026-04-21T05:02:05Z

### Goal
把 Supabase 邮箱验证改为用户点击触发（ConfirmEmailPage），让扫描器只能拿到静态 HTML。

### Acceptance
- [x] signUp 的 emailRedirectTo 指向 `/auth/confirm`
- [x] ConfirmEmailPage 渲染按钮，点击调用 verifyOtp
- [x] VerifyErrorPage 处理 otp_expired 回跳
- [x] App.jsx 用 classifyAuthRedirect 在 session 检查之前路由
- [x] 跨设备验证场景手动通过（PC 注册 / 手机点击）
