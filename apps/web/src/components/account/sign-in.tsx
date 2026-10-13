"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { desktop } from "@/lib/desktop";
import { SUPABASE_URL, supabase } from "@/lib/supabase/client";
import { authRedirect, destinationAfterSignIn, friendlyAuthError, handleAuthLink, SITE_URL } from "@/lib/supabase/auth";

type Provider = "google" | "github" | "apple" | "discord" | "azure";
const PROVIDERS: { id: Provider; name: string }[] = [
  { id: "google", name: "Google" },
  { id: "github", name: "GitHub" },
  { id: "apple", name: "Apple" },
  { id: "discord", name: "Discord" },
  { id: "azure", name: "Microsoft" },
];
type Step = "signin" | "signup" | "forgot" | "magic";

const noop = () => () => {};

export function SignIn() {
  // The address bar (return path, errors) only exists in the browser, so render after mount.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <Form /> : null;
}

function Form() {
  const [enabled, setEnabled] = useState<Provider[]>([]);
  const [step, setStep] = useState<Step>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => new URLSearchParams(location.search).get("error") ?? "");
  const [notice, setNotice] = useState("");
  const [next] = useState(() => new URLSearchParams(location.search).get("next"));

  useEffect(() => {
    // Only show the sign-in buttons this project actually has turned on.
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } })
      .then((r) => r.json())
      .then((d: { external?: Record<string, boolean> }) => setEnabled(PROVIDERS.filter((p) => d.external?.[p.id]).map((p) => p.id)))
      .catch(() => {});
    return desktop()?.onDeepLink((url) => void handleAuthLink(url));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(friendlyAuthError(e instanceof Error ? e.message : String(e)));
    }
    setBusy(false);
  };

  const oauth = (provider: Provider) =>
    run(async () => {
      const b = desktop();
      const { data, error } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo: authRedirect(next ?? undefined), skipBrowserRedirect: !!b } });
      if (error) throw error;
      if (b && data.url) {
        await b.openExternal(data.url);
        setNotice("Finish signing in in your browser. MoonlightC opens again when you're done.");
      }
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supabase().auth;
    run(async () => {
      if (step === "signin") {
        const { error } = await sb.signInWithPassword({ email, password });
        if (error) throw error;
        location.assign(await destinationAfterSignIn(next));
      } else if (step === "signup") {
        const { data, error } = await sb.signUp({ email, password, options: { emailRedirectTo: authRedirect("/onboarding") } });
        if (error) throw error;
        if (data.session) location.assign(await destinationAfterSignIn(next));
        else setNotice(`We sent a confirmation link to ${email}. Open it to finish creating your account.`);
      } else if (step === "forgot") {
        // Password resets always finish on the website, even from the desktop app.
        const redirectTo = `${desktop() ? SITE_URL : location.origin}/auth/callback?next=/auth/reset`;
        const { error } = await sb.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        setNotice(`If ${email} has an account, a link to set a new password is on its way.`);
      } else {
        const { error } = await sb.signInWithOtp({ email, options: { emailRedirectTo: authRedirect(next ?? undefined) } });
        if (error) throw error;
        setNotice(`We sent a sign-in link to ${email}. Open it on this device.`);
      }
    });
  };

  const resend = () =>
    run(async () => {
      const { error } = await supabase().auth.resend({ type: "signup", email, options: { emailRedirectTo: authRedirect("/onboarding") } });
      if (error) throw error;
      setNotice(`Sent a new confirmation link to ${email}.`);
    });

  const title = { signin: "Sign in to MoonlightC", signup: "Create your account", forgot: "Reset your password", magic: "Email me a sign-in link" }[step];
  const action = { signin: "Sign in", signup: "Create account", forgot: "Send reset link", magic: "Send link" }[step];

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="grid w-full max-w-sm gap-5">
        <div className="grid gap-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">An account keeps your chats and settings in sync across your devices. MoonlightC also works without one.</p>
        </div>

        {(step === "signin" || step === "signup") && enabled.length > 0 && (
          <div className="grid gap-2">
            {PROVIDERS.filter((p) => enabled.includes(p.id)).map((p) => (
              <Button key={p.id} variant="outline" disabled={busy} onClick={() => oauth(p.id)}>
                Continue with {p.name}
              </Button>
            ))}
            <p className="text-center text-xs text-muted-foreground">or use your email</p>
          </div>
        )}

        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {(step === "signin" || step === "signup") && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {step === "signin" && (
                  <button type="button" className="text-xs text-link underline underline-offset-4" onClick={() => setStep("forgot")}>
                    Forgot password?
                  </button>
                )}
              </div>
              <Input id="password" type="password" autoComplete={step === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {action}
          </Button>
        </form>

        {error && (
          <div role="alert" className="grid gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
            {/confirm your email/i.test(error) && (
              <Button size="sm" variant="outline" onClick={resend} disabled={busy || !email}>
                Resend confirmation
              </Button>
            )}
          </div>
        )}
        {notice && (
          <p role="status" className="rounded-md bg-muted p-3 text-sm">
            {notice}
          </p>
        )}

        <div className="grid gap-1 text-center text-sm">
          {step === "signin" ? (
            <>
              <button className="text-link underline underline-offset-4" onClick={() => setStep("signup")}>
                New here? Create an account
              </button>
              <button className="text-link underline underline-offset-4" onClick={() => setStep("magic")}>
                Email me a sign-in link instead
              </button>
            </>
          ) : (
            <button className="text-link underline underline-offset-4" onClick={() => setStep("signin")}>
              Back to sign in
            </button>
          )}
          <Link href="/app" className="mt-2 text-muted-foreground underline underline-offset-4">
            Keep using MoonlightC without an account
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">
            By continuing you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-4">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>
            . You must be 13 or older.
          </p>
        </div>
      </div>
    </main>
  );
}
