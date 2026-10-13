"use client";

import { MousePointerClick, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { desktop, type ComputerState } from "@/lib/desktop";

type Entry = Awaited<ReturnType<NonNullable<ReturnType<typeof desktop>>["computer"]["audit"]>>[number];

export function ComputerActivityLog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    if (open) desktop()?.computer.audit().then(setEntries);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Computer use activity</DialogTitle>
          <DialogDescription>Every session and step the AI took on this PC. Typed text isn&apos;t recorded, only how long it was.</DialogDescription>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="grid gap-1 font-mono text-xs" aria-label="Activity">
            {entries.map((e, i) => (
              <li key={i}>
                {new Date(e.at).toLocaleString()} · {e.action}
                {Object.entries(e)
                  .filter(([k, v]) => !["at", "action", "session"].includes(k) && v !== undefined && v !== null)
                  .map(([k, v]) => ` · ${k}: ${String(v)}`)
                  .join("")}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Always-visible notice in the app while the AI controls this PC, with a Stop button. */
export function ComputerBanner() {
  const [state, setState] = useState<ComputerState>({ active: false });
  const [log, setLog] = useState(false);
  useEffect(() => {
    const b = desktop();
    if (!b) return;
    b.computer.status().then(setState);
    return b.computer.onState(setState);
  }, []);
  if (!desktop()) return null;
  return (
    <>
      {state.active && (
        <div role="status" className="flex flex-wrap items-center gap-2 border-b border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          <MousePointerClick className="size-4" />
          <span className="min-w-0 flex-1 truncate">
            The AI is using this PC: {state.task}. It stops by itself at {new Date(state.endsAt).toLocaleTimeString()}.
          </span>
          <Button size="sm" variant="ghost" onClick={() => setLog(true)}>
            <ScrollText /> Activity
          </Button>
          <Button size="sm" variant="destructive" onClick={() => desktop()?.computer.stop()}>
            Stop
          </Button>
        </div>
      )}
      <ComputerActivityLog open={log} onOpenChange={setLog} />
    </>
  );
}
