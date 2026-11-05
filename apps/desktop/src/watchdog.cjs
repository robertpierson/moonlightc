// Runs on its own thread inside MoonlightC (see health.mjs). The main thread ticks a shared counter every 2 seconds;
// if it stops ticking for `after` ms, MoonlightC is frozen: start a fresh copy in the tray (after a short wait) and
// end this one with a hard kill (a frozen app ignores a polite one).
const { workerData } = require("node:worker_threads");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

const note = (t) => {
  try {
    fs.appendFileSync(workerData.log, `${new Date().toISOString()} ${t}\n`);
  } catch {}
};
const ticks = new Int32Array(workerData.shared);

// A remote press that lands on MoonlightC's own X or title bar: Windows keeps the main thread inside that click until
// the button is let go, but the remote release has to come through the main thread. Only this thread can let go.
let letGo;
try {
  const koffi = require("koffi");
  const MOUSEINPUT = koffi.struct("WATCHDOG_MOUSEINPUT", { dx: "long", dy: "long", mouseData: "uint32", dwFlags: "uint32", time: "uint32", dwExtraInfo: "uintptr_t" });
  const INPUT = koffi.struct("WATCHDOG_INPUT", { type: "uint32", mi: MOUSEINPUT });
  const SendInput = koffi.load("user32.dll").func("unsigned int __stdcall SendInput(unsigned int cInputs, WATCHDOG_INPUT *pInputs, int cbSize)");
  const up = (dwFlags) => SendInput(1, [{ type: 0, mi: { dx: 0, dy: 0, mouseData: 0, dwFlags, time: 0, dwExtraInfo: 0 } }], koffi.sizeof(INPUT));
  letGo = () => (up(0x0004), up(0x0010)); // left up, right up
} catch (e) {
  note(`can't let go of a stuck press: ${e.message}`);
}

let seen = Atomics.load(ticks, 0);
let since = Date.now();
let checked = Date.now();
const timer = setInterval(() => {
  const now = Atomics.load(ticks, 0);
  // This thread was paused too (the PC slept or hibernated): that's not a freeze, start counting again.
  const gap = Date.now() - checked;
  checked = Date.now();
  if (gap > 15_000) {
    seen = now;
    since = Date.now();
    return;
  }
  if (now !== seen) {
    seen = now;
    since = Date.now();
    return;
  }
  if (letGo && Atomics.load(ticks, 1) && Date.now() - since >= 3000) {
    Atomics.store(ticks, 1, 0);
    note("a remote press was stuck on MoonlightC's own window: letting go");
    letGo();
  }
  if (Date.now() - since < workerData.after) return;
  clearInterval(timer);
  note(`frozen for ${Math.round((Date.now() - since) / 1000)} s: restarting MoonlightC`);
  // Windows' own process service (WMI) starts the new copy, so it isn't ended along with this one. Encoded commands
  // avoid any quoting trouble with the app's path; nothing shows on screen.
  const enc = (cmd) => Buffer.from(cmd, "utf16le").toString("base64");
  const exe = workerData.exe.replace(/'/g, "''");
  const later = `powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand ${enc(`Start-Sleep 5; Start-Process -FilePath '${exe}' -ArgumentList '--hidden'`)}`;
  const launch = `$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }; Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${later}'; ProcessStartupInformation = $si } | Out-Null`;
  const ps = spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-EncodedCommand", enc(launch)], { stdio: "ignore", windowsHide: true });
  ps.on("error", (e) => note(`restart failed: ${e.message}`));
  ps.on("exit", () => setTimeout(() => process.kill(workerData.pid, "SIGKILL"), 500));
  // If the helper itself hangs, end anyway.
  setTimeout(() => process.kill(workerData.pid, "SIGKILL"), 15_000);
}, 1000);
