// Kenya is UTC+3 all year (no DST). All "today/this week/this month"
// boundaries in the app are computed in Nairobi time.

export type Range = "today" | "week" | "month" | "all";

export const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
export const MS_PER_DAY = 86_400_000;

/** Start (UTC ms) of the current Nairobi calendar day. */
export function startOfNairobiDay(now: number): number {
  const shifted = now + NAIROBI_OFFSET_MS;
  return Math.floor(shifted / MS_PER_DAY) * MS_PER_DAY - NAIROBI_OFFSET_MS;
}

export function startOfNairobiDaysAgo(now: number, daysAgo: number): number {
  return startOfNairobiDay(now) - daysAgo * MS_PER_DAY;
}

/** Start (UTC ms) of the Nairobi calendar month that `now` falls in. */
export function startOfNairobiMonth(now: number): number {
  const shifted = new Date(now + NAIROBI_OFFSET_MS);
  const utcMonthStart = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    1,
  );
  return utcMonthStart - NAIROBI_OFFSET_MS;
}

export interface RangeWindow {
  from: number;
  label: string;
}

/** Lower bound (inclusive) for a named range, plus a human label. */
export function rangeWindow(range: Range, now: number): RangeWindow {
  switch (range) {
    case "today":
      return { from: startOfNairobiDay(now), label: "today" };
    case "week":
      return { from: startOfNairobiDaysAgo(now, 6), label: "in the last 7 days" };
    case "month":
      return { from: startOfNairobiMonth(now), label: "this month" };
    case "all":
    default:
      return { from: 0, label: "of all time" };
  }
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "5 Oct" style label for a timestamp, in Nairobi time. */
export function dayLabel(t: number): string {
  const d = new Date(t + NAIROBI_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** "Oct 25" style month label for a timestamp, in Nairobi time. */
export function monthLabel(t: number): string {
  const d = new Date(t + NAIROBI_OFFSET_MS);
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
