import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

export type FedHike25 = {
  meetingDate: string;
  asOf: string;
  value: number;
  currentRange: string;
  targetRange: string;
};

const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function parseDate(text: string): string | null {
  const match = text.match(/^(\d{1,2})\s+(\d{1,2}月|[A-Za-z]{3})\s*(\d{4})$/);
  if (!match) return null;
  const month = match[2].endsWith("月") ? Number(match[2].slice(0, -1)) : MONTHS[match[2].slice(0, 1).toUpperCase() + match[2].slice(1).toLowerCase()];
  const day = Number(match[1]), year = Number(match[3]);
  if (!month || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

export function parseNextFedHike25(text: string): FedHike25 | null {
  const meeting = text.match(/Target Rate Probabilities for\s+(\d{1,2}\s+(?:\d{1,2}月|[A-Za-z]{3})\s*\d{4})\s+Fed Meeting/i);
  const observed = text.match(/\*\s*Data as of\s+(\d{1,2}\s+(?:\d{1,2}月|[A-Za-z]{3})\s*\d{4})/i);
  const current = text.match(/Current target rate is\s+(\d+)-(\d+)/i);
  const meetingDate = meeting && parseDate(meeting[1]), asOf = observed && parseDate(observed[1]);
  if (!meetingDate || !asOf || !current) return null;
  const low = Number(current[1]), high = Number(current[2]);
  if (high - low !== 25) return null;
  const target = `${low + 25}-${high + 25}`;
  const table = text.slice(text.toUpperCase().indexOf("TARGET RATE (BPS)"));
  if (!table.startsWith("TARGET RATE (BPS)")) return null;
  const row = table.split(/\r?\n/).find((line) => line.trim().startsWith(`${target}\t`));
  const value = row ? Number(row.slice(target.length).match(/([\d.]+)\s*%/)?.[1]) : NaN;
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return { meetingDate, asOf, value, currentRange: `${low}–${high}`, targetRange: `${low + 25}–${high + 25}` };
}

function chromePath(): string {
  const paths = [
    process.env.CHROME_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const found = paths.find((path): path is string => Boolean(path && existsSync(path)));
  if (!found) throw new Error("本地未安装可用于读取 CME 页面的 Chrome 或 Edge");
  return found;
}

export async function fetchNextFedHike25(): Promise<FedHike25> {
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true, timeout: 20_000 });
  try {
    const page = await browser.newPage();
    await page.goto("https://www.cmegroup.cn/fed-watch/", { waitUntil: "domcontentloaded", timeout: 20_000 });
    for (let attempt = 0; attempt < 18; attempt++) {
      const frame = page.frames().find((item) => item.url().includes("QuikStrikeView.aspx"));
      if (frame) {
        const result = parseNextFedHike25(await frame.locator("body").innerText({ timeout: 2_000 }).catch(() => ""));
        if (result) return result;
      }
      await page.waitForTimeout(1_000);
    }
    throw new Error("CME 页面未返回可核对的下一次会议目标利率概率");
  } finally {
    await browser.close();
  }
}
