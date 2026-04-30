---
type: epic
slug: account-management
title: "账号管理（Account Management）"
status: active
created_at_local: "2026-04-28 19:38:00 Asia/Shanghai"
created_at_utc: "2026-04-28T11:38:00Z"
ended_at_local: ""
ended_at_utc: ""
---

# Epic · 账号管理

## Vision

让 hub 用户（admin + 普通用户）在多种账号类型（OAuth Anthropic / 第三方中转 / 聚合多 provider）之间无感知切换，让用户感受不到底层路由复杂度，享受类似原生 Anthropic MAX 的体验。账号系统是 hub 的核心能力面 —— admin 配置友好、普通用户体验自然、Proxy 层路由稳定。

## Strategic Themes

- **多账号类型互通**：OAuth / Relay / Aggregated 在选号、健康监控、用量跟踪上行为一致
- **智能路由**：按模型 tier、负载、健康状态自动选择最优上游
- **盲测体验**：聚合账号在普通用户视角下与原生 MAX 难以区分（虚拟限额 + 用量伪装）
- **健康探测与封号检测**：账号失效（OAuth 撤销、上游 403、限额触顶）→ 立即下线 + 终端逃逸

## Member Stories

| Slug                              | Status | Sprint(s) | Notes                              |
|-----------------------------------|--------|-----------|------------------------------------|
| 2026-04-21-OAuth撤销检测          | done   | sprint-0  | PR #20 / issue #19                 |
| 2026-04-22-中转站fallback账号     | done   | sprint-0  | PR #33 / issue #32                 |
| 2026-04-24-单一写入者原则         | done   | sprint-0  | PR #43 / issue #42                 |
| 2026-04-27-聚合卡片完整实现       | done   | sprint-0  | PR #46 / issues #45 #44 #38 #21    |
| 2026-04-27-聚合账号虚拟MAX计量    | done   | sprint-0  | PR #53；W18 transition 期合并      |

## Out of Scope

- 终端管理（在 `terminal-management` Epic）
- 用量统计 UI（在 `usage-analytics` Epic）

## Open Questions

- 403 forbidden / Request not allowed 的安全分类规则（issue #54）
- 多用户共享 Pro 风控（issue #41）
- 中转站 thinking signature 缺失（issue #40）
