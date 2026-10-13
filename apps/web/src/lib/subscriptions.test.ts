import { describe, expect, it } from "vitest";
import { daysUntil, manageUrl, monthlyTotals, nextRenewal, type Subscription } from "./subscriptions";

const sub = (p: Partial<Subscription>): Subscription => ({ service: "Netflix Standard", amount: 15.49, currency: "USD", period: "monthly", ...p });

describe("subscriptions", () => {
  it("totals per currency per month", () => {
    const t = monthlyTotals([sub({}), sub({ service: "Domain", amount: 120, period: "yearly" }), sub({ service: "Spotify", amount: 10.99, currency: "EUR" })]);
    expect(t).toEqual([
      { currency: "USD", amount: 25.49 },
      { currency: "EUR", amount: 10.99 },
    ]);
  });
  it("estimates the next renewal from the last charge", () => {
    const today = new Date("2026-10-13T09:00:00");
    expect(nextRenewal(sub({ lastCharged: "2026-09-20" }), today)?.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(nextRenewal(sub({ lastCharged: "2025-11-01", period: "yearly" }), today)?.toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(nextRenewal(sub({ nextRenewal: "2026-12-01" }), today)?.getMonth()).toBe(11);
    expect(nextRenewal(sub({}), today)).toBeUndefined();
    expect(daysUntil(new Date("2026-10-20T12:00:00"), today)).toBe(7);
    expect(daysUntil(new Date("2026-10-14T00:30:00"), new Date("2026-10-13T23:50:00"))).toBe(1);
  });
  it("finds manage links, preferring safe ones from receipts", () => {
    expect(manageUrl(sub({}))).toBe("https://www.netflix.com/account");
    expect(manageUrl(sub({ manageUrl: "javascript:alert(1)" }))).toBe("https://www.netflix.com/account");
    expect(manageUrl(sub({ service: "Tiny Co" }))).toBeUndefined();
  });
});
