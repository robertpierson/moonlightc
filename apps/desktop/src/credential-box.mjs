// Remote typing into Windows' own PIN and password box (CredentialUIBroker.exe), including the one a website's passkey
// opens. Since January 2026 that box ignores normal apps, so while it's in front, a remote device's input goes through a
// small helper (MoonlightCInput.cs) that runs with administrator rights and can touch only that box. Off until the person
// at the PC turns it on and says Yes. What's typed is never stored or logged, and the AI's computer use can't reach this.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TASK = "MoonlightC PIN helper";
const PIPE = "\\\\.\\pipe\\moonlightc-credential-input";
const FOLDER = path.join(process.env.ProgramW6432 ?? process.env.ProgramFiles ?? "C:\\Program Files", "MoonlightC PIN Helper");
const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;

// The helper's folder is one only administrators can write to, so this can't be faked by a normal program.
export const installed = () => process.platform === "win32" && fs.existsSync(path.join(FOLDER, "MoonlightCInput.exe"));

/** One Windows "Yes", then: built from source into a folder only administrators can change, started only on request. */
export function installScript() {
  // Packaged, the source is unpacked next to app.asar (see asarUnpack): PowerShell can't read inside the archive.
  const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "MoonlightCInput.cs").replace("app.asar" + path.sep, "app.asar.unpacked" + path.sep);
  const sha = createHash("sha256").update(fs.readFileSync(source)).digest("hex");
  return `$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:ProgramFiles 'MoonlightC PIN Helper'
New-Item -ItemType Directory -Force $dir | Out-Null
$cs = Join-Path $dir 'MoonlightCInput.cs'
Copy-Item -LiteralPath ${quote(source)} -Destination $cs -Force
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $cs).Hash -ne '${sha}') { Remove-Item -LiteralPath $cs; throw 'The helper source changed.' }
& "$env:WINDIR\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe" /nologo /target:winexe "/out:$dir\\MoonlightCInput.exe" $cs | Out-Null
$built = $LASTEXITCODE
Remove-Item -LiteralPath $cs
if ($built -ne 0) { throw 'The helper did not build.' }
$a = New-ScheduledTaskAction -Execute "$dir\\MoonlightCInput.exe"
$p = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive
$s = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName ${quote(TASK)} -Action $a -Principal $p -Settings $s -Force | Out-Null`;
}

export const removeScript = () => `Unregister-ScheduledTask -TaskName ${quote(TASK)} -Confirm:$false -ErrorAction SilentlyContinue
Stop-Process -Name MoonlightCInput -Force -ErrorAction SilentlyContinue
Start-Sleep 1
Remove-Item -LiteralPath (Join-Path $env:ProgramFiles 'MoonlightC PIN Helper') -Recurse -Force -ErrorAction SilentlyContinue`;

let frontCheck;
function makeFrontCheck() {
  const koffi = createRequire(import.meta.url)("koffi");
  const user32 = koffi.load("user32.dll");
  const kernel32 = koffi.load("kernel32.dll");
  const GetForegroundWindow = user32.func("void * __stdcall GetForegroundWindow()");
  const GetWindowThreadProcessId = user32.func("uint32 __stdcall GetWindowThreadProcessId(void *w, _Out_ uint32 *pid)");
  const OpenProcess = kernel32.func("void * __stdcall OpenProcess(uint32 access, int inherit, uint32 pid)");
  const CloseHandle = kernel32.func("int __stdcall CloseHandle(void *h)");
  const QueryName = kernel32.func("int __stdcall QueryFullProcessImageNameW(void *h, uint32 flags, void *name, _Inout_ uint32 *size)");
  const broker = path.join(process.env.WINDIR ?? "C:\\Windows", "System32", "CredentialUIBroker.exe").toLowerCase();
  return () => {
    const w = GetForegroundWindow();
    if (!w) return false;
    const pid = [0];
    GetWindowThreadProcessId(w, pid);
    const p = OpenProcess(0x1000, 0, pid[0]); // limited query, allowed on a process above this one
    if (!p) return false;
    const name = Buffer.alloc(2048);
    const size = [1024];
    const ok = QueryName(p, 0, name, size);
    CloseHandle(p);
    return !!ok && name.toString("utf16le", 0, size[0] * 2).toLowerCase() === broker;
  };
}
let front = { at: 0, on: false };
/** Is Windows' credential box the window in front? Checked at most 5 times a second, and only once the helper is on. */
export function boxInFront() {
  if (Date.now() - front.at < 200) return front.on;
  let on = false;
  try {
    if (installed()) on = (frontCheck ??= makeFrontCheck())();
  } catch {
    on = false;
  }
  front = { at: Date.now(), on };
  return on;
}

const NAMED = { backspace: 8, tab: 9, enter: 13, return: 13, shift: 16, escape: 27, esc: 27, space: 32, end: 35, home: 36, left: 37, up: 38, right: 39, down: 40, delete: 46, del: 46 };
/** The Windows key number for a key name, or undefined for keys that box doesn't get (Ctrl, Alt, Windows, F keys). */
export function keyNumber(name) {
  const k = String(name ?? "").toLowerCase();
  return /^[a-z0-9]$/.test(k) ? k.toUpperCase().charCodeAt(0) : NAMED[k];
}
/** "enter" or "shift+a" as helper lines; null for anything else. */
export function tapLines(keys) {
  const parts = String(keys ?? "").split("+").map(keyNumber);
  if (parts.length > 2 || parts.includes(undefined) || (parts.length === 2 && parts[0] !== 16)) return null;
  const main = parts.at(-1);
  const tap = [`k ${main} d`, `k ${main} u`];
  return parts.length === 2 ? ["k 16 d", ...tap, "k 16 u"] : tap;
}
/** Text as helper lines, one per character, capped well above any PIN or password. */
export const textLines = (text) => Array.from(String(text ?? "").slice(0, 256), (_, i) => `c ${String(text).charCodeAt(i)}`);

let socket;
let replies = "";
let waiting = [];
let idle;
let queue = Promise.resolve();

const drop = () => {
  socket?.destroy();
  socket = undefined;
  replies = "";
  clearTimeout(idle);
  waiting.splice(0).forEach((done) => done(false));
};
const connectOnce = () =>
  new Promise((done) => {
    const s = net.connect(PIPE);
    s.once("connect", () => (s.removeAllListeners("error"), done(s)));
    s.once("error", () => done(undefined));
  });
async function open() {
  if (socket) return true;
  for (let i = 0; i < 40; i++) {
    // The helper exits when MoonlightC hangs up, so it's started again here; asked again in case it was still closing.
    if (i % 15 === 0) execFile("schtasks.exe", ["/run", "/tn", TASK], { windowsHide: true }, () => {});
    const s = await connectOnce();
    if (s) {
      socket = s;
      s.on("data", (d) => {
        replies += d.toString();
        let at;
        while ((at = replies.indexOf("\n")) >= 0) {
          const ok = replies.slice(0, at).trim() === "1";
          replies = replies.slice(at + 1);
          waiting.shift()?.(ok);
        }
      });
      s.on("error", drop);
      s.on("close", drop);
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
// One at a time and in order, so a PIN's digits can't arrive shuffled.
const send = (line) => {
  const run = queue.then(async () => {
    if (!(await open())) return false;
    clearTimeout(idle);
    idle = setTimeout(closeBox, 60_000);
    idle.unref?.();
    return new Promise((done) => {
      const timer = setTimeout(() => (waiting = waiting.filter((w) => w !== finish), done(false)), 2000);
      const finish = (ok) => (clearTimeout(timer), done(ok));
      waiting.push(finish);
      socket.write(line + "\n");
    });
  });
  queue = run.catch(() => {});
  return run;
};

const downKeys = new Set();
let downButton;
/** Hang up: the helper lets go of anything still held and exits. */
export function closeBox() {
  downKeys.clear();
  downButton = undefined;
  drop();
}

/**
 * Send one remote action to the box. Returns true if it was handled here; false means use the normal way.
 * position() gives the pointer spot in the mouse's pixels.
 */
export async function sendToBox(a, position) {
  // A release follows its press, even if the box has just closed.
  if (a.action === "key_up") {
    const k = keyNumber(a.key);
    if (k === undefined || !downKeys.delete(k)) return false;
    await send(`k ${k} u`);
    return true;
  }
  if (a.action === "mouse_up") {
    if (!downButton) return false;
    const b = downButton;
    downButton = undefined;
    await send(`m ${b} u 0 0`);
    return true;
  }
  if (!["type", "key", "key_down", "mouse_down", "click", "double_click", "right_click"].includes(a.action) || !boxInFront()) return false;
  if (a.action === "type") {
    // Handled even if the box closes partway: the rest must not land in whatever window comes next.
    await Promise.all(textLines(a.text).map(send));
    return true;
  }
  if (a.action === "key") {
    const lines = tapLines(a.keys);
    return !!lines && (await Promise.all(lines.map(send)))[0];
  }
  if (a.action === "key_down") {
    const k = keyNumber(a.key);
    if (k === undefined) return false;
    const ok = await send(`k ${k} d`);
    if (ok) downKeys.add(k);
    return ok;
  }
  const { x, y } = position();
  if (a.action === "mouse_down") {
    const b = a.button === "right" ? "r" : "l";
    const ok = await send(`m ${b} d ${x} ${y}`);
    if (ok) downButton = b;
    return ok;
  }
  const b = a.action === "right_click" ? "r" : "l";
  for (let i = 0; i < (a.action === "double_click" ? 2 : 1); i++) {
    if (!(await send(`m ${b} d ${x} ${y}`))) return false; // outside the box: the normal way
    await send(`m ${b} u 0 0`);
  }
  return true;
}
