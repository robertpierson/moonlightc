"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEMPLATES, type CodeProject, type Template } from "@/lib/code";
import { saveProject } from "@/lib/code-store";

/** The "new code project" dialog (used by the Code sidebar and the empty Code screen). */
export function NewProject({ open, onOpenChange, onCreate, folder }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (p: CodeProject) => void; folder?: string }) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<Template>("react");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New code project</DialogTitle>
          <DialogDescription>Describe what you want afterwards; the AI writes the code and you see it run.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const p: CodeProject = { id: crypto.randomUUID(), name: name.trim() || "My app", template, files: { ...TEMPLATES[template].files }, history: [], updatedAt: Date.now(), folder };
            saveProject(p);
            onCreate(p);
            onOpenChange(false);
            setName("");
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="code-name">Name</Label>
            <Input id="code-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe finder" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="code-template">Kind</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as Template)}>
              <SelectTrigger id="code-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TEMPLATES) as Template[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TEMPLATES[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Create project</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
