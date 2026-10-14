"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- full page loads on purpose, so the app starts with the saved profile and layout */

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { applyDistro } from "@/components/customize/look";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DISTROS } from "@/lib/customize";
import { startOpenRouterSignIn } from "@/lib/openrouter-auth";
import { update } from "@/lib/store";
import { safeNext, supabase } from "@/lib/supabase/client";

const USES = ["Writing", "Coding", "Research", "Studying", "Work tasks", "Creative projects", "Images and video", "Personal assistant", "Just exploring"];
const TOOLS = [
  "ChatGPT", "Claude", "Gemini", "Microsoft Copilot", "Perplexity", "Grok", "Meta AI", "DeepSeek", "Le Chat (Mistral)", "Poe",
  "Character.AI", "Cursor", "GitHub Copilot", "Claude Code", "Windsurf", "Replit", "v0", "Lovable", "Bolt", "Midjourney",
  "DALL·E", "Stable Diffusion", "Runway", "Sora", "ElevenLabs", "Suno", "NotebookLM", "Ollama", "LM Studio", "OpenRouter", "None yet",
];
const HEARD = ["A friend", "YouTube", "TikTok", "Instagram", "X (Twitter)", "Reddit", "GitHub", "A search engine", "Somewhere else"];
const STEPS = 7;

const noop = () => () => {};

export function Onboarding() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <Steps /> : null;
}

/** Remembers where a visitor came from (first visit only), for the sign-up record. */
export function readArrival() {
  try {
    return JSON.parse(localStorage.getItem("moonc:arrival") ?? "{}") as { utm?: Record<string, string>; referrer?: string };
  } catch {
    return {};
  }
}

function Chips({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className="rounded-full border px-3 py-1.5 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Steps() {
  const [next] = useState(() => safeNext(new URLSearchParams(location.search).get("next")));
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState(false);
  const [uses, setUses] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [heard, setHeard] = useState("");
  const [phone, setPhone] = useState("");
  const [distro, setDistro] = useState<string>();

  useEffect(() => {
    supabase()
      .auth.getUser()
      .then(async ({ data }) => {
        if (!data.user) return location.assign("/signin");
        // Already done once: never ask again.
        const { data: p } = await supabase().from("profiles").select("onboarded_at").eq("id", data.user.id).maybeSingle();
        if (p?.onboarded_at) return location.assign(next);
        setName((n) => n || String(data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? ""));
      });
  }, [next]);

  const save = async (patch: Record<string, unknown>) => {
    const sb = supabase();
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error("You're signed out. Sign in again.");
    const { error } = await sb.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", data.user.id);
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "That username is taken. Try another." : error.message);
  };
  const answers = () => ({ uses, tools, heard_from: heard || undefined, distro });
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  const finish = () =>
    run(async () => {
      const arrival = readArrival();
      await save({ onboarding: answers(), phone: phone.trim() || null, utm: arrival.utm ?? {}, referrer: arrival.referrer ?? null, onboarded_at: new Date().toISOString() });
      location.assign(next);
    });

  const first = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return setError("Usernames are 3 to 24 lowercase letters, numbers or underscores.");
    if (!age) return setError("You need to be 13 or older to use MoonlightC.");
    run(async () => {
      await save({ display_name: name.trim(), username, age_confirmed: true });
      update((s) => ({ ...s, profile: { ...s.profile, name: name.trim() } }));
      setStep(2);
    });
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="grid w-full max-w-lg gap-5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {step} of {STEPS}
          </span>
          {step > 1 && (
            <button className="underline underline-offset-4" onClick={finish} disabled={busy}>
              Skip the rest
            </button>
          )}
        </div>
        <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all dark:bg-foreground" style={{ width: `${(step / STEPS) * 100}%` }} />
        </div>

        {step === 1 && (
          <form onSubmit={first} className="grid gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome! What should we call you?</h1>
            <div className="grid gap-1.5">
              <Label htmlFor="ob-name">Name</Label>
              <Input id="ob-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ob-user">Username</Label>
              <Input id="ob-user" required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="moonfan_42" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="size-4 accent-primary" /> I&apos;m 13 or older
            </label>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Continue
            </Button>
          </form>
        )}
        {step === 2 && (
          <section className="grid gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">What do you use AI for?</h1>
            <Chips label="Uses" options={USES} value={uses} onChange={setUses} />
            <Button onClick={() => setStep(3)}>Continue</Button>
          </section>
        )}
        {step === 3 && (
          <section className="grid gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">Which AI tools do you use today?</h1>
            <Chips label="Tools" options={TOOLS} value={tools} onChange={setTools} />
            <Button onClick={() => setStep(4)}>Continue</Button>
          </section>
        )}
        {step === 4 && (
          <section className="grid gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">How did you hear about MoonlightC?</h1>
            <Chips label="Heard from" options={HEARD} value={heard ? [heard] : []} onChange={(v) => setHeard(v.filter((x) => x !== heard)[0] ?? "")} />
            <Button onClick={() => setStep(5)}>Continue</Button>
          </section>
        )}
        {step === 5 && (
          <section className="grid gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">Phone number (optional)</h1>
            <p className="text-sm text-muted-foreground">Only kept on your profile. You can leave this empty.</p>
            <Input aria-label="Phone number" type="tel" maxLength={32} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button onClick={() => setStep(6)}>Continue</Button>
          </section>
        )}
        {step === 6 && (
          <section className="grid gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">Pick a starting layout</h1>
            <div role="radiogroup" aria-label="Starting layout" className="grid gap-2 sm:grid-cols-2">
              {DISTROS.map((d) => (
                <button
                  key={d.id}
                  role="radio"
                  aria-checked={distro === d.id}
                  onClick={() => {
                    setDistro(d.id);
                    applyDistro(d);
                  }}
                  className="rounded-xl border p-3 text-left aria-checked:ring-2 aria-checked:ring-ring/50"
                >
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-muted-foreground">{d.description}</div>
                </button>
              ))}
            </div>
            <Button onClick={() => setStep(7)}>Continue</Button>
          </section>
        )}
        {step === 7 && (
          <section className="grid gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">Connect your first model</h1>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await save({ onboarding: answers(), onboarded_at: new Date().toISOString() });
                  location.assign("/app?keys=1");
                })
              }
            >
              Add an API key
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await save({ onboarding: answers(), onboarded_at: new Date().toISOString() });
                  await startOpenRouterSignIn();
                })
              }
            >
              Sign in with OpenRouter
            </Button>
            <Button variant="outline" asChild>
              <Link href="/download">Install a model on my computer</Link>
            </Button>
            <Button variant="ghost" onClick={finish} disabled={busy}>
              Finish without a model
            </Button>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
