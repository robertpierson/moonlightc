// The desktop app exposes this bridge (apps/desktop/src/preload.cjs). On the website it doesn't exist,
// so every desktop-only feature checks `desktop()` and stays hidden.

export interface Hardware {
  cpu: string;
  cores: number;
  ramGB: number;
  gpus: { model: string; vramGB: number }[];
  freeDiskGB: number;
  os: string;
  arch: string;
}

export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  version?: string;
}

export interface TerminalInfo {
  id: string;
  title: string;
}

export interface CliTool {
  id: "claude" | "codex" | "gemini" | "aider";
  name: string;
  installed: boolean;
  installCommand: string;
}

export interface AiProject {
  kind: "claude" | "codex" | "gemini" | "cursor" | "git" | "ollama";
  name: string;
  path: string;
  lastActivity: number;
  detail?: string;
  resume?: string; // command to resume in a terminal
}

export interface MooncBridge {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  hardware(): Promise<Hardware>;
  ollama: {
    status(): Promise<OllamaStatus>;
    install(onProgress: (pct: number, stage: string) => void): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
  };
  terminals: {
    tools(): Promise<CliTool[]>;
    create(opts: { command?: string; cwd?: string; cols: number; rows: number }): Promise<TerminalInfo>;
    write(id: string, data: string): void;
    resize(id: string, cols: number, rows: number): void;
    kill(id: string): void;
    onData(id: string, cb: (data: string) => void): () => void;
    onExit(id: string, cb: (code: number) => void): () => void;
  };
  projects: {
    folders(): Promise<string[]>;
    addFolder(): Promise<string[]>;
    /** Approve the standard Claude Code, Codex, Gemini, Cursor and Ollama folders that exist on this computer. */
    addKnown(): Promise<string[]>;
    removeFolder(path: string): Promise<string[]>;
    scan(): Promise<AiProject[]>;
  };
  secrets: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string | null): Promise<void>;
  };
  settings: {
    get(): Promise<{ openAtLogin: boolean }>;
    setOpenAtLogin(on: boolean): Promise<void>;
  };
  notify(title: string, body: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  openPath(path: string, app?: "vscode" | "cursor"): Promise<void>;
}

declare global {
  interface Window {
    moonc?: MooncBridge;
  }
}

export const desktop = (): MooncBridge | undefined => (typeof window === "undefined" ? undefined : window.moonc);
