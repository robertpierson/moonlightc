"use client";

import { desktop } from "@/lib/desktop";
import { safeNext, supabase } from "./client";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moonlightc.vercel.app";

/** Where Supabase sends people back after an email link or provider sign-in. */
export function authRedirect(next = "/app") {
  // The desktop app signs in with PKCE: the link opens the app, which holds the matching secret.
  if (desktop()) return "moonlightc://auth";
  return `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** After signing in: first-timers go to onboarding, everyone else to where they were headed. */
export async function destinationAfterSignIn(next?: string | null) {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return "/signin";
  const { data } = await sb.from("profiles").select("onboarded_at").eq("id", auth.user.id).maybeSingle();
  const to = safeNext(next);
  return data?.onboarded_at ? to : `/onboarding?next=${encodeURIComponent(to)}`;
}

/** Finishes a desktop sign-in from a moonlightc://auth?code=… link. Returns false for other links. */
export async function handleAuthLink(url: string) {
  if (!url.startsWith("moonlightc://auth")) return false;
  const u = new URL(url);
  const code = u.searchParams.get("code");
  const error = u.searchParams.get("error_description") ?? u.searchParams.get("error");
  if (error || !code) {
    location.assign(`/signin?error=${encodeURIComponent(error ?? "That sign-in link didn't work. Try again.")}`);
    return true;
  }
  const { error: ex } = await supabase().auth.exchangeCodeForSession(code);
  if (ex) location.assign(`/signin?error=${encodeURIComponent("That sign-in link expired or was already used. Sign in again.")}`);
  else location.assign(await destinationAfterSignIn());
  return true;
}

const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, "That email and password don't match. Check them, or use “Forgot password?” to set a new one."],
  [/email not confirmed/i, "Confirm your email first: open the link we sent you. Can't find it? Use “Resend confirmation”."],
  [/user already registered/i, "There's already an account with this email. Sign in instead, or reset your password."],
  [/password should be at least|weak password/i, "Pick a longer password: at least 8 characters, mixing letters and numbers."],
  [/rate limit|too many/i, "Too many tries in a short time. Wait a minute and try again."],
  [/signups not allowed/i, "New sign-ups are turned off right now."],
  [/unable to validate email|invalid email/i, "That doesn't look like an email address."],
];

/** Turns Supabase's error text into a sentence that says what to do next. */
export function friendlyAuthError(message: string) {
  return MESSAGES.find(([re]) => re.test(message))?.[1] ?? message;
}
