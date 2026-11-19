"use client";

// Community: things people make (themes, modes, commands, setups, mods) and share for anyone to add. Everything that
// comes from the library is checked again here before it touches your settings, and mods still go through the
// install review (their code runs in the sealed sandbox, see lib/mods.ts).
import { ModManifestSchema, validateManifest } from "@moonc/mods-sdk";
import { z } from "zod";
import { validName, type MyCommand } from "./commands";
import { DistroSchema, LookSchema } from "./customize";
import type { InstalledMod } from "./mods";
import { update, type Mode } from "./store";
import { supabase } from "./supabase/client";

export const KINDS = [
  { id: "theme", name: "Themes", one: "theme", note: "Colors and corners for the whole app" },
  { id: "mode", name: "Modes", one: "mode", note: "How the AI talks and what it focuses on" },
  { id: "command", name: "Commands", one: "command", note: "A / shortcut that fills in a prompt" },
  { id: "setup", name: "Setups", one: "setup", note: "Theme, layout and which sections show" },
  { id: "mod", name: "Mods", one: "mod", note: "A bundle, with AI tools if you like" },
] as const;
export type Kind = (typeof KINDS)[number]["id"];

const ThemeLook = LookSchema.pick({ theme: true, overrides: true, radius: true });
export const PayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("theme"), look: ThemeLook }),
  z.object({ kind: z.literal("mode"), mode: z.object({ instructions: z.string().min(1).max(8000), temperature: z.number().min(0).max(2).optional() }) }),
  z.object({ kind: z.literal("command"), command: z.object({ name: z.string().refine(validName, "Command names are lowercase letters, numbers or dashes."), prompt: z.string().min(1).max(4000) }) }),
  // Shared setups never carry a picture background (it's yours, and too big).
  z.object({ kind: z.literal("setup"), distro: DistroSchema.omit({ id: true }).extend({ look: LookSchema.omit({ wallpaper: true }) }) }),
  z.object({ kind: z.literal("mod"), manifest: ModManifestSchema, code: z.string().max(200_000).optional() }),
]);
export type Payload = z.infer<typeof PayloadSchema>;

export type Creation = { id: string; author: string; author_name: string; kind: Kind; name: string; description: string; installs: number; created_at: string; payload: Payload };

/** Browse: newest or most added, one kind or all, matching a search. Mod code isn't loaded until you add one. */
export async function browse({ kind, q, sort }: { kind?: Kind; q?: string; sort: "popular" | "new" }) {
  let query = supabase()
    .from("creations")
    .select("id, author, author_name, kind, name, description, installs, created_at, look:payload->look, mode:payload->mode, command:payload->command, distro:payload->distro, manifest:payload->manifest")
    .order(sort === "popular" ? "installs" : "created_at", { ascending: false })
    .limit(60);
  if (kind) query = query.eq("kind", kind);
  const term = q?.trim().replace(/[%_,()]/g, " ").slice(0, 60);
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error("Couldn't load the library. Check your connection and try again.");
  return (data ?? []).flatMap((r) => {
    const { look, mode, command, distro, manifest, ...rest } = r as Record<string, unknown>;
    const p = PayloadSchema.safeParse({ kind: rest.kind, look, mode, command, distro, manifest });
    return p.success ? [{ ...(rest as Omit<Creation, "payload">), payload: p.data }] : [];
  });
}

export async function mine() {
  const { data: u } = await supabase().auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase().from("creations").select("id, author, author_name, kind, name, description, installs, created_at, payload").eq("author", u.user.id).order("created_at", { ascending: false });
  return (data ?? []) as Creation[];
}

export async function publish(c: { kind: Kind; name: string; description: string; author_name: string; payload: Payload }) {
  const payload = PayloadSchema.parse(c.payload);
  const { data, error } = await supabase()
    .from("creations")
    .insert({ kind: c.kind, name: c.name.trim().slice(0, 60), description: c.description.trim().slice(0, 300), author_name: c.author_name.trim().slice(0, 40) || "Someone", payload })
    .select("id")
    .single();
  if (error) throw new Error(/a lot of sharing/.test(error.message) ? error.message : /JWT|auth|permission/i.test(error.message) ? "Sign in to share." : "Couldn't share it. Try again.");
  return data.id as string;
}

export async function unshare(id: string) {
  const { error } = await supabase().from("creations").delete().eq("id", id);
  if (error) throw new Error("Couldn't remove it. Try again.");
}

export async function report(id: string, why: string) {
  const { error } = await supabase().rpc("report_creation", { c: id, why });
  if (error) throw new Error(/Sign in/.test(error.message) ? "Sign in to report." : "Couldn't send the report.");
}

/** The whole thing, code included (mods), checked again. */
async function full(id: string): Promise<Payload> {
  const { data, error } = await supabase().from("creations").select("payload").eq("id", id).single();
  if (error || !data) throw new Error("That one isn't in the library any more.");
  return PayloadSchema.parse(data.payload);
}

/** A mod from the library, ready for the install review. */
export async function modFor(c: Creation): Promise<InstalledMod> {
  const p = await full(c.id);
  if (p.kind !== "mod") throw new Error("That isn't a mod.");
  if (p.manifest.script && !p.code) throw new Error("That mod is missing its code.");
  return { manifest: validateManifest(p.manifest), code: p.code, source: `community:${c.id}`, enabled: true, installedAt: Date.now() };
}

const localId = (c: Pick<Creation, "id">) => `c-${c.id.replace(/-/g, "").slice(0, 20)}`;

/** Add a theme, mode, command or setup to your own (mods go through modFor + the review instead). */
export function add(c: Creation) {
  const p = PayloadSchema.parse(c.payload);
  const id = localId(c);
  if (p.kind === "theme") update((s) => ({ ...s, myThemes: [...(s.myThemes ?? []).filter((t) => t.id !== id), { id, name: c.name, look: p.look }] }));
  if (p.kind === "mode") {
    const m: Mode = { id, name: c.name.slice(0, 40), instructions: p.mode.instructions, temperature: p.mode.temperature };
    update((s) => ({ ...s, modes: [...s.modes.filter((x) => x.id !== id), m] }));
  }
  if (p.kind === "command") {
    const cmd: MyCommand = p.command;
    update((s) => ({ ...s, myCommands: [...(s.myCommands ?? []).filter((x) => x.name !== cmd.name), cmd] }));
  }
  if (p.kind === "setup") update((s) => ({ ...s, customDistros: [...(s.customDistros ?? []).filter((d) => d.id !== id), { ...p.distro, id, name: c.name.slice(0, 40), onlyLocal: p.distro.onlyLocal ?? false }] }));
  void supabase().rpc("count_install", { c: c.id });
  return id;
}

export const countInstall = (id: string) => void supabase().rpc("count_install", { c: id });
