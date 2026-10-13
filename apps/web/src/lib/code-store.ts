"use client";

import { useSyncExternalStore } from "react";
import type { CodeProject } from "./code";

// Code projects live in IndexedDB on this device (they can be far bigger than localStorage allows).
// ponytail: device-only; sync to Supabase Storage with accounts.

let projects: CodeProject[] = [];
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("moonc-code", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("projects", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const req = fn(d.transaction("projects", mode).objectStore("projects"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function load() {
  if (loaded) return;
  loaded = true;
  projects = ((await run("readonly", (s) => s.getAll())) as CodeProject[]).sort((a, b) => b.updatedAt - a.updatedAt);
  emit();
}

export async function saveProject(p: CodeProject) {
  projects = [p, ...projects.filter((x) => x.id !== p.id)];
  emit();
  await run("readwrite", (s) => s.put(p));
}

export async function deleteProject(id: string) {
  projects = projects.filter((x) => x.id !== id);
  emit();
  await run("readwrite", (s) => s.delete(id));
}

export const getProject = (id: string) => projects.find((p) => p.id === id);

export function useCodeProjects() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      load();
      return () => subs.delete(f);
    },
    () => projects,
    () => projects,
  );
}
