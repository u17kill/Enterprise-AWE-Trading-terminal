import quotes from "./master-philosophy-quotes.json";

export type Master = {
  id: string;
  name: string;
  englishName: string;
  portrait: string;
  bio: string;
  bioSource: string;
  quotes: readonly string[];
};

export type MasterGroup = { id: string; name: string; masters: readonly Master[] };

type QuoteId = keyof typeof quotes;

function master(id: QuoteId, name: string, englishName: string, bio: string, bioSource: string): Master {
  return { id, name, englishName, portrait: `/master-philosophy/${id}.png`, bio, bioSource, quotes: quotes[id] };
}

// Quote wording follows the user's PPT slides 21–23. Individual original publications were not verified.
export const MASTER_GROUPS: readonly MasterGroup[] = [
  {
    id: "value", name: "价值派", masters: [
      master("buffett", "沃伦·巴菲特", "Warren Buffett", "长期领导伯克希尔·哈撒韦，以企业价值和长期持有为投资主线。", "https://www.berkshirehathaway.com/"),
      master("lynch", "彼得·林奇", "Peter Lynch", "1977 至 1990 年管理富达麦哲伦基金，强调从企业和日常生活中寻找投资线索。", "https://www.fidelity.com/myfidelity/InsideFidelity/NewsCenter/quickFacts/Magellan.html"),
      master("munger", "查理·芒格", "Charlie Munger", "曾任伯克希尔·哈撒韦副董事长，是巴菲特长期的商业伙伴，以多学科思考闻名。", "https://static.moaf.org/docs/Tribute%20to%20Charlie%20Munger.pdf"),
      master("duan", "段永平", "Yongping Duan", "中国企业家与投资人，创办步步高电子；其投资思考常围绕生意模式和长期价值。", "https://www.scmp.com/tech/big-tech/article/2184877/meet-godfather-chinas-smartphone-industry"),
    ],
  },
  {
    id: "allocation", name: "均衡配置派", masters: [
      master("dalio", "瑞·达利欧", "Ray Dalio", "1975 年创立桥水基金，以宏观研究和不同经济环境下的资产配置著称。", "https://www.bridgewater.com/our-founder"),
      master("markowitz", "哈里·马科维茨", "Harry Markowitz", "现代投资组合理论的奠基人，因投资组合选择理论获得 1990 年诺贝尔经济学奖。", "https://www.nobelprize.org/prizes/economic-sciences/1990/press-release/"),
      master("brinson", "加里·布林森", "Gary Brinson", "资产配置研究者，参与发表关于资产配置与组合收益波动的经典研究。", "https://www.aacsb.edu/about-us/advocacy/member-spotlight/influential-leaders/2015/gary-brinson"),
      master("bernstein", "彼得·伯恩斯坦", "Peter L. Bernstein", "金融史与风险研究作家，著有《与天为敌》等有关风险与投资的著作。", "https://www.penguinrandomhouse.com/authors/2174/peter-l-bernstein/"),
    ],
  },
  {
    id: "trading", name: "交易派", masters: [
      master("marks", "霍华德·马克斯", "Howard Marks", "橡树资本联合创始人，以投资备忘录阐述周期、风险和逆向思考。", "https://www.oaktreecapital.com/about/leadership/bio/howard-marks"),
      master("tudor-jones", "保罗·都铎·琼斯", "Paul Tudor Jones", "1980 年创办 Tudor Investment，长期参与全球宏观市场交易。", "https://www.tudor.com/"),
      master("livermore", "杰西·利弗莫尔", "Jesse Livermore", "美国早期股票投机者，因顺势交易和风险控制的经历成为交易史中的著名人物。", "https://www.wiley.com/en-us/jesse-livermore-world%27s-greatest-stock-trader-p-9780471023265"),
      master("soros", "乔治·索罗斯", "George Soros", "创办索罗斯基金管理公司，也是开放社会基金会的创始人。", "https://www.opensocietyfoundations.org/who-we-are"),
    ],
  },
];
