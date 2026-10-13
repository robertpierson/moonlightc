"use client";

import type { Connection, ModelInfo } from "@moonc/core";
import type { UIMessage } from "ai";
import { useSyncExternalStore } from "react";

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

export interface Chat {
  id: string;
  title: string;
  model?: ModelRef;
  modeId?: string;
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
  webTools?: boolean;
}

const KEY = "moonc:v1";
const empty: State = { connections: [], chats: [], favorites: [], modes: [] };
let state: State = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    state = { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    state = empty;
  }
}

export function update(fn: (s: State) => State) {
  load();
  state = fn(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
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
