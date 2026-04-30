# Tasks · 单一写入者原则

> 事后归档。原始实施未做 task 拆分，按 PR/issue 归纳为两个 Task（事件改造 + 熔断器补丁）。

## T1 · proxy 改为事件驱动上报，admin 唯一写盘
- type: Task
- github: #42
- depends_on: []
- status: done
- pr: #43
- merged_at_utc: 2026-04-24T08:34:53Z

### Goal
删除 proxy 直接写 JSON 的代码，改为通过 4 个 `/_internal/report-*` 上报给 admin。

### Acceptance
- [x] proxy `index.js` 删除 3 处 `writeTerminals` 调用
- [x] 新增 `reportToAdmin()` 工具函数 + 回调注入
- [x] admin 新增 `/_internal/report-exhausted` / `/_internal/report-fallback` / `/_internal/report-credentials` / `/_internal/sync-terminals`
- [x] 4 个 account-pool 回调单测通过

## T2 · 熔断器 recordFailure + onOpen 兜底
- type: Task
- github: #42
- depends_on: [T1]
- status: done
- pr: #43
- merged_at_utc: 2026-04-24T08:34:53Z

### Goal
补充非临时错误（400/403非perm/5xx）的失败计数 + 熔断器开时的回调通道，以触发 admin report-exhausted。

### Acceptance
- [x] `circuit-breaker.js` 新增 `recordFailure()` 与 `onOpen` 回调
- [x] forwarder 在非临时错误处调用 `recordFailure`
- [x] 429/529/网络错误**不**记 failure
- [x] 4 个 onOpen 回调单测通过
- [x] 总测试 153/153 全绿
