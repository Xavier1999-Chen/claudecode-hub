---
type: trd
slug: 2026-04-27-聚合卡片完整实现
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 09:50:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:50:00Z"
---

# TRD · 聚合卡片完整实现

## 1. 概述

引入第三种账号类型 `aggregated`，把多个上游 provider 聚合到单一账号背后，按请求 model tier（含 image 检测）路由到对应 provider 并重写 model 名。前端提供三步向导创建。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| 聚合路由器 | `src/proxy/aggregated-router.js` | 新增 |
| 转发器 | `src/proxy/forwarder.js` | 修改（识别 aggregated 类型） |
| 账号池 | `src/proxy/account-pool.js` | 修改（mergeFromDisk 同步全字段） |
| admin API | `src/admin/index.js` | 新增 `POST /api/accounts/aggregated` + 路由/探测更新 |
| sanitiseAccount | `src/admin/index.js` | 修改（aggregated 暴露 hasApiKey 数组 + 每 provider health） |
| 前端 Modal | `src/admin/frontend/src/AggregatedModal.jsx` | 新增（三步向导） |
| 前端卡片 | `src/admin/frontend/src/AggregatedCardBody.jsx` | 新增 |
| 前端 API | `src/admin/frontend/src/api.js` | 新增 updateAggregatedRouting / updateAggregatedProbes |

## 3. 数据变更

`accounts.json` 单条 aggregated 记录：
```json
{
  "id": "aggr-xxx",
  "type": "aggregated",
  "name": "供应商组合A",
  "providers": [
    { "name": "DeepSeek", "baseUrl": "https://...", "apiKey": "sk-...", "probeModel": "deepseek-chat" },
    { "name": "GLM",      "baseUrl": "https://...", "apiKey": "sk-...", "probeModel": "glm-4-flash" }
  ],
  "routing": {
    "opus":   { "providerIndex": 0, "model": "deepseek-chat" },
    "sonnet": { "providerIndex": 0, "model": "deepseek-chat" },
    "haiku":  { "providerIndex": 1, "model": "glm-4-flash" },
    "image":  { "providerIndex": 1, "model": "glm-4v-flash" }
  }
}
```

## 4. 接口变更

- `POST /api/accounts/aggregated`（admin only）—— 创建聚合卡
- `PATCH /api/accounts/:id/aggregated/routing` —— 更新路由配置
- `PATCH /api/accounts/:id/aggregated/probes` —— 更新探测配置
- `GET /api/accounts` —— 聚合卡的响应包含 `providers[].hasApiKey` 与 `providers[].health`

## 5. 状态一致性

- aggregated 账号没有 OAuth token，跳过 token-manager 刷新
- routing 修改通过 admin API 落盘 → 单一写入者原则；proxy 通过 `mergeFromDisk` 拉取最新（之前只拉 token，是个 bug，本 PR 修复）
- 健康探测（probeModel）每 60s 一轮，结果缓存在内存；frontend 通过 `/api/accounts` 读取

## 6. 依赖关系

- 依赖：PR #33 引入的 relay-style 凭证模式（baseUrl + apiKey）
- 依赖：PR #43 单一写入者原则（聚合卡修改通过 admin 端点上报）
- 被依赖：PR #53 虚拟 MAX 计量在聚合卡之上加伪装

## 7. 复用检查

- 复用 forwarder 的 HTTP/SSE 主路径
- 复用 RateQueue 串行化
- 复用 sanitiseAccount 的字段裁剪框架（扩展 aggregated 分支）

## 8. 性能影响

- `resolveAggregatedProvider` O(1) 字典查找
- `hasImageContent` 递归 O(n) 消息内容大小，通常很小
- mergeFromDisk 同步全字段比之前 token-only 多几个字段拷贝，可忽略

## 9. 测试策略

- 单测：`hasImageContent` 平面消息、嵌套 tool_result.content、无图片
- 单测：`resolveAggregatedProvider` 各 model 前缀映射、image 优先级
- 单测：`mergeFromDisk` 同步 routing/modelMap/providers
- 手动：admin 三步向导创建聚合卡 → 发请求验证 tier 路由 + model 重写 + 图片路由

## 10. 风险与回滚

- 风险：mergeFromDisk 的字段同步范围扩大可能覆盖 proxy 内存里有意义的字段（如 token）→ 通过白名单控制只同步 admin 应该决定的字段
- 风险：图片检测漏判（嵌套层级太深） → 单测覆盖 tool_result.content 的常见嵌套
- 回滚：单 PR commit revert；已创建的聚合账号在 accounts.json 中变成"未识别 type"，调度跳过

## Changelog
- backfill-v1（2026-04-29）从 PR #46 + 现网代码反向生成
