"use client";

import { useChat } from "@ai-sdk/react";
import { SandpackPreview, SandpackProvider, useSandpack } from "@codesandbox/sandpack-react";
import { NewProject } from "./new-project";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { findSkill, skillsInstructions } from "@/lib/claude-plugins";
import { activePlugins, activeServers, mcpPayload } from "@/lib/project-tools";
import { PermissionMode } from "./permission-mode";
import { ArrowUp, Download, ExternalLink, FileCode2, FolderDown, Loader2, Plug, Plus, Square, Trash2, Undo2, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ModelPicker } from "@/components/chat/model-picker";
import { Message } from "@/components/chat/message";
import { ProjectToolsDialog } from "@/components/library/project-tools";
import { applyChange, codeInstructions, pushToGitHub, revertChange, zipProject, type CodeProject } from "@/lib/code";
import { deleteProject, getProject, saveProject, useCodeProjects } from "@/lib/code-store";
import { desktop } from "@/lib/desktop";
import { findModel, getState, useStore, type ModelRef } from "@/lib/store";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false, loading: () => <div className="flex-1" /> });
const DiffEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.DiffEditor), { ssr: false, loading: () => <div className="flex-1" /> });

const language = (p: string) =>
  ({ js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", css: "css", html: "html", json: "json", md: "markdown" })[p.split(".").pop() ?? ""] ?? "plaintext";


function AiPanel({ project, onChange }: { project: CodeProject; onChange: (p: CodeProject) => void }) {
  const lastModel = useStore((s) => s.lastModel);
  const [model, setModel] = useState<ModelRef | undefined>(lastModel);
  const [input, setInput] = useState("");
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  const body = () => {
    const found = findModel(modelRef.current);
    if (!found) return {};
    const { apiKey, providerId, baseURL } = found.conn;
    const p = projectRef.current;
    const perm = getState().codePermission ?? "auto";
    const skills = skillsInstructions(activePlugins(p.pluginIds));
    return {
      connection: { apiKey, providerId, baseURL },
      modelId: found.model.id,
      instructions: [codeInstructions(p), skills].filter(Boolean).join("\n\n"),
      code: perm === "plan" ? "plan" : true,
      skills: !!skills || undefined,
      mcp: mcpPayload(activeServers(p.connectorIds), perm === "bypass"),
    };
  };
  // "Ask first": each change waits here until the person applies or rejects it.
  const [pending, setPending] = useState<{ summary: string; paths: string[]; decide: (ok: boolean) => void }>();
  // eslint-disable-next-line react-hooks/refs -- read when a request is sent, not during render
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat", body }));
  const { messages, sendMessage, status, stop, error, addToolOutput, addToolApprovalResponse } = useChat({
    id: `code-${project.id}`,
    transport,
    sendAutomaticallyWhen: (o) => lastAssistantMessageIsCompleteWithToolCalls(o) || lastAssistantMessageIsCompleteWithApprovalResponses(o),
    onToolCall: async ({ toolCall }): Promise<void> => {
      if (toolCall.dynamic) return;
      if (toolCall.toolName === "load_skill") {
        const skill = findSkill(activePlugins(projectRef.current.pluginIds), String((toolCall.input as { name?: string }).name ?? ""));
        addToolOutput({ tool: "load_skill", toolCallId: toolCall.toolCallId, output: skill ? { instructions: skill.body } : { error: "No such skill." } } as never);
        return;
      }
      if (toolCall.toolName !== "write_files" && toolCall.toolName !== "delete_files") return;
      try {
        const i = toolCall.input as { summary?: string; files?: { path: string; content: string }[]; paths?: string[] };
        if ((getState().codePermission ?? "auto") === "ask") {
          const paths = toolCall.toolName === "write_files" ? (i.files ?? []).map((f) => f.path) : (i.paths ?? []).map((p) => `${p} (delete)`);
          const ok = await new Promise<boolean>((decide) => setPending({ summary: i.summary ?? (toolCall.toolName === "write_files" ? "Edit files" : "Delete files"), paths, decide }));
          setPending(undefined);
          if (!ok) {
            addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: { ok: false, error: "The person rejected this change. Ask what they'd like instead." } } as never);
            return;
          }
        }
        const cur = getProject(projectRef.current.id) ?? projectRef.current;
        const next = toolCall.toolName === "write_files" ? applyChange(cur, i.summary ?? "Edited files", i.files ?? []) : applyChange(cur, "Deleted files", [], i.paths ?? []);
        projectRef.current = next;
        onChange(next);
        addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: { ok: true, files: Object.keys(next.history[0].after) } } as never);
      } catch (e) {
        addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: { ok: false, error: e instanceof Error ? e.message : String(e) } } as never);
      }
    },
  });
  const busy = status === "streaming" || status === "submitted";
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <section aria-label="Code assistant" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b px-1 py-1">
        <ModelPicker value={model} onChange={setModel} />
        <span className="flex-1" />
        <PermissionMode />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid gap-3 text-sm">
          {messages.length === 0 && <p className="text-muted-foreground">Describe the app or change you want. For example: &quot;a tip calculator with a dark theme&quot;.</p>}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <Message key={m.id} message={m} streaming={false} isLast={false} />
            ) : (
              <div key={m.id} data-role="assistant" className="grid gap-1">
                {m.parts.map((p, j) =>
                  p.type === "tool-write_files" || p.type === "tool-delete_files" ? (
                    <p key={j} className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileCode2 className="size-3.5" />
                      {(p as unknown as { input?: { summary?: string } }).input?.summary ?? "Changed files"}
                    </p>
                  ) : null,
                )}
                <Message
                  message={{ ...m, parts: m.parts.filter((p) => p.type !== "tool-write_files" && p.type !== "tool-delete_files") }}
                  streaming={busy && i === messages.length - 1}
                  isLast={false}
                  onApproval={(id, approved) => addToolApprovalResponse({ id, approved })}
                />
              </div>
            ),
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error.message}
            </p>
          )}
          <div ref={bottom} />
        </div>
      </div>
      {pending && (
        <div role="group" aria-label="Apply this change?" className="grid gap-2 border-t bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Apply this change? {pending.summary}</p>
          <ul className="max-h-24 overflow-y-auto font-mono text-xs text-muted-foreground">
            {pending.paths.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => pending.decide(true)}>
              Apply
            </Button>
            <Button size="sm" variant="outline" onClick={() => pending.decide(false)}>
              Reject
            </Button>
          </div>
        </div>
      )}
      <form
        className="flex items-end gap-2 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          if (!findModel(model)) return toast.error("Pick a model first (add a key in Models and keys).");
          sendMessage({ text: input.trim() });
          setInput("");
        }}
      >
        <Textarea
          aria-label="Describe a change"
          rows={2}
          className="min-h-12 resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) e.currentTarget.form?.requestSubmit();
          }}
          placeholder="What should the app do?"
        />
        {busy ? (
          <Button type="button" size="icon-lg" aria-label="Stop" onClick={() => stop()}>
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon-lg" aria-label="Send to code assistant" disabled={!input.trim()}>
            <ArrowUp />
          </Button>
        )}
      </form>
    </section>
  );
}

/** Pushes edits (from the AI or the editor) into the running preview without restarting it. */
function SyncFiles({ files }: { files: Record<string, string> }) {
  const { sandpack } = useSandpack();
  useEffect(() => {
    const t = setTimeout(() => {
      for (const [path, code] of Object.entries(files)) if (sandpack.files[path]?.code !== code) sandpack.updateFile(path, code);
      for (const path of Object.keys(sandpack.files)) if (!(path in files) && !path.startsWith("/node_modules")) sandpack.deleteFile(path);
    }, 300);
    return () => clearTimeout(t);
  }, [files, sandpack]);
  return null;
}

function Preview({ project }: { project: CodeProject }) {
  // Sandpack bundles and runs the project in a sandboxed iframe on another origin.
  const [initial] = useState(() => Object.fromEntries(Object.entries(project.files).map(([k, v]) => [k, { code: v }])));
  return (
    <SandpackProvider template={project.template === "react" ? "react" : "static"} files={initial} options={{ recompileMode: "delayed", recompileDelay: 600, initMode: "immediate" }} style={{ height: "100%" }}>
      <SyncFiles files={project.files} />
      <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton style={{ height: "100%" }} />
    </SandpackProvider>
  );
}

export function CodeWorkspace({ projectId, onSelect, onConnectGitHub, onOpenConnectors }: { projectId?: string; onSelect: (id: string) => void; onConnectGitHub: () => void; onOpenConnectors: () => void }) {
  const projects = useCodeProjects();
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  const [tools, setTools] = useState(false);
  const [file, setFile] = useState<string>();
  const [tab, setTab] = useState<"code" | "changes" | "preview">("preview");
  const [creating, setCreating] = useState(false);
  const [pushing, setPushing] = useState(false);
  const githubToken = useStore((s) => s.mcpServers?.find((m) => m.preset === "github")?.token);
  const current = project && (file && file in project.files ? file : Object.keys(project.files).sort()[0]);
  const lastChange = project?.history[0];

  if (!project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-xl font-semibold">Build an app by describing it</h2>
        <p className="max-w-md text-sm text-muted-foreground">The AI writes the code, you see it run right here, and you can download it or put it on GitHub.</p>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New code project
        </Button>
        <NewProject open={creating} onOpenChange={setCreating} onCreate={(p) => onSelect(p.id)} />
      </div>
    );
  }

  const update = (p: CodeProject) => saveProject(p);
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([zipProject(project) as BlobPart], { type: "application/zip" }));
    a.download = `${project.name.replace(/[^\w\- ]+/g, "").trim() || "project"}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <h2 className="truncate font-mono text-sm font-semibold">
          {project.folder && <span className="text-muted-foreground">{project.folder} / </span>}
          {project.name}
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setTools(true)}>
          <Plug /> Connectors & skills{(project.connectorIds?.length ?? 0) + (project.pluginIds?.length ?? 0) ? ` (${(project.connectorIds?.length ?? 0) + (project.pluginIds?.length ?? 0)})` : ""}
        </Button>
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={download}>
          <Download /> Download .zip
        </Button>
        {desktop() && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const where = await desktop()!.files.saveProject(project.name, project.files);
              if (where) toast.success(`Saved to ${where}`);
            }}
          >
            <FolderDown /> Save to folder
          </Button>
        )}
        {githubToken ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pushing}
            onClick={async () => {
              setPushing(true);
              try {
                const repo = await pushToGitHub(project, githubToken);
                update({ ...project, repo });
                toast.success(`Pushed to github.com/${repo}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
              } finally {
                setPushing(false);
              }
            }}
          >
            {pushing ? <Loader2 className="animate-spin" /> : <Upload />} {project.repo ? "Push changes" : "Put on GitHub"}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onConnectGitHub}>
            <Upload /> Connect GitHub to publish
          </Button>
        )}
        {project.repo && (
          <Button size="sm" variant="ghost" asChild>
            <a href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(`https://github.com/${project.repo}`)}`} target="_blank" rel="noreferrer">
              Deploy on Vercel <ExternalLink />
            </a>
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${project.name}`} onClick={() => confirm(`Delete the project "${project.name}" from this device?`) && deleteProject(project.id)}>
          <Trash2 />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(18rem,22rem)_1fr]">
        <div className="flex min-h-[22rem] flex-col border-b lg:min-h-0 lg:border-r lg:border-b-0">
          <AiPanel key={project.id} project={project} onChange={update} />
        </div>
        <div className="flex min-h-[28rem] flex-col">
          <div role="tablist" aria-label="Workspace" className="flex items-center gap-1 border-b p-1">
            {(["preview", "code", "changes"] as const).map((t) => (
              <Button key={t} role="tab" aria-selected={tab === t} size="sm" variant={tab === t ? "secondary" : "ghost"} onClick={() => setTab(t)}>
                {t === "preview" ? "Preview" : t === "code" ? "Code" : `Changes${project.history.length ? ` (${project.history.length})` : ""}`}
              </Button>
            ))}
          </div>
          {tab === "preview" && (
            <div className="min-h-0 flex-1" data-testid="code-preview">
              <Preview key={`${project.id}:${project.history.length}`} project={project} />
            </div>
          )}
          {tab !== "preview" && (
            <div className="grid min-h-0 flex-1 md:grid-cols-[12rem_1fr]">
              <ul aria-label="Files" className="max-h-40 overflow-y-auto border-b p-1 text-sm md:max-h-none md:border-r md:border-b-0">
                {Object.keys(project.files)
                  .sort()
                  .map((p) => (
                    <li key={p}>
                      <button aria-current={p === current ? "true" : undefined} className="w-full truncate rounded px-2 py-1 text-left hover:bg-accent aria-[current=true]:bg-accent" onClick={() => setFile(p)}>
                        {p.slice(1)}
                      </button>
                    </li>
                  ))}
              </ul>
              <div className="flex min-h-[20rem] flex-col">
                {tab === "code" && current && (
                  <Editor
                    path={current}
                    language={language(current)}
                    value={project.files[current]}
                    theme={document.documentElement.classList.contains("dark") ? "vs-dark" : "light"}
                    options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on" }}
                    onChange={(v) => update({ ...project, files: { ...project.files, [current]: v ?? "" }, updatedAt: Date.now() })}
                  />
                )}
                {tab === "changes" &&
                  (lastChange ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2 border-b p-2 text-sm">
                        <span className="flex-1">{lastChange.summary}</span>
                        <Button size="sm" variant="outline" onClick={() => update(revertChange(project, lastChange))}>
                          <Undo2 /> Undo this change
                        </Button>
                      </div>
                      <DiffEditor
                        original={(current && lastChange.before[current]) ?? ""}
                        modified={(current && project.files[current]) ?? ""}
                        language={current ? language(current) : "plaintext"}
                        theme={document.documentElement.classList.contains("dark") ? "vs-dark" : "light"}
                        options={{ readOnly: true, renderSideBySide: false, minimap: { enabled: false } }}
                      />
                    </>
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground">No AI changes yet.</p>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <NewProject open={creating} onOpenChange={setCreating} onCreate={(p) => onSelect(p.id)} />
      <ProjectToolsDialog
        open={tools}
        onOpenChange={setTools}
        title={`Connectors and skills for ${project.name}`}
        value={{ connectorIds: project.connectorIds ?? [], pluginIds: project.pluginIds ?? [] }}
        onChange={(v) => update({ ...project, ...v })}
        onOpenConnectors={onOpenConnectors}
      />
    </div>
  );
}
