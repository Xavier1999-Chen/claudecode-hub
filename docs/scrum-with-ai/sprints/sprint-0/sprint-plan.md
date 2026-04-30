---
sprint_id: sprint-0
archive: true
not_counted_for_velocity: true
started_at_local: "2026-04-15 11:25:16 Asia/Shanghai"
started_at_utc: "2026-04-15T03:25:16Z"
end_at_local: "2026-04-26 23:59:59 Asia/Shanghai"
end_at_utc: "2026-04-26T15:59:59Z"
duration_days: 12
goal: "把 claudecode-hub 从一个想法跑到能让多用户实际用上的状态：账号池、终端管理、用量统计、注册登录、接入指南，全跑通"
committed:
  - { type: story, ref: "stories/2026-04-15-认证基础架构" }
  - { type: story, ref: "stories/2026-04-21-QQ邮箱预扫描修复" }
  - { type: story, ref: "stories/2026-04-21-微信浏览器图标修复" }
  - { type: story, ref: "stories/2026-04-21-Auto模式逃离冷却账号" }
  - { type: story, ref: "stories/2026-04-21-OAuth撤销检测" }
  - { type: story, ref: "stories/2026-04-22-中转站fallback账号" }
  - { type: story, ref: "stories/2026-04-22-安装指南tab" }
  - { type: story, ref: "stories/2026-04-23-用量强度视图" }
  - { type: story, ref: "stories/2026-04-24-单一写入者原则" }
  - { type: story, ref: "stories/2026-04-27-聚合卡片完整实现" }
  - { type: story, ref: "stories/2026-04-27-聚合账号虚拟MAX计量" }
definition_of_done: "PR merged to main + 主流程手动验证可用 + 单测全绿（如适用）"
extensions: []
corrections: []
backfilled_at_local: "2026-04-29 10:25:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:25:00Z"
note: |
  这是一个 retro-archive sprint，事后归档 scrum 引入（W18, 2026-04-27）之前的全部产出。
  - 不计 velocity（项目早期速度对未来 sprint 容量规划无参考价值）
  - committed 列表是事后梳理的"应有的承诺"，原始实施时无 sprint 概念
  - PRD/TRD/decisions 全部反向从 PR + 现网代码生成
  - PR #46 / #53 严格说在 W18 Day 1-2 合并，但属于 pre-scrum 聚合账号 epic 的尾声，归此处保持 epic 完整性
---

# Sprint 0 · Pre-Scrum Archive

> 事后归档 sprint。本文件按 scrum 标准 Sprint Planning 的产出格式补完，但内容是**事后**生成 ——
> 真实开发期没有 sprint 框架，没有真正的 planning ceremony。

## Sprint Goal

**让 claudecode-hub 从一个想法跑到能让多用户实际用上的状态。**

具体覆盖：
1. **能用** —— 账号池能正常代理 Anthropic 请求（OAuth pool + 中转站 fallback + 聚合卡片）
2. **可见** —— 用户能看到自己的用量分布；admin 能看到全局账号/终端状态
3. **可信** —— 注册/登录/审批通畅；账号封号/限流时自动绕开
4. **可学** —— 新用户打开面板就能学会怎么接入

如果让一个新人加入团队，他能"读完 hub 的功能页就知道这个产品能做什么"。

## Sprint 时间盒

| 字段 | 值 |
|------|----|
| 起始 | 2026-04-15 11:25 +08（首个 commit） |
| 结束 | 2026-04-26 23:59 +08（W18 启动前夜） |
| 时长 | 12 天 |
| 工作模式 | 单人 + AI 协作；无固定时间盒，按 PR 节奏推进 |

## Committed Stories（11 项）

| Story Slug                            | Epic                  | PR    | Issues               | Notes                              |
|---------------------------------------|-----------------------|-------|----------------------|------------------------------------|
| 2026-04-15-认证基础架构               | auth-onboarding       | -     | -                    | 基础架构期，跨多个早期 commit      |
| 2026-04-21-QQ邮箱预扫描修复           | auth-onboarding       | #7    | #6                   | 验证 token 被扫描器消耗            |
| 2026-04-21-微信浏览器图标修复         | auth-onboarding       | #9    | #8                   | PNG fallback for mobile/WeChat     |
| 2026-04-21-Auto模式逃离冷却账号       | terminal-management   | #11 #18 | #10 #17 #14 #15    | proxy + admin 双层修复             |
| 2026-04-21-OAuth撤销检测              | account-management    | #20   | #19                  | 403 permission_error 自动下线      |
| 2026-04-22-中转站fallback账号         | account-management    | #33   | #32                  | type:'relay' + modelMap            |
| 2026-04-22-安装指南tab                | user-guide            | #31   | #30 #28              | 第 4 个 tab + 三平台教程           |
| 2026-04-23-用量强度视图               | usage-analytics       | #35   | #34                  | 仪表盘 + 热力网格                  |
| 2026-04-24-单一写入者原则             | account-management    | #43   | #42                  | proxy 不再写盘 + 熔断器扩展        |
| 2026-04-27-聚合卡片完整实现           | account-management    | #46   | #45 #44 #38 #21      | W18 transition；多 provider 路由   |
| 2026-04-27-聚合账号虚拟MAX计量        | account-management    | #53   | #51 #49 #47          | W18 transition；MAX 体验伪装       |

## 关键架构沉淀

Sprint 0 期间形成、被 W18 及后续 sprint 继承的核心架构决策：

1. **双服务模型** —— proxy:3180（无状态转发）+ admin:3182（有状态管理 + SPA），见 `CLAUDE.md`
2. **三种账号类型** —— OAuth / Relay / Aggregated，统一路由优先级
3. **单一写入者原则** —— admin 是 JSON 配置的唯一磁盘写入者，proxy 通过 `/_internal/report-*` 上报事件
4. **熔断器** —— 三态（closed/open/half-open），threshold=3，403 permission_error 立即标记 exhausted
5. **Supabase JWT 三层权限** —— null（pending）/ user / admin，`app_metadata.role` 服务端控制
6. **前端 React 19 + Vite 8**，15s 轮询 + 自适应同步

## Capacity Notes

> 事后归档的 capacity reflection。原始实施无显式 capacity 估算。

- **人力**：1 人主开发 + AI 协作
- **每日实际投入**：不固定（兼职 / 业余时间）
- **PR 节奏**：12 天产出 20 PR，平均 1.7 PR/天（有几天密集、几天零产出）
- **节奏特征**：4-21 单日合并 6 PR（QQ邮箱+微信图标+Auto模式 4 个 PR + 早期跨 sprint fix）；其余日期相对稀疏

未来 sprint 估算可参考：1 人 + AI 在已有架构基础上 1-2 周可完成 1-2 个中等 Story（含 PRD/TRD/实施/测试）。

## Definition of Done

每个 committed Story 满足：
- [x] PR merged to main
- [x] 主流程手动跑通（人工验证）
- [x] 单测全绿（如有相关测试）
- [x] 关键决策有 PR 描述记录（事后归档时补到 decisions.md）

注：scrum 标准 DoD 还要求"PO 在 sprint review 接受"，但本归档无真实 review；视为已隐式接受（PR 已 merged 即视为产物被采纳）。

## Stretch Goals

无。Sprint 0 期间所有产出都已在 committed 列表中。

## 不在归档范围

- 文档完善（CLAUDE.md 不计入 epic）
- 测试用例（散落在各 PR）
- 配置/脚本琐碎调整（`.gitignore`、`thinking-strip.js` 删除等）
- 部分前端 polish PR（#1 #2 #4 #5 #13 #25 #27 #37）—— 视为 Story 内附带的小修，未单独立 Story

## 归档执行

- 归档日期: 2026-04-29（W18 Day 3）
- 归档动作:
  - 创建本文件 + W18 standup-log 记录 L1 realignment
  - 创建 10 个 backfill Story 目录（PRD/TRD/tasks/decisions 各 1）
  - 更新 5 个 Epic Member Stories 表
  - 创建 review.md + retro.md
  - 更新 backlog.md Done 段
- 后续: 不再修改本文件；如发现遗漏的 pre-scrum 工作可 append 到对应 epic
