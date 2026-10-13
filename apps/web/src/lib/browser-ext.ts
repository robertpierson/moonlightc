"use client";

// Talks to the MoonlightC Chrome extension through its bridge script (which only runs on MoonlightC's pages).

export const hasExtension = () => typeof document !== "undefined" && !!document.documentElement.dataset.mooncExtension;

export function callExtension<T = unknown>(method: string, params?: object, timeoutMs = 180_000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!hasExtension()) return reject(new Error("The MoonlightC Chrome extension isn't installed in this browser."));
    const id = crypto.randomUUID();
    const done = (e: MessageEvent) => {
      if (e.source !== window || e.data?.source !== "moonc-ext" || e.data.id !== id) return;
      cleanup();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.result as T);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The browser extension didn't answer."));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      removeEventListener("message", done);
    };
    addEventListener("message", done);
    window.postMessage({ source: "moonc-app", id, method, params }, location.origin);
  });
}

/** Tool name -> extension method. */
export const BROWSER_TOOLS: Record<string, string> = { browser_tabs: "tabs", browser_read: "read", browser_click: "click", browser_type: "type", browser_open: "navigate" };
