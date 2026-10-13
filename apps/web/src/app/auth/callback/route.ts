import { NextResponse, type NextRequest } from "next/server";
import { accountsEnabled, serverSupabase } from "@/lib/supabase/server";

// Email links and provider sign-ins land here with a one-time code, which becomes the session cookie.
export async function GET(req: NextRequest) {
  if (!accountsEnabled) return new NextResponse(null, { status: 404 });
  const url = req.nextUrl;
  const raw = url.searchParams.get("next");
  const next = raw && /^\/(?![/\\])/.test(raw) ? raw : "/app";
  const fail = (msg: string) => NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(msg)}`, url.origin));
  const providerError = url.searchParams.get("error_description");
  if (providerError) return fail(providerError);
  const code = url.searchParams.get("code");
  if (!code) return fail("That sign-in link is incomplete. Try signing in again.");

  const sb = await serverSupabase();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("That link expired or was already used. Sign in again, or request a new link.");
  if (next !== "/auth/reset") {
    const { data: profile } = await sb.from("profiles").select("onboarded_at").eq("id", data.user.id).maybeSingle();
    if (!profile?.onboarded_at) return NextResponse.redirect(new URL(`/onboarding?next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
