# Decisions · 聚合账号虚拟 MAX 计量系统

> 中途决策日志（plugin `CLAUDE.md` 第 7 节 L2 capture）。新条目追加到顶部（chronological reverse）。
>
> 本 Story 的所有决策**回填于 plugin 启用前**，时间戳来自 commit / PR / 文件 mtime。

---

## 2026-04-28 14:30 +0800 · proxy `mergeFromDisk` 对聚合账号信任磁盘

### Trigger
验收期发现：admin 用新固定窗口算法重算虚拟利用率写盘 0%，但 proxy 内存仍 cooling 114%，导致 `#pickManual` 仍走 fallback → 503。复盘发现 `mergeFromDisk` 无差别保留 `mem.rateLimit` 是 OAuth 设计，对聚合账号反而**丢弃 admin 最新写入**。

### Options Considered
- A · 全局信任磁盘（全账号类型不再 preserve in-memory rateLimit）
  - + 简单
  - - OAuth 响应头比 admin 探测频率高，会变慢
- B · 按账号类型区分：OAuth 保留内存，relay/aggregated 信任磁盘
  - + 各账号类型语义对齐
  - - 代码增加分支
- C · proxy 也对聚合账号定时 syncRateLimit
  - + 自洽
  - - 复杂度高，与"单一写入者原则" PR #43 冲突

### Decision
B。理由：聚合账号的 rateLimit **只有 admin 写**，proxy 永远不更新它，"保留内存"在语义上就是错的；OAuth 的优化保留。
拍板：人类（PO + Developer 架构）。

### PRD/TRD 是否更新
- prd.md: no（PRD 是产品视角，此为实现细节）
- trd.md: yes（v2，但本 Story 已 done，未真改 v 号；记录于此供未来参考）
- 落地 commit: `7727af1`

---

## 2026-04-28 12:30 +0800 · 5h 窗口由滑动改为固定（UTC 边界对齐）

### Trigger
用户报"时间到了用量没有重置"。复盘：`calcVirtualRateLimit` 用 `now - 5h` 滑动窗口累加 token，但 UI 显示的 `resetAt` 是固定 UTC 5h 边界（`Math.ceil(now / 5h) * 5h`）。语义不一致 → 边界过后利用率不归零。

### Options Considered
- A · 全 sliding window（计算 + UI 都用 `now - 5h`）
  - + 简单一致
  - - 用户预期"reset 后归零"无法满足
- B · 全 fixed window（计算 + UI 都用 `floor(now/5h)*5h`）
  - + 与 Anthropic 官方 ratelimit 头 + UI 一致；reset 后归零符合预期
  - - 边界跳变，利用率会突变（这也是 Anthropic 实际行为）
- C · 5h fixed / 7d sliding 混合
  - + 各取所长
  - - 语义复杂，文档负担

### Decision
B。理由：与 Anthropic 实际计量 + UI 显示对齐，是用户预期；7d 同样改成"本周一 00:00 UTC 起"固定窗口。
拍板：人类。

### PRD/TRD 是否更新
- prd.md: no（PRD 第 6 节边界条件本来就是固定窗口语义，是 TRD 实现错了）
- trd.md: yes（v2 校正，但本 Story 已 done）
- 落地 commit: `7727af1`

---

## 2026-04-28 11:00 +0800 · 不可用账号下所有终端无条件逃逸（含 manual + 已 cooling 状态）

### Trigger
用户报："聚合账号 cooling 后，挂在它底下的终端不会自动切到其它卡片"。复盘发现两层问题：
1. `probeAllRelays` 只在 transition 瞬间 reassign（已 cooling 的不触发）
2. reassign 一直用 `['auto']` 过滤，manual 永远不动

用户原话："只要账号不能用，不管是不是手动模式，底下的终端都要自动逃逸，这个 bug 来来回回都修多少次了"。

### Options Considered
- A · 保留 #17 设计（auto 迁，manual 不动）+ 仅修 transition bug
  - + 与原 #17 acceptance 一致
  - - 不满足用户当前需求
- B · 改设计：所有 mode 在不可用时都迁
  - + 满足明确需求
  - - 修改 #17 既有约定
- C · 仅聚合账号语义改（虚拟限额 = admin 策略闸门，强制迁）；OAuth 保 #17 行为
  - + 语义有理由
  - - 增加分支复杂度

### Decision
B。理由：用户明确表态优先于 #17 历史约定；manual pin 在不可用账号上没意义。同时修 transition bug，去掉每轮 transition 判定，改"每轮无条件 reassign cooling/exhausted 账号"。
拍板：人类。

### PRD/TRD 是否更新
- prd.md: yes（PRD 4.4 节扩充"不可用账号下所有终端无条件逃逸"）
- trd.md: yes
- 落地 commit: `0dd2121`

---

## 2026-04-28 10:30 +0800 · proxy `#pickManual` 加 cooling fallback

### Trigger
连同上一条的根因：proxy 端 `#pickManual` 只查熔断器不查 cooling，`selectFallback` 把 relay/aggregated 当"绝对兜底"硬塞 → admin 60s 轮询前的窗口期内，请求一路放行到已 blocked 的聚合账号。

### Options Considered
- A · 直接 503 拒绝（pinned 账号 cooling 时拒服务）
  - + 立即反馈用户该账号失效
  - - 没有 fallback 路径，可能整体不可用
- B · selectFallback 找温账号（cooling 时也走 fallback）
  - + 自动切换，用户无感
  - - 可能 silently 把流量转到性能较差账号
- C · 降级提示 + fallback
  - + 最优 UX
  - - 需前端配合，scope 远超本 Story

### Decision
B。理由：admin 端的 reassign 60s 轮询有窗口期，proxy 必须自己兜底；找不到温账号时再 503。同时让 `selectFallback` 对 relay/aggregated 也过滤 cooling（不再无脑兜底）。
拍板：人类。

### PRD/TRD 是否更新
- prd.md: yes（PRD 4.4 与上条合并）
- trd.md: yes
- 落地 commit: `0dd2121`

---

## 2026-04-28 09:30 +0800 · `virtual-ratelimit` 按 accountId 串行化（防并发重复累加）

### Trigger
代码 review 时识别隐患：`calcVirtualRateLimit` 在两个 await 之间没有原子性，`probeAllRelays`（60s）+ 用户手动 ↻ + `/api/sync-usage-all` 三个 caller 可能并发调用，导致同一 lastOffset 被两个 caller 各自读取并 push，**state.records 翻倍 → 利用率翻倍**。

### Options Considered
- A · 不修（认为生产中不会触发）
  - + 零代码改动
  - - 一旦触发数据就被污染，难调试
- B · 按 accountId 维护 promise 队列，串行化执行
  - + 简单可靠
  - - 略微串行化（同账号操作变顺序）
- C · 引入读写锁
  - + 并发性更好
  - - 复杂度高，本场景不需要

### Decision
B。加并发回归测试（10 个并发 calc 应得到完全一致的利用率，任一 > 预期即视为重复累加）。
拍板：人类。

### PRD/TRD 是否更新
- prd.md: no（实现细节，PRD 不感知）
- trd.md: yes
- 落地 commit: `70a176a`

---

## 2026-04-28 06:00 +0800 · SSE 解析兼容 `data:` 冒号后无空格

### Trigger
聚合账号配置上线后，所有请求 `[fwd] 200`，但 `usage.jsonl` 始终不增长。debug 后发现：DeepSeek/Kimi 等 Anthropic 兼容中转返回的 SSE 是 `data:{...}`（**冒号后无空格**），而 `usage-tracker.js` 用 `'data: '` 严格前缀匹配 → 所有事件被跳过 → `inTok/outTok` 始终为 0 → `writeUsage` 命中"两者都为 0"守卫直接 return → 聚合账号永远无法记录用量。

### Options Considered
- A · 一行修复：`startsWith('data:')` 后按 SSE 规范跳过可选前导空格
  - + SSE 标准本身允许两种格式（[whatwg HTML spec on Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)）
  - - 没有
- B · 正则匹配两种
  - + 显式
  - - 比 A 复杂
- C · 两种都识别但记 warning（提示上游格式不规范）
  - + 可观测性
  - - 实际两种都合规，warning 是误导

### Decision
A。最小化改动 + 加回归测试（覆盖 `data:{...}` 无空格格式）。
拍板：人类。

### PRD/TRD 是否更新
- prd.md: no
- trd.md: no（这是上游格式适配，不算技术方案变更）
- 落地 commit: `7f05d82`

---

## 2026-04-28 05:00 +0800 · ReferenceError + 恢复聚合账号健康探测

### Trigger
`feat/aggregated-virtual-max-integration` 集成后转发完全不通。复盘：`aggregated-router.js` 的 `model` 变量被声明在 `else` 块内（块级作用域），但在 `resolvedTier` 的三元链中 `else` 块外引用 → 所有非图片聚合请求 ReferenceError。同时 `probeAllRelays` 取消了健康探测分支。

### Options Considered
仅 1 个修复方案，无 trade-off：把 `const model` 声明提到 `else` 之外 + 恢复 `probeAndCacheRelay` 调用。

### Decision
直接修。不计 L2 决策（无方案选型），但本 Story 的 commit history 留痕。
落地 commit: `41df1f3`
