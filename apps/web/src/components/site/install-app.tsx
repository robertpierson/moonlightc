"use client";

import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Shows a real install button only where the browser offers one (Chrome, Edge, Android). */
export function InstallApp({ className }: { className?: string }) {
  const [evt, setEvt] = useState<PromptEvent>();
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    addEventListener("beforeinstallprompt", onPrompt);
    addEventListener("appinstalled", onInstalled);
    return () => {
      removeEventListener("beforeinstallprompt", onPrompt);
      removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (installed) return <p className="mt-4 font-medium">Installed. Find MoonlightC with your other apps.</p>;
  if (!evt) return null;
  return (
    <button
      className={className ?? "mt-4 rounded-full btn-moon px-6 py-3 font-semibold "}
      onClick={async () => {
        await evt.prompt();
        await evt.userChoice;
        setEvt(undefined);
      }}
    >
      Install MoonlightC
    </button>
  );
}
