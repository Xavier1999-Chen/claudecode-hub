---
type: trd
slug: 2026-04-21-Auto模式逃离冷却账号
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 10:10:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:10:00Z"
---

# TRD · Auto 模式逃离冷却账号

## 1. 概述

在 proxy 路由层和 admin 同步路径都补"冷却账号判定"，让 auto 模式终端不被卡在冷却账号。新增独立可测的 `reassignment.js` 模块。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| 账号池 | `src/proxy/account-pool.js` | 修改（新增 `#isCooling`，重写 `#pickAuto` / `selectFallback`） |
| admin 迁移模块 | `src/admin/reassignment.js` | 新增 |
| admin 入口 | `src/admin/index.js` | 修改（hook 迁移到 syncRateLimit 路径） |

## 3. 数据变更

`terminals.json` 中 auto 模式终端的 `accountId` 字段在迁移后被改写。无新字段。

## 4. 接口变更

无 API 变更；现有 `/api/accounts/:id/sync-usage` 和 `/api/sync-usage-all` 在写盘后调用迁移逻辑（行为变更，签名不变）。

## 5. 状态一致性

- proxy 路由层每次请求**重新判定**，不依赖之前的 sticky 选择
- admin 写盘冷却账号后立即 reassign，避免 UI 与 routing 不一致
- 单一写入者原则：admin 仍是 terminals.json 唯一写盘方（彼时尚未全面落地，但本 PR 沿用方向）

## 6. 依赖关系

- 依赖：`account-pool` 已有的 status / utilization 字段
- 被依赖：后续 PR #20 OAuth 撤销检测 + PR #43 单一写入者原则把这套机制标准化

## 7. 复用检查

- 复用现有的 `selectFallback` 候选过滤逻辑
- 复用 admin 已有的 terminals 写盘函数

## 8. 性能影响

- `#isCooling` 是纯字段比较，O(1)
- `reassignCoolingTerminals` 在 syncRateLimit 后调用，与 sync 操作一致的频率（无额外定时器）

## 9. 测试策略

- 单测（proxy）：`#isCooling` × {status × utilization × resetAt} 矩阵
- 单测（admin）：`reassignCoolingTerminals`
  - manual 模式终端跳过
  - exhausted 账号不作候选
  - 无热账号不迁移（终端保留原绑定）
  - 多个 auto 终端都迁到最低利用率热账号
- 手动：3 个 auto 终端 + 1 个 100% 冷却账号 → 全部迁出
- 手动：weekly 100% 也触发冷却（验 issue #14 #15）

## 10. 风险与回滚

- 风险：判定过于敏感（utilization 99.9% 也算冷却）→ 阈值定义清楚，单测覆盖临界值
- 风险：迁移导致频繁绑定切换 → manual 模式不动 + 候选只看温账号，频率受 sync 频率控制
- 回滚：单 PR commit revert 即可

## Changelog
- backfill-v1（2026-04-29）从 PR #11 + PR #18 + 现网 reassignment.js 反向生成
