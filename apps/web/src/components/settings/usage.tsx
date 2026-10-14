"use client";

import { getProvider } from "@moonc/core";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStore, type SavedConnection } from "@/lib/store";
import { bigNumber, isAiPlan, money, monthValue, REFERENCE_PRICE, summarizeUsage } from "@/lib/usage";
import { monthly, money as currency } from "@/lib/subscriptions";
import { update } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OpenRouterUsage = { label?: string; used: number; limit: number | null; limitRemaining: number | null; freeTier: boolean; credits: { total: number; used: number } | null };

function OpenRouterCard({ conn }: { conn: SavedConnection }) {
  const [u, setU] = useState<OpenRouterUsage | { error: string }>();
  useEffect(() => {
    fetch("/api/usage/openrouter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: conn.apiKey }) })
      .then((r) => r.json())
      .then(setU)
      .catch(() => setU({ error: "Couldn't reach OpenRouter." }));
  }, [conn.apiKey]);
  if (!u) return <Loader2 className="size-4 animate-spin" aria-label="Loading OpenRouter usage" />;
  if ("error" in u) return <p className="text-sm text-muted-foreground">{u.error}</p>;
  const left = u.credits ? u.credits.total - u.credits.used : null;
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      {[
        ["Credits left", left === null ? "–" : money(left)],
        ["Spent with this key", money(u.used)],
        ["Key spending limit", u.limit === null ? "None" : money(u.limit)],
        ["Plan", u.freeTier ? "Free tier (lower rate limits)" : "Paid"],
      ].map(([k, v]) => (
        <div key={k} className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Settings > Usage: what you've used on this device, and live limits where the provider shares them. */
export function UsagePanel() {
  const chats = useStore((s) => s.chats);
  const connections = useStore((s) => s.connections);
  const s = useMemo(() => summarizeUsage(chats, connections.flatMap((c) => c.models)), [chats, connections]);
  const max = Math.max(1, ...s.daily.map((d) => d.tokens));
  return (
    <div className="grid gap-8">
      <Plans />
      <section aria-label="Last 30 days" className="grid gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Messages (30 days)", s.total.messages.toLocaleString()],
            ["Tokens (30 days)", s.total.tokens.toLocaleString()],
            ["Estimated cost (30 days)", money(s.total.cost)],
            ["Tokens today", s.today.tokens.toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="text-xl font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <div aria-label="Tokens per day" className="flex h-24 items-end gap-0.5 rounded-xl border p-2">
          {s.daily.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.tokens.toLocaleString()} tokens, ${money(d.cost)}`} className="flex-1 rounded-sm bg-foreground/70" style={{ height: `${Math.max(2, (d.tokens / max) * 100)}%`, opacity: d.tokens ? 1 : 0.15 }} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Counted from replies on this device. Costs are estimates from each provider&apos;s listed prices; your provider&apos;s bill is the final word.</p>
      </section>

      <section aria-label="By model" className="grid gap-2">
        <h3 className="font-medium">By model</h3>
        {s.byModel.length ? (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">Model</th>
                  <th className="p-2 text-right font-medium">Messages</th>
                  <th className="p-2 text-right font-medium">Tokens in</th>
                  <th className="p-2 text-right font-medium">Tokens out</th>
                  <th className="p-2 text-right font-medium">Est. cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {s.byModel.map((r) => (
                  <tr key={r.modelId}>
                    <td className="max-w-56 truncate p-2">{r.modelId}</td>
                    <td className="p-2 text-right tabular-nums">{r.messages}</td>
                    <td className="p-2 text-right tabular-nums">{r.input.toLocaleString()}</td>
                    <td className="p-2 text-right tabular-nums">{r.output.toLocaleString()}</td>
                    <td className="p-2 text-right tabular-nums">{r.cost === undefined ? "–" : money(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No usage yet. Send a message and it shows up here.</p>
        )}
      </section>

      <section aria-label="Limits and credits" className="grid gap-3">
        <h3 className="font-medium">Limits and credits</h3>
        {connections.length === 0 && <p className="text-sm text-muted-foreground">Connect a provider to see its limits.</p>}
        {connections.map((c) => {
          const p = getProvider(c.providerId);
          return (
            <div key={c.id} className="grid gap-2 rounded-xl border p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{c.label}</span>
                {p.keyUrl && (
                  <a className="ml-auto text-link underline underline-offset-4" href={p.keyUrl} target="_blank" rel="noreferrer">
                    Your {p.name} account <ExternalLink className="inline size-3" />
                  </a>
                )}
              </div>
              {c.providerId === "openrouter" ? (
                <OpenRouterCard conn={c} />
              ) : (
                <p className="text-sm text-muted-foreground">{p.local ? "Runs on this computer: no limits or costs." : `${p.name} doesn't share balances or limits with apps; check them in your ${p.name} account.`}</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

/** Top of Usage: what you pay for AI, how many tokens you used this month, and what that would cost at list prices. */
function Plans() {
  const chats = useStore((s) => s.chats);
  const connections = useStore((s) => s.connections);
  const subs = useStore((s) => s.subscriptions?.items) ?? [];
  const plans = subs.filter(isAiPlan);
  const v = useMemo(() => monthValue(chats, connections.flatMap((c) => c.models)), [chats, connections]);
  const planTotal = plans.filter((p) => p.currency === "USD").reduce((t, p) => t + monthly(p), 0);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(price);
    if (!name.trim() || !(amount >= 0)) return;
    update((s) => ({ ...s, subscriptions: { remindDays: 3, ...s.subscriptions, items: [...(s.subscriptions?.items ?? []), { service: name.trim().slice(0, 60), amount, currency: "USD", period: "monthly" }] } }));
    setName("");
    setPrice("");
  };
  return (
    <section aria-label="Your plans" className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["You pay for AI", `${currency(planTotal + v.spent, "USD")} this month`, `${plans.length ? `${currency(planTotal, "USD")} in plans` : "No plans added"} + ${money(v.spent)} on API keys`],
          ["Tokens this month", `${bigNumber(v.tokens)} tokens`, `${v.tokens.toLocaleString()} exactly`],
          ["Worth at list prices", money(v.listValue), v.estimated ? `Models without a listed price counted at $${REFERENCE_PRICE.input}/$${REFERENCE_PRICE.output} per million tokens in/out` : "What these tokens cost at the companies' API prices"],
        ].map(([k, big, small]) => (
          <div key={k} className="grid gap-1 rounded-xl border p-4">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="text-2xl font-semibold">{big}</div>
            <div className="text-xs text-muted-foreground">{small}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <h3 className="font-medium">Your AI plans</h3>
        {plans.length ? (
          <ul className="divide-y rounded-xl border">
            {plans.map((p, i) => (
              <li key={`${p.service}-${i}`} className="flex items-center gap-2 p-3 text-sm">
                <span className="flex-1 font-medium">{p.service}</span>
                <span>
                  {currency(p.amount, p.currency)} / {p.period === "monthly" ? "month" : p.period === "yearly" ? "year" : "week"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Add the AI plans you pay for (ChatGPT Plus, Claude Pro…) to see your full AI bill. Plans found in Subscriptions show up here too.</p>
        )}
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <Input aria-label="Plan name" placeholder="Plan, for example Claude Pro" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
          <Input aria-label="Monthly price in US dollars" placeholder="$ per month" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" />
          <Button type="submit" variant="outline" disabled={!name.trim() || !price}>
            Add plan
          </Button>
        </form>
      </div>
    </section>
  );
}
