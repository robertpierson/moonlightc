import { z } from "zod";

export const VIEWS = ["chat", "studio", "connections", "models", "terminal", "projects", "customize"] as const;
export type ViewId = (typeof VIEWS)[number];

export const THEMES = [
  { id: "moonlight", name: "Moonlight", note: "Follows light or dark mode" },
  { id: "silver", name: "Silver", note: "Metallic glass" },
  { id: "graphite", name: "Graphite", note: "Neutral dark" },
  { id: "midnight", name: "Midnight", note: "Deep blue dark" },
  { id: "paper", name: "Paper", note: "Warm light" },
  { id: "contrast", name: "High contrast", note: "Maximum legibility" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];
const DARK_THEMES: ThemeId[] = ["graphite", "midnight", "contrast"];
export const themeMode = (t: ThemeId): "dark" | "light" | undefined => (t === "moonlight" ? undefined : DARK_THEMES.includes(t) ? "dark" : "light");

/** Tokens the theme editor can change. */
export const EDITABLE = ["background", "foreground", "card", "primary", "primary-foreground", "accent", "border", "sidebar"] as const;

const shortcut = z.string().regex(/^(mod\+)?(shift\+)?(alt\+)?[a-z0-9/.,;]$/).max(20);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const wallpaper = z
  .string()
  .max(2_000_000)
  .regex(/^(https:\/\/[^\s"'()]+|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/);

export const LookSchema = z.object({
  theme: z.enum(THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]]),
  overrides: z.partialRecord(z.enum(EDITABLE), color).default({}),
  radius: z.number().min(0).max(1.5).optional(),
  wallpaper: wallpaper.optional(),
  wallpaperTint: z.number().min(0).max(0.95).default(0.6),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  bigInput: z.boolean().default(false),
  hidden: z.array(z.enum(VIEWS)).default([]),
  sidebarSide: z.enum(["left", "right"]).default("left"),
  shortcuts: z.object({ palette: shortcut, newChat: shortcut }).default({ palette: "mod+k", newChat: "mod+shift+o" }),
});
export type Look = z.infer<typeof LookSchema>;

export const DistroSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(40),
  description: z.string().max(200).default(""),
  look: LookSchema,
  defaultModeId: z.string().max(64).optional(),
  onlyLocal: z.boolean().default(false),
});
export type Distro = z.infer<typeof DistroSchema>;

export const DEFAULT_LOOK: Look = LookSchema.parse({ theme: "moonlight" });

const all: ViewId[] = [...VIEWS];
const except = (...keep: ViewId[]) => all.filter((v) => !keep.includes(v) && v !== "customize");

export const DISTROS: Distro[] = [
  { id: "moon", name: "Moon", description: "Just chat, with a big input. Nothing else in the way.", look: { ...DEFAULT_LOOK, bigInput: true, hidden: except("chat") }, onlyLocal: false },
  { id: "studio", name: "Studio", description: "For making images, video and voices.", look: { ...DEFAULT_LOOK, theme: "midnight", hidden: except("chat", "studio") }, onlyLocal: false },
  { id: "forge", name: "Forge", description: "For coding: chat, terminals, projects and connections.", look: { ...DEFAULT_LOOK, theme: "graphite", hidden: except("chat", "terminal", "projects", "connections", "models") }, defaultModeId: "coder", onlyLocal: false },
  { id: "command", name: "Command", description: "Everything on, dense layout.", look: { ...DEFAULT_LOOK, density: "compact", hidden: [] }, onlyLocal: false },
  { id: "offline", name: "Offline", description: "Local models only. Works with no internet.", look: { ...DEFAULT_LOOK, theme: "paper", hidden: except("chat", "models", "terminal") }, onlyLocal: true },
];

/** Shareable link payload (base64url JSON). Everything is validated before it's offered to the user. */
export function encodeDistro(d: Distro) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeDistro(s: string): Distro {
  const json = decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  return DistroSchema.parse(JSON.parse(json));
}

/** "mod" = Ctrl on Windows/Linux, Cmd on Mac. */
export function matchShortcut(e: KeyboardEvent, spec: string) {
  const parts = spec.split("+");
  const key = parts[parts.length - 1];
  return (
    e.key.toLowerCase() === key &&
    parts.includes("mod") === (e.ctrlKey || e.metaKey) &&
    parts.includes("shift") === e.shiftKey &&
    parts.includes("alt") === e.altKey
  );
}

export function shortcutFromEvent(e: KeyboardEvent): string | undefined {
  if (["control", "meta", "shift", "alt"].includes(e.key.toLowerCase()) || e.key.length !== 1) return undefined;
  return [(e.ctrlKey || e.metaKey) && "mod", e.shiftKey && "shift", e.altKey && "alt", e.key.toLowerCase()].filter(Boolean).join("+");
}

export const prettyShortcut = (s: string, mac: boolean) => s.replace("mod", mac ? "⌘" : "Ctrl").replace("shift", "Shift").replace("alt", mac ? "⌥" : "Alt").replace(/\+(.)$/, (_, k: string) => `+${k.toUpperCase()}`);
