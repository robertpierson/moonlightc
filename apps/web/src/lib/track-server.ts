// Shared rules for usage stats: what may be recorded, and where a consent prompt is legally needed.

// EU/EEA, UK and Switzerland: ask before counting anything.
export const CONSENT_COUNTRIES = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH".split(" "));

/** Only short, plain values; never text that could be a message, file name or key. */
export function cleanProps(raw: unknown): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw).slice(0, 8)) {
    if (!/^[a-z_]{1,24}$/.test(k)) continue;
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && /^[\w.:/-]{1,40}$/.test(v)) out[k] = v;
  }
  return out;
}

export function deviceOf(ua: string) {
  const os = /windows/i.test(ua) ? "windows" : /iphone|ipad/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : /mac os/i.test(ua) ? "mac" : /cros/i.test(ua) ? "chromeos" : /linux/i.test(ua) ? "linux" : "other";
  const browser = /edg\//i.test(ua) ? "edge" : /chrome|crios/i.test(ua) ? "chrome" : /firefox|fxios/i.test(ua) ? "firefox" : /safari/i.test(ua) ? "safari" : "other";
  return { os, browser };
}
