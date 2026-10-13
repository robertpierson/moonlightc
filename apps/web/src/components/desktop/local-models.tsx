"use client";

import { Check, Download, Loader2, MessageSquare, Pause, Play, Power, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import catalog from "@/data/model-catalog.json";
import { desktop, type Hardware, type OllamaStatus } from "@/lib/desktop";
import { listLocal, pull, remove, syncOllamaConnection, type LocalModel } from "@/lib/ollama";
import { update, useStore } from "@/lib/store";
import { verdict } from "@/lib/verdict";

// Downloads live outside React so they keep going when you switch views.
interface Job {
  pct: number;
  status: string;
  state: "running" | "paused" | "error";
  ctrl?: AbortController;
  error?: string;
}
const jobs = new Map<string, Job>();
const subs = new Set<() => void>();
let snapshot = new Map(jobs);
const emit = () => {
  snapshot = new Map(jobs);
  subs.forEach((f) => f());
};
const useJobs = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => snapshot, () => snapshot);

async function startJob(name: string, onDone: () => void) {
  const ctrl = new AbortController();
  jobs.set(name, { pct: jobs.get(name)?.pct ?? 0, status: "Starting", state: "running", ctrl });
  emit();
  try {
    await pull(name, (pct, status) => {
      jobs.set(name, { ...jobs.get(name)!, pct: pct || jobs.get(name)!.pct, status });
      emit();
    }, ctrl.signal);
    jobs.delete(name);
    emit();
    toast.success(`${name} is ready. Pick it in the model menu.`);
    onDone();
  } catch (e) {
    if (ctrl.signal.aborted) jobs.set(name, { ...jobs.get(name)!, state: "paused", status: "Paused" });
    else jobs.set(name, { ...jobs.get(name)!, state: "error", error: e instanceof Error ? e.message : String(e) });
    emit();
  }
}

const VERDICT_LABEL = { great: "Runs great", slow: "Runs slowly", "wont-fit": "Won't fit" } as const;
const VERDICT_STYLE = { great: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", slow: "bg-amber-500/15 text-amber-800 dark:text-amber-300", "wont-fit": "bg-destructive/15 text-destructive" } as const;

function DownloadButton({ name, installed, onDone }: { name: string; installed: boolean; onDone: () => void }) {
  const job = useJobs().get(name);
  if (installed) return <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Check className="size-4" /> Installed</span>;
  if (!job) return <Button size="sm" onClick={() => startJob(name, onDone)}><Download /> Download</Button>;
  return (
    <div className="grid w-full gap-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Downloading ${name}`} aria-valuenow={job.pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-primary transition-[width]" style={{ width: `${job.pct}%` }} />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex-1 truncate">{job.state === "error" ? job.error : `${job.pct}% · ${job.status}`}</span>
        {job.state === "running" ? (
          <Button size="xs" variant="outline" onClick={() => job.ctrl?.abort()}><Pause /> Pause</Button>
        ) : (
          <Button size="xs" variant="outline" onClick={() => startJob(name, onDone)}><Play /> {job.state === "error" ? "Retry" : "Resume"}</Button>
        )}
      </div>
    </div>
  );
}

function OtherServers() {
  const connections = useStore((s) => s.connections);
  const [servers, setServers] = useState<{ id: string; name: string; baseURL: string }[]>([]);
  useEffect(() => {
    fetch("/api/local-servers")
      .then((r) => r.json())
      .then((d) => setServers(d.servers ?? []))
      .catch(() => {});
  }, []);
  const connect = async (s: { name: string; baseURL: string }) => {
    const res = await fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerId: "custom", apiKey: "", baseURL: s.baseURL }) });
    const d = (await res.json()) as { models?: { id: string; name: string }[]; error?: string };
    if (!res.ok || !d.models?.length) return toast.error(d.error ?? `${s.name} has no models loaded. Load one in ${s.name}, then try again.`);
    update((st) => ({ ...st, connections: [...st.connections, { id: crypto.randomUUID(), providerId: "custom", apiKey: "", baseURL: s.baseURL, label: s.name, models: d.models!, addedAt: Date.now() }] }));
    toast.success(`${s.name} connected: ${d.models.length} models.`);
  };
  const fresh = servers.filter((s) => !connections.some((c) => c.baseURL === s.baseURL));
  if (!fresh.length) return null;
  return (
    <section aria-label="Other local servers" className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
      {fresh.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <span>{s.name} is running on this computer.</span>
          <Button size="sm" variant="outline" onClick={() => connect(s)}>
            Use its models
          </Button>
        </div>
      ))}
    </section>
  );
}

export function LocalModels({ onChat }: { onChat: () => void }) {
  const bridge = desktop()!;
  const [status, setStatus] = useState<OllamaStatus>();
  const [hw, setHw] = useState<Hardware>();
  const [local, setLocal] = useState<LocalModel[]>([]);
  const [installing, setInstalling] = useState<{ pct: number; stage: string }>();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [hf, setHf] = useState<{ id: string; downloads: number; likes: number }[]>();

  const refresh = useCallback(async () => {
    const s = await bridge.ollama.status();
    setStatus(s);
    if (s.running) {
      setLocal(await listLocal().catch(() => []));
      await syncOllamaConnection().catch(() => {});
    }
  }, [bridge]);

  useEffect(() => {
    queueMicrotask(refresh); // refresh sets state after awaiting, never synchronously
    bridge.hardware().then(setHw);
  }, [bridge, refresh]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    const res = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(q.trim())}&filter=gguf&sort=downloads&limit=20`).catch(() => null);
    if (!res?.ok) return toast.error("Couldn't reach Hugging Face. Check your internet connection.");
    setHf(await res.json());
  };

  const installedNames = new Set(local.map((m) => m.name));
  const isInstalled = (tag: string) => installedNames.has(tag) || installedNames.has(`${tag}:latest`);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6">
        <section aria-labelledby="ollama-h" className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
          <div className="min-w-0 flex-1">
            <h2 id="ollama-h" className="text-lg font-semibold">Local models</h2>
            <p className="text-sm text-muted-foreground">
              {!status ? "Checking Ollama…" : status.running ? `Ollama ${status.version ?? ""} is running. Local models work with no internet.` : status.installed ? "Ollama is installed but stopped." : "Local models run through Ollama, a free engine. MoonlightC installs and runs it for you."}
            </p>
            {hw && (
              <p className="mt-1 text-xs text-muted-foreground">
                This computer: {hw.ramGB} GB memory{hw.gpus.length ? `, ${hw.gpus.map((g) => `${g.model}${g.vramGB ? ` (${g.vramGB} GB)` : ""}`).join(", ")}` : ", no dedicated GPU"}, {hw.freeDiskGB} GB free disk.
              </p>
            )}
          </div>
          {installing ? (
            <div className="grid w-64 gap-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${installing.pct}%` }} /></div>
              <span className="text-xs text-muted-foreground">{installing.stage}…</span>
            </div>
          ) : status && !status.installed ? (
            <Button
              disabled={busy}
              onClick={() =>
                act(async () => {
                  setInstalling({ pct: 0, stage: "Starting" });
                  try {
                    await bridge.ollama.install((pct, stage) => setInstalling({ pct, stage }));
                  } finally {
                    setInstalling(undefined);
                  }
                })
              }
            >
              <Download /> Install Ollama
            </Button>
          ) : status && !status.running ? (
            <Button disabled={busy} onClick={() => act(bridge.ollama.start)}>
              {busy ? <Loader2 className="animate-spin" /> : <Power />} Start Ollama
            </Button>
          ) : null}
        </section>

        <OtherServers />

        {status?.running && (
          <>
            <section aria-labelledby="installed-h">
              <h3 id="installed-h" className="mb-3 font-semibold">On this computer</h3>
              {local.length === 0 ? (
                <p className="text-sm text-muted-foreground">No models yet. Download one below; smaller ones start faster.</p>
              ) : (
                <ul aria-label="Installed models" className="divide-y rounded-xl border">
                  {local.map((m) => (
                    <li key={m.name} className="flex items-center gap-2 p-3 text-sm">
                      <span className="flex-1 truncate font-medium">{m.name}</span>
                      <span className="text-muted-foreground">{(m.size / 1e9).toFixed(1)} GB</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          update((s) => ({ ...s, lastModel: { connectionId: "ollama-local", modelId: m.name } }));
                          onChat();
                        }}
                      >
                        <MessageSquare /> Chat
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${m.name}`}
                        onClick={() => confirm(`Delete ${m.name} from this computer? You can download it again later.`) && act(() => remove(m.name))}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="store-h">
              <h3 id="store-h" className="mb-3 font-semibold">Model Store</h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catalog.models.map((m) => {
                  const v = hw && verdict(m.sizeGB, hw);
                  return (
                    <li key={m.tag} className="flex flex-col gap-2 rounded-xl border p-4">
                      <div className="flex items-start gap-2">
                        <span className="flex-1 font-medium">{m.name}</span>
                        {v && <Badge className={VERDICT_STYLE[v.verdict]} title={v.reason}>{VERDICT_LABEL[v.verdict]}</Badge>}
                      </div>
                      <p className="flex-1 text-sm text-muted-foreground">{m.goodAt}</p>
                      <p className="text-xs text-muted-foreground">{m.sizeGB} GB · {m.license}{v ? ` · ${v.reason}` : ""}</p>
                      <DownloadButton name={m.tag} installed={isInstalled(m.tag)} onDone={refresh} />
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="hf-h">
              <h3 id="hf-h" className="mb-1 font-semibold">Search Hugging Face</h3>
              <p className="mb-3 text-sm text-muted-foreground">Thousands of GGUF models. Ollama downloads the recommended size of each.</p>
              <form onSubmit={search} className="flex gap-2">
                <Input aria-label="Search Hugging Face models" placeholder="For example: llama, qwen coder, mistral" value={q} onChange={(e) => setQ(e.target.value)} />
                <Button type="submit" variant="outline"><Search /> Search</Button>
              </form>
              {hf && (
                <ul aria-label="Hugging Face results" className="mt-3 divide-y rounded-xl border">
                  {hf.length === 0 && <li className="p-3 text-sm text-muted-foreground">No GGUF models match.</li>}
                  {hf.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{r.id}</span>
                      <span className="text-xs text-muted-foreground">{r.downloads.toLocaleString()} downloads</span>
                      <div className="w-full sm:w-72">
                        <DownloadButton name={`hf.co/${r.id}`} installed={isInstalled(`hf.co/${r.id}`)} onDone={refresh} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
