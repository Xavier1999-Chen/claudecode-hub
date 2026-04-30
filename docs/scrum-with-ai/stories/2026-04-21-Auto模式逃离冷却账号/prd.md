---
type: story
slug: 2026-04-21-Auto模式逃离冷却账号
title: "Auto 模式逃离冷却账号：限流时不再被卡住"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 10:10:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:10:00Z"
started_at_local: "2026-04-21 18:00:00 Asia/Shanghai"
started_at_utc: "2026-04-21T10:00:00Z"
confirmed_at_local: "2026-04-21 20:09:11 Asia/Shanghai"
confirmed_at_utc: "2026-04-21T12:09:11Z"
completed_at_local: "2026-04-21 20:09:11 Asia/Shanghai"
completed_at_utc: "2026-04-21T12:09:11Z"
epic_ref: terminal-management
sprint_refs: [sprint-0]
pr_refs: [11, 18]
issue_refs: [10, 17]
notes: |
  事后归档：scrum 引入前的两个相关 PR 合并归一个 Story。
  - PR #11：proxy 路由层不再 stick 在冷却账号（issue #10）
  - PR #18：admin 在 syncRateLimit 后主动迁移 auto 终端（issue #17）
  另含早期相关修复 issue #14 #15（weekly quota 100% 触发冷却）
---

# PRD · Auto 模式逃离冷却账号

## 1. 背景与目标

之前在 hub 里设置 auto 模式的终端会"粘"在某个账号上（sticky preference）。这本来是为了减少跨账号切换、保持账号选择一致性，但有 bug：

- 当账号进入冷却（5h window blocked 或 utilization >= 1.0 但 resetAt 未过）时，auto 模式不应继续 stick
- 实际上 `#pickAuto` / `selectFallback` 只在 `status === 'exhausted'` 或熔断器开时把账号当不可用
- 结果：3 个 auto 模式终端都 pin 在同一个 100% 利用率账号上，请求疯狂排队 / 失败

修前症状：UI 截图显示三个终端绑定到 100% 冷却账号、卡死。

**目标**：让 auto 模式终端在账号冷却时立即逃离到温账号；同时让 admin syncRateLimit 后能主动重绑（不仅是请求路由层做对，UI 显示也要正确）。

## 2. 用户故事

### 2.1 普通用户
**故事**：作为 auto 模式终端用户，我希望某个账号限流时我的请求自动转到其它热账号，不要卡在 429。
**验收标准**：
- [x] 账号 `window5h.status === 'blocked'` 或 `utilization >= 1.0`（resetAt 未过）→ 不被选中
- [x] 请求被路由到温账号（status active + 利用率最低）
- [x] 无热账号时按 cooling 账号的 resetAt 升序选最快恢复的

### 2.2 Admin
**故事**：作为 admin，我希望面板上看到的"终端绑定"反映真实的可用状态 —— 不是显示绑在冷却账号上但实际请求走别处。
**验收标准**：
- [x] admin syncRateLimit 检测到账号冷却 → 自动 reassign auto 模式终端到温账号
- [x] terminals.json 真的写入新绑定，UI 实时更新
- [x] manual 模式终端不动（用户显式选了，不动）
- [x] exhausted 账号不当候选

## 3. 功能需求

### Proxy 层（PR #11）
- **`#isCooling(acc)` 工具函数**：判定账号冷却（综合 status / window5h / utilization / resetAt）
- **重写 `#pickAuto` / `selectFallback`**：两层结构 —— 先选 warm 账号；无 warm 才选 cooling
- **请求路由不再 stick**：每次请求重新判定，不固定缓存绑定

### Admin 层（PR #18）
- **新模块 `src/admin/reassignment.js`**：
  - `isWindowCooling(window)` —— 单 window 状态判定
  - `isAccountCooling(account)` —— 账号整体判定
  - `reassignCoolingTerminals(terminals, accounts)` —— 把冷却账号上的 auto 终端迁到最低利用率热账号
- **hook 到 sync 路径**：`/api/accounts/:id/sync-usage` 和 `/api/sync-usage-all` 写盘后调用迁移
- **降级策略**：无热账号时不迁移（避免堆到同一个"least bad"冷却账号）
- **写回 terminals.json**：迁移结果落盘，UI 看得到

## 4. Out of Scope

- manual 模式终端（用户显式选定的，不动）
- 跨用户的智能负载均衡（每用户独立判定）
- exhausted 账号的恢复（依赖管理员重新 OAuth login）

## 5. 边界情况与异常处理

- weekly quota 100% 应触发冷却（issue #14、#15 顺带修复）
- 同时多个账号都冷却 → 选 resetAt 最早的；没热账号也不强行轮询
- 单元测试覆盖各 status × utilization 组合

## 6. 验收标准

- [x] PR #11 merged 2026-04-21T12:08:55Z（proxy 层）
- [x] PR #18 merged 2026-04-21T12:09:11Z（admin 层）
- [x] Issue #10 / #17 closed（含 #14 / #15 关联修复）
- [x] 单测：`#isCooling` 各状态组合
- [x] 单测：`reassignCoolingTerminals` 含 manual 模式跳过、exhausted 账号跳过、无热账号不迁移
- [x] 手动：3 个 auto 终端 + 1 个冷却账号 → 全部迁出到热账号
