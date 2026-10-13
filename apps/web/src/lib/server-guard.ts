import { ProviderError, type Connection } from "@moonc/core";

// ponytail: hostname check only; a public name that resolves to a private IP (DNS rebinding) passes. Resolve + check IPs if this proxy ever runs next to private services.
/** Our servers must never be pointed at private networks (SSRF). Local servers are reached from the desktop app instead. */
export function isPublicURL(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  const h = u.hostname.replace(/^\[|\]$/g, "");
  // Local end-to-end tests only (a mock provider on 127.0.0.1). Never set this on Vercel.
  if (process.env.MOONC_ALLOW_PRIVATE_URLS === "1" && !process.env.VERCEL && h === "127.0.0.1") return true;
  return !(
    u.protocol !== "https:" ||
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    /^(::1?|f[cd][0-9a-f]{2}:|fe80:)/i.test(h)
  );
}

export function assertPublicURL(c: Connection) {
  if (c.providerId !== "custom") return;
  if (!isPublicURL(c.baseURL ?? "")) {
    throw new ProviderError(
      "The web app can only reach public https:// servers. For a server on your own computer (LM Studio, Ollama), use the MoonlightC desktop app.",
    );
  }
}

export function readConnection(body: unknown): Connection {
  const b = body as Partial<Connection> | null;
  if (!b || typeof b.providerId !== "string" || typeof b.apiKey !== "string") {
    throw new ProviderError("Missing provider or key.");
  }
  const c: Connection = { providerId: b.providerId, apiKey: b.apiKey.trim(), baseURL: b.baseURL?.trim() || undefined };
  assertPublicURL(c);
  return c;
}
