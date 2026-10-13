import { describe, expect, it } from "vitest";
import type { Chat, State } from "./store";
import { emptyMeta, mergeChats, syncOnce, toRemote, type RemoteChat, type RemoteConnection, type SyncBackend } from "./sync";

/** An in-memory stand-in for the Supabase tables, shared by two "devices". */
function cloud() {
  const chats = new Map<string, RemoteChat>();
  const conns = new Map<string, RemoteConnection>();
  const keys = new Map<string, string>();
  let settings: { data: Partial<State>; updated_at: string } | null = null;
  const backend: SyncBackend = {
    pullChats: async (since) => [...chats.values()].filter((c) => !since || (c.deleted_at ?? c.updated_at) > since).map((c) => structuredClone(c)),
    pushChat: async (c) => void chats.set(c.id, { ...structuredClone(c), updated_at: c.updated_at, deleted_at: null }),
    deleteChat: async (id, at) => {
      const c = chats.get(id);
      if (c) chats.set(id, { ...c, deleted_at: at, updated_at: at });
    },
    pullSettings: async () => settings,
    pushSettings: async (data, at) => void (settings = { data, updated_at: at }),
    listConnections: async () => [...conns.values()],
    pushConnection: async (c, k) => void (conns.set(c.id, c), keys.set(c.id, k)),
    deleteConnection: async (id) => void (conns.delete(id), keys.delete(id)),
    getKey: async (id) => keys.get(id) ?? null,
  };
  return { backend, chats };
}

function device(): { get: () => State; set: (fn: (s: State) => State) => void; s: { v: State } } {
  const s = { v: { connections: [], chats: [], favorites: [], modes: [] } as State };
  return { s, get: () => s.v, set: (fn) => void (s.v = fn(s.v)) };
}

const chat = (id: string, title: string, at: number): Chat => ({ id, title, updatedAt: at, messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: title }] }] });

describe("sync", () => {
  it("newer copies win and deletions spread", () => {
    const local = [chat("a", "old", 1), chat("b", "keep", 5)];
    const remote = [{ ...toRemote(chat("a", "new", 2)) }, { ...toRemote(chat("b", "x", 1)), deleted_at: new Date(9).toISOString() }];
    const { chats, changed } = mergeChats(local, remote);
    expect(changed).toBe(true);
    expect(chats.map((c) => c.title)).toEqual(["new"]);
  });

  it("two devices end up with the same chats, settings and keys", async () => {
    const { backend } = cloud();
    const pc = device();
    const phone = device();
    pc.set((s) => ({ ...s, chats: [chat("c1", "Trip plan", 1000)], connections: [{ id: "k1", providerId: "openrouter", apiKey: "sk-or-1", label: "OpenRouter", models: [{ id: "m", name: "m" }], addedAt: 1 }], profile: { name: "Shawn" } }));
    let pcMeta = await syncOnce(backend, pc.get, pc.set, emptyMeta(), 2000);
    let phoneMeta = await syncOnce(backend, phone.get, phone.set, emptyMeta(), 3000);
    expect(phone.get().chats.map((c) => c.title)).toEqual(["Trip plan"]);
    expect(phone.get().connections[0].apiKey).toBe("sk-or-1");
    expect(phone.get().profile?.name).toBe("Shawn");

    // Edit on the phone, delete on the PC: both changes reach the other device.
    phone.set((s) => ({ ...s, chats: [...s.chats, chat("c2", "Homework", 4000)] }));
    phoneMeta = await syncOnce(backend, phone.get, phone.set, phoneMeta, 5000);
    pc.set((s) => ({ ...s, chats: [] }));
    pcMeta = await syncOnce(backend, pc.get, pc.set, pcMeta, 6000);
    expect(pc.get().chats.map((c) => c.title)).toEqual(["Homework"]);
    phoneMeta = await syncOnce(backend, phone.get, phone.set, phoneMeta, 7000);
    expect(phone.get().chats.map((c) => c.title)).toEqual(["Homework"]);

    // Removing a key on one device removes it everywhere.
    phone.set((s) => ({ ...s, connections: [] }));
    await syncOnce(backend, phone.get, phone.set, phoneMeta, 8000);
    await syncOnce(backend, pc.get, pc.set, pcMeta, 9000);
    expect(pc.get().connections).toEqual([]);
  });
});
