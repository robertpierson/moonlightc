import { featuredModels } from "./featured";
import { PROVIDERS, type ModelInfo } from "./providers";

// "Free": one choice in the model menu that uses the free plans of every company the person has a key for, and
// moves on to the next model when one is at its limit or having problems. Inspired by FreeLLMAPI (MIT).

/** Providers with an official free plan. */
export const FREE_PROVIDERS = PROVIDERS.filter((p) => p.free && !p.hidden && !p.local);

// Not chat models (safety filters, embeddings, speech, parsers) or old generations that answer badly.
const SKIP =
  /guard|safety|reward|embed|rerank|retriever|tts|whisper|audio|vision-preview|image|ocr|distil|parse|clip|vila|neva|kosmos|deplot|fuyu|detector|translate|calibration|diffusion|llama2|codellama|starcoder|recurrentgemma|gemma-2b|chatqa|minitron/i;

/** Billions of parameters in an id ("llama-3.3-70b-versatile" -> 70; "8x7b" -> 56), for "bigger first". */
export function sizeInB(id: string): number {
  const moe = id.match(/(\d+)x(\d+(?:\.\d+)?)b\b/i);
  if (moe) return Number(moe[1]) * Number(moe[2]);
  const b = [...id.matchAll(/(\d+(?:\.\d+)?)b\b/gi)].map((m) => Number(m[1]));
  return b.length ? Math.max(...b) : 0;
}

/**
 * Every free chat model worth trying from one company (each has its own daily limit, so more models = more free use), best first: its featured models (newest of each family), then the
 * biggest by parameter count, then the longest context. Never hard-coded names: always from the live model list.
 */
export function freeCandidates(providerId: string, models: ModelInfo[], max = 12): ModelInfo[] {
  const p = PROVIDERS.find((x) => x.id === providerId);
  if (!p?.free) return [];
  const usable = models.filter((m) => !SKIP.test(m.id) && (p.free === "all" || (p.freeModels ?? /:free$/).test(m.id)));
  const featured = featuredModels(providerId, usable);
  const rest = usable
    .filter((m) => !featured.includes(m))
    .sort((a, b) => sizeInB(b.id) - sizeInB(a.id) || (b.contextLength ?? 0) - (a.contextLength ?? 0) || a.id.localeCompare(b.id));
  return [...featured, ...rest].slice(0, max);
}

/** Interleave each company's list (first of each, then second of each...), so one company's outage costs one try. */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

/**
 * Errors that mean "try the next model": over the limit (429), out of credit or not on the plan (402/403), the model
 * is gone (404), timeouts and outages (408, 5xx), or the network failed. A request the person stopped is not retried.
 */
export function shouldFailOver(e: unknown): boolean {
  if (e instanceof Error && e.name === "AbortError") return false;
  const status = (e as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === "number") return status === 402 || status === 403 || status === 404 || status === 408 || status === 409 || status === 429 || status >= 500;
  // No status: the request never got an answer (connection refused, DNS, reset).
  return e instanceof TypeError || /fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket/i.test(String((e as Error)?.message ?? e));
}

type Model = {
  specificationVersion: string;
  provider: string;
  modelId: string;
  supportedUrls?: unknown;
  doGenerate(options: unknown): PromiseLike<unknown>;
  doStream(options: unknown): PromiseLike<unknown>;
};

/**
 * How long to leave a model alone after this error, in seconds: the company's Retry-After when it sends one, a day
 * when the model isn't on the plan or is gone (402/403/404), ten minutes for a limit (429), a minute otherwise.
 */
export function coolFor(e: unknown): number {
  const err = e as { statusCode?: number; responseHeaders?: Record<string, string> } | null;
  const after = Number(err?.responseHeaders?.["retry-after"]);
  if (after > 0) return Math.min(after, 86400);
  const s = err?.statusCode;
  return s === 402 || s === 403 || s === 404 ? 86400 : s === 429 ? 600 : 60;
}

/**
 * One model made of several: each call goes to the first, and on an error that shouldFailOver() accepts, to the next.
 * Only errors before the answer starts can move on (a stream that fails halfway reports its error). `onUse` hears
 * which model answered; `onSkip` hears each one passed over and why.
 */
export function fallbackModel<M extends Model>(models: M[], onUse?: (index: number) => void, onSkip?: (index: number, error: unknown) => void): M {
  if (!models.length) throw new Error("No models to try.");
  const run = async (method: "doGenerate" | "doStream", options: unknown) => {
    for (let i = 0; ; i++) {
      try {
        const r = await models[i][method](options);
        onUse?.(i);
        return r;
      } catch (e) {
        const stopped = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal?.aborted;
        if (stopped || i === models.length - 1 || !shouldFailOver(e)) throw e;
        onSkip?.(i, e);
      }
    }
  };
  return {
    ...models[0],
    provider: "free",
    modelId: "free",
    supportedUrls: {},
    doGenerate: (o: unknown) => run("doGenerate", o),
    doStream: (o: unknown) => run("doStream", o),
  } as M;
}
