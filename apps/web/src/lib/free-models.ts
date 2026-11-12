import { FREE_PROVIDERS, freeCandidates, getProvider, interleave } from "@moonc/core";
import type { ModelRef, SavedConnection } from "./store";

// "Free" in the model menu: each message goes to the free plans of the companies you have keys for, moving to the next
// model when one is at its limit or having problems (the server does the moving on; see /api/chat and core/free.ts).

export const FREE: ModelRef = { connectionId: "free", modelId: "free" };
export const isFree = (r?: ModelRef) => r?.connectionId === FREE.connectionId;

/** Whether this key joins Free: companies with a free plan join unless the person switched it off. */
export const inFree = (c: SavedConnection) => !!getProvider(c.providerId).free && c.freePool !== false;

/** At most this many models are tried for one message. */
const MAX_TRIES = 16;

export const freeId = (r: ModelRef) => `${r.connectionId}|${r.modelId}`;

// Models recently at their limit (or not on the plan), with when to try them again. Kept in this browser only.
const COOL_KEY = "moonc-free-cool";
let cool: Record<string, number> | undefined;
const coolMap = () => {
  if (!cool) {
    try {
      cool = JSON.parse(localStorage.getItem(COOL_KEY) ?? "{}") as Record<string, number>;
    } catch {
      cool = {};
    }
  }
  return cool;
};

/** Leave these models alone for `wait` seconds each (from the server's `skipped` list after an answer). */
export function coolDown(skipped: { id: string; wait: number }[] | undefined, now = Date.now()) {
  if (!skipped?.length) return;
  const m = coolMap();
  for (const k of Object.keys(m)) if (m[k] <= now) delete m[k];
  for (const s of skipped) m[s.id] = now + Math.min(86400, Math.max(0, s.wait)) * 1000;
  try {
    localStorage.setItem(COOL_KEY, JSON.stringify(m));
  } catch {}
}

/**
 * The models Free tries, in order: the best of each company first, then the second best of each. Models resting after
 * a limit go last, so they're only tried when everything else fails.
 */
export function freePool(connections: SavedConnection[], now = Date.now()): ModelRef[] {
  const lists = connections.filter(inFree).map((c) => freeCandidates(c.providerId, c.models).map((m) => ({ connectionId: c.id, modelId: m.id })));
  const all = interleave(lists);
  const resting = (r: ModelRef) => (coolMap()[freeId(r)] ?? 0) > now;
  return [...all.filter((r) => !resting(r)), ...all.filter(resting)].slice(0, MAX_TRIES);
}

/** Companies with a free plan, for "Get a free key" lists. */
export const freeCompanies = () => FREE_PROVIDERS.map((p) => ({ id: p.id, name: p.name, keyUrl: p.keyUrl, onlySome: p.free === "tagged" }));
