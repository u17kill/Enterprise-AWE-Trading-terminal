# V0.9 市场健康仪表盘设计

## 已确认需求

- 总览看板顶部采用桌面端固定五列、两行的十张卡。第一行是波动、市场宽度、流动性/信用、拥挤度、杠杆五灯；第二行依次是 10Y–2Y、等权/市值加权、Put/Call、CNN Fear & Greed，最后一张保留为空位。窄屏可重排。
- 五灯用醒目的圆形指示灯，显示数据值、状态、简述、来源与数据日期。四个辅助指标分别使用小型收益率曲线、双线、比例条和半圆指针。没有数据时显示灰灯或空值，不用样例数字。
- 专属“重新计算”按钮仅更新仪表盘，不触发资产看板行情更新。浏览器保存最后一次成功的逐项结果；部分来源失败时保留旧值并明确标为旧数据。
- 周报的五灯规则是主要参考。可核验的自动规则直接使用；无法从现有源得到完整数据的维度标为待接入，不以另一种指标冒名顶替。人工判断和注释继续保留，但与自动灯色分开。

## 数据口径

| 卡片 | V0.9 数据 | 判断 / 限制 |
| --- | --- | --- |
| 波动 | Longbridge `.VIX.US` | <20 绿，20–30 黄，>30 红；期限结构暂缺单独数据。 |
| 市场宽度 | 标普 500 成分股高于 MA50/MA200 的比例 | 周报阈值 >60% 绿、40–60% 黄、<40% 红；现有 Longbridge constituent 只返回部分成分股，不能据此计算完整比例，先显示不可用。 |
| 流动性/信用 | FRED `BAMLH0A0HYM2` 高收益债 OAS | <4 绿，4–5 黄，>5 红；4 周扩大超过 100bp 提升至红。日度数据。 |
| 拥挤度 | Longbridge SPY 每日 Put/Call 量比过去约 260 个交易日分位 | 这是公开可得的单一代理指标，不等于 CFTC 头寸综合分。两端极端分位(<5% 或 >95%)红，5–20% 或 80–95%黄，其余绿；在卡片中注明方向。 |
| 杠杆 | FRED `NFCILEVERAGE` 芝加哥联储金融条件杠杆子指数 | 每周发布。V0.9 项目规则：过去 52 个周值中分位 >90% 红、70–90% 黄，其余绿。这不是原周报给出的硬阈值，界面标注为参考判断。 |
| 10Y–2Y | FRED `T10Y2Y` | 百分点，显示最近走势，非交易信号。 |
| 等权/加权 | Longbridge `RSP.US` / `SPY.US` 近期日 K 线 | 两条价格序列各自归一到 100；不声称是官方 S&P 500 Equal Weight 指数。 |
| Put/Call | Longbridge `SPY.US` 期权量 | 显示最新成交量比和 Call/Put 比例；仅 SPY，不冒充全市场。 |
| 恐慌贪婪 | CNN Business 发布值 | 直接读取 CNN 页面使用的数据端点，非重算；端点无公开稳定 API，失败显示旧值或不可用。 |

## 运行和数据安全

- 远端请求都在 Next.js 服务端 Route Handler；Longbridge 令牌继续存服务端 session，不写浏览器。
- 单次刷新并发请求，单源失败不拖垮全板。每张卡保存来源 URL、原始数据日期和取得时间；前端展示原始数据日期。
- 仅在用户点击按钮时请求，不自动轮询。客户端本地存储的是已公开的指标快照与用户注释，不包含令牌。
- 指标仅为监测证据。五灯不等权，单红灯不触发交易建议。

## 数据来源

- [Enterprise AWE 基金策略周报五灯说明](https://docs.google.com/presentation/d/1z-1nwaQtj4vQVBiyxwShXSdGx0FI6cCh/edit)
- [Cboe VIX](https://www.cboe.com/tradable_products/vix/faqs)
- [FRED 高收益债 OAS](https://fred.stlouisfed.org/series/BAMLH0A0HYM2)
- [芝加哥联储杠杆子指数](https://fred.stlouisfed.org/series/NFCILEVERAGE)
- [FRED 10Y–2Y](https://fred.stlouisfed.org/series/T10Y2Y)
- [CNN Fear & Greed](https://www.cnn.com/markets/fear-and-greed)

