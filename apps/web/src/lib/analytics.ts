"use client";

import { accountsEnabled } from "./supabase/client";
import { desktop } from "./desktop";
import pkg from "../../package.json";

// Counts feature use for the /admin dashboard. Only names and small values; never messages, files or keys.
// Does nothing unless accounts are set up, and honors the person's choice where consent is required.

const CONSENT = "moonc:consent";
export const consentChoice = () => {
  try {
    return localStorage.getItem(CONSENT) as "yes" | "no" | null;
  } catch {
    return null;
  }
};
export const setConsent = (v: "yes" | "no") => localStorage.setItem(CONSENT, v);

const surface = () => (desktop() ? "desktop" : matchMedia("(display-mode: standalone)").matches ? "pwa" : "web");

export function track(name: string, props?: Record<string, string | number | boolean>) {
  if (!accountsEnabled || consentChoice() === "no") return;
  fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, props, surface: surface(), consent: consentChoice() === "yes" }), keepalive: true }).catch(() => {});
}

/** Once a day per device, so daily/weekly/monthly active counts work. */
export function trackSessionStart() {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem("moonc:last-session") === today) return;
  localStorage.setItem("moonc:last-session", today);
  track("session.start");
}

/**
 * What kind of error, without any of its text (which could quote someone's words): a crash's type and place in the
 * code, or for an error message a fixed category.
 */
export function errorKind(e: unknown, where = "app") {
  if (e instanceof Error) {
    const at = /([\w-]+\.js):(\d+):\d+/.exec(e.stack ?? "");
    return `${where}:${e.name}${at ? `@${at[1]}:${at[2]}` : ""}`.replace(/[^\w.:/@-]/g, "").slice(0, 40);
  }
  const m = String(e);
  const cat = /credit|quota|billing/i.test(m) ? "credit" : /plan\b/i.test(m) ? "plan" : /rate|too many/i.test(m) ? "rate-limit" : /network|fetch|connect|offline|timeout/i.test(m) ? "network" : /\bkey\b|auth|401|403|sign in/i.test(m) ? "auth" : /model/i.test(m) ? "model" : "other";
  return `${where}:${cat}`;
}

/** Errors in the app, for the staff panel's "what's breaking" list: their kind, the page and the version only. */
let reported = 0;
const seen = new Set<string>();
export function reportError(e: unknown, where = "app") {
  const kind = errorKind(e, where);
  if (seen.has(kind) || reported >= 20) return;
  seen.add(kind);
  reported++;
  track("app.error", { kind, path: location.pathname, version: pkg.version });
}
export function watchErrors() {
  addEventListener("error", (e) => reportError(e.error ?? e.message));
  addEventListener("unhandledrejection", (e) => reportError(e.reason));
}
