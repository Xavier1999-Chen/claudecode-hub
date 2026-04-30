# Decisions · 营销首页

> 实施期间浮现的 L2 中途决策日志（plugin `CLAUDE.md` 第 7 节）。
> 新条目追加到顶部（reverse chronological）。

---

## 2026-04-30 12:30:00 · admin frontend 切换到 @supabase/ssr 以共享 session

### Trigger

实施 #58 时本地试运行发现：登录后 marketing 仍显示「登录」按钮（PRD §5.1 / §6.8 要求切「控制台」+ 隐藏所有注册 CTA）。

定位根因：
- admin frontend (`src/admin/frontend/src/supabase.js`) 用 `@supabase/supabase-js` 的 `createClient`，session 存到 **localStorage**
- marketing (`marketing/lib/supabase.ts`) 用 `@supabase/ssr` 的 `createServerClient`，从 **cookies** 读
- localStorage 按 origin（含端口）隔离 → :3182 与 :3183 不互通；即使同源也不互通（不同存储机制）

属于 TRD v2 阶段我做"独立 Next.js 工程"重大调整时漏检的 Phase 6 可行性扫描问题：原"同应用部署"方案下登录态切换天然成立（同 React 工程内 session state 共享），改成独立工程后**应该立即**重新评估 session 共享，但当时只把"cookie domain"列为 TRD §10 部署阶段 Open Question，没意识到 admin 端连 cookie 都没用。

### Options Considered

- **A · 把 #59 收进 #58 一起做**（admin 切换到 `@supabase/ssr` cookie 客户端）
  - + PRD §5.1 / §6.8 按原样兑现，AC 不打折
  - + cookies 不区分端口 → 本地 :3182 / :3183 自动共享
  - + 生产部署时只需配 cookie domain 到父域，无额外架构改动
  - - admin frontend 已存用户的 localStorage session 失效，需要重登（一次性）
  - - admin bundle 略大（+10kB）
- **B · 显式改 PRD v2 标记登录态切换为 v2 后做**
  - + 实施工程量小（5 分钟改 PRD）
  - - PRD 与代码兑现失真，retro 时是技术债
  - - 用户拒绝（"PRD 不能说谎"）
- **C · 维持当前 #58 + #59 分开**
  - + 不阻塞 #58 merge
  - - PRD 标 [x] 但代码不达标 → 同 B 的失真问题

### Decision

选 **A**。用户拍板：「PRD 与代码必须一致；千军万马按行业标准」。

实施变更：

1. `src/admin/frontend/package.json` 新增 `@supabase/ssr` 依赖
2. `src/admin/frontend/src/supabase.js`：`createClient` → `createBrowserClient`
   - 公共 API 完全兼容（auth.signIn/signUp/signOut/onAuthStateChange/getUser/getSession 全部不变）
   - 不需要改任何调用方代码（`App.jsx` / `LoginPage` / `RegisterPage` 等）
   - 存储后端从 localStorage 切到 document.cookie
3. marketing 端代码不动（已经用 `@supabase/ssr` createServerClient）
4. 部署阶段：cookie domain 配父域即子域共享；本地无需特殊配置（cookies 不分端口）

### PRD/TRD 是否更新

- prd.md：v1.1（移除 §5.1 已知限制段、§6.8 删除「依赖 #59」标注；加实现细节注解）
- trd.md：v2 已涵盖（§4 接口变更段已写"用 @supabase/ssr 集成"；本决策落实到 admin 端代码后符合 TRD 描述，无需 v3）
- 链接：admin commit + 本 PR 中的 #59 closing reference

### 后续

- 用户重登：admin 升级后 localStorage 旧 session 不再被读，需要重登一次。生产升级时应配 release notes 提醒
- cookie domain 配置：部署阶段单独决策，TRD §10 Open Question 仍保留
- 教训：未来做"重大架构调整"（如同应用 → 独立工程）时必须立即重跑 Phase 6 可行性扫描；不能只挑一两个新风险列 Open Question
