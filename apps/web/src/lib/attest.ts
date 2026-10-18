import { createHmac, timingSafeEqual } from "node:crypto";

// A short-lived, signed note of where a request came from (network address and country, as Vercel sees them),
// so the home PC can allow remote control only from places its owner chose. Can't be forged without the secret.
export type Where = { ip: string; country: string; city: string; exp: number; sig: string };

const sign = (w: Omit<Where, "sig">) => createHmac("sha256", process.env.ATTEST_SECRET ?? "").update(`${w.ip}|${w.country}|${w.city}|${w.exp}`).digest("hex");

export function attest(headers: Headers): Where {
  const ip = (headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "").split(",")[0].trim();
  const w = { ip, country: headers.get("x-vercel-ip-country") ?? "", city: decodeURIComponent(headers.get("x-vercel-ip-city") ?? ""), exp: Date.now() + 5 * 60_000 };
  return { ...w, sig: sign(w) };
}

export function verify(w: Partial<Where>): boolean {
  if (!process.env.ATTEST_SECRET || typeof w.sig !== "string" || typeof w.exp !== "number" || w.exp < Date.now()) return false;
  const good = sign({ ip: String(w.ip ?? ""), country: String(w.country ?? ""), city: String(w.city ?? ""), exp: w.exp });
  return good.length === w.sig.length && timingSafeEqual(Buffer.from(good), Buffer.from(w.sig));
}
