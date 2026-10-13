import { ProviderError, transcriptionModel } from "@moonc/core";
import { transcribe } from "ai";
import { readConnection } from "@/lib/server-guard";

// Speech to text with the user's own OpenAI or Groq key. Audio and key are used for this one call only.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) throw new ProviderError("No audio was recorded. Try again.");
    const c = readConnection(JSON.parse(String(form.get("connection") ?? "null")));
    const { text } = await transcribe({ model: transcriptionModel(c), audio: new Uint8Array(await audio.arrayBuffer()), abortSignal: req.signal });
    return Response.json({ text });
  } catch (e) {
    const message = e instanceof ProviderError ? e.message : "Couldn't turn that recording into text. Check your key and try again.";
    return Response.json({ error: message }, { status: 400 });
  }
}
