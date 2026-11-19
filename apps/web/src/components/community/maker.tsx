"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppPreview, ThemeShowcase } from "@/components/customize/preview";
import { currentLook } from "@/components/customize/look";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validName } from "@/lib/commands";
import { KINDS, publish, type Kind, type Payload } from "@/lib/community";
import { EDITABLE, THEMES, type Look, type ThemeId } from "@/lib/customize";
import { update, useStore } from "@/lib/store";
import { useUser } from "@/lib/supabase/client";

const LABEL: Record<(typeof EDITABLE)[number], string> = { background: "Page", foreground: "Text", card: "Cards", primary: "Buttons", "primary-foreground": "Button text", accent: "Highlights", border: "Lines", sidebar: "Sidebar" };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "my-mod";
const MOD_EXAMPLE = `// Runs in a sealed sandbox: no access to your keys, chats or settings.
moonc.registerTool("roll_dice", ({ sides = 6 }) => {
  return { rolled: 1 + Math.floor(Math.random() * sides) };
});`;

/** Make a theme, mode, command, setup or mod with a live preview, then keep it, share it, or both. */
export function Maker({ initialKind, onClose, onShared, onSignIn }: { initialKind?: Kind; onClose: () => void; onShared: () => void; onSignIn: () => void }) {
  const user = useUser();
  const profileName = useStore((s) => s.profile?.name);
  const myThemes = useStore((s) => s.myThemes) ?? [];
  const myModes = useStore((s) => s.modes);
  const myCommands = useStore((s) => s.myCommands) ?? [];
  const [kind, setKind] = useState<Kind>(initialKind ?? "theme");
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [author, setAuthor] = useState(profileName ?? "");
  const [busy, setBusy] = useState(false);
  // Theme
  const now = currentLook();
  const [look, setLookDraft] = useState<Pick<Look, "theme" | "overrides" | "radius">>({ theme: now.theme, overrides: { ...now.overrides }, radius: now.radius });
  // Mode
  const [instructions, setInstructions] = useState("");
  const [temperature, setTemperature] = useState<number>();
  // Command
  const [cmdName, setCmdName] = useState("");
  const [cmdPrompt, setCmdPrompt] = useState("");
  // Mod
  const [pick, setPick] = useState<{ themes: string[]; modes: string[]; commands: string[] }>({ themes: [], modes: [], commands: [] });
  const [tool, setTool] = useState({ on: false, name: "roll_dice", description: "Roll a die with the given number of sides.", code: MOD_EXAMPLE });

  const payload = (): Payload => {
    if (kind === "theme") return { kind, look };
    if (kind === "mode") return { kind, mode: { instructions: instructions.trim(), temperature } };
    if (kind === "command") return { kind, command: { name: cmdName, prompt: cmdPrompt.trim() } };
    if (kind === "setup") {
      const { wallpaper: _w, ...rest } = currentLook();
      void _w;
      return { kind, distro: { name: name.trim() || "My setup", description: about.trim(), look: rest, onlyLocal: false } };
    }
    const themes = myThemes.filter((t) => pick.themes.includes(t.id)).map((t) => ({ name: t.name.slice(0, 40), tokens: t.look.overrides as Record<string, string> }));
    const personas = myModes.filter((m) => pick.modes.includes(m.id)).map((m) => ({ name: m.name, instructions: m.instructions, temperature: m.temperature }));
    const commands = myCommands.filter((c) => pick.commands.includes(c.name)).map((c) => ({ name: `/${c.name}`.slice(0, 31), description: c.prompt.slice(0, 200), prompt: c.prompt.replace(/\{input\}/g, "{{input}}") }));
    const tools = tool.on ? [{ name: tool.name, description: tool.description, inputSchema: { type: "object" as const } }] : [];
    return {
      kind,
      manifest: { id: slug(name), name: name.trim().slice(0, 40) || "My mod", version: "1.0.0", description: about.trim(), author: (author.trim() || "Someone").slice(0, 80), permissions: tool.on ? ["tools"] : [], tools, commands, personas, themes, ...(tool.on ? { script: "mod.js" } : {}) },
      ...(tool.on ? { code: tool.code } : {}),
    };
  };

  const problem = (() => {
    if (!name.trim()) return "Give it a name.";
    if (kind === "mode" && !instructions.trim()) return "Write what the AI should do in this mode.";
    if (kind === "command" && !validName(cmdName)) return "Command names are lowercase letters, numbers or dashes, like trip-plan.";
    if (kind === "command" && !cmdPrompt.trim()) return "Write the prompt the command fills in.";
    if (kind === "mod" && !tool.on && !pick.themes.length && !pick.modes.length && !pick.commands.length) return "Pick at least one thing to put in the mod, or add an AI tool.";
    if (kind === "mod" && tool.on && !/^[a-zA-Z0-9_]{1,40}$/.test(tool.name)) return "Tool names are letters, numbers and underscores.";
    return "";
  })();

  /** Keep a copy in your own lists (themes, modes, commands, setups). */
  const keep = () => {
    const p = payload();
    const id = `my-${Date.now().toString(36)}`;
    if (p.kind === "theme") update((s) => ({ ...s, myThemes: [...(s.myThemes ?? []), { id, name: name.trim(), look: p.look }] }));
    if (p.kind === "mode") update((s) => ({ ...s, modes: [...s.modes, { id, name: name.trim().slice(0, 40), instructions: p.mode.instructions, temperature: p.mode.temperature }] }));
    if (p.kind === "command") update((s) => ({ ...s, myCommands: [...(s.myCommands ?? []).filter((c) => c.name !== p.command.name), p.command] }));
    if (p.kind === "setup") update((s) => ({ ...s, customDistros: [...(s.customDistros ?? []), { ...p.distro, id, look: { ...p.distro.look } as Look }] }));
  };

  const share = async () => {
    if (!user) return onSignIn();
    setBusy(true);
    try {
      await publish({ kind, name, description: about, author_name: author, payload: payload() });
      if (kind !== "mod") keep();
      toast.success(`${name.trim()} is shared. Anyone can add it from Community.`);
      onShared();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Make something</DialogTitle>
          <DialogDescription>Build it here and watch it change as you go. Keep it for yourself, share it with everyone, or both.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="What to make" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button key={k.id} role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} className="rounded-full border px-3 py-1 text-sm aria-checked:border-primary aria-checked:bg-selected aria-checked:text-selected-foreground" title={k.note}>
              {k.one[0].toUpperCase() + k.one.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{KINDS.find((k) => k.id === kind)!.note}.</p>

        <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,20rem)]">
          <div className="grid content-start gap-3">
            <Field id="mk-name" label="Name">
              <Input id="mk-name" value={name} maxLength={kind === "mod" ? 40 : 60} onChange={(e) => setName(e.target.value)} placeholder={{ theme: "Ocean night", mode: "Spanish tutor", command: "Trip planner", setup: "My writing desk", mod: "Game night" }[kind]} />
            </Field>

            {kind === "theme" && (
              <>
                <Field id="mk-base" label="Start from">
                  <select id="mk-base" value={look.theme} onChange={(e) => setLookDraft({ ...look, theme: e.target.value as ThemeId, overrides: {} })} className="h-9 rounded-md border bg-background px-2 text-sm">
                    {THEMES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {EDITABLE.map((k) => (
                    <label key={k} className="grid gap-1 text-xs">
                      {LABEL[k]}
                      <input type="color" aria-label={`${LABEL[k]} color`} value={look.overrides[k] ?? "#888888"} onChange={(e) => setLookDraft({ ...look, overrides: { ...look.overrides, [k]: e.target.value } })} className="h-8 w-full cursor-pointer rounded border bg-transparent" />
                    </label>
                  ))}
                </div>
                <Field id="mk-radius" label={`Corners: ${look.radius ?? 0.625}`}>
                  <input id="mk-radius" type="range" min={0} max={1.5} step={0.05} value={look.radius ?? 0.625} onChange={(e) => setLookDraft({ ...look, radius: Number(e.target.value) })} className="accent-primary" />
                </Field>
              </>
            )}

            {kind === "mode" && (
              <>
                <Field id="mk-inst" label="What the AI should do">
                  <Textarea id="mk-inst" className="min-h-32" maxLength={8000} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="You are a patient Spanish tutor. Reply in simple Spanish, then the same in English, and correct one mistake each time." />
                </Field>
                <Field id="mk-temp" label={`Creativity: ${temperature ?? "model default"}`}>
                  <input id="mk-temp" type="range" min={0} max={2} step={0.1} value={temperature ?? 1} onChange={(e) => setTemperature(Number(e.target.value))} className="accent-primary" />
                </Field>
              </>
            )}

            {kind === "command" && (
              <>
                <Field id="mk-cmd" label="What you type">
                  <div className="flex items-center gap-1">
                    <span className="font-mono">/</span>
                    <Input id="mk-cmd" value={cmdName} maxLength={30} onChange={(e) => setCmdName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="trip-plan" className="font-mono" />
                  </div>
                </Field>
                <Field id="mk-prompt" label="The prompt it fills in ({input} is what you type after it)">
                  <Textarea id="mk-prompt" className="min-h-28" maxLength={4000} value={cmdPrompt} onChange={(e) => setCmdPrompt(e.target.value)} placeholder="Plan a 3-day trip to {input} on a small budget, day by day." />
                </Field>
              </>
            )}

            {kind === "setup" && <p className="rounded-lg border p-3 text-sm text-muted-foreground">This shares your setup as it is now: theme, colors, layout and which sections show. Change it in Appearance first if you like. Your background picture stays private.</p>}

            {kind === "mod" && (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">A mod bundles your own themes, modes and commands into one thing others add in a click.</p>
                <Pick label="Your themes" items={myThemes.map((t) => ({ id: t.id, name: t.name }))} value={pick.themes} onChange={(themes) => setPick({ ...pick, themes })} empty="Save a theme first (Make something > Theme > Keep it)." />
                <Pick label="Your modes" items={myModes.map((m) => ({ id: m.id, name: m.name }))} value={pick.modes} onChange={(modes) => setPick({ ...pick, modes })} empty="Make a mode first." />
                <Pick label="Your commands" items={myCommands.map((c) => ({ id: c.name, name: `/${c.name}` }))} value={pick.commands} onChange={(commands) => setPick({ ...pick, commands })} empty="Make a command first." />
                <details open={tool.on} onToggle={(e) => setTool({ ...tool, on: (e.target as HTMLDetailsElement).open })} className="rounded-lg border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Add an AI tool (code, for advanced makers)</summary>
                  <div className="mt-2 grid gap-2">
                    <Input aria-label="Tool name" value={tool.name} onChange={(e) => setTool({ ...tool, name: e.target.value })} className="font-mono" />
                    <Input aria-label="What the tool does" value={tool.description} maxLength={500} onChange={(e) => setTool({ ...tool, description: e.target.value })} />
                    <Textarea aria-label="Tool code" value={tool.code} maxLength={200_000} onChange={(e) => setTool({ ...tool, code: e.target.value })} className="min-h-40 font-mono text-xs" />
                    <p className="text-xs text-muted-foreground">The AI can call this tool in chats. The code runs in a sealed sandbox, and everyone who adds your mod sees what it can do before it installs.</p>
                  </div>
                </details>
              </div>
            )}

            <Field id="mk-about" label="Description (optional)">
              <Input id="mk-about" value={about} maxLength={300} onChange={(e) => setAbout(e.target.value)} placeholder="What it's good for" />
            </Field>
            <Field id="mk-author" label="Shown as made by">
              <Input id="mk-author" value={author} maxLength={40} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name or a nickname" />
            </Field>
          </div>

          <figure className="grid content-start gap-1.5 md:sticky md:top-0">
            {kind === "theme" ? (
              <ThemeShowcase look={{ ...now, ...look }} />
            ) : kind === "setup" ? (
              <AppPreview look={now} />
            ) : kind === "command" ? (
              <div className="grid gap-2 rounded-xl border p-3 text-sm">
                <span className="text-xs text-muted-foreground">When someone types</span>
                <code className="rounded bg-muted px-2 py-1">/{cmdName || "name"} Lisbon</code>
                <span className="text-xs text-muted-foreground">the AI gets</span>
                <p className="rounded bg-muted px-2 py-1 whitespace-pre-wrap">{(cmdPrompt || "Your prompt").replace(/\{input\}/g, "Lisbon")}</p>
              </div>
            ) : kind === "mode" ? (
              <div className="grid gap-2 rounded-xl border p-3 text-sm">
                <span className="text-xs text-muted-foreground">Shows in the mode menu as</span>
                <span className="font-medium">{name || "Your mode"}</span>
                <span className="line-clamp-6 text-muted-foreground">{instructions || "Your instructions"}</span>
              </div>
            ) : (
              <div className="grid gap-1 rounded-xl border p-3 text-sm">
                <span className="font-medium">{name || "Your mod"}</span>
                <span className="text-muted-foreground">
                  {pick.themes.length} theme{pick.themes.length === 1 ? "" : "s"}, {pick.modes.length} mode{pick.modes.length === 1 ? "" : "s"}, {pick.commands.length} command{pick.commands.length === 1 ? "" : "s"}
                  {tool.on ? ", 1 AI tool" : ""}
                </span>
              </div>
            )}
            <figcaption className="text-center text-xs text-muted-foreground">Live preview</figcaption>
          </figure>
        </div>

        <DialogFooter className="items-center gap-2">
          {problem && <span className="mr-auto text-sm text-muted-foreground">{problem}</span>}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {kind !== "mod" && (
            <Button
              variant="outline"
              disabled={!!problem}
              onClick={() => {
                keep();
                toast.success(`${name.trim()} saved to your own ${KINDS.find((k) => k.id === kind)!.name.toLowerCase()}.`);
                onClose();
              }}
            >
              Keep it
            </Button>
          )}
          <Button disabled={!!problem || busy} onClick={share}>
            {busy && <Loader2 className="animate-spin" />} {user ? "Share with everyone" : "Sign in to share"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Pick({ label, items, value, onChange, empty }: { label: string; items: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void; empty: string }) {
  return (
    <fieldset className="grid gap-1 text-sm">
      <legend className="mb-1 font-medium">{label}</legend>
      {items.length ? (
        items.map((i) => (
          <label key={i.id} className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={value.includes(i.id)} onChange={() => onChange(value.includes(i.id) ? value.filter((x) => x !== i.id) : [...value, i.id])} />
            {i.name}
          </label>
        ))
      ) : (
        <span className="text-muted-foreground">{empty}</span>
      )}
    </fieldset>
  );
}
