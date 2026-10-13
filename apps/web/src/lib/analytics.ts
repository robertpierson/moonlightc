"use client";

import { accountsEnabled } from "./supabase/client";
import { desktop } from "./desktop";

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
