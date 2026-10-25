import type { Manager } from "./leader-holdings";

export type HoldingRow = {
  symbol: string | null;
  issuer: string;
  securityClass: string;
  cusip: string;
  valueThousands: number;
  percent: number | null;
  shares: number | null;
  principal: number | null;
  optionType: "put" | "call" | null;
};

export type FilingRef = {
  period: string;
  filedAt: string;
  accession: string;
  formType: string;
  reportedValueThousands: number | null;
  sourceCik: string;
  secUrl: string;
  providerUrl: string;
};

export type ManagerSnapshot = FilingRef & {
  cik: string;
  holdingsCount: number;
  nonOptionCount: number;
  optionCount: number;
  totalValueThousands: number;
  topHoldings: HoldingRow[];
  checkedAt: string;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "text" | "json">>;

function cellText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function secFilingUrl(cik: string, accession: string): string {
  const match = accession.match(/^(\d{10})(\d{2})(\d{6})$/);
  if (!match) throw new Error("申报编号格式不正确");
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${match[1]}-${match[2]}-${match[3]}-index.htm`;
}

export function parseManagerFilings(html: string, manager: Manager): FilingRef {
  const table = html.match(/<table\b[^>]*id="managerFilings"[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  if (!table) throw new Error(`${manager.name} 的申报目录不可读取`);

  for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 7) continue;
    const formType = cellText(cells[4][2]).toUpperCase();
    if (!["13F-HR", "13F-HR/A", "13F-NT", "RESTATEMENT"].includes(formType)) continue;
    const period = cells[0][1].match(/data-order="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const filedAt = cells[5][1].match(/data-order="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const valueText = cellText(cells[2][2]).replace(/,/g, "");
    const reportedValueThousands = valueText && Number.isFinite(Number(valueText)) ? Number(valueText) : null;
    const href = cells[0][2].match(/href="(\/13f\/([^"/]+))"/)?.[1];
    const accession = href?.match(/^\/13f\/(\d{18})-/)?.[1];
    if (!period || !filedAt || !href || !accession) continue;
    if (formType === "13F-NT" && manager.cik !== "0001336528") throw new Error(`${manager.name} 的 13F-NT 尚未确认代报主体`);
    const sourceCik = formType === "13F-NT" ? "0002026053" : manager.cik;
    return { period, filedAt, accession, formType, reportedValueThousands, sourceCik, secUrl: secFilingUrl(sourceCik, accession), providerUrl: `https://13f.info${href}` };
  }
  throw new Error(`${manager.name} 暂无可安全使用的完整 13F`);
}

export function parseHoldingRows(payload: unknown): HoldingRow[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) throw new Error("持仓数据格式不正确");
  const raw = (payload as { data: unknown[] }).data;
  if (!raw.length) throw new Error("持仓表为空");
  return raw.map((item) => {
    if (!Array.isArray(item) || item.length < 9 || typeof item[1] !== "string" || typeof item[3] !== "string") throw new Error("持仓条目格式不正确");
    const valueThousands = Number(item[4]);
    const percent = item[5] == null ? null : Number(item[5]);
    const shares = item[6] == null ? null : Number(item[6]);
    const principal = item[7] == null ? null : Number(item[7]);
    const optionType = item[8] == null || item[8] === "" ? null : String(item[8]).toLowerCase();
    if (!Number.isFinite(valueThousands) || valueThousands < 0 || (percent !== null && !Number.isFinite(percent)) || (shares !== null && !Number.isFinite(shares)) || (principal !== null && !Number.isFinite(principal)) || (optionType !== null && optionType !== "put" && optionType !== "call")) throw new Error("持仓数值或期权类型不正确");
    return {
      symbol: typeof item[0] === "string" && item[0] ? item[0] : null,
      issuer: item[1],
      securityClass: typeof item[2] === "string" ? item[2] : "",
      cusip: item[3],
      valueThousands,
      percent,
      shares,
      principal,
      optionType,
    } as HoldingRow;
  }).sort((a, b) => b.valueThousands - a.valueThousands);
}

export function parseSecUrl(html: string, filing: FilingRef): string {
  const links = [...html.matchAll(/href="(https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/[^"\s]+)"/gi)];
  const prefix = `https://www.sec.gov/Archives/edgar/data/${Number(filing.sourceCik)}/${filing.accession}/`;
  const match = links.map((item) => item[1]).find((url) => url.startsWith(prefix) && /-index\.html?$/i.test(url));
  if (!match) throw new Error("SEC 原件链接不可读取");
  return match;
}

export async function fetchManagerSnapshot(manager: Manager, previous?: ManagerSnapshot, fetcher: Fetcher = fetch): Promise<ManagerSnapshot> {
  const page = await fetcher(`https://13f.info/manager/${manager.cik}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!page.ok) throw new Error(`${manager.name} 的申报目录暂不可用`);
  const filing = parseManagerFilings(await page.text(), manager);
  const checkedAt = new Date().toISOString();
  if (previous?.accession === filing.accession && previous.period === filing.period) return { ...previous, ...filing, secUrl: previous.secUrl, checkedAt };

  const detail = await fetcher(filing.providerUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!detail.ok) throw new Error(`${manager.name} 的申报详情暂不可用`);
  filing.secUrl = parseSecUrl(await detail.text(), filing);

  const table = await fetcher(`https://13f.info/data/13f/${filing.accession}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!table.ok) throw new Error(`${manager.name} 的持仓表暂不可用`);
  const rows = parseHoldingRows(await table.json());
  const nonOptions = rows.filter((row) => row.optionType === null);
  return {
    ...filing,
    cik: manager.cik,
    holdingsCount: rows.length,
    nonOptionCount: nonOptions.length,
    optionCount: rows.length - nonOptions.length,
    totalValueThousands: filing.reportedValueThousands ?? rows.reduce((sum, row) => sum + row.valueThousands, 0),
    topHoldings: nonOptions.slice(0, 12),
    checkedAt,
  };
}

export async function refreshSnapshots(
  roster: Manager[],
  previous: Record<string, ManagerSnapshot>,
  get: typeof fetchManagerSnapshot = fetchManagerSnapshot,
): Promise<{ asOf: string; managers: Record<string, ManagerSnapshot>; failures: string[] }> {
  const managers = { ...previous };
  const failures: string[] = [];
  let index = 0;
  async function worker() {
    while (index < roster.length) {
      const manager = roster[index++];
      try {
        managers[manager.cik] = await get(manager, managers[manager.cik]);
      } catch {
        failures.push(manager.cik);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, roster.length) }, () => worker()));
  return { asOf: new Date().toISOString(), managers, failures };
}
