"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

// Accounts are optional: everything works on this device without one. Account features appear only when this build
// has a Supabase project configured.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const accountsEnabled = !!(SUPABASE_URL && KEY);

let client: SupabaseClient | undefined;
export function supabase(): SupabaseClient {
  if (!accountsEnabled) throw new Error("Accounts aren't set up on this server.");
  client ??= createBrowserClient(SUPABASE_URL, KEY);
  return client;
}

/** The signed-in user, or null when signed out (undefined while loading). */
export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(accountsEnabled ? undefined : null);
  useEffect(() => {
    if (!accountsEnabled) return;
    const sb = supabase();
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}

/** Only same-site paths are allowed as a place to return to after signing in. */
export function safeNext(next: string | null | undefined, fallback = "/app") {
  return next && /^\/(?![/\\])/.test(next) ? next : fallback;
}
