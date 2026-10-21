import { app, BrowserWindow, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, Menu, nativeImage, Notification, powerMonitor, powerSaveBlocker, safeStorage, session, shell, Tray } from "electron";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as computer from "./computer.mjs";
import * as remote from "./remote.mjs";
import { scanKeys } from "./keyscan.mjs";
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

// Test runs get their own data folder, so they never touch (or collide with) an installed copy that's running.
// They also run without a visible window or tray icon, so they never look like a second MoonlightC on the screen.
const testRun = !app.isPackaged && !!process.env.MOONC_E2E_USER_DATA;
if (testRun) app.setPath("userData", process.env.MOONC_E2E_USER_DATA);
if (!app.requestSingleInstanceLock() || process.argv.includes("--quit")) app.quit();
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

const portFree = (port) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
  });

// Chats and settings live in the browser storage of http://127.0.0.1:<port>, so the port must stay the same from one
// launch to the next. Reuse the saved one; pick (and save) a new one only if it's taken.
/** A server left running by a crash or forced close keeps our port (and with it this PC's sign-in and data). End it. */
async function endLeftoverServer() {
  const file = path.join(app.getPath("userData"), "server.pid");
  let port;
  try {
    port = JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "port.json"), "utf8")).port;
  } catch {
    return;
  }
  // Only if our port really is answering as MoonlightC (never touch an unrelated process that reused the ID).
  const ours = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`, { signal: AbortSignal.timeout(1500) })
    .then((r) => r.json())
    .then((m) => m?.name === "MoonlightC")
    .catch(() => false);
  if (!ours) return;
  let pid;
  try {
    pid = Number(fs.readFileSync(file, "utf8"));
  } catch {
    return;
  }
  try {
    process.kill(pid, 0);
  } catch {
    return; // already gone
  }
  try {
    process.kill(pid);
  } catch {}
  for (let i = 0; i < 40; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function stablePort() {
  await endLeftoverServer();
  const file = path.join(app.getPath("userData"), "port.json");
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(file, "utf8")).port;
  } catch {}
  for (const p of [saved, 47821]) if (Number.isInteger(p) && (await portFree(p))) return keep(p);
  return keep(await freePort());
  function keep(p) {
    if (p !== saved) fs.writeFileSync(file, JSON.stringify({ port: p }));
    return p;
  }
}

/** Start the bundled Next.js server (the same app as the website) on a private localhost port. */
async function startServer() {
  const root = app.isPackaged ? path.join(process.resourcesPath, "app-server") : path.join(here, "..", "app-server");
  const entry = path.join(root, "apps", "web", "server.js");
  if (!fs.existsSync(entry)) throw new Error(`Missing app server at ${entry}. Run "pnpm bundle-web" first.`);
  const port = await stablePort();
  server = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: { ...process.env, MOONC_E2E_AUTO_APPROVE: app.isPackaged ? "" : (process.env.MOONC_E2E_AUTO_APPROVE ?? ""), MOONC_MCP_ALLOWLIST: mcpAllowlist(), MOONC_FILE_GRANTS: fileGrants(), MOONC_FILE_AUDIT: fileAudit(), NODE_PATH: path.join(root, "deps", ".pnpm", "node_modules"), ELECTRON_RUN_AS_NODE: "1", PORT: String(port), HOSTNAME: "127.0.0.1", MOONC_DESKTOP: "1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.stderr.on("data", (d) => console.error("[server]", String(d).trim()));
  fs.writeFileSync(path.join(app.getPath("userData"), "server.pid"), String(server.pid));
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

// --hidden: start in the tray (used when starting with Windows, and after quiet updates).
const startHidden = process.argv.includes("--hidden");
const webPreferences = { preload: path.join(here, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false };

function createWindow() {
  win = new BrowserWindow({ width: 1280, height: 840, minWidth: 360, minHeight: 500, backgroundColor: "#0e1220", title: "MoonlightC", icon: iconPath(), show: !testRun && !startHidden, webPreferences: { ...webPreferences, backgroundThrottling: false } });
  lockDown(win);
  win.loadURL(appURL + "/app");
  // Settings has unsaved changes: ask instead of silently refusing to quit.
  win.webContents.on("will-prevent-unload", (e) => {
    const leave = testRun || dialog.showMessageBoxSync(win, { type: "question", buttons: ["Quit and discard", "Cancel"], defaultId: 1, cancelId: 1, title: "Unsaved changes", message: "You have unsaved changes in Settings. Quit anyway?" }) === 0;
    if (leave) e.preventDefault();
    else quitting = false;
  });
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
  quick = new BrowserWindow({ width: 720, height: 520, frame: false, alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: "#0e1220", webPreferences });
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

// Local MCP commands run only after the user approves the exact command line in a native dialog.
const mcpAllowlist = () => path.join(app.getPath("userData"), "mcp-commands.json");
const readAllowlist = () => {
  try {
    return JSON.parse(fs.readFileSync(mcpAllowlist(), "utf8"));
  } catch {
    return [];
  }
};

// Folders the AI may use. Only the native folder picker adds one; the local server reads this file on every call.
const fileGrants = () => path.join(app.getPath("userData"), "file-grants.json");
const fileAudit = () => path.join(app.getPath("userData"), "file-audit.jsonl");
const readGrants = () => {
  try {
    return JSON.parse(fs.readFileSync(fileGrants(), "utf8"));
  } catch {
    return [];
  }
};

// ---------- Bridge handlers (see preload.cjs). Every handler checks the sender is one of our windows. ----------
const handle = (channel, fn) =>
  ipcMain.handle(channel, (e, ...args) => {
    if (!e.senderFrame?.url.startsWith(appURL)) throw new Error("Not allowed.");
    return fn(e, ...args);
  });

ipcMain.on("version", (e) => (e.returnValue = app.getVersion()));
handle("hardware", () => hardware());
handle("keys:scan", () => scanKeys());
handle("mcp:approve", async (_e, command, args) => {
  command = String(command);
  args = Array.isArray(args) ? args.map(String) : [];
  const list = readAllowlist();
  if (list.some((x) => x.command === command && JSON.stringify(x.args) === JSON.stringify(args))) return true;
  const { response } = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Allow", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    title: "Allow a local connector?",
    message: "Let MoonlightC run this program on your computer?",
    detail: `${[command, ...args].join(" ")}

Only allow programs you trust. The AI will be able to use the tools this program offers, and you choose per tool whether it must ask first.`,
  });
  if (response !== 0) return false;
  fs.writeFileSync(mcpAllowlist(), JSON.stringify([...list, { command, args }]));
  return true;
});
handle("files:grants", () => readGrants());
handle("files:grant", async () => {
  // Tests can't click the native picker; unpackaged test runs may name the folder instead.
  const testDir = !app.isPackaged && process.env.MOONC_E2E_GRANT_DIR;
  const r = testDir ? { canceled: false, filePaths: [testDir] } : await dialog.showOpenDialog(win, { title: "Choose a folder the AI can use", properties: ["openDirectory"] });
  if (r.canceled || !r.filePaths[0]) return readGrants();
  const folder = fs.realpathSync.native(r.filePaths[0]);
  if (folder === path.parse(folder).root) {
    await dialog.showMessageBox(win, { type: "warning", message: "Pick a specific folder, not a whole drive." });
    return readGrants();
  }
  const list = readGrants().filter((g) => g !== folder);
  fs.writeFileSync(fileGrants(), JSON.stringify([...list, folder]));
  return [...list, folder];
});
handle("files:revoke", (_e, folder) => {
  const list = readGrants().filter((g) => g !== String(folder));
  fs.writeFileSync(fileGrants(), JSON.stringify(list));
  return list;
});
handle("files:audit", () => {
  try {
    return fs.readFileSync(fileAudit(), "utf8").trim().split("\n").slice(-100).reverse().map((l) => JSON.parse(l));
  } catch {
    return [];
  }
});
handle("ollama:status", () => ollama.status());
handle("ollama:install", (e) => ollama.install((pct, stage) => e.sender.send("ollama:install-progress", pct, stage)));
handle("ollama:start", () => ollama.start());
handle("ollama:stop", () => ollama.stop());
handle("computer:start", (_e, task) => computer.start(win, task));
handle("computer:stop", () => computer.stop("stopped in the app"));
handle("computer:act", (_e, a) => computer.act(win, a ?? {}));
handle("computer:status", () => computer.status());
handle("computer:audit", () => computer.readAudit());
computer.onState((st) => BrowserWindow.getAllWindows().forEach((w) => !w.isDestroyed() && w.webContents.send("computer:state", st)));
remote.onState((st) => BrowserWindow.getAllWindows().forEach((w) => !w.isDestroyed() && w.webContents.send("remote:state", st)));
handle("device:info", () => remote.deviceInfo());
handle("remote:connect", (_e, client, tiers, where) => remote.connect(win, client, tiers, where));
handle("remote:places", () => remote.places());
handle("remote:setPlaces", (_e, p) => remote.setPlaces(p));
handle("remote:end", (_e, clientId, reason) => remote.end(clientId ?? undefined, reason ? String(reason).slice(0, 80) : undefined));
handle("remote:allowed", (_e, clientId, tier) => remote.allowed(String(clientId), String(tier)));
handle("remote:frame", (_e, clientId) => remote.frame(String(clientId)));
// Screen video (and, on Windows, its sound) for remote control: only right after a connected device with
// "see the screen" asked (see remote.mjs). Set up on first use; touching the session at startup slows relaunches.
let displayHandler = false;
handle("remote:allowStream", (_e, clientId) => {
  const ok = remote.allowStream(String(clientId));
  if (!displayHandler) {
    displayHandler = true;
    session.defaultSession.setDisplayMediaRequestHandler((req, cb) => {
      if (!remote.takeStreamGrant()) return cb({});
      desktopCapturer.getSources({ types: ["screen"] }).then(
        ([screen]) => cb(screen ? { video: screen, ...(req.audioRequested && process.platform === "win32" ? { audio: "loopback" } : {}) } : {}),
        () => cb({}),
      );
    });
  }
  return ok;
});
handle("remote:input", (_e, clientId, a) => remote.input(String(clientId), a));
handle("remote:list", (_e, clientId, dir) => remote.list(String(clientId), dir));
handle("remote:read", (_e, clientId, p) => remote.read(String(clientId), p));
handle("remote:write", (_e, clientId, dir, name, data) => remote.write(String(clientId), dir, name, data));
handle("remote:exec", (_e, clientId, command, cwd) => remote.exec(String(clientId), command, cwd));
handle("remote:state", () => remote.state());
handle("remote:grants", () => remote.grants());
handle("remote:revoke", (_e, clientId) => remote.revoke(String(clientId)));
handle("remote:audit", () => remote.readAudit());
handle("remote:power", (_e, clientId, what) => remote.power(String(clientId), String(what)));
handle("remote:status", () => remote.status());

// Windows changes that need administrator rights: one Windows "Yes" prompt, then they run hidden.
const elevated = (script) =>
  new Promise((done) => {
    if (process.platform !== "win32") return done({ ok: false, error: "This works on Windows." });
    const enc = Buffer.from(script, "utf16le").toString("base64");
    execFile("powershell.exe", ["-NoProfile", "-Command", `try { Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','${enc}'; exit 0 } catch { exit 1 }`], { windowsHide: true }, (err) =>
      done(err ? { ok: false, error: "Windows didn't allow it (the Yes prompt was closed)." } : { ok: true }),
    );
  });
// Wake-on-LAN on the network adapters, and no "fast startup" (it stops a PC that's off from hearing the wake signal).
handle("setup:wake", () =>
  elevated(`Get-NetAdapter -Physical | ForEach-Object { Set-NetAdapterPowerManagement -Name $_.Name -WakeOnMagicPacket Enabled -ErrorAction SilentlyContinue; powercfg /deviceenablewake "$($_.InterfaceDescription)" }
Set-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name HiberbootEnabled -Value 0 -Type DWord
New-Item 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Force | Out-Null
Set-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name NoAutoRebootWithLoggedOnUsers -Value 1 -Type DWord
Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings' -Name ActiveHoursStart -Value 6 -Type DWord
Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings' -Name ActiveHoursEnd -Value 0 -Type DWord`),
);

// Admin mode (opt-in): MoonlightC starts with administrator rights at sign-in (a scheduled task, no prompt), and Windows'
// "Yes"/PIN prompts show on the normal screen instead of the locked-off secure one. Then a remote session can see those
// prompts and answer them (you type your own PIN), and the terminal runs as administrator.
const isAdmin = () => new Promise((done) => (process.platform !== "win32" ? done(false) : execFile("net.exe", ["session"], { windowsHide: true }, (err) => done(!err))));
handle("setup:adminStatus", async () => ({ admin: await isAdmin() }));
handle("setup:admin", async (_e, on) => {
  const exe = process.execPath;
  const r = await elevated(
    on
      ? `$a = New-ScheduledTaskAction -Execute '${exe}' -Argument '--hidden'
$t = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$p = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive
$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName MoonlightC -Action $a -Trigger $t -Principal $p -Settings $s -Force | Out-Null
Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -Name PromptOnSecureDesktop -Value 0 -Type DWord
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-Command','Start-Sleep 6; Start-ScheduledTask -TaskName MoonlightC'`
      : `Unregister-ScheduledTask -TaskName MoonlightC -Confirm:$false -ErrorAction SilentlyContinue
Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -Name PromptOnSecureDesktop -Value 1 -Type DWord`,
  );
  if (!r.ok) return r;
  // The scheduled task starts MoonlightC instead (with admin rights); Windows' normal startup entry would start a second copy.
  app.setLoginItemSettings({ openAtLogin: !on, args: ["--hidden"] });
  if (on) setTimeout(() => (quitting = true, app.quit()), 500);
  return r;
});

// Sign in to Windows by itself: allows password sign-in again, then opens Windows' own "User Accounts" box where the
// person unticks "Users must enter a user name and password" and types their password there (never seen by MoonlightC).
handle("setup:autoSignIn", async () => {
  const r = await elevated(`New-Item 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\PasswordLess\\Device' -Force | Out-Null
Set-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\PasswordLess\\Device' -Name DevicePasswordLessBuildVersion -Value 0 -Type DWord`);
  if (r.ok) spawn("netplwiz.exe", [], { detached: true, stdio: "ignore" }).unref();
  return r;
});
// While remote control is on, Windows doesn't sleep, turn the screen off or lock by itself (no fake mouse moves;
// you can still sleep or lock it yourself).
let awake;
handle("settings:keepAwake", (_e, on) => {
  if (on && awake === undefined) awake = powerSaveBlocker.start("prevent-display-sleep");
  if (!on && awake !== undefined) (powerSaveBlocker.stop(awake), (awake = undefined));
});

// Your own Claude Code on this PC (the CLI you installed and signed in to). Reachable only from this app's window.
const CLAUDE = process.platform === "win32" ? "claude.cmd" : "claude";
const claudeRuns = new Map();
// Automated tests don't touch the real Claude Code unless a test asks for it (MOONC_E2E_CLAUDE=1).
// Checked at most every 10 minutes: each check starts Claude Code, and your devices ask every time they connect.
let claudeStatus;
handle("claude:status", () =>
  testRun && process.env.MOONC_E2E_CLAUDE !== "1" ? { installed: false } : claudeStatus && Date.now() - claudeStatus.at < 600_000 ? claudeStatus.value : new Promise((done) =>
    execFile(CLAUDE, ["--version"], { shell: process.platform === "win32", timeout: 20_000, windowsHide: true }, (err, out) => {
      const value = err ? { installed: false } : { installed: true, version: String(out).trim() };
      claudeStatus = { at: Date.now(), value };
      done(value);
    }),
  ),
);
handle("claude:run", (e, id, prompt, sessionId, model, effort) => {
  const args = ["--print", "--output-format", "stream-json", "--verbose", ...(typeof model === "string" && /^(sonnet|opus|haiku|claude-[a-z0-9-]{3,60})$/.test(model) ? ["--model", model] : []), ...(typeof effort === "string" && /^(low|medium|high|xhigh|max)$/.test(effort) ? ["--effort", effort] : []), ...(typeof sessionId === "string" && /^[\w-]{1,80}$/.test(sessionId) ? ["--resume", sessionId] : [])];
  // The message goes in on stdin, never on the command line.
  // A clean environment: settings from another Claude Code session (if MoonlightC was started from one) break its login.
  const inherited = !!(process.env.CLAUDECODE || process.env.CLAUDE_CODE_SESSION_ID);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE_|CLAUDECODE$)/.test(k) && !(inherited && k === "ANTHROPIC_BASE_URL")));
  const child = spawn(CLAUDE, args, { cwd: app.getPath("home"), env, shell: process.platform === "win32", windowsHide: true });
  claudeRuns.set(id, child);
  let rest = "";
  child.stdout.on("data", (d) => {
    const lines = (rest + d).split(/\r?\n/);
    rest = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) e.sender.send("claude:event", id, l);
  });
  child.stderr.on("data", (d) => e.sender.send("claude:event", id, JSON.stringify({ type: "stderr", text: String(d).slice(0, 2000) })));
  child.on("close", (code) => {
    if (rest.trim()) e.sender.send("claude:event", id, rest);
    e.sender.send("claude:event", id, JSON.stringify({ type: "exit", code }));
    claudeRuns.delete(id);
  });
  child.stdin.end(String(prompt ?? "").slice(0, 100_000));
  return true;
});
handle("claude:stop", (_e, id) => {
  claudeRuns.get(id)?.kill();
  return true;
});
// Quick connect: hand back the clipboard only when it looks like an API key (one token, no spaces).
// The built-in terminal's paste (Ctrl+V / right-click).
handle("clipboard:text", async () => String((await clipboard.readText()) ?? "").slice(0, 1_000_000));
handle("clipboard:key", async () => {
  const t = String((await clipboard.readText()) ?? "").trim();
  return /^[\w.-]{16,300}$/.test(t) ? t : null;
});
handle("remote:trusted", () => remote.trusted());
handle("remote:setTrusted", async (_e, on) => {
  if (on && !testRun) {
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      buttons: ["Trust my devices", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      title: "Allow your devices without asking?",
      message: "Your phone and other computers signed in to your account will connect without you clicking Allow here.",
      detail: "Only devices signed in to your account with two-step sign-in can connect. You still see the orange frame and a notification, everything is logged, and Ctrl+Alt+Shift+M disconnects everyone. Keep your account password and authenticator safe.",
    });
    if (response !== 0) return remote.trusted();
  }
  return remote.setTrusted(!!on);
});
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
// In admin mode a scheduled task starts MoonlightC; the normal startup entry would start a second copy without admin rights.
handle("settings:openAtLogin", async (_e, on) => (on && (await isAdmin()) ? undefined : app.setLoginItemSettings({ openAtLogin: !!on, args: ["--hidden"] })));
handle("open-external", (_e, url) => {
  if (!/^https:\/\//.test(url)) throw new Error("Only https links can be opened.");
  return shell.openExternal(url);
});
handle("open-path", (_e, p, editor) => projects.openPath(p, editor));
handle("files:saveProject", async (_e, name, files) => {
  const r = await dialog.showOpenDialog(win, { title: "Choose where to save the project", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled) return null;
  const folder = path.join(r.filePaths[0], String(name).replace(/[^\w\- ]+/g, "").trim() || "project");
  for (const [p, content] of Object.entries(files ?? {})) {
    const target = path.resolve(folder, String(p).replace(/^\/+/, ""));
    if (!target.startsWith(path.resolve(folder) + path.sep)) throw new Error(`Refused to write outside the project folder: ${p}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, String(content));
  }
  shell.openPath(folder);
  return folder;
});
handle("notify", (_e, title, body) => new Notification({ title, body }).show());

// ---------- Lifecycle ----------
// macOS delivers moonlightc:// links here; Windows/Linux pass them as a command-line argument (below).
let pendingLink = process.argv.find((a) => a.startsWith("moonlightc://"));
app.on("open-url", (e, url) => {
  e.preventDefault();
  if (win) win.webContents.send("deep-link", url);
  else pendingLink = url;
});
app.on("second-instance", (_e, argv) => {
  // "MoonlightC.exe --quit": close cleanly (used by updates) so nothing in memory is lost.
  if (argv.includes("--quit")) return app.quit();
  if (argv.includes("--hidden")) return;
  win?.show();
  win?.focus();
  const link = argv.find((a) => a.startsWith("moonlightc://"));
  if (link) win?.webContents.send("deep-link", link);
});

// Your work on this PC comes first: MoonlightC runs below normal priority, except while it streams the screen.
const yieldCpu = () => {
  const streaming = remote.state().some((s) => s.tiers.includes("view"));
  const p = streaming ? os.constants.priority.PRIORITY_NORMAL : os.constants.priority.PRIORITY_BELOW_NORMAL;
  for (const pid of [...app.getAppMetrics().map((m) => m.pid), server?.pid].filter(Boolean))
    try {
      os.setPriority(pid, p);
    } catch {}
};

app.whenReady().then(async () => {
  powerMonitor.on("lock-screen", () => remote.setLocked(true));
  powerMonitor.on("unlock-screen", () => remote.setLocked(false));
  yieldCpu();
  setInterval(yieldCpu, 30_000);
  remote.onState(yieldCpu);
  try {
    appURL ??= await startServer();
  } catch (err) {
    dialog.showErrorBox("MoonlightC couldn't start", String(err?.message ?? err));
    app.quit();
    return;
  }
  createWindow();
  if (!testRun) createTray();
  if (pendingLink) win.webContents.once("did-finish-load", () => setTimeout(() => win.webContents.send("deep-link", pendingLink), 1500));
  if (!globalShortcut.register("Alt+Space", toggleQuickAsk)) console.warn("Alt+Space is taken by another app.");
  // One panic key for everything that can control this PC: AI computer use and remote sessions.
  globalShortcut.register(computer.PANIC, () => {
    computer.stop("panic hotkey");
    remote.end(undefined, "panic hotkey");
  });
});

app.on("before-quit", () => {
  quitting = true;
  computer.stop("app closed");
  terminals.killAll();
  server?.kill();
  // Write chats and settings (page storage) to disk before the process ends.
  session.defaultSession.flushStorageData();
});
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {});
