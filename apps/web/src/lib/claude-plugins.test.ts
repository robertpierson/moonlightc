import { describe, expect, it } from "vitest";
import { buildPlugin, expandPluginCommand, findSkill, parseFrontmatter, parseGitHubInput, parseMarketplace, skillsInstructions, type ClaudePlugin } from "./claude-plugins";

const src = { repo: "acme/tools", ref: "HEAD", path: "" };

describe("claude plugins", () => {
  it("parses front matter, including folded descriptions", () => {
    const { data, body } = parseFrontmatter('---\nname: pdf\ndescription: >\n  Read and fill\n  PDF forms.\nargument-hint: "[file]"\n---\nDo the thing.');
    expect(data).toEqual({ name: "pdf", description: "Read and fill PDF forms.", "argument-hint": "[file]" });
    expect(body).toBe("Do the thing.");
    expect(parseFrontmatter("no header").body).toBe("no header");
  });

  it("understands GitHub links", () => {
    expect(parseGitHubInput("acme/tools")).toEqual(src);
    expect(parseGitHubInput("https://github.com/acme/tools.git")).toEqual(src);
    expect(parseGitHubInput("https://github.com/acme/tools/tree/main/plugins/x")).toEqual({ repo: "acme/tools", ref: "main", path: "plugins/x" });
    expect(parseGitHubInput("https://evil.com/acme/tools")).toBeUndefined();
  });

  it("reads marketplace sources", () => {
    const list = parseMarketplace(
      {
        plugins: [
          { name: "a", source: "./plugins/a" },
          { name: "b", source: { source: "github", repo: "o/b" } },
          { name: "c", source: { source: "git-subdir", url: "https://github.com/o/c.git", path: "p/c", sha: "abc" } },
          { name: "d", source: { source: "url", url: "https://gitlab.com/o/d.git" } },
          { name: "e", source: "../escape" },
        ],
      },
      { repo: "m/market", ref: "HEAD", path: "" },
    );
    expect(list.map((e) => e.source)).toEqual([
      { repo: "m/market", ref: "HEAD", path: "plugins/a" },
      { repo: "o/b", ref: "HEAD", path: "" },
      { repo: "o/c", ref: "abc", path: "p/c" },
      undefined,
      undefined,
    ]);
  });

  it("builds a plugin from its files", async () => {
    const files: Record<string, string> = {
      ".claude-plugin/plugin.json": JSON.stringify({ name: "acme", description: "Acme tools", version: "1.0.0" }),
      "skills/review/SKILL.md": "---\nname: review\ndescription: Review code\n---\nCheck for bugs.",
      "commands/hello.md": "---\ndescription: Say hi\n---\nSay hello to $ARGUMENTS ($1).",
      "agents/critic.md": "---\nname: critic\ndescription: Harsh critic\n---\nBe blunt.",
      ".mcp.json": JSON.stringify({ mcpServers: { api: { type: "http", url: "https://mcp.acme.com/mcp" }, local: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/s.js"] }, npx: { command: "npx", args: ["-y", "acme-mcp"] } } }),
      "hooks/hooks.json": "{}",
    };
    const p = await buildPlugin(src, Object.keys(files), async (f) => files[f], "fallback");
    expect(p.name).toBe("acme");
    expect(p.skills).toEqual([{ name: "review", description: "Review code", body: "Check for bugs." }]);
    expect(p.commands[0]).toMatchObject({ name: "hello", description: "Say hi" });
    expect(p.agents[0]).toMatchObject({ name: "critic", body: "Be blunt." });
    expect(p.mcp).toEqual([
      { name: "api", kind: "http", url: "https://mcp.acme.com/mcp" },
      { name: "npx", kind: "stdio", command: "npx", args: ["-y", "acme-mcp"] },
    ]);
    expect(p.unsupported).toEqual(['MCP server "local" (needs files or settings only Claude Code provides)', "Hooks"]);

    const installed: ClaudePlugin = { ...p, id: "1", enabled: true, installedAt: 0 };
    expect(expandPluginCommand("/hello world peace", [installed])).toBe("Say hello to world peace (world).");
    expect(expandPluginCommand("/acme:hello Bo", [installed])).toBe("Say hello to Bo (Bo).");
    expect(expandPluginCommand("/nope", [installed])).toBeUndefined();
    expect(expandPluginCommand("/hello", [{ ...installed, enabled: false }])).toBeUndefined();
    expect(findSkill([installed], "acme:review")?.body).toBe("Check for bugs.");
    expect(skillsInstructions([installed])).toContain("- acme:review: Review code");
  });

  it("marketplace entries can list exactly which skill folders load", async () => {
    const files: Record<string, string> = {
      "skills/xlsx/SKILL.md": "---\nname: xlsx\ndescription: Spreadsheets\n---\nx",
      "skills/pdf/SKILL.md": "---\nname: pdf\ndescription: PDFs\n---\np",
    };
    const p = await buildPlugin(src, Object.keys(files), async (f) => files[f], "docs", { skills: ["./skills/xlsx"] });
    expect(p.name).toBe("docs");
    expect(p.skills.map((s) => s.name)).toEqual(["xlsx"]);
  });
});
