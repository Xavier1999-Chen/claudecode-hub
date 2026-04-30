---
type: trd
slug: 2026-04-22-中转站fallback账号
version: backfill-v1
prd_version: backfill-v1
backfilled_at_local: "2026-04-29 09:40:00 Asia/Shanghai"
backfilled_at_utc: "2026-04-29T01:40:00Z"
---

# TRD · 中转站 fallback 账号

## 1. 概述

引入第三方 relay 类型账号作为 OAuth 池的兜底层；改造 account-pool 选号逻辑为三级 fallback；新增 modelMap 改写 body.model；admin 端新增 relay CRUD。

## 2. 涉及模块

| 模块 | 文件 | 改动类型 |
|------|------|---------|
| 账号池 | `src/proxy/account-pool.js` | 修改（新增 relay 类型识别 + 三级 fallback） |
| 转发器 | `src/proxy/forwarder.js` | 修改（relay 路径不走 OAuth refresh） |
| 模型映射 | `src/proxy/model-map.js` | 新增 |
| admin 路由 | `src/admin/index.js` | 新增 `POST /api/accounts/relay` |
| 前端 | `src/admin/frontend/src/RelayModal.jsx` | 新增 |
| 前端卡片 | `src/admin/frontend/src/AccountsTab.jsx` | 修改（relay 卡片渲染） |
| sanitiseAccount | `src/admin/index.js` | 修改（relay 暴露 hasCredentials + health） |

## 3. 数据变更

`accounts.json` 单条 relay 记录格式：
```json
{
  "id": "relay-xxx",
  "type": "relay",
  "name": "供应商A",
  "apiKey": "<sk-xxx>",
  "baseUrl": "https://relay.example.com/v1",
  "modelMap": { "opus": "deepseek-chat", "sonnet": "...", "haiku": "..." }
}
```

## 4. 接口变更

- 新增 `POST /api/accounts/relay`（admin only）
  - body: `{ name, baseUrl, apiKey, modelMap? }`
  - 响应：sanitised account（隐藏 apiKey）
- 列表 API 中 relay 账号通过 `type` 区分，前端渲染不同卡片

## 5. 状态一致性

- relay 账号无 OAuth token 概念，跳过 token-manager 的刷新流程
- 选号优先级硬编码：warm OAuth > relay > cooling OAuth；不可配置（避免误选）
- modelMap 在 forwarder 阶段应用，`applyModelMap(body, modelMap)` 返回新 body，不改原对象

## 6. 依赖关系

- 依赖：现有 forwarder 重试 + circuit-breaker
- 被依赖：后续 PR #37（relay 健康检测）+ PR #46（聚合账号沿用 relay-style 凭证模式）

## 7. 复用检查

- 复用 forwarder 的 HTTP/SSE 转发主路径，仅在「上游 URL + 鉴权头」处分支
- 复用 RateQueue 串行化（与 OAuth 等价）

## 8. 性能影响

- 选号增加一次 type 分组判定，O(n) 不变
- modelMap 应用是 in-place 字符串替换，开销可忽略

## 9. 测试策略

- 单测：account-pool 三级 fallback 顺序（warm > relay > cooling）
- 单测：modelMap 各 tier 命中、未命中、不存在 modelMap 透传
- 单测：sanitiseAccount 不泄露 apiKey
- 集成：admin POST /api/accounts/relay 落盘
- 手动：OAuth 全停 → 流量走 relay；OAuth 恢复 → 切回 OAuth

## 10. 风险与回滚

- 风险：relay 错配（baseUrl/apiKey 错）导致请求失败 → 由 circuit-breaker 兜底，不影响 OAuth 路径
- 风险：modelMap 误改 → 仅影响 relay 账号请求
- 回滚：单 PR commit revert，accounts.json 中 relay 记录变成"未识别 type"，调度时跳过

## Changelog
- backfill-v1（2026-04-29）从 PR #33 + 现网代码反向生成
