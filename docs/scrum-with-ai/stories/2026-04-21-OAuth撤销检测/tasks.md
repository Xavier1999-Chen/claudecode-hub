# Tasks · OAuth 撤销检测

> 事后归档。原始实施未做 task 拆分，按 PR/issue 归纳为单个 Task。

## T1 · 实现 403 permission_error 检测 + 自救
- type: Task
- github: #19
- depends_on: []
- status: done
- pr: #20
- merged_at_utc: 2026-04-21T13:02:47Z

### Goal
在 proxy + admin 两层添加 403 `permission_error` 检测，标记账号为 exhausted 并迁移终端。

### Acceptance
- [x] proxy `forwarder.js` 检测到 403 + permission_error → 调 `markUnauthorized` + selectFallback 自救
- [x] admin 同步限流路径同样处理
- [x] 引入 `permission-guard.js` 模块封装检测逻辑
- [x] 单测覆盖：permission_error 路径、非 permission_error 的 403 透传
