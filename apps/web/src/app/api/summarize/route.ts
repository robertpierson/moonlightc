import { getProvider, languageModel, ProviderError, thinkingOptions } from "@moonc/core";
import { generateText } from "ai";
import { readConnection } from "@/lib/server-guard";

// Short chat titles, and summaries for "Continue in a new chat". The key is used for this one call, never stored.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const c = readConnection(b.connection);
    if (typeof b.modelId !== "string" || typeof b.text !== "string") throw new ProviderError("Nothing to summarize.");
    const title = b.kind === "title";
    const think = thinkingOptions(c.providerId, b.modelId, "low");
    const r = await generateText({
      model: languageModel(c, b.modelId),
      ...(think.providerOptions ? { providerOptions: think.providerOptions as never } : {}),
      instructions: title
        ? "Write a short title (2 to 6 words) that says what this conversation is about. Reply with the title only: no quotes, no ending punctuation."
        : "Summarize this conversation so it can be continued in a new chat: the goal, key facts and decisions, what's done, and what's still open. Short bullet points, under 250 words.",
      prompt: b.text.slice(-60_000),
      maxOutputTokens: 4000,
    });
    return Response.json({ text: r.text.trim() });
  } catch (e) {
    const name = (() => {
      try {
        return getProvider(String((e as { providerId?: string }).providerId ?? "")).name;
      } catch {
        return "The provider";
      }
    })();
    return Response.json({ error: e instanceof ProviderError ? e.message : `${name} couldn't summarize this chat.` }, { status: 400 });
  }
}
