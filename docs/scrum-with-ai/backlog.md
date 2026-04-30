# Backlog

> Stories + Bugs + 独立 Tasks 按优先级排队。Epic 归属用 `[<epic-slug>]` 标签标注。
> Active = 未进 sprint；In Progress = 当前/最近 sprint 在做；Done = 历史完成。

---

## Active

按优先级降序（P0 最高）。

### P1 · 重要

- 暂无

### P2 · 待评估

- [ ] **403 forbidden / Request not allowed 不触发账号封号检测** `[bug]` `[account-management]` · #54
  - 来自 #21 拆分：原 issue 的 stale plan write-back bug 已由 PR #43 修，剩 403 forbidden 分类未做（按 #21 评论共识：先定安全分类规则再改）
  - 2026-04-27-W18 降级 P1→P2（让位给首页/充值的产品化推进）

- [ ] **多用户共享 Pro 订阅账号容易被 Anthropic 风控封号** `[story]` `[account-management]` · #41
  - 架构议题，需要先调研 Anthropic 风控规则再设计
  - 2026-04-27-W18 降级 P1→P2

### Backlog（无优先级，待 grooming）

- 暂无

---

## In Progress

| Slug / Issue | Type  | Sprint            | Status      |
|--------------|-------|-------------------|-------------|
| #55 营销首页 | story | 2026-04-27-W18    | Committed   |
| #56 用户充值模块 | story | 2026-04-27-W18 | Committed   |
| #40 中转站 thinking block 缺 signature | bug | 2026-04-27-W18 | Committed |
| #57 优化用户使用指南 | story | 2026-04-27-W18 | Committed |

---

## Done (recent)

> 累积满 N 条后归档到 `lessons.md` 或单独 `done-archive/<year>-<quarter>.md`。

| Slug                                  | Type  | Sprint   | Merged   | PR / Notes                              |
|---------------------------------------|-------|----------|----------|-----------------------------------------|
| 2026-04-15-认证基础架构               | story | sprint-0 | 04-20    | 基础架构期，无特定 PR                   |
| 2026-04-21-QQ邮箱预扫描修复           | story | sprint-0 | 04-21    | PR #7 / issue #6                        |
| 2026-04-21-微信浏览器图标修复         | story | sprint-0 | 04-21    | PR #9 / issue #8                        |
| 2026-04-21-Auto模式逃离冷却账号       | story | sprint-0 | 04-21    | PR #11 + #18 / issue #10 #17 #14 #15    |
| 2026-04-21-OAuth撤销检测              | story | sprint-0 | 04-21    | PR #20 / issue #19                      |
| 2026-04-22-中转站fallback账号         | story | sprint-0 | 04-22    | PR #33 / issue #32                      |
| 2026-04-22-安装指南tab                | story | sprint-0 | 04-22    | PR #31 / issue #30 #28                  |
| 2026-04-23-用量强度视图               | story | sprint-0 | 04-23    | PR #35 / issue #34                      |
| 2026-04-24-单一写入者原则             | story | sprint-0 | 04-24    | PR #43 / issue #42                      |
| 2026-04-27-聚合卡片完整实现           | story | sprint-0 | 04-27    | PR #46 / issues #45 #44 #38 #21（W18 transition）|
| 2026-04-27-聚合账号虚拟MAX计量        | story | sprint-0 | 04-28    | PR #53 / issues #51 #49 #47（W18 transition）|