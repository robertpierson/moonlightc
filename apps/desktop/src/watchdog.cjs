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
let seen = Atomics.load(ticks, 0);
let since = Date.now();
const timer = setInterval(() => {
  const now = Atomics.load(ticks, 0);
  if (now !== seen) {
    seen = now;
    since = Date.now();
    return;
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
}, 5000);
