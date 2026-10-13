export type Schedule = { kind: "daily"; time: string; weekdaysOnly?: boolean } | { kind: "hourly"; every: number };

/** The next time a schedule should run, strictly after `after`. Times are local. */
export function nextRun(s: Schedule, after: Date): Date {
  if (s.kind === "hourly") {
    const step = Math.max(1, Math.min(24, Math.round(s.every))) * 3_600_000;
    return new Date(Math.floor(after.getTime() / step) * step + step);
  }
  const [h, m] = s.time.split(":").map(Number);
  const d = new Date(after);
  d.setHours(h, m, 0, 0);
  if (d <= after) d.setDate(d.getDate() + 1);
  while (s.weekdaysOnly && (d.getDay() === 0 || d.getDay() === 6)) d.setDate(d.getDate() + 1);
  return d;
}

export function describe(s: Schedule) {
  if (s.kind === "hourly") return s.every === 1 ? "Every hour" : `Every ${s.every} hours`;
  return `${s.weekdaysOnly ? "Weekdays" : "Every day"} at ${s.time}`;
}
