import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, Notification, safeStorage, shell, Tray } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hardware } from "./hardware.mjs";
import * as ollama from "./ollama.mjs";
import * as projects from "./projects.mjs";
import * as terminals from "./terminals.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const devURL = process.env.MOONC_DEV_URL; // e.g. http://localhost:3000 while developing
let appURL = devURL;
let server;
let win;
let quick;
let tray;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.setAsDefaultProtocolClient("moonlightc");

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = /** @type {net.AddressInfo} */ (s.address());
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });

/** Start the bundled Next.js server (the same app as the website) on a private localhost port. */
async function startServer() {
  const root = app.isPackaged ? path.join(process.resourcesPath, "app-server") : path.join(here, "..", "app-server");
  const entry = path.join(root, "apps", "web", "server.js");
  if (!fs.existsSync(entry)) throw new Error(`Missing app server at ${entry}. Run "pnpm bundle-web" first.`);
  const port = await freePort();
  server = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: { ...process.env, NODE_PATH: path.join(root, "deps", ".pnpm", "node_modules"), ELECTRON_RUN_AS_NODE: "1", PORT: String(port), HOSTNAME: "127.0.0.1", MOONC_DESKTOP: "1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.stderr.on("data", (d) => console.error("[server]", String(d).trim()));
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    const ok = await fetch(url + "/manifest.webmanifest").then((r) => r.ok).catch(() => false);
    if (ok) return url;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("The app server didn't start.");
}

function lockDown(w) {
  // Only our own pages load inside the window; every other link opens in the user's browser.
  const isOurs = (u) => u.startsWith(appURL);
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  w.webContents.on("will-navigate", (e, url) => {
    if (!isOurs(url)) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  w.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => cb(["media", "clipboard-sanitized-write", "notifications"].includes(permission)));
}

const webPreferences = { preload: path.join(here, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false };

function createWindow() {
  win = new BrowserWindow({ width: 1280, height: 840, minWidth: 360, minHeight: 500, backgroundColor: "#0f1736", title: "MoonlightC", icon: iconPath(), webPreferences });
  lockDown(win);
  win.loadURL(appURL + "/app");
  win.on("close", (e) => {
    // Closing the window keeps MoonlightC in the tray (so the hotkey still works). Quit from the tray menu.
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function toggleQuickAsk() {
  if (quick && !quick.isDestroyed()) {
    if (quick.isVisible()) quick.hide();
    else {
      quick.show();
      quick.focus();
    }
    return;
  }
  quick = new BrowserWindow({ width: 720, height: 520, frame: false, alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: "#0f1736", webPreferences });
  lockDown(quick);
  quick.loadURL(appURL + "/app?quick=1");
  quick.once("ready-to-show", () => quick.show());
  quick.on("blur", () => quick.hide());
}

function iconPath() {
  return path.join(here, "..", "build", "icon.png");
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 }));
  tray.setToolTip("MoonlightC");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open MoonlightC", click: () => (win.show(), win.focus()) },
      { label: "Quick ask (Alt+Space)", click: toggleQuickAsk },
      { type: "separator" },
      { label: "Quit MoonlightC", click: () => app.quit() },
    ]),
  );
  tray.on("click", () => (win.isVisible() ? win.focus() : win.show()));
}

// ---------- Bridge handlers (see preload.cjs). Every handler checks the sender is one of our windows. ----------
const handle = (channel, fn) =>
  ipcMain.handle(channel, (e, ...args) => {
    if (!e.senderFrame?.url.startsWith(appURL)) throw new Error("Not allowed.");
    return fn(e, ...args);
  });

ipcMain.on("version", (e) => (e.returnValue = app.getVersion()));
handle("hardware", () => hardware());
handle("ollama:status", () => ollama.status());
handle("ollama:install", (e) => ollama.install((pct, stage) => e.sender.send("ollama:install-progress", pct, stage)));
handle("ollama:start", () => ollama.start());
handle("ollama:stop", () => ollama.stop());
handle("terminals:tools", () => terminals.tools());
handle("terminals:create", (e, opts) => terminals.create(e.sender, opts));
const on = (channel, fn) =>
  ipcMain.on(channel, (e, ...args) => {
    if (e.senderFrame?.url.startsWith(appURL)) fn(e, ...args);
  });
on("terminals:write", (_e, id, data) => terminals.write(id, data));
on("terminals:resize", (_e, id, cols, rows) => terminals.resize(id, cols, rows));
on("terminals:kill", (_e, id) => terminals.kill(id));
handle("projects:folders", () => projects.folders());
handle("projects:add", async () => {
  const r = await dialog.showOpenDialog(win, { title: "Choose a folder for My AI Projects to scan", properties: ["openDirectory"] });
  return r.canceled ? projects.folders() : projects.addFolder(r.filePaths[0]);
});
handle("projects:remove", (_e, p) => projects.removeFolder(p));
handle("projects:addKnown", () => projects.addKnown());
handle("projects:scan", () => projects.scan());

// Secrets (API keys) are encrypted with the OS keychain (DPAPI / Keychain / libsecret) via safeStorage.
const secretsFile = () => path.join(app.getPath("userData"), "secrets.json");
const readSecrets = () => {
  try {
    return JSON.parse(fs.readFileSync(secretsFile(), "utf8"));
  } catch {
    return {};
  }
};
handle("secrets:get", (_e, key) => {
  const v = readSecrets()[key];
  return v ? safeStorage.decryptString(Buffer.from(v, "base64")) : null;
});
handle("secrets:set", (_e, key, value) => {
  const all = readSecrets();
  if (value == null) delete all[key];
  else all[key] = safeStorage.encryptString(value).toString("base64");
  fs.writeFileSync(secretsFile(), JSON.stringify(all), { mode: 0o600 });
});
handle("settings:get", () => ({ openAtLogin: app.getLoginItemSettings().openAtLogin }));
handle("settings:openAtLogin", (_e, on) => app.setLoginItemSettings({ openAtLogin: !!on }));
handle("open-external", (_e, url) => {
  if (!/^https:\/\//.test(url)) throw new Error("Only https links can be opened.");
  return shell.openExternal(url);
});
handle("open-path", (_e, p, editor) => projects.openPath(p, editor));
handle("notify", (_e, title, body) => new Notification({ title, body }).show());

// ---------- Lifecycle ----------
app.on("second-instance", (_e, argv) => {
  win?.show();
  win?.focus();
  const link = argv.find((a) => a.startsWith("moonlightc://"));
  if (link) win?.webContents.send("deep-link", link);
});

app.whenReady().then(async () => {
  try {
    appURL ??= await startServer();
  } catch (err) {
    dialog.showErrorBox("MoonlightC couldn't start", String(err?.message ?? err));
    app.quit();
    return;
  }
  createWindow();
  createTray();
  if (!globalShortcut.register("Alt+Space", toggleQuickAsk)) console.warn("Alt+Space is taken by another app.");
});

app.on("before-quit", () => {
  quitting = true;
  terminals.killAll();
  server?.kill();
});
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {});
