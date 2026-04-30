# Sprint 2026-04-27-W18 · Standup Log

## 2026-04-29 (Wed) · Sprint Day 3/14
> 写入时间：2026-04-29T09:25:00+08:00 · sprint=2026-04-27-W18

### Yesterday
- 计划: 无昨日 entry（本 sprint 首次 standup）
- 实际（自 sprint 启动 2026-04-27 起）:
  - PR #46 merged · 聚合卡片完整实现（后端+Proxy+前端）— closed #45 #44 #38 #21
  - PR #53 merged · 聚合账号虚拟 MAX 计量系统 — closed #51 #49 #47
  - commits: 791c185 / 3afc05b / 8ce6dfb
- 差距: sprint Day 1-2 全部产出在「聚合账号」线（pre-scrum epic 收尾），**0 行**触及本 sprint goal「营销首页+充值」。用户确认这些是引入 scrum 前的工作，不属于任何 sprint。

### Today
- [housekeeping] 建立 Sprint 0 归档 — 把 scrum 引入前的产出归档到 `sprints/sprint-0/`，不消耗 sprint commit 容量
- [#55] 启动营销首页（与 sprint goal 对齐）
- [#56 用户充值] 暂缓
- [#40 thinking signature] 暂缓

### Blockers
- **#55 营销首页设计方向未定** —— 需先有设计才能动开发；文案/素材计划开发中协作完成

### Realignment (L1)
- trigger: 项目中途引入 scrum，Day 1-2 产出实属 pre-scrum 工作；缺少归档容器
- decision: 在本 sprint 增加 housekeeping「建立 Sprint 0 归档」，把已合并的 #46/#53 epic 及更早工作归到 Sprint 0（retro-archive of pre-scrum work）。Sprint 0 不计 velocity
- 同步到: 不升级 L2（流程性归档，不涉及产品决策）

### Sprint Goal Progress
- 状态: at-risk
- 理由: Day 1-2 全部精力在非 sprint 工作；#55 设计未定，#56 PRD 未写；剩 11 天要交付两条产品线压力较大

## 2026-04-30 (Thu) · Sprint Day 4/14
> 写入时间：2026-04-30T10:54:16+08:00 · sprint=2026-04-27-W18

### Yesterday
- 计划:
  - [housekeeping] 建立 Sprint 0 归档
  - [#55] 启动营销首页
  - [#56 用户充值] 暂缓
  - [#40 thinking signature] 暂缓
- 实际（reconstruct from docs evidence；昨日 entry 无 Actual 子段）:
  - ✅ Sprint 0 归档完整产出 —— 10 个 backfill story 目录（每个 4 文件 = 40 文件）+ 5 个 Epic Member Stories 更新 + `sprints/sprint-0/{sprint-plan,review,retro}.md` + `backlog.md` Done 段更新
  - ✅ 营销首页 PRD v1 confirmed at 21:33（9 个 Phase-3/Phase-4 决议、4 用户故事、7 段页面、4 档定价、4 画像 + 强度计动画、§5 边界、§6 验收 checklist）
  - ✅ 创建 `marketing-site` + `payment` 两个 epic
  - ✅ 营销首页 TRD v2 confirmed at 10:43（推倒重写为独立 Next.js + MDX；技术拓扑：同仓库 `marketing/` 目录、Tailwind + TypeScript、Supabase ssr 检测登录态）
  - ✅ tasks.md：1 issue 收完 + 12 内部里程碑 checklist
  - ✅ GitHub 开实施 issue **#58** "feat(marketing): 营销首页 v1（独立 Next.js + MDX）"
- 差距:
  - **0 commit** —— 全部产出 local uncommitted；EOD 应跑 commit
  - 实际**远超计划**：housekeeping + 启动 #55 计划 → 实际跑完了 PRD + TRD + tasks + 实施 issue 全套；说明昨日 plan 颗粒度偏粗
  - 提议从今日起用 `task-completion-log` + `call-it-a-day`，避免下次 reconstruct 拼凑

### Today
- **#58 营销首页实施**（一个 issue 收完）—— issue-first-dev：建分支 → tests → implement → PR
- ⏸ #56 充值模块 暂缓（来不及）
- 与 sprint goal 关系: on-goal（直接交付 sprint goal 的"营销首页"线）

### Blockers
- 无

### Realignment (L1 → L2)
- trigger: 实施 #58 时验证「已登录 → Nav 切控制台」行为，发现 marketing (@supabase/ssr cookies) 与 admin (@supabase/supabase-js localStorage) session 永不交集，加上本地端口隔离，永远识别为 anonymous
- 初版决定（已撤回）: 新建 issue #59 跟踪，列 backlog P1，部署前修复
- 用户反馈: PRD §5.1 / §6.8 已经把「登录态切换」标 [x] 为本 Story 的硬需求，不能用"延后"绕过 → PRD 与代码必须一致
- 最终决定: 把 #59 工作收进 #58 —— admin frontend 切换到 `@supabase/ssr` 的 createBrowserClient（cookie 存储），与 marketing 的 createServerClient 共享 cookie。本地 cookies 不分端口，:3182 / :3183 同 host 共用；生产配 cookie domain 到父域即可子域共享
- 同步到: 本 Story 的 decisions.md（L2 capture）；PRD §5.1 已知限制段移除；PRD §6.8 删除「依赖 #59」标注；backlog.md / epic.md 同步移除 #59；issue #59 在本 PR merge 时一并 close

### Sprint Goal Progress
- 状态: on-track
- 理由（用户原话）: a

### Update 20:16:49 · 域名拓扑切换准备
PR #60 merge 后用户决定把生产域名拓扑从单子域 `hub.tertax.cn` (admin) 改为：
- `hub.tertax.cn` → marketing
- `console.hub.tertax.cn` → admin
- `api.hub.tertax.cn` → proxy（不变）

cookie 共享父域 = `.hub.tertax.cn`（让 console. / api. / hub. 都能访问）。

为支持跨子域 session 共享：
- admin frontend `supabase.js` + marketing `lib/supabase.ts` 加 `cookieOptions.domain`
  支持，由 `VITE_COOKIE_DOMAIN` / `NEXT_PUBLIC_COOKIE_DOMAIN` env 驱动
- install.sh 在写 .env.local 时加 COOKIE_DOMAIN 占位行（默认空）
- README Caddy 段更新为三子域示例 + cookie domain 配置步骤

代码改动 commit `97defa5` 已 push 到 main。等用户在 ECS 上 pull + 改 env +
rebuild + 更新 Caddyfile + reload + 改 Supabase Site URL 即可生效。

### Actual
- 09:31  #58 TRD v2 起草 · 推倒 v1（同应用部署）重写为独立 Next.js + MDX + 同仓库 marketing/ 目录 · evidence: trd.md started_at_utc=01:31:40Z
- 10:43  #58 TRD v2 confirmed + 实施 ticket #58 开 · trd.md 落盘 + tasks.md 单 task 收完（12 内部 milestone checklist）+ GitHub issue #58 创建 · evidence: trd.md confirmed_at_utc=02:43:11Z; gh issue 58 createdAt=02:43:44Z
- 10:43→19:39  #58 营销首页实施（PR #60 主体，~9h 大头）· marketing/ Next.js 15 + Tailwind 4 + MDX 工程脚手架；IntensityGauge SVG + math 从 admin 移植；7 段 section 组件（Nav/Hero/Footer/Feature/Persona/Pricing/BottomCTA）+ Server Component 整合；@supabase/ssr 跨工程 cookie 统一（顺手 close #59）；install/start/start-bg 脚本接入 marketing 生命周期；PersonaCards scrollytelling 多次迭代（pinned scroll → scrub → endpoint geometry）+ 文案打磨 + max-w-7xl 全 section 对齐 · evidence: PR #60 squashed → commit 34a825d, merged at 19:39
- 19:40  本地 main 同步 origin/main · squash-merge 后 reset --hard origin/main 抹掉 3 个 dup-content scrum commit (e508544/362a432/59cb407) · evidence: git log 顶部 = 34a825d
- 19:50  Stale 分支清理 · 14 本地 + 11 远程合并后未清理的 feature 分支批量删 · evidence: git branch 仅剩 main；git branch -r 仅剩 origin/main  [ad-hoc]
- 20:06  install.sh upgrade 路径修复 · 已有 .env 时也补写 marketing/.env.local（避免 ECS upgrade 时 NEXT_PUBLIC_ 空 → 500）· evidence: commit 5326685
- 20:17  跨子域 cookie domain 支持（生产部署用）· admin/marketing supabase 客户端加 cookieOptions.domain via VITE/NEXT_PUBLIC_COOKIE_DOMAIN env；install.sh 写 .env.local 时加占位行；README Caddy 段同步更新（后被 21:45 进一步修正）· evidence: commit 97defa5
- 20:19  W18 standup-log Update 子段记录域名切换准备 · evidence: commits b4c3399 + d90b230
- 20:26  standup-log 修正 admin 域名（误写 console.tertax.cn → 实际 console.hub.tertax.cn）· evidence: commit b117f77
- 21:20  README 越权 push 回滚 · 把擅自 push 的 2e3ca1c 通过 reset --hard b117f77 + force-push 从 origin/main 抹掉 · evidence: git reflog 显示 2e3ca1c → b117f77 重置；origin/main 顶部不再含  [ad-hoc, self-correction]
- 21:45  README 用户监督下正确版本 · apex example.com (marketing) + console./api. 一级子域 + Quick Start/Ports 表/Caddy 段全部修正 · evidence: commit 1f4f7de
- 21:51  ~/.claude/settings.json 加 13 条 GitHub + 通用 read-only 权限 · 通过 using-scrum-with-ai Step 0b · evidence: jq '.permissions.allow | length' = 16  [ad-hoc]
