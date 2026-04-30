# Tasks · Auto 模式逃离冷却账号

> 事后归档。原始实施分两个 PR，按 PR 维度归纳为两个 Task。

## T1 · Proxy 路由层：auto 模式不再 stick 在冷却账号
- type: Task
- github: #10
- depends_on: []
- status: done
- pr: #11
- merged_at_utc: 2026-04-21T12:08:55Z

### Goal
在 proxy `account-pool.js` 引入 `#isCooling`，重写 auto 选号逻辑成"先 warm 后 cooling"两层结构。

### Acceptance
- [x] `#isCooling(acc)` 综合 status / window5h / utilization / resetAt 判定
- [x] `#pickAuto` 优先 warm，无 warm 才选 cooling 中 resetAt 最早的
- [x] `selectFallback` 同样规则
- [x] 单测覆盖各状态组合，含 weekly 100%（issue #14、#15）

## T2 · Admin 同步：syncRateLimit 后主动迁移 auto 终端
- type: Task
- github: #17
- depends_on: [T1]
- status: done
- pr: #18
- merged_at_utc: 2026-04-21T12:09:11Z

### Goal
新增 `src/admin/reassignment.js`，在 syncRateLimit 后调用迁移，让 UI 看到的绑定与 routing 一致。

### Acceptance
- [x] `isWindowCooling` / `isAccountCooling` / `reassignCoolingTerminals` 三个独立可测函数
- [x] hook 到 `/api/accounts/:id/sync-usage` 和 `/api/sync-usage-all`
- [x] manual 模式终端不动
- [x] exhausted 账号不作候选
- [x] 无热账号时不迁移
- [x] 写回 terminals.json
- [x] 单测覆盖以上全部场景
