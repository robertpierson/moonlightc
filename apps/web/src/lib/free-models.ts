import { FREE_PROVIDERS, freeCandidates, getProvider, interleave } from "@moonc/core";
import type { ModelRef, SavedConnection } from "./store";

// "Free" in the model menu: each message goes to the free plans of the companies you have keys for, moving to the next
// model when one is at its limit or having problems (the server does the moving on; see /api/chat and core/free.ts).

export const FREE: ModelRef = { connectionId: "free", modelId: "free" };
export const isFree = (r?: ModelRef) => r?.connectionId === FREE.connectionId;

/** Whether this key joins Free: companies with a free plan join unless the person switched it off. */
export const inFree = (c: SavedConnection) => !!getProvider(c.providerId).free && c.freePool !== false;

/** At most this many models are tried for one message. */
const MAX_TRIES = 8;

/** The models Free tries, in order: the best of each company first, then the second best of each. */
export function freePool(connections: SavedConnection[]): ModelRef[] {
  const lists = connections.filter(inFree).map((c) => freeCandidates(c.providerId, c.models).map((m) => ({ connectionId: c.id, modelId: m.id })));
  return interleave(lists).slice(0, MAX_TRIES);
}

/** Companies with a free plan, for "Get a free key" lists. */
export const freeCompanies = () => FREE_PROVIDERS.map((p) => ({ id: p.id, name: p.name, keyUrl: p.keyUrl, onlySome: p.free === "tagged" }));
