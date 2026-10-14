"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { hasUnsavedChanges, onNudge, revertEdits, saveEdits, useStore } from "@/lib/store";

/** Discord-style bar: shows while Settings has unsaved changes; shakes if you try to leave without choosing. */
export function SaveBar() {
  const dirty = useStore(() => hasUnsavedChanges());
  const [shake, setShake] = useState(0);
  useEffect(
    () =>
      onNudge(() => {
        setShake((n) => n + 1);
      }),
    [],
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);
  if (!dirty) return null;
  return (
    <div className="pointer-events-none sticky bottom-0 z-20 flex justify-center px-3 pb-3">
      <div
        key={shake}
        role="region"
        aria-label="Unsaved changes"
        className={`pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-xl border bg-popover px-4 py-3 text-sm shadow-lg motion-safe:animate-[savebar-in_.18s_ease-out] ${shake ? "motion-safe:animate-[savebar-shake_.4s_ease-in-out] border-destructive" : ""}`}
      >
        <span className="flex-1 font-medium">{shake ? "Careful — you have unsaved changes!" : "You have unsaved changes"}</span>
        <Button variant="ghost" size="sm" onClick={revertEdits}>
          Reset
        </Button>
        <Button size="sm" onClick={saveEdits}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
