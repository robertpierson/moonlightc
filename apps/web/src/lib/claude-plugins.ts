// Claude Code plugins (https://code.claude.com/docs/en/plugins-reference) installed from GitHub.
// MoonlightC uses the parts that work in a chat app: skills, slash commands, agents (as modes) and remote MCP servers.
// Hooks, executables, LSP servers and monitors need Claude Code itself, so they're listed as not supported.

export interface PluginSource {
  repo: string; // owner/name
  ref: string; // branch, tag or commit; "HEAD" for the default branch
  path: string; // plugin folder inside the repo, "" for the root
}

export interface PluginSkill {
  name: string;
  description: string;
  body: string;
}
export interface PluginCommand {
  name: string;
  description?: string;
  argumentHint?: string;
  body: string;
}
export interface PluginMcp {
  name: string;
  kind: "http" | "stdio";
  url?: string;
  command?: string;
  args?: string[];
}

export interface ClaudePlugin {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  version?: string;
  source: PluginSource;
  enabled: boolean;
  installedAt: number;
  skills: PluginSkill[];
  commands: PluginCommand[];
  agents: PluginSkill[];
  mcp: PluginMcp[];
  unsupported: string[];
}

export interface MarketplaceEntry {
  name: string;
  description?: string;
  category?: string;
  source?: PluginSource;
  /** Component fields the marketplace entry declares itself (skills, commands, agents, mcpServers). */
  manifest?: Record<string, unknown>;
}

const MAX_TEXT = 60_000;

/** Reads `---` front matter (simple YAML: `key: value`, quoted values, and `>`/`|` blocks). */
export function parseFrontmatter(md: string): { data: Record<string, string>; body: string } {
  const m = md.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md.trim() };
  const data: Record<string, string> = {};
  let key = "";
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      const v = kv[2].trim();
      data[key] = /^[>|][-+]?$/.test(v) ? "" : v.replace(/^(["'])([\s\S]*)\1$/, "$2");
    } else if (key && /^\s+\S/.test(line)) {
      data[key] = `${data[key]} ${line.trim()}`.trim();
    }
  }
  return { data, body: m[2].trim() };
}

/** "owner/repo", a GitHub repo link, or a link to a folder (…/tree/<ref>/<path>). */
export function parseGitHubInput(input: string): PluginSource | undefined {
  const s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const short = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (short) return { repo: `${short[1]}/${short[2]}`, ref: "HEAD", path: "" };
  const m = s.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?$/);
  if (!m) return undefined;
  return { repo: `${m[1]}/${m[2]}`, ref: m[3] ?? "HEAD", path: (m[4] ?? "").replace(/\/?\.claude-plugin(\/.*)?$/, "") };
}

const join = (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/\/\.\//g, "/").replace(/\/$/, "");

/** Where a marketplace entry's plugin lives, if it's on GitHub. */
export function resolveEntrySource(source: unknown, market: PluginSource): PluginSource | undefined {
  if (typeof source === "string") {
    if (source.includes("..")) return undefined;
    return { repo: market.repo, ref: market.ref, path: join(market.path, source) };
  }
  if (!source || typeof source !== "object") return undefined;
  const s = source as { source?: string; repo?: string; url?: string; path?: string; ref?: string; sha?: string };
  const ref = s.sha ?? s.ref ?? "HEAD";
  if (s.source === "github" && s.repo) return { repo: s.repo, ref, path: s.path ?? "" };
  if ((s.source === "url" || s.source === "git-subdir") && s.url) {
    const gh = parseGitHubInput(s.url);
    return gh && { repo: gh.repo, ref, path: s.path ?? "" };
  }
  return undefined;
}

export function parseMarketplace(raw: unknown, market: PluginSource): MarketplaceEntry[] {
  const plugins = (raw as { plugins?: unknown[] })?.plugins;
  if (!Array.isArray(plugins)) throw new Error("This marketplace file has no plugins list.");
  return plugins
    .filter((p): p is { name: string; description?: string; category?: string; source?: unknown } => !!p && typeof (p as { name?: unknown }).name === "string")
    .map((p) => ({ name: p.name, description: p.description, category: p.category, source: resolveEntrySource(p.source, market), manifest: p as Record<string, unknown> }));
}

type Reader = (path: string) => Promise<string>;

/** Builds a plugin from its files. `files` lists every path in the plugin folder (relative to it). */
export async function buildPlugin(source: PluginSource, files: string[], read: Reader, fallbackName: string, entry: Record<string, unknown> = {}): Promise<Omit<ClaudePlugin, "id" | "enabled" | "installedAt">> {
  const has = (p: string) => files.includes(p);
  const readJson = async (p: string) => {
    try {
      return JSON.parse(await read(p)) as Record<string, unknown>;
    } catch {
      throw new Error(`${p} isn't valid JSON.`);
    }
  };
  const own = has(".claude-plugin/plugin.json") ? await readJson(".claude-plugin/plugin.json") : {};
  const list = (v: unknown) => (v === undefined ? [] : [v].flat());
  // A marketplace entry can declare components too; they add to the plugin's own manifest.
  const manifest: Record<string, unknown> = { ...entry, ...own, skills: [...list(entry.skills), ...list(own.skills)] };
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const name = str(manifest.name) ?? fallbackName;
  const text = async (p: string) => (await read(p)).slice(0, MAX_TEXT);

  // Skills: skills/<name>/SKILL.md, extra skill folders from the manifest, or a single SKILL.md at the root.
  // When a marketplace entry names skill folders, only those load; otherwise skills/ is scanned too.
  const listed = (manifest.skills as unknown[]).map((p) => (str(p) ?? "").replace(/^\.\/?/, "").replace(/\/$/, ""));
  const dirs = entry.skills ? listed : ["skills", ...listed];
  const isSkill = (f: string) =>
    dirs.some((d) => {
      const rest = d ? (f.startsWith(`${d}/`) ? f.slice(d.length + 1) : undefined) : f;
      return rest !== undefined && /^([^/]+\/)?SKILL\.md$/.test(rest);
    });
  const skillFiles = new Set(files.filter(isSkill));
  if (!skillFiles.size && has("SKILL.md")) skillFiles.add("SKILL.md");
  const skills: PluginSkill[] = [];
  for (const f of [...skillFiles].slice(0, 100)) {
    const { data, body } = parseFrontmatter(await text(f));
    const folder = f.split("/").slice(-2, -1)[0] ?? name;
    skills.push({ name: data.name || folder || name, description: data.description ?? "", body });
  }

  // Commands: commands/*.md by default, or what the manifest lists.
  const commands: PluginCommand[] = [];
  const cmdSpec = manifest.commands;
  if (cmdSpec && typeof cmdSpec === "object" && !Array.isArray(cmdSpec)) {
    for (const [cmd, v] of Object.entries(cmdSpec as Record<string, { source?: string; content?: string; description?: string; argumentHint?: string }>)) {
      const raw = v.content ?? (v.source && has(v.source.replace(/^\.\//, "")) ? await text(v.source.replace(/^\.\//, "")) : "");
      const { data, body } = parseFrontmatter(raw);
      if (body) commands.push({ name: cmd, description: v.description ?? data.description, argumentHint: v.argumentHint ?? data["argument-hint"], body });
    }
  } else {
    const roots = cmdSpec ? [cmdSpec].flat().map((p) => str(p)?.replace(/^\.\//, "").replace(/\/$/, "") ?? "") : ["commands"];
    for (const f of files.filter((f) => f.endsWith(".md") && roots.some((r) => f === r || f.startsWith(`${r}/`))).slice(0, 100)) {
      const { data, body } = parseFrontmatter(await text(f));
      commands.push({ name: f.split("/").pop()!.replace(/\.md$/, ""), description: data.description, argumentHint: data["argument-hint"], body });
    }
  }

  // Agents become modes: their Markdown body is a system prompt.
  const agentFiles = manifest.agents ? [manifest.agents].flat().map((p) => str(p)?.replace(/^\.\//, "") ?? "") : files.filter((f) => f.startsWith("agents/") && f.endsWith(".md"));
  const agents: PluginSkill[] = [];
  for (const f of agentFiles.filter(has).slice(0, 50)) {
    const { data, body } = parseFrontmatter(await text(f));
    agents.push({ name: data.name || f.split("/").pop()!.replace(/\.md$/, ""), description: data.description ?? "", body });
  }

  // MCP servers from .mcp.json and the manifest.
  const unsupported: string[] = [];
  const servers: Record<string, unknown> = {};
  if (has(".mcp.json")) {
    const j = await readJson(".mcp.json");
    Object.assign(servers, (j.mcpServers as object) ?? j);
  }
  for (const spec of [manifest.mcpServers].flat()) {
    if (spec && typeof spec === "object") Object.assign(servers, spec);
    else if (typeof spec === "string" && spec.endsWith(".json") && has(spec.replace(/^\.\//, ""))) {
      const j = await readJson(spec.replace(/^\.\//, ""));
      Object.assign(servers, (j.mcpServers as object) ?? j);
    } else if (typeof spec === "string") unsupported.push(`MCP bundle ${spec}`);
  }
  const mcp: PluginMcp[] = [];
  for (const [server, cfg] of Object.entries(servers)) {
    const c = cfg as { type?: string; url?: string; command?: string; args?: string[] };
    const uses = JSON.stringify(c);
    if (/\$\{(user_config\.|CLAUDE_PLUGIN_ROOT|CLAUDE_PLUGIN_DATA|CLAUDE_PROJECT_DIR)/.test(uses)) unsupported.push(`MCP server "${server}" (needs files or settings only Claude Code provides)`);
    else if (c.url && /^https:\/\//.test(c.url)) mcp.push({ name: server, kind: "http", url: c.url });
    else if (c.command) mcp.push({ name: server, kind: "stdio", command: c.command, args: Array.isArray(c.args) ? c.args.map(String) : [] });
    else unsupported.push(`MCP server "${server}"`);
  }

  if (has("hooks/hooks.json") || manifest.hooks) unsupported.push("Hooks");
  if (files.some((f) => f.startsWith("bin/"))) unsupported.push("Command-line tools (bin/)");
  if (has(".lsp.json") || manifest.lspServers) unsupported.push("Code intelligence (LSP)");
  if (skills.some((s) => /\bscripts?\//.test(s.body))) unsupported.push("Scripts that skills run (the AI gets the instructions only)");
  if (commands.some((c) => /!`[^`]+`/.test(c.body))) unsupported.push("Shell commands inside slash commands (they're sent as text)");

  return {
    name,
    displayName: str(manifest.displayName),
    description: str(manifest.description),
    version: str(manifest.version),
    source,
    skills,
    commands,
    agents,
    mcp,
    unsupported,
  };
}

/** "/name args" or "/plugin:name args" -> the command's prompt with $ARGUMENTS, $1…$9 filled in. */
export function expandPluginCommand(text: string, plugins: ClaudePlugin[]): string | undefined {
  const m = text.match(/^\/([\w.-]+)(?::([\w.-]+))?(?:\s+([\s\S]*))?$/);
  if (!m) return undefined;
  const [, a, b, rawArgs = ""] = m;
  const enabled = plugins.filter((p) => p.enabled);
  const cmd = b ? enabled.find((p) => p.name === a)?.commands.find((c) => c.name === b) : enabled.flatMap((p) => p.commands).find((c) => c.name === a);
  if (!cmd) return undefined;
  const args = rawArgs.trim().split(/\s+/).filter(Boolean);
  return cmd.body.replace(/\$ARGUMENTS/g, rawArgs.trim()).replace(/\$(\d)/g, (_, n: string) => args[Number(n) - 1] ?? "");
}

/** The skills list the model sees; it calls load_skill to read one in full. */
export function skillsInstructions(plugins: ClaudePlugin[]) {
  const skills = plugins.filter((p) => p.enabled).flatMap((p) => p.skills.map((s) => `- ${p.name}:${s.name}: ${s.description.slice(0, 300)}`));
  if (!skills.length) return "";
  return `You have these skills. When a request matches one, call load_skill with its name (plugin:skill) and follow the instructions it returns.\n${skills.slice(0, 200).join("\n")}`;
}

export function findSkill(plugins: ClaudePlugin[], name: string) {
  const [p, s] = name.includes(":") ? name.split(":") : [undefined, name];
  return plugins.filter((x) => x.enabled && (!p || x.name === p)).flatMap((x) => x.skills).find((x) => x.name === s);
}

// ---------- GitHub access (browser side; uses the visitor's own GitHub rate limit) ----------

export const DIRECTORIES = [
  { name: "Anthropic's plugin directory", source: { repo: "anthropics/claude-plugins-official", ref: "HEAD", path: "" } },
  { name: "Anthropic's skills", source: { repo: "anthropics/skills", ref: "HEAD", path: "" } },
];

const raw = (s: PluginSource, p: string) => `https://raw.githubusercontent.com/${s.repo}/${s.ref}/${join(s.path, p).split("/").map(encodeURIComponent).join("/")}`;

async function get(url: string, what: string) {
  const res = await fetch(url).catch(() => null);
  if (!res) throw new Error("Couldn't reach GitHub. Check your internet connection.");
  if (res.status === 404) throw new Error(`${what} wasn't found. Check the link, and that the repository is public.`);
  if (res.status === 403 || res.status === 429) throw new Error("GitHub's limit for anonymous requests was reached. Try again in a few minutes.");
  if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
  return res;
}

/** A marketplace if the folder has .claude-plugin/marketplace.json, otherwise undefined. */
export async function fetchMarketplace(s: PluginSource): Promise<MarketplaceEntry[] | undefined> {
  const res = await fetch(raw(s, ".claude-plugin/marketplace.json")).catch(() => null);
  if (!res?.ok) return undefined;
  return parseMarketplace(await res.json(), s);
}

export async function fetchPlugin(s: PluginSource, fallbackName: string, entry?: Record<string, unknown>) {
  const tree = (await (await get(`https://api.github.com/repos/${s.repo}/git/trees/${encodeURIComponent(s.ref)}?recursive=1`, "That repository")).json()) as { tree: { path: string; type: string }[] };
  const prefix = s.path ? `${s.path}/` : "";
  const files = tree.tree.filter((t) => t.type === "blob" && t.path.startsWith(prefix)).map((t) => t.path.slice(prefix.length));
  if (!files.length) throw new Error("That folder is empty or doesn't exist.");
  const plugin = await buildPlugin(s, files, async (p) => (await get(raw(s, p), p)).text(), fallbackName, entry);
  if (!plugin.skills.length && !plugin.commands.length && !plugin.agents.length && !plugin.mcp.length) {
    throw new Error("This doesn't look like a Claude plugin: no skills, commands, agents or MCP servers found.");
  }
  return plugin;
}
