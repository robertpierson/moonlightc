import { pageAgent } from "./page.js";

// Which tabs the person shared, and when each was last used. Sharing ends after 15 idle minutes.
const IDLE_MS = 15 * 60 * 1000;
const state = { shared: new Map() }; // tabId -> lastUsed

async function load() {
  const { shared = {} } = await chrome.storage.session.get("shared");
  state.shared = new Map(Object.entries(shared).map(([k, v]) => [Number(k), v]));
}
const save = () => chrome.storage.session.set({ shared: Object.fromEntries(state.shared) });
const ready = load();

async function log(action, detail = {}) {
  const { audit = [] } = await chrome.storage.local.get("audit");
  audit.unshift({ at: new Date().toISOString(), action, ...detail });
  await chrome.storage.local.set({ audit: audit.slice(0, 200) });
}

// Asks in a small extension window (web pages can't cover or click it). No answer in 2 minutes means no.
const pending = new Map();
async function confirm(what, tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const id = crypto.randomUUID();
  const site = tab?.url ? new URL(tab.url).hostname : "this tab";
  const answer = new Promise((resolve) => pending.set(id, resolve));
  const win = await chrome.windows.create({ url: chrome.runtime.getURL(`confirm.html?${new URLSearchParams({ id, what, site })}`), type: "popup", width: 440, height: 260, focused: true });
  const closed = (wid) => wid === win.id && pending.get(id)?.(false);
  chrome.windows.onRemoved.addListener(closed);
  const timer = setTimeout(() => pending.get(id)?.(false), 120_000);
  const allowed = await answer;
  clearTimeout(timer);
  pending.delete(id);
  chrome.windows.onRemoved.removeListener(closed);
  chrome.windows.remove(win.id).catch(() => {});
  return allowed;
}

/** Runs an action; if the page says it's risky, asks the person and repeats it only when they allow it. */
async function act(tabId, cmd) {
  const r = await run(tabId, cmd);
  if (!r?.needsConfirm) return r;
  if (!(await confirm(r.needsConfirm, tabId))) return { denied: true, message: "The person said no." };
  return run(tabId, { ...cmd, confirmed: true });
}

const run = async (tabId, cmd) => (await chrome.scripting.executeScript({ target: { tabId }, func: pageAgent, args: [cmd] }))[0]?.result;

export async function share(tabId) {
  await ready;
  state.shared.set(tabId, Date.now());
  await save();
  await chrome.action.setBadgeText({ tabId, text: "AI" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#6d28d9" });
  await run(tabId, { type: "banner", on: true }).catch(() => {});
  await log("share", { tabId });
}

export async function stop(tabId, reason = "stopped") {
  await ready;
  const ids = tabId === undefined ? [...state.shared.keys()] : [tabId];
  for (const id of ids) {
    state.shared.delete(id);
    await chrome.action.setBadgeText({ tabId: id, text: "" }).catch(() => {});
    await run(id, { type: "banner", on: false }).catch(() => {});
  }
  await save();
  if (ids.length) await log("stop", { tabs: ids, reason });
}

async function sharedTab(tabId) {
  await ready;
  for (const [id, used] of state.shared) if (Date.now() - used > IDLE_MS) await stop(id, "idle for 15 minutes");
  const id = tabId ?? [...state.shared.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (id === undefined || !state.shared.has(id)) throw new Error("No tab is shared. Ask the person to click the MoonlightC extension icon on a tab and choose Share this tab.");
  state.shared.set(id, Date.now());
  await save();
  return id;
}

async function fromApp(method, p = {}) {
  if (method === "ping") return { ok: true };
  if (method === "tabs") {
    await sharedTab().catch(() => {});
    const tabs = await Promise.all([...state.shared.keys()].map((id) => chrome.tabs.get(id).catch(() => null)));
    return tabs.filter(Boolean).map((t) => ({ tabId: t.id, title: t.title, url: t.url }));
  }
  const tabId = await sharedTab(p.tabId);
  if (method === "read") {
    await log("read", { tabId });
    return run(tabId, { type: "read" });
  }
  if (method === "click") {
    const r = await act(tabId, { type: "click", ref: p.ref, text: p.text });
    await log("click", { tabId, target: p.ref ?? p.text, result: r?.denied ? "denied" : r?.error ? "not found" : "done" });
    return r;
  }
  if (method === "type") {
    const r = await act(tabId, { type: "type", ref: p.ref, text: p.text, value: String(p.value ?? ""), submit: !!p.submit });
    await log("type", { tabId, target: p.ref ?? p.text, chars: String(p.value ?? "").length, submit: !!p.submit });
    return r;
  }
  if (method === "navigate") {
    const url = String(p.url ?? "");
    if (!/^https?:\/\//.test(url)) throw new Error("Only http and https links can be opened.");
    await chrome.tabs.update(tabId, { url });
    await log("navigate", { tabId, url });
    await new Promise((r) => setTimeout(r, 1500));
    await run(tabId, { type: "banner", on: true }).catch(() => {});
    return { opened: url };
  }
  throw new Error("Unknown request.");
}

// Only MoonlightC's own pages may ask for anything: the same sites the bridge script runs on (see manifest.json).
const APP_SITES = chrome.runtime.getManifest().content_scripts[0].matches.map((m) => m.replace(/\/\*$/, ""));
const isApp = (sender) => {
  try {
    const u = new URL(sender.origin ?? sender.url);
    return APP_SITES.includes(`${u.protocol}//${u.hostname}`);
  } catch {
    return false;
  }
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const job =
    msg?.from === "app" && sender.tab?.id !== undefined && isApp(sender)
      ? fromApp(msg.method, msg.params)
      : msg?.from === "page" && msg.method === "stop" && sender.tab?.id !== undefined
        ? stop(sender.tab.id, "stopped on the page")
        : msg?.from === "confirm" && sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL("confirm.html"))
          ? Promise.resolve(pending.get(msg.id)?.(msg.allow === true))
        : msg?.from === "popup" && !sender.tab && sender.id === chrome.runtime.id
          ? msg.method === "share"
            ? share(msg.tabId)
            : msg.method === "stop"
              ? stop(msg.tabId)
              : Promise.reject(new Error("Unknown request."))
          : Promise.reject(new Error("Not allowed."));
  job.then((result) => reply({ ok: true, result }), (err) => reply({ ok: false, error: String(err?.message ?? err) }));
  return true;
});

chrome.commands.onCommand.addListener((c) => c === "stop-all" && stop(undefined, "keyboard shortcut"));
chrome.tabs.onRemoved.addListener((id) => state.shared.delete(id) && save());
// Keep the banner on a shared tab after it loads a new page.
chrome.tabs.onUpdated.addListener(async (id, info) => {
  await ready;
  if (info.status === "complete" && state.shared.has(id)) run(id, { type: "banner", on: true }).catch(() => {});
});

// For tests: the service worker exposes these.
globalThis.mooncShare = share;
globalThis.mooncStop = stop;
