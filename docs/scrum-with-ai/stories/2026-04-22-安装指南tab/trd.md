---
type: trd
slug: 2026-04-22-安装指南tab
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 10:20:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:20:00Z"
---

# TRD · 安装指南 tab

## 1. 概述

前端纯增加：admin 面板顶部 nav 加「指南」tab，进入展示 hero + 3 平台卡片 + FAQ。所有内容以 React 组件形式硬编码（中文）。后端零改动。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| 指南 tab 容器 | `src/admin/frontend/src/GuideTab.jsx` | 新增 |
| 平台卡片组件 | `src/admin/frontend/src/guide/PlatformCard.jsx` | 新增 |
| 步骤组件 | `src/admin/frontend/src/guide/StepBlock.jsx` | 新增 |
| 复制按钮 | `src/admin/frontend/src/guide/CopyableCode.jsx` | 新增 |
| FAQ 组件 | `src/admin/frontend/src/guide/FAQ.jsx` | 新增 |
| App nav | `src/admin/frontend/src/App.jsx` | 修改（加第 4 个 tab） |

## 3. 数据变更

无。

## 4. 接口变更

无。

## 5. 状态一致性

无状态。FAQ 折叠状态用 React local state。

## 6. 依赖关系

- 依赖：navigator.clipboard API（要求 HTTPS）
- 依赖：现有 admin 面板 nav 框架

## 7. 复用检查

- 复用现有 Tailwind 风格 + 配色
- 复用现有 nav 组件结构

## 8. 性能影响

- 静态组件，零数据请求
- bundle size 增加 ~20KB（纯文案 + 组件）

## 9. 测试策略

- 手动：三平台卡片切换正确
- 手动：复制按钮在 HTTPS 下成功写入剪贴板
- 手动：FAQ 折叠交互
- 视觉验收：与品牌色 #E87040 / #1C1917 / #F4F1EB 一致

## 10. 风险与回滚

- 风险：内容过时（Claude Code 安装命令变化）→ 文档放源码内，源码 review 时同步更新
- 风险：HTTP 部署下复制按钮失效 → 加降级提示
- 回滚：单 PR commit revert，移除第 4 个 tab

## Changelog
- backfill-v1（2026-04-29）从 PR #31 + 现网 GuideTab 反向生成
