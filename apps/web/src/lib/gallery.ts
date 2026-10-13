"use client";

import { useSyncExternalStore } from "react";

// Every Studio result is kept on this device in IndexedDB (videos are too big for localStorage).
// ponytail: device-only gallery; mirror to Supabase Storage once accounts exist.

export interface GalleryItem {
  id: string;
  kind: "image" | "video" | "speech";
  prompt: string;
  providerId: string;
  modelId: string;
  mediaType: string;
  blob: Blob;
  seed?: number;
  createdAt: number;
}

const DB = "moonc-gallery";
let items: GalleryItem[] = [];
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("items", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction("items", mode).objectStore("items"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function load() {
  if (loaded) return;
  loaded = true;
  items = ((await tx("readonly", (s) => s.getAll())) as GalleryItem[]).sort((a, b) => b.createdAt - a.createdAt);
  emit();
}

export async function addItem(item: GalleryItem) {
  await tx("readwrite", (s) => s.put(item));
  items = [item, ...items];
  emit();
}

export async function removeItem(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  items = items.filter((i) => i.id !== id);
  emit();
}

export function useGallery() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      load();
      return () => subs.delete(f);
    },
    () => items,
    () => items,
  );
}
