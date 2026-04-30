# Tasks · 营销首页

> 用户决定：**整个 Story 收在 1 个 GitHub issue + 1 个 PR**。
> TRD 内部 12 个逻辑 Task 作为该 issue 的 acceptance checklist 内嵌；不再拆分为多个 issue。

---

## T1 · 营销首页（整体交付）
- type: Story
- github: #58
- depends_on: []
- status: in-review
- pr: #60
- merged_at_utc: -

### Goal

按 PRD `docs/scrum-with-ai/stories/2026-04-29-营销首页/prd.md`，在 `marketing/` 目录下交付独立的 Next.js 营销站，覆盖 7 段页面 + 强度计动画 + 登录态切换 + 4 档定价。内容由 MDX 管理。

### Design

详见 TRD `trd.md`。技术拓扑：
- 同仓库新增 `marketing/` 目录
- 独立 Next.js 15 工程（App Router + TS + Tailwind + MDX）
- 内容 = `content/home.mdx` 文件
- 登录态 = `@supabase/ssr` server-side getSession

### Acceptance（含 12 个内部里程碑 checklist）

**基础设施（T1-T4 内部里程碑）：**
- [ ] T1 · `marketing/` 工程脚手架：Next.js 15 + TS + Tailwind + MDX 集成完成；`npm run dev` 可启动
- [ ] T2 · 品牌色 token + 字体系统：`tailwind.config.ts` 写入 `#E87040 / #1C1917 / #F4F1EB`；选定字体并通过 `next/font` 加载
- [ ] T3 · `app/layout.tsx` + `globals.css`：root layout 设字体 + 全局 CSS；与 admin 风格视觉一致
- [ ] T4 · `lib/supabase.ts`：Supabase server / client 双端实例；server-side `getSession()` 在 `app/page.tsx` 拿到登录态

**Section 组件（T5-T10 内部里程碑）：**
- [ ] T5 · `MarketingNav` + `MarketingFooter`：登录态切「登录」/「控制台」；Footer 极简版权
- [ ] T6 · `Hero`：主标题"共享账号池，让 Claude Code 既好用又划算" + 副标题 + 主/次 CTA；登录态隐藏注册 CTA
- [ ] T7 · `FeatureCards`：4 张静态卡（共享账号池 / 实时使用强度 / 阶梯月结 / 自动调度免封号）
- [ ] T8 · `Pricing`：4 档价目（¥20 / ¥150 / ¥900 / ¥1500）+ 30 天周期说明；不暴露美金阈值
- [ ] T9 · `BottomCTA`：底部注册按钮；登录态隐藏
- [ ] T10 · `IntensityGauge` 移植 + `PersonaCards`：从 admin 移植 Gauge + 加 `mode='demo'` props；4 个画像 × 4 个动画 gauge；`prefers-reduced-motion` 降级

**集成与上线（T11-T12 内部里程碑）：**
- [ ] T11 · `content/home.mdx`：所有 section 用 `<Hero/>` `<FeatureCards/>` 等 MDX 组件串起来；改文案 = 改单文件
- [ ] T12 · 部署配置 + 验收：`marketing/` 独立 build 跑通；按 PRD §6 验收 checklist 逐项过

**全局验收（来自 PRD §6.8）：**
- [ ] 1280px 桌面分辨率渲染无横向滚动
- [ ] 未登录访客访问 `/` Nav 右上角是「登录」
- [ ] 已登录用户访问 `/` Nav 右上角是「控制台」+ 注册 CTA 全隐藏
- [ ] 「登录」跳 `/login`；「控制台」跳 admin 主页
- [ ] 所有按钮 / 链接有可读 aria-label

### Out of scope

- 部署平台选型（Vercel vs ECS）+ 域名拓扑 + Cookie domain 配置 → 部署阶段单独讨论（见 TRD §10）
- 移动端适配
- 博客 / changelog
- 多语言 / SEO 深度优化 / A/B 测试 / 埋点

### 依赖

- PRD（已 confirmed）：`docs/scrum-with-ai/stories/2026-04-29-营销首页/prd.md`
- TRD v2：`docs/scrum-with-ai/stories/2026-04-29-营销首页/trd.md`
- 后端不动；admin 前端可选改（抽 IntensityGauge 不强制本 Story 做）
