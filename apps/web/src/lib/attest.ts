import { createHmac, timingSafeEqual } from "node:crypto";

// A short-lived, signed note of where a request came from (network address and country, as Vercel sees them), and,
// for a signed-in device, who it is and whether it entered its two-step code (and how recently). The home PC uses it
// to allow remote control only from places its owner chose, and for the security level (Settings > Account).
// Can't be forged without the secret.
export type Where = { ip: string; country: string; city: string; exp: number; sig: string; uid?: string; aal?: string; mfaAt?: number };

const text = (w: Omit<Where, "sig">) => `${w.ip}|${w.country}|${w.city}|${w.exp}` + (w.uid ? `|${w.uid}|${w.aal ?? ""}|${w.mfaAt ?? 0}` : "");
const sign = (w: Omit<Where, "sig">) => createHmac("sha256", process.env.ATTEST_SECRET ?? "").update(text(w)).digest("hex");

export function attest(headers: Headers, who?: { uid: string; aal: string; mfaAt: number }): Where {
  const ip = (headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "").split(",")[0].trim();
  const w = { ip, country: headers.get("x-vercel-ip-country") ?? "", city: decodeURIComponent(headers.get("x-vercel-ip-city") ?? ""), exp: Date.now() + 5 * 60_000, ...who };
  return { ...w, sig: sign(w) };
}

export function verify(w: Partial<Where>): boolean {
  if (!process.env.ATTEST_SECRET || typeof w.sig !== "string" || typeof w.exp !== "number" || w.exp < Date.now()) return false;
  const good = sign({ ip: String(w.ip ?? ""), country: String(w.country ?? ""), city: String(w.city ?? ""), exp: w.exp, ...(w.uid ? { uid: String(w.uid), aal: String(w.aal ?? ""), mfaAt: Number(w.mfaAt) || 0 } : {}) });
  return good.length === w.sig.length && timingSafeEqual(Buffer.from(good), Buffer.from(w.sig));
}

/** Who a sign-in token belongs to, its assurance level, and when its two-step code was last entered (ms; 0 = never). */
export function claimsOf(token: string) {
  try {
    const c = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { sub?: string; aal?: string; amr?: { method: string; timestamp: number }[] };
    const mfa = (c.amr ?? []).filter((a) => /totp|mfa/.test(a.method)).map((a) => a.timestamp * 1000);
    return { uid: String(c.sub ?? ""), aal: String(c.aal ?? ""), mfaAt: mfa.length ? Math.max(...mfa) : 0 };
  } catch {
    return undefined;
  }
}
