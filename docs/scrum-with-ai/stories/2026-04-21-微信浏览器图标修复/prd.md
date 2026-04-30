---
type: story
slug: 2026-04-21-微信浏览器图标修复
title: "微信浏览器图标修复：移动端 PNG fallback 让品牌图标正确显示"
status: done
version: backfill-v1
backfilled_at_local: "2026-04-29 10:00:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:00:00Z"
started_at_local: "2026-04-21 13:00:00 Asia/Shanghai"
started_at_utc: "2026-04-21T05:00:00Z"
confirmed_at_local: "2026-04-21 13:34:05 Asia/Shanghai"
confirmed_at_utc: "2026-04-21T05:34:05Z"
completed_at_local: "2026-04-21 13:34:05 Asia/Shanghai"
completed_at_utc: "2026-04-21T05:34:05Z"
epic_ref: auth-onboarding
sprint_refs: [sprint-0]
pr_refs: [9]
issue_refs: [8]
notes: "事后归档：scrum 引入前的 PR；PRD/TRD 从 PR #9 + issue #8 + 现网代码反向还原"
---

# PRD · 微信浏览器图标修复

## 1. 背景与目标

桌面浏览器看到的橙色星号 favicon，在**手机微信内置浏览器**变成绿色方块 + 'T' 字 —— 微信拿不到合适的图标资源，自动按页面标题（"Tertax - claudecode-hub"）哈希了一个 fallback 图标。

`index.html` 只声明了 SVG favicon：
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

WeChat 内置浏览器对 SVG favicon 支持不可靠，没有 PNG fallback、也没有 `apple-touch-icon`。

**目标**：从 SVG 渲染 3 张 PNG（iOS / Android / 通用 fallback），让微信、iOS Home Screen、Android 等场景都显示正确的品牌图标。

## 2. 用户故事

### 2.1 微信用户
**故事**：作为通过微信打开 hub 的用户，我希望浏览器 tab 上的图标是 hub 的品牌图标，而不是奇怪的绿方块。
**验收标准**：
- [x] 微信内置浏览器打开 hub 后 tab 显示橙色品牌图标
- [x] 通过微信"打开浏览器"也能保留品牌

### 2.2 iOS / Android 用户
**故事**：作为把 hub 加到主屏幕的移动端用户，我希望主屏图标也是品牌图标。
**验收标准**：
- [x] iOS Safari "添加到主屏" 显示 180×180 品牌图标
- [x] Android Chrome 添加到主屏显示 192×192 品牌图标

## 3. 功能需求

- **生成脚本**：`scripts/gen-icons.mjs` —— 一次性脚本，用 `@resvg/resvg-js`（纯 WASM，零系统依赖）从 `public/favicon.svg` 渲染 3 张 PNG：
  - `icon-180.png` —— iOS apple-touch-icon
  - `icon-192.png` —— Android Chrome
  - 其它 PNG 作为通用 fallback
- **index.html 注册**：
  - `<link rel="apple-touch-icon" href="/icon-180.png" />`
  - `<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />`
  - 保留原 SVG link 作为现代浏览器优先项
- **构建集成**：脚本在 `npm run build` 前可手动跑（一次性，PNG 提交到仓库）

## 4. Out of Scope

- favicon.ico（multi-size）—— 现代场景已不必要，仅 IE 老版本需要
- 完整 PWA manifest.json 配置 —— 本次只解决图标显示
- 自动化 CI 重生成图标（`@resvg` 装上以后 dev 手动跑即可）

## 5. 边界情况与异常处理

- `@resvg` 在某些环境（无 sudo + libnspr4 缺失）装不上 → 选用纯 WASM 实现规避
- SVG 改了但忘了重跑 gen-icons → PR review 检查 + commit 时观察 PNG 是否同步更新

## 6. 验收标准

- [x] PR #9 merged 2026-04-21T05:34:05Z
- [x] Issue #8 closed
- [x] 手动：微信内置浏览器打开 → 看到品牌图标（不是绿方块）
- [x] 手动：iOS 加主屏 → 看到 180px 图标
- [x] 手动：Android Chrome → 看到 192px 图标
