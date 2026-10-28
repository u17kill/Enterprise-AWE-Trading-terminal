import type { HealthReading, HealthState } from "./market-health";
import { XMLParser } from "fast-xml-parser";

export type CanaryBand = "macro" | "us" | "china";
export type CanaryHorizon = "short" | "long";
export type CanaryIndicator = {
  id: string; title: string; band: CanaryBand; region: string; horizon: CanaryHorizon;
  definition: string; interpretation: string; trigger: string; limitation: string;
  sourceUrl: string; sourceName: string;
};
export type CanaryReading = HealthReading;
export type CanarySnapshot = { refreshedAt: string; readings: Record<string, CanaryReading>; errors: Record<string, string> };
export const CANARY_STORAGE_KEY = "awe.canary.v11";

const fred = (id: string) => `https://fred.stlouisfed.org/series/${id}`;
const ecb = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html";
const chineseBond = "https://gks.mof.gov.cn/gzsylqs/gzlssj/";
const chinaMoney = "https://www.chinamoney.com.cn/english/bmkshb/";
const sse = "https://www.sse.com.cn/market/othersdata/margin/detail/index.shtml";
const indicator = (id: string, title: string, band: CanaryBand, region: string, horizon: CanaryHorizon, definition: string, interpretation: string, trigger: string, limitation: string, sourceName: string, sourceUrl: string): CanaryIndicator => ({ id, title, band, region, horizon, definition, interpretation, trigger, limitation, sourceName, sourceUrl });

export const CANARY_INDICATORS: CanaryIndicator[] = [
  indicator("us30", "美国国债 30 年期", "macro", "美国", "long", "FRED DGS30 的 30 年期美债固定到期收益率。", "观察长期融资成本与通胀预期变化，结合 2 年期利率阅读。", "持续急升需要留意长期折现率压力；单日升降不单独亮红灯。", "美联储 H.15 日度序列，非交易中的即时收益率。", "FRED / H.15", fred("DGS30")),
  indicator("us10", "美国国债 10 年期", "macro", "美国", "long", "FRED DGS10 的 10 年期美债固定到期收益率。", "观察中长期利率变化及其对估值的影响。", "结合 3 个月利率和历史斜率，而非单独按绝对数值判断。", "美联储 H.15 日度序列，不代表即时债券报价。", "FRED / H.15", fred("DGS10")),
  indicator("us2", "美国国债 2 年期", "macro", "美国", "short", "FRED DGS2 的 2 年期美债固定到期收益率。", "与 30 年期比较，观察曲线形态。", "短期快速上行提示政策预期重新定价。", "美联储 H.15 日度观测，并非政策利率预测。", "FRED / H.15", fred("DGS2")),
  indicator("us3m", "美国国债 3 个月期", "macro", "美国", "short", "FRED DGS3MO 的 3 个月期美债固定到期收益率。", "与 10 年期比较，观察期限利差。", "10 年减 3 个月持续为负时关注衰退风险，但不能单独预测衰退。", "期限利差是风险信号，不是纽约联储衰退概率模型。", "FRED / H.15", fred("DGS3MO")),
  indicator("us30_2", "美债 30Y−2Y 利差", "macro", "美国", "long", "同一观测日 DGS30 与 DGS2 之差。", "查看曲线陡峭化或倒挂的持续时间和速度。", "由正转负或快速变化时亮关注灯，需结合信用利差。", "FRED H.15 两端同日自算；不是衰退概率。", "FRED / H.15 · 同日计算", fred("DGS30")),
  indicator("us10_3m", "美债 10Y−3M 利差", "macro", "美国", "long", "同一观测日 DGS10 与 DGS3MO 之差。", "持续倒挂可以提示宏观压力。", "负值标为关注，持续倒挂需结合其他领先数据。", "FRED H.15 两端同日自算；不等同于纽约联储模型概率。", "FRED / H.15 · 同日计算", fred("DGS10")),
  indicator("hyOas", "美国高收益债 OAS", "macro", "美国", "long", "高收益公司债相对国债的期权调整后利差。", "持续扩大常表示信用风险补偿上升。", "按既有五灯规则：高于 5% 或四周扩大逾 1 个百分点为警戒。", "ICE 数据经 FRED 展示，使用及再分发条件需持续复核。", "FRED / ICE BofA", fred("BAMLH0A0HYM2")),
  indicator("igOas", "投资级债券 OAS", "macro", "美国", "long", "投资级公司债相对国债的期权调整后利差。", "与高收益债 OAS 对照，可判断信用压力是否扩散。", "需要历史基准，不凭单个绝对读数定警报。", "ICE 数据经 FRED 发布；按观测日阅读，不能视为盘中报价。", "FRED / ICE BofA", fred("BAMLC0A0CM")),
  indicator("dollar", "广义美元指数", "macro", "美国", "long", "美联储贸易加权广义美元指数。", "美元走强可影响全球金融条件。", "持续快速上升时需结合新兴市场汇率和信用压力。", "这是贸易加权美元指数，不是 ICE DXY。", "FRED / 美联储", fred("DTWEXBGS")),
  indicator("fedWatch", "下次 FOMC 加息 25 基点概率", "macro", "美国", "short", "CME FedWatch 对下一次会议目标利率上移恰好 25 基点的市场隐含概率。", "对照当前目标区间与上移 25 基点的目标区间；不等于所有加息幅度的概率之和。", "概率快速上升时关注利率预期变化，不把它当作美联储承诺。", "手动刷新时读取芝商所公开页面；需本机 Chrome/Edge，页面结构可能改变。显示页面观测日期，不是官方 API 的实时推送。", "CME FedWatch", "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool"),
  indicator("jp10", "日本国债 10 年期", "macro", "日本", "long", "日本财务省公布的 10 年期国债收益率。", "观察持续升息及日元汇率共同变化。", "单日数值不亮灯；需结合历史变化和日本央行政策。", "财务省发布的日度值，不是盘中报价。", "日本财务省", "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/index.htm"),
  indicator("usdjpy", "美元 / 日元", "macro", "日本", "short", "每 1 美元折合多少日元，按 ECB 同日欧元参考价交叉计算。", "数值上升表示日元相对美元走弱。", "短期急变需结合美日利差和政策讯息。", "ECB 日度参考价推算，并非实时现汇。", "欧洲央行", ecb),
  indicator("bojProb", "日本央行加息概率", "macro", "日本", "short", "基于利率期货或 OIS 推导的下次会议加息概率。", "模型与合约映射不同会得出不同概率。", "显著变化时核对期货和央行公告。", "尚无获准且核验通过的统一概率源，不能标为官方概率。", "日本交易所 TONA 期货", "https://www.jpx.co.jp/english/markets/derivatives/settlement-price/index.html"),
  indicator("shibor", "隔夜 Shibor", "macro", "中国", "short", "银行间隔夜拆借利率报价。", "观察境内短期资金松紧与持续变化。", "持续上升需结合央行公开市场操作。", "中国货币网日度公布值，不是实时成交利率。", "中国货币网", chinaMoney),
  indicator("cn10", "中国国债 10 年期", "macro", "中国", "long", "财政部中国国债收益率曲线中的 10 年期限。", "观察国内长期利率方向。", "与 2 年和 30 年利率对照观察曲线变化。", "财政部日度曲线估值，不是单只国债的交易报价。", "财政部 / 中债曲线", chineseBond),
  indicator("cn30_2", "中国国债 30Y−2Y 利差", "macro", "中国", "long", "同日国债 30 年与 2 年收益率之差。", "观察长短端利率形态与变化。", "急速收窄需要结合增长和资金面。", "从财政部同一观测日曲线相减，不是衰退概率。", "财政部 / 中债曲线", chineseBond),
  indicator("usdcny", "美元 / 人民币", "macro", "中国", "short", "每 1 美元折合多少在岸人民币，按 ECB 同日欧元参考价交叉计算。", "数值上升表示人民币相对美元走弱。", "短期急变需结合中间价和市场利率。", "ECB 日度参考价推算，不是官方人民币中间价或离岸 CNH。", "欧洲央行", ecb),
  indicator("vix", "VIX 波动率", "us", "美股", "short", "Cboe 标普 500 期权隐含波动率指数。", "上升通常表明市场为未来波动支付更高价格。", "沿用五灯规则：20–30 关注，高于 30 警戒。", "不预测涨跌方向；需要 Longbridge 会话。", "Longbridge / Cboe", "https://www.cboe.com/tradable_products/vix/"),
  indicator("crowding", "期权拥挤度", "us", "美股", "short", "SPY Put/Call 成交量比的近 260 日分位代理。", "低分位提示 Call 活跃，高分位提示 Put 防守拥挤。", "两端极值亮关注或警戒灯。", "不是全市场交易拥挤度；需要 Longbridge 会话。", "Longbridge", "https://longbridge.com"),
  indicator("breadth", "标普市场宽度", "us", "美股", "short", "标普成分股中位于 50 日及 200 日均线上方的比例。", "两者同步下降表示上涨参与度收缩。", "沿用五灯规则，以两项中较弱者亮灯。", "第三方成分及日均线计算，未必与官方指数完全一致。", "DeanFi", "https://github.com/DeanFinancials/deanfi-data"),
  indicator("leverage", "美国杠杆条件", "us", "美股", "long", "芝加哥联储 NFCI 杠杆子指数。", "观察相对自身近一年分位与周度变化。", "高分位亮关注，极端高位警戒。", "周度代理，不是 FINRA 账户杠杆余额。", "FRED / 芝加哥联储", fred("NFCILEVERAGE")),
  indicator("fearGreed", "恐慌与贪婪", "us", "美股", "short", "CNN 汇总多维美股情绪指标，范围 0–100。", "低值为恐惧，高值为贪婪；极端读数也可能提供反向线索。", "与 VIX、宽度相互印证，不单独发交易信号。", "CNN 自有综合模型，构成和更新频率由其决定。", "CNN Business", "https://www.cnn.com/markets/fear-and-greed"),
  indicator("putCall", "SPY Put / Call", "us", "美股", "short", "SPY 看跌期权成交量除以看涨期权成交量。", "比率升高代表 Put 相对活跃。", "结合自身分位和市场宽度，而非固定数值。", "仅 SPY；不是 Cboe 全市场 Put/Call。", "Longbridge", "https://longbridge.com"),
  indicator("spPe", "标普 500 滚动 PE", "us", "美股", "long", "Shiller 月均标普价格除以其滚动 12 个月每股盈利。", "与自身历史分位及盈利周期对照。", "历史高位可能压缩长期回报空间，但不是短线转折。", "Shiller 月频、最近 EPS 可能滞后数月；卡片标观测日，不推算成今日 PE。", "Shiller 数据镜像", "https://shillerdata.com/"),
  indicator("ndxPe", "纳指 100 滚动 PE", "us", "美股", "long", "纳指 100 指数对过去盈利的估值倍数。", "与自身历史及成分权重变化一起看。", "历史分位需同一提供方完整序列。", "免费估算网站口径不一，未验证可用自动源。", "WorldPEratio", "https://worldperatio.com/index/nasdaq-100/"),
  indicator("spForward", "标普未来一年 PE", "us", "美股", "long", "FactSet 发布的标普 500 未来 12 个月一致预期市盈率。", "预期盈利上修和价格变化都会改变倍数。", "需与同口径历史分位比较。", "FactSet 周报口径，通常每周更新；不是实时指数估值。", "FactSet Earnings Insight", "https://insight.factset.com/All"),
  indicator("ndxForward", "纳指未来一年 PE", "us", "美股", "long", "价格与预期未来一年盈利之比。", "观察估值变化及预期盈利修订。", "需同一来源的完整历史才计算分位。", "MacroMicro 网页限制复制，未获应用展示授权。", "MacroMicro", "https://en.macromicro.me/series/23955/nasdaq-100-pe"),
  indicator("cape", "席勒市盈率", "us", "美股", "long", "以通胀调整后的十年平均盈利计算的周期调整 PE。", "适合多年估值观察，不适合短线择时。", "与自身长历史比较，单月变化不触发日度警报。", "由更新 Shiller 文件的独立镜像转为 JSON；月频、非官方实时行情。", "Shiller 数据镜像", "https://shillerdata.com/"),
  indicator("buffett", "巴菲特指标", "us", "美股", "long", "美联储 Z.1 非金融企业股权市值除以同季美国名义 GDP。", "观察股市相对于经济体量的长期估值；须与同口径历史相比。", "高位提示长期估值敏感，单季读数不触发短线交易信号。", "季频、约滞后一个季度；此代理口径不等于全部上市股票实时总市值。", "FRED / 美联储", fred("NCBEILQ027S")),
  indicator("margin", "沪深两融余额", "china", "A 股", "long", "上交所与深交所同一交易日两融余额之和。", "观察持续增减而非单日波动。", "持续大幅上升可能提示杠杆累积。", "交易所汇总含 ETF 等证券，并非仅 A 股股票；两所日期必须一致。", "上交所 / 深交所", sse),
  indicator("turnover", "沪深 A 股成交额", "china", "A 股", "short", "沪深两市 A 股交易金额之和，不含 B 股和基金。", "看过去数周持续放量或缩量，不能将成交额误称净流入。", "放量伴随价格与涨跌家数变化才有解释力。", "两所同日板块分项相加，不重复加市场总计。", "上交所 / 深交所", "https://www.sse.com.cn/market/stockdata/overview/day/"),
  indicator("allApe", "中证全指滚动 PE", "china", "A 股", "long", "中证全指口径的滚动市盈率。", "与自身历史分位比较；不混用万得全 A 或个股 PE 中位数。", "高分位需结合盈利周期与利率。", "网页读取及再展示权限未核验，无法自动刷新。", "ETF Monitor", "https://www.etfmonitor.cn/graham-index"),
  indicator("etfRatio", "四大 300 ETF / 成分总市值", "china", "A 股", "long", "四只指定沪深 300 ETF 的交易市值合计除以沪深 300 指数成分总市值。", "关注比例与 ETF 份额变化，不能推断特定买方。", "比例持续变化需结合 ETF 申赎和指数成分调整。", "分子是 ETF 份额×价格的交易市值，不是基金净资产；东财五项同日快照，非国家队持仓。", "东方财富", "https://quote.eastmoney.com/center/gridlist.html#fund_etf"),
  indicator("limits", "A 股涨跌停家数", "china", "A 股", "short", "东方财富收盘涨停和跌停股池统计；大数字为涨停家数，卡片说明中列跌停家数。", "结合上涨家数和成交额观察短期情绪。", "需观察多个交易日，不凭单日家数直接亮风险灯。", "采用东方财富股池口径；与交易所全市场定义可能不同，缺任何一侧时不显示。", "东方财富股池", "https://quote.eastmoney.com/ztb/detail"),
];

export const CANARY_IDS = new Set(CANARY_INDICATORS.map((item) => item.id));

export function parseCanarySnapshot(raw: unknown): CanarySnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;
  if (typeof root.refreshedAt !== "string" || !Number.isFinite(Date.parse(root.refreshedAt))) return null;
  const source = root.readings && typeof root.readings === "object" && !Array.isArray(root.readings) ? root.readings as Record<string, unknown> : {};
  const readings: CanarySnapshot["readings"] = {}, errors: CanarySnapshot["errors"] = {};
  for (const [id, value] of Object.entries(source)) {
    if (!CANARY_IDS.has(id) || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const item = value as Record<string, unknown>;
    if (typeof item.value !== "number" || !Number.isFinite(item.value) || typeof item.unit !== "string" || typeof item.asOf !== "string" || !Number.isFinite(Date.parse(item.asOf)) || typeof item.source !== "string" || typeof item.sourceUrl !== "string" || !item.sourceUrl.startsWith("https://") || typeof item.summary !== "string") continue;
    const state = ["green", "amber", "red", "unknown"].includes(String(item.state)) ? item.state as HealthState : "unknown";
    readings[id] = { value: item.value, unit: item.unit, asOf: item.asOf, source: item.source, sourceUrl: item.sourceUrl, summary: item.summary, state, stale: Boolean(item.stale), detail: typeof item.detail === "string" ? item.detail : undefined, points: Array.isArray(item.points) ? item.points.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).slice(-80) : undefined };
  }
  const rawErrors = root.errors && typeof root.errors === "object" && !Array.isArray(root.errors) ? root.errors as Record<string, unknown> : {};
  for (const [id, error] of Object.entries(rawErrors)) if (CANARY_IDS.has(id) && typeof error === "string") errors[id] = error.slice(0, 300);
  return { refreshedAt: root.refreshedAt, readings, errors };
}

export function mergeCanarySnapshot(previous: CanarySnapshot | null, incoming: CanarySnapshot): CanarySnapshot {
  const readings = { ...previous?.readings };
  for (const id of CANARY_IDS) {
    if (incoming.readings[id]) readings[id] = { ...incoming.readings[id], stale: false };
    else if (readings[id]) readings[id] = { ...readings[id], stale: true };
  }
  return { refreshedAt: incoming.refreshedAt, readings, errors: incoming.errors };
}

export function parseEcbDaily(xml: string): { date: string; usdjpy: number; usdcny: number } | null {
  const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/i)?.[1];
  const rate = (currency: string) => {
    const match = xml.match(new RegExp(`<Cube\\s+currency=['"]${currency}['"]\\s+rate=['"]([0-9.]+)['"]`, "i"));
    return match ? Number(match[1]) : NaN;
  };
  const usd = rate("USD"), jpy = rate("JPY"), cny = rate("CNY");
  return date && [usd, jpy, cny].every((value) => Number.isFinite(value) && value > 0) ? { date, usdjpy: jpy / usd, usdcny: cny / usd } : null;
}

export function parseMofJgb(csv: string): { date: string; value: number } | null {
  const rows = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/).map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
  const headerIndex = rows.findIndex((row) => row[0] === "Date");
  if (headerIndex < 0) return null;
  const header = rows[headerIndex];
  const ten = header.findIndex((part) => /^(10Y|10\s*years?|10\s*年)$/i.test(part));
  if (ten < 0) return null;
  const values = rows.slice(headerIndex + 1).flatMap((row) => {
    const parts = row[0]?.split(/[/-]/).map(Number);
    const rawDate = parts?.length === 3 && parts.every(Number.isFinite) ? `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}` : "";
    const value = Number(row[ten]);
    return /^\d{4}-\d{2}-\d{2}$/.test(rawDate ?? "") && Number.isFinite(value) && value > -5 && value < 30 ? [{ date: rawDate!, value }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  return values.at(-1) ?? null;
}

export function parseShiborHistory(raw: unknown): { date: string; value: number; points: number[] } | null {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const rows = Array.isArray(root.records) ? root.records : [];
  const valid = rows.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const date = item.showDateCN, value = Number(item.ON);
    return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      item.ON !== "" && item.ON !== null && Number.isFinite(value) && value >= 0 && value < 30 ? [{ date, value }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  return valid.length ? { ...valid.at(-1)!, points: valid.map((item) => item.value) } : null;
}

export function parseChinaTreasuryHistory(raw: unknown): { date: string; tenYear: number; thirtyMinusTwo: number; tenPoints: number[]; spreadPoints: number[] } | null {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (root.flag !== "0" || !Array.isArray(root.heList)) return null;
  const valid = root.heList.flatMap((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const date = item.workTime, two = Number(item.twoYear), ten = Number(item.tenYear), thirty = Number(item.thirtyYear);
    return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      [item.twoYear, item.tenYear, item.thirtyYear].every((x) => x !== "" && x !== null && x !== undefined) &&
      [two, ten, thirty].every((x) => Number.isFinite(x) && x > -5 && x < 30) ? [{ date, tenYear: ten, thirtyMinusTwo: Number((thirty - two).toFixed(4)) }] : [];
  }).sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
  return valid.length ? { ...valid.at(-1)!, tenPoints: valid.map((item: { tenYear: number }) => item.tenYear), spreadPoints: valid.map((item: { thirtyMinusTwo: number }) => item.thirtyMinusTwo) } : null;
}

export function parseLimitPools(upRaw: unknown, downRaw: unknown, date: string): { date: string; up: number; down: number } | null {
  const count = (raw: unknown) => {
    const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data as Record<string, unknown> : {};
    return root.rc === 0 && Number.isInteger(data.tc) && Number(data.tc) >= 0 &&
      String(data.qdate) === date.replaceAll("-", "") ? Number(data.tc) : null;
  };
  const up = count(upRaw), down = count(downRaw);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && up !== null && up > 0 && down !== null ? { date, up, down } : null;
}

export function alignQuarterlyRatio(equity: { date: string; value: number }[], gdp: { date: string; value: number }[]): { date: string; value: number; points: number[] } | null {
  const byDate = new Map(gdp.filter((item) => Number.isFinite(item.value) && item.value > 0).map((item) => [item.date, item.value]));
  const aligned = equity.flatMap((item) => {
    const denominator = byDate.get(item.date);
    return denominator && Number.isFinite(item.value) && item.value > 0 ? [{ date: item.date, value: item.value / (denominator * 1000) * 100 }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  return aligned.length ? { ...aligned.at(-1)!, points: aligned.map((item) => item.value) } : null;
}

export function findFactsetReport(rss: string): { date: string; sourceUrl: string } | null {
  const feed = new XMLParser().parse(rss) as { rss?: { channel?: { item?: unknown } } };
  const items = Array.isArray(feed.rss?.channel?.item) ? feed.rss.channel.item : [feed.rss?.channel?.item];
  const reports = items.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const title = item.title, link = item.link, published = item.pubDate;
    if (typeof title !== "string" || !/^S&P 500 Earnings Season Update:/i.test(title) || typeof link !== "string" || typeof published !== "string" || !Number.isFinite(Date.parse(published))) return [];
    try { if (new URL(link).origin !== "https://insight.factset.com") return []; } catch { return []; }
    return [{ date: new Date(published).toISOString().slice(0, 10), sourceUrl: link }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  return reports[0] ?? null;
}

export function parseFactsetForwardReport(rss: string, article: string): { date: string; value: number; sourceUrl: string } | null {
  const latest = findFactsetReport(rss);
  const plain = article.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const match = plain.match(/forward 12-month P\/E ratio is\s+([0-9]+(?:\.[0-9]+)?)/i);
  const value = match ? Number(match[1]) : NaN;
  return latest && Number.isFinite(value) && value > 0 && value < 200 ? { ...latest, value } : null;
}

export function parseShillerMonthly(raw: unknown): { cape: { date: string; value: number; points: number[] } | null; trailingPe: { date: string; value: number; points: number[] } | null } {
  const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const rows = Array.isArray(root.data) ? root.data : [];
  const cape: { date: string; value: number }[] = [], trailing: { date: string; value: number }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const date = item.date_string;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const capeValue = Number(item.cape);
    if (item.cape !== null && item.cape !== undefined && Number.isFinite(capeValue) && capeValue > 0 && capeValue < 200) cape.push({ date, value: capeValue });
    const price = Number(item.sp500), earnings = Number(item.earnings);
    if (item.sp500 !== null && item.earnings !== null && item.earnings !== undefined && Number.isFinite(price) && Number.isFinite(earnings) && price > 0 && earnings > 0) trailing.push({ date, value: price / earnings });
  }
  cape.sort((a, b) => a.date.localeCompare(b.date));
  trailing.sort((a, b) => a.date.localeCompare(b.date));
  return {
    cape: cape.length ? { ...cape.at(-1)!, points: cape.map((item) => item.value) } : null,
    trailingPe: trailing.length ? { ...trailing.at(-1)!, points: trailing.map((item) => item.value) } : null,
  };
}

export function parseEtfMarketCapRatio(rawRows: unknown[], rawQuotes: unknown): { date: string; value: number } | null {
  const codes = ["510300", "510330", "159919", "510310", "000300"];
  const caps = new Map<string, number>();
  for (const raw of rawRows) {
    const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data as Record<string, unknown> : {};
    const cap = Number(data.f116);
    if (typeof data.f57 === "string" && codes.includes(data.f57) && Number.isFinite(cap) && cap > 0) caps.set(data.f57, cap);
  }
  const quoteRoot = rawQuotes && typeof rawQuotes === "object" && !Array.isArray(rawQuotes) ? rawQuotes as Record<string, unknown> : {};
  const quoteData = quoteRoot.data && typeof quoteRoot.data === "object" && !Array.isArray(quoteRoot.data) ? quoteRoot.data as Record<string, unknown> : {};
  const quoteRows = Array.isArray(quoteData.diff) ? quoteData.diff : [];
  const dates = new Map<string, string>();
  for (const raw of quoteRows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>, stamp = Number(item.f124);
    if (typeof item.f12 === "string" && codes.includes(item.f12) && Number.isFinite(stamp) && stamp > 0) dates.set(item.f12, new Date(stamp * 1000 + 8 * 3_600_000).toISOString().slice(0, 10));
  }
  const observed = codes.map((code) => dates.get(code));
  const denominator = caps.get("000300");
  if (!denominator || codes.some((code) => !caps.has(code)) || observed.some((date) => !date || date !== observed[0])) return null;
  const total = codes.slice(0, 4).reduce((sum, code) => sum + caps.get(code)!, 0);
  return { date: observed[0]!, value: total / denominator * 100 };
}

export function parseMarginPair(shanghai: unknown, shenzhen: unknown): { date: string; value: number } | null {
  if (!shanghai || typeof shanghai !== "object" || Array.isArray(shanghai) || !Array.isArray(shenzhen)) return null;
  const sh = shanghai as Record<string, unknown>;
  const dateRaw = sh.opDate;
  const amount = Number(sh.rzrqjyzl);
  if (typeof dateRaw !== "string" || !/^\d{8}$/.test(dateRaw) || !Number.isFinite(amount) || amount <= 0) return null;
  const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6)}`;
  const first = shenzhen[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const record = first as Record<string, unknown>;
  const meta = record.metadata as Record<string, unknown> | undefined;
  const data = Array.isArray(record.data) ? record.data[0] as Record<string, unknown> | undefined : record.data as Record<string, unknown> | undefined;
  if (meta?.subname !== date) return null;
  const sz = Number(String(data?.jrrzrjye ?? "").replaceAll(",", ""));
  if (!Number.isFinite(sz) || sz <= 0) return null;
  return { date, value: (amount + sz * 100_000_000) / 1_000_000_000_000 };
}

export function parseTurnoverPair(shanghai: unknown, shenzhen: unknown): { date: string; value: number } | null {
  if (!shanghai || typeof shanghai !== "object" || Array.isArray(shanghai) || !Array.isArray(shenzhen)) return null;
  const rows = (shanghai as Record<string, unknown>).result;
  if (!Array.isArray(rows)) return null;
  const selected = rows.filter((row) => row && typeof row === "object" && ["01", "03"].includes(String((row as Record<string, unknown>).PRODUCT_CODE)));
  if (selected.length !== 2) return null;
  const dates = selected.map((row) => (row as Record<string, unknown>).TRADE_DATE);
  const day = dates[0];
  if (typeof day !== "string" || !/^\d{8}$/.test(day) || dates.some((date) => date !== day)) return null;
  const date = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}`;
  const first = shenzhen[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  const record = first as Record<string, unknown>;
  if ((record.metadata as Record<string, unknown> | undefined)?.subname !== date || !Array.isArray(record.data)) return null;
  const szRows = record.data as Record<string, unknown>[];
  const byName = (name: string) => szRows.find((row) => typeof row.lbmc === "string" && row.lbmc.replace(/&nbsp;|\s/g, "").includes(name));
  const values = [...selected.map((row) => (row as Record<string, unknown>).TRADE_AMT), byName("主板A股")?.cjje, byName("创业板A股")?.cjje].map((value) => Number(String(value ?? "").replaceAll(",", "")));
  return values.length === 4 && values.every((value) => Number.isFinite(value) && value >= 0) ? { date, value: values.reduce((sum, value) => sum + value, 0) / 10_000 } : null;
}

export type CanaryAnalysis = { level: "insufficient" | "stable" | "mixed" | "caution"; title: string; teaser: string; evidence: string[]; contrary: string[]; watch: string[]; limits: string[] };
function recent(reading: CanaryReading | undefined, now: number, maxDays: number): reading is CanaryReading {
  return Boolean(reading && !reading.stale && Number.isFinite(Date.parse(reading.asOf)) && now - Date.parse(reading.asOf) >= -86_400_000 && now - Date.parse(reading.asOf) <= maxDays * 86_400_000);
}
export function buildCanaryAnalysis(snapshot: CanarySnapshot | null, now = Date.now()): { short: CanaryAnalysis; long: CanaryAnalysis } {
  const make = (ids: string[], maxDays: number, horizon: string): CanaryAnalysis => {
    const available = ids.flatMap((id) => {
      const reading = snapshot?.readings[id];
      return recent(reading, now, maxDays) ? [{ id, reading }] : [];
    });
    const missing = ids.length - available.length;
    const evidence = available.filter(({ reading }) => reading.state === "red" || reading.state === "amber").map(({ id, reading }) => `${CANARY_INDICATORS.find((item) => item.id === id)?.title} ${reading.value.toFixed(2)}${reading.unit}（${reading.asOf.slice(0, 10)}）：${reading.summary}`);
    const contrary = available.filter(({ reading }) => reading.state === "green").map(({ id, reading }) => `${CANARY_INDICATORS.find((item) => item.id === id)?.title} ${reading.value.toFixed(2)}${reading.unit}（${reading.asOf.slice(0, 10)}）未同步恶化。`);
    const watch = ["继续核对波动、宽度、信用和利率曲线是否同向变化；单日极值需要后续观测确认。", "如数据源失效或日期不同步，先恢复可比读数，再调整判断。"];
    const limits = [`${horizon}观察取 ${available.length}/${ids.length} 项近期读数；${missing} 项缺失或过期，不参与结论。`, "状态阈值为项目观察规则，不是投资建议或概率预测。"];
    if (available.length < 2) return { level: "insufficient", title: "证据不足", teaser: "当前可比较的有效读数不足，暂不生成市场方向判断。", evidence: [], contrary: [], watch, limits };
    const level = evidence.length >= 2 ? "caution" : evidence.length && contrary.length ? "mixed" : "stable";
    const title = level === "caution" ? "风险信号需关注" : level === "mixed" ? "信号分化" : "暂未见多项风险共振";
    const teaser = level === "caution" ? `${evidence.length} 项近期指标达到关注或警戒条件，需要继续观察是否扩散。` : level === "mixed" ? "部分风险指标升温，但其他读数尚未同步确认。" : "现有近期读数未形成多项风险共振；继续监测变化。";
    return { level, title, teaser, evidence, contrary, watch, limits };
  };
  return { short: make(["vix", "breadth", "fearGreed", "crowding", "putCall", "us10_3m"], 7, "中短期"), long: make(["hyOas", "leverage", "us30_2", "us10_3m", "margin", "jp10"], 45, "中长期") };
}
