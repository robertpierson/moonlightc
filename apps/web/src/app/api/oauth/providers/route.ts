import { connection } from "next/server";
import { configured } from "@/lib/oauth";

const SITE = "https://moonlightc.vercel.app";

// Which sign-in connectors can be offered. The desktop app has no client secrets, so it asks the website,
// and its sign-ins run through the website and come back via a moonlightc:// link.
export async function GET() {
  await connection();
  if (process.env.MOONC_DESKTOP === "1") {
    const remote = await fetch(`${SITE}/api/oauth/providers`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : { providers: [] }))
      .catch(() => ({ providers: [] }));
    return Response.json({ providers: remote.providers ?? [], startBase: SITE });
  }
  return Response.json({ providers: configured().map((p) => ({ id: p.id, name: p.name })), startBase: "" });
}
