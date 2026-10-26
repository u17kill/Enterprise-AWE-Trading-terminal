# V0.9 市场健康仪表盘实施计划

**目标：** 把已确认的 5×2 仪表盘变为可按需刷新、保存、显示来源和失败状态的功能。

## Task 1 — 数据模型与评分

文件：`src/lib/market-health.ts`、`src/lib/market-health.test.ts`。

1. 先写边界测试：VIX 20/30、OAS 4/5 与 4 周扩大、分位尾部、缺失数据不可评分、旧快照合并。
2. 看见测试失败，再实现纯函数及快照类型。
3. 跑该测试文件，确认通过。

## Task 2 — 只读数据采集与接口

文件：`src/lib/market-health-source.ts`、`src/lib/market-health-source.test.ts`、`src/app/api/market-health/route.ts`。

1. 先测试 FRED CSV、CNN 读数、Longbridge 期权量的严格解析和格式错误拒绝。
2. 实现服务端按需并发抓取，单源失败返回对应错误。Longbridge 未连接时，FRED/CNN 仍能返回。
3. API 仅暴露公开指标结果；请求 no-store，无 token 在响应中。

## Task 3 — 仪表盘 UI 与保存

文件：`src/components/five-lights-panel.tsx`、`src/app/market-health.css`、`src/components/dashboard.tsx`、组件测试。

1. 先测试独立刷新、旧快照恢复、局部失败保持旧值、九张指标卡及空位。
2. 实现五灯 LED、辅助可视化、状态和来源、单独刷新及人工备注。
3. 匹配确认的 `v09-market-dashboard-v3.png` 布局，桌面五列两行，小屏按宽度重排。

## Task 4 — 文档、验证和交付

文件：`docs/v0.9-status.md`、`docs/README.md`、V0.9 设计文档、PR 描述和 Issue #12。

1. 记录实现与欠缺的覆盖数据，不声称实时或完整模型。
2. 跑测试、lint、build，审查差异和 UI。
3. 提交 V0.9 分支，推送并创建草稿 PR，更新 Issue #12 和 PR 说明。

