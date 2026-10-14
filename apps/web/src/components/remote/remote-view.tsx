"use client";

import "@xterm/xterm/css/xterm.css";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowDown, ArrowLeft, ArrowUp, Download, FileIcon, Folder, Loader2, Maximize, Minimize, Monitor, Power, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TwoStepGate } from "@/components/account/two-step-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isOnline, joinChannel, RemoteClient, subscribed, TIER_LABELS, type Tier } from "@/lib/remote";
import { supabase } from "@/lib/supabase/client";
import { useDevices } from "./your-computers";

type Tab = "screen" | "terminal" | "files" | "chat";
const ALL: Tier[] = ["view", "control", "files", "terminal", "chat"];

/** Control one of your computers from this device. */
export function RemoteView({ deviceId, onSetup }: { deviceId: string; onSetup: () => void }) {
  const device = useDevices().find((d) => d.id === deviceId);
  const [wanted, setWanted] = useState<Tier[]>(ALL);
  const [client, setClient] = useState<RemoteClient>();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("screen");
  const chRef = useRef<RealtimeChannel | undefined>(undefined);

  const disconnect = async () => {
    await client?.call("disconnect").catch(() => {});
    if (chRef.current) supabase().removeChannel(chRef.current);
    chRef.current = undefined;
    setClient(undefined);
    setTiers([]);
  };
  // Leaving this screen (or closing the tab) ends the session on the PC too, so its orange frame goes away.
  const clientRef = useRef<RemoteClient | undefined>(undefined);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);
  useEffect(() => {
    const end = () => {
      clientRef.current?.call("disconnect").catch(() => {});
      if (chRef.current) supabase().removeChannel(chRef.current);
      chRef.current = undefined;
    };
    addEventListener("pagehide", end);
    return () => {
      removeEventListener("pagehide", end);
      end();
    };
  }, []);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const ch = await joinChannel(deviceId, { key: `client:${crypto.randomUUID()}` });
      const c = new RemoteClient(ch);
      await subscribed(ch);
      chRef.current = ch;
      const r = await c.call<{ allowed: boolean; tiers?: Tier[] }>("connect", { tiers: wanted }, 130_000);
      if (!r.allowed) throw new Error("The person at the PC didn't allow it.");
      setTiers(r.tiers ?? []);
      setClient(c);
      setTab(r.tiers?.includes("view") ? "screen" : r.tiers?.includes("terminal") ? "terminal" : r.tiers?.includes("files") ? "files" : "chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (chRef.current) supabase().removeChannel(chRef.current);
      chRef.current = undefined;
    }
    setBusy(false);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Monitor className="size-5" />
          <h2 className="text-lg font-semibold">{device?.name ?? "Your computer"}</h2>
          {device && <span className="text-sm text-muted-foreground">{isOnline(device) ? "Online" : `Last seen ${new Date(device.last_seen).toLocaleString()}`}</span>}
          {client && (
            <Button size="sm" variant="destructive" className="ml-auto" onClick={disconnect}>
              <Power /> Disconnect
            </Button>
          )}
        </div>
        <TwoStepGate onSetup={onSetup}>
          {!device ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !device.remote_enabled ? (
            <p className="rounded-xl border p-4 text-sm">Remote control is off on this computer. On it, open MoonlightC and go to Settings &gt; Remote control.</p>
          ) : !client ? (
            <div className="grid justify-items-start gap-3 rounded-xl border p-4">
              <p className="text-sm">Choose what this device may do. The person at the computer has to click Allow.</p>
              <div className="grid gap-1.5">
                {ALL.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" checked={wanted.includes(t)} onChange={() => setWanted((w) => (w.includes(t) ? w.filter((x) => x !== t) : [...w, t]))} />
                    {TIER_LABELS[t]}
                  </label>
                ))}
              </div>
              <Button onClick={connect} disabled={busy || !wanted.length}>
                {busy && <Loader2 className="animate-spin" />} {busy ? "Waiting for Allow on the computer…" : "Connect"}
              </Button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              <div role="tablist" aria-label="Remote" className="flex flex-wrap gap-1">
                {(
                  [
                    ["screen", "Screen", "view"],
                    ["terminal", "Terminal", "terminal"],
                    ["files", "Files", "files"],
                    ["chat", "Chat", "chat"],
                  ] as const
                )
                  .filter(([, , t]) => tiers.includes(t))
                  .map(([id, label]) => (
                    <Button key={id} role="tab" aria-selected={tab === id} size="sm" variant={tab === id ? "secondary" : "ghost"} onClick={() => setTab(id)}>
                      {label}
                    </Button>
                  ))}
              </div>
              {tab === "screen" && <Screen client={client} control={tiers.includes("control")} />}
              {tab === "terminal" && <RemoteTerminal client={client} />}
              {tab === "files" && <Files client={client} />}
              {tab === "chat" && <RemoteChat client={client} models={device.local_models} />}
            </div>
          )}
        </TwoStepGate>
      </div>
    </div>
  );
}

function Screen({ client, control }: { client: RemoteClient; control: boolean }) {
  const [frame, setFrame] = useState<{ image: string; width: number; height: number }>();
  // Fullscreen: the browser's own where it works, otherwise the screen fills the window.
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => !document.fullscreenElement && setFull(false);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFull = () => {
    if (full) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setFull(false);
    } else {
      setFull(true);
      box.current?.requestFullscreen?.().catch(() => {});
    }
  };
  const [text, setText] = useState("");
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      while (live) {
        try {
          const f = await client.call<{ image: string; width: number; height: number }>("frame");
          if (live) setFrame(f);
        } catch (e) {
          if (live) toast.error(e instanceof Error ? e.message : String(e));
          await new Promise((r) => setTimeout(r, 2000));
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    })();
    return () => {
      live = false;
    };
  }, [client]);
  const input = (a: Record<string, unknown>) => client.call("input", a).catch((e: Error) => toast.error(e.message));
  const at = (e: React.MouseEvent) => {
    const r = img.current!.getBoundingClientRect();
    return { x: Math.round(((e.clientX - r.left) / r.width) * (frame?.width ?? 1)), y: Math.round(((e.clientY - r.top) / r.height) * (frame?.height ?? 1)) };
  };
  return (
    <div ref={box} className={full ? "fixed inset-0 z-50 grid content-center gap-2 overflow-auto bg-black p-2" : "grid gap-2"}>
      <Button size="sm" variant="secondary" className="justify-self-end" onClick={toggleFull} aria-pressed={full}>
        {full ? <Minimize /> : <Maximize />} {full ? "Exit full screen" : "Full screen"}
      </Button>
      {frame ? (
        // eslint-disable-next-line @next/next/no-img-element -- a live screenshot from your computer
        <img
          ref={img}
          src={`data:image/jpeg;base64,${frame.image}`}
          alt="Your computer's screen"
          className={`rounded-lg border ${full ? "mx-auto max-h-[calc(100dvh-7rem)] w-auto max-w-full" : "w-full"} ${control ? "cursor-crosshair" : ""}`}
          onClick={(e) => control && input({ action: "click", ...at(e) })}
          onDoubleClick={(e) => control && input({ action: "double_click", ...at(e) })}
          onContextMenu={(e) => {
            if (!control) return;
            e.preventDefault();
            input({ action: "right_click", ...at(e) });
          }}
        />
      ) : (
        <div className="grid aspect-video place-items-center rounded-lg border text-sm text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {control && (
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text) input({ action: "type", text });
              setText("");
            }}
          >
            <Input aria-label="Type on the computer" placeholder="Type text, then press Send" value={text} onChange={(e) => setText(e.target.value)} />
            <Button type="submit" variant="outline">
              Send
            </Button>
          </form>
          {["Enter", "Backspace", "Tab", "Escape"].map((k) => (
            <Button key={k} size="sm" variant="outline" onClick={() => input({ action: "key", keys: k.toLowerCase() })}>
              {k}
            </Button>
          ))}
          <Button size="icon-sm" variant="outline" aria-label="Scroll up" onClick={() => input({ action: "scroll", amount: 3 })}>
            <ArrowUp />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Scroll down" onClick={() => input({ action: "scroll", amount: -3 })}>
            <ArrowDown />
          </Button>
        </div>
      )}
    </div>
  );
}

function RemoteTerminal({ client }: { client: RemoteClient }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let termId = "";
    let off = () => {};
    let dispose = () => {};
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      const term = new Terminal({ fontSize: 13, convertEol: false, theme: { background: "#0b0d12" } });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(box.current!);
      fit.fit();
      dispose = () => term.dispose();
      try {
        const r = await client.call<{ termId: string }>("term.open", { cols: term.cols, rows: term.rows });
        termId = r.termId;
        off = client.listenTerminal(termId, (d) => term.write(d));
        term.onData((d) => client.call("term.write", { termId, data: d }).catch(() => {}));
      } catch (e) {
        term.write(`\r\n${e instanceof Error ? e.message : String(e)}\r\n`);
      }
    })();
    return () => {
      off();
      if (termId) client.call("term.close", { termId }).catch(() => {});
      dispose();
    };
  }, [client]);
  return <div ref={box} data-testid="remote-terminal" className="h-[60vh] overflow-hidden rounded-lg border bg-[#0b0d12] p-2" />;
}

function Files({ client }: { client: RemoteClient }) {
  const [listing, setListing] = useState<{ path: string; parent: string | null; entries: { name: string; dir: boolean; size?: number }[] }>();
  const [busy, setBusy] = useState(false);
  const open = (dir?: string) =>
    client
      .call<typeof listing>("files.list", { dir })
      .then(setListing)
      .catch((e: Error) => toast.error(e.message));
  useEffect(() => {
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load the home folder once per connection
  }, [client]);
  const download = async (name: string) => {
    setBusy(true);
    try {
      const f = await client.call<{ name: string; data: string }>("files.read", { path: `${listing!.path}/${name}` }, 120_000);
      const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes]));
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {listing?.parent && (
          <Button size="sm" variant="ghost" onClick={() => open(listing.parent!)}>
            <ArrowLeft /> Up
          </Button>
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{listing?.path}</span>
        <Button size="sm" variant="outline" asChild disabled={busy}>
          <label>
            <Upload /> Upload here
            <input
              type="file"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f || !listing) return;
                if (f.size > 10 * 1024 * 1024) return toast.error("Files over 10 MB can't be sent yet.");
                const data = btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer())));
                client
                  .call("files.write", { dir: listing.path, name: f.name, data }, 120_000)
                  .then(() => (toast.success(`${f.name} saved on your computer.`), open(listing.path)))
                  .catch((err: Error) => toast.error(err.message));
              }}
            />
          </label>
        </Button>
      </div>
      <ul className="divide-y rounded-lg border">
        {listing?.entries.map((e) => (
          <li key={e.name}>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => (e.dir ? open(`${listing.path}/${e.name}`) : download(e.name))}>
              {e.dir ? <Folder className="size-4" /> : <FileIcon className="size-4" />}
              <span className="flex-1 truncate">{e.name}</span>
              {!e.dir && (
                <>
                  <span className="text-xs text-muted-foreground">{e.size !== undefined ? `${Math.max(1, Math.round(e.size / 1024))} KB` : ""}</span>
                  <Download className="size-4 text-muted-foreground" />
                </>
              )}
            </button>
          </li>
        ))}
        {listing && !listing.entries.length && <li className="p-3 text-sm text-muted-foreground">Empty folder.</li>}
      </ul>
    </div>
  );
}

function RemoteChat({ client, models }: { client: RemoteClient; models: string[] }) {
  const [model, setModel] = useState(models[0] ?? "");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  if (!models.length) return <p className="text-sm text-muted-foreground">This computer has no local AI models yet. On it, open Settings &gt; Local models and download one.</p>;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      // Listen before asking, so no words are missed.
      const reqId = await new Promise<string>((resolve, reject) => {
        const id = crypto.randomUUID();
        const off = client.listenChat(id, (c) => {
          if (c.delta) setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: m[m.length - 1].content + c.delta }]);
          if (c.error) toast.error(c.error);
          if (c.done) {
            off();
            setBusy(false);
          }
        });
        client.call("chat", { model, messages: next, reqId: id }, 30_000).then(() => resolve(id), reject);
      });
      void reqId;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-3">
      <select aria-label="Model on your computer" className="h-9 w-fit rounded-lg border bg-transparent px-2 text-sm" value={model} onChange={(e) => setModel(e.target.value)}>
        {models.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <div className="grid gap-2">
        {messages.map((m, i) => (
          <p key={i} className={m.role === "user" ? "justify-self-end rounded-2xl bg-muted px-3 py-2 text-sm" : "text-sm whitespace-pre-wrap"}>
            {m.content || (busy && i === messages.length - 1 ? "…" : "")}
          </p>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <Input aria-label="Message your computer's model" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the model on your computer" />
        <Button type="submit" disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
