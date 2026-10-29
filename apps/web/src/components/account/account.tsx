"use client";

import type { Factor, UserIdentity } from "@supabase/supabase-js";
import { Download, Loader2, LogOut, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { syncNow, useSyncStatus } from "@/lib/sync-supabase";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authRedirect } from "@/lib/supabase/auth";
import { SUPABASE_URL, supabase, useUser } from "@/lib/supabase/client";
import { desktop } from "@/lib/desktop";
import { forgetRelay, iceServers, noRelayReason, SECURITY_LEVELS } from "@/lib/remote";
import { resetState } from "@/lib/store";

const NAMES: Record<string, string> = { google: "Google", github: "GitHub", apple: "Apple", discord: "Discord", azure: "Microsoft", email: "Email and password" };
const LINKABLE = ["google", "github", "apple", "discord", "azure"] as const;

/** Settings > Account. Only shown when this server has accounts set up. */
export function AccountPanel() {
  const user = useUser();
  if (user === undefined) return <p className="text-sm text-muted-foreground">Loading your account…</p>;
  if (!user)
    return (
      <div className="grid justify-items-start gap-3 rounded-xl border p-4 text-sm">
        <p>Sign in to keep your chats and settings in sync on all your devices. MoonlightC keeps working without an account.</p>
        <Button asChild>
          <Link href="/signin?next=/app">Sign in or create an account</Link>
        </Button>
      </div>
    );
  return (
    <div className="grid gap-6">
      <p className="text-sm">
        Signed in as <strong>{user.email ?? user.phone ?? "you"}</strong>
      </p>
      <SyncStatus />
      <Identities />
      <TwoStep />
      <SecurityLevel />
      <RelayKey />
      <Data />
    </div>
  );
}

function SyncStatus() {
  const s = useSyncStatus();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
      <RefreshCw className={`size-4 ${s.running ? "animate-spin" : ""}`} />
      <span className="flex-1">
        {s.error ? `Sync problem: ${s.error}` : s.at ? `Chats, settings and keys synced ${new Date(s.at).toLocaleTimeString()}` : "Syncing your chats, settings and keys…"}
      </span>
      <Button size="sm" variant="outline" disabled={s.running} onClick={() => syncNow()}>
        Sync now
      </Button>
    </div>
  );
}

function Identities() {
  const [ids, setIds] = useState<UserIdentity[]>([]);
  const [enabled, setEnabled] = useState<(typeof LINKABLE)[number][]>([]);
  const load = useCallback(() => {
    supabase()
      .auth.getUserIdentities()
      .then(({ data }) => setIds(data?.identities ?? []));
  }, []);
  useEffect(() => {
    load();
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } })
      .then((r) => r.json())
      .then((d: { external?: Record<string, boolean> }) => setEnabled(LINKABLE.filter((p) => d.external?.[p])))
      .catch(() => {});
  }, [load]);
  const unlink = async (i: UserIdentity) => {
    const { error } = await supabase().auth.unlinkIdentity(i);
    if (error) toast.error(error.message);
    else {
      toast(`${NAMES[i.provider] ?? i.provider} unlinked.`);
      load();
    }
  };
  const link = async (provider: (typeof LINKABLE)[number]) => {
    const { error } = await supabase().auth.linkIdentity({ provider, options: { redirectTo: authRedirect("/app") } });
    if (error) toast.error(/manual linking/i.test(error.message) ? "Linking accounts isn't switched on for this server yet." : error.message);
  };
  const missing = enabled.filter((p) => !ids.some((i) => i.provider === p));
  return (
    <section aria-labelledby="ids-h" className="grid gap-2">
      <h3 id="ids-h" className="font-medium">
        Ways to sign in
      </h3>
      <p className="text-sm text-muted-foreground">Signing in with any of these opens this same account. Accounts with the same verified email join up automatically.</p>
      <ul className="divide-y rounded-lg border">
        {ids.map((i) => (
          <li key={i.identity_id} className="flex items-center gap-2 p-2 pl-3 text-sm">
            <span className="flex-1">
              {NAMES[i.provider] ?? i.provider}
              {typeof i.identity_data?.email === "string" && <span className="text-muted-foreground"> · {i.identity_data.email}</span>}
            </span>
            <Button size="sm" variant="ghost" disabled={ids.length < 2} onClick={() => unlink(i)} title={ids.length < 2 ? "You need at least one way to sign in." : undefined}>
              Unlink
            </Button>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {missing.map((p) => (
            <Button key={p} size="sm" variant="outline" onClick={() => link(p)}>
              Link {NAMES[p]}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}

function TwoStep() {
  const [factors, setFactors] = useState<Factor[]>();
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string }>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    supabase()
      .auth.mfa.listFactors()
      .then(({ data }) => setFactors(data?.totp ?? []));
  }, []);
  useEffect(load, [load]);
  const verified = factors?.find((f) => f.status === "verified");

  const start = async () => {
    setBusy(true);
    // Clear half-finished setups first; Supabase allows only a few.
    for (const f of factors ?? []) if (f.status !== "verified") await supabase().auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase().auth.mfa.enroll({ factorType: "totp", friendlyName: `MoonlightC ${new Date().toLocaleDateString()}` });
    setBusy(false);
    if (error) return toast.error(error.message);
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    setBusy(false);
    if (error) return toast.error("That code didn't match. Check the time on your phone and try the newest code.");
    setEnroll(undefined);
    setCode("");
    toast.success("Two-step sign-in is on.");
    load();
  };
  const off = async () => {
    const { error } = await supabase().auth.mfa.unenroll({ factorId: verified!.id });
    if (error) toast.error(/aal2/i.test(error.message) ? "Sign out and back in with your code first, then turn it off." : error.message);
    else {
      toast("Two-step sign-in is off.");
      load();
    }
  };

  return (
    <section aria-labelledby="mfa-h" className="grid gap-2">
      <h3 id="mfa-h" className="font-medium">
        Two-step sign-in
      </h3>
      <p className="text-sm text-muted-foreground">After your password or Google sign-in, also enter a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…). Required before you can control your computers remotely.</p>
      {factors === undefined ? null : verified ? (
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4" /> On
          <Button size="sm" variant="ghost" onClick={off}>
            Turn off
          </Button>
        </div>
      ) : enroll ? (
        <form onSubmit={confirm} className="grid justify-items-start gap-3 rounded-lg border p-3">
          <p className="text-sm">Scan this with your authenticator app, then type the 6-digit code it shows.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- an SVG QR code from Supabase */}
          <img src={enroll.qr} alt="QR code for your authenticator app" className="size-44 rounded bg-white p-2" />
          <p className="text-xs text-muted-foreground">
            Can&apos;t scan? Enter this key instead: <code className="break-all">{enroll.secret}</code>
          </p>
          <div className="flex gap-2">
            <Input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="w-32" />
            <Button type="submit" disabled={busy || code.trim().length !== 6}>
              {busy && <Loader2 className="animate-spin" />} Turn on
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" className="justify-self-start" onClick={start} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Set up two-step sign-in
        </Button>
      )}
    </section>
  );
}

/** How much of a sign-in reaching your PCs needs. Lowering it asks for the two-step code; raising never does. */
function SecurityLevel() {
  const [level, setLevel] = useState<number>();
  const [want, setWant] = useState<number>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase()
      .rpc("security_level")
      .then(({ data }) => setLevel(typeof data === "number" ? data : 2));
  }, []);
  const save = async (l: number) => {
    setBusy(true);
    const { error } = await supabase().rpc("set_security_level", { l });
    setBusy(false);
    if (error && /two-step/.test(error.message)) return setWant(l);
    if (error) return toast.error(error.message);
    setLevel(l);
    setWant(undefined);
    toast.success(`Security level: ${SECURITY_LEVELS[l].name}.`);
  };
  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data } = await supabase().auth.mfa.listFactors();
    const factor = data?.totp.find((f) => f.status === "verified");
    const r = factor ? await supabase().auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() }) : { error: new Error("none") };
    setBusy(false);
    setCode("");
    if (r.error) return toast.error(factor ? "That code didn't match. Use the newest code from your authenticator app." : "Set up two-step sign-in above first.");
    if (want !== undefined) await save(want);
  };
  if (level === undefined) return null;
  return (
    <section aria-labelledby="level-h" className="grid gap-2">
      <h3 id="level-h" className="font-medium">
        Security level for your PCs
      </h3>
      <p className="text-sm text-muted-foreground">How much someone needs to reach your PCs from another device. Lowering it needs your two-step code; raising it doesn&apos;t.</p>
      <div role="radiogroup" aria-labelledby="level-h" className="grid gap-1.5">
        {SECURITY_LEVELS.map((l, i) => (
          <label key={l.name} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${level === i ? "border-primary" : ""}`}>
            <input type="radio" name="security-level" className="mt-1" checked={level === i} disabled={busy} onChange={() => save(i)} />
            <span>
              <span className="font-medium">{l.name}</span>
              <span className="block text-muted-foreground">{l.about}</span>
            </span>
          </label>
        ))}
      </div>
      {want !== undefined && (
        <form onSubmit={unlock} className="grid justify-items-start gap-2 rounded-lg border p-3 text-sm">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-4" /> Enter your two-step code to lower the level to {SECURITY_LEVELS[want].name}.
          </p>
          <div className="flex gap-2">
            <Input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="w-32" />
            <Button type="submit" disabled={busy || code.trim().length !== 6}>
              {busy && <Loader2 className="animate-spin" />} Confirm
            </Button>
            <Button type="button" variant="ghost" onClick={() => setWant(undefined)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Remote control on networks that block direct video: each person's own free Cloudflare relay key. */
function RelayKey() {
  const [saved, setSaved] = useState<string | null>();
  const [owner, setOwner] = useState(false);
  const [id, setId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const sb = supabase();
    sb.rpc("my_relay_key_id").then(({ data }) => setSaved((data as string | null) ?? null));
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const p = await sb.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
      setOwner(!!p.data?.is_admin);
    });
  }, []);
  if (saved === undefined) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().rpc("set_relay_key", { key_id: id.trim().toLowerCase(), token: token.trim().toLowerCase() });
    setBusy(false);
    if (error) return toast.error(error.message);
    forgetRelay();
    setSaved(id.trim().toLowerCase());
    setId("");
    setToken("");
    toast.success("Relay saved. Remote control now works on networks that block live video.");
  };
  return (
    <section aria-labelledby="relay-h" className="grid gap-2">
      <h3 id="relay-h" className="font-medium">
        Relay for networks that block live video
      </h3>
      <p className="text-sm text-muted-foreground">
        Some networks (often school or work Wi-Fi) block the direct connection to your PC, so remote control falls back to slow pictures. A relay fixes that. It&apos;s free from Cloudflare (1,000 GB a month, about 300 hours of remote control) and only used when the direct connection is blocked.
        {owner && !saved && " As the owner, you already use MoonlightC's relay; add your own key only if you want."}
      </p>
      {saved ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-emerald-600">Your relay key is saved (…{saved.slice(-6)}).</span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              const { error } = await supabase().rpc("clear_relay_key");
              if (error) return toast.error(error.message);
              forgetRelay();
              setSaved(null);
            }}
          >
            Remove
          </Button>
        </div>
      ) : (
        <>
          <ol className="list-decimal pl-5 text-sm text-muted-foreground">
            <li>
              Make a free account at{" "}
              <a className="underline" href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noreferrer">
                dash.cloudflare.com
              </a>
              .
            </li>
            <li>In the left menu: Realtime, then TURN Server, then Create (any name).</li>
            <li>Copy the Turn Token ID and the API Token into the boxes below.</li>
          </ol>
          <form onSubmit={save} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input aria-label="Turn Token ID" placeholder="Turn Token ID" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" />
            <Input aria-label="API Token" placeholder="API Token" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            <Button type="submit" disabled={busy || !id.trim() || !token.trim()}>
              Save
            </Button>
          </form>
        </>
      )}
      {(saved || owner) && (
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              forgetRelay();
              const relays = (await iceServers()).flatMap((x) => [x.urls].flat()).filter((u) => u.startsWith("turn")).length;
              setBusy(false);
              if (relays) toast.success(`Relay works: Cloudflare gave ${relays} relay routes.`);
              else toast.error(`No relay: ${noRelayReason() || "unknown reason"}`);
            }}
          >
            Test relay
          </Button>
        </div>
      )}
    </section>
  );
}

function Data() {
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const exportData = async () => {
    const { data, error } = await supabase().rpc("export_my_data");
    if (error) return toast.error(error.message);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `moonlightc-account-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const remove = async () => {
    setBusy(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return toast.error(d.error ?? "Couldn't delete the account. Try again.");
    await supabase().auth.signOut();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload clears the signed-in state everywhere
    location.assign("/");
  };
  return (
    <section aria-labelledby="data-h" className="grid gap-2">
      <h3 id="data-h" className="font-medium">
        Your account data
      </h3>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={exportData}>
          <Download /> Download my account data
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await supabase().auth.signOut();
            // This browser forgets your name, picture, chats and keys (they're in your account and come back when you
            // sign in). The desktop app keeps its copy: it's your own PC and holds its remote-control settings.
            if (!desktop()) {
              resetState();
              Object.keys(localStorage).filter((k) => k.startsWith("moonc:sync:")).forEach((k) => localStorage.removeItem(k));
            }
            location.reload();
          }}
        >
          <LogOut /> Sign out
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setConfirm(true)}>
          <Trash2 /> Delete my account
        </Button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>This permanently deletes your account and everything synced to it. Chats and keys stored only on this device stay here. Type DELETE to confirm.</DialogDescription>
          </DialogHeader>
          <Input aria-label="Type DELETE to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={typed !== "DELETE" || busy} onClick={remove}>
              {busy && <Loader2 className="animate-spin" />} Delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
