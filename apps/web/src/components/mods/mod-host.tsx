"use client";

import { useEffect, useRef } from "react";
import { registerFrame, sandboxDocument, type InstalledMod } from "@/lib/mods";
import { useStore } from "@/lib/store";

function Sandbox({ mod }: { mod: InstalledMod }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let markReady!: () => void;
    const ready = new Promise<void>((r) => (markReady = r));
    const onMsg = (e: MessageEvent) => e.source === ref.current?.contentWindow && e.data?.type === "ready" && markReady();
    addEventListener("message", onMsg);
    const off = registerFrame(mod.manifest.id, () => ref.current?.contentWindow ?? null, ready);
    return () => {
      removeEventListener("message", onMsg);
      off();
    };
  }, [mod.manifest.id]);
  // No allow-same-origin: the mod runs in an opaque origin, cut off from MoonlightC's storage and pages.
  return <iframe ref={ref} title={`${mod.manifest.name} (mod)`} sandbox="allow-scripts" srcDoc={sandboxDocument(mod.code ?? "", false)} className="hidden" />;
}

/** Keeps one hidden sandbox running per enabled mod that has a script, so its tools are ready for chats. */
export function ModHost() {
  const mods = useStore((s) => s.mods) ?? [];
  return (
    <>
      {mods
        .filter((m) => m.enabled && m.code && m.manifest.tools.length)
        .map((m) => (
          <Sandbox key={`${m.manifest.id}@${m.manifest.version}:${m.installedAt}`} mod={m} />
        ))}
    </>
  );
}
