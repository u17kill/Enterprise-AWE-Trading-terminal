import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
const nonempty = z.string().trim().min(1);
const topicSchema = z.object({ id: nonempty, name: nonempty, desc: nonempty, note: nonempty });
const institutionSchema = z.object({ id: nonempty, cn: nonempty, en: nonempty, grp: nonempty, kind: nonempty, focus: z.string().default("") });
const reportSchema = z.object({
  id: nonempty, inst: nonempty, topic: nonempty, scope: nonempty, date: isoDate,
  title: nonempty, thesis: nonempty, pts: z.array(nonempty).min(1).max(4),
  tag: z.enum(["bull", "neutral", "bear"]), call: nonempty, src: nonempty,
});
const datasetSchema = z.object({
  as_of: isoDate, topics: z.array(topicSchema).min(1), insts: z.array(institutionSchema).min(1), reports: z.array(reportSchema),
});

export type ResearchDataset = z.infer<typeof datasetSchema>;
export type ResearchTopic = ResearchDataset["topics"][number];
export type ResearchInstitution = ResearchDataset["insts"][number];
export type ResearchReport = ResearchDataset["reports"][number];
export type ResearchSnapshot = {
  asOf: string; windowStart: string; windowEnd: string;
  topics: ResearchTopic[]; institutions: ResearchInstitution[]; reports: ResearchReport[];
  stats: { reports: number; institutions: number; coveredInstitutions: number; coveredCells: number; possibleCells: number };
  topicStats: Record<string, { reports: number; institutions: number }>;
  institutionStats: Record<string, { reports: number; topics: number }>;
};

export const RESEARCH_COUNTRIES: Record<string, string> = {
  us: "美国", ca: "加拿大", uk: "英国", fr: "法国", de: "德国", ch: "瑞士", es: "西班牙", jp: "日本", cn: "中国",
};

export function parseResearchDataset(raw: unknown): ResearchDataset {
  const data = datasetSchema.parse(raw);
  for (const [kind, ids] of [["topic", data.topics.map((item) => item.id)], ["institution", data.insts.map((item) => item.id)], ["report", data.reports.map((item) => item.id)]] as const) {
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${kind} ID`);
  }
  const topics = new Set(data.topics.map((item) => item.id));
  const institutions = new Set(data.insts.map((item) => item.id));
  for (const item of data.insts) if (!RESEARCH_COUNTRIES[item.grp]) throw new Error(`Unknown country: ${item.grp}`);
  for (const report of data.reports) {
    if (!topics.has(report.topic)) throw new Error(`Unknown topic: ${report.id}`);
    if (!institutions.has(report.inst)) throw new Error(`Unknown institution: ${report.id}`);
  }
  return data;
}

export function singaporeToday(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function threeMonthsBefore(today: string): string {
  isoDate.parse(today);
  const [year, month, day] = today.split("-").map(Number);
  const monthIndex = year * 12 + month - 1 - 3;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex - targetYear * 12 + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function buildResearchSnapshot(data: ResearchDataset, today: string): ResearchSnapshot {
  const windowStart = threeMonthsBefore(today);
  const reports = data.reports.filter((report) => report.date >= windowStart && report.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const cells = new Set(reports.map((report) => `${report.inst}\u0000${report.topic}`));
  const topicStats: ResearchSnapshot["topicStats"] = {};
  const institutionStats: ResearchSnapshot["institutionStats"] = {};
  for (const topic of data.topics) {
    const own = reports.filter((report) => report.topic === topic.id);
    topicStats[topic.id] = { reports: own.length, institutions: new Set(own.map((report) => report.inst)).size };
  }
  for (const institution of data.insts) {
    const own = reports.filter((report) => report.inst === institution.id);
    institutionStats[institution.id] = { reports: own.length, topics: new Set(own.map((report) => report.topic)).size };
  }
  return {
    asOf: data.as_of, windowStart, windowEnd: today, topics: data.topics, institutions: data.insts, reports,
    stats: { reports: reports.length, institutions: data.insts.length,
      coveredInstitutions: new Set(reports.map((report) => report.inst)).size,
      coveredCells: cells.size, possibleCells: data.insts.length * data.topics.length },
    topicStats, institutionStats,
  };
}

export function filterResearchSnapshot(snapshot: ResearchSnapshot, today: string): ResearchSnapshot {
  return buildResearchSnapshot({ as_of: snapshot.asOf, topics: snapshot.topics, insts: snapshot.institutions, reports: snapshot.reports }, today);
}
