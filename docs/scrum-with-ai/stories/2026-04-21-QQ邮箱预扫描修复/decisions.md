# Decisions · QQ 邮箱预扫描修复

> 事后归档。原始实施未留 L2 决策记录；此处补一条事后梳理的关键决策点。

---

## 2026-04-21 12:30:00 · 中转页 vs Supabase server-side 改造

### Trigger
PR #7 实施前需要决定从哪一层修。Supabase 验证链接是一次性 GET 是后端契约，前端改不了 Supabase 行为。

### Options Considered
- A · 前端中转页（点击触发 verifyOtp）
  - + 完全在前端，不动 Supabase
  - - 用户多一次点击
  - + 立刻可上线，无需等 Supabase 配置变化
- B · 用 Supabase 自定义模板 + magic link（带额外 nonce）
  - + 用户体验更直接
  - - 仍是一次性 GET，扫描器仍会消耗
  - - 没有真正解决问题
- C · 改用 OTP 数字码而非链接
  - + 完全规避扫描器
  - - 用户体验差（需要打字）
  - - 重做整个验证流程

### Decision
选 A。Supabase 官方推荐的方案就是中转页 + verifyOtp，扫描器拿到的只是静态 HTML，不消耗 token。用户多一次点击 vs 注册完全失败 → 后者严重得多。

### PRD/TRD 是否更新
- prd.md：无（事后归档时明确写入 PRD §3）
- trd.md：无（事后归档时明确写入 TRD §1）
- 链接：PR #7

> 注：上述决策为事后梳理，原始实施未留 decisions.md。Sprint 0 归档时按代码痕迹还原。
