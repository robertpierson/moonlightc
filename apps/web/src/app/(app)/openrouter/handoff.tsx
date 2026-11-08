"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

export function Handoff() {
  // The code is in the address bar, which only exists in the browser.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <Inner /> : null;
}

function Inner() {
  const [link] = useState(() => {
    const q = new URLSearchParams(location.search);
    const code = q.get("code");
    const state = q.get("state");
    return code && state ? `moonlightc://openrouter?${new URLSearchParams({ code, state })}` : "";
  });
  useEffect(() => {
    if (link) location.href = link;
  }, [link]);
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="grid max-w-sm gap-3">
        <h1 className="text-xl font-semibold">{link ? "Signed in to OpenRouter" : "Nothing to hand back"}</h1>
        <p className="text-sm text-muted-foreground">
          {link ? "MoonlightC should open by itself. If it doesn't, click the button. You can close this tab afterwards." : "Start from Sign in with OpenRouter in the MoonlightC app."}
        </p>
        {link && (
          <a href={link} className="justify-self-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Open MoonlightC
          </a>
        )}
      </div>
    </main>
  );
}
