"use client";

import { ExternalLink, Loader2, Mail, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelPicker } from "@/components/chat/model-picker";
import { googleToken } from "@/lib/oauth-client";
import { findModel, update, useStore, type ModelRef } from "@/lib/store";
import { daysUntil, manageUrl, money, monthlyTotals, nextRenewal, type Subscription } from "@/lib/subscriptions";


export function Subscriptions({ onConnectGoogle }: { onConnectGoogle: () => void }) {
  const subs = useStore((s) => s.subscriptions) ?? { items: [], remindDays: 3 };
  const google = useStore((s) => s.oauth?.google);
  const lastModel = useStore((s) => s.lastModel);
  const [model, setModel] = useState<ModelRef | undefined>(lastModel);
  const [busy, setBusy] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  useEffect(() => {
    fetch("/api/oauth/providers")
      .then((r) => r.json())
      .then((d: { providers: { id: string }[] }) => setGoogleAvailable(d.providers.some((p) => p.id === "google")))
      .catch(() => {});
  }, []);

  const scan = async () => {
    const found = findModel(model);
    if (!found) return toast.error("Pick a model to read the receipts.");
    setBusy(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ google: { accessToken: await googleToken() }, connection: { providerId: found.conn.providerId, apiKey: found.conn.apiKey, baseURL: found.conn.baseURL }, modelId: found.model.id }),
      });
      const d = (await res.json()) as { subscriptions?: Subscription[]; scanned?: number; error?: string };
      if (!res.ok || !d.subscriptions) throw new Error(d.error ?? "The scan failed.");
      update((s) => ({ ...s, subscriptions: { remindDays: 3, reminded: {}, ...s.subscriptions, items: d.subscriptions!, scannedAt: Date.now() } }));
      toast.success(`Found ${d.subscriptions.length} subscriptions in ${d.scanned} receipts.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const items = [...subs.items].sort((a, b) => (nextRenewal(a)?.getTime() ?? Infinity) - (nextRenewal(b)?.getTime() ?? Infinity));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6">
        <section aria-labelledby="subs-h" className="grid gap-3 rounded-xl border p-4">
          <h2 id="subs-h" className="text-lg font-semibold">Subscriptions</h2>
          <p className="text-sm text-muted-foreground">
            Find what you&apos;re subscribed to from your email receipts, see what it costs each month, and get a reminder before each renewal. MoonlightC never
            pays, renews or cancels anything; you do that on each service&apos;s own page.
          </p>
          {google ? (
            <div className="grid gap-3">
              <p className="text-sm">
                When you click scan, MoonlightC reads the sender, subject, date and a short preview of your receipt emails from the last year and sends them to the model you
                pick below to find recurring charges. Nothing else from your mailbox is read, and nothing is stored on our servers.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-md border">
                  <ModelPicker value={model} onChange={setModel} />
                </div>
                <Button onClick={scan} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Mail />} {subs.scannedAt ? "Scan again" : "Scan my Gmail"}
                </Button>
              </div>
            </div>
          ) : googleAvailable ? (
            <Button className="justify-self-start" onClick={onConnectGoogle}>
              Connect Google first
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Scanning email needs the Google connection, which this MoonlightC server hasn&apos;t set up yet. You can add subscriptions yourself below and still get reminders.</p>
          )}
        </section>

        {items.length > 0 && (
          <>
            <section aria-label="Monthly total" className="flex flex-wrap gap-3">
              {monthlyTotals(items).map((t) => (
                <div key={t.currency} className="rounded-xl bg-muted px-4 py-3">
                  <div className="text-2xl font-semibold tabular-nums">{money(t.amount, t.currency)}</div>
                  <div className="text-xs text-muted-foreground">per month ({t.currency})</div>
                </div>
              ))}
              <label className="ml-auto flex items-center gap-2 self-center text-sm">
                Remind me
                <Input
                  type="number"
                  min={0}
                  max={30}
                  aria-label="Days before renewal"
                  className="w-16"
                  value={subs.remindDays}
                  onChange={(e) => update((s) => ({ ...s, subscriptions: { ...s.subscriptions!, remindDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)) } }))}
                />
                days before
              </label>
            </section>
            <ul aria-label="Your subscriptions" className="divide-y rounded-xl border">
              {items.map((s) => {
                const d = nextRenewal(s);
                const url = manageUrl(s);
                return (
                  <li key={s.service} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="min-w-40 flex-1 font-medium">{s.service}</span>
                    <span className="tabular-nums">
                      {money(s.amount, s.currency)} / {s.period === "monthly" ? "month" : s.period === "yearly" ? "year" : "week"}
                    </span>
                    <span className="w-40 text-muted-foreground">{d ? `Renews ${d.toLocaleDateString()} (${daysUntil(d)} days)` : "Renewal date unknown"}</span>
                    {url ? (
                      <Button size="xs" variant="outline" asChild>
                        <a href={url} target="_blank" rel="noreferrer">
                          Manage <ExternalLink />
                        </a>
                      </Button>
                    ) : (
                      <span className="w-[4.5rem]" />
                    )}
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Remove ${s.service}`}
                      onClick={() => update((st) => ({ ...st, subscriptions: { ...st.subscriptions!, items: st.subscriptions!.items.filter((x) => x.service !== s.service) } }))}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {subs.scannedAt && items.length === 0 && <p className="text-sm text-muted-foreground">No recurring charges found in your recent receipts.</p>}
        <AddManually />
      </div>
    </div>
  );
}

function AddManually() {
  const [s, setS] = useState<Subscription>({ service: "", amount: 0, currency: "USD", period: "monthly" });
  return (
    <details>
      <summary className="cursor-pointer text-sm text-muted-foreground">Add one yourself</summary>
      <form
        className="mt-2 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update((st) => ({ ...st, subscriptions: { remindDays: 3, reminded: {}, ...st.subscriptions, items: [...(st.subscriptions?.items ?? []).filter((x) => x.service !== s.service), s] } }));
          setS({ service: "", amount: 0, currency: s.currency, period: "monthly" });
        }}
      >
        <div className="grid gap-1">
          <Label htmlFor="sub-name">Service</Label>
          <Input id="sub-name" required value={s.service} onChange={(e) => setS({ ...s, service: e.target.value })} className="w-40" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sub-amount">Price</Label>
          <Input id="sub-amount" required type="number" step="0.01" min={0} value={s.amount || ""} onChange={(e) => setS({ ...s, amount: Number(e.target.value) })} className="w-24" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sub-cur">Currency</Label>
          <Input id="sub-cur" required maxLength={3} value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value.toUpperCase() })} className="w-20" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sub-period">Every</Label>
          <select id="sub-period" className="h-9 rounded-md border bg-transparent px-2 text-sm" value={s.period} onChange={(e) => setS({ ...s, period: e.target.value as Subscription["period"] })}>
            <option value="monthly">month</option>
            <option value="yearly">year</option>
            <option value="weekly">week</option>
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="sub-next">Next renewal</Label>
          <Input id="sub-next" type="date" value={s.nextRenewal ?? ""} onChange={(e) => setS({ ...s, nextRenewal: e.target.value || undefined })} className="w-40" />
        </div>
        <Button type="submit" variant="outline">
          Add
        </Button>
      </form>
    </details>
  );
}
