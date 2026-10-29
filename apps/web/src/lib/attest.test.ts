import { describe, expect, it } from "vitest";
import { attest, claimsOf, verify } from "./attest";

describe("signed location notes", () => {
  it("verify only untampered, unexpired notes", () => {
    process.env.ATTEST_SECRET = "test-secret";
    const w = attest(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-vercel-ip-country": "US", "x-vercel-ip-city": "Austin" }));
    expect(w).toMatchObject({ ip: "203.0.113.7", country: "US", city: "Austin" });
    expect(verify(w)).toBe(true);
    expect(verify({ ...w, ip: "198.51.100.1" })).toBe(false);
    expect(verify({ ...w, exp: Date.now() - 1 })).toBe(false);
  });

  it("signs who it is and their two-step state; changing any of it breaks the note", () => {
    process.env.ATTEST_SECRET = "test-secret";
    const w = attest(new Headers(), { uid: "u1", aal: "aal1", mfaAt: 0 });
    expect(verify(w)).toBe(true);
    expect(verify({ ...w, aal: "aal2" })).toBe(false);
    expect(verify({ ...w, mfaAt: Date.now() })).toBe(false);
    expect(verify({ ...w, uid: "u2" })).toBe(false);
    const { uid: _u, aal: _a, mfaAt: _m, ...plain } = w;
    expect(verify(plain)).toBe(false);
  });

  it("reads the token's user, level and newest two-step time", () => {
    const body = Buffer.from(JSON.stringify({ sub: "u1", aal: "aal2", amr: [{ method: "password", timestamp: 100 }, { method: "totp", timestamp: 200 }] })).toString("base64url");
    expect(claimsOf(`x.${body}.y`)).toEqual({ uid: "u1", aal: "aal2", mfaAt: 200_000 });
    expect(claimsOf("garbage")).toBeUndefined();
  });
});
