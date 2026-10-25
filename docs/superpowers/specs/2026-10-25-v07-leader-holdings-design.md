# V0.7 大佬持仓设计（页面方案已确认）

## 意图

在 Enterprise AWE Trading Terminal 左侧增加“大佬持仓”。用户按投资风格查看关注机构最新公开的 13F 美股持仓，迅速了解主要持仓和相邻季度的披露变化，并记录自己的评论。它是可追溯的研究入口，不展示或暗示这些机构的实时、完整组合。

## 已确认的需求与选择

- 采用模块化持仓卡片，不将原始申报表直接铺在页面上。展示证券名称、代码（能可靠匹配时）、披露市值与其在**该机构 13F 披露持仓总市值中的比例**。
- 每家机构显示报告季度末日期、实际提交日期与 SEC 原件链接；用户点击“更新持仓”才检查公开申报，不自动轮询。
- 顶部为跨机构的最新披露变化速览。机构详情有相邻两期自动事实摘要，以及用户可编辑、可删除的评论；两类内容分开，评论保存在当前浏览器。
- 最早商定价值、宏观、激进科技三组，首批十二家申报主体如下；用户又提出十六家已核实的新机构，建议分为四组，见下节。

| 风格 | 页面名称 | 13F 申报主体 / CIK |
| --- | --- | --- |
| 价值 | 伯克希尔·哈撒韦 | Berkshire Hathaway Inc / 0001067983 |
| 价值 | 段永平 | H&H International Investment, LLC / 0001759760 |
| 价值 | 李录 | Himalaya Capital Management LLC / 0001709323 |
| 价值 | 帕布来 | Dalal Street, LLC / 0001549575 |
| 价值 | 景林资产 | Greenwoods Asset Management Hong Kong Ltd. / 0001848138 |
| 宏观 | 桥水 | Bridgewater Associates, LP / 0001350694 |
| 宏观 | 索罗斯 | Soros Fund Management LLC / 0001029160 |
| 宏观 | Michael Burry（迈克尔·伯里） | Scion Asset Management, LLC / 0001649339 |
| 宏观 | Paul Tudor Jones（保罗·都铎·琼斯） | Tudor Investment Corp et al / 0000923093 |
| 激进科技 | ARK | ARK Investment Management LLC / 0001697748 |
| 激进科技 | Leopold Aschenbrenner | Situational Awareness LP / 0002045724 |
| 激进科技 | 但斌·东方港湾 | Oriental Harbor Investment Master Fund / 0002046333 |

申报主体是数据归属，不把机构披露自动归因为某个人当季亲自下的交易指令。

Scion 的 [2025-09-30 申报](https://www.sec.gov/Archives/edgar/data/1649339/000164933925000007/0001649339-25-000007-index-headers.html)于 2025-11-03 提交；截至本次检索，尚未核实有更晚一期公开 13F。页面须明确标为“最后核实的公开披露”及季度日期，不能写成当前仓位。Tudor Investment 的 [2026-06-30 申报](https://www.sec.gov/Archives/edgar/data/923093/000090266426003485/0000902664-26-003485-index.html)于 2026-08-14 提交；它与无关的 Tudor Financial Inc. 不是同一申报主体。

## 扩充名单与分类

已确认四组：**价值与质量**、**主动与特殊机会**、**成长与科技**、**宏观与多策略**。分组只是浏览入口，不代表机构只采用一种策略。首批十二家中的伯克希尔、段永平、李录、帕布来、景林归入价值与质量；桥水、索罗斯、Scion、Tudor 归入宏观与多策略；ARK、Situational Awareness、东方港湾归入成长与科技。新增十六家如下，均已核对 SEC 申报主体：

| 建议分组 | 用户提及 / 核实名称 | 13F 申报主体 / CIK | 核验 |
| --- | --- | --- | --- |
| 价值与质量 | Terry Smith · Fundsmith | Fundsmith LLP / 0001569205 | [SEC](https://www.sec.gov/Archives/edgar/data/1569205/000156920526000012/0001569205-26-000012-index.htm) |
| 价值与质量 | Chuck Akre · Akre Capital（非 ARK） | Akre Capital Management LLC / 0001112520 | [SEC](https://www.sec.gov/edgar/browse/?CIK=0001112520&action=getcompany&owner=exclude&type=13F-HR) |
| 价值与质量 | Dev Kantesaria · Valley Forge | Valley Forge Capital Management LP / 0001697868 | [SEC](https://www.sec.gov/Archives/edgar/data/1697868/000169786826000005/0001697868-26-000005-index.htm) |
| 价值与质量 | Tom Russo · Gardner Russo & Quinn | Gardner Russo & Quinn LLC / 0000860643 | [SEC](https://www.sec.gov/Archives/edgar/data/860643/000086064326000005/0000860643-26-000005-index.htm) |
| 价值与质量 | Seth Klarman · Baupost（非 Bobberson） | Baupost Group LLC/MA / 0001061768 | [SEC](https://www.sec.gov/Archives/edgar/data/1061768/000106176826000010/0001061768-26-000010-index-headers.html) |
| 价值与质量 | PRIMECAP | PRIMECAP Management Co / 0000763212 | [SEC](https://www.sec.gov/Archives/edgar/data/763212/000076321226000028/0000763212-26-000028-index.htm) |
| 主动与特殊机会 | Bill Ackman · Pershing Square | Pershing Square Capital Management LP / 0001336528；当期由母公司 Pershing Square Inc / 0002026053 报告 | [通知](https://www.sec.gov/Archives/edgar/data/1336528/000117266126003777/xslForm13F_X02/primary_doc.xml)、[母公司持仓表](https://www.sec.gov/Archives/edgar/data/2026053/000117266126003790/0001172661-26-003790-index.htm) |
| 主动与特殊机会 | Howard Marks · Oaktree | Oaktree Capital Management LP / 0000949509 | [SEC](https://www.sec.gov/Archives/edgar/data/949509/000094950926000005/0000949509-26-000005-index.htm) |
| 主动与特殊机会 | Chris Hohn · TCI | TCI Fund Management Ltd / 0001647251 | [SEC](https://www.sec.gov/Archives/edgar/data/1647251/000164725126000007/0001647251-26-000007-index-headers.html) |
| 成长与科技 | Chase Coleman · Tiger Global | Tiger Global Management LLC / 0001167483 | [SEC](https://www.sec.gov/Archives/edgar/data/1167483/000091957426005427/0000919574-26-005427-index.html) |
| 成长与科技 | Coatue Management | Coatue Management LLC / 0001135730 | [SEC](https://www.sec.gov/Archives/edgar/data/1135730/000091957426005478/0000919574-26-005478-index.htm) |
| 成长与科技 | Brad Gerstner · Altimeter | Altimeter Capital Management LP / 0001541617 | [SEC](https://www.sec.gov/Archives/edgar/data/1541617/000154161726000008/0001541617-26-000008-index.html) |
| 成长与科技 | 柏基投资 · Baillie Gifford | Baillie Gifford & Co / 0001088875 | [SEC](https://www.sec.gov/Archives/edgar/data/1088875/000108887526000057/0001088875-26-000057-index.htm) |
| 成长与科技 | Sands Capital | Sands Capital Management LLC / 0001020066 | [SEC](https://www.sec.gov/Archives/edgar/data/1020066/000102006626000018/0001020066-26-000018-index.html) |
| 宏观与多策略 | David Tepper · Appaloosa | Appaloosa LP / 0001656456 | [SEC](https://www.sec.gov/Archives/edgar/data/1656456/000165645626000003/0001656456-26-000003-index.html) |
| 宏观与多策略 | Citadel | Citadel Advisors LLC / 0001423053 | [SEC 修正申报](https://www.sec.gov/Archives/edgar/data/1423053/000110465926104387/0001104659-26-104387-index.html) |

用户确认“搏击投资”实际为**柏基投资 Baillie Gifford**，“Sense Capital Management”实际为 **Sands Capital**。两者的申报主体已按上表核实；柏基投资按其[官方长期成长投资理念](https://www.bailliegifford.com/en/uk/individual-investors/about-us/philosophy-and-values/?tab=leadership+and+culture)暂归入成长与科技。

潘兴广场在 [2026-06-30 季度提交 13F-NT](https://www.sec.gov/Archives/edgar/data/1336528/000117266126003777/xslForm13F_X02/primary_doc.xml)，通知说明其公开母公司 Pershing Square Inc 代为报告，不能把通知当作空仓；应沿申报中明确列出的其他管理人追踪对应持仓。Oaktree 主要是信贷与特殊机会投资，13F 只呈现其应申报证券的一部分。Citadel 有大量证券与期权，需单列期权并缓存大型申报文件。四组页面也应有搜索、收起和按名称筛选，以容纳二十九家机构。

## 方案比较

1. **直接读取 SEC EDGAR 原始 13F（已选择）**：源文件与日期可核验，不依赖商业转录。需要解析不同 XML 格式、修正申报、限流并处理个别文件暂不可用。
2. 第三方持仓库：接入可能更快，常提供名称和代码映射，但转录和更新时点不一定透明，可能需要付费。
3. 手工维护快照：初版最快，却不能可信地支持“更新最新公开数据”。

服务端按固定 CIK 查询 13F-HR、13F-HR/A 和 13F-NT，再取信息表；遇 13F-NT 须沿申报列出的其他管理人寻找持仓，无法安全归属时只显示通知，不推断空仓；比较相邻季度的完整有效申报。修正申报若为重述，以重述表替换被修正的表；若为追加条目，则与该季度有效底表合并。不能可靠判定修正类型或重建完整季度时，标记该季度不可比较，不计算误导性的权重和增减。[SEC 修正申报说明](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f)。请求遵守 SEC 的访问规则和速率限制，使用服务端声明的应用联系信息。页面只接收公开申报数据，不含服务端配置。应有合理的服务端缓存，避免每位用户反复下载相同申报；按钮仍会重新核对最新申报索引。

**接入待解决：**2026-10-25 在当前本地服务端对 SEC submissions API 与原始申报档案各做一次只读请求，均返回 Akamai HTTP 403。公开网页能核对文件，但产品服务端尚不能直连。用户要求先核验可追溯 SEC 原件的备用通路：Tracefour 免密钥接口实测覆盖首批十二家中的伯克希尔、ARK、Situational Awareness；XOOMAR 实测覆盖伯克希尔、桥水、索罗斯、ARK、Scion；两者合计已不能覆盖原十二家，更不能覆盖扩充后的二十八家。HoldingsHub 文档称免密钥，但接口实测要求 API key。仍需验证可覆盖全部已核实机构的可靠通路；在此之前不应把“更新持仓”宣称为已可用。

## 数据计算与解释

- 以申报季度末的每条证券市值计算权重：该条市值 ÷ 同一申报信息表可纳入的证券市值之和。若信息表含期权，期权单列，不混作正股。市值与权重属于**申报时点**，不是今天的市值或整个基金资产占比。
- 按 CUSIP、证券类别及期权标志匹配相邻两期；股数增加/减少、新进/退出均描述为“申报股数变化”，避免断言真实买卖日期、成交价或投资动机。拆股、转换、申报修正可导致看似异常的变化；异常项只给出数字与原件，不强行解释。
- 优先使用最新有效申报；若同季度出现修正申报，重新计算并标记修正。缺少可比上一期时显示“暂无季度对比”，不推断增减。基金之间可能存在不同最新季度，页面逐家显示。
- 代码映射只在可确认时提供，无法确认时展示 SEC 的发行人名称与 CUSIP，不猜代码。大持仓卡片默认展示前约 12 项，可展开查看该机构全部披露项。跨机构顶部重点按新进、退出及申报股数变化的规模生成短句，附原件，不写主观投资建议。
- 13F 不覆盖现金、很多债券和非美市场证券，也不披露空头；申报通常在季度结束后最多 45 天提交。页面在显著位置说明其范围和延迟。[SEC 13F FAQ](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f)。

## 查诺斯的历史 13F

用户决定 V0.7 只做 13F，不加入做空研究机构或报告。Jim Chanos 创立的 Kynikos Associates 后以 **Chanos & Co LP** 名称申报（CIK 0001446440），纳入“宏观与多策略”组，作为第 29 家机构。当前核实到的最近一期 [SEC 13F 报告期为 2023-09-30，提交于 2023-11-14](https://www.sec.gov/Archives/edgar/data/1446440/0001172661-23-003940-index.htm)。卡片需显著写“历史申报 · 2023 Q3”，不得写成当前持仓。13F 不披露股票空头；该页面仅显示其可核实的 13F 多头及可报告期权，不推断做空仓位。[SEC 13F FAQ](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f)。

## 页面与交互

- 侧栏新增“大佬持仓”，沿用现有白底、浅蓝强调色、侧栏与顶部工作台导航。页顶为标题、“公开 13F 快照”说明、最近核对时间和“更新持仓”按钮。数据源未接通时，按钮与状态需明确说明，不显示假数字。
- 第一屏只放至多三条跨机构的“最近披露变化”事实卡，标出机构、报告季度和对应原件；没有可靠季度对比时显示说明，不能生成空泛的市场判断。
- 下方建议四组切换标签，显示每组机构数；标签旁有中英文机构名称搜索。目录使用桌面三列、窄屏两列、手机一列的机构卡，避免二十九家卡片在四列中挤得过小。每卡显示人物与申报主体、报告季度末、提交日、披露持仓项数、披露市值、前三大持仓名称，以及一句可核实的季度变化；过期与部分数据以文字状态标记。
- **已确认的布局：**点击机构卡在目录右侧打开详情面板，保持机构卡可见，便于快速切换比较。面板顶部是机构名称、报告季度、提交日期、关闭按钮和 SEC 原件链接；下面依次显示前十大持仓卡片（可展开全部）、本期与上期变化事实、数据范围说明及“我的评论”编辑区。桌面面板占约三分之一宽，列表余下区域自动调整列数；手机改为覆盖式全宽面板，关闭后返回原目录位置。Citadel 等长名单只在面板内部按需加载/展开，不能一次渲染过量卡片。
- 初次打开或更新失败时明确显示状态；成功数据存于当前浏览器，离开页面或更新失败后仍可看上次成功快照。单家失败时保留其余机构，并注明失败者及旧数据季度；不把旧季度伪装成最新。
- 评论按申报主体和季度保存于当前浏览器，可编辑、删除；页面标记“我的评论”。用户评论不发往 SEC，不作为自动摘要依据。

## 边界与验收

- 不展示“今日仓位”“完整基金组合”或未经核实的投资动机。ARK 等机构可能另有更高频公开资料，V0.7 仍统一采用 13F 口径，避免同页混合不同披露范围。
- SEC 无法访问、无信息表、无可比季度、存在修正申报、不同主体季度不一致时，页面给出可理解的说明，不生成虚假数据。
- 可从所有现有主页面进入；手动更新后显示至少一个经 SEC 原件验证的真实机构和持仓，权重与申报信息表相符；增减按股数而非市值变化判断；评论和上次成功结果跨页面保留。自动摘要和用户评论视觉上区分。

## 待解决

- 用户已确认原二十八家申报主体、查诺斯作为第 29 家历史 13F 机构、四组浏览结构及右侧详情面板。本期不做做空研究。
- 页面中的“最新动作”只做可从相邻两期 13F 核实的事实摘要；个性化观点由用户评论承载。
- 当前电脑访问 SEC 返回 403；用户已选择先核验可追溯到 SEC 原件的备用通路，但尚未找到覆盖全部机构的可靠来源。
