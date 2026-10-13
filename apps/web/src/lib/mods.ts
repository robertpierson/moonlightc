"use client";

import { validateManifest, type HostToMod, type ModManifest, type ModToHost } from "@moonc/mods-sdk";
import { update } from "./store";

export interface InstalledMod {
  manifest: ModManifest;
  /** The script exactly as reviewed at install time (pinned; updates need a reinstall). */
  code?: string;
  source: string; // manifest URL
  enabled: boolean;
  installedAt: number;
}

export const REGISTRY = "https://raw.githubusercontent.com/robertpierson/moonlightc-mods/main/index.json";

/** Fetch and validate a mod. Nothing is installed until the user confirms the permissions. */
export async function fetchMod(manifestUrl: string): Promise<InstalledMod> {
  const url = new URL(manifestUrl);
  if (url.protocol !== "https:") throw new Error("Mods must be loaded over https.");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download that mod (${res.status}).`);
  let manifest: ModManifest;
  try {
    manifest = validateManifest(await res.json());
  } catch (e) {
    throw new Error(`That isn't a valid MoonlightC mod: ${e instanceof Error ? e.message.slice(0, 200) : ""}`);
  }
  let code: string | undefined;
  if (manifest.script) {
    const s = await fetch(new URL(manifest.script, url));
    if (!s.ok) throw new Error("Couldn't download the mod's script.");
    code = await s.text();
    if (code.length > 500_000) throw new Error("That mod's script is too big (500 KB limit).");
  }
  return { manifest, code, source: url.toString(), enabled: true, installedAt: Date.now() };
}

export const installMod = (m: InstalledMod) => update((s) => ({ ...s, mods: [...(s.mods ?? []).filter((x) => x.manifest.id !== m.manifest.id), m] }));
export const removeMod = (id: string) => update((s) => ({ ...s, mods: (s.mods ?? []).filter((x) => x.manifest.id !== id) }));
export const setModEnabled = (id: string, enabled: boolean) => update((s) => ({ ...s, mods: (s.mods ?? []).map((x) => (x.manifest.id === id ? { ...x, enabled } : x)) }));

/** Name the AI sees for a mod tool. */
export const modToolName = (modId: string, tool: string) => `mod_${modId.replace(/-/g, "_")}__${tool}`.slice(0, 64);

/**
 * The sandbox page for one mod. The iframe has no same-origin access, so the script can't read MoonlightC's storage,
 * cookies, keys or chats. It gets a tiny `moonc` API and talks to the app only through postMessage.
 */
export function sandboxDocument(code: string, panel: boolean) {
  const safe = JSON.stringify(code).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:12px;color:#222;background:#fff}</style></head><body${panel ? "" : ' hidden'}>
<script>
(() => {
  const tools = {};
  window.moonc = {
    registerTool(name, fn) { tools[name] = fn; },
    panel: document.body,
  };
  addEventListener("message", async (e) => {
    if (e.source !== parent) return;
    const m = e.data;
    if (!m || m.type !== "call") return;
    try {
      if (!tools[m.tool]) throw new Error("This mod has no tool named " + m.tool);
      const output = await tools[m.tool](m.input);
      parent.postMessage({ type: "result", id: m.id, output }, "*");
    } catch (err) {
      parent.postMessage({ type: "result", id: m.id, error: String(err && err.message || err) }, "*");
    }
  });
  try { (0, eval)(${safe}); } catch (err) { console.error(err); }
  parent.postMessage({ type: "ready" }, "*");
})();
</script></body></html>`;
}

// Registry of live sandboxes (filled by <ModHost/>).
const frames = new Map<string, { win: () => Window | null; ready: Promise<void> }>();
export function registerFrame(modId: string, win: () => Window | null, ready: Promise<void>) {
  frames.set(modId, { win, ready });
  return () => frames.delete(modId);
}

let seq = 0;
export async function callModTool(modId: string, tool: string, input: unknown, timeoutMs = 30_000): Promise<unknown> {
  const f = frames.get(modId);
  if (!f) throw new Error("That mod isn't running. Turn it on in Mods.");
  await f.ready;
  const w = f.win();
  if (!w) throw new Error("That mod isn't running.");
  const id = `c${++seq}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      removeEventListener("message", onMsg);
      reject(new Error("The mod took too long to answer."));
    }, timeoutMs);
    const onMsg = (e: MessageEvent<ModToHost>) => {
      if (e.source !== w || e.data?.type !== "result" || e.data.id !== id) return;
      clearTimeout(timer);
      removeEventListener("message", onMsg);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.output);
    };
    addEventListener("message", onMsg);
    w.postMessage({ type: "call", id, tool, input } satisfies HostToMod, "*");
  });
}
