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

export interface Chat {
  id: string;
  title: string;
  model?: ModelRef;
  messages: UIMessage[];
  pinned?: boolean;
  updatedAt: number;
}

interface State {
  connections: SavedConnection[];
  chats: Chat[];
  favorites: string[]; // `${connectionId}:${modelId}`
  lastModel?: ModelRef;
}

const KEY = "moonc:v1";
const empty: State = { connections: [], chats: [], favorites: [] };
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
