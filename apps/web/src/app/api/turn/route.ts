import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { accountsEnabled, serverSupabase } from "@/lib/supabase/server";

// Relay passes for remote control on networks that block direct video (Cloudflare TURN). Short-lived credentials are
// made here from the secret key, only for signed-in people; the key itself never leaves the server.
export const dynamic = "force-dynamic";

const KEY_ID = process.env.TURN_KEY_ID;
const KEY_TOKEN = process.env.TURN_KEY_API_TOKEN;
const SITE = "https://moonlightc.vercel.app";
const none = () => NextResponse.json({ iceServers: [] }, { headers: { "cache-control": "no-store" } });

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer (\S+)$/.exec(auth)?.[1];
  // The desktop app's own server has no relay key: it asks the website, with the same sign-in.
  if (!KEY_ID || !KEY_TOKEN) {
    if (process.env.MOONC_DESKTOP !== "1" || !bearer) return none();
    const r = await fetch(`${SITE}/api/turn`, { headers: { authorization: auth }, cache: "no-store" }).catch(() => undefined);
    return r?.ok ? NextResponse.json(await r.json(), { headers: { "cache-control": "no-store" } }) : none();
  }
  if (!accountsEnabled) return none();
  const sb = bearer ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!) : await serverSupabase();
  const { data } = await (bearer ? sb.auth.getUser(bearer) : sb.auth.getUser());
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${KEY_ID}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { authorization: `Bearer ${KEY_TOKEN}`, "content-type": "application/json" },
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
