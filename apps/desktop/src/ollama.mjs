import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const API = "http://127.0.0.1:11434";
let child;

function binary() {
  const candidates =
    process.platform === "win32"
      ? [path.join(process.env.LOCALAPPDATA ?? "", "Programs", "Ollama", "ollama.exe"), "ollama.exe"]
      : process.platform === "darwin"
        ? ["/Applications/Ollama.app/Contents/Resources/ollama", "/usr/local/bin/ollama", "/opt/homebrew/bin/ollama"]
        : ["/usr/local/bin/ollama", "/usr/bin/ollama"];
  return candidates.find((c) => !path.isAbsolute(c) || fs.existsSync(c));
}

async function version(bin) {
  try {
    const { stdout } = await run(bin, ["--version"], { windowsHide: true, timeout: 5000 });
    return stdout.match(/\d+\.\d+\.\d+/)?.[0];
  } catch {
    return undefined;
  }
}

export async function status() {
  const running = await fetch(API + "/api/version", { signal: AbortSignal.timeout(1500) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (running) return { installed: true, running: true, version: running.version };
  const bin = binary();
  const v = bin ? await version(bin) : undefined;
  return { installed: !!v, running: false, version: v };
}

export async function start() {
  if ((await status()).running) return;
  const bin = binary();
  if (!bin) throw new Error("Ollama isn't installed yet.");
  child = spawn(bin, ["serve"], { detached: false, windowsHide: true, stdio: "ignore", env: { ...process.env, OLLAMA_HOST: "127.0.0.1:11434" } });
  for (let i = 0; i < 60; i++) {
    if ((await status()).running) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Ollama didn't start. Try again, or restart your computer.");
}

export async function stop() {
  if (child) {
    child.kill();
    child = undefined;
    return;
  }
  // Ollama started outside MoonlightC (for example its own tray app): leave it alone.
}

/** Download and run the official installer from ollama.com. */
export async function install(onProgress) {
  if (process.platform === "linux") {
    throw new Error("On Linux, install Ollama by running this in a terminal: curl -fsSL https://ollama.com/install.sh | sh");
  }
  const url = process.platform === "win32" ? "https://ollama.com/download/OllamaSetup.exe" : "https://ollama.com/download/Ollama.dmg";
  const file = path.join(os.tmpdir(), path.basename(url));
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Couldn't download Ollama (${res.status}). Check your internet connection.`);
  const total = Number(res.headers.get("content-length")) || 0;
  let got = 0;
  const out = fs.createWriteStream(file);
  for await (const chunk of res.body) {
    out.write(chunk);
    got += chunk.length;
    if (total) onProgress(Math.round((got / total) * 90), "Downloading Ollama");
  }
  await new Promise((r) => out.end(r));
  onProgress(92, "Installing");
  if (process.platform === "win32") {
    // Silent per-user install (no admin needed).
    await run(file, ["/VERYSILENT", "/NORESTART", "/SUPPRESSMSGBOXES"], { windowsHide: true, timeout: 10 * 60_000 });
  } else {
    const { stdout } = await run("hdiutil", ["attach", "-nobrowse", file]);
    const vol = stdout.match(/\/Volumes\/[^\n]+/)?.[0]?.trim();
    await run("cp", ["-R", path.join(vol, "Ollama.app"), "/Applications/"]);
    await run("hdiutil", ["detach", vol]);
  }
  fs.rm(file, () => {});
  onProgress(97, "Starting Ollama");
  await start();
  onProgress(100, "Ready");
}
