export interface Subscription {
  service: string;
  amount: number;
  currency: string;
  period: "weekly" | "monthly" | "yearly";
  lastCharged?: string; // YYYY-MM-DD
  nextRenewal?: string; // YYYY-MM-DD
  manageUrl?: string;
}

// Where people cancel or change the most common subscriptions (used when a receipt doesn't include a link).
export const MANAGE_URLS: Record<string, string> = {
  netflix: "https://www.netflix.com/account",
  spotify: "https://www.spotify.com/account/subscription/",
  "youtube premium": "https://www.youtube.com/paid_memberships",
  "disney+": "https://www.disneyplus.com/account",
  hulu: "https://secure.hulu.com/account",
  "amazon prime": "https://www.amazon.com/mc",
  "apple": "https://apps.apple.com/account/subscriptions",
  "icloud": "https://apps.apple.com/account/subscriptions",
  "google one": "https://one.google.com/settings",
  chatgpt: "https://chatgpt.com/#settings/Account",
  claude: "https://claude.ai/settings/billing",
  "microsoft 365": "https://account.microsoft.com/services",
  "xbox": "https://account.microsoft.com/services",
  "playstation": "https://www.playstation.com/acct/subscriptions",
  "github": "https://github.com/settings/billing",
  "adobe": "https://account.adobe.com/plans",
  "dropbox": "https://www.dropbox.com/account/plan",
  "canva": "https://www.canva.com/settings/billing-and-plans",
  "duolingo": "https://www.duolingo.com/settings/subscription",
  "audible": "https://www.audible.com/account/overview",
};

export function manageUrl(s: Subscription) {
  if (s.manageUrl && /^https:\/\//.test(s.manageUrl)) return s.manageUrl;
  const key = Object.keys(MANAGE_URLS).find((k) => s.service.toLowerCase().includes(k));
  return key ? MANAGE_URLS[key] : undefined;
}

export const monthly = (s: Subscription) => (s.period === "monthly" ? s.amount : s.period === "yearly" ? s.amount / 12 : (s.amount * 52) / 12);

/** Totals per currency (people often pay in more than one). */
export function monthlyTotals(subs: Subscription[]) {
  const totals: Record<string, number> = {};
  for (const s of subs) totals[s.currency] = (totals[s.currency] ?? 0) + monthly(s);
  return Object.entries(totals).map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }));
}

/** When the next renewal is, estimated from the last charge if the receipt didn't say. */
export function nextRenewal(s: Subscription, today = new Date()): Date | undefined {
  if (s.nextRenewal) return new Date(`${s.nextRenewal}T12:00:00`);
  if (!s.lastCharged) return undefined;
  const d = new Date(`${s.lastCharged}T12:00:00`);
  while (d <= today) {
    if (s.period === "weekly") d.setDate(d.getDate() + 7);
    else if (s.period === "yearly") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/** Whole calendar days from today (0 = today, 1 = tomorrow). */
export function daysUntil(d: Date, today = new Date()) {
  const day = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((day(d) - day(today)) / 86_400_000);
}

export const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};
