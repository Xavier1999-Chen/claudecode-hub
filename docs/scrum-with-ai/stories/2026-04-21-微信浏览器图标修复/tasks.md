# Tasks · 微信浏览器图标修复

> 事后归档。原始实施未做 task 拆分，按 PR/issue 归纳为单个 Task。

## T1 · 生成 PNG fallback 图标 + 注册 apple-touch-icon
- type: Task
- github: #8
- depends_on: []
- status: done
- pr: #9
- merged_at_utc: 2026-04-21T05:34:05Z

### Goal
从 SVG 生成 3 张 PNG，让微信/iOS/Android 都能拿到正确的品牌图标。

### Acceptance
- [x] `scripts/gen-icons.mjs` 用 `@resvg/resvg-js` 渲染 PNG
- [x] `index.html` 加 `apple-touch-icon` 与 `icon-192` link
- [x] 微信内置浏览器手动验证：tab 显示品牌图标
- [x] iOS / Android "加主屏" 手动验证
