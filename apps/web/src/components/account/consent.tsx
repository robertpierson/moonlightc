"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { consentChoice, setConsent } from "@/lib/analytics";
import { accountsEnabled } from "@/lib/supabase/client";

/** Shown only where the law asks for consent (EU/EEA, UK, Switzerland), and only until the person answers. */
export function ConsentPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!accountsEnabled || consentChoice()) return;
    fetch("/api/track")
      .then((r) => r.json())
      .then((d: { consentNeeded?: boolean }) => setShow(!!d.consentNeeded))
      .catch(() => {});
  }, []);
  if (!show) return null;
  const answer = (v: "yes" | "no") => {
    setConsent(v);
    setShow(false);
  };
  return (
    <div role="dialog" aria-label="Usage stats" className="fixed inset-x-3 bottom-3 z-50 mx-auto grid max-w-lg gap-3 rounded-xl border bg-popover p-4 text-sm shadow-lg">
      <p>
        Can MoonlightC count which features you use, to improve the app? Only feature names and counts, never your messages, files or keys.{" "}
        <Link href="/privacy" className="text-link underline underline-offset-4">
          Privacy
        </Link>
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => answer("no")}>
          No thanks
        </Button>
        <Button size="sm" onClick={() => answer("yes")}>
          Allow
        </Button>
      </div>
    </div>
  );
}
