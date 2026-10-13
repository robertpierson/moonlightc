import { ProviderError, STUDIO_PROVIDERS, type MediaKind } from "@moonc/core";
import { APICallError } from "ai";
import { readConnection } from "./server-guard";

export function readStudioRequest(body: unknown, kind?: MediaKind) {
  const b = body as { connection?: unknown; kind?: MediaKind; modelId?: unknown } | null;
  const c = readConnection(b?.connection);
  const k = kind ?? b?.kind;
  const p = STUDIO_PROVIDERS.find((x) => x.id === c.providerId);
  if (!k || !p?.kinds.includes(k)) throw new ProviderError("This key can't make that kind of media. Pick another provider.");
  return { c, kind: k, providerName: p.name, modelId: typeof b?.modelId === "string" ? b.modelId : "" };
}

export function studioError(e: unknown, provider = "The provider") {
  let message = `${provider} couldn't finish that. Try again or pick another model.`;
  if (e instanceof ProviderError) message = e.message;
  else if (APICallError.isInstance(e)) {
    if (e.statusCode === 401 || e.statusCode === 403) message = `${provider} rejected your key. Paste a fresh key in Models and keys.`;
    else if (e.statusCode === 402) message = `${provider} says your account is out of credit. Add credit on their site, then retry.`;
    else if (e.statusCode === 422 || e.statusCode === 400) message = `${provider} didn't accept that request: ${e.message.slice(0, 200)}`;
    else if (e.statusCode === 429) message = `${provider} is rate-limiting you. Wait a moment, then retry.`;
  } else if (e instanceof Error && e.message) message = `${provider}: ${e.message.slice(0, 200)}`;
  return Response.json({ error: message }, { status: 400 });
}
