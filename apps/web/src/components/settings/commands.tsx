"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUILT_IN, validName } from "@/lib/commands";
import { update, useStore } from "@/lib/store";

/** Settings > Commands: every built-in command, and your own made from a name and a prompt. */
export function CommandsSettings() {
  const saved = useStore((s) => s.myCommands);
  const mine = saved ?? [];
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const clean = name.trim().replace(/^\//, "").toLowerCase();
  const problem = !clean
    ? undefined
    : !validName(clean)
      ? "Use letters, numbers and dashes only, like tweet or meal-plan."
      : mine.some((c) => c.name === clean)
        ? `You already have /${clean}. Delete it first to change it.`
        : undefined;
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clean || problem || !prompt.trim()) return;
    update((s) => ({ ...s, myCommands: [...(s.myCommands ?? []), { name: clean, prompt: prompt.trim() }] }));
    setName("");
    setPrompt("");
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-2xl gap-8 px-4 py-6">
        <header className="grid gap-1">
          <h2 className="text-lg font-semibold">Commands</h2>
          <p className="text-sm text-muted-foreground">
            Type <kbd className="rounded border px-1 font-mono">/</kbd> in a message to see them. A command is a word and what you want, like{" "}
            <span className="font-mono">/translate spanish good morning</span>.
          </p>
        </header>

        <section aria-labelledby="mine-h" className="grid gap-3">
          <h3 id="mine-h" className="font-medium">
            Your commands
          </h3>
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet. Make one below: it&apos;s a name and the message it sends.</p>
          ) : (
            <ul className="grid gap-2">
              {mine.map((c) => (
                <li key={c.name} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">/{c.name}</p>
                    <p className="mt-1 text-sm break-words whitespace-pre-wrap text-muted-foreground">{c.prompt}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete /${c.name}`}
                    onClick={() => update((s) => ({ ...s, myCommands: (s.myCommands ?? []).filter((x) => x.name !== c.name) }))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} aria-label="Make a command" className="grid gap-3 rounded-lg border p-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cmd-name">Name</Label>
              <div className="flex items-center gap-1">
                <span className="font-mono text-muted-foreground">/</span>
                <Input id="cmd-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="tweet" aria-invalid={!!problem} aria-describedby="cmd-name-hint" />
              </div>
              <p id="cmd-name-hint" className={`text-xs ${problem ? "text-destructive" : "text-muted-foreground"}`}>
                {problem ?? "Same name as a built-in one? Yours is used instead."}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cmd-prompt">What it sends</Label>
              <Textarea id="cmd-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Turn this into a short, punchy tweet: {input}" aria-describedby="cmd-prompt-hint" />
              <p id="cmd-prompt-hint" className="text-xs text-muted-foreground">
                <span className="font-mono">{"{input}"}</span> is replaced by whatever you type after the name. Leave it out and your text goes at the end.
              </p>
            </div>
            <Button type="submit" className="justify-self-start" disabled={!clean || !!problem || !prompt.trim()}>
              Add command
            </Button>
          </form>
        </section>

        <section aria-labelledby="built-h" className="grid gap-3">
          <h3 id="built-h" className="font-medium">
            Built in
          </h3>
          <ul className="divide-y rounded-lg border">
            {BUILT_IN.map((c) => (
              <li key={c.name} className="grid gap-0.5 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
                <span className="font-mono text-sm font-medium">/{c.name}</span>
                <span className="text-sm">
                  {c.does}
                  <span className="block font-mono text-xs text-muted-foreground">{c.example}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
