# Decisions · 微信浏览器图标修复

> 事后归档。原始实施未留 L2 决策记录；此处补一条事后梳理的关键决策点。

---

## 2026-04-21 13:34:05 · 选用 @resvg/resvg-js（WASM）vs sharp/playwright 渲染 SVG

### Trigger
需要从 SVG 渲染 PNG。Node 生态有多个选项。

### Options Considered
- A · `@resvg/resvg-js`（纯 WASM）
  - + 零系统依赖，所有平台一致
  - + WSL2 / 无 sudo 环境也能装
  - - 渲染速度比原生 sharp 略慢（但本场景一次性脚本无所谓）
- B · `sharp`（原生 libvips）
  - + 性能强
  - - 平台特定二进制，部分环境装不上
- C · `playwright` 截图
  - + 灵活
  - - 依赖 chromium + libnspr4 等系统库，装不上的概率高

### Decision
选 A。本场景是一次性脚本（开发者本地手动跑），性能不是关键；而装不上的痛苦 >> 渲染速度。WASM 实现的"零依赖"价值最大。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3）
- trd.md：无（事后归档时明确写入 TRD §6）
- 链接：PR #9、`scripts/gen-icons.mjs`

> 注：上述决策为事后梳理，原始实施未留 decisions.md。Sprint 0 归档时按代码痕迹还原。
