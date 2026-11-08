import Link from "next/link";
import { serverSupabase } from "@/lib/supabase/server";

// Staff sections of /admin: who's here now, the people using MoonlightC, one person's recent activity, and errors.
// Each database call checks for an admin with two-step sign-in, because these show emails.

type User = { id: string; email: string; display_name: string | null; created_at: string; last_active: string | null; signup_method: string | null; country: string | null; onboarded: boolean; events_30d: number; errors_7d: number; connections: number; chats: number; devices: number };
type Live = { active: { email: string; at: string; surface: string }[]; pcs_online: { name: string; email: string; app_version: string | null; is_home: boolean }[]; events_last_hour: number; errors_last_hour: number };
type ErrorRow = { message: string; count: number; people: number; last_seen: string; path: string | null; version: string | null; surface: string | null };
type Detail = { events: { name: string; props: Record<string, unknown>; surface: string | null; os: string | null; browser: string | null; created_at: string }[]; devices: { name: string; os: string | null; app_version: string | null; last_seen: string; remote_enabled: boolean; is_home: boolean }[]; providers: string[] };

const when = (t?: string | null) => (t ? new Date(t).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "–");

export async function Staff({ q, user }: { q: string; user?: string }) {
  const sb = await serverSupabase();
  const [live, users, errors, detail] = await Promise.all([
    sb.rpc("staff_live"),
    sb.rpc("staff_users", { q, lim: 100, skip: 0 }),
    sb.rpc("staff_errors", { days: 7 }),
    user ? sb.rpc("staff_user", { uid: user }) : Promise.resolve({ data: null, error: null }),
  ]);
  if (live.error || users.error)
    return (
      <section aria-label="Staff" className="rounded-xl border p-4 text-sm">
        Enter your two-step code to see people and errors: open <Link href="/app" className="text-link underline">the app</Link>, then Settings &gt; Staff.
      </section>
    );
  const l = live.data as Live;
  const list = users.data as User[];
  const errs = (errors.data ?? []) as ErrorRow[];
  const d = detail.data as Detail | null;
  const picked = user && list.find((u) => u.id === user);

  return (
    <div className="grid gap-8">
      <section aria-label="Right now" className="grid gap-3">
        <h2 className="font-semibold">Right now</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Using it (15 min)", l.active.length],
            ["PCs online", l.pcs_online.length],
            ["Events this hour", l.events_last_hour],
            ["Errors this hour", l.errors_last_hour],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border p-4">
              <div className="text-sm text-muted-foreground">{k}</div>
              <div className="text-2xl font-semibold">{v}</div>
            </div>
          ))}
        </div>
        {(l.active.length > 0 || l.pcs_online.length > 0) && (
          <ul className="grid gap-1 text-sm">
            {l.active.map((a) => (
              <li key={a.email}>
                {a.email} <span className="text-muted-foreground">· {a.surface} · {when(a.at)}</span>
              </li>
            ))}
            {l.pcs_online.map((p) => (
              <li key={p.email + p.name}>
                PC {p.name} ({p.email}) <span className="text-muted-foreground">· app {p.app_version ?? "?"}{p.is_home ? " · home PC" : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="People" className="grid gap-3">
        <h2 className="font-semibold">People ({list.length}{list.length === 100 ? "+" : ""})</h2>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search by email or name" aria-label="Search people" className="h-9 w-72 rounded-lg border bg-transparent px-3 text-sm" />
          <button className="rounded-lg border px-3 text-sm hover:bg-muted">Search</button>
        </form>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                {["Person", "Joined", "Last active", "Signed up with", "Models", "Chats", "PCs", "Events (30d)", "Errors (7d)"].map((h) => (
                  <th key={h} className="p-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((u) => (
                <tr key={u.id} className={u.id === user ? "bg-muted" : ""}>
                  <td className="p-2">
                    <Link href={`/admin?${new URLSearchParams({ ...(q ? { q } : {}), user: u.id })}#person`} className="text-link underline underline-offset-4">
                      {u.email}
                    </Link>
                    {u.display_name && <div className="text-xs text-muted-foreground">{u.display_name}</div>}
                  </td>
                  <td className="p-2 whitespace-nowrap">{when(u.created_at)}</td>
                  <td className="p-2 whitespace-nowrap">{when(u.last_active)}</td>
                  <td className="p-2">{u.signup_method ?? "–"}</td>
                  <td className="p-2 tabular-nums">{u.connections}</td>
                  <td className="p-2 tabular-nums">{u.chats}</td>
                  <td className="p-2 tabular-nums">{u.devices}</td>
                  <td className="p-2 tabular-nums">{u.events_30d}</td>
                  <td className={`p-2 tabular-nums ${u.errors_7d ? "text-destructive" : ""}`}>{u.errors_7d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {d && (
        <section id="person" aria-label="Person" className="grid gap-3">
          <h2 className="font-semibold">{picked ? picked.email : "Person"}: recent activity</h2>
          <p className="text-sm text-muted-foreground">
            Models connected: {d.providers.length ? d.providers.join(", ") : "none"} · PCs:{" "}
            {d.devices.length ? d.devices.map((p) => `${p.name} (app ${p.app_version ?? "?"}, seen ${when(p.last_seen)}${p.is_home ? ", home PC" : ""})`).join("; ") : "none"}
          </p>
          <ul className="grid max-h-96 gap-1 overflow-y-auto rounded-xl border p-3 text-xs">
            {d.events.map((e, i) => (
              <li key={i} className={e.name === "app.error" ? "text-destructive" : ""}>
                {when(e.created_at)} · <strong>{e.name}</strong>
                {Object.keys(e.props ?? {}).length ? ` · ${JSON.stringify(e.props).slice(0, 160)}` : ""}
                <span className="text-muted-foreground"> · {[e.surface, e.os, e.browser].filter(Boolean).join(", ")}</span>
              </li>
            ))}
            {!d.events.length && <li className="text-muted-foreground">No activity yet.</li>}
          </ul>
        </section>
      )}

      <section aria-label="Errors" className="grid gap-3">
        <h2 className="font-semibold">What&apos;s breaking (7 days)</h2>
        {errs.length ? (
          <ul className="grid gap-2">
            {errs.map((e) => (
              <li key={e.message} className="rounded-xl border p-3 text-sm">
                <div className="font-medium break-words">{e.message}</div>
                <div className="text-xs text-muted-foreground">
                  {e.count}× · {e.people} {e.people === 1 ? "person" : "people"} · last {when(e.last_seen)} · {e.surface ?? "?"} · {e.path ?? ""} · version {e.version ?? "?"}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No errors reported this week.</p>
        )}
      </section>
    </div>
  );
}
