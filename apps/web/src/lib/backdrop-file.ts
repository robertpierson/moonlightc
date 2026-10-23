"use client";

// Your own background picture or video, kept on this device (IndexedDB), so big and animated files fit.
const DB = "moonc-backdrop";
const STORE = "files";

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
};

export const MAX_BACKDROP = 200 * 1024 * 1024;
export const loadBackdrop = () => run<Blob | undefined>("readonly", (s) => s.get("current")).catch(() => undefined);
export const saveBackdrop = (f: Blob) => run("readwrite", (s) => s.put(f, "current"));
export const clearBackdrop = () => run("readwrite", (s) => s.delete("current"));
