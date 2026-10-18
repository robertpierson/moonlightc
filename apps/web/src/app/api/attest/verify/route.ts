import { verify } from "@/lib/attest";

/** The home PC checks a signed "where" note here before allowing remote control. */
export async function POST(req: Request) {
  const w = await req.json().catch(() => ({}));
  return Response.json({ ok: verify(w) }, { headers: { "cache-control": "no-store" } });
}
