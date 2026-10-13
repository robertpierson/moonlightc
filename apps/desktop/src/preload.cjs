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
  mcp: { approve: (command, args) => invoke("mcp:approve", command, args) },
  notify: (title, body) => invoke("notify", title, body),
  openExternal: (url) => invoke("open-external", url),
  openPath: (p, editor) => invoke("open-path", p, editor),
});
