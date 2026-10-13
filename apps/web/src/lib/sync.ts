import type { UIMessage } from "ai";
import type { Chat, SavedConnection, State } from "./store";

// Keeps a signed-in person's chats, settings and API keys the same on every device.
// Last change wins, per chat and for the settings as a whole. Keys go into Supabase Vault and only come back to
// their owner. Private-mode chats never reach this code (they're never saved).
// ponytail: whole-chat upserts; switch to per-message deltas if chats get very long.

export type RemoteMessage = { id: string; position: number; role: string; parts: unknown; metadata: unknown };
export type RemoteChat = {
  id: string;
  title: string;
  model: unknown;
  mode_id: string | null;
  pinned: boolean;
  project_id: string | null;
  workspace: string | null;
  updated_at: string;
  deleted_at: string | null;
  messages?: RemoteMessage[];
};
export type RemoteConnection = { id: string; provider_id: string; label: string; base_url: string | null; models: unknown; extra: Record<string, unknown> };

export interface SyncBackend {
  pullChats(since: string | null): Promise<RemoteChat[]>;
  pushChat(chat: RemoteChat): Promise<void>;
  deleteChat(id: string, at: string): Promise<void>;
  pullSettings(): Promise<{ data: Partial<State>; updated_at: string } | null>;
  pushSettings(data: Partial<State>, at: string): Promise<void>;
  listConnections(): Promise<RemoteConnection[]>;
  pushConnection(c: RemoteConnection, apiKey: string): Promise<void>;
  deleteConnection(id: string): Promise<void>;
  getKey(id: string): Promise<string | null>;
}

/** Settings that follow you (never keys or sign-in tokens). */
export const SYNCED_KEYS = ["modes", "favorites", "look", "distroId", "customDistros", "pinnedModes", "autoPicks", "projects", "memory", "profile", "myThemes", "codeFolders", "codePermission", "webTools", "lastModel"] as const;

const MAX_PART = 150_000;

/** Big pasted files and images stay on the device that has them; everything else syncs. */
function slimParts(parts: UIMessage["parts"]) {
  return parts.map((p) => (p.type === "file" && typeof p.url === "string" && p.url.length > MAX_PART ? { type: "text" as const, text: `[${p.filename ?? "Attachment"} is on the device it was added from]` } : p));
}

export function toRemote(c: Chat): RemoteChat {
  return {
    id: c.id,
    title: c.title.slice(0, 200),
    model: c.model ?? null,
    mode_id: c.modeId ?? null,
    pinned: !!c.pinned,
    project_id: c.projectId ?? null,
    workspace: c.workspace ?? null,
    updated_at: new Date(c.updatedAt).toISOString(),
    deleted_at: null,
    messages: c.messages.map((m, i) => ({ id: m.id, position: i, role: m.role, parts: slimParts(m.parts), metadata: m.metadata ?? null })),
  };
}

export function fromRemote(r: RemoteChat): Chat {
  return {
    id: r.id,
    title: r.title,
    model: (r.model as Chat["model"]) ?? undefined,
    modeId: r.mode_id ?? undefined,
    pinned: r.pinned || undefined,
    projectId: r.project_id ?? undefined,
    workspace: r.workspace === "cowork" ? "cowork" : undefined,
    updatedAt: Date.parse(r.updated_at),
    messages: [...(r.messages ?? [])].sort((a, b) => a.position - b.position).map((m) => ({ id: m.id, role: m.role as UIMessage["role"], parts: m.parts as UIMessage["parts"], metadata: m.metadata ?? undefined })),
  };
}

/** Applies remote chats on top of local ones: newer wins, deletions remove older local copies. */
export function mergeChats(local: Chat[], remote: RemoteChat[]) {
  const byId = new Map(local.map((c) => [c.id, c]));
  let changed = false;
  for (const r of remote) {
    const mine = byId.get(r.id);
    const at = Date.parse(r.updated_at);
    if (r.deleted_at) {
      if (mine && mine.updatedAt <= Date.parse(r.deleted_at)) {
        byId.delete(r.id);
        changed = true;
      }
    } else if (!mine || at > mine.updatedAt) {
      byId.set(r.id, fromRemote(r));
      changed = true;
    }
  }
  return { chats: [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt), changed };
}

export const pickSettings = (s: State): Partial<State> => Object.fromEntries(SYNCED_KEYS.flatMap((k) => (s[k] === undefined ? [] : [[k, s[k]]])));

export const connectionRow = (c: SavedConnection): RemoteConnection => ({ id: c.id, provider_id: c.providerId, label: c.label, base_url: c.baseURL ?? null, models: c.models, extra: {} });

type Meta = { lastPull: string | null; pushed: Record<string, number>; settingsAt: number; settingsSent: string; connections: string[] };
export const emptyMeta = (): Meta => ({ lastPull: null, pushed: {}, settingsAt: 0, settingsSent: "", connections: [] });

/** One sync pass: pull what changed elsewhere, then push what changed here. Returns the updated bookkeeping. */
export async function syncOnce(backend: SyncBackend, get: () => State, set: (fn: (s: State) => State) => void, meta: Meta, now = Date.now()): Promise<Meta> {
  const next: Meta = { ...meta, pushed: { ...meta.pushed } };

  // Settings: whichever side changed last wins.
  const remoteSettings = await backend.pullSettings();
  const localSettings = JSON.stringify(pickSettings(get()));
  const localChanged = localSettings !== meta.settingsSent;
  // A device syncing for the first time takes the account's settings.
  const firstTime = meta.settingsAt === 0;
  if (remoteSettings && (firstTime || (Date.parse(remoteSettings.updated_at) > meta.settingsAt && !localChanged))) {
    set((s) => ({ ...s, ...remoteSettings.data }));
    next.settingsAt = Date.parse(remoteSettings.updated_at);
    next.settingsSent = JSON.stringify(pickSettings(get()));
  } else if (localChanged) {
    const at = new Date(now).toISOString();
    await backend.pushSettings(pickSettings(get()), at);
    next.settingsAt = now;
    next.settingsSent = localSettings;
  }

  // Connections: add ones made on other devices (with their keys); upload new local ones.
  const remoteConns = await backend.listConnections();
  const localConns = get().connections;
  const added: SavedConnection[] = [];
  for (const r of remoteConns) {
    if (localConns.some((c) => c.id === r.id)) continue;
    if (meta.connections.includes(r.id)) {
      // We uploaded it before and it's gone here: it was removed on this device.
      await backend.deleteConnection(r.id);
      continue;
    }
    const key = (await backend.getKey(r.id)) ?? "";
    added.push({ id: r.id, providerId: r.provider_id, label: r.label, baseURL: r.base_url ?? undefined, apiKey: key, models: (r.models as SavedConnection["models"]) ?? [], addedAt: now });
  }
  // Synced before but gone from the account: it was removed on another device.
  const goneElsewhere = localConns.filter((c) => meta.connections.includes(c.id) && !remoteConns.some((r) => r.id === c.id)).map((c) => c.id);
  if (added.length || goneElsewhere.length) set((s) => ({ ...s, connections: [...s.connections.filter((c) => !goneElsewhere.includes(c.id)), ...added] }));
  for (const c of localConns) if (!goneElsewhere.includes(c.id) && !remoteConns.some((r) => r.id === c.id)) await backend.pushConnection(connectionRow(c), c.apiKey);
  for (const id of meta.connections) if (!get().connections.some((c) => c.id === id) && remoteConns.some((r) => r.id === id)) await backend.deleteConnection(id);
  next.connections = get().connections.map((c) => c.id);

  // Chats: pull newer ones, then push local changes and deletions.
  const pulled = await backend.pullChats(meta.lastPull);
  const merged = mergeChats(get().chats, pulled);
  if (merged.changed) set((s) => ({ ...s, chats: merged.chats }));
  for (const r of pulled) {
    if (r.deleted_at) delete next.pushed[r.id];
    else next.pushed[r.id] = Date.parse(r.updated_at);
  }
  next.lastPull = new Date(now).toISOString();
  const local = get().chats;
  for (const c of local) if ((next.pushed[c.id] ?? 0) < c.updatedAt) {
    await backend.pushChat(toRemote(c));
    next.pushed[c.id] = c.updatedAt;
  }
  for (const id of Object.keys(next.pushed)) if (!local.some((c) => c.id === id)) {
    await backend.deleteChat(id, new Date(now).toISOString());
    delete next.pushed[id];
  }
  return next;
}
