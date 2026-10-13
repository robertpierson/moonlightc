import { z } from "zod";

/**
 * A MoonlightC mod is a manifest plus (optionally) one JavaScript file.
 * The script runs in a sandboxed iframe with no access to MoonlightC's pages, storage, keys or chats.
 * It talks to MoonlightC only through the `moonc` object described below.
 */

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const toolName = z.string().regex(/^[a-zA-Z0-9_]{1,40}$/);

export const ModToolSchema = z.object({
  name: toolName,
  description: z.string().min(1).max(500),
  /** JSON Schema for the tool's input (an object schema). */
  inputSchema: z.object({ type: z.literal("object") }).passthrough(),
});

export const ModManifestSchema = z.object({
  id: slug,
  name: z.string().min(1).max(40),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(300),
  author: z.string().max(80),
  homepage: z.string().url().optional(),
  /** Shown to the user before install. */
  permissions: z.array(z.enum(["tools", "panel", "network"])).default([]),
  tools: z.array(ModToolSchema).max(20).default([]),
  panel: z.object({ title: z.string().max(40) }).optional(),
  commands: z
    .array(z.object({ name: z.string().regex(/^\/[a-z0-9-]{1,30}$/), description: z.string().max(200), prompt: z.string().max(4000) }))
    .max(20)
    .default([]),
  personas: z
    .array(z.object({ name: z.string().min(1).max(40), instructions: z.string().max(8000), temperature: z.number().min(0).max(2).optional() }))
    .max(10)
    .default([]),
  themes: z
    .array(z.object({ name: z.string().min(1).max(40), tokens: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)) }))
    .max(10)
    .default([]),
  /** File name of the script, relative to the manifest URL. Required for tools and panels. */
  script: z
    .string()
    .regex(/^[a-zA-Z0-9_./-]+\.js$/)
    .refine((s) => !s.includes(".."), "The script must be inside the mod's folder.")
    .optional(),
});
export type ModManifest = z.infer<typeof ModManifestSchema>;
export type ModTool = z.infer<typeof ModToolSchema>;

/** Registry index (the moonlightc-mods repo's index.json). */
export const ModIndexSchema = z.object({
  mods: z.array(z.object({ id: slug, name: z.string(), description: z.string(), manifest: z.string().url() })),
});

/** Messages between MoonlightC and a mod's sandbox. */
export type HostToMod = { type: "call"; id: string; tool: string; input: unknown };
export type ModToHost = { type: "ready" } | { type: "result"; id: string; output?: unknown; error?: string };

/** Fills a command's prompt template. `{{input}}` becomes whatever the user typed after the command. */
export const fillCommand = (prompt: string, input: string) => prompt.replace(/\{\{\s*input\s*\}\}/g, input);

export function validateManifest(raw: unknown): ModManifest {
  const m = ModManifestSchema.parse(raw);
  if ((m.tools.length || m.panel) && !m.script) throw new Error("A mod with tools or a panel needs a script.");
  if (m.tools.length && !m.permissions.includes("tools")) throw new Error('A mod with tools must declare the "tools" permission.');
  if (m.panel && !m.permissions.includes("panel")) throw new Error('A mod with a panel must declare the "panel" permission.');
  return m;
}
