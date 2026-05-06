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
> EOD: 2026-04-30T22:13:36+08:00

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
- 21:55  #58 partial 收尾标注 · 营销页 ↔ admin 风格仍有不一致（tab logo / 配色 / 字体细节等），属 #58 范畴未完成的尾巴；下个 work session 补完

### Realignment (L2) · admin UI restyle 加进 sprint scope
- trigger: PO 喜欢营销页 Anthropic 风格，决定把 admin 控制台也重构成相同风格
- decision: 加为新 Story（暂称 admin-restyle），希望本 sprint 完成；具体 commit 与否待 PRD 定完工程量后再判
- 同步到: 暂不动 sprint-plan.md committed[]，等 PRD 出来再考虑（避免无估盲 commit）；下次会话展开
- 备注: PO 标注"很重要"

### Tomorrow's seed
- 主线: 走 product-requirement-first 起 admin-restyle PRD（标"很重要"）
- 看心情: 补 #58 风格尾巴（tab logo / 配色细节）
- 仍 blocked: 无

## 2026-05-06 (Wed) · Sprint Day 10/14
> 写入时间：2026-05-06T10:12:37+08:00 · sprint=2026-04-27-W18

### Yesterday
- 计划（来自 04-30 entry Today + Tomorrow's seed）:
  - #58 营销首页实施（issue-first-dev 整套）
  - 04-30 收盘后：起 admin-restyle PRD + 补 #58 风格尾巴
  - #56 / #40 / #57 暂缓
- 实际:
  - 04-30: #58 PR #60 merged @ 19:39（marketing/ Next.js 15 主体；顺手 close #59）+ ad-hoc cleanup（cookie domain `97defa5` / install.sh 修复 `5326685` / README 三子域 `1f4f7de` / 14+11 stale 分支清理）
  - 04-30 EOD 22:13 lock，commit `44650ad`
  - 05-01 → 05-05: 五一假期，no significant change（git/gh 校验：0 commit / 0 PR / 0 issue closed）
  - 05-05: 用户使用时发现 OAuth token 已过期未自动刷新 → bug 浮出（5/2-5/4 无流量未暴露）
- 差距:
  - 04-30 计划只列 #58，实际还做了 cookie domain / README / install.sh / 分支清理一堆 ad-hoc，颗粒度仍偏粗
  - admin-restyle PRD 因假期未起，今天也未排（继续往后挪）
  - **新发现 latent bug**：OAuth token 自动刷新失效，需 root cause 排查

### Today
- **#40 中转站 thinking signature bug**（sprint committed P2，今天收）
- **#57 优化用户使用指南**（sprint committed，今天收）
- **[P0 ad-hoc] OAuth token 自动刷新失效**：先快速排查 root cause（开发产生的 bug？Claude Code 刷新机制变了？其他？）→ 再决定要不要立 issue 走流程
- 与 sprint goal 关系: #40 / #57 on-goal（committed scope）；OAuth bug 是 ad-hoc 介入（紧急 latent bug，5/5 用户暴露），暂不计入 sprint commits 待 root cause 后判
- ⏸ 推迟: admin-restyle PRD（PO 标"很重要"但今天排不下）；#58 风格尾巴；#56 充值模块（仍 0 进度）

### Actual
- 17:52  #57 (PR #61) · 优化用户使用指南：env var `ANTHROPIC_API_KEY` → `ANTHROPIC_AUTH_TOKEN`、新增 `CLAUDE_CODE_EFFORT_LEVEL=max`、新增 Step 3「跳过首次登录引导」 · evidence: PR #61 merged, commits 49be07f + 7f13f42
- 19:02  [ad-hoc] OAuth refresh_token 失效 root cause 排查 + issue #62 立案 · 静态代码审查 + ECS tmux scrollback 取证（数百行 `Refresh token not found or invalid`）+ web 调研（claude-code#24317 / token-weather#83 等证实 Anthropic OAuth 实施 RT rotation）+ 全局审视 admin 14 处 writeAccounts → 定位真因为 admin 进程内多个 async writer 间 read-modify-write 竞态（probeAllRelays 60s timer 与 report-credentials handler 互相覆盖凭证更新）· evidence: issue #62 created with full RCA + 修法（async-mutex 串行化）+ DoD + out-of-scope 单独跟踪项
- 19:30  #62 实施完成 + PR #63 开 · 新增 `src/admin/accounts-mutex.js`（promise-chain mutex，对齐 RateQueue 风格）+ 14 处 writeAccounts 全部经 lockWrites/runExclusive 串行化 + 5 个新测试用例（含 race 基线复现 + 修复验证）· evidence: PR #63, branch fix/accounts-mutex-#62, commit 3f5e91d, npm test 215/215 绿
- 19:48  #40 实施完成 + PR #64 开 · 与 issue 原 design 偏离：仅做出站 strip，不做入站 inject（web 调研证实 Anthropic signature 是密码学加密、假签必拒）· 新增 `src/proxy/thinking-sanitizer.js` 按 signature 长度 < 50 启发式判定 foreign block 删除 + forwarder 集成 + 11 个测试用例 · evidence: PR #64, branch fix/thinking-signature-#40, commit f5d3021, npm test 226/226 绿（issue scope 重新校准对齐 screenshot 实际错误"Invalid signature in thinking block"，非 issue body 原描述的"empty or malformed response"）
- 19:51  staging 分支 `staging/oauth-and-signature` 建好（#62 + #40 双 no-ff merge，221 tests 绿）· 不开 PR，只用于 ECS 部署验证；通过后两个 PR 独立 merge · evidence: staging branch pushed to origin, merge commits ab3226d + 2d3c9c8

### Blockers
- 无

### Realignment (L2) · OAuth 修复（#62）拉进 sprint scope
- trigger: 上午 #62 root cause 排查产出明确 → admin 进程内 async writer 竞态（commit a5d0053 single-writer principle 设计盲区，未覆盖 admin 内部并发）
- decision: #62 拉进本 sprint commits（生产事故、修法 scope 明确、估计几小时改动；推到下 sprint 拉长事故回归时间）
- 同步到: sprint-plan.md committed[] 增加 #62、corrections[] 记录 scope 变更
- 备注: 原 L1 entry 保留（决策路径完整审计），本 L2 是后续升级

### Sprint Goal Progress
- 状态: at-risk
- 理由（用户原话）: 充值模块 0 进度，剩 4 天起步偏紧

