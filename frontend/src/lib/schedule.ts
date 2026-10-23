const DAY_MS = 24 * 3600e3;

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "Today", "Tomorrow", or "Sat 24 Oct". */
export function dayLabel(dateOrIso: string | Date) {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso.length === 10 ? `${dateOrIso}T12:00:00` : dateOrIso) : dateOrIso;
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** Local calendar date of an instant, as YYYY-MM-DD, for grouping. */
export const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function groupByDay<T>(items: T[], at: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => at(a).localeCompare(at(b)))) {
    const day = localDay(at(item));
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(item);
  }
  return [...groups.entries()];
}
