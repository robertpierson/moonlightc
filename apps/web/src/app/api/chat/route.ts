import { getProvider, languageModel, ProviderError } from "@moonc/core";
import { APICallError, convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream, type UIMessage } from "ai";
import { readConnection } from "@/lib/server-guard";

export const maxDuration = 300;

interface Body {
  messages: UIMessage[];
  connection: unknown;
  modelId: string;
  instructions?: string;
}

// Thin streaming proxy: the key arrives with the request, is used for this one call, and is never stored or logged.
export async function POST(req: Request) {
  let body: Body;
  let providerName = "The provider";
  try {
    body = await req.json();
    const c = readConnection(body.connection);
    providerName = getProvider(c.providerId).name;
    if (typeof body.modelId !== "string" || !Array.isArray(body.messages)) throw new ProviderError("Pick a model first.");

    const result = streamText({
      model: languageModel(c, body.modelId),
      instructions: body.instructions || undefined,
      messages: await convertToModelMessages(body.messages),
      abortSignal: req.signal,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        sendReasoning: true,
        messageMetadata: ({ part }) =>
          part.type === "finish" ? { usage: part.totalUsage, modelId: body.modelId, createdAt: Date.now() } : undefined,
        onError: (e) => friendlyError(e, providerName),
      }),
    });
  } catch (e) {
    return Response.json({ error: friendlyError(e, providerName) }, { status: 400 });
  }
}

function friendlyError(e: unknown, provider: string): string {
  if (e instanceof ProviderError) return e.message;
  if (APICallError.isInstance(e)) {
    if (e.statusCode === 401 || e.statusCode === 403) return `${provider} rejected your key. Open Settings → Models and paste a fresh key.`;
    if (e.statusCode === 402) return `${provider} says your account is out of credit. Add credit on their site, then retry.`;
    if (e.statusCode === 404) return `${provider} doesn't recognize this model. Pick another model and retry.`;
    if (e.statusCode === 429) return `${provider} is rate-limiting you. Wait a moment, then retry.`;
    return `${provider} returned an error${e.statusCode ? ` (${e.statusCode})` : ""}: ${e.message.slice(0, 200)}`;
  }
  return `${provider} couldn't answer. Retry, or pick another model.`;
}
