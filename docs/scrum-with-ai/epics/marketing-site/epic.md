---
type: epic
slug: marketing-site
title: "营销站点（Marketing Site）"
status: active
created_at_local: "2026-04-29 20:15:00 Asia/Shanghai"
created_at_utc: "2026-04-29T12:15:00Z"
ended_at_local: ""
ended_at_utc: ""
---

# Epic · 营销站点

## Vision

把 claudecode-hub 从"工具"变成"产品"：让陌生访客在打开首页 1-2 分钟内理解产品价值（多账号自动调度 / 免封号 / 共享 Pro 订阅），完成访客 → 注册者的转化。营销站点是产品的对外门面，决定第一印象。

## Strategic Themes

- **价值传达**：让访客在 hero 区一眼读懂"这是什么、为何要用"
- **信任建立**：清晰的功能介绍 + 适用人群 + 透明定价
- **转化引导**：明确的 CTA（注册 / 联系 admin），降低进入门槛
- **品牌延续**：与 admin 面板视觉语言一致（橙色 #E87040 / 深色 #1C1917 / 米色 #F4F1EB）

## Member Stories

| Slug                  | Status      | Sprint(s)        | Notes      |
|-----------------------|-------------|------------------|------------|
| 2026-04-29-营销首页   | confirmed   | 2026-04-27-W18   | spec #55, impl #58 |

## Out of Scope

- 博客 / changelog / 案例研究（未来内容站）
- SEO 深度优化（MVP 后再评估）
- 多语言（首版仅中文）
- 用户付费流程（属于 `payment` Epic）

## Open Questions

- 营销页是否要独立部署在子域名（如 `www.` / 主域）vs 与 admin 面板同一应用？
- 需不需要后续接入分析工具（GA / 自建埋点）？
- **marketing ↔ admin 登录态共享**（issue #59）—— 当前架构 admin 用 localStorage、marketing 用 cookies，session 永不交集；部署生产前必须解决
