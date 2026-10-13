import type { MemoryItem, Project } from "./store";

const MAX_FILES_CHARS = 60_000;
const MAX_MEMORIES = 12;

const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

// ponytail: word-overlap ranking on the device; switch to pgvector embeddings when memory syncs to the database.
export function relevantMemories(items: MemoryItem[], query: string, projectId?: string): MemoryItem[] {
  const pool = items.filter((m) => !m.projectId || m.projectId === projectId);
  if (pool.length <= MAX_MEMORIES) return pool;
  const q = words(query);
  return pool
    .map((m) => ({ m, score: [...words(m.text)].filter((w) => q.has(w)).length + m.createdAt / 1e15 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MEMORIES)
    .map((x) => x.m);
}

/** The system instructions for one request: mode + project (instructions and files) + remembered facts. */
export function buildInstructions(opts: { mode?: string; project?: Project; memories?: MemoryItem[]; memoryOn: boolean }) {
  const parts: string[] = [];
  if (opts.mode) parts.push(opts.mode);
  if (opts.project) {
    parts.push(`You are working in the project "${opts.project.name}".`);
    if (opts.project.instructions.trim()) parts.push(opts.project.instructions.trim());
    let budget = MAX_FILES_CHARS;
    const files = opts.project.files
      .map((f) => {
        const text = f.text.slice(0, Math.max(0, budget));
        budget -= text.length;
        return text ? `<file name="${f.name.replace(/"/g, "")}">\n${text}\n</file>` : "";
      })
      .filter(Boolean);
    if (files.length) parts.push(`Project files:\n${files.join("\n\n")}`);
  }
  if (opts.memoryOn) {
    parts.push(
      "You can remember lasting facts about the user with the save_memory tool (preferences, names, ongoing goals). Save only what the user would want remembered, never secrets.",
    );
    if (opts.memories?.length) parts.push(`What you remember about the user:\n${opts.memories.map((m) => `- ${m.text}`).join("\n")}`);
  }
  return parts.join("\n\n");
}
