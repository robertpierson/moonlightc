import { execFile } from "node:child_process";
import { app, shell } from "electron";
import fs from "node:fs/promises";
import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

// "My AI Projects": read-only scan of folders the user approved. Nothing is changed unless the user clicks a button.

const home = os.homedir();
const cursorStorage =
  process.platform === "win32"
    ? path.join(process.env.APPDATA ?? "", "Cursor", "User", "workspaceStorage")
    : process.platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Cursor", "User", "workspaceStorage")
      : path.join(home, ".config", "Cursor", "User", "workspaceStorage");

export const KNOWN = {
  claude: path.join(home, ".claude", "projects"),
  codex: path.join(home, ".codex", "sessions"),
  gemini: path.join(home, ".gemini", "tmp"),
  cursor: cursorStorage,
  ollama: path.join(home, ".ollama", "models", "manifests"),
};

const store = () => path.join(app.getPath("userData"), "projects.json");
export function folders() {
  try {
    return JSON.parse(readFileSync(store(), "utf8"));
  } catch {
    return [];
  }
}
const save = (list) => (writeFileSync(store(), JSON.stringify(list)), list);
export const addFolder = (p) => save([...new Set([...folders(), path.resolve(p)])]);
export const removeFolder = (p) => save(folders().filter((f) => f !== p));

async function firstJsonLines(file, n = 20) {
  const out = [];
  const rl = readline.createInterface({ input: createReadStream(file, { end: 256 * 1024 }) });
  for await (const line of rl) {
    try {
      out.push(JSON.parse(line));
    } catch {}
    if (out.length >= n) break;
  }
  rl.close();
  return out;
}

const mtime = (p) => fs.stat(p).then((s) => s.mtimeMs).catch(() => 0);
const quote = (p) => (process.platform === "win32" ? `'${p.replace(/'/g, "''")}'` : `'${p.replace(/'/g, "'\\''")}'`);

async function scanClaude(root) {
  const out = [];
  for (const dir of await fs.readdir(root).catch(() => [])) {
    const full = path.join(root, dir);
    const files = (await fs.readdir(full).catch(() => [])).filter((f) => f.endsWith(".jsonl"));
    if (!files.length) continue;
    const stamped = await Promise.all(files.map(async (f) => ({ f, t: await mtime(path.join(full, f)) })));
    stamped.sort((a, b) => b.t - a.t);
    const lines = await firstJsonLines(path.join(full, stamped[0].f));
    const cwd = lines.find((l) => typeof l.cwd === "string")?.cwd;
    if (!cwd) continue;
    out.push({ kind: "claude", name: path.basename(cwd), path: cwd, lastActivity: stamped[0].t, detail: `${files.length} Claude Code session${files.length > 1 ? "s" : ""}`, resume: `cd ${quote(cwd)}; claude --continue` });
  }
  return out;
}

async function walk(dir, depth, onFile) {
  if (depth < 0) return;
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, depth - 1, onFile);
    else await onFile(p);
  }
}

async function scanCodex(root) {
  const byCwd = new Map();
  await walk(root, 4, async (file) => {
    if (!file.endsWith(".jsonl")) return;
    const t = await mtime(file);
    const lines = await firstJsonLines(file, 3);
    const cwd = lines.map((l) => l.payload?.cwd ?? l.cwd).find((c) => typeof c === "string");
    if (!cwd) return;
    const cur = byCwd.get(cwd) ?? { n: 0, t: 0 };
    byCwd.set(cwd, { n: cur.n + 1, t: Math.max(cur.t, t) });
  });
  return [...byCwd].map(([cwd, { n, t }]) => ({ kind: "codex", name: path.basename(cwd), path: cwd, lastActivity: t, detail: `${n} Codex session${n > 1 ? "s" : ""}`, resume: `cd ${quote(cwd)}; codex resume --last` }));
}

async function scanGemini(root) {
  const dirs = await fs.readdir(root).catch(() => []);
  const items = await Promise.all(dirs.map(async (d) => ({ d, t: await mtime(path.join(root, d)) })));
  return items.map(({ d, t }) => ({ kind: "gemini", name: `Gemini CLI project ${d.slice(0, 8)}`, path: path.join(root, d), lastActivity: t, detail: "Gemini CLI history", resume: "gemini" }));
}

async function scanCursor(root) {
  const out = [];
  for (const d of await fs.readdir(root).catch(() => [])) {
    const f = path.join(root, d, "workspace.json");
    try {
      const ws = JSON.parse(await fs.readFile(f, "utf8"));
      const uri = ws.folder ?? ws.workspace;
      if (!uri?.startsWith("file://")) continue;
      const p = decodeURIComponent(new URL(uri).pathname).replace(/^\/([a-zA-Z]:)/, "$1");
      out.push({ kind: "cursor", name: path.basename(p), path: p, lastActivity: await mtime(path.join(root, d)), detail: "Cursor workspace" });
    } catch {}
  }
  return out;
}

async function scanOllama(root) {
  const out = [];
  await walk(root, 4, async (file) => {
    const rel = path.relative(root, file).split(path.sep);
    if (rel.length < 3) return;
    const [, ...rest] = rel; // registry host
    const tag = rest.pop();
    const name = rest.filter((x) => x !== "library").join("/");
    out.push({ kind: "ollama", name: `${name}:${tag}`, path: file, lastActivity: await mtime(file), detail: "Ollama model", resume: `ollama run ${name}:${tag}` });
  });
  return out;
}

async function scanGit(root) {
  const out = [];
  const visit = async (dir, depth) => {
    if (existsSync(path.join(dir, ".git"))) {
      const t = Math.max(await mtime(path.join(dir, ".git", "index")), await mtime(path.join(dir, ".git", "HEAD")));
      out.push({ kind: "git", name: path.basename(dir), path: dir, lastActivity: t, detail: "Git repository" });
      return;
    }
    if (depth <= 0) return;
    for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") await visit(path.join(dir, e.name), depth - 1);
    }
  };
  await visit(root, 3);
  return out;
}

export async function scan() {
  const results = await Promise.all(
    folders().map((f) => {
      if (f === KNOWN.claude) return scanClaude(f);
      if (f === KNOWN.codex) return scanCodex(f);
      if (f === KNOWN.gemini) return scanGemini(f);
      if (f === KNOWN.cursor) return scanCursor(f);
      if (f === KNOWN.ollama) return scanOllama(f);
      return scanGit(f);
    }),
  );
  return results.flat().sort((a, b) => b.lastActivity - a.lastActivity);
}

export const addKnown = () => save([...new Set([...folders(), ...Object.values(KNOWN).filter((p) => existsSync(p))])]);

/** Opens a folder (never a file, so nothing can be executed this way) in the file manager or an editor. */
export async function openPath(p, editor) {
  let dir = path.resolve(String(p));
  const st = await fs.stat(dir).catch(() => null);
  if (!st) throw new Error("That folder no longer exists.");
  if (!st.isDirectory()) dir = path.dirname(dir);
  if (!editor) {
    const err = await shell.openPath(dir);
    if (err) throw new Error(err);
    return;
  }
  if (/[&|<>^"%!`$;\r\n]/.test(dir)) throw new Error("This folder name has characters the editor launcher can't handle. Open it from the file manager instead.");
  const bin = editor === "cursor" ? "cursor" : "code";
  return new Promise((resolve, reject) =>
    execFile(bin, [dir], { shell: process.platform === "win32", windowsHide: true }, (err) => (err ? reject(new Error(`Couldn't open ${editor === "cursor" ? "Cursor" : "VS Code"}. Is it installed?`)) : resolve())),
  );
}
