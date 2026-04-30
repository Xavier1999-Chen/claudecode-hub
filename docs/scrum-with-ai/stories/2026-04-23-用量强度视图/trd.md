---
type: trd
slug: 2026-04-23-用量强度视图
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 10:15:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:15:00Z"
---

# TRD · 用量强度视图

## 1. 概述

前端纯实现：在 UsageTab 顶部按 role 切视图，普通用户走新组件（仪表盘 + 热力网格），admin 仍走原视图。后端零改动，复用 `usage.jsonl` 已有数据。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| 强度核心逻辑 | `src/admin/frontend/src/usage-intensity.js` | 新增（纯函数：intensityColor / cycleStart / cycleEnd / aggregateByTerminal） |
| 仪表盘组件 | `src/admin/frontend/src/IntensityGauge.jsx` | 新增 |
| 热力网格组件 | `src/admin/frontend/src/TerminalHeatGrid.jsx` | 新增 |
| 用量 tab 容器 | `src/admin/frontend/src/UsageTab.jsx` | 修改（按 role 渲染） |
| 测试 | `tests/usage-intensity.test.js` | 新增（19 个纯函数测试） |

## 3. 数据变更

无后端数据变更。前端按 `usage.jsonl` 中 `terminalId` + `costUSD` + `timestamp` 聚合。

## 4. 接口变更

无。复用现有 `/api/usage`（admin）和 user 视角的同 endpoint（按 userId 过滤）。

## 5. 状态一致性

- 前端每 15s 轮询一次（与全局节奏一致）
- 周期计算从 `user.created_at` 起（来自 Supabase JWT decode）
- 切换用户/role 时强制重渲染避免缓存错误数据

## 6. 依赖关系

- 依赖：`usage.jsonl` 数据完整（PR #27 修复了 gzip SSE 丢数据 bug）
- 依赖：用户已有 created_at 字段（Supabase user 对象）

## 7. 复用检查

- 复用 React 19 + 已有 Tailwind 风格
- 复用现有 `useUsageData` hook（如有），或本 PR 新增 hook 也设计成可复用

## 8. 性能影响

- 前端聚合 30 天数据，在终端数 ≤ 20、日均请求数 ≤ 1000 时无压力
- 后续若量上去，再加后端聚合 endpoint

## 9. 测试策略

- 单测（Node 跑前端纯函数）：
  - `intensityColor(amount)` —— 各档边界值
  - `cycleStart(now, registeredAt)` —— 注册即周期起、跨月、闰年
  - `cycleEnd(now, registeredAt)`
  - `aggregateByTerminal(records, period)` —— 跨终端、跨日聚合
  - 19 个测试覆盖以上场景
- 手动：普通用户视图 / admin 视图 / ECS 验收

## 10. 风险与回滚

- 风险：聚合逻辑跑前端，数据量大时卡 → 限定 30 天窗口 + 仅 user 自己的数据，量级可控
- 风险：周期算错（时区问题） → 单测覆盖跨月、闰年、UTC vs local
- 回滚：单 PR commit revert，恢复原视图

## Changelog
- backfill-v1（2026-04-29）从 PR #35 + 现网 usage-intensity.js 反向生成
