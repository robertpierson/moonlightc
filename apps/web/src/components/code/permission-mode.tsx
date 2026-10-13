"use client";

import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { update, useStore } from "@/lib/store";

type Mode = "ask" | "auto" | "plan" | "bypass";
const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "ask", label: "Ask before changes", note: "You apply or reject every change." },
  { id: "auto", label: "Auto-accept edits", note: "Changes apply right away (you can undo)." },
  { id: "plan", label: "Plan only", note: "The AI explains what it would change; nothing changes." },
  { id: "bypass", label: "Bypass permissions", note: "Edits apply and connector tools run without asking." },
];

/** Like Claude Code's permission modes, for the code assistant. */
export function PermissionMode() {
  const mode = useStore((s) => s.codePermission) ?? "auto";
  const [confirm, setConfirm] = useState(false);
  const set = (m: Mode) => update((s) => ({ ...s, codePermission: m }));
  return (
    <>
      <Select value={mode} onValueChange={(v) => (v === "bypass" ? setConfirm(true) : set(v as Mode))}>
        <SelectTrigger size="sm" aria-label="Permission mode" className={`h-8 w-auto gap-1 ${mode === "bypass" ? "border-destructive text-destructive" : ""}`}>
          {mode === "bypass" && <ShieldAlert className="size-4" />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {MODES.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="grid">
                <span>{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.note}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bypass permissions?</DialogTitle>
            <DialogDescription>
              The code assistant will change files and use connector tools (for example deploying on Vercel or changing a Supabase database) without asking you first. Tools you set to &quot;never&quot; stay blocked, and file changes can still be undone. Only use this for projects you&apos;re happy to let it run on its own.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                set("bypass");
                setConfirm(false);
              }}
            >
              Bypass permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
