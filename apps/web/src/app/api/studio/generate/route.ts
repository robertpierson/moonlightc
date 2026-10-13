import { imageModel, speechModel } from "@moonc/core";
import { experimental_generateSpeech as generateSpeech, generateImage } from "ai";
import { readStudioRequest, studioError } from "@/lib/studio-server";

export const maxDuration = 300;

// Images and speech come back in one call. Keys are used for this request only and never stored or logged.
export async function POST(req: Request) {
  let provider: string | undefined;
  try {
    const body = await req.json();
    const { c, kind, providerName, modelId } = readStudioRequest(body);
    provider = providerName;
    const prompt = String(body.prompt ?? "").slice(0, 8000);
    if (!prompt.trim()) return Response.json({ error: "Write a prompt first." }, { status: 400 });

    if (kind === "image") {
      const { image, providerMetadata } = await generateImage({
        model: imageModel(c, modelId),
        prompt,
        aspectRatio: /^\d+:\d+$/.test(body.aspectRatio ?? "") ? body.aspectRatio : undefined,
        abortSignal: req.signal,
      });
      return Response.json({ mediaType: image.mediaType, base64: image.base64, meta: providerMetadata ?? null });
    }
    if (kind === "speech") {
      const { audio } = await generateSpeech({ model: speechModel(c, modelId), text: prompt, voice: body.voice || undefined, abortSignal: req.signal });
      return Response.json({ mediaType: audio.mediaType, base64: audio.base64 });
    }
    return Response.json({ error: "Use the video endpoint for video." }, { status: 400 });
  } catch (e) {
    return studioError(e, provider);
  }
}
