---
type: trd
slug: 2026-04-21-OAuth撤销检测
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 09:35:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:35:00Z"
---

# TRD · OAuth 撤销检测

## 1. 概述

在 proxy + admin 两层加 403 `permission_error` 检测，统一通过 `markUnauthorized` 把账号置 exhausted，并触发终端迁移。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| proxy 转发器 | `src/proxy/forwarder.js` | 修改（新增 403 permission_error 分支） |
| proxy 权限守卫 | `src/proxy/permission-guard.js` | 新增（独立模块封装检测逻辑） |
| 账号池 | `src/proxy/account-pool.js` | 修改（新增 `markUnauthorized` 方法） |
| admin 同步 | `src/admin/index.js` | 修改（同步限流时处理 403） |
| admin 内部端点 | `src/admin/index.js` | 新增 `POST /_internal/report-exhausted` |

## 3. 数据变更

- `accounts.json` 单条记录的 `status` 字段引入 `exhausted` 状态（之前只有 `active`/无）
- 不引入新字段，复用现有 status 机制

## 4. 接口变更

- 新增 `POST /_internal/report-exhausted`（proxy → admin）
  - body: `{ accountId, reason: 'permission_error' }`
  - admin 写盘 + reassign auto 终端

## 5. 状态一致性

- proxy 内存 + admin 磁盘双写采用「proxy 触发事件 → admin 唯一写盘」（虽然此时单一写入者原则尚未全面落地，但本 PR 已遵循该方向）
- 终端迁移走 admin 的 reassignTerminals —— 与冷却账号 reassignment 共享路径

## 6. 依赖关系

- 依赖：`account-pool` 已实现的 `selectFallback` 机制
- 被依赖：后续 PR #43（单一写入者原则）将该模式标准化

## 7. 复用检查

- 复用 `selectFallback` 完成请求自救
- 复用 admin 已有的终端 reassignment 逻辑

## 8. 性能影响

- 仅在 upstream 返回 403 时触发，正常路径无影响
- 自救重试增加 1 次额外的 upstream 请求，但避免向客户端暴露错误

## 9. 测试策略

- 单测：forwarder 收到 403 + permission_error → markUnauthorized 被调用
- 单测：非 permission_error 的 403 继续透传
- 单测：account-pool 状态机 active → exhausted

## 10. 风险与回滚

- 风险：误判（非撤销的 403 被当撤销）→ 通过精确匹配 `error.type === 'permission_error'` 规避
- 回滚：单 PR commit revert 即可，无数据迁移

## Changelog
- backfill-v1（2026-04-29）从 PR #20 + 现网代码反向生成
