---
type: story
slug: 2026-04-22-安装指南tab
title: "安装指南 tab：admin 面板内嵌 Claude Code 接入教程"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 10:20:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:20:00Z"
started_at_local: "2026-04-22 18:00:00 Asia/Shanghai"
started_at_utc: "2026-04-22T10:00:00Z"
confirmed_at_local: "2026-04-22 21:53:52 Asia/Shanghai"
confirmed_at_utc: "2026-04-22T13:53:52Z"
completed_at_local: "2026-04-22 21:53:52 Asia/Shanghai"
completed_at_utc: "2026-04-22T13:53:52Z"
epic_ref: user-guide
sprint_refs: [sprint-0]
pr_refs: [31]
issue_refs: [30, 28]
notes: "事后归档：scrum 引入前的 PR；PRD/TRD 从 PR #31 + issue #30/#28 + 现网代码反向还原"
---

# PRD · 安装指南 tab

## 1. 背景与目标

新用户拿到 hub 终端 token 之后，常见的下一个问题是"接下来 Claude Code 怎么配置才能连上 hub？"。之前的做法是 admin 在群里贴指令，重复劳动 + 容易过时。

**目标**：在 admin 面板加第 4 个 tab「指南」，内嵌从安装 Claude Code 到配置 hub 连接的图文教程，覆盖 Win / macOS / Linux/WSL2 三平台，含可一键复制的代码块。

## 2. 用户故事

### 2.1 新用户
**故事**：作为新接入 hub 的用户，我希望打开 admin 面板就能看到"如何让我的 Claude Code 连上 hub"的完整步骤。
**验收标准**：
- [x] 第 4 个 tab「指南」可见
- [x] 三平台分卡片（Windows / macOS / Linux/WSL2）
- [x] 每平台有逐步操作 + 代码块 + 代码块右上角"复制"按钮
- [x] 含 FAQ 段（常见问题）

### 2.2 Admin
**故事**：作为 admin，我希望不再需要在群里反复贴接入指令。
**验收标准**：
- [x] 指南内容随产品演进更新（在源码中维护）
- [x] 用户可以自助跑通从安装到第一次成功请求

## 3. 功能需求

- **新 tab 入口**：admin 面板顶部 nav 增加「指南」
- **页面结构**：
  - hero header（一句价值主张 + CTA）
  - 3 列平台卡片（点击切换详情区）
  - 详情区：分步骤 + 代码块（Bash / PowerShell）+ 截图（可选）
  - FAQ（手风琴折叠）
- **可复制代码块**：每个 `<pre>` 块右上角放 "复制" 按钮，点击 navigator.clipboard 写入
- **国际化**：默认中文（用户群体）；不做 i18n 框架（写死中文）

## 4. Out of Scope

- 教 Claude Code 的所有功能（只覆盖"接入 hub"环节）
- 视频教程（纯图文）
- 自动检测用户平台并默认展开（让用户自选，避免误判）

## 5. 边界情况与异常处理

- 用户复制按钮被浏览器阻止（HTTPS 必需）→ 友好降级提示
- 指南内容随版本演进，需要 admin 修改源码后重新构建（不在线编辑）

## 6. 验收标准

- [x] PR #31 merged 2026-04-22T13:53:52Z
- [x] Issue #30 / #28 closed
- [x] 三平台分卡片渲染正确
- [x] 复制按钮在 HTTPS 下工作
- [x] FAQ 折叠交互正常
