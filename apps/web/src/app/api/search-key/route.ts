import { readSearchKey, testSearchKey } from "@/lib/tools";

// Checks a web-search key with one real query. The key is not stored or logged.
export async function POST(req: Request) {
  const k = readSearchKey(await req.json().catch(() => null));
  if (!k) return Response.json({ error: "Pick a search provider and paste its key." }, { status: 400 });
  try {
    await testSearchKey(k);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't check that key." }, { status: 400 });
  }
}
