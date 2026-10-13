import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { createFal } from "@ai-sdk/fal";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createReplicate } from "@ai-sdk/replicate";
import { createXai } from "@ai-sdk/xai";
import { ProviderError, type Connection } from "./providers";

export type MediaKind = "image" | "video" | "speech";

export interface StudioProvider {
  id: string;
  name: string;
  kinds: MediaKind[];
}

/** Providers the Creative Studio can use. Chat keys (OpenAI, Google, xAI) are reused; fal, Replicate and ElevenLabs are media-only keys. */
export const STUDIO_PROVIDERS: StudioProvider[] = [
  { id: "fal", name: "fal", kinds: ["image", "video", "speech"] },
  { id: "openai", name: "OpenAI", kinds: ["image", "speech"] },
  { id: "google", name: "Google Gemini", kinds: ["image"] },
  { id: "xai", name: "xAI (Grok)", kinds: ["image", "video"] },
  { id: "replicate", name: "Replicate", kinds: ["image", "video"] },
  { id: "elevenlabs", name: "ElevenLabs", kinds: ["speech"] },
];

export interface MediaModel {
  id: string;
  name: string;
  description?: string;
}

const FAL_CATEGORY: Record<MediaKind, string[]> = {
  image: ["text-to-image"],
  video: ["text-to-video", "image-to-video"],
  speech: ["text-to-speech"],
};

const REPLICATE_COLLECTION: Partial<Record<MediaKind, string>> = { image: "text-to-image", video: "text-to-video" };

async function getJSON(url: string, headers: Record<string, string>, provider: string, fetchFn: typeof fetch) {
  let res: Response;
  try {
    res = await fetchFn(url, { headers });
  } catch {
    throw new ProviderError(`Couldn't reach ${provider}. Check your internet connection.`);
  }
  if ([400, 401, 403].includes(res.status)) throw new ProviderError(`${provider} rejected this key. Copy a fresh key and paste it again.`);
  if (!res.ok) throw new ProviderError(`${provider} returned an error (${res.status}). Try again in a minute.`);
  return res.json() as Promise<Record<string, unknown>>;
}

/** Live list of models for one kind of media. */
export async function listMediaModels(c: Connection, kind: MediaKind, fetchFn: typeof fetch = fetch): Promise<MediaModel[]> {
  switch (c.providerId) {
    case "fal": {
      const out: MediaModel[] = [];
      for (const category of FAL_CATEGORY[kind]) {
        let cursor = "";
        // ponytail: first 3 pages (~300 models) per category; enough for a picker, add search if users want the long tail.
        for (let page = 0; page < 3; page++) {
          const d = await getJSON(`https://api.fal.ai/v1/models?category=${category}&status=active&limit=100${cursor ? `&cursor=${cursor}` : ""}`, { authorization: `Key ${c.apiKey}` }, "fal", fetchFn);
          for (const m of d.models as { endpoint_id: string; metadata: { display_name: string; description?: string } }[]) {
            out.push({ id: m.endpoint_id, name: m.metadata.display_name, description: m.metadata.description?.slice(0, 160) });
          }
          if (!d.has_more) break;
          cursor = String(d.next_cursor);
        }
      }
      return out;
    }
    case "replicate": {
      const col = REPLICATE_COLLECTION[kind];
      if (!col) return [];
      const d = await getJSON(`https://api.replicate.com/v1/collections/${col}`, { authorization: `Bearer ${c.apiKey}` }, "Replicate", fetchFn);
      return (d.models as { owner: string; name: string; description?: string }[]).map((m) => ({ id: `${m.owner}/${m.name}`, name: `${m.owner}/${m.name}`, description: m.description?.slice(0, 160) }));
    }
    case "elevenlabs": {
      const d = (await getJSON("https://api.elevenlabs.io/v1/models", { "xi-api-key": c.apiKey }, "ElevenLabs", fetchFn)) as unknown as { model_id: string; name: string; can_do_text_to_speech?: boolean }[];
      return d.filter((m) => m.can_do_text_to_speech !== false).map((m) => ({ id: m.model_id, name: m.name }));
    }
    case "openai": {
      const d = await getJSON("https://api.openai.com/v1/models", { authorization: `Bearer ${c.apiKey}` }, "OpenAI", fetchFn);
      const re = kind === "image" ? /^(gpt-image|dall-e)/ : kind === "speech" ? /tts/ : /$^/;
      return (d.data as { id: string }[]).filter((m) => re.test(m.id)).map((m) => ({ id: m.id, name: m.id })).sort((a, b) => a.id.localeCompare(b.id));
    }
    case "google": {
      if (kind !== "image") return [];
      const d = await getJSON("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { "x-goog-api-key": c.apiKey }, "Google", fetchFn);
      return (d.models as { name: string; displayName?: string; supportedGenerationMethods?: string[] }[])
        .filter((m) => /image/i.test(m.name) && !/embed/i.test(m.name))
        .map((m) => ({ id: m.name.replace(/^models\//, ""), name: m.displayName ?? m.name }));
    }
    case "xai": {
      if (kind === "speech") return [];
      const d = await getJSON(`https://api.x.ai/v1/${kind}-generation-models`, { authorization: `Bearer ${c.apiKey}` }, "xAI", fetchFn);
      return ((d.models ?? d.data ?? []) as { id: string }[]).map((m) => ({ id: m.id, name: m.id }));
    }
  }
  throw new ProviderError("This provider doesn't make images, video or audio.");
}

/** Validates a media-only key (fal, Replicate, ElevenLabs) with a real authenticated call. */
export async function checkMediaKey(c: Connection, fetchFn: typeof fetch = fetch) {
  if (c.providerId === "fal") await getJSON("https://api.fal.ai/v1/account/billing", { authorization: `Key ${c.apiKey}` }, "fal", fetchFn);
  else if (c.providerId === "replicate") await getJSON("https://api.replicate.com/v1/account", { authorization: `Bearer ${c.apiKey}` }, "Replicate", fetchFn);
  else if (c.providerId === "elevenlabs") await getJSON("https://api.elevenlabs.io/v1/user", { "xi-api-key": c.apiKey }, "ElevenLabs", fetchFn);
  else throw new ProviderError("Unknown media provider.");
}

export function imageModel(c: Connection, id: string) {
  switch (c.providerId) {
    case "fal":
      return createFal({ apiKey: c.apiKey }).image(id);
    case "openai":
      return createOpenAI({ apiKey: c.apiKey }).image(id);
    case "google":
      return createGoogleGenerativeAI({ apiKey: c.apiKey }).image(id);
    case "xai":
      return createXai({ apiKey: c.apiKey }).image(id);
    case "replicate":
      return createReplicate({ apiToken: c.apiKey }).image(id as `${string}/${string}`);
  }
  throw new ProviderError("This provider doesn't make images.");
}

export function videoModel(c: Connection, id: string) {
  switch (c.providerId) {
    case "fal":
      return createFal({ apiKey: c.apiKey }).video(id);
    case "xai":
      return createXai({ apiKey: c.apiKey }).video(id);
    case "replicate":
      return createReplicate({ apiToken: c.apiKey }).video(id as `${string}/${string}`);
  }
  throw new ProviderError("This provider doesn't make video.");
}

export function speechModel(c: Connection, id: string) {
  switch (c.providerId) {
    case "fal":
      return createFal({ apiKey: c.apiKey }).speech(id);
    case "openai":
      return createOpenAI({ apiKey: c.apiKey }).speech(id);
    case "elevenlabs":
      return createElevenLabs({ apiKey: c.apiKey }).speech(id);
  }
  throw new ProviderError("This provider doesn't make speech.");
}
