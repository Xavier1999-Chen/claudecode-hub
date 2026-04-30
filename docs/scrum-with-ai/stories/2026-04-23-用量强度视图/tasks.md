# Tasks · 用量强度视图

> 事后归档。原始实施未做 task 拆分，按 PR/issue 归纳为单个 Task。

## T1 · 普通用户用量 tab 改为强度仪表盘 + 热力网格
- type: Task
- github: #34
- depends_on: []
- status: done
- pr: #35
- merged_at_utc: 2026-04-23T08:44:56Z

### Goal
前端纯实现：仪表盘 + 热力网格，admin 视图不变，后端零改动。

### Acceptance
- [x] `usage-intensity.js` 提供 4 个纯函数（intensityColor / cycleStart / cycleEnd / aggregateByTerminal）
- [x] `IntensityGauge` 组件（半圆 SVG 指针 + 四档分色）
- [x] `TerminalHeatGrid` 组件（GitHub 风格周历）
- [x] `UsageTab` 按 role 切视图
- [x] 19 个新测试 + 88 个已有测试通过（共 107/107）
- [x] ECS 部署验收
