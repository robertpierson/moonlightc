import { OPENROUTER } from "@moonc/core";

// Turns a one-time OpenRouter sign-in code (plus the PKCE secret only this device has) into an API key.
// The key goes straight back to the device; it isn't stored or logged here.
export async function POST(req: Request) {
  const { code, verifier } = (await req.json().catch(() => ({}))) as { code?: unknown; verifier?: unknown };
  if (typeof code !== "string" || typeof verifier !== "string" || !code || verifier.length < 43) {
    return Response.json({ error: "That sign-in link is incomplete. Try Sign in with OpenRouter again." }, { status: 400 });
  }
  const res = await fetch(`${OPENROUTER}/api/v1/auth/keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  }).catch(() => null);
  if (!res) return Response.json({ error: "Couldn't reach OpenRouter. Check your internet connection." }, { status: 502 });
  const data = (await res.json().catch(() => ({}))) as { key?: string };
  if (!res.ok || !data.key) return Response.json({ error: "OpenRouter didn't accept that sign-in (codes expire after 10 minutes). Try again." }, { status: 400 });
  return Response.json({ key: data.key });
}
