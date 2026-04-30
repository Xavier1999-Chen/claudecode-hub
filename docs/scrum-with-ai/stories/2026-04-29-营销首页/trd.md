---
type: trd
slug: 2026-04-29-营销首页
version: v2
prd_version: v1
started_at_local: "2026-04-30 09:31:40 Asia/Shanghai"
started_at_utc: "2026-04-30T01:31:40Z"
confirmed_at_local: "2026-04-30 10:43:11 Asia/Shanghai"
confirmed_at_utc: "2026-04-30T02:43:11Z"
notes: |
  v1 假设"同应用部署"，已撤销。v2 按行业标准重写：
  - 独立 Next.js 工程
  - MDX in Git（无外部 CMS）
  - 同仓库新增 marketing/ 目录
---

# TRD · 营销首页（v2）

## 1. 概述

营销站作为**独立 Next.js 工程**部署，与 `src/admin/` 同仓库不同 package。内容用 **MDX 文件**管理，提交进 git；改文案走 PR。

技术栈：Next.js 15（App Router）+ React 19 + Tailwind CSS + MDX + TypeScript（与 Next.js 默认对齐）。Supabase auth 通过 `@supabase/ssr` 集成，用于检测登录态切换 Nav 按钮。

## 2. 涉及模块

### 2.1 新增（独立 Next.js 工程）

```
marketing/
├── package.json                      # 独立依赖（next, react, tailwind, mdx 等）
├── next.config.mjs                   # Next.js 配置 + MDX 集成
├── tailwind.config.ts                # 品牌色 token
├── tsconfig.json                     # TS 配置
├── postcss.config.mjs                # Tailwind / autoprefixer
├── .gitignore                        # node_modules / .next
│
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout：字体、CSS、metadata
│   ├── page.tsx                      # 首页路由 /：组合 MDX + 组件
│   └── globals.css                   # Tailwind imports + brand CSS vars
│
├── content/
│   └── home.mdx                      # 首页全部文案（hero / features / personas / pricing）
│
├── components/
│   ├── MarketingNav.tsx              # 登录态切换「登录」/「控制台」
│   ├── Hero.tsx                      # 主/副标题 + CTA
│   ├── FeatureCards.tsx              # 4 张静态卡
│   ├── PersonaCards.tsx              # 4 画像 + 强度计动画
│   ├── Pricing.tsx                   # 4 档价目
│   ├── BottomCTA.tsx                 # 底部注册 CTA
│   └── MarketingFooter.tsx           # 极简版权
│
├── lib/
│   ├── intensity-gauge/
│   │   ├── IntensityGauge.tsx        # 从 admin 抽出的强度计组件（demo 模式）
│   │   └── math.ts                   # tierProgress / needleAngle / tierFillColor 纯函数（与 admin 同源）
│   └── supabase.ts                   # Supabase client（detect session）
│
└── public/
    └── favicon.svg                   # 品牌图标（与 admin 共用）
```

### 2.2 修改（admin 端，非必须，可后续做）

| 模块 | 文件 | 改动 |
|------|------|------|
| 用量强度视图 | `src/admin/frontend/src/components/UsageIntensityView.jsx` | （**可选**）抽出内部 `Gauge` 函数到 `src/admin/frontend/src/components/IntensityGauge.jsx`，两边代码风格保持一致 |

> 注：admin 抽 IntensityGauge 不是营销页的硬依赖。营销页 `marketing/lib/intensity-gauge/` 自带一份（可允许短期"两边各一份"，未来真要共享时再抽 `packages/`）。

### 2.3 不动

- 后端：`src/admin/index.js`、`src/proxy/*` 全不动
- admin 前端：`src/admin/frontend/src/App.jsx` 不动（路由分流不再需要）
- Express SPA fallback：不动（admin 仍处理 `/api/*` + admin SPA）

## 3. 数据变更

无。营销页不调任何 hub API、不读 `accounts.json`/`terminals.json`、不读 `usage.jsonl`。

## 4. 接口变更

无新增接口。

唯一外部依赖：营销站独立连 Supabase（**只读** session 检测）：
- 用 `@supabase/ssr` 创建 server-side / client-side 双端 client
- 作用范围：`MarketingNav` 检测 `session` 决定显示「登录」or「控制台」按钮 + 控制注册 CTA 显隐
- **不**做注册/登录动作（点 CTA 仍跳现有 admin 的 `/login` `/register` 路径）

## 5. 核心流程

### 5.1 内容渲染（MDX）

```
content/home.mdx
  ├── frontmatter (metadata)
  ├── <Hero title="..." subtitle="..." />
  ├── <FeatureCards items={[...]} />
  ├── <PersonaCards personas={[...]} />
  ├── <Pricing tiers={[...]} />
  └── <BottomCTA />
```

`app/page.tsx` 直接 `import HomeContent from '@/content/home.mdx'`，渲染时 MDX 自动用 `components/` 里的组件。改文案 = 改 mdx = git PR。

### 5.2 登录态切换（Supabase）

```
app/page.tsx (server component)
  ↓ 用 @supabase/ssr 创建 server client
  ↓ getSession() 拿 session（cookie 自动传）
  ↓ session 作为 prop 传给 MarketingNav / Hero / BottomCTA (client components)
  ↓
MarketingNav (client)
  ├── session === null → 渲染「登录」
  └── session !== null → 渲染「控制台」
```

Server-side 拿 session 比 client-side 快（避免首屏闪烁登录态）。

### 5.3 强度计动画

`PersonaCards` 渲染 4 个 `<IntensityGauge mode="demo" lockedTier="light|medium|heavy|xheavy" />`：

- `mode='demo'` 模式：忽略 `usd` prop，根据 `lockedTier` 锁定档位，在该档区间内做 ratio 0→1→0 摆动循环
- 用 `requestAnimationFrame` 单 RAF 驱动 4 个 gauge（避免 4 个独立定时器）
- `prefers-reduced-motion: reduce` → 降级为静态终态（针停在该档末端）

### 5.4 跨应用跳转

营销站 → admin 是普通 HTTP 跳转：
- 「登录」按钮 / 注册 CTA → `<a href="https://app.example.com/login">` / `/register`（具体域名待部署阶段定）
- 「控制台」按钮 → `<a href="https://app.example.com/">`

由于是不同 origin（或子域），没有页内路由概念，全是普通 anchor。

## 6. 依赖关系

Task 维度（详见 §9 拆分）：

```
T1 (Next.js 工程脚手架 + Tailwind + MDX 集成)
  ├─→ T2 (品牌色 + 字体系统)
  ├─→ T3 (布局 layout.tsx + globals.css)
  └─→ T4 (Supabase ssr 集成 + session 检测)
        │
        ↓
T5 (MarketingNav + MarketingFooter)
T6 (Hero)
T7 (FeatureCards)
T8 (Pricing)
T9 (BottomCTA)
T10 (IntensityGauge demo 模式 + PersonaCards)  ← 含强度计移植
T11 (home.mdx 串起所有组件)
T12 (部署配置 + 验收)
```

T1-4 是基础设施，必须先做。T5-10 可并行。T11 集成。T12 收尾。

## 7. 技术风险

| 风险 | 应对 |
|------|------|
| **Next.js 15 App Router + MDX 集成的 type / build 报错** | 用官方 `@next/mdx` plugin，遵循官方文档；锁定 Next.js 版本 ^15 |
| **Supabase session cookie 跨子域识别** | 部署阶段配 `cookie domain` 为父域（如 `.example.com`），让 admin / marketing 共享 session |
| **强度计在 marketing/ 与 admin 端代码漂移** | 数学函数（`tierProgress` / `needleAngle` / `tierFillColor`）抽到独立文件；两端各引用一份；后续可演进为 `packages/intensity-gauge` |
| **MDX 类型提示弱**（自定义组件 props） | 用 `mdx-components.tsx` 显式注册组件类型；TypeScript 严格模式 |
| **品牌字体一致性** | 与 admin 端约定同一字体栈；marketing/ 用 next/font 加载，admin 不变 |
| **部署：Next.js 不能在 Express 同进程跑** | 营销站独立部署（vercel / 自建 node 服务），不与 Express admin 服务进程共享；具体部署拓扑待 §10 |

## 8. 性能影响

- 营销页 SSR / SSG：首屏 < 1s（Next.js + Vercel 标准水平）
- 4 个 SVG 强度计 + RAF 动画：< 1% CPU（与现有 UsageIntensityView 经验一致）
- 营销站 bundle 不影响 admin（不同 app）

## 9. 回滚方案

- 营销站独立部署 → 回滚只需把营销站改回原占位（或下线）；admin 完全不受影响
- 单 issue PR 颗粒度小，每个都能 git revert
- MDX 内容改动是单文件提交，回滚极简

## 10. Open Questions（部署阶段决定）

- [ ] 部署平台：Vercel（最快）vs 自建 ECS 跑 Next.js（数据自留）
- [ ] 域名拓扑：`www.example.com`（营销）+ `app.example.com`（admin）vs 同域不同路径
- [ ] Supabase cookie domain 设置（依赖域名拓扑决定）
- [ ] CI/CD：marketing 工程独立 build 流水线 vs 与 admin 同 pipeline

> 这些都不影响本 Story 的代码实施；部署阶段再讨论（用户已声明）。

---

> v2 框架版。Phase 2 等用户确认方向后，Phase 3 起结合代码细化各模块；Phase 5 拆 issue。
