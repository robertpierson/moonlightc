"use client";

import type { Connection, ModelInfo } from "@moonc/core";
import type { UIMessage } from "ai";
import { useSyncExternalStore } from "react";
import type { Distro, Look } from "./customize";
import type { Automation } from "@/components/desktop/automation-runner";
import type { InstalledMod } from "./mods";

// Device-local storage. Keys saved here never leave this browser except inside a chat request to our proxy.
// Cloud sync (Supabase Vault) is added on top once accounts exist.

export interface SavedConnection extends Connection {
  id: string;
  label: string;
  models: ModelInfo[];
  addedAt: number;
}

export interface ModelRef {
  connectionId: string;
  modelId: string;
}

export interface Mode {
  id: string;
  name: string;
  instructions: string;
  temperature?: number;
  model?: ModelRef;
  /** Incognito: chats in this mode are never saved. */
  private?: boolean;
  /** Deep Research: tools forced on, long multi-step run, report with sources. */
  research?: boolean;
  builtIn?: boolean;
}

export const BUILT_IN_MODES: Mode[] = [
  { id: "general", name: "General", instructions: "", builtIn: true },
  {
    id: "coder",
    name: "Coder",
    builtIn: true,
    temperature: 0.2,
    instructions:
      "You are an expert software engineer. Give complete, working code with the file name above each block. Explain only what is non-obvious. Prefer simple, standard solutions.",
  },
  {
    id: "writer",
    name: "Writer",
    builtIn: true,
    temperature: 0.9,
    instructions: "You are a skilled editor and writer. Match the user's voice, keep it clear and concrete, and offer one stronger alternative when useful.",
  },
  {
    id: "researcher",
    name: "Researcher",
    builtIn: true,
    temperature: 0.3,
    instructions:
      "You are a careful researcher. Separate facts from opinions, say how confident you are, name your sources when you know them, and flag anything that may be out of date.",
  },
  {
    id: "tutor",
    name: "Tutor",
    builtIn: true,
    instructions:
      "You are a patient tutor. Teach step by step, ask one question at a time to check understanding, and quiz the user before moving on. Never just hand over answers to exercises.",
  },
  {
    id: "research",
    name: "Deep Research",
    builtIn: true,
    research: true,
    temperature: 0.3,
    instructions:
      "You are a deep-research agent. First write a short plan of 3-6 sub-questions. Then use web_search many times with varied queries and fetch_url to read the most relevant sources in full. Keep going until each sub-question is answered or clearly unanswerable. Finish with a structured report: a summary, findings by sub-question, disagreements between sources, and a numbered Sources list. Cite sources inline as [1], [2] matching that list. Never invent sources.",
  },
  { id: "private", name: "Private", instructions: "", private: true, builtIn: true },
];

export interface McpServer {
  id: string;
  name: string;
  kind: "http" | "stdio";
  url?: string;
  token?: string;
  command?: string;
  args?: string[];
  enabled: boolean;
  preset?: "github";
  tools: { name: string; description: string }[];
  policy: Record<string, "ask" | "always" | "never">;
}

export interface Project {
  id: string;
  name: string;
  instructions: string;
  files: { name: string; text: string }[];
  createdAt: number;
}

export interface MemoryItem {
  id: string;
  text: string;
  projectId?: string;
  createdAt: number;
}

export interface Chat {
  id: string;
  title: string;
  model?: ModelRef;
  modeId?: string;
  projectId?: string;
  messages: UIMessage[];
  pinned?: boolean;
  updatedAt: number;
}

interface State {
  connections: SavedConnection[];
  chats: Chat[];
  favorites: string[]; // `${connectionId}:${modelId}`
  lastModel?: ModelRef;
  modes: Mode[]; // user-made; built-ins live in code
  searchKey?: { provider: "tavily" | "exa" | "brave"; key: string };
  mcpServers?: McpServer[];
  webTools?: boolean;
  look?: Look;
  distroId?: string;
  customDistros?: Distro[];
  mods?: InstalledMod[];
  projects?: Project[];
  automations?: Automation[];
  memory?: { enabled: boolean; items: MemoryItem[] };
}

const KEY = "moonc:v1";
const empty: State = { connections: [], chats: [], favorites: [], modes: [] };
let state: State = empty;
let loaded = false;
const listeners = new Set<() => void>();

// In the desktop app, API keys live in the OS keychain (window.moonc.secrets), not in localStorage.
const bridge = () => (typeof window === "undefined" ? undefined : window.moonc);
const secretOf = (id: string) => `key:${id}`;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    state = { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    state = empty;
  }
  const b = bridge();
  if (b) {
    // Fill keys in from the keychain, then rewrite storage without them (also migrates older plain-text keys).
    Promise.all([
      ...state.connections.map(async (c) => ({ ...c, apiKey: c.apiKey || ((await b.secrets.get(secretOf(c.id))) ?? "") })),
    ]).then(async (connections) => {
      const searchKey = state.searchKey && { ...state.searchKey, key: state.searchKey.key || ((await b.secrets.get("search")) ?? "") };
      const mcpServers =
        state.mcpServers && (await Promise.all(state.mcpServers.map(async (m) => (m.token === "" ? { ...m, token: (await b.secrets.get(`mcp:${m.id}`)) ?? "" } : m))));
      update((s) => ({ ...s, connections, searchKey, mcpServers }));
    });
  }
}

function persist(prev: State) {
  const b = bridge();
  let saved: State = state;
  if (b) {
    for (const c of state.connections) if (c.apiKey && prev.connections.find((p) => p.id === c.id)?.apiKey !== c.apiKey) b.secrets.set(secretOf(c.id), c.apiKey);
    for (const c of prev.connections) if (!state.connections.some((x) => x.id === c.id)) b.secrets.set(secretOf(c.id), null);
    if (state.searchKey?.key && state.searchKey.key !== prev.searchKey?.key) b.secrets.set("search", state.searchKey.key);
    for (const m of state.mcpServers ?? []) if (m.token && prev.mcpServers?.find((p) => p.id === m.id)?.token !== m.token) b.secrets.set(`mcp:${m.id}`, m.token);
    for (const m of prev.mcpServers ?? []) if (!state.mcpServers?.some((x) => x.id === m.id)) b.secrets.set(`mcp:${m.id}`, null);
    else if (prev.searchKey) b.secrets.set("search", null);
    saved = {
      ...state,
      connections: state.connections.map((c) => ({ ...c, apiKey: "" })),
      searchKey: state.searchKey && { ...state.searchKey, key: "" },
      mcpServers: state.mcpServers?.map((m) => ({ ...m, token: m.token ? "" : undefined })),
    };
  }
  localStorage.setItem(KEY, JSON.stringify(saved));
}

export function update(fn: (s: State) => State) {
  load();
  const prev = state;
  state = fn(state);
  try {
    persist(prev);
  } catch {
    // Storage full or blocked: keep working in memory.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return select(state);
    },
    () => select(empty),
  );
}

export const getState = () => {
  load();
  return state;
};

export function saveChat(chat: Chat) {
  update((s) => ({ ...s, chats: [chat, ...s.chats.filter((c) => c.id !== chat.id)] }));
}

export function patchChat(id: string, patch: Partial<Chat>) {
  update((s) => ({ ...s, chats: s.chats.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

export function deleteChat(id: string) {
  update((s) => ({ ...s, chats: s.chats.filter((c) => c.id !== id) }));
}

export function findModel(ref?: ModelRef) {
  if (!ref) return undefined;
  const conn = getState().connections.find((c) => c.id === ref.connectionId);
  const model = conn?.models.find((m) => m.id === ref.modelId);
  return conn && model ? { conn, model } : undefined;
}

export function addMemory(text: string, projectId?: string) {
  update((s) => ({ ...s, memory: { enabled: s.memory?.enabled ?? true, items: [...(s.memory?.items ?? []), { id: crypto.randomUUID(), text, projectId, createdAt: Date.now() }] } }));
}
