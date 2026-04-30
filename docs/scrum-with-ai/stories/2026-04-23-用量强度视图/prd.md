---
type: story
slug: 2026-04-23-用量强度视图
title: "用量强度视图：普通用户的仪表盘 + 终端热力网格"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 10:15:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:15:00Z"
started_at_local: "2026-04-23 14:00:00 Asia/Shanghai"
started_at_utc: "2026-04-23T06:00:00Z"
confirmed_at_local: "2026-04-23 16:44:56 Asia/Shanghai"
confirmed_at_utc: "2026-04-23T08:44:56Z"
completed_at_local: "2026-04-23 16:44:56 Asia/Shanghai"
completed_at_utc: "2026-04-23T08:44:56Z"
epic_ref: usage-analytics
sprint_refs: [sprint-0]
pr_refs: [35]
issue_refs: [34]
notes: "事后归档：scrum 引入前的 PR；PRD/TRD 从 PR #35 + issue #34 + 现网 usage-intensity.js 反向还原"
---

# PRD · 用量强度视图

## 1. 背景与目标

普通用户原本看到的"用量 tab"是 admin 视角的详细统计（按账号 / 模型 / 终端 / 时间），信息量大但跟用户**自己的使用强度**没直接关系。用户更想看"我这个月用得猛不猛？我哪几个终端用得多？"

**目标**：把普通用户视角改造成"使用强度仪表盘 + 终端热力网格"，让用户一眼看到自己在 30 天周期内的总量分布。Admin 视图保留原样不变。

## 2. 用户故事

### 2.1 普通用户
**故事**：作为终端用户，我希望打开用量 tab 就能直观看到"我用得多猛"，以及哪几个终端最活跃。
**验收标准**：
- [x] 顶部半圆仪表盘：指针随当前 30 天周期累计美金线性移动
- [x] 仪表盘四档分色（轻度 / 中度 / 重度 / 超重度）
- [x] 下方周历热力网格：每个终端一格，近 30 天，格子按当日美金着色
- [x] 周期从用户注册时间起算，每 30 天一周期

### 2.2 Admin
**故事**：作为 admin，我不希望我的视图被改坏（强度视图对管理员没用）。
**验收标准**：
- [x] Admin 视图完全不变（继续看账号/模型/终端详细分布）
- [x] 后端零改动（视图层切换基于前端 role）

## 3. 功能需求

- **仪表盘组件**：半圆 SVG 指针 + 四档颜色分段（线性映射，阈值定义在 `usage-intensity.js`）
- **热力网格组件**：GitHub 风格 7×N 周历，每终端一行；颜色由当日美金通过纯函数 `intensityColor(amountUSD)` 返回
- **周期计算**：从 `user.created_at` 起 30 天一周期 —— `cycleStart(now, registeredAt)` 纯函数
- **数据源**：复用现有 `usage.jsonl`，前端按周期过滤
- **路由切换**：基于 `req.user.role`，user → 强度视图，admin → 原视图

## 4. Out of Scope

- 历史周期对比（只看当前周期）
- 自定义周期（30 天硬编码，从用户注册起算）
- 后端聚合优化（暂时直接读全部 jsonl 在前端聚合，量大时再优化）
- 推送/告警阈值

## 5. 边界情况与异常处理

- 用户刚注册，周期内无数据 → 仪表盘指针置 0，热力网格全空
- 终端被删除 → 历史用量仍显示在网格中（按 terminalId 分组）
- 用量数据缺失（gzip SSE bug 时段，PR #27 已修） → 影响显示但不报错

## 6. 验收标准

- [x] PR #35 merged 2026-04-23T08:44:56Z
- [x] Issue #34 closed
- [x] 19 个新纯函数测试 + 88 个已有测试全部通过（共 107/107）
- [x] 手动：普通用户 → 用量 tab → 仪表盘 + 热力网格
- [x] 手动：管理员 → 用量 tab → 原视图不变
- [x] ECS 部署验收通过
