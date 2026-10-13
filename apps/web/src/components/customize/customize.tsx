"use client";

import { Check, Download, Link2, Save, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { applyDistro, setLook, useLook } from "./look";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_LOOK,
  DistroSchema,
  DISTROS,
  EDITABLE,
  encodeDistro,
  prettyShortcut,
  shortcutFromEvent,
  THEMES,
  type Distro,
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
        <section aria-labelledby="distros-h" className="grid gap-3">
          <div>
            <h2 id="distros-h" className="text-lg font-semibold">Distros</h2>
            <p className="text-sm text-muted-foreground">One click sets the theme, layout and which sections you see. Change anything afterwards.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...DISTROS, ...custom].map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => applyDistro(d)}
                  aria-pressed={distroId === d.id}
                  className="flex h-full w-full flex-col gap-1 rounded-xl border p-4 text-left hover:border-primary aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-ring/40"
                >
                  <span className="flex items-center gap-2 font-medium">
                    {d.name} {distroId === d.id && <Check className="size-4 text-link" />}
                  </span>
                  <span className="text-sm text-muted-foreground">{d.description || "Your saved setup."}</span>
                </button>
              </li>
            ))}
          </ul>
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
        </section>

        <section aria-labelledby="themes-h" className="grid gap-3">
          <h2 id="themes-h" className="text-lg font-semibold">Theme</h2>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={look.theme === t.id}
                onClick={() => setLook({ theme: t.id, overrides: {} })}
                className="rounded-xl border p-3 text-left aria-checked:border-primary aria-checked:ring-2 aria-checked:ring-ring/40"
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.note}</div>
              </button>
            ))}
          </div>
          {myThemes.length > 0 && (
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
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">Theme editor</summary>
            <div className="mt-3 grid gap-4">
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
              <label className="grid gap-1 text-sm">
                Corner roundness
                <input type="range" min={0} max={1.5} step={0.05} value={look.radius ?? 0.625} onChange={(e) => setLook({ radius: Number(e.target.value) })} className="accent-primary" />
              </label>
              <div className="grid gap-2 text-sm">
                <span>Wallpaper</span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <label>
                      <Upload /> Choose image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 1_400_000) return toast.error("Pick an image under 1.4 MB.");
                          const r = new FileReader();
                          r.onload = () => setLook({ wallpaper: r.result as string });
                          r.readAsDataURL(f);
                        }}
                      />
                    </label>
                  </Button>
                  {look.wallpaper && (
                    <Button size="sm" variant="ghost" onClick={() => setLook({ wallpaper: undefined })}>
                      Remove wallpaper
                    </Button>
                  )}
                </div>
                {look.wallpaper && (
                  <label className="grid gap-1">
                    Readability tint
                    <input type="range" min={0} max={0.95} step={0.05} value={look.wallpaperTint} onChange={(e) => setLook({ wallpaperTint: Number(e.target.value) })} className="accent-primary" />
                  </label>
                )}
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
              <Button variant="ghost" className="justify-self-start" onClick={() => setLook({ overrides: {}, radius: undefined, wallpaper: undefined })}>
                Reset theme edits
              </Button>
            </div>
          </details>
        </section>

        <section aria-labelledby="layout-h" className="grid gap-3">
          <h2 id="layout-h" className="text-lg font-semibold">Layout</h2>
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
          <div className="grid gap-3 rounded-xl border p-4">
            <span className="text-sm font-medium">Keyboard shortcuts</span>
            <ShortcutInput label="Command palette" value={look.shortcuts.palette} onChange={(v) => setLook({ shortcuts: { ...look.shortcuts, palette: v } })} />
            <ShortcutInput label="New chat" value={look.shortcuts.newChat} onChange={(v) => setLook({ shortcuts: { ...look.shortcuts, newChat: v } })} />
          </div>
          <Button variant="ghost" className="justify-self-start" onClick={() => update((s) => ({ ...s, look: DEFAULT_LOOK, distroId: undefined }))}>
            Reset everything to default
          </Button>
        </section>
      </div>
    </div>
  );
}

