import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// API calls must come from MoonlightC's own pages. Browsers always send Origin on cross-site requests, so other websites
// can't use these endpoints from a visitor's browser. In the desktop app the server listens on 127.0.0.1, and the Host
// check also stops DNS-rebinding tricks.
export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const host = req.headers.get("host") ?? "";
    const origin = req.headers.get("origin");
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {}
      if (originHost !== host) return NextResponse.json({ error: "Requests must come from MoonlightC itself." }, { status: 403 });
    }
    if (process.env.MOONC_DESKTOP === "1" && !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
      return NextResponse.json({ error: "Requests must come from MoonlightC itself." }, { status: 403 });
    }
  }
  return refreshSession(req);
}

/** Keeps the account sign-in fresh (Supabase sessions live in cookies). Skipped when nobody is signed in. */
async function refreshSession(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  if (!SB_URL || !SB_KEY || !req.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return res;
  const sb = createServerClient(SB_URL, SB_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) res.headers.set(k, v);
      },
    },
  });
  await sb.auth.getClaims().catch(() => null);
  // Re-save the sign-in from the server on every visit: browsers (Safari above all) wipe sign-ins a page saved itself
  // after 7 days, but keep ones the server sets.
  for (const c of req.cookies.getAll())
    if (c.name.startsWith("sb-") && !res.cookies.get(c.name)) res.cookies.set(c.name, c.value, { path: "/", sameSite: "lax", secure: req.nextUrl.protocol === "https:", maxAge: 400 * 86_400 });
  return res;
}

export const config = { matcher: ["/api/:path*", "/((?!_next/|icon|manifest|sw\\.js|py-worker|.*\\.(?:svg|png|jpg|webp|ico|js|css|txt|woff2?)$).*)"] };
