"use client";

import { Check, Download, Link2, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { applyDistro, BACKDROP_EVENT, setLook, useLook } from "./look";
import { AppPreview } from "./preview";
import { EFFECTS } from "./effects";
import { clearBackdrop, loadBackdrop, MAX_BACKDROP, saveBackdrop } from "@/lib/backdrop-file";
import { desktop } from "@/lib/desktop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCENTS,
  DEFAULT_LOOK,
  DistroSchema,
  FONTS,
  LEVELS,
  DISTROS,
  EDITABLE,
  encodeDistro,
  prettyShortcut,
  shortcutFromEvent,
  THEMES,
  type Distro,
  type Level,
  type Look,
  type ViewId,
} from "@/lib/customize";
import { update, useStore } from "@/lib/store";

const SECTION_LABEL: Record<ViewId, string> = { chat: "Chat", code: "Code", subscriptions: "Subscriptions", library: "Projects", studio: "Studio", connections: "Connections", models: "Local models", terminal: "Terminal", projects: "Local projects", automations: "Automations", mods: "Mods", customize: "Customize" };

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ShortcutInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);
  const mac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Button
        variant="outline"
        size="sm"
        aria-label={`Change shortcut for ${label}`}
        onClick={() => setRecording(true)}
        onKeyDown={(e) => {
          if (!recording) return;
          e.preventDefault();
          e.stopPropagation(); // the key press that sets a shortcut must not also trigger it
          if (e.key === "Escape") return setRecording(false);
          const s = shortcutFromEvent(e.nativeEvent);
          if (s) {
            onChange(s);
            setRecording(false);
          }
        }}
        onBlur={() => setRecording(false)}
      >
        {recording ? "Press keys…" : prettyShortcut(value, mac)}
      </Button>
    </div>
  );
}

export function Customize({ availableViews }: { availableViews: ViewId[] }) {
  const myThemes = useStore((s) => s.myThemes) ?? [];
  const [themeName, setThemeName] = useState("");
  const look = useLook();
  const distroId = useStore((s) => s.distroId);
  const custom = useStore((s) => s.customDistros) ?? [];
  const level: Level = useStore((s) => s.customizeLevel) ?? "simple";
  const more = level !== "simple";
  const full = level === "full";
  const [saveName, setSaveName] = useState("");
  const [importText, setImportText] = useState("");
  const modThemes = (useStore((s) => s.mods) ?? []).filter((m) => m.enabled).flatMap((m) => m.manifest.themes);

  const current = (): Distro => ({ id: `my-${Date.now().toString(36)}`, name: saveName.trim() || "My distro", description: "", look, onlyLocal: false });

  const importDistro = (raw: string) => {
    try {
      const d = DistroSchema.parse(JSON.parse(raw));
      update((s) => ({ ...s, customDistros: [...(s.customDistros ?? []).filter((x) => x.id !== d.id), d] }));
      applyDistro(d);
      setImportText("");
    } catch {
      toast.error("That isn't a valid MoonlightC distro file.");
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-6">
        <section aria-labelledby="level-h" className="grid gap-4 md:grid-cols-[1fr_minmax(0,22rem)] md:items-start">
          <div className="grid gap-3">
            <div>
              <h2 id="level-h" className="text-lg font-semibold">
                Appearance
              </h2>
              <p className="text-sm text-muted-foreground">Everything changes as you try it. Save changes keeps it; Reset puts it back.</p>
            </div>
            <div role="radiogroup" aria-label="How much to change" className="grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  role="radio"
                  aria-checked={level === l.id}
                  onClick={() => update((s) => ({ ...s, customizeLevel: l.id }))}
                  className="rounded-xl border p-3 text-left hover:border-primary aria-checked:border-primary aria-checked:ring-2 aria-checked:ring-ring/40"
                >
                  <span className="block font-medium">{l.name}</span>
                  <span className="block text-xs text-muted-foreground">{l.note}</span>
                </button>
              ))}
            </div>
          </div>
          <figure className="grid gap-1.5">
            <AppPreview look={look} inherit />
            <figcaption className="text-center text-xs text-muted-foreground">Your chat screen, as it looks now</figcaption>
          </figure>
        </section>

        <section aria-labelledby="distros-h" className="grid gap-3">
          <div>
            <h2 id="distros-h" className="text-lg font-semibold">
              Ready-made setups
            </h2>
            <p className="text-sm text-muted-foreground">One click sets the theme, layout and which sections you see. Change anything afterwards.</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[...DISTROS, ...custom].map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => applyDistro(d)}
                  aria-pressed={distroId === d.id}
                  className="flex h-full w-full flex-col gap-2 rounded-xl border p-2.5 text-left hover:border-primary aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-ring/40"
                >
                  <AppPreview look={d.look} />
                  <span className="flex items-center gap-2 px-1 font-medium">
                    {d.name} {distroId === d.id && <Check className="size-4 text-link" />}
                  </span>
                  <span className="px-1 text-sm text-muted-foreground">{d.description || "Your saved setup."}</span>
                </button>
              </li>
            ))}
          </ul>
          {full && (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="distro-name">Save your current setup</Label>
                  <Input id="distro-name" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name it" className="w-48" maxLength={40} />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const d = current();
                    update((s) => ({ ...s, customDistros: [...(s.customDistros ?? []), d], distroId: d.id }));
                    toast.success(`Saved "${d.name}".`);
                    setSaveName("");
                  }}
                >
                  Save as distro
                </Button>
                <Button variant="outline" onClick={() => download("moonlightc-distro.json", JSON.stringify(current(), null, 2))}>
                  <Download /> Export file
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const link = `${location.origin}/app?distro=${encodeDistro(current())}`;
                    if (link.length > 8000) return toast.error("This setup has a big wallpaper, so it's too large for a link. Export a file instead.");
                    await navigator.clipboard.writeText(link);
                    toast.success("Link copied. Anyone who opens it can choose to apply this setup.");
                  }}
                >
                  <Link2 /> Copy share link
                </Button>
              </div>
              <details>
                <summary className="cursor-pointer text-sm text-muted-foreground">Import a distro</summary>
                <div className="mt-2 grid gap-2">
                  <Textarea aria-label="Distro JSON" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste a distro file's contents" className="min-h-24 font-mono text-xs" />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!importText.trim()} onClick={() => importDistro(importText)}>
                      Import
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <label>
                        <Upload /> Choose file
                        <input type="file" accept="application/json,.json" hidden onChange={async (e) => e.target.files?.[0] && importDistro(await e.target.files[0].text())} />
                      </label>
                    </Button>
                  </div>
                </div>
              </details>
            </>
          )}
        </section>

        <section aria-labelledby="themes-h" className="grid gap-3">
          <h2 id="themes-h" className="text-lg font-semibold">
            Theme
          </h2>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={look.theme === t.id}
                onClick={() => setLook({ theme: t.id, overrides: {} })}
                className="grid gap-2 rounded-xl border p-2.5 text-left hover:border-primary aria-checked:border-primary aria-checked:ring-2 aria-checked:ring-ring/40"
              >
                <AppPreview look={{ ...look, theme: t.id, overrides: {} }} inherit={t.id === "moonlight" && look.theme === "moonlight"} />
                <span className="px-1">
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{t.note}</span>
                </span>
              </button>
            ))}
          </div>
          {more && myThemes.length > 0 && (
            <div role="radiogroup" aria-label="My themes" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {myThemes.map((t) => {
                const on = look.theme === t.look.theme && JSON.stringify(look.overrides) === JSON.stringify(t.look.overrides) && look.radius === t.look.radius;
                return (
                  <div key={t.id} className="flex items-center gap-1 rounded-xl border p-1 pl-3 has-[[aria-checked=true]]:ring-2 has-[[aria-checked=true]]:ring-ring/40">
                    <button role="radio" aria-checked={on} onClick={() => setLook({ theme: t.look.theme, overrides: t.look.overrides, radius: t.look.radius })} className="min-w-0 flex-1 truncate py-2 text-left font-medium">
                      {t.name}
                    </button>
                    <Button variant="ghost" size="icon" aria-label={`Delete theme ${t.name}`} onClick={() => update((s) => ({ ...s, myThemes: (s.myThemes ?? []).filter((x) => x.id !== t.id) }))}>
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {modThemes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-sm text-muted-foreground">From mods:</span>
              {modThemes.map((t) => (
                <Button key={t.name} variant="outline" size="sm" onClick={() => setLook({ theme: "moonlight", overrides: Object.fromEntries(Object.entries(t.tokens).filter(([k]) => (EDITABLE as readonly string[]).includes(k))) })}>
                  {t.name}
                </Button>
              ))}
            </div>
          )}
          {more && (
            <div className="grid gap-4 rounded-xl border p-4 text-sm">
              <div className="grid gap-2">
                <span className="font-medium">Accent color</span>
                <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap items-center gap-2">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      role="radio"
                      aria-checked={look.overrides.primary === c}
                      aria-label={`Accent ${c}`}
                      onClick={() => setLook({ overrides: { ...look.overrides, primary: c, "primary-foreground": "#ffffff" } })}
                      className="size-8 rounded-full ring-offset-2 ring-offset-background aria-checked:ring-2 aria-checked:ring-ring"
                      style={{ background: c }}
                    />
                  ))}
                  <button
                    role="radio"
                    aria-checked={!look.overrides.primary}
                    onClick={() => {
                      const rest = { ...look.overrides };
                      delete rest.primary;
                      delete rest["primary-foreground"];
                      setLook({ overrides: rest });
                    }}
                    className="h-8 rounded-full border px-3 text-xs aria-checked:ring-2 aria-checked:ring-ring"
                  >
                    Theme&apos;s own
                  </button>
                </div>
              </div>
              <label className="grid gap-1">
                Corner roundness
                <input type="range" min={0} max={1.5} step={0.05} value={look.radius ?? 0.625} onChange={(e) => setLook({ radius: Number(e.target.value) })} className="accent-primary" />
              </label>
              <label className="grid gap-1">
                <span>
                  Text size <span className="text-muted-foreground">({Math.round((look.textScale ?? 1) * 100)}%)</span>
                </span>
                <input type="range" min={0.85} max={1.3} step={0.05} value={look.textScale ?? 1} onChange={(e) => setLook({ textScale: Number(e.target.value) })} className="accent-primary" />
              </label>
            </div>
          )}
          {full && (
            <div className="grid gap-4 rounded-xl border p-4">
              <span className="text-sm font-medium">Every color</span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {EDITABLE.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input
                      type="color"
                      aria-label={`${k} color`}
                      value={look.overrides[k] ?? (getComputedStyle(document.documentElement).getPropertyValue(`--${k}`).trim().match(/^#[0-9a-f]{6}$/i)?.[0] || "#888888")}
                      onChange={(e) => setLook({ overrides: { ...look.overrides, [k]: e.target.value } })}
                      className="size-8 cursor-pointer rounded border"
                    />
                    {k.replace("-", " ")}
                  </label>
                ))}
              </div>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = themeName.trim();
                  if (!name) return;
                  update((s) => ({ ...s, myThemes: [...(s.myThemes ?? []).filter((x) => x.name !== name), { id: crypto.randomUUID(), name, look: { theme: look.theme, overrides: look.overrides, radius: look.radius } }] }));
                  setThemeName("");
                  toast.success(`Saved "${name}" to your themes.`);
                }}
              >
                <Input aria-label="Theme name" placeholder="Name this theme" maxLength={40} value={themeName} onChange={(e) => setThemeName(e.target.value)} className="max-w-56" />
                <Button type="submit" variant="outline" disabled={!themeName.trim()}>
                  <Save /> Save as my theme
                </Button>
              </form>
              <Button variant="ghost" className="justify-self-start" onClick={() => setLook({ overrides: {}, radius: undefined })}>
                Reset theme edits
              </Button>
            </div>
          )}
        </section>

        {full && (
          <section aria-labelledby="type-h" className="grid gap-3">
            <h2 id="type-h" className="text-lg font-semibold">
              Type and messages
            </h2>
            <div role="radiogroup" aria-label="Font" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={(look.font ?? "default") === f.id}
                  onClick={() => setLook({ font: f.id })}
                  className="rounded-xl border p-3 text-left hover:border-primary aria-checked:border-primary aria-checked:ring-2 aria-checked:ring-ring/40"
                >
                  <span aria-hidden className="block text-2xl" style={{ fontFamily: FONT_FAMILY[f.id] }}>
                    Aa
                  </span>
                  <span className="block font-medium">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">{f.note}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-2 text-sm">
              <span className="font-medium">Chat width</span>
              <div role="radiogroup" aria-label="Chat width" className="flex flex-wrap gap-2">
                {(
                  [
                    ["normal", "Normal"],
                    ["wide", "Wide"],
                    ["full", "Full width"],
                  ] as const
                ).map(([id, name]) => (
                  <Button key={id} role="radio" aria-checked={(look.chatWidth ?? "normal") === id} variant={(look.chatWidth ?? "normal") === id ? "secondary" : "outline"} size="sm" onClick={() => setLook({ chatWidth: id })}>
                    {name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 rounded-xl border p-4 text-sm">
              <label className="flex items-center justify-between gap-3">
                Your messages as plain text (no bubbles)
                <Switch checked={look.messages === "plain"} onCheckedChange={(on) => setLook({ messages: on ? "plain" : "bubbles" })} />
              </label>
              <label className="flex items-center justify-between gap-3">
                Calm motion (no animations)
                <Switch checked={look.motion === "calm"} onCheckedChange={(on) => setLook({ motion: on ? "calm" : "full" })} />
              </label>
            </div>
          </section>
        )}

        {more && (
          <section aria-labelledby="bg-h" className="grid gap-3">
            <h2 id="bg-h" className="text-lg font-semibold">
              Background
            </h2>
            <div className="rounded-xl border p-4">
              <BackgroundControls look={look} />
            </div>
          </section>
        )}

        <section aria-labelledby={more ? "layout-h" : undefined} aria-label={more ? undefined : "Reset"} className="grid gap-3">
          {more && (
            <>
              <h2 id="layout-h" className="text-lg font-semibold">
                Layout
              </h2>
              <div className="grid gap-2 rounded-xl border p-4">
                <span className="text-sm font-medium">Sections in the sidebar</span>
                {availableViews
                  .filter((v) => v !== "chat" && v !== "customize")
                  .map((v) => (
                    <label key={v} className="flex items-center justify-between text-sm">
                      {SECTION_LABEL[v]}
                      <Switch checked={!look.hidden.includes(v)} onCheckedChange={(on) => setLook({ hidden: on ? look.hidden.filter((h) => h !== v) : [...look.hidden, v] })} aria-label={`Show ${SECTION_LABEL[v]}`} />
                    </label>
                  ))}
              </div>
              <div className="grid gap-3 rounded-xl border p-4 text-sm">
                <label className="flex items-center justify-between">
                  Sidebar on the right
                  <Switch checked={look.sidebarSide === "right"} onCheckedChange={(on) => setLook({ sidebarSide: on ? "right" : "left" })} />
                </label>
                <label className="flex items-center justify-between">
                  Compact (fits more on screen)
                  <Switch checked={look.density === "compact"} onCheckedChange={(on) => setLook({ density: on ? "compact" : "comfortable" })} />
                </label>
                <label className="flex items-center justify-between">
                  Big message box
                  <Switch checked={look.bigInput} onCheckedChange={(on) => setLook({ bigInput: on })} />
                </label>
              </div>
            </>
          )}
          {full && (
            <div className="grid gap-3 rounded-xl border p-4">
              <span className="text-sm font-medium">Keyboard shortcuts</span>
              <ShortcutInput label="Command palette" value={look.shortcuts.palette} onChange={(v) => setLook({ shortcuts: { ...look.shortcuts, palette: v } })} />
              <ShortcutInput label="New chat" value={look.shortcuts.newChat} onChange={(v) => setLook({ shortcuts: { ...look.shortcuts, newChat: v } })} />
            </div>
          )}
          <Button variant="ghost" className="justify-self-start" onClick={() => update((s) => ({ ...s, look: DEFAULT_LOOK, distroId: undefined }))}>
            Reset everything to default
          </Button>
          {!full && (
            <p className="text-sm text-muted-foreground">
              {level === "simple"
                ? "Want more? Pick More for colors, background and layout, or Full control for every color, fonts and shortcuts."
                : "Want everything? Pick Full control for every color, fonts, message style, motion and shortcuts."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

const FONT_FAMILY: Record<string, string | undefined> = {
  default: undefined,
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
  serif: 'ui-serif, "Iowan Old Style", Georgia, serif',
  mono: "var(--font-geist-mono), ui-monospace, monospace",
};

/** Background: your own picture, GIF or video (kept on this device), how much shows through, colour and an effect. */
function BackgroundControls({ look }: { look: Look }) {
  const b = look.backdrop ?? { blur: 0, hue: 0, saturate: 1, brightness: 1, effect: "none" as const, amount: 1 };
  const setB = (patch: Partial<typeof b>) => setLook({ backdrop: { ...b, ...patch } });
  const [hasFile, setHasFile] = useState(false);
  useEffect(() => {
    const check = () => loadBackdrop().then((f) => setHasFile(!!f));
    check();
    addEventListener(BACKDROP_EVENT, check);
    return () => removeEventListener(BACKDROP_EVENT, check);
  }, []);
  const on = hasFile || !!look.wallpaper || b.effect !== "none";
  const slider = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, shown: string) => (
    <label className="grid gap-1">
      <span className="flex justify-between">
        {label} <span className="tabular-nums text-muted-foreground">{shown}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="accent-primary" />
    </label>
  );
  return (
    <div className="grid gap-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <label>
            <Upload /> Choose picture, GIF or video
            <input
              type="file"
              accept="image/*,video/mp4,video/webm"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > MAX_BACKDROP) return toast.error("Pick a file under 200 MB.");
                await saveBackdrop(f);
                setLook({ wallpaper: undefined });
                dispatchEvent(new Event(BACKDROP_EVENT));
                toast.success("Background set on this device.");
              }}
            />
          </label>
        </Button>
        {desktop() && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const w = await desktop()!.settings.wallpaper();
              if (!w) return toast.error("Couldn't find your desktop wallpaper.");
              await saveBackdrop(new Blob([Uint8Array.from(atob(w.data), (c) => c.charCodeAt(0))], { type: w.type }));
              setLook({ wallpaper: undefined });
              dispatchEvent(new Event(BACKDROP_EVENT));
              toast.success("Using your desktop wallpaper.");
            }}
          >
            Use my desktop wallpaper
          </Button>
        )}
        {(hasFile || look.wallpaper) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await clearBackdrop();
              setLook({ wallpaper: undefined });
              dispatchEvent(new Event(BACKDROP_EVENT));
            }}
          >
            Remove picture
          </Button>
        )}
      </div>
      <div className="grid gap-1">
        <span>Effect</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Background effect">
          {EFFECTS.map((e) => (
            <Button key={e.id} size="sm" variant={b.effect === e.id ? "secondary" : "outline"} role="radio" aria-checked={b.effect === e.id} onClick={() => setB({ effect: e.id })}>
              {e.name}
            </Button>
          ))}
        </div>
      </div>
      {b.effect !== "none" && slider("Effect amount", b.amount, 0.2, 2, 0.1, (v) => setB({ amount: v }), `${Math.round(b.amount * 100)}%`)}
      {on && (
        <div className="grid gap-3 sm:grid-cols-2">
          {slider("Show through the app", 0.95 - look.wallpaperTint, 0, 0.95, 0.05, (v) => setLook({ wallpaperTint: Math.round((0.95 - v) * 100) / 100 }), `${Math.round(((0.95 - look.wallpaperTint) / 0.95) * 100)}%`)}
          {(hasFile || look.wallpaper) && (
            <>
              {slider("Blur", b.blur, 0, 30, 1, (v) => setB({ blur: v }), `${b.blur}px`)}
              {slider("Hue", b.hue, -180, 180, 5, (v) => setB({ hue: v }), `${b.hue}°`)}
              {slider("Color strength", b.saturate, 0, 2, 0.05, (v) => setB({ saturate: v }), `${Math.round(b.saturate * 100)}%`)}
              {slider("Brightness", b.brightness, 0.3, 1.5, 0.05, (v) => setB({ brightness: v }), `${Math.round(b.brightness * 100)}%`)}
            </>
          )}
        </div>
      )}
      {on && (
        <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setLook({ wallpaperTint: 0.6, backdrop: { blur: 0, hue: 0, saturate: 1, brightness: 1, effect: b.effect, amount: 1 } })}>
          Reset background look
        </Button>
      )}
    </div>
  );
}
