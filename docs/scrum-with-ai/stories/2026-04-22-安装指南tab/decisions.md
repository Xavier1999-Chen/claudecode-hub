# Decisions · 安装指南 tab

> 事后归档。原始实施未留 L2 决策记录；此处补一条事后梳理的关键决策点。

---

## 2026-04-22 21:53:52 · 内容硬编码 vs CMS / Markdown 加载

### Trigger
设计指南页时需要决定内容怎么管理。

### Options Considered
- A · 内容硬编码在 React 组件中（中文文案直接写代码里）
  - + 实现简单，类型安全
  - + 与代码 review 流程一致（修文档 = 改代码 = 走 PR）
  - - 改文案要重新 build + deploy
- B · 加载本地 Markdown 文件
  - + 文案与代码分离，修改成本低
  - - 需要 markdown parser，bundle 增大
- C · 接 CMS（Strapi / Notion API）
  - + admin 可在线编辑
  - - 引入新依赖 + 服务端管理成本

### Decision
选 A。本阶段用户量不大、内容更新频率低；走 PR 是把"指南内容变化"与"代码变化"放在同一审计链路上，未来出问题可以 git blame。如果将来文案频繁变更或需要非工程师编辑，再升级到 B。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3、§4）
- trd.md：无（事后归档时明确写入 TRD §1）
- 链接：PR #31

> 注：上述决策为事后梳理，原始实施未留 decisions.md。Sprint 0 归档时按代码痕迹还原。
