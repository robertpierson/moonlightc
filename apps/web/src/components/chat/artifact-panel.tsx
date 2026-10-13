"use client";

import { Code2, Download, Eye, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { artifactDocument, downloadArtifact, type Artifact } from "@/lib/artifacts";

export function ArtifactPanel({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
  const [code, setCode] = useState(artifact.code);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const current = { ...artifact, code };

  return (
    <section aria-label="Artifact" className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2">
        <h2 className="min-w-0 flex-1 truncate px-2 text-sm font-medium">{artifact.title}</h2>
        <div role="tablist" className="flex rounded-lg bg-muted p-0.5">
          <Button role="tab" aria-selected={tab === "preview"} size="sm" variant={tab === "preview" ? "secondary" : "ghost"} onClick={() => setTab("preview")}>
            <Eye /> Preview
          </Button>
          <Button role="tab" aria-selected={tab === "code"} size="sm" variant={tab === "code" ? "secondary" : "ghost"} onClick={() => setTab("code")}>
            <Code2 /> Code
          </Button>
        </div>
        <Button variant="ghost" size="icon" aria-label="Download artifact" onClick={() => downloadArtifact(current)}>
          <Download />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Close artifact" onClick={onClose}>
          <X />
        </Button>
      </header>
      {tab === "preview" ? (
        // No allow-same-origin: the artifact runs in an opaque origin and can't touch MoonlightC's storage or keys.
        <iframe title={artifact.title} sandbox="allow-scripts allow-modals allow-forms" srcDoc={artifactDocument(current)} className="min-h-0 flex-1 bg-white" />
      ) : (
        <Textarea aria-label="Artifact code" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-xs" />
      )}
    </section>
  );
}
