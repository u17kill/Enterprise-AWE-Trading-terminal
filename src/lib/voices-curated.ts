export const VOICE_TAGS = ["bull", "neutral", "bear"] as const;
export type CuratedTag = typeof VOICE_TAGS[number];
export type CuratedPoint = { date: string; src: string; text: string };
export type CuratedPerson = { id: string; name: string; cn: string; role: string; org: string; cat: string; grp?: string; tag: CuratedTag; stance: string; points: CuratedPoint[] };
export type CuratedCategory = { id: string; name: string; desc: string; groups?: { id: string; name: string }[] };
export type CuratedVoiceData = {
  as_of: string; window: [string, string]; updated: string;
  brief: { title: string; items: { h: string; t: string }[] };
  cats: CuratedCategory[]; people: CuratedPerson[];
};
export type CuratedCategoryStats = { id: string; name: string; people: number; points: number; bull: number; neutral: number; bear: number };
export type CuratedFreshness = { id: string; cn: string; cat: string; latest: string; days: number };
export type CuratedVoiceSummary = { people: number; points: number; categories: CuratedCategoryStats[]; stale: CuratedFreshness[]; empty: string[]; checkedAt: string };
export type CuratedVoiceSnapshot = { data: CuratedVoiceData; summary: CuratedVoiceSummary; warnings: string[] };

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const filled = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const dateValue = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return null;
  const full = value.length === 7 ? `${value}-01` : value;
  const date = new Date(`${full}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== full ? null : date;
};

/** Merge part1..part9 in supplied order; the first occurrence of an id wins. */
export function mergeCuratedParts(parts: unknown[]): CuratedVoiceData {
  const first = parts[0];
  if (!record(first) || !record(first.brief) || !Array.isArray(first.cats)) throw new Error("策展分片缺少首页或分类数据");
  const seen = new Set<string>();
  const people: CuratedPerson[] = [];
  for (const part of parts) {
    if (!record(part) || !Array.isArray(part.people)) throw new Error("策展分片缺少人物列表");
    for (const raw of part.people) {
      const id = record(raw) && typeof raw.id === "string" ? raw.id.replaceAll("_", "-") : "";
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      people.push({ ...raw as CuratedPerson, id });
    }
  }
  return { ...first, people } as CuratedVoiceData;
}

export function validateCuratedVoices(data: CuratedVoiceData): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  if (!dateValue(data.as_of) || !Array.isArray(data.window) || data.window.length !== 2 || !data.window.every((date) => typeof date === "string" && !!dateValue(date))) errors.push("snapshot date/window invalid");
  const catIds = new Set(data.cats.map((cat) => cat.id));
  if (catIds.size !== data.cats.length) errors.push("duplicate category id");
  if (!Array.isArray(data.brief?.items) || data.brief.items.length < 8 || data.brief.items.length > 11) errors.push("brief items must be 8–11");
  const ids = new Set<string>(), names = new Set<string>();
  for (const person of data.people) {
    const label = person?.id || "(missing id)";
    if (!filled(person?.id) || !/^[a-z][a-z0-9-]*$/.test(person.id)) errors.push(`${label}: id invalid`);
    else if (ids.has(person.id)) errors.push(`${label}: duplicate id`);
    ids.add(person?.id);
    for (const key of ["name", "cn", "role", "org", "cat", "tag", "stance"] as const) if (!filled(person?.[key])) errors.push(`${label}: ${key} missing`);
    if (filled(person?.name) && names.has(person.name.trim().toLowerCase())) errors.push(`${label}: duplicate person`);
    if (filled(person?.name)) names.add(person.name.trim().toLowerCase());
    const category = data.cats.find((cat) => cat.id === person?.cat);
    if (!category || !catIds.has(person.cat)) errors.push(`${label}: cat unknown`);
    if (!VOICE_TAGS.includes(person?.tag)) errors.push(`${label}: tag invalid`);
    const grouped = ["macro", "tech_leader", "gov"].includes(person?.cat);
    if (grouped && (!filled(person.grp) || !category?.groups?.some((group) => group.id === person.grp))) errors.push(`${label}: grp invalid`);
    if (!grouped && person?.grp) errors.push(`${label}: grp not allowed`);
    if (!Array.isArray(person?.points)) { errors.push(`${label}: points invalid`); continue; }
    if (!person.points.length) warnings.push(`${label}: no points`);
    if (person.points.length > 5) warnings.push(`${label}: more than five points`);
    for (const [index, point] of person.points.entries()) {
      if (!filled(point?.date) || !dateValue(point.date)) errors.push(`${label} point ${index + 1}: date invalid`);
      if (!filled(point?.src)) errors.push(`${label} point ${index + 1}: src missing`);
      if (!filled(point?.text)) errors.push(`${label} point ${index + 1}: text missing`);
      if (typeof point?.text === "string" && point.text.length > 220) warnings.push(`${label} point ${index + 1}: text over 220`);
      const value = typeof point?.date === "string" ? dateValue(point.date) : null;
      const start = dateValue(data.window?.[0] ?? ""), end = dateValue(data.window?.[1] ?? "");
      if (value && start && end && (value < start || value > end)) warnings.push(`${label} point ${index + 1}: date outside window`);
    }
  }
  return { errors, warnings };
}

export function summarizeCuratedVoices(data: CuratedVoiceData, now = new Date()): CuratedVoiceSummary {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const stale: CuratedFreshness[] = [], empty: string[] = [];
  for (const person of data.people) {
    if (!person.points.length) { empty.push(person.id); continue; }
    const latest = [...person.points].sort((a, b) => b.date.localeCompare(a.date))[0].date;
    const when = dateValue(latest);
    if (!when) continue;
    const days = Math.floor((today.getTime() - when.getTime()) / 86_400_000);
    if (days > 30) stale.push({ id: person.id, cn: person.cn, cat: person.cat, latest, days });
  }
  stale.sort((a, b) => b.days - a.days);
  return {
    people: data.people.length,
    points: data.people.reduce((sum, person) => sum + person.points.length, 0),
    categories: data.cats.map((cat) => {
      const people = data.people.filter((person) => person.cat === cat.id);
      return { id: cat.id, name: cat.name, people: people.length, points: people.reduce((sum, person) => sum + person.points.length, 0), bull: people.filter((person) => person.tag === "bull").length, neutral: people.filter((person) => person.tag === "neutral").length, bear: people.filter((person) => person.tag === "bear").length };
    }),
    stale, empty, checkedAt: today.toISOString().slice(0, 10),
  };
}

export function filterCuratedPeople(people: CuratedPerson[], query: string, tag: CuratedTag | "all"): CuratedPerson[] {
  const needle = query.trim().toLocaleLowerCase();
  return people.filter((person) => (tag === "all" || person.tag === tag) && (!needle || [person.name, person.cn, person.role, person.org, person.stance, ...person.points.map((point) => point.text)].some((value) => value.toLocaleLowerCase().includes(needle))));
}
