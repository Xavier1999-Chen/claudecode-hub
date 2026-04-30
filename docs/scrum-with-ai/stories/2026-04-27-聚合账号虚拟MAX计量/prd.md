---
type: story
slug: 2026-04-27-聚合账号虚拟MAX计量
title: "聚合账号虚拟 MAX 计量系统"
status: done
version: v3
started_at_local: "2026-04-27 22:47:49 Asia/Shanghai"
started_at_utc: "2026-04-27T14:47:49Z"
confirmed_at_local: "2026-04-27 23:35:08 Asia/Shanghai"
confirmed_at_utc: "2026-04-27T15:35:08Z"
completed_at_local: "2026-04-28 14:47:29 Asia/Shanghai"
completed_at_utc: "2026-04-28T06:47:29Z"
epic_ref: account-management
sprint_refs: []                    # 试运行期间完成，未挂任何正式 sprint
pr_refs:
  - 53                             # 集成 PR (含 #48/#50/#52 的内容)
issue_refs:
  - 47                             # Story Task 1: proxy 记录原始 tier
  - 49                             # Story Task 2: 虚拟利用率计算模块
  - 51                             # Story Task 3: admin 接入虚拟计量 + 等级配置 + 前端伪装
notes: "本 Story 在 scrum-with-ai plugin 启用前完成，回填为试运行成果"
---

# PRD：聚合账号虚拟 MAX 计量系统

> 状态：Draft v3（代码评审后修正版）  
> 作者：Claude  
> 日期：2026-04-27

---

## 1. 背景与目标

### 1.1 背景

claudecode-hub 已支持三种账号类型：OAuth（Anthropic 官方）、Relay（第三方中转）、Aggregated（聚合路由）。

Aggregated 账号可将一个终端 token 按模型 tier 路由到不同上游 provider（如 Opus→Kimi, Sonnet→DeepSeek）。但当前聚合卡片对普通用户暴露了完整的路由明细和 provider 健康状态，无法让用户产生"在使用原生 Anthropic 账号"的感知。

### 1.2 目标

建立一套虚拟计量系统，使聚合账号在普通用户视角下**与原生 Anthropic MAX 订阅账号无感知差异**。

核心用途是**盲测实验**——验证"聚合路由组合是否能让大多数用户感受不出与原生 Claude 模型的区别"。

### 1.3 成功标准

- 普通用户无法通过 UI 区分聚合账号与 OAuth 账号
- 用量体验合理（有上限、会用完、会重置）
- 用完后账号自动移出候选池（有 fallback 时静默切换，无 fallback 时返回 503）

---

## 2. 术语表

| 术语 | 定义 |
|------|------|
| **聚合账号** | `type: 'aggregated'`，多 provider 路由卡片 |
| **原始 tier** | 用户请求中 `body.model` 对应的 tier（opus/sonnet/haiku/image） |
| **目标模型** | 路由后实际转发给 provider 的模型名（如 `kimi-k2.6`） |
| **加权 tokens** | `(input + output) × tierWeight`，用于虚拟利用率计算 |
| **虚拟限额** | 按等级预设的加权 token 上限（与真实 Anthropic 限额解耦） |
| **虚拟利用率** | `加权 tokens / 虚拟限额`，范围 0.0 ~ 1.0+ |
| **等级（plan）** | PRO / MAX / MAX 20x，决定标签和限额 |

---

## 3. 用户故事

### 3.1 Admin：创建带等级的聚合账号

> 作为 Admin，我需要为聚合账号设置一个展示等级，这样普通用户看到的就是一个"MAX 订阅账号"而不是"聚合路由"。

**AC-3.1.1**：创建聚合账号的表单中有"等级"选择器，选项：PRO / MAX / MAX 20x，默认 MAX。  
**AC-3.1.2**：编辑聚合账号时可修改等级，修改后立即生效。  
**AC-3.1.3**：Admin 自己看到的聚合卡片不受伪装影响，始终显示完整路由表和 provider 健康状态。

### 3.2 普通用户：看到订阅账号样式的聚合卡片

> 作为普通用户，我在"账号"tab 中看到的聚合卡片应该和 OAuth 卡片长得一样，不应该有任何聚合/路由/provider 相关的信息。

**AC-3.2.1**：卡片头部显示：昵称 + 等级标签（橙色/红色标签，与 OAuth 卡片样式一致）+ 在线绿点 + 刷新按钮 + 更多按钮。  
**AC-3.2.2**：卡片主体显示：5h 用量条 + 周用量条（不显示 token 刷新倒计时，聚合账号无 OAuth token）。  
**AC-3.2.3**：卡片底部显示：使用该账号的终端标签列表。  
**AC-3.2.4**：**不显示**以下内容：路由明细、provider 名称、provider 健康状态、API key 信息。  
**AC-3.2.5**：用量条的颜色逻辑与 OAuth 卡片一致（低利用率灰色、中等橙色、高利用率红色）。

### 3.3 普通用户：用量随使用增长

> 作为普通用户，我用 Claude Code 发请求后，Dashboard 上的用量条应该上涨，涨的速度和模型有关。

**AC-3.3.1**：发一个 Opus 请求后，5h 用量条增长幅度约为同 token 数 Haiku 请求的 4 倍。  
**AC-3.3.2**：发一个 Sonnet 请求后，5h 用量条增长幅度约为同 token 数 Haiku 请求的 2 倍。  
**AC-3.3.3**：用量条在前端 15s 轮询周期内更新（非实时）。  
**AC-3.3.4**：利用率计算精确到小数点后 2 位（如 `12.34%`）。

### 3.4 普通用户：用量耗尽后账号自动切换

> 作为普通用户，当"我的 MAX 账号"用量用完后，系统应该自动切换到其他可用账号，或者提示我暂时没有可用账号。

**AC-3.4.1**：当 5h 利用率 >= 100% 时，该聚合账号被标记为不可用（`rateLimit.status = 'blocked'`）。  
**AC-3.4.2**：如果配置了 fallback 账号，请求自动路由到 fallback（用户无感知）。  
**AC-3.4.3**：如果没有 fallback 账号，Claude Code 收到 503 `no_account_available`。  
**AC-3.4.4**：窗口重置后，该账号自动恢复为可用状态，请求正常通过。  
**AC-3.4.5**：7d 利用率触顶同样触发账号不可用。

---

## 4. 功能需求（细粒度）

### 4.1 Feature：后台等级配置

#### 4.1.1 数据结构

聚合账号新增字段 `plan`，存储于 `config/accounts.json`：

```json
{
  "id": "acc_xxx",
  "type": "aggregated",
  "nickname": "实验组 A",
  "plan": "max",           // ← 新增，enum: ["pro", "max", "max_20x"]
  "providers": [...],
  "routing": {...}
}
```

**约束**：
- `plan` 缺省值为 `"max"`
- 仅 `type: 'aggregated'` 账号支持 `plan` 字段
- 修改 `plan` 后，已产生的 usage.jsonl 记录不受影响（历史加权 tokens 不变，但新限额立即生效，可能导致利用率突变）

#### 4.1.2 Admin API：创建聚合账号

**Endpoint**：`POST /api/accounts/aggregated`

**Request Body 新增字段**：
| 字段 | 类型 | 必填 | 默认值 | 约束 |
|------|------|------|--------|------|
| `plan` | string | 否 | `"max"` | 必须是 `"pro"` / `"max"` / `"max_20x"` |

**校验逻辑**：
- 非法 plan 值 → 400 `invalid_plan`
- 缺省 → 使用 `"max"`

#### 4.1.3 Admin API：编辑聚合账号

**Endpoint**：`PATCH /api/accounts/:id`

**Request Body 新增字段**：
| 字段 | 类型 | 约束 |
|------|------|------|
| `plan` | string | 同上 |

**行为**：
- 修改 `plan` 后，立即重新计算该账号的虚拟利用率（基于当前 usage.jsonl 数据和新限额）
- 如果修改后利用率 >= 100%，该账号立即进入 blocked 状态

#### 4.1.4 限额映射

| plan 值 | 前端标签文案 | 5h 限额 (weighted) | 7d 限额 (weighted) |
|---------|-------------|-------------------|-------------------|
| `pro` | PRO | 500,000 | 5,000,000 |
| `max` | MAX | 2,500,000 | 20,000,000 |
| `max_20x` | MAX 20x | 12,500,000 | 100,000,000 |

**注意**：限额是加权 token 数，不是原始 token 数。1 个 Opus 请求产生的加权 tokens = `(input + output) × 4.0`。

---

### 4.2 Feature：虚拟用量计量

#### 4.2.1 数据来源

**来源文件**：`logs/<accountId>/usage.jsonl`

**单条记录格式**（新增 `tier` 字段后）：
```json
{
  "ts": 1745779200000,
  "terminalId": "sk-hub-xxx",
  "accountId": "acc_xxx",
  "mdl": "kimi-k2.6",
  "tier": "opus",          // ← 新增
  "in": 1200,
  "out": 3500,
  "usd": 0.0042
}
```

**tier 枚举**：`opus` | `sonnet` | `haiku` | `image`

**缺失 tier 的 fallback**：如果历史记录没有 `tier` 字段，按 `sonnet` 处理（权重 2.0）。

#### 4.2.2 权重表

| tier | 权重 | 依据 |
|------|------|------|
| `opus` | 4.0 | Anthropic pricing 比例的平方根（Opus/Haiku ≈ 18.75x → √≈4.3，取整 4.0） |
| `sonnet` | 2.0 | Sonnet/Haiku ≈ 3.75x → √≈1.9，取整 2.0 |
| `haiku` | 1.0 | 基准线 |
| `image` | 3.0 | 图片处理成本介于 Sonnet 和 Opus 之间 |

#### 4.2.3 计算流程

**输入**：
- `accountId`：聚合账号 ID
- `now`：当前时间戳（ms）

**步骤**：
1. 读取 `logs/<accountId>/usage.jsonl`，逐行解析
2. 过滤时间窗口：
   - 5h 记录：`ts >= now - 5 × 3600 × 1000`
   - 7d 记录：`ts >= now - 7 × 86400 × 1000`
3. 每条记录计算加权 tokens：
   - `weighted = (in + out) × WEIGHT[tier]`
   - 缺失 `in`/`out` → 按 0 处理
4. 分别累加 5h 和 7d 的加权 tokens
5. 读取该账号的 `plan`，获取对应限额
6. 计算利用率：`utilization = weightedTokens / limit`
7. 计算 `resetAt`：
   - 5h：`Math.ceil(now / (5h)) × (5h)`
   - 7d：下周一 00:00 UTC
8. 输出 `rateLimit` 对象

#### 4.2.4 计算结果格式

```json
{
  "rateLimit": {
    "window5h": {
      "utilization": 0.1534,
      "resetAt": 1745808000000,
      "status": "allowed"
    },
    "weekly": {
      "utilization": 0.2847,
      "resetAt": 1746230400000,
      "status": "allowed"
    }
  }
}
```

**status 规则**：
- `utilization < 1.0` → `status: "allowed"`
- `utilization >= 1.0` → `status: "blocked"`

**注意**：利用率允许超过 100%（如 1.234），但 status 统一标记为 `blocked`，与现有 `account-pool.js` 的 `#isCooling()` 检查逻辑兼容。

#### 4.2.5 计算触发时机

| 触发场景 | 频率 | 说明 |
|---------|------|------|
| Admin 主动 sync | 手动 | `POST /api/accounts/:id/sync-usage` |
| 前台自适应轮询 | ~60s | 前端 15s 轮询，4 轮 stale 后触发 `sync-usage-all` |
| 后台健康探测循环 | 每 60s | 复用现有 `probeAllRelays` 循环，顺带计算聚合账号虚拟利用率 |

**说明**：不新增独立定时器。聚合账号的虚拟利用率计算 piggyback 在现有的 60s `probeAllRelays` 循环中。该循环已处理所有 relay/aggregated 账号，扩展它以读取 usage.jsonl 并计算虚拟利用率是最自然的做法。

---

### 4.3 Feature：用量耗尽中断服务

#### 4.3.1 设计原则：Proxy 不做前置检查

**原因**：Proxy 通过 `fs.watch` + **15s polling** 读取 `accounts.json`。Admin 计算虚拟利用率并写入磁盘后，proxy 最多延迟 15s 才能感知。如果在 proxy 层做前置 429 检查：
- 已超限的账号还能继续转发最多 15s
- 已重置的账号还要等 15s 才恢复

这种延迟会让 429 行为既不精确也不及时，反而破坏用户体验。

**决策**：**Proxy 不在 `forwarder.js` 中做前置虚拟 rate limit 检查**。虚拟限流完全由 admin 端驱动。

#### 4.3.2 Admin 端驱动限流

**机制**：
1. Admin 在 `syncRateLimit()` / `probeAllRelays()` 中计算聚合账号虚拟利用率
2. 当 `utilization >= 1.0` 时，在 `rateLimit` 对象中设置 `status: 'blocked'`
3. `rateLimit` 随 `accounts.json` 原子写入磁盘
4. Proxy 的 `AccountPool` 在下一次热重载（最多 15s）后读到新的 `rateLimit`
5. `account-pool.js` 的 `#isCooling()` 检查到 `rateLimit.window5h.status === 'blocked'` 或 `utilization >= 1.0` 时，将该账号视为不可用
6. `selectAccount()` 自动跳过该账号；`selectFallback()` 将其移出候选池

**结果**：终端用户看到的不是 429，而是账号被静默移出——如果还有可用 fallback 账号，请求自动路由过去；如果没有，Claude Code 收到 503 `no_account_available`。

**与真实 Anthropic 的差异**：真实 Anthropic 会在 429 后等待 retry-after。本系统选择**静默降级**而非显式 429，原因是 proxy 层的前置检查有不可接受的延迟（15s）。这是架构约束下的务实取舍。

#### 4.3.3 现有 fallback 逻辑无需改动

`account-pool.js` 的 `selectFallback` 已经将 `type === 'aggregated'` 视为 relay tier。当聚合账号因虚拟限额被标记为不可用时，现有 fallback 链会自动将其跳过并寻找替代账号。**无需新增代码**。

#### 4.3.4 恢复机制

- 窗口重置后，admin 重新计算利用率，`status` 变回 `allowed`
- `accounts.json` 写入后，proxy 热重载自动恢复该账号的可用性
- 无需显式恢复逻辑

---

### 4.4 Feature：聚合卡片前端伪装

#### 4.4.1 渲染切换逻辑

**判断条件**：`user.role !== 'admin' && account.type === 'aggregated'`

**满足条件时**：聚合卡片复用 OAuth 账号卡片的渲染组件和数据结构。

**字段映射**：

| OAuth 卡片字段 | 聚合账号来源 |
|---------------|-------------|
| `email` | `account.nickname`（昵称作为"显示名"） |
| `plan` | `account.plan`（pro/max/max_20x） |
| `status` | `account.status`（idle/exhausted），或当 `rateLimit` 任一窗口 `status === 'blocked'` 时视为不可用 |
| `rateLimit.window5h` | `account.rateLimit.window5h`（虚拟计算） |
| `rateLimit.weekly` | `account.rateLimit.weekly`（虚拟计算） |
| `hasCredentials` | `true`（固定） |
| 终端标签列表 | 现有逻辑不变 |

#### 4.4.2 Admin 视角（不变）

Admin 看到的聚合卡片保持现有渲染：
- 路由明细表（Opus→xxx, Sonnet→xxx）
- Provider 健康状态列表
- 编辑/删除按钮

#### 4.4.3 边界情况

| 场景 | 处理方式 |
|------|---------|
| 聚合账号无 usage.jsonl（新账号） | 利用率显示 0%，用量条为空 |
| 聚合账号 rateLimit 字段缺失 | 利用率显示 0%，用量条为空 |
| 聚合账号 status = 'exhausted' | 显示红色离线状态，无用量条 |
| 普通用户 DevTools 看到 `type: 'aggregated'` | **接受**。盲测不防技术用户，只防普通视觉感知 |

---

## 5. 状态机

### 5.1 聚合账号虚拟限流状态

虚拟限流状态**不体现在 `account.status`**，而是体现在 `account.rateLimit` 对象中：

```
rateLimit.window5h.status
  ├── "allowed"    (utilization < 1.0)
  └── "blocked"    (utilization >= 1.0)

rateLimit.weekly.status
  ├── "allowed"    (utilization < 1.0)
  └── "blocked"    (utilization >= 1.0)
```

**与 `account.status` 的区别**：
- `account.status`：持久状态（`idle` / `exhausted`），由 admin 手动设置或 OAuth 账号的真实事件驱动
- `rateLimit.*.status`：虚拟计算结果（`allowed` / `blocked`），由 `syncRateLimit()` 计算并随 `accounts.json` 写入磁盘

**Proxy 端的感知**：`account-pool.js` 的 `#isCooling()` 检查 `rateLimit.window5h.utilization >= 1.0`，将 blocked 账号视为不可用，从而自动将其移出候选池。

---

## 6. 边界情况与异常处理

| # | 场景 | 预期行为 |
|---|------|---------|
| 1 | usage.jsonl 文件不存在 | 利用率 = 0%，status = allowed |
| 2 | usage.jsonl 中有损坏行 | 跳过损坏行，继续解析后续行 |
| 3 | 记录缺失 `tier` 字段 | fallback 到 `sonnet`（权重 2.0） |
| 4 | 记录 `in`/`out` 为负数或异常值 | 按 0 处理 |
| 5 | plan 被修改为更小的限额（如 MAX 20x → PRO） | 立即重新计算，可能瞬间触发 blocked |
| 6 | 5h 和 7d 同时触顶 | 优先显示 5h 的 blocked 状态（5h 更紧急） |
| 7 | proxy 热重载延迟（accounts.json 已更新但 proxy 未读到） | 接受。AccountPool 有 15s polling fallback，延迟期内该账号仍可能被选中。由于不做 proxy 层前置检查，这是架构约束下的已知行为 |
| 8 | 聚合账号被删除 | 已有终端重新分配逻辑，不受影响 |

---

## 7. 验收标准（可执行 checklist）

### 7.1 等级配置

- [ ] `POST /api/accounts/aggregated` 支持 `plan` 字段，缺省 `"max"`
- [ ] `PATCH /api/accounts/:id` 支持修改 `plan`
- [ ] 非法 `plan` 值返回 400 `invalid_plan`
- [ ] 修改 plan 后，虚拟利用率立即按新限额重新计算
- [ ] Admin 前端编辑弹窗有 plan 下拉选择器

### 7.2 虚拟计量

- [ ] `usage-tracker.js` 记录的 JSONL 包含 `tier` 字段
- [ ] `forwarder.js` 正确传递 `requestedTier` 到 usage tracker
- [ ] 虚拟利用率计算函数能正确读取 JSONL、过滤窗口、加权累加
- [ ] Opus 权重 4.0、Sonnet 2.0、Haiku 1.0、Image 3.0
- [ ] 5h resetAt 为下一个 5 小时整点
- [ ] 7d resetAt 为下周一 00:00 UTC
- [ ] 利用率 < 1.0 时 status = `allowed`
- [ ] 利用率 >= 1.0 时 status = `blocked`

### 7.3 用量耗尽后账号不可用

- [ ] 聚合账号 5h 虚拟利用率 >= 100% 时，`rateLimit.window5h.status = 'blocked'`
- [ ] 聚合账号 7d 虚拟利用率 >= 100% 时，`rateLimit.weekly.status = 'blocked'`
- [ ] `blocked` 状态写入 `accounts.json`，proxy 热重载后该账号被移出候选池
- [ ] 有 fallback 账号时，请求自动路由到 fallback（用户无感知）
- [ ] 无 fallback 账号时，请求返回 503 `no_account_available`
- [ ] 窗口重置后，`status` 恢复为 `allowed`，账号重新进入候选池

### 7.4 前端伪装

- [ ] Admin 视角聚合卡片显示路由明细 + provider 健康
- [ ] 普通用户视角聚合卡片显示与 OAuth 卡片一致的样式
- [ ] 普通用户视角显示等级标签（PRO/MAX/MAX 20x）
- [ ] 普通用户视角显示 5h/周用量条
- [ ] 普通用户视角**不显示**路由明细、provider 名称、provider 健康
- [ ] 普通用户视角**不显示** token 刷新倒计时（聚合账号无 OAuth token）

---

## 8. 非目标（Out of Scope）

| # | 内容 | 原因 |
|---|------|------|
| 1 | OAuth 账号的虚拟计量改造 | OAuth 已有真实 Anthropic headers |
| 2 | Relay 账号的虚拟计量 | 本次仅针对 aggregated 类型 |
| 3 | 虚拟限额与 Anthropic 官方数字完全一致 | 官方数字不公开，自洽即可 |
| 4 | 前端增加"聚合账号伪装开关" | 默认对所有普通用户生效，简化设计 |
| 5 | 防技术用户（DevTools 看到 `type: 'aggregated'`） | 盲测针对普通视觉感知，不防逆向 |
| 6 | 用量预测/预警（如"预计 2h 后用完"） | MVP 范围外 |
| 7 | 按终端粒度展示用量 | 聚合账号级别即可 |

---

## 9. 附录：参考数据

### 9.1 Anthropic 社区估算限额（供参考，非本系统依据）

| 等级 | 社区估算 5h 限额 |
|------|-----------------|
| Pro | ~44K tokens / ~45 messages |
| Max | ~220K tokens / ~900 messages |
| Max 20x | ~220K tokens（但消耗慢 4x）|

> 来源：社区 reverse engineering，Anthropic 官方未确认。
> 本系统使用自洽的虚拟限额，不与官方数字绑定。

### 9.2 权重推导

基于 Anthropic 官方定价（per 1M tokens）：

| 模型 | Input | Output |
|------|-------|--------|
| Opus | $15 | $75 |
| Sonnet | $3 | $15 |
| Haiku | $0.8 | $4 |

Opus/Haiku pricing ratio = 18.75x → √18.75 ≈ 4.3 → **权重 4.0**  
Sonnet/Haiku pricing ratio = 3.75x → √3.75 ≈ 1.9 → **权重 2.0**
