"use client";

import { useEffect } from "react";

/** Notes where a first-time visitor came from (campaign tags and referring site), kept on this device until sign-up. */
export function Arrival() {
  useEffect(() => {
    try {
      if (localStorage.getItem("moonc:arrival")) return;
      const q = new URLSearchParams(location.search);
      const utm = Object.fromEntries([...q].filter(([k]) => k.startsWith("utm_")).map(([k, v]) => [k, v.slice(0, 100)]));
      const ref = document.referrer && new URL(document.referrer).host !== location.host ? new URL(document.referrer).host : undefined;
      localStorage.setItem("moonc:arrival", JSON.stringify({ utm, referrer: ref }));
    } catch {}
  }, []);
  return null;
}
