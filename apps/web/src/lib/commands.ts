// Chat commands: type "/" and a plain word. No flags, no syntax to learn: "/translate spanish good morning".
// Built-in ones, your own (Settings > Commands, with {input} where your text goes), and ones from plugins and mods.

export interface ChatCommand {
  /** Without the slash. */
  name: string;
  /** What to type after it, in plain words ("language, then text"). */
  args?: string;
  does: string;
  example: string;
  /** "prompt": becomes a message to the AI. "action": does something in the app instead. */
  kind: "prompt" | "action";
  /** For prompts: {input} is everything after the name; {first} is its first word and {rest} the words after. */
  template?: string;
  /** Used when nothing follows the name. */
  empty?: string;
  from: "Built in" | "Yours" | "Plugin" | "Mod";
}

export interface MyCommand {
  name: string;
  prompt: string;
}

export const BUILT_IN: ChatCommand[] = [
  { name: "help", does: "Show every command", example: "/help", kind: "action", from: "Built in" },
  { name: "new", does: "Start a new chat", example: "/new", kind: "action", from: "Built in" },
  { name: "model", args: "a model's name", does: "Switch model", example: "/model claude", kind: "action", from: "Built in" },
  { name: "tools", does: "Turn web search, links and Python on or off", example: "/tools", kind: "action", from: "Built in" },
  { name: "theme", args: "light or dark", does: "Switch light and dark", example: "/theme dark", kind: "action", from: "Built in" },
  {
    name: "summarize",
    args: "text (or nothing for this chat)",
    does: "Sum it up in a few bullets",
    example: "/summarize",
    kind: "prompt",
    template: "Summarize this in a few short bullet points:\n\n{input}",
    empty: "Summarize our conversation so far in a few short bullet points.",
    from: "Built in",
  },
  {
    name: "explain",
    args: "anything",
    does: "Explain it simply",
    example: "/explain how vaccines work",
    kind: "prompt",
    template: "Explain this simply, in plain words, with one everyday example:\n\n{input}",
    empty: "Explain your last answer more simply, in plain words, with one everyday example.",
    from: "Built in",
  },
  {
    name: "translate",
    args: "a language, then text",
    does: "Translate",
    example: "/translate spanish good morning",
    kind: "prompt",
    template: "Translate this into {first}. Reply with only the translation:\n\n{rest}",
    empty: "Translate your last answer into English.",
    from: "Built in",
  },
  {
    name: "fix",
    args: "text",
    does: "Fix spelling and grammar",
    example: "/fix their going too the park",
    kind: "prompt",
    template: "Fix the spelling and grammar. Keep my wording and tone. Reply with only the fixed text:\n\n{input}",
    from: "Built in",
  },
  {
    name: "shorter",
    args: "text (or nothing for the last answer)",
    does: "Make it shorter",
    example: "/shorter",
    kind: "prompt",
    template: "Rewrite this to about half the length, keeping every important point:\n\n{input}",
    empty: "Rewrite your last answer to about half the length, keeping every important point.",
    from: "Built in",
  },
  {
    name: "email",
    args: "what it's about",
    does: "Write an email",
    example: "/email ask my landlord to fix the heater",
    kind: "prompt",
    template: "Write a short, friendly, clear email about this. Include a subject line:\n\n{input}",
    from: "Built in",
  },
  {
    name: "plan",
    args: "a goal",
    does: "Make a step-by-step plan",
    example: "/plan learn to cook in a month",
    kind: "prompt",
    template: "Make a clear step-by-step plan for this. Number the steps and keep each one short:\n\n{input}",
    from: "Built in",
  },
  {
    name: "ideas",
    args: "a topic",
    does: "Ten ideas",
    example: "/ideas birthday gifts for my dad",
    kind: "prompt",
    template: "Give me 10 varied, specific ideas for this, one line each:\n\n{input}",
    from: "Built in",
  },
  {
    name: "pros",
    args: "a choice",
    does: "Pros and cons",
    example: "/pros renting vs buying",
    kind: "prompt",
    template: "List the pros and cons of this, then give a one-line recommendation:\n\n{input}",
    from: "Built in",
  },
  {
    name: "code",
    args: "what it should do",
    does: "Write code",
    example: "/code a python script that renames my photos by date",
    kind: "prompt",
    template: "Write working code for this. Explain how to run it in two or three plain steps:\n\n{input}",
    from: "Built in",
  },
];

/** Names are lowercase letters, digits and dashes, like Claude's slash commands. */
export const validName = (n: string) => /^[a-z0-9-]{1,30}$/.test(n);

export const mine = (list: MyCommand[] = []): ChatCommand[] =>
  list.map((c) => ({ name: c.name, does: c.prompt.split("\n")[0].slice(0, 80), example: `/${c.name}`, kind: "prompt", template: c.prompt.includes("{input}") ? c.prompt : `${c.prompt}\n\n{input}`, empty: c.prompt.replace(/\s*\{input\}\s*/g, " ").trim(), from: "Yours" }));

/** "/translate spanish hi" -> { name: "translate", input: "spanish hi" }. Plugin names like "/plug:cmd" keep their colon. */
export function parse(text: string): { name: string; input: string } | undefined {
  const m = text.trim().match(/^\/([a-z0-9-]+(?::[a-z0-9-]+)?)(?:\s+([\s\S]*))?$/i);
  return m ? { name: m[1].toLowerCase(), input: (m[2] ?? "").trim() } : undefined;
}

/** Fill a prompt command. Your own and built-in prompts only; plugin and mod commands expand themselves. */
export function fill(cmd: ChatCommand, input: string): string {
  if (!input && cmd.empty) return cmd.empty;
  const [first = "", ...rest] = input.split(/\s+/);
  return (cmd.template ?? "{input}").replace(/\{input\}/g, input).replace(/\{first\}/g, first).replace(/\{rest\}/g, rest.join(" ") || first);
}

/** The menu while typing "/na": commands whose name starts with what's typed first, then ones that contain it. */
export function suggest(text: string, all: ChatCommand[]): ChatCommand[] {
  const m = text.match(/^\/([a-z0-9:-]*)$/i);
  if (!m) return [];
  const q = m[1].toLowerCase();
  const starts = all.filter((c) => c.name.startsWith(q));
  const has = all.filter((c) => !c.name.startsWith(q) && (c.name.includes(q) || c.does.toLowerCase().includes(q)));
  return [...starts, ...has];
}

/** First command with this name. Lists go yours, then plugins and mods, then built-in, so yours can replace any. */
export const find = (name: string, all: ChatCommand[]) => all.find((c) => c.name === name);

/** "/model sonnet 4" -> the best match among your models: every word must appear in the name or id. */
export function matchModel<T extends { name: string; id: string }>(query: string, models: T[]): T | undefined {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return undefined;
  const hits = models.filter((m) => words.every((w) => `${m.name} ${m.id}`.toLowerCase().includes(w)));
  // The shortest name is the plainest match ("Claude Sonnet 4" before "Claude Sonnet 4 (thinking, 2025-05-14)").
  return hits.sort((a, b) => a.name.length - b.name.length)[0];
}
