import { strToU8, zipSync } from "fflate";

export type Template = "react" | "static";

export interface CodeChange {
  at: number;
  summary: string;
  /** Previous content per path; null means the file didn't exist. */
  before: Record<string, string | null>;
  /** New content per path; null means the file was deleted. */
  after: Record<string, string | null>;
}

export interface CodeChat {
  id: string;
  title: string;
  messages: import("ai").UIMessage[];
  updatedAt: number;
}

export interface CodeProject {
  id: string;
  name: string;
  template: Template;
  files: Record<string, string>;
  history: CodeChange[];
  repo?: string; // GitHub "owner/name" after the first push
  updatedAt: number;
  folder?: string;
  /** Conversations with the code assistant in this project (a project is a group of chats). */
  chats?: CodeChat[];
  connectorIds?: string[];
  pluginIds?: string[];
}

export const MAX_PROJECT_CHARS = 1_000_000;

export const TEMPLATES: Record<Template, { label: string; files: Record<string, string> }> = {
  react: {
    label: "React app",
    files: {
      "/App.js": `export default function App() {\n  return (\n    <main style={{ fontFamily: "system-ui", padding: 24 }}>\n      <h1>Hello from MoonlightC</h1>\n      <p>Describe what you want and the AI will build it.</p>\n    </main>\n  );\n}\n`,
      "/index.js": `import { createRoot } from "react-dom/client";\nimport App from "./App";\n\ncreateRoot(document.getElementById("root")).render(<App />);\n`,
      "/public/index.html": `<!doctype html>\n<html>\n  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>App</title></head>\n  <body><div id="root"></div></body>\n</html>\n`,
      "/package.json": `{\n  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },\n  "main": "/index.js"\n}\n`,
    },
  },
  static: {
    label: "Web page (HTML, CSS, JS)",
    files: {
      "/index.html": `<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <link rel="stylesheet" href="styles.css" />\n    <title>My page</title>\n  </head>\n  <body>\n    <h1>Hello from MoonlightC</h1>\n    <script src="script.js"></script>\n  </body>\n</html>\n`,
      "/styles.css": `body { font-family: system-ui, sans-serif; padding: 24px; }\n`,
      "/script.js": `console.log("ready");\n`,
    },
  },
};

/** "/src/App.js" style paths only: no "..", no backslashes, no drive letters. */
export function normalizePath(p: string): string {
  const clean = ("/" + String(p).trim().replace(/^\/+/, "")).replace(/\/+/g, "/");
  if (!/^\/[A-Za-z0-9._\-/ ]+$/.test(clean) || clean.split("/").some((seg) => seg === ".." || seg === ".")) throw new Error(`Not an allowed file path: ${p}`);
  if (clean.length > 200) throw new Error("File path too long.");
  return clean;
}

export function applyChange(project: CodeProject, summary: string, writes: { path: string; content: string }[], deletes: string[] = []): CodeProject {
  const files = { ...project.files };
  const before: CodeChange["before"] = {};
  const after: CodeChange["after"] = {};
  for (const w of writes) {
    const p = normalizePath(w.path);
    before[p] = project.files[p] ?? null;
    after[p] = String(w.content);
    files[p] = String(w.content);
  }
  for (const d of deletes) {
    const p = normalizePath(d);
    if (!(p in files)) continue;
    before[p] = files[p];
    after[p] = null;
    delete files[p];
  }
  const size = Object.values(files).reduce((n, f) => n + f.length, 0);
  if (size > MAX_PROJECT_CHARS) throw new Error("This project would be larger than 1 MB of text. Remove something first.");
  const change: CodeChange = { at: Date.now(), summary: summary.slice(0, 300), before, after };
  return { ...project, files, history: [change, ...project.history].slice(0, 30), updatedAt: Date.now() };
}

/** Put a change back the way it was. */
export function revertChange(project: CodeProject, change: CodeChange): CodeProject {
  const writes = Object.entries(change.before).filter(([, v]) => v !== null).map(([path, content]) => ({ path, content: content! }));
  const deletes = Object.entries(change.before).filter(([, v]) => v === null).map(([p]) => p);
  return applyChange(project, `Undo: ${change.summary}`, writes, deletes);
}

const CONTEXT_LIMIT = 120_000;

export function codeInstructions(project: CodeProject) {
  let budget = CONTEXT_LIMIT;
  const files = Object.entries(project.files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => {
      const text = content.slice(0, Math.max(0, budget));
      budget -= text.length;
      return `<file path="${path}">\n${text}${text.length < content.length ? "\n[cut: file too long]" : ""}\n</file>`;
    });
  const stack =
    project.template === "react"
      ? "a React app that runs in the browser preview. The entry is /index.js and the root component /App.js. The preview has React and react-dom only (no other npm packages): use plain CSS files (import \"./styles.css\") and your own components."
      : "a static web page: /index.html with plain CSS and JavaScript files.";
  return [
    `You are building ${stack}`,
    "Make changes only with the write_files tool (full file contents) or delete_files. Keep the app working after every change. Prefer few, well-organized files. After writing, briefly say what you changed and how to use it.",
    `Current project "${project.name}":\n${files.join("\n\n")}`,
  ].join("\n\n");
}

export function zipProject(project: CodeProject): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [p, c] of Object.entries(project.files)) entries[p.replace(/^\//, "")] = strToU8(c);
  if (project.template === "react" && !entries["README.md"]) {
    entries["README.md"] = strToU8(`# ${project.name}\n\nMade with MoonlightC. Run it with any React setup (for example Vite): copy these files into a new project.\n`);
  }
  return zipSync(entries);
}

function toBase64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Create (first time) or update a GitHub repo with the project's files. Returns "owner/name". */
export async function pushToGitHub(project: CodeProject, token: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const gh = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetchFn(`https://api.github.com${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" } });
    if (res.status === 401) throw new Error("GitHub rejected the token. Update it in Connections.");
    if (res.status === 403) throw new Error("Your GitHub token can't create repositories or write files. Give it Administration and Contents write access.");
    if (!res.ok && res.status !== 404) throw new Error(`GitHub returned ${res.status}.`);
    return (res.status === 404 ? null : await res.json()) as T;
  };
  let repo = project.repo;
  if (!repo) {
    const name = project.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "moonlightc-app";
    const created = await gh<{ full_name: string }>("/user/repos", { method: "POST", body: JSON.stringify({ name, description: "Made with MoonlightC", private: true, auto_init: false }) });
    if (!created) throw new Error("Couldn't create the repository.");
    repo = created.full_name;
  }
  for (const [path, content] of Object.entries(project.files)) {
    const rel = path.replace(/^\//, "");
    const existing = await gh<{ sha: string } | null>(`/repos/${repo}/contents/${encodeURI(rel)}`);
    await gh(`/repos/${repo}/contents/${encodeURI(rel)}`, {
      method: "PUT",
      body: JSON.stringify({ message: `Update ${rel} from MoonlightC`, content: toBase64(content), sha: existing?.sha }),
    });
  }
  return repo;
}
