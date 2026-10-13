"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Plus, SquareTerminal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { desktop, type CliTool } from "@/lib/desktop";

interface Tab {
  key: number;
  title: string;
  command?: string;
  cwd?: string;
}

function TermPane({ tab, active, onExit }: { tab: Tab; active: boolean; onExit: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitAddon>(undefined);
  useEffect(() => {
    const bridge = desktop()!;
    const term = new XTerm({ fontFamily: "'Cascadia Mono', Consolas, Menlo, 'DejaVu Sans Mono', monospace", fontSize: 13, cursorBlink: true, theme: { background: "#0f1736", foreground: "#dfe4f0" } });
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(el.current!);
    fit.fit();
    let id: string | undefined;
    const offs: (() => void)[] = [];
    let disposed = false;
    bridge.terminals.create({ command: tab.command, cwd: tab.cwd, cols: term.cols, rows: term.rows }).then((t) => {
      if (disposed) return bridge.terminals.kill(t.id);
      id = t.id;
      offs.push(bridge.terminals.onData(t.id, (d) => term.write(d)));
      offs.push(bridge.terminals.onExit(t.id, () => onExit()));
      term.onData((d) => bridge.terminals.write(t.id, d));
      term.onResize(({ cols, rows }) => bridge.terminals.resize(t.id, cols, rows));
      term.focus();
    });
    const ro = new ResizeObserver(() => el.current?.offsetParent && fit.fit());
    ro.observe(el.current!);
    return () => {
      disposed = true;
      ro.disconnect();
      offs.forEach((f) => f());
      if (id) bridge.terminals.kill(id);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (active) requestAnimationFrame(() => fitRef.current?.fit());
  }, [active]);
  return <div ref={el} className={`min-h-0 flex-1 bg-[#0f1736] p-2 ${active ? "" : "hidden"}`} data-testid="terminal" />;
}

let nextKey = 1;

export interface LaunchRequest {
  id: number;
  command: string;
  cwd?: string;
  title: string;
}

export function Terminals({ request }: { request?: LaunchRequest }) {
  const [tabs, setTabs] = useState<Tab[]>(() => [request ? { key: nextKey++, ...request } : { key: nextKey++, title: "Terminal" }]);
  const [active, setActive] = useState(tabs[0].key);
  const [tools, setTools] = useState<CliTool[]>([]);
  const [handled, setHandled] = useState(request?.id);

  // A new launch request (for example "Resume" in My AI Projects) opens a new tab.
  if (request && request.id !== handled) {
    const tab = { key: nextKey++, title: request.title, command: request.command, cwd: request.cwd || undefined };
    setHandled(request.id);
    setTabs([...tabs, tab]);
    setActive(tab.key);
  }

  useEffect(() => {
    desktop()!.terminals.tools().then(setTools);
  }, []);

  const open = (t: Omit<Tab, "key">) => {
    const tab = { key: nextKey++, ...t };
    setTabs((ts) => [...ts, tab]);
    setActive(tab.key);
  };
  const close = (key: number) =>
    setTabs((ts) => {
      const rest = ts.filter((t) => t.key !== key);
      if (key === active && rest.length) setActive(rest[rest.length - 1].key);
      return rest;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b p-2">
        <div role="tablist" aria-label="Terminals" className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <div key={t.key} className={`flex items-center rounded-md ${t.key === active ? "bg-accent" : ""}`}>
              <button role="tab" aria-selected={t.key === active} className="px-2.5 py-1 text-sm" onClick={() => setActive(t.key)}>
                {t.title}
              </button>
              <Button variant="ghost" size="icon-xs" aria-label={`Close ${t.title}`} onClick={() => close(t.key)}>
                <X />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => open({ title: "Terminal" })}>
          <Plus /> New
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {tools.map((t) =>
            t.installed ? (
              <Button key={t.id} size="sm" variant="outline" onClick={() => open({ title: t.name, command: t.id === "claude" ? "claude" : t.id })}>
                <SquareTerminal /> {t.name}
              </Button>
            ) : (
              <Button key={t.id} size="sm" variant="ghost" title={t.installCommand} onClick={() => open({ title: `Install ${t.name}`, command: t.installCommand })}>
                Install {t.name}
              </Button>
            ),
          )}
        </div>
      </div>
      <p className="border-b px-3 py-1.5 text-xs text-muted-foreground">
        A real terminal on this computer. Coding tools like Claude Code run here under your own login; MoonlightC only shows the terminal and never reads their credentials.
      </p>
      {tabs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Button onClick={() => open({ title: "Terminal" })}>
            <Plus /> Open a terminal
          </Button>
        </div>
      ) : (
        tabs.map((t) => <TermPane key={t.key} tab={t} active={t.key === active} onExit={() => close(t.key)} />)
      )}
    </div>
  );
}
