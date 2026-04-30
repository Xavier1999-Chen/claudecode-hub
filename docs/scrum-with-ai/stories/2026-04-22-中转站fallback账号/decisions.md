# Decisions · 中转站 fallback 账号

> 事后归档。原始实施未留 L2 决策记录；此处补一条事后梳理的关键决策点。

---

## 2026-04-22 22:00:00 · relay 优先级硬编码 vs 可配置

### Trigger
PR #33 设计 relay 兜底逻辑时，需要决定 OAuth/relay 顺序是否暴露给 admin 配置。

### Options Considered
- A · 硬编码 warm OAuth > relay > cooling OAuth
  - + 行为可预测，运维心智成本低
  - + 默认对 OAuth 友好（成本/质量更优）
  - - 灵活性差，未来若有"relay 比 OAuth 还稳定"场景需要改代码
- B · 提供配置项（accounts.json 顶层 `fallback_strategy`）
  - + 灵活
  - - 配置错误风险（误把 relay 设为优先 → 烧钱）
  - - 增加测试矩阵

### Decision
选 A。当前业务上 OAuth 是首选，relay 是兜底；硬编码移除一个误配置面。如果未来策略变化，再升级为 B 并加配置校验。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3）
- trd.md：无（事后归档时明确写入 TRD §5）
- 链接：PR #33

> 注：上述决策是事后梳理。原始实施未留 decisions.md。Sprint 0 归档时按代码痕迹还原。
