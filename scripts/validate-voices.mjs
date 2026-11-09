import { readFileSync } from "node:fs";
import { join } from "node:path";

const directory = join(process.cwd(), "data", "voices");
const parts = Array.from({ length: 9 }, (_, index) => JSON.parse(readFileSync(join(directory, `part${index + 1}.json`), "utf8")));
const categories = parts[0]?.cats;
const errors = [];
if (!Array.isArray(categories) || categories.length !== 6) errors.push("Expected six categories");
if (!Array.isArray(parts[0]?.brief?.items) || parts[0].brief.items.length < 8 || parts[0].brief.items.length > 11) errors.push("Expected 8–11 brief items");
const ids = new Set();
const names = new Set();
let people = 0, points = 0;
const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return false;
  const full = value.length === 7 ? `${value}-01` : value;
  const date = new Date(`${full}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === full;
};
for (const [index, part] of parts.entries()) {
  if (!Array.isArray(part?.people)) { errors.push(`part${index + 1}: missing people`); continue; }
  for (const person of part.people) {
    const id = typeof person?.id === "string" ? person.id.replaceAll("_", "-") : "";
    if (ids.has(id)) continue;
    ids.add(id); people++;
    if (!/^[a-z][a-z0-9-]*$/.test(id)) errors.push(`${id}: invalid id`);
    for (const key of ["name", "cn", "role", "org", "cat", "tag", "stance"]) if (typeof person?.[key] !== "string" || !person[key].trim()) errors.push(`${id}: missing ${key}`);
    const name = typeof person?.name === "string" ? person.name.trim().toLowerCase() : "";
    if (names.has(name)) errors.push(`${id}: duplicate name`);
    names.add(name);
    const category = categories?.find((item) => item.id === person.cat);
    if (!category) errors.push(`${id}: unknown category`);
    if (!["bull", "neutral", "bear"].includes(person.tag)) errors.push(`${id}: invalid tag`);
    if (["macro", "tech_leader", "gov"].includes(person.cat) && !category?.groups?.some((group) => group.id === person.grp)) errors.push(`${id}: invalid group`);
    if (!Array.isArray(person.points)) { errors.push(`${id}: missing points`); continue; }
    for (const point of person.points) {
      points++;
      if (!validDate(point?.date)) errors.push(`${id}: invalid point date`);
      if (typeof point?.src !== "string" || !point.src.trim()) errors.push(`${id}: missing point source`);
      if (typeof point?.text !== "string" || !point.text.trim()) errors.push(`${id}: missing point text`);
    }
  }
}
if (!people || !points) errors.push("Snapshot has no people or points");
if (errors.length) { console.error(`Curated voices validation failed:\n${errors.slice(0, 20).join("\n")}`); process.exitCode = 1; }
else console.log(`Curated voices validated: ${people} people, ${points} points, ${parts[0].brief.items.length} brief items`);
