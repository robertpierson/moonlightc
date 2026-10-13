import { OPENROUTER } from "@moonc/core";

// Live credit balance and limits for an OpenRouter key. The key is used for this one request and not kept.
export async function POST(req: Request) {
  const { apiKey } = (await req.json().catch(() => ({}))) as { apiKey?: unknown };
  if (typeof apiKey !== "string" || !apiKey) return Response.json({ error: "Missing key." }, { status: 400 });
  const get = (path: string) =>
    fetch(`${OPENROUTER}/api/v1/${path}`, { headers: { authorization: `Bearer ${apiKey}` } })
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: Record<string, unknown> }>) : null))
      .catch(() => null);
  const [key, credits] = await Promise.all([get("key"), get("credits")]);
  if (!key?.data) return Response.json({ error: "OpenRouter didn't share usage for this key." }, { status: 502 });
  const d = key.data as { label?: string; usage?: number; limit?: number | null; limit_remaining?: number | null; is_free_tier?: boolean };
  const c = credits?.data as { total_credits?: number; total_usage?: number } | undefined;
  return Response.json({
    label: d.label,
    used: d.usage ?? 0,
    limit: d.limit ?? null,
    limitRemaining: d.limit_remaining ?? null,
    freeTier: !!d.is_free_tier,
    credits: c ? { total: c.total_credits ?? 0, used: c.total_usage ?? 0 } : null,
  });
}
