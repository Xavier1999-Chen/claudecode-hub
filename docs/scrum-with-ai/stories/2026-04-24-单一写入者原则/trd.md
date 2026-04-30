---
type: trd
slug: 2026-04-24-单一写入者原则
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 09:45:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:45:00Z"
---

# TRD · 单一写入者原则

## 1. 概述

把 admin 设为 accounts.json/terminals.json 的唯一写入者，proxy 通过 HTTP `/_internal/report-*` 上报事件让 admin 写盘。同时熔断器补 `recordFailure` + `onOpen` 回调，把 400/403非perm/5xx 累计成熔断信号。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| proxy 主入口 | `src/proxy/index.js` | 修改（删 3 处 writeTerminals + 加 reportToAdmin 注入） |
| 账号池 | `src/proxy/account-pool.js` | 修改（ensureFreshToken/markUnauthorized 改回调） |
| 熔断器 | `src/proxy/circuit-breaker.js` | 修改（新增 recordFailure + onOpen） |
| 转发器 | `src/proxy/forwarder.js` | 修改（recordFailure 调用点 + 错误分类） |
| admin 内部端点 | `src/admin/index.js` | 新增 4 个 `/_internal/report-*` |
| CLAUDE.md | 根 | 文档（加单一写入者原则段） |

## 3. 数据变更

无新字段。所有写盘操作集中到 admin 已有的 `writeAccounts` / `writeTerminals` 函数。

## 4. 接口变更

| Endpoint | 方向 | 用途 |
|----------|------|------|
| `POST /_internal/report-exhausted` | proxy → admin | 403 封号 或 熔断 OPEN |
| `POST /_internal/report-fallback` | proxy → admin | 429/529 终端切号 |
| `POST /_internal/report-credentials` | proxy → admin | OAuth token 刷新 |
| `POST /_internal/sync-terminals` | admin → proxy | admin 拉 proxy 内存终端实时状态 |

约定：所有 `/_internal/*` 仅本机访问（绑 0.0.0.0 但默认部署是同机），无鉴权。

## 5. 状态一致性

- 单一写入者保证 → 不再有写写竞态
- proxy 内存状态足以做实时路由决策；admin 不可达时，proxy 仍能转发，事件丢失非致命
- proxy 重启时从磁盘读 accounts.json，rate-limit 状态归零（admin 下次 syncRateLimit probe 重填）

## 6. 依赖关系

- 依赖：`src/shared/config.js` 的原子写盘（write `.tmp` + rename）
- 被依赖：所有后续涉及账号状态变更的 PR（#46 聚合账号、#53 虚拟 MAX 等）必须遵守此契约

## 7. 复用检查

- admin `writeAccounts` / `writeTerminals` 已是原子写盘，直接复用
- circuit-breaker 已有 closed/open/half-open 状态机，仅扩展事件源

## 8. 性能影响

- proxy 多一次 HTTP 调用（loopback，~1ms 级别）替代直接 fs.writeFile
- admin 的事件处理用 Express 单线程顺序消费，无并发写盘

## 9. 测试策略

- 单测（4 个）：account-pool 调用 reportToAdmin 而非直接写盘
  - markUnauthorized → onExhausted 回调
  - ensureFreshToken → onCredentialsRefreshed 回调
  - 各回调注入 mock，验证调用次数与参数
- 单测（4 个）：circuit-breaker recordFailure → onOpen
  - 累计 3 次失败 → state OPEN + onOpen 调用
  - 中间夹一次成功 → 计数重置
  - 429/网络错误不计数

## 10. 风险与回滚

- 风险：proxy 上报失败 → admin 状态滞后 → 验证：admin 不可达时 proxy 内存状态正确，事件队列不堆积
- 风险：循环上报（admin 写盘 → 通知 proxy → proxy 再上报） → 通过单向上报（proxy → admin）规避
- 回滚：单 PR commit revert；proxy 恢复直接写盘逻辑；admin 端点废弃即可

## Changelog
- backfill-v1（2026-04-29）从 PR #43 + 现网 CLAUDE.md 反向生成
