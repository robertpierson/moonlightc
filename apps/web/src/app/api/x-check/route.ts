import { checkXToken } from "@/lib/account-tools";

// Checks an X API bearer token with one real request. The token isn't stored or logged.
export async function POST(req: Request) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return Response.json({ error: "Paste your X bearer token." }, { status: 400 });
  try {
    await checkXToken(token);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't check that token." }, { status: 400 });
  }
}
