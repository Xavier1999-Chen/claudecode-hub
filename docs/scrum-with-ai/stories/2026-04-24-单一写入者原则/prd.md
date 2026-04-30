---
type: story
slug: 2026-04-24-单一写入者原则
title: "单一写入者原则：消除 admin/proxy 双写 JSON 的竞态"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 09:45:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:45:00Z"
started_at_local: "2026-04-24 14:00:00 Asia/Shanghai"
started_at_utc: "2026-04-24T06:00:00Z"
confirmed_at_local: "2026-04-24 16:34:53 Asia/Shanghai"
confirmed_at_utc: "2026-04-24T08:34:53Z"
completed_at_local: "2026-04-24 16:34:53 Asia/Shanghai"
completed_at_utc: "2026-04-24T08:34:53Z"
epic_ref: account-management
sprint_refs: [sprint-0]
pr_refs: [43]
issue_refs: [42]
notes: "事后归档：scrum 引入前的 PR；PRD/TRD 从 PR #43 + issue #42 + 现网代码反向还原"
---

# PRD · 单一写入者原则

## 1. 背景与目标

`accounts.json` 和 `terminals.json` 之前同时被 admin 和 proxy 两个进程写入：
- admin 在用户操作（force-offline / 删除账号 / sync）后写盘
- proxy 在事件触发（403 封号 / 熔断器开 / token 刷新 / 429 fallback）后也写盘

无锁、无队列、无序号 → 出现过这些问题：
- 强制下线后，proxy 把 cooling 状态写回去（覆盖 admin 写的 status）
- 删除终端后，proxy 仍在内存里使用旧 ID 写回
- admin 写的修改被 proxy 几秒后的事件 patch 覆盖

修前的症状：强制离线/封号检测/删除均不可靠。

**目标**：建立 admin 唯一写盘的契约，proxy 通过事件上报让 admin 统一写。

## 2. 用户故事

### 2.1 Admin
**故事**：作为 admin，我希望我做的修改（强制下线、删除）不会被几秒后 proxy 的内部状态覆盖回去。
**验收标准**：
- [x] 强制下线一个账号 → 实际状态稳定为 offline，不再被覆盖
- [x] 删除账号/终端 → 真的从 JSON 里消失，不被 proxy 重新写回
- [x] 封号检测（403 permission_error）能持久化到磁盘

### 2.2 开发者（隐式角色）
**故事**：作为代码维护者，我希望"哪个进程能写哪个文件"有清晰契约，避免今后引入新事件时再次踩坑。
**验收标准**：
- [x] CLAUDE.md 明确写明"admin 是 accounts.json/terminals.json 的唯一写入者"
- [x] proxy 的写盘代码全部移除
- [x] 单测覆盖：proxy 在事件触发时调用 reportToAdmin 而非直接写文件

## 3. 功能需求

- **proxy 不再写盘**：删除 `src/proxy/index.js` 中所有 `writeTerminals` / `writeAccounts` 调用
- **事件上报通道**：proxy → admin 的 4 个 `/_internal/report-*` 端点
  - `/_internal/report-exhausted`（403 封号 / 熔断器 OPEN）
  - `/_internal/report-fallback`（429/529 终端切到其它账号）
  - `/_internal/report-credentials`（OAuth token 刷新）
  - `/_internal/sync-terminals`（admin 主动拉 proxy 的实时状态）
- **熔断器扩展**：`circuit-breaker.js` 新增 `recordFailure()` + `onOpen` 回调
  - 400/403 非 perm / 5xx 等非临时错误累计 → 连续 3 次 OPEN
  - OPEN → onOpen 回调 → admin report-exhausted
  - 429/529/网络错误**不**记 failure（避免误熔断）

## 4. Out of Scope

- 把契约扩展到 `usage.jsonl`（这个本来就是 append-only，不存在双写）
- 引入文件锁机制（事件驱动设计已规避竞态，无需锁）
- proxy 失联时的 fallback（admin 不可达就接受短暂内存状态，启动时重读磁盘）

## 5. 边界情况与异常处理

- admin 短时不可达：proxy 内存状态先生效，事件失败的会丢；下次成功事件覆盖即可
- proxy 重启：从磁盘重读 accounts.json/terminals.json，rate-limit 状态丢失（按设计；syncRateLimit probe 重新填充）
- 同时多事件并发：admin 的 Express handler 处理顺序即写盘顺序（单进程节点）

## 6. 验收标准

- [x] PR #43 merged 2026-04-24T08:34:53Z
- [x] Issue #42 closed
- [x] 8 个新单测：4 个 account-pool 回调 + 4 个 circuit-breaker onOpen
- [x] 153/153 测试全绿
- [x] CLAUDE.md 加入"单一写入者原则"段
