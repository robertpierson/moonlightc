"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { desktop } from "@/lib/desktop";
import { getState, update } from "@/lib/store";
import { daysUntil, money, nextRenewal } from "@/lib/subscriptions";

/** Reminds about renewals coming up (in-app; plus a system notification in the desktop app). Never pays or cancels anything. */
export function RenewalReminders() {
  useEffect(() => {
    const check = () => {
      const s = getState().subscriptions;
      if (!s?.items.length) return;
      const reminded = { ...(s.reminded ?? {}) };
      for (const sub of s.items) {
        const d = nextRenewal(sub);
        if (!d) continue;
        const days = daysUntil(d);
        const key = `${sub.service}|${d.toISOString().slice(0, 10)}`;
        if (days < 0 || days > s.remindDays || reminded[key]) continue;
        reminded[key] = Date.now();
        const text = `${sub.service} renews ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`} (${money(sub.amount, sub.currency)}).`;
        toast(text);
        desktop()?.notify("Subscription renewing", text);
      }
      update((st) => ({ ...st, subscriptions: { ...st.subscriptions!, reminded } }));
    };
    check();
    const t = setInterval(check, 6 * 3_600_000);
    return () => clearInterval(t);
  }, []);
  return null;
}
