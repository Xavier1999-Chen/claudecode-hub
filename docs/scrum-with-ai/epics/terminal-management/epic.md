---
type: epic
slug: terminal-management
title: "终端管理（Terminal Management）"
status: active
created_at_local: "2026-04-28 19:38:00 Asia/Shanghai"
created_at_utc: "2026-04-28T11:38:00Z"
ended_at_local: ""
ended_at_utc: ""
---

# Epic · 终端管理

## Vision

让用户能够便捷地创建、命名、绑定、迁移多个终端 token（`sk-hub-*`），让多 Claude Code 实例共享 hub 的账号池。终端是用户使用 hub 的入口单位 —— 名字友好、可见状态准确（在哪台账号、上次使用时间、当前模式）、auto / manual 切换无心智负担。

## Strategic Themes

- **直观挂载**：UI 层让"终端绑定到哪个账号"可视化，点击切换
- **自动逃逸**：账号不可用时（cooling / exhausted），所有终端自动迁移到温账号
- **可见用量**：每个终端的活动状态实时反映在 admin 面板
- **多用户隔离**：每个用户只看自己的终端（已实现，PR 历史）

## Member Stories

| Slug                              | Status | Sprint(s) | Notes                                         |
|-----------------------------------|--------|-----------|-----------------------------------------------|
| 2026-04-21-Auto模式逃离冷却账号   | done   | sprint-0  | PR #11 + PR #18 / issue #10 #17 #14 #15       |
| (历史) manual + cooling 兜底      | done   | sprint-0  | 包含在 2026-04-27-聚合账号虚拟MAX计量 的 decisions 中 |

## Out of Scope

- 账号配置（在 `account-management` Epic）

## Open Questions

- 终端粒度的失败统计 / 速率限制（未来）
- 终端历史日志查看 UI（未来）
