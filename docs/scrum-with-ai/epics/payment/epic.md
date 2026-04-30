---
type: epic
slug: payment
title: "用户支付（Payment）"
status: active
created_at_local: "2026-04-29 20:15:00 Asia/Shanghai"
created_at_utc: "2026-04-29T12:15:00Z"
ended_at_local: ""
ended_at_utc: ""
---

# Epic · 用户支付

## Vision

让用户能从"试用"过渡到"付费"，打通 hub 的变现闭环。在没有公司实体的约束下，找到对国内用户友好、合规、维护成本低的支付方案，让"想付费"的用户能顺畅完成首次支付。

## Strategic Themes

- **支付通道**：在 Stripe / 国内方案中找到对个人开发者+国内用户都友好的组合
- **变现模型**：充值 vs 订阅 vs 套餐 —— 先做最小可用模型
- **账户与额度**：余额 / 用量扣减 / 透支处理
- **合规与开票**：基础合规 + 简单凭证

## Member Stories

| Slug                  | Status      | Sprint(s)        | Notes      |
|-----------------------|-------------|------------------|------------|
| (待规划) 用户充值模块 | -           | 2026-04-27-W18   | issue #56  |

## Out of Scope

- 复杂活动/优惠券/拼团等营销玩法（首版不做）
- 企业开票/对公转账（首版个人为主）
- 多币种（首版人民币）
- 退款工作流的产品化（首版手动处理）

## Open Questions

- 支付方案选型 —— 待 PRD 阶段调研对比
- 是否引入第三方账户系统（如 Stripe Customer）vs hub 自建
- 余额的实时扣减 vs 周期结算
