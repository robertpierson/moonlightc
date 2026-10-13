import { NextResponse, type NextRequest } from "next/server";

// API calls must come from MoonlightC's own pages. Browsers always send Origin on cross-site requests, so other websites
// can't use these endpoints from a visitor's browser. In the desktop app the server listens on 127.0.0.1, and the Host
// check also stops DNS-rebinding tricks.
export function proxy(req: NextRequest) {
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
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
