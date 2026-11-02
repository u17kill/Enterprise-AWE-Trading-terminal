export type TemperatureBar = { date: string; close: number; volume: number; turnover: number };
export type TemperatureResult = { score: number | null; position: number | null; crowding: number | null; momentum: number | null; asOf: string | null; history: { date: string; value: number }[]; sample: number };

function mean(values: number[]) { return values.reduce((a, b) => a + b, 0) / values.length; }
function rank(values: (number | null)[], index: number): number | null {
  const current = values[index];
  if (current === null || !Number.isFinite(current)) return null;
  const window = values.slice(Math.max(0, index - 249), index + 1).filter((value): value is number => value !== null && Number.isFinite(value));
  if (window.length < 175) return null;
  const below = window.filter((value) => value < current).length, tied = window.filter((value) => value === current).length;
  return 100 * (below + (tied + 1) / 2) / window.length;
}
function combine(parts: (number | null)[], weights: number[]): number | null {
  if (parts.some((part) => part === null)) return null;
  return parts.reduce<number>((sum, part, i) => sum + part! * weights[i], 0);
}

export function calculateTemperature(target: TemperatureBar[], denominator: TemperatureBar[]): TemperatureResult {
  const other = new Map(denominator.filter((bar) => Number.isFinite(bar.turnover) && bar.turnover > 0).map((bar) => [bar.date, bar]));
  const rows = target.filter((bar) => Number.isFinite(bar.close) && bar.close > 0 && Number.isFinite(bar.volume) && bar.volume > 0 && Number.isFinite(bar.turnover) && bar.turnover > 0 && other.has(bar.date)).sort((a, b) => a.date.localeCompare(b.date));
  const closes = rows.map((row) => row.close);
  const share = rows.map((row) => row.turnover / other.get(row.date)!.turnover);
  const bias: (number | null)[] = [], boll: (number | null)[] = [], drawdown: (number | null)[] = [], volatility: (number | null)[] = [], ra: (number | null)[] = [], rsi: (number | null)[] = [];
  let gains = 0, losses = 0;
  for (let i = 0; i < rows.length; i++) {
    const close = closes[i], prior = closes[i - 1];
    const change = i ? close - prior : 0;
    gains = i ? gains * 5 / 6 + Math.max(change, 0) / 6 : 0;
    losses = i ? losses * 5 / 6 + Math.max(-change, 0) / 6 : 0;
    rsi.push(i < 6 ? null : 100 - 100 / (1 + gains / Math.max(losses, 1e-12)));
    const last20 = closes.slice(Math.max(0, i - 19), i + 1);
    if (last20.length === 20) {
      const ma = mean(last20), sd = Math.sqrt(last20.reduce((s, x) => s + (x - ma) ** 2, 0) / 19);
      bias.push(close / ma - 1);
      boll.push(sd > 0 ? Math.min(1, Math.max(0, (close - ma + 2 * sd) / (4 * sd))) : null);
    } else { bias.push(null); boll.push(null); }
    const past = closes.slice(Math.max(0, i - 249), i + 1);
    drawdown.push(past.length >= 120 ? (close / Math.max(...past) - 1) * 100 : null);
    const returns = i >= 20 ? closes.slice(i - 19, i + 1).map((v, j) => j === 0 ? v / closes[i - 20] - 1 : v / closes[i - 20 + j] - 1) : [];
    const vmean = returns.length === 20 ? mean(returns) : 0;
    const vol = returns.length === 20 ? Math.sqrt(returns.reduce((s, x) => s + (x - vmean) ** 2, 0) / 19) : null;
    volatility.push(vol);
    ra.push(i >= 10 && vol && vol > 0 ? (close / closes[i - 10] - 1) / (vol * Math.sqrt(10)) : null);
  }
  const volume = rows.map((row) => row.volume), absoluteRa = ra.map((value) => value === null ? null : Math.abs(value));
  let smooth: number | null = null;
  const history: { date: string; value: number }[] = [];
  let position: number | null = null, crowding: number | null = null, momentum: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const p = combine([rank(bias, i), rank(boll, i), rank(drawdown, i)], [.4, .3, .3]);
    const c = combine([rank(share, i), rank(volatility, i), rank(volume, i)], [.5, .3, .2]);
    const d = ra[i] === null ? null : 50 + .5 * Math.sign(ra[i]!) * (rank(absoluteRa, i) ?? NaN);
    const m = combine([rsi[i], d !== null && Number.isFinite(d) ? d : null], [.5, .5]);
    const raw = combine([p, c, m], [.4, .35, .25]);
    if (raw !== null) { smooth = smooth === null ? raw : .5 * raw + .5 * smooth; history.push({ date: rows[i].date, value: smooth }); }
    if (i === rows.length - 1) { position = p; crowding = c; momentum = m; }
  }
  const latestDate = rows.at(-1)?.date ?? null;
  return { score: history.at(-1)?.date === latestDate ? smooth : null, position, crowding, momentum, asOf: latestDate, history, sample: rows.length };
}
