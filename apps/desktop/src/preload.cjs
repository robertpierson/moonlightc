// The only bridge between the app's pages and the computer. Pages get these functions and nothing else.
const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const listen = (channel, filterId, cb) => {
  const fn = (_e, id, payload) => id === filterId && cb(payload);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};

contextBridge.exposeInMainWorld("moonc", {
  platform: process.platform,
  arch: process.arch,
  version: ipcRenderer.sendSync("version"),
  hardware: () => invoke("hardware"),
  ollama: {
    status: () => invoke("ollama:status"),
    install: async (onProgress) => {
      const fn = (_e, pct, stage) => onProgress(pct, stage);
      ipcRenderer.on("ollama:install-progress", fn);
      try {
        await invoke("ollama:install");
      } finally {
        ipcRenderer.removeListener("ollama:install-progress", fn);
      }
    },
    start: () => invoke("ollama:start"),
    stop: () => invoke("ollama:stop"),
  },
  terminals: {
    tools: () => invoke("terminals:tools"),
    create: (opts) => invoke("terminals:create", opts),
    write: (id, data) => ipcRenderer.send("terminals:write", id, data),
    resize: (id, cols, rows) => ipcRenderer.send("terminals:resize", id, cols, rows),
    kill: (id) => ipcRenderer.send("terminals:kill", id),
    onData: (id, cb) => listen("terminals:data", id, cb),
    onExit: (id, cb) => listen("terminals:exit", id, cb),
  },
  projects: {
    folders: () => invoke("projects:folders"),
    addFolder: () => invoke("projects:add"),
    addKnown: () => invoke("projects:addKnown"),
    removeFolder: (p) => invoke("projects:remove", p),
    scan: () => invoke("projects:scan"),
  },
  secrets: {
    get: (key) => invoke("secrets:get", key),
    set: (key, value) => invoke("secrets:set", key, value),
  },
  settings: {
    get: () => invoke("settings:get"),
    setOpenAtLogin: (on) => invoke("settings:openAtLogin", on),
  },
  device: { info: () => invoke("device:info") },
  keys: { scan: () => invoke("keys:scan") },
  clipboard: { readKey: () => invoke("clipboard:key"), readText: () => invoke("clipboard:text") },
  claude: {
    status: () => invoke("claude:status"),
    run: (id, prompt, sessionId, model, effort) => invoke("claude:run", id, prompt, sessionId, model, effort),
    stop: (id) => invoke("claude:stop", id),
    onEvent: (cb) => {
      const f = (_e, id, line) => cb(id, line);
      ipcRenderer.on("claude:event", f);
      return () => ipcRenderer.removeListener("claude:event", f);
    },
  },
  remote: {
    connect: (client, tiers) => invoke("remote:connect", client, tiers),
    trusted: () => invoke("remote:trusted"),
    setTrusted: (on) => invoke("remote:setTrusted", on),
    end: (clientId, reason) => invoke("remote:end", clientId, reason),
    allowed: (clientId, tier) => invoke("remote:allowed", clientId, tier),
    frame: (clientId) => invoke("remote:frame", clientId),
    allowStream: (clientId) => invoke("remote:allowStream", clientId),
    input: (clientId, a) => invoke("remote:input", clientId, a),
    list: (clientId, dir) => invoke("remote:list", clientId, dir),
    read: (clientId, p) => invoke("remote:read", clientId, p),
    write: (clientId, dir, name, data) => invoke("remote:write", clientId, dir, name, data),
    exec: (clientId, command, cwd) => invoke("remote:exec", clientId, command, cwd),
    state: () => invoke("remote:state"),
    grants: () => invoke("remote:grants"),
    revoke: (clientId) => invoke("remote:revoke", clientId),
    audit: () => invoke("remote:audit"),
    onState: (cb) => {
      const fn = (_e, st) => cb(st);
      ipcRenderer.on("remote:state", fn);
      return () => ipcRenderer.removeListener("remote:state", fn);
    },
  },
  computer: {
    start: (task) => invoke("computer:start", task),
    stop: () => invoke("computer:stop"),
    act: (a) => invoke("computer:act", a),
    status: () => invoke("computer:status"),
    audit: () => invoke("computer:audit"),
    onState: (cb) => {
      const fn = (_e, st) => cb(st);
      ipcRenderer.on("computer:state", fn);
      return () => ipcRenderer.removeListener("computer:state", fn);
    },
  },
  mcp: { approve: (command, args) => invoke("mcp:approve", command, args) },
  onDeepLink: (cb) => {
    const fn = (_e, url) => typeof url === "string" && url.startsWith("moonlightc://") && cb(url);
    ipcRenderer.on("deep-link", fn);
    return () => ipcRenderer.removeListener("deep-link", fn);
  },
  files: {
    saveProject: (name, files) => invoke("files:saveProject", name, files),
    grants: () => invoke("files:grants"),
    grant: () => invoke("files:grant"),
    revoke: (folder) => invoke("files:revoke", folder),
    audit: () => invoke("files:audit"),
  },
  notify: (title, body) => invoke("notify", title, body),
  openExternal: (url) => invoke("open-external", url),
  openPath: (p, editor) => invoke("open-path", p, editor),
});
