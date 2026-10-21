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

export interface ComputerAction {
  action: "screenshot" | "click" | "double_click" | "right_click" | "move" | "type" | "key" | "scroll" | "wait";
  x?: number;
  y?: number;
  text?: string;
  keys?: string;
  amount?: number;
  ms?: number;
  destructive?: boolean;
  reason?: string;
}

export type ComputerState = { active: false } | { active: true; task: string; startedAt: number; endsAt: number };

export type Places = { on: boolean; list: { kind: "ip" | "country"; value: string; label: string }[]; blocked: { ip: string; country: string; city: string; at: string; verified: boolean }[] };

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
    keepAwake(on: boolean): Promise<void>;
    setupWake(): Promise<{ ok: boolean; error?: string }>;
    setupAutoSignIn(): Promise<{ ok: boolean; error?: string }>;
    adminStatus(): Promise<{ admin: boolean }>;
    setAdmin(on: boolean): Promise<{ ok: boolean; error?: string }>;
  };
  device: { info(): Promise<{ id: string; name: string; os: string; version: string; mac?: string }> };
  clipboard: { readKey(): Promise<string | null>; readText(): Promise<string> };
  claude: {
    status(): Promise<{ installed: boolean; version?: string }>;
    run(id: string, prompt: string, sessionId?: string, model?: string, effort?: string): Promise<boolean>;
    stop(id: string): Promise<boolean>;
    onEvent(cb: (id: string, line: string) => void): () => void;
  };
  /** API keys already set up on this computer (standard environment variables). */
  keys: { scan(): Promise<{ provider: string; source: string; value: string; masked: string }[]> };
  /** Remote control of this PC from your other devices (every call is checked against what the person allowed). */
  remote: {
    connect(client: { id: string; name: string }, tiers: string[], where?: unknown): Promise<{ allowed: boolean; tiers?: string[]; reason?: string }>;
    places(): Promise<Places>;
    setPlaces(p: Places): Promise<Places>;
    trusted(): Promise<boolean>;
    allowStream(clientId: string): Promise<boolean>;
    setTrusted(on: boolean): Promise<boolean>;
    end(clientId?: string, reason?: string): Promise<void>;
    allowed(clientId: string, tier: string): Promise<boolean>;
    frame(clientId: string): Promise<{ image: string; width: number; height: number }>;
    input(clientId: string, a: { action: string; x?: number; y?: number; text?: string; keys?: string; amount?: number }): Promise<{ ok: true }>;
    list(clientId: string, dir?: string): Promise<{ path: string; parent: string | null; entries: { name: string; dir: boolean; size?: number }[] }>;
    read(clientId: string, path: string): Promise<{ name: string; data: string }>;
    write(clientId: string, dir: string, name: string, data: string): Promise<{ saved: string }>;
    exec(clientId: string, command: string, cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }>;
    state(): Promise<RemoteSession[]>;
    grants(): Promise<{ clientId: string; name: string; tiers: string[]; at: string }[]>;
    revoke(clientId: string): Promise<{ clientId: string; name: string; tiers: string[]; at: string }[]>;
    audit(): Promise<{ at: string; action: string; name?: string; clientId?: string; [k: string]: unknown }[]>;
    onState(cb: (s: RemoteSession[]) => void): () => void;
    power(clientId: string, what: "lock" | "sleep" | "restart" | "shutdown"): Promise<{ ok: true }>;
    status(): Promise<{ locked: boolean }>;
  };
  computer: {
    /** Native "Let the AI control this PC?" dialog. Resolves true if allowed. */
    start(task: string): Promise<boolean>;
    stop(): Promise<void>;
    act(a: ComputerAction): Promise<{ image: string; width: number; height: number } | { stopped: true; note: string }>;
    status(): Promise<ComputerState>;
    audit(): Promise<{ at: string; session: string | null; action: string; [k: string]: unknown }[]>;
    onState(cb: (s: ComputerState) => void): () => void;
  };
  mcp: {
    /** Native "Allow this program?" dialog. Returns true if the user allowed it. */
    approve(command: string, args: string[]): Promise<boolean>;
  };
  files: {
    /** Pick a folder and write the project there (in a new subfolder). Returns the folder, or null if cancelled. */
    saveProject(name: string, files: Record<string, string>): Promise<string | null>;
    grants(): Promise<string[]>;
    grant(): Promise<string[]>;
    revoke(folder: string): Promise<string[]>;
    audit(): Promise<{ at: string; action: string; path: string }[]>;
  };
  notify(title: string, body: string): Promise<void>;
  /** moonlightc:// links opened on this computer (for example, returning from a sign-in in the browser). */
  onDeepLink(cb: (url: string) => void): () => void;
  openExternal(url: string): Promise<void>;
  openPath(path: string, app?: "vscode" | "cursor"): Promise<void>;
}

declare global {
  interface Window {
    moonc?: MooncBridge;
  }
}

export type RemoteSession = { clientId: string; name: string; tiers: string[]; startedAt: number };

export const desktop = (): MooncBridge | undefined => (typeof window === "undefined" ? undefined : window.moonc);
