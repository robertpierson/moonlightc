"use client";

import type { Connection, ModelInfo } from "@moonc/core";
import type { AutoPicks } from "./auto-model";
import type { ClaudePlugin } from "./claude-plugins";
import type { UIMessage } from "ai";
import { useSyncExternalStore } from "react";
import type { Distro, Look } from "./customize";
import type { Automation } from "@/components/desktop/automation-runner";
import type { InstalledMod } from "./mods";
import type { Subscription } from "./subscriptions";

export type OAuthProviderId = "google" | "spotify" | "slack" | "discord";
const OAUTH_IDS: OAuthProviderId[] = ["google", "spotify", "slack", "discord"];

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

export const DEFAULT_PINNED_MODES = ["general", "research", "private"];

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
  /** OAuth sign-in for servers that require it (refreshed by mcp-auth-client). */
  oauth?: { clientInformation?: unknown; tokens?: { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string }; obtainedAt: number };
  tools: { name: string; description: string }[];
  policy: Record<string, "ask" | "always" | "never">;
}

export interface OAuthAccount {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
  scopes: string[];
  enabled: boolean;
}

export interface Project {
  id: string;
  name: string;
  instructions: string;
  files: { name: string; text: string }[];
  createdAt: number;
  /** Connectors and Claude plugins switched on for every chat in this project (even if off elsewhere). */
  connectorIds?: string[];
  pluginIds?: string[];
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
  /** The title was written by the AI or by you (not just the first words of the chat). */
  titled?: boolean;
  /** Cowork sessions are listed in the Cowork sidebar, not with chats. */
  workspace?: "cowork";
}

export interface State {
  connections: SavedConnection[];
  chats: Chat[];
  favorites: string[]; // `${connectionId}:${modelId}`
  /** Chats moved to the Trash; they can be restored for 30 days. */
  trash?: (Chat & { trashedAt: number })[];
  /** Code chats moved to the Trash (with the project they came from). */
  codeTrash?: { projectId: string; projectName: string; chat: import("./code").CodeChat; trashedAt: number }[];
  /** How hard models think, when they have that setting (low…max). Unset = the model's default. */
  thinking?: string;
  /** Models that failed in a way waiting won't fix ("not on your plan"), by `${connectionId}:${modelId}`. */
  modelNotes?: Record<string, string>;
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
  oauth?: Partial<Record<OAuthProviderId, OAuthAccount>>;
  xToken?: { token: string; enabled: boolean };
  /** Modes shown at the top of the mode menu; the rest sit under "More options". */
  pinnedModes?: string[];
  /** Models assigned to each kind of task, used when the model picker is set to Auto. */
  autoPicks?: AutoPicks;
  /** Claude Code plugins installed from GitHub (skills, commands, agents, MCP servers). */
  plugins?: ClaudePlugin[];
  /** Name and picture shown in the app (kept on this device until accounts exist). */
  profile?: { name?: string; avatar?: string };
  /** Themes the person saved from the theme editor. */
  /** Code project folders (a folder exists even before a project is in it). */
  codeFolders?: string[];
  /** How the code assistant may change files: ask first, apply automatically, plan only, or skip all approvals. */
  codePermission?: "ask" | "auto" | "plan" | "bypass";
  /** Desktop app: let your other devices control this PC (off until switched on in Settings > Remote control). */
  remoteEnabled?: boolean;
  /** Remote control's on/off was carried over once from before it saved instantly (0.6.17). */
  remoteCarried?: boolean;
  /** Start-with-Windows was switched on once for remote control. */
  loginSet?: boolean;
  myThemes?: { id: string; name: string; look: Pick<Look, "theme" | "overrides" | "radius"> }[];
  subscriptions?: { items: Subscription[]; remindDays: number; reminded?: Record<string, number>; scannedAt?: number };
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
        state.mcpServers &&
        (await Promise.all(
          state.mcpServers.map(async (m) => {
            if (m.token !== "" && !(m.oauth && !m.oauth.tokens)) return m;
            const raw = (await b.secrets.get(`mcp:${m.id}`)) ?? "";
            let v: { t?: string; o?: NonNullable<McpServer["oauth"]>["tokens"] } = {};
            try {
              v = JSON.parse(raw);
            } catch {
              v = { t: raw }; // older format: just the token
            }
            return { ...m, token: v.t ?? m.token, oauth: m.oauth && { ...m.oauth, tokens: v.o } };
          }),
        ));
      const oauth = { ...state.oauth };
      for (const id of OAUTH_IDS) {
        const acc = oauth[id];
        if (!acc || acc.accessToken) continue;
        const raw = await b.secrets.get(`oauth:${id}`);
        if (!raw) continue;
        const t = JSON.parse(raw) as { a: string; r?: string };
        oauth[id] = { ...acc, accessToken: t.a, refreshToken: t.r };
      }
      const xToken = state.xToken && { ...state.xToken, token: state.xToken.token || ((await b.secrets.get("x")) ?? "") };
      update((s) => ({ ...s, connections, searchKey, mcpServers, oauth, xToken }));
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
    else if (!state.searchKey && prev.searchKey) b.secrets.set("search", null);
    for (const m of state.mcpServers ?? []) {
      const before = prev.mcpServers?.find((p) => p.id === m.id);
      if ((m.token && before?.token !== m.token) || (m.oauth?.tokens && before?.oauth?.tokens !== m.oauth.tokens))
        b.secrets.set(`mcp:${m.id}`, JSON.stringify({ t: m.token, o: m.oauth?.tokens }));
    }
    for (const m of prev.mcpServers ?? []) if (!state.mcpServers?.some((x) => x.id === m.id)) b.secrets.set(`mcp:${m.id}`, null);
    if (state.xToken?.token && state.xToken.token !== prev.xToken?.token) b.secrets.set("x", state.xToken.token);
    else if (!state.xToken && prev.xToken) b.secrets.set("x", null);
    for (const id of OAUTH_IDS) {
      const acc = state.oauth?.[id];
      if (acc?.accessToken && acc.accessToken !== prev.oauth?.[id]?.accessToken) b.secrets.set(`oauth:${id}`, JSON.stringify({ a: acc.accessToken, r: acc.refreshToken }));
      if (!acc && prev.oauth?.[id]) b.secrets.set(`oauth:${id}`, null);
    }
    saved = {
      ...state,
      connections: state.connections.map((c) => ({ ...c, apiKey: "" })),
      searchKey: state.searchKey && { ...state.searchKey, key: "" },
      mcpServers: state.mcpServers?.map((m) => ({ ...m, token: m.token ? "" : undefined, oauth: m.oauth && { ...m.oauth, tokens: undefined } })),
      xToken: state.xToken && { ...state.xToken, token: "" },
      oauth: state.oauth && Object.fromEntries(Object.entries(state.oauth).map(([k, a]) => [k, a && { ...a, accessToken: "", refreshToken: a.refreshToken ? "" : undefined }])),
    };
  }
  // While Settings has unsaved edits, storage keeps the last saved values for those settings.
  if (staged) saved = { ...saved, ...staged };
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

export function subscribe(l: () => void) {
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

const TRASH_DAYS = 30;
/** Move a chat to the Trash (restorable for 30 days); older Trash is emptied as new chats arrive. */
export function trashChat(id: string) {
  update((s) => {
    const c = s.chats.find((x) => x.id === id);
    if (!c) return s;
    const keep = (s.trash ?? []).filter((t) => Date.now() - t.trashedAt < TRASH_DAYS * 86_400_000 && t.id !== id);
    return { ...s, chats: s.chats.filter((x) => x.id !== id), trash: [{ ...c, trashedAt: Date.now() }, ...keep] };
  });
}
export function restoreChat(id: string) {
  update((s) => {
    const t = s.trash?.find((x) => x.id === id);
    if (!t) return s;
    const { trashedAt: _gone, ...chat } = t;
    void _gone;
    return { ...s, chats: [{ ...chat, updatedAt: Date.now() }, ...s.chats], trash: s.trash!.filter((x) => x.id !== id) };
  });
}
/** Empty every Trash (Chat, Cowork and Code). */
export const emptyAllTrash = () => update((s) => ({ ...s, trash: [], codeTrash: [] }));
export const deleteForever = (id?: string) => update((s) => ({ ...s, trash: id ? (s.trash ?? []).filter((x) => x.id !== id) : [] }));

export function findModel(ref?: ModelRef) {
  if (!ref) return undefined;
  const conn = getState().connections.find((c) => c.id === ref.connectionId);
  const model = conn?.models.find((m) => m.id === ref.modelId);
  return conn && model ? { conn, model } : undefined;
}

export function addMemory(text: string, projectId?: string) {
  updateNow((s) => ({ ...s, memory: { enabled: s.memory?.enabled ?? true, items: [...(s.memory?.items ?? []), { id: crypto.randomUUID(), text, projectId, createdAt: Date.now() }] } }));
}

/** Forget everything on this device (keys in the desktop keychain are removed by the same save path). */
export function resetState() {
  update(() => ({ ...empty }));
}

// ---------- Unsaved changes in Settings (Save / Reset, like Discord) ----------
// Preference settings edited in Settings show right away but only stick after Save. Actions with their own
// buttons (adding a key, connecting a service, installing a plugin) still apply immediately.
export const STAGED_KEYS = ["profile", "look", "distroId", "customDistros", "myThemes", "lastModel", "webTools", "memory", "autoPicks", "pinnedModes", "modes"] as const;
type StagedKey = (typeof STAGED_KEYS)[number];
let staged: Partial<Pick<State, StagedKey>> | null = null;
const pick = (s: State) => Object.fromEntries(STAGED_KEYS.map((k) => [k, s[k]])) as Pick<State, StagedKey>;

export function beginEditing() {
  load();
  if (!staged) staged = pick(state);
}
export const isEditing = () => !!staged;
// By value: background refreshes often rebuild the same settings as new objects.
export const hasUnsavedChanges = () => !!staged && STAGED_KEYS.some((k) => state[k] !== staged![k] && JSON.stringify(state[k]) !== JSON.stringify(staged![k]));
/** The settings as last saved (what other devices should get while edits are pending). */
export const savedState = (): State => (staged ? { ...state, ...staged } : state);

/** A change that isn't a Settings edit (a default picked for you, a memory the AI saved): kept at once, never waits for Save. */
export function updateNow(fn: (s: State) => State) {
  load();
  if (staged) staged = pick(fn({ ...state, ...staged }));
  update(fn);
}

// After Save or Reset, Settings keeps holding new edits until it closes.
export function saveEdits() {
  if (!staged) return;
  const prev = state;
  staged = null;
  try {
    persist(prev);
  } catch {}
  staged = pick(state);
  listeners.forEach((l) => l());
}
export function revertEdits() {
  if (!staged) return;
  state = { ...state, ...staged };
  staged = null;
  try {
    persist(state);
  } catch {}
  staged = pick(state);
  listeners.forEach((l) => l());
}
/** Leaving Settings: keep editing only if there's something unsaved. */
export function endEditing() {
  if (!hasUnsavedChanges()) staged = null;
}
const nudges = new Set<() => void>();
/** Something tried to leave Settings with unsaved changes. */
export const nudgeUnsaved = () => nudges.forEach((f) => f());
export const onNudge = (f: () => void) => {
  nudges.add(f);
  return () => void nudges.delete(f);
};
