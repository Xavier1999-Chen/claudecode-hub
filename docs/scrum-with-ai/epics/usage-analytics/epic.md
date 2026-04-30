---
type: epic
slug: usage-analytics
title: "用量统计（Usage Analytics）"
status: active
created_at_local: "2026-04-28 19:38:00 Asia/Shanghai"
created_at_utc: "2026-04-28T11:38:00Z"
ended_at_local: ""
ended_at_utc: ""
---

# Epic · 用量统计

## Vision

给用户清晰的用量可视化能力：admin 看全局（按账号 / 模型 / 终端 / 时间分布），普通用户看个人强度（仪表盘 + 热力图）。用量数据是费用归因 + 容量规划 + 异常发现的基础。

## Strategic Themes

- **数据采集**：proxy 在 SSE / JSON 路径都能可靠记录 usage.jsonl（含 tier 字段）
- **多视图**：admin 与 user 看到不同粒度
- **历史与实时**：当日 / 5h / 7d / 月，按需聚合

## Member Stories

| Slug                          | Status | Sprint(s) | Notes                                                  |
|-------------------------------|--------|-----------|--------------------------------------------------------|
| 2026-04-23-用量强度视图       | done   | sprint-0  | PR #35 / issue #34                                     |
| (历史) UsageTab tier 分类修复 | done   | sprint-0  | 包含在 2026-04-27-聚合账号虚拟MAX计量 的 decisions 中  |

## Out of Scope

- 计量本身（属于 account-management Epic 的虚拟 MAX 计量）

## Open Questions

- 跨账号用量横向对比 UI（未来）
- 按 Story / Sprint 维度归集用量（未来，scrum-with-ai 集成）
