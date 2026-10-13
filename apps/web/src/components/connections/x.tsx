"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { update, useStore } from "@/lib/store";

/** X (Twitter): the API is paid, so people bring their own bearer token. */
export function XCard() {
  const x = useStore((s) => s.xToken);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/x-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: token.trim() }) }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (!res?.ok) return setError(d?.error ?? "Couldn't check that token.");
    update((s) => ({ ...s, xToken: { token: token.trim(), enabled: true } }));
    setToken("");
    toast.success("X connected. The AI can search recent posts.");
  };

  return (
    <section aria-label="X (Twitter)" className="grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">X (Twitter)</span>
        <span className="text-sm text-muted-foreground">Search recent posts</span>
        <span className="flex-1" />
        {x && (
          <>
            <label className="flex items-center gap-2 text-sm">
              Use in chats <Switch checked={x.enabled} onCheckedChange={(v) => update((s) => ({ ...s, xToken: { ...s.xToken!, enabled: v } }))} />
            </label>
            <Button size="sm" variant="ghost" onClick={() => update((s) => ({ ...s, xToken: undefined }))}>
              Remove
            </Button>
          </>
        )}
      </div>
      {!x && (
        <form onSubmit={save} className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            X charges for its API, so you use your own: create an app in the{" "}
            <a className="text-link underline underline-offset-4" href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noreferrer">
              X developer portal <ExternalLink className="inline size-3" />
            </a>{" "}
            and paste its Bearer Token.
          </p>
          <div className="flex gap-2">
            <Input type="password" aria-label="X bearer token" autoComplete="off" required value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
            <Button type="submit" variant="outline" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Check and connect
            </Button>
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
