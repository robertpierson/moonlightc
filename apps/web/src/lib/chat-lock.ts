"use client";

import { useSyncExternalStore } from "react";
import { getState, patchChat, trashChat, update, updateNow } from "./store";

// Locked chats: hidden from lists and search until you enter your PIN. It keeps chats out of sight on a shared
// screen; it isn't encryption (the chats stay on this device and in your account as before).

const hash = async (pin: string, salt: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`))), (b) => b.toString(16).padStart(2, "0")).join("");

export const validPin = (pin: string) => /^\d{4,8}$/.test(pin);
export const hasPin = () => !!getState().chatLock;

export async function setPin(pin: string) {
  if (!validPin(pin)) throw new Error("Use 4 to 8 digits.");
  const salt = crypto.randomUUID();
  const h = await hash(pin, salt);
  updateNow((s) => ({ ...s, chatLock: { salt, hash: h } }));
}

export async function checkPin(pin: string) {
  const l = getState().chatLock;
  return !!l && (await hash(pin, l.salt)) === l.hash;
}

/** Forgot the PIN: locked chats go to the Trash (never shown), then a new PIN can be set. */
export function resetPin() {
  for (const c of getState().chats.filter((c) => c.locked)) {
    patchChat(c.id, { locked: false });
    trashChat(c.id);
  }
  update((s) => ({ ...s, chatLock: undefined }));
  setOpen(false);
}

// Changing the time makes the lock sync to your other devices.
export const lockChat = (id: string) => patchChat(id, { locked: true, updatedAt: Date.now() });
export const unlockChat = (id: string) => patchChat(id, { locked: false, updatedAt: Date.now() });

// Unlocked for this visit (until the page reloads or you lock again).
let open = false;
const subs = new Set<() => void>();
export const setOpen = (v: boolean) => ((open = v), subs.forEach((f) => f()));
export const useLockOpen = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => open,
    () => false,
  );

/** Chats to show in lists: never the locked ones. */
export const visible = <T extends { locked?: boolean }>(chats: T[]) => chats.filter((c) => !c.locked);
