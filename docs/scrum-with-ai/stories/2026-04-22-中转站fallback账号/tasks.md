# Tasks · 中转站 fallback 账号

> 事后归档。原始实施未做 task 拆分，按 PR/issue 归纳为单个 Task。

## T1 · 引入 relay 账号类型 + 三级 fallback + modelMap
- type: Task
- github: #32
- depends_on: []
- status: done
- pr: #33
- merged_at_utc: 2026-04-22T16:23:50Z

### Goal
新增 `type: 'relay'` 账号，使其作为 OAuth 池冷却时的兜底层，并支持模型名映射。

### Acceptance
- [x] 后端新增 `POST /api/accounts/relay`（admin only）
- [x] account-pool 实现 warm OAuth → relay → cooling OAuth 三级 fallback
- [x] `model-map.js` 实现按 prefix 映射 opus/sonnet/haiku
- [x] 前端 `RelayModal` 表单 + 卡片渲染
- [x] 16 个新单测（共 88/88 全绿）
- [x] sanitiseAccount 隐藏 apiKey
