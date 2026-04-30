---
sprint_id: 2026-04-27-W18
started_at_local: "2026-04-27 00:00:00 Asia/Shanghai"
started_at_utc: "2026-04-26T16:00:00Z"
end_at_local: "2026-05-10 23:59:59 Asia/Shanghai"
end_at_utc: "2026-05-10T15:59:59Z"
duration_days: 14
goal: "上线营销首页 + 用户充值通道，让用户能从认识 claudecode-hub 到完成付费"
committed:
  - { type: story, ref: "issue#55" }
  - { type: story, ref: "issue#56" }
  - { type: bug,   ref: "issue#40" }
  - { type: story, ref: "issue#57" }
definition_of_done: "PR merged to main + 用户在 sprint review 接受；充值流程额外要求端到端跑通真实小额支付"
extensions: []
corrections: []
---

# Sprint 2026-04-27-W18

## Goal

上线营销首页 + 用户充值通道，让用户能从认识 claudecode-hub 到完成付费。

两个并行 track：
1. **认知层**：营销首页让访客快速理解产品价值，引导注册/付费
2. **变现层**：用户充值模块（无需公司实体的支付方案），打通付费闭环

## Committed

| Type  | Ref         | Title (短句)                                  | DoD                                             |
|-------|-------------|----------------------------------------------|-------------------------------------------------|
| story | issue#55    | 营销首页 - 建立产品印象 + 引导注册付费       | PR merged + staging 可访问 + 用户接受           |
| story | issue#56    | 用户充值模块 - 接入支付方案                  | PR merged + 用户接受 + **真实小额支付端到端**   |
| bug   | issue#40    | 中转站 thinking block 缺 signature           | PR merged + 用户接受                            |
| story | issue#57    | 优化用户使用指南                             | PR merged + 用户接受                            |

## Capacity Notes

- Sprint 时长 14 天（2 周）
- #56 充值模块 Phase 1（方案调研）需要先于 Phase 2（接入），可能压缩 #57 时间
- #40 是上 sprint 留下的 P2 bug，可在等待支付方案确认时穿插处理

## Stretch Goals (optional)

- backlog #54（403 forbidden 不触发封号）—— 已降级 P2，若上述 4 项提早完成可拉入

## Out of Scope

- 计费/扣费逻辑（仅充值，扣费下 sprint）
- 多语言、SEO 深度优化
- 营销首页 A/B 测试基础设施
