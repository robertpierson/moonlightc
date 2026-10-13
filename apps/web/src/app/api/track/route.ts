import { accountsEnabled, adminSupabase, serverSupabase } from "@/lib/supabase/server";
import { cleanProps, CONSENT_COUNTRIES, deviceOf } from "@/lib/track-server";

// Usage stats: event names and a few plain values (never messages, files or keys). Signed-in people only, plus
// anonymous download counts. Where the law needs it, nothing is counted without the person's yes.

const country = (req: Request) => req.headers.get("x-vercel-ip-country")?.toUpperCase() || null;

export async function GET(req: Request) {
  return Response.json({ consentNeeded: accountsEnabled && CONSENT_COUNTRIES.has(country(req) ?? "") });
}

export async function POST(req: Request) {
  if (!accountsEnabled) return new Response(null, { status: 204 });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; props?: unknown; surface?: unknown; consent?: unknown };
  const name = typeof body.name === "string" && /^[a-z0-9_.]{1,60}$/.test(body.name) ? body.name : undefined;
  if (!name) return Response.json({ error: "Bad event." }, { status: 400 });
  const where = country(req);
  if (CONSENT_COUNTRIES.has(where ?? "") && body.consent !== true) return new Response(null, { status: 204 });
  const surface = body.surface === "pwa" || body.surface === "desktop" ? body.surface : "web";
  const row = { name, props: cleanProps(body.props), country: where, surface, ...deviceOf(req.headers.get("user-agent") ?? "") };

  const sb = await serverSupabase();
  const { data } = await sb.auth.getUser();
  if (data.user) {
    await sb.from("events").insert({ ...row, user_id: data.user.id });
    if (name === "session.start" && where) await sb.from("profiles").update({ country: where }).eq("id", data.user.id).is("country", null);
  } else if (name === "download" && process.env.SUPABASE_SECRET_KEY) {
    await adminSupabase().from("events").insert(row);
  }
  return new Response(null, { status: 204 });
}
