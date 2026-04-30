# Decisions · OAuth 撤销检测

> 事后归档。原始实施未留 L2 决策记录；此处补一条事后梳理的关键决策点。

---

## 2026-04-21 21:02:47 · permission_error 用 type 精确匹配 vs message 模糊匹配

### Trigger
PR #20 实施时需要决定如何识别撤销错误。Anthropic 返回的 403 body 同时含 `error.type` 和 `error.message`。

### Options Considered
- A · 精确匹配 `error.type === 'permission_error'`
  - + 接口契约稳定，message 改文案不影响检测
  - - 若 Anthropic 启用其它子类型（如 `org_disabled`）需要扩展
- B · 模糊匹配 `message.includes('OAuth authentication is currently not allowed')`
  - + 直观
  - - 文案变化时立刻失效

### Decision
选 A。`type` 是 Anthropic API 公开契约的一部分，比 message 文案稳定。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3）
- trd.md：无（事后归档时明确写入 TRD §10 风险段）
- 链接：PR #20

> 注：上述决策是**事后梳理**，原始实施未留 decisions.md。Sprint 0 归档时按代码痕迹还原。
