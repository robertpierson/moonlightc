import { verify } from "@/lib/attest";

/** The home PC checks a signed note here before allowing remote control: where it comes from, and (when the note has
 *  them) who it is, their assurance level, and when they last entered a two-step code. */
export async function POST(req: Request) {
  const w = await req.json().catch(() => ({}));
  const ok = verify(w);
  return Response.json(ok && w.uid ? { ok, uid: w.uid, aal: w.aal, mfaAt: w.mfaAt } : { ok }, { headers: { "cache-control": "no-store" } });
}
