# Decisions · 聚合卡片完整实现

> 事后归档。原始实施未留 L2 决策记录；此处补 2 条事后梳理的关键决策点。

---

## 2026-04-27 21:25:46 · 路由策略：4 层固定 tier vs 可扩展规则引擎

### Trigger
设计聚合卡路由时，需要选"按模型 tier 静态映射"还是"用户自定义规则匹配"。

### Options Considered
- A · 4 层固定 tier（opus/sonnet/haiku/image）
  - + 简单，配置项有限
  - + 与 Claude 模型层级直接对应
  - - 不能表达复杂规则（如"长上下文走 X，否则走 Y"）
- B · 通用规则引擎（match 条件 → action）
  - + 灵活
  - - admin 配置成本高
  - - 测试矩阵爆炸

### Decision
选 A。当前用户场景就是"不同 tier 走不同 provider"，4 层覆盖 95% 场景；image 单独成层因为不同 provider 对图片支持差别大。如果后续出现"按 max_tokens 长度路由"等需求，再升级到 B。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3）
- trd.md：无（事后归档时明确写入 TRD §1）
- 链接：PR #46

---

## 2026-04-27 19:00:00 · 嵌套图片检测：递归扫描 vs 仅顶层

### Trigger
Claude Code 实际发请求时图片可能嵌在 `tool_result.content` 里，不是消息顶层。

### Options Considered
- A · 仅检查 messages[].content[] 顶层
  - + 实现简单
  - - Claude Code 工具回调嵌套图片漏检 → 错路由
- B · 递归扫描所有 content 节点
  - + 兼容工具回调
  - - 略复杂，需注意循环引用（实际不会，但要写测试）

### Decision
选 B。Claude Code 是 hub 主要客户端，工具调用是高频场景。`hasImageContent` 实现递归 + 单测覆盖嵌套层级。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3、§5）
- trd.md：无（事后归档时明确写入 TRD §9）
- 链接：PR #46、`aggregated-router.js` 测试

> 注：上述决策为事后梳理，原始实施未留 decisions.md。Sprint 0 归档时按代码痕迹还原。
