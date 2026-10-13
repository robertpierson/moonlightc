import { listMediaModels } from "@moonc/core";
import { readStudioRequest, studioError } from "@/lib/studio-server";

// Live list of image, video or speech models for one provider key.
export async function POST(req: Request) {
  let provider: string | undefined;
  try {
    const { c, kind, providerName } = readStudioRequest(await req.json());
    provider = providerName;
    return Response.json({ models: await listMediaModels(c, kind) });
  } catch (e) {
    return studioError(e, provider);
  }
}
