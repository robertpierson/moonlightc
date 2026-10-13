"use client";

import { useEffect } from "react";
import { startSync } from "@/lib/sync-supabase";
import { useUser } from "@/lib/supabase/client";

/** Keeps chats, settings and keys in sync while someone is signed in. Renders nothing. */
export function SyncRunner() {
  const user = useUser();
  const id = user?.id;
  useEffect(() => (id ? startSync(id) : undefined), [id]);
  return null;
}
