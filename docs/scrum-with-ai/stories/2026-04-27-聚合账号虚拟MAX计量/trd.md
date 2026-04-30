---
type: trd
slug: 2026-04-27-聚合账号虚拟MAX计量
version: v1
prd_version: v3
started_at_local: "2026-04-27 23:32:57 Asia/Shanghai"
started_at_utc: "2026-04-27T15:32:57Z"
confirmed_at_local: "2026-04-27 23:35:08 Asia/Shanghai"
confirmed_at_utc: "2026-04-27T15:35:08Z"
---

# TRD：聚合账号虚拟 MAX 计量系统

> 状态：Draft v1
> 作者：Claude
> 日期：2026-04-27
> 前置文档：PRD v3（已确认）

---

## 1. 概述

基于已确认的 PRD，本技术方案为聚合账号（`type: 'aggregated'`）建立虚拟用量计量系统，使聚合账号在普通用户视角下与原生 Anthropic MAX 订阅账号无感知差异。

核心机制：
- Proxy 转发时记录原始 tier 到 usage.jsonl
- Admin 端定时计算加权利用率，写入 `accounts.json` 的 `rateLimit` 字段
- Proxy 热重载后通过现有 `#isCooling()` 机制自动移出超限额账号
- 前端根据用户角色切换聚合卡片的渲染方式

---

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| Proxy - usage 记录 | `src/proxy/usage-tracker.js` | 新增 `tier` 字段 |
| Proxy - 转发 | `src/proxy/forwarder.js` | 传递 `requestedTier`，提取 `body` 作用域 |
| Admin - 虚拟计算 | `src/admin/virtual-ratelimit.js` | **新增模块** |
| Admin - 主服务 | `src/admin/index.js` | 接入虚拟计算、新增 `plan` 字段处理 |
| Admin - 聚合弹窗 | `src/admin/frontend/src/components/AggregatedModal.jsx` | 新增 `plan` 选择器 |
| Admin - 账号列表 | `src/admin/frontend/src/AccountsTab.jsx` | 条件渲染切换 |
| Admin - API 层 | `src/admin/frontend/src/api.js` | 传递 `plan` 参数 |

---

## 3. 数据变更

### 3.1 `config/accounts.json` - 聚合账号新增字段

```json
{
  "id": "acc_xxx",
  "type": "aggregated",
  "nickname": "...",
  "plan": "max",              // ← 新增，enum: ["pro", "max", "max_20x"]
  "providers": [...],
  "routing": {...},
  "rateLimit": {              // ← 新增（由虚拟计算写入）
    "window5h": {
      "utilization": 0.15,
      "resetAt": 1745808000000,
      "status": "allowed"
    },
    "weekly": {
      "utilization": 0.30,
      "resetAt": 1746230400000,
      "status": "allowed"
    }
  }
}
```

**约束**：
- `plan` 缺省 `"max"`
- `rateLimit` 由 admin 计算写入，proxy 只读

### 3.2 `logs/<accountId>/usage.jsonl` - 记录新增字段

```json
{
  "ts": 1745779200000,
  "terminalId": "sk-hub-xxx",
  "accountId": "acc_xxx",
  "mdl": "kimi-k2.6",
  "tier": "opus",             // ← 新增
  "in": 1200,
  "out": 3500,
  "usd": 0.0042
}
```

---

## 4. 接口变更

### 4.1 创建聚合账号

**Endpoint**：`POST /api/accounts/aggregated`

**Request Body 新增字段**：
| 字段 | 类型 | 必填 | 默认值 | 约束 |
|------|------|------|--------|------|
| `plan` | string | 否 | `"max"` | `"pro"` / `"max"` / `"max_20x"` |

**校验**：非法值 → 400 `invalid_plan`

### 4.2 编辑聚合账号

**Endpoint**：`PATCH /api/accounts/:id`

**Request Body 新增字段**：
| 字段 | 类型 | 约束 |
|------|------|------|
| `plan` | string | 同上 |

**行为**：修改后立即重新计算虚拟利用率。

### 4.3 `sanitiseAccount()` 返回字段变更

聚合账号的 `sanitiseAccount()` 输出新增：
- `plan`（前端标签显示）
- `rateLimit`（前端用量条显示）

---

## 5. 核心流程

### 5.1 Proxy 转发时记录 tier

**当前问题**：`forwarder.js` 中 `body` 在 `if (isAggregated)` 块内定义，块外不可见；而 `createUsageTapper` 在块外调用。

**方案**：统一解析 `body` 到函数作用域顶部，同时替代现有的 `detectModel()`：

```js
export async function forwardRequest(...) {
  const isRelay = account.type === 'relay';
  const isAggregated = account.type === 'aggregated';
  let aggregatedProvider = null;

  // 统一解析 body（所有场景都可能用到）
  let body = {};
  let requestedTier = 'sonnet';
  try {
    body = JSON.parse(req.rawBody?.toString() ?? '{}');
    const model = body.model ?? '';
    requestedTier = model.startsWith('claude-opus') ? 'opus'
                  : model.startsWith('claude-sonnet') ? 'sonnet'
                  : model.startsWith('claude-haiku') ? 'haiku'
                  : 'sonnet';
  } catch {
    body = {};
  }

  if (isAggregated) {
    aggregatedProvider = resolveAggregatedProvider(body, account);
    // ...
  }

  // ...

  const model = isAggregated ? aggregatedProvider.targetModel : (body.model ?? 'unknown');
  // 不再需要 detectModel()，body.model 已解析
  const tapper = createUsageTapper({ accountId: account.id, terminalId, model, tier: requestedTier });
}
```

**影响**：
- `detectModel()` 函数可删除（功能被内联替代）
- 非聚合场景下 `body` 也提前解析，无额外开销（原 `detectModel` 同样会解析）
- 异常处理不变：解析失败时 `body = {}`，`requestedTier = 'sonnet'`

### 5.2 Admin 虚拟利用率计算

**写盘策略决策**：`probeAllRelays()` 当前只更新内存缓存（`relayHealthCache`），不写入 `accounts.json`。但聚合账号的 `rateLimit` 必须持久化到磁盘，proxy 才能通过 fs.watch 感知。

**方案**：扩展 `probeAllRelays()`，计算完成后调用 `configStore.writeAccounts(accounts)`。

```
probeAllRelays() 循环（每 60s）
  ├── 读取 accounts.json
  ├── 遍历所有账号
  │   ├── 如果是 relay → probe health（内存缓存）
  │   └── 如果是 aggregated
  │       ├── 调用 virtual-ratelimit.js 计算 rateLimit
  │       └── 写入 acc.rateLimit
  └── 调用 configStore.writeAccounts(accounts) 持久化
```

**计算时机**：
| 触发源 | 频率 | 是否写盘 |
|--------|------|---------|
| `probeAllRelays()` | 60s | ✅ 写盘（主要来源） |
| `POST /api/accounts/:id/sync-usage` | 手动 | ✅ 写盘 |
| `POST /api/sync-usage-all` | ~60s | ✅ 写盘 |
| `PATCH /api/accounts/:id`（plan 修改） | 即时 | ✅ 写盘 |

**写盘开销**：`configStore.writeAccounts` 使用原子 rename，<100KB JSON 文件写盘 <1ms。每 60s 写一次完全可接受。

### 5.3 `virtual-ratelimit.js` 设计（增量读取 + 内存缓存）

```js
// 全局缓存：accountId → { lastOffset, records }
const cache = new Map();

export async function calcVirtualRateLimit(accountId, plan, logsDir) {
  const logPath = join(logsDir, accountId, 'usage.jsonl');
  let state = cache.get(accountId) ?? { lastOffset: 0, records: [] };

  const stats = await stat(logPath).catch(() => null);
  if (!stats) return makeEmptyRateLimit(plan);

  // 文件被截断/重建 → 全量重读
  if (stats.size < state.lastOffset) {
    state = { lastOffset: 0, records: [] };
  }

  // 增量读取新增记录
  if (stats.size > state.lastOffset) {
    const newRecords = await readLinesFromOffset(logPath, state.lastOffset);
    for (const r of newRecords) {
      if (r && typeof r.ts === 'number') state.records.push(r);
    }
    state.lastOffset = stats.size;
  }

  // 清理 7 天外记录（7d 窗口最长）
  const now = Date.now();
  const cutoff = now - 7 * 86400_000;
  state.records = state.records.filter(r => r.ts >= cutoff);
  cache.set(accountId, state);

  // 加权累加
  let weighted5h = 0, weighted7d = 0;
  const fiveHAgo = now - 5 * 3600_000;
  for (const r of state.records) {
    const w = TIER_WEIGHT[r.tier] ?? TIER_WEIGHT.sonnet;
    const tokens = (r.in ?? 0) + (r.out ?? 0);
    const weighted = tokens * w;
    if (r.ts >= fiveHAgo) weighted5h += weighted;
    weighted7d += weighted;
  }

  return makeRateLimit(weighted5h, weighted7d, plan, now);
}
```

**关键设计点**：
- `usage.jsonl` 是只追加文件，天然适合增量消费
- 每次只读取 `lastOffset` 到文件末尾的新增记录
- 内存中只保留 7 天内记录（自动清理过期数据）
- Admin 重启后首次全量读取，之后全部增量
- 文件被截断（如手动清理）时自动全量重读

### 5.4 Proxy 感知账号不可用

```
accounts.json 更新（rateLimit.status = "blocked"）
  → proxy fs.watch / 15s polling 检测到变更
  → AccountPool.reloadAccount() / load()
  → #isCooling() 检查 rateLimit.window5h.utilization >= 1.0
  → 该账号被标记为 cooling
  → selectAccount() / selectFallback() 自动跳过
```

**无新增 proxy 代码**，复用现有热重载和 cooling 机制。

### 5.4 前端渲染切换

```
AccountsTab.jsx
  ├── 遍历账号
  │   └── 如果是 aggregated 且用户不是 admin
  │       └── 渲染 OAuthAccountCard 组件
  │           ├── 显示 plan 标签
  │           ├── 显示 rateLimit 用量条
  │           ├── 不显示 tokenExpiresAt
  │           └── 不显示路由/健康信息
  │   └── 否则（admin 或 OAuth 账号）
  │       └── 保持现有渲染逻辑
```

---

## 6. 依赖关系

```
A. proxy/forwarder.js 提取 body 作用域 + 传递 tier
        │
        ▼
B. proxy/usage-tracker.js 新增 tier 字段
        │
        ▼
C. admin/virtual-ratelimit.js 新增计算模块
        │
        ▼
D. admin/index.js 接入虚拟计算 + plan 字段
        │
        ▼
E. frontend/AggregatedModal.jsx 新增 plan 选择器
        │
        ▼
F. frontend/AccountsTab.jsx 条件渲染切换
```

**说明**：
- A/B 可并行（同属 proxy 层）
- C/D 可并行（同属 admin 后端）
- E/F 可并行（同属前端）
- proxy 层（A/B）和 admin 层（C/D）之间无依赖，可并行
- 前后端之间：D 完成后 E/F 才能完整测试

---

## 7. 技术风险

| # | 风险 | 应对方案 |
|---|------|---------|
| 1 | usage.jsonl 文件过大，读取性能下降 | **方案：增量读取 + 内存缓存**。`usage.jsonl` 是只追加文件，天然适合增量消费。维护 `lastOffset` 状态，每次只读取新增记录；内存中只保留 7 天内的记录。Admin 重启后首次全量读取，之后全部增量。消除性能负债 |
| 2 | `body` 提取到函数作用域影响现有逻辑 | `forwarder.js` 中 `body` 仅在 `isAggregated` 块内使用，提取后不会泄露到非聚合路径。需确保 `resolveAggregatedProvider` 的异常处理不受影响 |
| 3 | `rateLimit` 字段与 OAuth 账号的 `rateLimit` 格式不一致 | OAuth 的 `rateLimit` 由 Anthropic headers 生成（`window5h.used/limit` 等），聚合账号的 `rateLimit` 由虚拟计算生成（`window5h.utilization` 等）。两者字段结构不同，但前端用量条组件需兼容两种格式 |
| 4 | 虚拟利用率突变（plan 修改时） | 修改 plan 后立即重新计算，可能导致利用率从 30% 跳到 90%。这是预期行为，用户修改 plan 时应知晓 |
| 5 | 无 fallback 时聚合账号不可用导致 503 | 与现有 cooling 机制行为一致。用户看到的是"没有可用账号"，不是明确的"用量用完"。这是架构约束下的已知 trade-off |

---

## 8. Out of Scope（技术层面）

| # | 内容 | 原因 |
|---|------|------|
| 1 | Proxy 层前置 429 检查 | 15s polling 延迟使 429 行为不精确，已由 admin 驱动 + 热重载替代 |
| 2 | 新增后台定时器 | 复用现有 60s `probeAllRelays` 循环 |
| 3 | Relay 账号虚拟计量 | PRD 明确排除 |
| 4 | OAuth 账号改造 | 保持现有真实 headers |
| 5 | 用量预测/预警 | PRD 明确排除 |
