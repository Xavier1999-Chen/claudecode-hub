---
type: tasks
slug: 2026-04-27-聚合账号虚拟MAX计量
trd_version: v1
created_at_local: "2026-04-27 23:35:08 Asia/Shanghai"
created_at_utc: "2026-04-27T15:35:08Z"
all_done_at_local: "2026-04-28 14:47:29 Asia/Shanghai"
all_done_at_utc: "2026-04-28T06:47:29Z"
---

# Issue 列表：聚合账号虚拟 MAX 计量系统

> 前置：PRD v3 + TRD v1（已确认）

---

## Issue #1：Proxy 层记录原始请求 tier

### Goal
让 proxy 在转发聚合账号请求时，将原始请求的 tier（opus/sonnet/haiku）记录到 `usage.jsonl` 中，供后续虚拟利用率计算使用。

### Design
- `src/proxy/forwarder.js`：
  - 将 `body` 解析从 `if (isAggregated)` 块内提取到函数顶部
  - 从 `body.model` 推断 `requestedTier`
  - 将 `tier` 传递给 `createUsageTapper`
  - 删除 `detectModel()` 函数（功能被内联替代）
- `src/proxy/usage-tracker.js`：
  - `createUsageTapper` 新增 `tier` 参数
  - 写入 `usage.jsonl` 时包含 `tier` 字段

### Acceptance
- [ ] 聚合账号请求后，`logs/<accountId>/usage.jsonl` 最新记录包含 `tier` 字段
- [ ] Opus 请求记录 `tier: "opus"`，Sonnet 记录 `"sonnet"`，Haiku 记录 `"haiku"`
- [ ] 非聚合账号请求后，usage.jsonl 记录行为不变（tier 可为空或默认 sonnet）
- [ ] `detectModel()` 函数已删除，无重复解析

### Out of scope
- 不修改虚拟利用率计算逻辑
- 不修改前端

### 依赖
- 无

---

## Issue #2：虚拟利用率计算模块

### Goal
新增 `virtual-ratelimit.js` 模块，实现基于 usage.jsonl 的加权虚拟利用率计算，支持增量读取和内存缓存。

### Design
- **新增文件**：`src/admin/virtual-ratelimit.js`
  - 权重表：opus 4.0x / sonnet 2.0x / haiku 1.0x / image 3.0x
  - 限额表：pro/max/max_20x 三档
  - 增量读取：维护 `lastOffset`，每次只读新增记录
  - 内存缓存：保留 7 天内记录，自动清理过期数据
  - 输出格式：`{ window5h: { utilization, resetAt, status }, weekly: {...} }`
- **新增测试**：`tests/virtual-ratelimit.test.js`
  - 加权计算正确性
  - 窗口过滤正确性
  - resetAt 计算正确性
  - 增量读取行为
  - 文件截断后全量重读

### Acceptance
- [ ] 给定测试 usage.jsonl，计算出的 5h/7d 利用率与预期一致
- [ ] Opus 记录权重 4.0，Sonnet 2.0，Haiku 1.0
- [ ] 缺失 tier 的记录 fallback 到 sonnet（2.0）
- [ ] 5h resetAt 为下一个 5 小时整点
- [ ] 7d resetAt 为下周一 00:00 UTC
- [ ] 利用率 >= 1.0 时 status = "blocked"，否则 "allowed"
- [ ] 增量读取只处理新增记录，不重复读取历史数据

### Out of scope
- 不接入 admin 主服务（由 Issue #3 接入）
- 不修改前端

### 依赖
- 无（纯计算模块，可独立测试）

---

## Issue #3：Admin 接入虚拟计量与等级配置

### Goal
将虚拟利用率计算接入 admin 服务，支持聚合账号的等级（plan）配置和虚拟 rateLimit 持久化。

### Design
- `src/admin/index.js`：
  - `POST /api/accounts/aggregated`：新增 `plan` 字段（默认 "max"，校验非法值）
  - `PATCH /api/accounts/:id`：支持修改 `plan`，修改后立即重新计算 rateLimit
  - `syncRateLimit()`：aggregated 账号走虚拟计算分支（替代原有的 probeAndCacheRelay）
  - `probeAllRelays()`：aggregated 账号调用虚拟计算，计算完成后统一 `writeAccounts`
  - `sanitiseAccount()`：aggregated 账号返回中新增 `plan` 和 `rateLimit`

### Acceptance
- [ ] 创建聚合账号时可选 plan（PRO/MAX/MAX 20x），默认 MAX
- [ ] 非法 plan 返回 400 `invalid_plan`
- [ ] 修改 plan 后，accounts.json 中 rateLimit 立即按新限额重新计算
- [ ] `probeAllRelays()` 每 60s 计算并持久化 aggregated 账号的 rateLimit
- [ ] `GET /api/accounts` 返回的聚合账号包含 `plan` 和 `rateLimit`
- [ ] 新聚合账号（无 usage.jsonl）的 rateLimit 显示 utilization = 0%
- [ ] 虚拟利用率 >= 100% 时，rateLimit.status = "blocked"

### Out of scope
- 不修改 proxy（由现有热重载机制自动感知）
- 不修改前端（由 Issue #4 处理）

### 依赖
- Issue #1（usage.jsonl 需包含 tier）
- Issue #2（虚拟计算模块）

---

## Issue #4：前端聚合卡片伪装

### Goal
普通用户视角下，聚合卡片显示为 OAuth 订阅账号样式；admin 视角保持不变。

### Design
- `src/admin/frontend/src/components/AggregatedModal.jsx`：
  - 创建/编辑表单新增 plan 下拉选择器（PRO/MAX/MAX 20x）
- `src/admin/frontend/src/api.js`：
  - `addAggregatedAccount` / `updateAggregatedAccount` 传递 `plan` 参数
- `src/admin/frontend/src/AccountsTab.jsx`：
  - 当 `user.role !== 'admin' && account.type === 'aggregated'` 时
  - 复用 OAuth 卡片的渲染逻辑（用量条、等级标签、终端列表）
  - 不显示路由明细、provider 健康、token 刷新倒计时

### Acceptance
- [ ] Admin 视角聚合卡片显示完整路由表 + provider 健康状态
- [ ] 普通用户视角聚合卡片显示：昵称 + plan 标签 + 5h/周用量条 + 终端标签
- [ ] 普通用户视角**不显示**：路由明细、provider 名称、provider 健康、token 刷新倒计时
- [ ] 用量条颜色逻辑与 OAuth 卡片一致（低灰/中橙/高红）
- [ ] plan 修改后前端标签实时更新

### Out of scope
- 不修改后端 API（由 Issue #3 提供数据）
- 不新增页面或路由

### 依赖
- Issue #3（需要后端提供 plan 和 rateLimit 数据）

---

## 依赖关系图

```
Issue #1 ──┐
           ├──► Issue #3 ──► Issue #4
Issue #2 ──┘
```

- **Issue #1** 和 **Issue #2** 可并行开发
- **Issue #3** 依赖 #1 和 #2
- **Issue #4** 依赖 #3
