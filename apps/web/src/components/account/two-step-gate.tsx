"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canReachPcs } from "@/lib/remote";
import { accountsEnabled, supabase, useUser } from "@/lib/supabase/client";

// For PC features (quick), the security level decides: password only, the code, or a code from the last 15 minutes.
async function levelNow(quick?: boolean) {
  const { data } = await supabase().auth.mfa.getAuthenticatorAssuranceLevel();
  const next = data?.nextLevel ?? undefined;
  if (!quick) return { current: data?.currentLevel ?? undefined, next };
  return { current: (await canReachPcs()) ? "aal2" : undefined, next };
}

/** Shows its children only when this session is signed in with two-step sign-in; otherwise helps get there. */
export function TwoStepGate({ children, onSetup, what = "Remote control", quick }: { children: React.ReactNode; onSetup: () => void; what?: string; quick?: boolean }) {
  const user = useUser();
  const [level, setLevel] = useState<{ current?: string; next?: string }>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const check = useCallback(() => levelNow(quick).then(setLevel), [quick]);
  useEffect(() => {
    if (!user) return;
    let live = true;
    levelNow(quick).then((l) => live && setLevel(l));
    return () => {
      live = false;
    };
  }, [user, quick]);

  if (!accountsEnabled) return <p className="text-sm text-muted-foreground">{what} needs accounts, which aren&apos;t set up on this server.</p>;
  if (user === undefined || (user && !level)) return <Loader2 className="size-4 animate-spin" aria-label="Checking your sign-in" />;
  if (!user)
    return (
      <div className="grid justify-items-start gap-2 rounded-xl border p-4 text-sm">
        <p>{what} works between devices signed in to the same account.</p>
        <Button asChild>
          <Link href="/signin?next=/app">Sign in</Link>
        </Button>
      </div>
    );
  if (level?.current === "aal2") return <>{children}</>;
  if (level?.next === "aal2")
    return (
      <form
        className="grid justify-items-start gap-2 rounded-xl border p-4 text-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const { data } = await supabase().auth.mfa.listFactors();
          const factor = data?.totp.find((f) => f.status === "verified");
          const r = factor ? await supabase().auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() }) : { error: new Error("No authenticator set up.") };
          setBusy(false);
          if (r.error) return setError("That code didn't match. Use the newest code from your authenticator app.");
          setCode("");
          check();
        }}
      >
        <p className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="size-4" /> Enter your two-step code to use {what.toLowerCase()}
        </p>
        <div className="flex gap-2">
          <Input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="w-32" />
          <Button type="submit" disabled={busy || code.trim().length !== 6}>
            {busy && <Loader2 className="animate-spin" />} Unlock
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </form>
    );
  return (
    <div className="grid justify-items-start gap-2 rounded-xl border p-4 text-sm">
      <p>For safety, {what.toLowerCase()} needs two-step sign-in (a code from an authenticator app) on your account.</p>
      <Button onClick={onSetup}>Set up two-step sign-in</Button>
    </div>
  );
}
