import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { accountsEnabled, serverSupabase } from "@/lib/supabase/server";

// Relay passes for remote control on networks that block direct video (Cloudflare TURN). Short-lived credentials are
// made here, only for signed-in people: from their own key (Settings > Account), or for the owner account from the
// server's key. Keys never reach the browser.
const KEY_ID = process.env.TURN_KEY_ID;
const KEY_TOKEN = process.env.TURN_KEY_API_TOKEN;
const SITE = "https://moonlightc.vercel.app";
// Cloudflare's relay is free up to 1,000 GB a month; at about 3.5 GB an hour of 60 fps video, 200 hours stays well
// inside it. Past that, no relay until next month (remote control falls back to pictures), so it never costs money.
const MONTHLY_MINUTES = 200 * 60;
const none = () => NextResponse.json({ iceServers: [] }, { headers: { "cache-control": "no-store" } });

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer (\S+)$/.exec(auth)?.[1];
  // The desktop app's own server has no relay key: it asks the website, with the same sign-in.
  // The desktop app's own server has no relay key: it asks the website, with the same sign-in.
  if (process.env.MOONC_DESKTOP === "1") {
    if (!bearer) return none();
    const r = await fetch(`${SITE}/api/turn`, { headers: { authorization: auth }, cache: "no-store" }).catch(() => undefined);
    return r?.ok ? NextResponse.json(await r.json(), { headers: { "cache-control": "no-store" } }) : none();
  }
  if (!accountsEnabled) return none();
  const sb = bearer
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { global: { headers: { authorization: auth } }, auth: { persistSession: false } })
    : await serverSupabase();
  const { data } = await (bearer ? sb.auth.getUser(bearer) : sb.auth.getUser());
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (((await sb.rpc("relay_minutes_this_month")).data ?? 0) >= MONTHLY_MINUTES) return none();
  // Their own key first; the server's key only for the owner account.
  const own = (await sb.rpc("get_my_relay_key")).data as { key_id: string; token: string } | null;
  const owner = !own && !!(await sb.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle()).data?.is_admin;
  const key = own ? { id: own.key_id, token: own.token } : owner && KEY_ID && KEY_TOKEN ? { id: KEY_ID, token: KEY_TOKEN } : undefined;
  if (!key) return none();
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${key.id}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { authorization: `Bearer ${key.token}`, "content-type": "application/json" },
    body: JSON.stringify({ ttl: 86_400 }),
  }).catch(() => undefined);
  if (!r?.ok) return none();
  const d = (await r.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
  const list = Array.isArray(d.iceServers) ? d.iceServers : d.iceServers ? [d.iceServers] : [];
  // Browsers block port 53; leaving those out avoids waiting for them to time out.
  const iceServers = list
    .map((s) => ({ ...s, urls: ([] as string[]).concat(s.urls).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length);
  return NextResponse.json({ iceServers }, { headers: { "cache-control": "no-store" } });
}
