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

/** Errors in the app, for the staff panel's "what's breaking" list: a short message, the page and the version only. */
let reported = 0;
const seen = new Set<string>();
export function reportError(message: string) {
  const m = String(message || "Unknown error").slice(0, 200);
  if (seen.has(m) || reported >= 20) return;
  seen.add(m);
  reported++;
  track("app.error", { message: m, path: location.pathname, version: pkg.version });
}
export function watchErrors() {
  addEventListener("error", (e) => reportError(e.message));
  addEventListener("unhandledrejection", (e) => reportError(e.reason instanceof Error ? e.reason.message : String(e.reason)));
}
