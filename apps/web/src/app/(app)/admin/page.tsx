import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { accountsEnabled, serverSupabase } from "@/lib/supabase/server";
import { Staff } from "./staff";

export const metadata: Metadata = { title: "Staff · MoonlightC", robots: { index: false } };

type Overview = {
  users: number;
  dau: number;
  wau: number;
  mau: number;
  activated: number;
  signups: { day: string; count: number }[];
  retention: Record<"d1" | "d7" | "d30", { eligible: number; retained: number } | undefined>;
  signup_methods: Record<string, number>;
  providers: Record<string, number>;
  top_features: { name: string; count: number }[];
  surfaces: Record<string, number>;
  local_vs_cloud: Record<string, number>;
  downloads: Record<string, number>;
  heard_from: Record<string, number>;
  uses: Record<string, number>;
  tools: Record<string, number>;
};

export default function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; user?: string }> }) {
  if (!accountsEnabled) notFound();
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8">
      <header className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">MoonlightC staff panel</h1>
        <Link href="/app" className="ml-auto text-sm text-link underline underline-offset-4">
          Back to the app
        </Link>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Loading numbers…</p>}>
        <Numbers />
        <StaffFor params={searchParams} />
      </Suspense>
    </main>
  );
}

async function Numbers() {
  const sb = await serverSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/signin?next=/admin");
  // The database refuses anyone who isn't an admin; to everyone else this page doesn't exist.
  const { data, error } = await sb.rpc("admin_overview", { days: 30 });
  if (error || !data) notFound();
  const o = data as Overview;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  return (
    <div className="grid gap-8">
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Users", o.users],
          ["Active today", o.dau],
          ["Active this week", o.wau],
          ["Active this month", o.mau],
          ["Activated", `${o.activated} (${pct(o.activated, o.users)})`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border p-4">
            <div className="text-sm text-muted-foreground">{k}</div>
            <div className="text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </section>
      <section aria-label="Retention" className="grid gap-2">
        <h2 className="font-semibold">Came back</h2>
        <p className="text-sm text-muted-foreground">Share of people who used MoonlightC again 1, 7 and 30 days after signing up (activated = connected a model and sent a message).</p>
        <div className="grid grid-cols-3 gap-3">
          {(["d1", "d7", "d30"] as const).map((k) => (
            <div key={k} className="rounded-xl border p-4">
              <div className="text-sm text-muted-foreground">Day {k.slice(1)}</div>
              <div className="text-2xl font-semibold">{pct(o.retention[k]?.retained ?? 0, o.retention[k]?.eligible ?? 0)}</div>
              <div className="text-xs text-muted-foreground">of {o.retention[k]?.eligible ?? 0} people</div>
            </div>
          ))}
        </div>
      </section>
      <Bars title="Sign-ups per day (last 30 days)" data={Object.fromEntries(o.signups.map((s) => [s.day, s.count]))} keepOrder />
      <div className="grid gap-8 md:grid-cols-2">
        <Bars title="How people signed up" data={o.signup_methods} />
        <Bars title="AI providers connected" data={o.providers} />
        <Bars title="Most-used features (30 days)" data={Object.fromEntries(o.top_features.map((f) => [f.name, f.count]))} />
        <Bars title="Where people use it" data={o.surfaces} />
        <Bars title="Local vs cloud messages (30 days)" data={o.local_vs_cloud} />
        <Bars title="Downloads by system" data={o.downloads} />
        <Bars title="How people heard about us" data={o.heard_from} />
        <Bars title="What people use AI for" data={o.uses} />
        <Bars title="AI tools people already use" data={o.tools} />
      </div>
    </div>
  );
}

function Bars({ title, data, keepOrder }: { title: string; data: Record<string, number>; keepOrder?: boolean }) {
  const rows = Object.entries(data ?? {});
  if (!keepOrder) rows.sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <section aria-label={title} className="grid gap-2">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="grid gap-1.5">
          {rows.slice(0, 20).map(([k, n]) => (
            <li key={k} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-2 text-sm">
              <span className="truncate">{k}</span>
              <span className="h-2.5 rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary dark:bg-foreground" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function StaffFor({ params }: { params: Promise<{ q?: string; user?: string }> }) {
  const { q = "", user } = await params;
  return <Staff q={q.slice(0, 100)} user={user && /^[0-9a-f-]{36}$/.test(user) ? user : undefined} />;
}
