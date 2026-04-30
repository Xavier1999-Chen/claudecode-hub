---
type: trd
slug: 2026-04-21-微信浏览器图标修复
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 10:00:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T02:00:00Z"
---

# TRD · 微信浏览器图标修复

## 1. 概述

用 `@resvg/resvg-js`（纯 WASM）从 SVG 生成 3 张 PNG，加 apple-touch-icon 和 PNG icon link 让移动端正确加载品牌图标。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| 生成脚本 | `scripts/gen-icons.mjs` | 新增 |
| HTML 头 | `src/admin/frontend/index.html` | 修改（加 PNG link） |
| 静态资源 | `src/admin/frontend/public/icon-180.png` | 新增 |
| 静态资源 | `src/admin/frontend/public/icon-192.png` | 新增 |
| 依赖 | `package.json` | 修改（加 `@resvg/resvg-js` devDependency） |

## 3. 数据变更

仅静态文件，无数据库或 API 变更。

## 4. 接口变更

无。

## 5. 状态一致性

无状态。SVG 改动后人工跑 `node scripts/gen-icons.mjs` 重新生成。

## 6. 依赖关系

- 依赖：`@resvg/resvg-js` —— 选纯 WASM 实现规避 playwright 在无 sudo 环境装不上 `libnspr4` 的问题

## 7. 复用检查

- 复用 vite 已有 public 目录约定
- 复用 npm scripts 框架

## 8. 性能影响

- 每张 PNG ~5-10KB，三张总共 ~30KB 增量
- 浏览器只加载匹配的资源（apple-touch-icon 仅 iOS、icon-192 仅 Android）

## 9. 测试策略

- 手动：微信内置浏览器、iOS Safari "加主屏"、Android Chrome "加主屏"
- 视觉验证：3 张 PNG 在仓库中能预览且与 SVG 视觉一致

## 10. 风险与回滚

- 风险：SVG 后续修改后忘了重跑 gen-icons → PNG 与 SVG 不同步
  - 缓解：README 提示；视觉差异容易被 review 发现
- 回滚：移除 PNG link tag 即可（PNG 文件留在仓库不影响）

## Changelog
- backfill-v1（2026-04-29）从 PR #9 + 现网 scripts/gen-icons.mjs 反向生成
