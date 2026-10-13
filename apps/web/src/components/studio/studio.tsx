"use client";

import { STUDIO_PROVIDERS, type MediaKind, type MediaModel } from "@moonc/core";
import { ChevronsUpDown, Download, ImagePlus, KeyRound, Loader2, MessageSquare, Shuffle, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addItem, removeItem, useGallery, type GalleryItem } from "@/lib/gallery";
import { useStore, type SavedConnection } from "@/lib/store";

const KINDS: { id: MediaKind; label: string }[] = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "speech", label: "Voice" },
];
const RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

const conn = (c: SavedConnection) => ({ providerId: c.providerId, apiKey: c.apiKey, baseURL: c.baseURL });

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

const b64ToBlob = (b64: string, type: string) => new Blob([Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))], { type });
const fileToDataURL = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

function ModelSelect({ models, value, onChange, loading }: { models: MediaModel[]; value: string; onChange: (id: string) => void; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const current = models.find((m) => m.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label="Studio model" className="w-full justify-between font-normal" disabled={loading || models.length === 0}>
          <span className="truncate">{loading ? "Loading models…" : (current?.name ?? (models.length ? "Choose a model" : "No models for this key"))}</span>
          {loading ? <Loader2 className="animate-spin" /> : <ChevronsUpDown className="opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,28rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models…" />
          <CommandList className="max-h-[50dvh]">
            <CommandEmpty>No model matches.</CommandEmpty>
            {models.map((m) => (
              <CommandItem key={m.id} value={`${m.name} ${m.id}`} onSelect={() => (onChange(m.id), setOpen(false))}>
                <div className="min-w-0">
                  <div className="truncate">{m.name}</div>
                  {m.description && <div className="truncate text-xs text-muted-foreground">{m.description}</div>}
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function download(g: GalleryItem) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(g.blob);
  a.download = `moonlightc-${g.kind}-${g.id.slice(0, 8)}.${g.mediaType.split("/")[1]?.split(";")[0] ?? "bin"}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Preview({ item, className }: { item: GalleryItem; className?: string }) {
  const url = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  if (item.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={item.prompt} className={className} />;
  }
  if (item.kind === "video") return <video src={url} controls playsInline className={className} aria-label={item.prompt} />;
  return <audio src={url} controls className="w-full" aria-label={item.prompt} />;
}

export function Studio({ onOpenKeys, onSendToChat }: { onOpenKeys: () => void; onSendToChat: (item: GalleryItem) => void }) {
  const connections = useStore((s) => s.connections);
  const gallery = useGallery();
  const [kind, setKind] = useState<MediaKind>("image");
  const usable = connections.filter((c) => STUDIO_PROVIDERS.find((p) => p.id === c.providerId)?.kinds.includes(kind));
  const [connId, setConnId] = useState<string>();
  const current = usable.find((c) => c.id === connId) ?? usable[0];
  const [models, setModels] = useState<MediaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [voice, setVoice] = useState("");
  const [startImage, setStartImage] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [result, setResult] = useState<GalleryItem>();
  const [filter, setFilter] = useState<MediaKind | "all">("all");
  const cancelled = useRef(false);

  const currentKey = current ? `${current.id}:${kind}` : "";
  useEffect(() => {
    if (!current) return;
    let stale = false;
    queueMicrotask(() => setLoadingModels(true));
    post<{ models: MediaModel[] }>("/api/studio/models", { connection: conn(current), kind })
      .then((d) => {
        if (stale) return;
        setModels(d.models);
        setModelId((m) => (d.models.some((x) => x.id === m) ? m : (d.models[0]?.id ?? "")));
      })
      .catch((e: Error) => !stale && (toast.error(e.message), setModels([])))
      .finally(() => !stale && setLoadingModels(false));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !modelId || !prompt.trim()) return;
    cancelled.current = false;
    setResult(undefined);
    const base = { connection: conn(current), kind, modelId, prompt, aspectRatio: kind === "speech" ? undefined : ratio };
    try {
      let blob: Blob;
      let mediaType: string;
      let seed: number | undefined;
      if (kind === "video") {
        setBusy("Starting the video…");
        const { operation } = await post<{ operation: unknown }>("/api/studio/video", { ...base, image: startImage });
        const started = Date.now();
        for (;;) {
          if (cancelled.current) return setBusy(undefined);
          await new Promise((r) => setTimeout(r, 5000));
          setBusy(`Making your video… ${Math.round((Date.now() - started) / 1000)}s (videos usually take 1–5 minutes)`);
          const s = await post<{ status: string; url?: string; base64?: string; mediaType?: string; error?: string }>("/api/studio/video", { ...base, action: "status", operation });
          if (s.status === "failed") throw new Error(s.error);
          if (s.status !== "completed") continue;
          mediaType = s.mediaType ?? "video/mp4";
          if (s.base64) blob = b64ToBlob(s.base64, mediaType);
          else {
            setBusy("Downloading the video…");
            const r = await fetch(s.url!);
            if (!r.ok) throw new Error("The video finished but couldn't be downloaded. Try again.");
            blob = await r.blob();
          }
          break;
        }
      } else {
        setBusy(kind === "image" ? "Painting…" : "Recording the voice…");
        const d = await post<{ base64: string; mediaType: string; meta?: Record<string, { seed?: number }> | null }>("/api/studio/generate", { ...base, voice: voice || undefined });
        mediaType = d.mediaType;
        blob = b64ToBlob(d.base64, mediaType);
        seed = Object.values(d.meta ?? {}).find((m) => typeof m?.seed === "number")?.seed;
      }
      const item: GalleryItem = { id: crypto.randomUUID(), kind, prompt, providerId: current.providerId, modelId, mediaType: mediaType!, blob: blob!, seed, createdAt: Date.now() };
      await addItem(item);
      setResult(item);
      toast.success("Saved to your gallery.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(undefined);
    }
  }

  const remix = (item: GalleryItem) => {
    setKind(item.kind);
    setPrompt(item.prompt);
    const c = connections.find((x) => x.providerId === item.providerId);
    if (c) setConnId(c.id);
    setModelId(item.modelId);
    scrollTo({ top: 0, behavior: "smooth" });
  };

  const shown = gallery.filter((g) => filter === "all" || g.kind === filter);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6">
        <section aria-labelledby="studio-h" className="grid gap-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="studio-h" className="mr-auto text-lg font-semibold">Studio</h2>
            <div role="tablist" aria-label="Media type" className="flex rounded-lg bg-muted p-0.5">
              {KINDS.map((k) => (
                <Button key={k.id} role="tab" aria-selected={kind === k.id} size="sm" variant={kind === k.id ? "secondary" : "ghost"} onClick={() => setKind(k.id)}>
                  {k.label}
                </Button>
              ))}
            </div>
          </div>

          {usable.length === 0 ? (
            <div className="grid justify-items-start gap-3 py-4">
              <p className="text-sm text-muted-foreground">
                {kind === "image" && "Images work with a fal, OpenAI, Google, xAI or Replicate key."}
                {kind === "video" && "Video works with a fal, xAI or Replicate key. fal includes Veo, Kling, Luma and more."}
                {kind === "speech" && "Voices work with a fal, OpenAI or ElevenLabs key."}
              </p>
              <Button onClick={onOpenKeys}>
                <KeyRound /> Add a key
              </Button>
            </div>
          ) : (
            <form onSubmit={generate} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="studio-provider">Provider</Label>
                  <Select value={current?.id} onValueChange={setConnId}>
                    <SelectTrigger id="studio-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {usable.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Model</Label>
                  <ModelSelect models={models} value={modelId} onChange={setModelId} loading={loadingModels} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="studio-prompt">{kind === "speech" ? "Text to speak" : "Describe what you want"}</Label>
                <Textarea id="studio-prompt" className="min-h-24" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={kind === "speech" ? "Hello! This is my new voice." : "A lighthouse on a cliff under a full moon, oil painting"} />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {kind !== "speech" ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="studio-ratio">Shape</Label>
                    <Select value={ratio} onValueChange={setRatio}>
                      <SelectTrigger id="studio-ratio" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RATIOS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <Label htmlFor="studio-voice">Voice (optional)</Label>
                    <Input id="studio-voice" className="w-56" value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="Provider's voice name or ID" />
                  </div>
                )}
                {kind === "video" && (
                  <div className="grid gap-1.5">
                    <Label>Start from an image (optional)</Label>
                    {startImage ? (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={startImage} alt="Start frame" className="size-9 rounded object-cover" />
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove start image" onClick={() => setStartImage(undefined)}>
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" asChild>
                        <label>
                          <ImagePlus /> Choose image
                          <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files?.[0] && setStartImage(await fileToDataURL(e.target.files[0]))} />
                        </label>
                      </Button>
                    )}
                  </div>
                )}
                <div className="ml-auto flex gap-2">
                  {busy && kind === "video" && (
                    <Button type="button" variant="ghost" onClick={() => (cancelled.current = true)}>
                      Stop waiting
                    </Button>
                  )}
                  <Button type="submit" disabled={!!busy || !modelId || !prompt.trim()}>
                    {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate
                  </Button>
                </div>
              </div>
              {busy && (
                <p role="status" className="text-sm text-muted-foreground">
                  {busy}
                </p>
              )}
            </form>
          )}
          {result && <Preview item={result} className="max-h-[60dvh] w-full rounded-lg object-contain" />}
        </section>

        <section aria-labelledby="gallery-h">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 id="gallery-h" className="mr-auto font-semibold">
              Gallery
            </h3>
            {(["all", "image", "video", "speech"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "speech" ? "Voice" : f[0].toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everything you make is saved here on this device.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((g) => (
                <li key={g.id} className="flex flex-col gap-2 rounded-xl border p-3">
                  <Preview item={g} className="aspect-square w-full rounded-lg bg-muted object-cover" />
                  <p className="line-clamp-2 text-sm">{g.prompt}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.modelId}
                    {g.seed !== undefined ? ` · seed ${g.seed}` : ""} · {new Date(g.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1">
                    <Button size="xs" variant="outline" onClick={() => remix(g)}>
                      <Shuffle /> Remix
                    </Button>
                    {g.kind === "image" && (
                      <Button size="xs" variant="outline" onClick={() => onSendToChat(g)}>
                        <MessageSquare /> Send to chat
                      </Button>
                    )}
                    <Button size="xs" variant="outline" onClick={() => download(g)}>
                      <Download /> Download
                    </Button>
                    <Button size="icon-xs" variant="ghost" aria-label="Delete from gallery" onClick={() => removeItem(g.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
