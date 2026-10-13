import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import pty from "node-pty";

const run = promisify(execFile);
const sessions = new Map();
let seq = 0;

const shell = () => (process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash");

const TOOLS = [
  { id: "claude", name: "Claude Code", bin: "claude", installCommand: "npm install -g @anthropic-ai/claude-code" },
  { id: "codex", name: "Codex CLI", bin: "codex", installCommand: "npm install -g @openai/codex" },
  { id: "gemini", name: "Gemini CLI", bin: "gemini", installCommand: "npm install -g @google/gemini-cli" },
  { id: "aider", name: "Aider", bin: "aider", installCommand: "python -m pip install aider-install && aider-install" },
];

async function onPath(bin) {
  try {
    await run(process.platform === "win32" ? "where.exe" : "which", [bin], { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** Which coding CLIs are installed. MoonlightC only hosts the terminal; each CLI uses its own login. */
export async function tools() {
  return Promise.all(TOOLS.map(async ({ bin, ...t }) => ({ ...t, installed: await onPath(bin) })));
}

export function create(sender, { command, cwd, cols, rows }) {
  const id = `t${++seq}`;
  const p = pty.spawn(shell(), [], {
    name: "xterm-256color",
    cols: Math.max(20, cols | 0),
    rows: Math.max(5, rows | 0),
    cwd: cwd || os.homedir(),
    env: { ...process.env, TERM: "xterm-256color" },
    useConpty: true,
  });
  p.onData((d) => !sender.isDestroyed() && sender.send("terminals:data", id, d));
  p.onExit(({ exitCode }) => {
    sessions.delete(id);
    if (!sender.isDestroyed()) sender.send("terminals:exit", id, exitCode);
  });
  sessions.set(id, p);
  if (command) p.write(command + "\r");
  return { id, title: command ? command.split(" ")[0] : "Terminal" };
}

export const write = (id, data) => sessions.get(id)?.write(String(data));
export const resize = (id, cols, rows) => sessions.get(id)?.resize(Math.max(20, cols | 0), Math.max(5, rows | 0));
export function kill(id) {
  sessions.get(id)?.kill();
  sessions.delete(id);
}
export function killAll() {
  for (const id of [...sessions.keys()]) kill(id);
}
