import fs from "node:fs/promises";
import path from "node:path";
import { jsonSchema, tool, type ToolSet } from "ai";

// Desktop app only: the AI can use files inside folders the user picked with the system folder picker (the desktop
// app writes that list; this server only reads it). Reading is free; writing always asks first. Everything is logged.

const MAX_READ = 200_000;
const SKIP = new Set(["node_modules", ".git", "$RECYCLE.BIN", "System Volume Information"]);

export async function readGrants(file = process.env.MOONC_FILE_GRANTS): Promise<string[]> {
  if (!file) return [];
  try {
    const list = JSON.parse(await fs.readFile(file, "utf8"));
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const inside = (root: string, p: string) => {
  const rel = path.relative(root, p);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

/** Resolves a path (following links) and refuses anything outside the granted folders. */
export async function resolveGranted(p: string, grants: string[]): Promise<string> {
  if (!grants.length) throw new Error("No folders are shared with the AI. Add one in Settings > Files.");
  const abs = path.resolve(path.isAbsolute(p) ? p : path.join(grants[0], p));
  // Follow links on the longest part that exists, so a link can't point outside a shared folder.
  let existing = abs;
  let rest = "";
  for (;;) {
    try {
      existing = await fs.realpath(existing);
      break;
    } catch {
      const parent = path.dirname(existing);
      if (parent === existing) throw new Error("That path doesn't exist.");
      rest = path.join(path.basename(existing), rest);
      existing = parent;
    }
  }
  const real = path.join(existing, rest);
  if (!grants.some((g) => inside(g, real))) throw new Error(`${p} is outside the folders shared with the AI.`);
  return real;
}

async function audit(action: string, target: string) {
  const file = process.env.MOONC_FILE_AUDIT;
  if (file) await fs.appendFile(file, JSON.stringify({ at: new Date().toISOString(), action, path: target }) + "\n").catch(() => {});
}

export function fileTools(grants: string[]): { tools: ToolSet; approval: Record<string, "user-approval"> } {
  return {
    tools: {
      files_list: tool({
        description: "List the folders shared with you, or the contents of one folder inside them.",
        inputSchema: jsonSchema<{ path?: string }>({ type: "object", properties: { path: { type: "string", description: "Folder path; leave out to list the shared folders." } } }),
        execute: async ({ path: p }) => {
          if (!p) return { sharedFolders: grants };
          const dir = await resolveGranted(p, grants);
          await audit("list", dir);
          const entries = await fs.readdir(dir, { withFileTypes: true });
          return {
            folder: dir,
            entries: await Promise.all(
              entries.slice(0, 500).map(async (e) => ({ name: e.name, type: e.isDirectory() ? "folder" : "file", size: e.isFile() ? (await fs.stat(path.join(dir, e.name)).catch(() => null))?.size : undefined })),
            ),
            more: entries.length > 500 ? entries.length - 500 : undefined,
          };
        },
      }),
      files_search: tool({
        description: "Find files by name in the shared folders.",
        inputSchema: jsonSchema<{ query: string }>({ type: "object", properties: { query: { type: "string" } }, required: ["query"] }),
        execute: async ({ query }) => {
          const q = query.toLowerCase();
          const found: string[] = [];
          const queue = [...grants];
          let seen = 0;
          while (queue.length && found.length < 100 && seen < 20_000) {
            const dir = queue.shift()!;
            const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
            for (const e of entries) {
              seen++;
              const full = path.join(dir, e.name);
              if (e.name.toLowerCase().includes(q)) found.push(full);
              if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith(".")) queue.push(full);
            }
          }
          await audit("search", query);
          return { matches: found, complete: !queue.length };
        },
      }),
      files_read: tool({
        description: "Read a text file in the shared folders.",
        inputSchema: jsonSchema<{ path: string }>({ type: "object", properties: { path: { type: "string" } }, required: ["path"] }),
        execute: async ({ path: p }) => {
          const file = await resolveGranted(p, grants);
          const buf = await fs.readFile(file);
          if (buf.subarray(0, 8000).includes(0)) return { error: "That's not a text file, so it can't be read here." };
          await audit("read", file);
          return { path: file, text: buf.subarray(0, MAX_READ).toString("utf8"), truncated: buf.length > MAX_READ || undefined };
        },
      }),
      files_write: tool({
        description: "Create or replace a text file in the shared folders. The user is asked first.",
        inputSchema: jsonSchema<{ path: string; content: string }>({ type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }),
        execute: async ({ path: p, content }) => {
          const file = await resolveGranted(p, grants);
          await fs.mkdir(path.dirname(file), { recursive: true });
          await fs.writeFile(file, content);
          await audit("write", file);
          return { written: file, bytes: Buffer.byteLength(content) };
        },
      }),
    },
    approval: { files_write: "user-approval" },
  };
}
