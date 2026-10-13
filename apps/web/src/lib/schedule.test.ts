import { describe as d, expect, it } from "vitest";
import { nextRun } from "./schedule";

d("nextRun", () => {
  it("daily: later today, else tomorrow", () => {
    expect(nextRun({ kind: "daily", time: "08:00" }, new Date(2026, 9, 13, 7, 0)).getHours()).toBe(8);
    const n = nextRun({ kind: "daily", time: "08:00" }, new Date(2026, 9, 13, 9, 0));
    expect([n.getDate(), n.getHours()]).toEqual([14, 8]);
  });
  it("weekdays skip the weekend", () => {
    const fri = new Date(2026, 9, 16, 9, 0); // Friday
    expect(nextRun({ kind: "daily", time: "08:00", weekdaysOnly: true }, fri).getDay()).toBe(1);
  });
  it("hourly steps", () => {
    const n = nextRun({ kind: "hourly", every: 6 }, new Date(Date.UTC(2026, 9, 13, 5, 30)));
    expect(n.getTime() % (6 * 3_600_000)).toBe(0);
    expect(n > new Date(Date.UTC(2026, 9, 13, 5, 30))).toBe(true);
  });
});
