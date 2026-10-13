const $ = (id) => document.getElementById(id);
const send = (method, tabId) => chrome.runtime.sendMessage({ from: "popup", method, tabId });

async function render() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { shared = {} } = await chrome.storage.session.get("shared");
  const isShared = tab && String(tab.id) in shared;
  const ok = tab?.url && /^https?:/.test(tab.url);
  $("status").textContent = !ok
    ? "This page can't be shared (only normal web pages can)."
    : isShared
      ? "The AI in MoonlightC can see and use this tab. Risky steps like buying or sending still need your click."
      : "Share this tab so the AI in MoonlightC can read it and click or type for you.";
  $("toggle").hidden = !ok;
  $("toggle").textContent = isShared ? "Stop sharing this tab" : "Share this tab";
  $("toggle").className = isShared ? "stop" : "go";
  $("toggle").onclick = async () => {
    await send(isShared ? "stop" : "share", tab.id);
    render();
  };
  $("stopAll").hidden = Object.keys(shared).length === 0;
  $("stopAll").onclick = async () => {
    await send("stop");
    render();
  };
  const { audit = [] } = await chrome.storage.local.get("audit");
  $("log").replaceChildren(
    ...(audit.length ? audit.slice(0, 15) : [{ action: "Nothing yet." }]).map((e) => {
      const li = document.createElement("li");
      li.textContent = e.at ? `${new Date(e.at).toLocaleTimeString()} ${e.action}${e.target ? ` "${e.target}"` : ""}${e.url ? ` ${e.url}` : ""}${e.result ? ` (${e.result})` : ""}` : e.action;
      return li;
    }),
  );
}
render();
