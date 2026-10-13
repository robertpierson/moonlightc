import { videoModel } from "@moonc/core";
import { experimental_getVideoStatus as getVideoStatus, experimental_startVideo as startVideo, type JSONValue } from "ai";
import { readStudioRequest, studioError } from "@/lib/studio-server";

// Videos take minutes, so the browser starts a job here and then polls for it (action "status").
export async function POST(req: Request) {
  let provider: string | undefined;
  try {
    const body = await req.json();
    const { c, providerName, modelId } = readStudioRequest(body, "video");
    provider = providerName;
    const model = videoModel(c, modelId);

    if (body.action === "status") {
      const r = await getVideoStatus(model, { operation: body.operation as JSONValue, abortSignal: req.signal });
      if (r.status === "pending") return Response.json({ status: "pending" });
      if (r.status === "completed") {
        const v = r.videos[0];
        return Response.json(v.type === "url" ? { status: "completed", url: v.url, mediaType: v.mediaType } : { status: "completed", base64: v.data, mediaType: v.mediaType });
      }
      return Response.json({ status: "failed", error: (r as { error?: { message?: string } }).error?.message ?? "The video failed." });
    }

    const prompt = String(body.prompt ?? "").slice(0, 4000);
    if (!prompt.trim()) return Response.json({ error: "Write a prompt first." }, { status: 400 });
    const image = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : undefined;
    const { operation } = await startVideo({
      model,
      prompt: image ? { image, text: prompt } : prompt,
      aspectRatio: /^\d+:\d+$/.test(body.aspectRatio ?? "") ? body.aspectRatio : undefined,
      abortSignal: req.signal,
    });
    return Response.json({ operation });
  } catch (e) {
    return studioError(e, provider);
  }
}
