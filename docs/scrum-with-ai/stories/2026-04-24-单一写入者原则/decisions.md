# Decisions · 单一写入者原则

> 事后归档。原始实施有 2 处显著决策点（事件 vs 锁、recordFailure 错误分类），均按代码痕迹反向梳理。

---

## 2026-04-24 16:34:53 · 错误分类：哪些计入 recordFailure

### Trigger
熔断器扩展时需要决定哪些 HTTP 错误算作"账号坏了"。

### Options Considered
- A · 一律计数（所有非 200 都 recordFailure）
  - + 简单
  - - 429/529 是临时限流，不是账号问题；网络错误是基础设施
- B · 仅严重错误（400/403非perm/5xx）计数
  - + 精准识别"该账号真的坏了"
  - - 错误分类需要维护
- C · Anthropic-specific 列表（403 permission_error / 401 / 5xx）
  - + 最贴合实际
  - - 与 OAuth 撤销检测重叠（已用 markUnauthorized 处理 403 perm）

### Decision
选 B。429/529/网络错误**不**计 failure，规避临时限流误熔断；403 permission_error 由专门的 markUnauthorized 处理（精确路径），不进熔断器。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3）
- trd.md：无（事后归档时明确写入 TRD §9）
- 链接：PR #43、`circuit-breaker.js` 测试

---

## 2026-04-24 14:30:00 · 单一写入者：HTTP 事件 vs 文件锁

### Trigger
PR #42 起源是双写竞态。设计阶段需要选规避方案。

### Options Considered
- A · 文件锁（lockfile）
  - + 不改架构
  - - WSL2 下 fs 锁行为不一致；Node 单进程内还需要 in-process 锁
  - - 慢路径（每次写盘都要拿锁）
- B · 事件驱动 + 单一写入者（HTTP 上报）
  - + 与现有 admin/proxy 双服务架构契合
  - + 顺带建立"admin 是配置真相"的清晰契约
  - - 多一次 HTTP 调用（loopback）
- C · 合并 admin/proxy 成单进程
  - + 物理上消除双写
  - - 大改造，违背"proxy 无状态、admin 有状态"的原始设计

### Decision
选 B。事件上报与现有架构契合，loopback HTTP 开销可忽略；并且把"谁该写、谁不该写"显式化为契约，CLAUDE.md 文档化后未来不易重蹈覆辙。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3）
- trd.md：无（事后归档时明确写入 TRD §1、§4）
- 链接：PR #43、CLAUDE.md "单一写入者原则" 段

> 注：上述决策为事后梳理，原始实施未留 decisions.md。Sprint 0 归档时按代码痕迹还原。
