// Runs only on MoonlightC's own pages. Passes the app's requests to the extension and the answers back.
// Other websites never get this script, so they can't reach the extension.
document.documentElement.dataset.mooncExtension = chrome.runtime.getManifest().version;

window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.source !== "moonc-app" || typeof e.data.id !== "string") return;
  const { id, method, params } = e.data;
  chrome.runtime
    .sendMessage({ from: "app", method, params })
    .then((r) => window.postMessage(r?.ok ? { source: "moonc-ext", id, result: r.result } : { source: "moonc-ext", id, error: r?.error ?? "No answer." }, location.origin))
    .catch((err) => window.postMessage({ source: "moonc-ext", id, error: String(err?.message ?? err) }, location.origin));
});
