import { checkMediaKey, getProvider, listModels, ProviderError } from "@moonc/core";
import { readConnection } from "@/lib/server-guard";

// Validates a key with a real call to the provider and returns the models it unlocks. Keys are never logged.
export async function POST(req: Request) {
  try {
    const c = readConnection(await req.json());
    if (getProvider(c.providerId).media) {
      await checkMediaKey(c);
      return Response.json({ models: [] });
    }
    return Response.json({ models: await listModels(c) });
  } catch (e) {
    const message = e instanceof ProviderError ? e.message : "Something went wrong checking that key. Try again.";
    return Response.json({ error: message }, { status: 400 });
  }
}
