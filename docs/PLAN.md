# Phase 4 plan: desktop app

Approach: Electron (apps/desktop) starts the same Next.js app as a local server (Next `output: "standalone"`, built with
DESKTOP_BUILD=1) on a random localhost port and opens it in a window. Everything in the web app works, plus desktop-only
features exposed through a minimal, typed preload bridge (`window.moonc`). The web UI shows desktop features only when
that bridge exists, so the website never shows them.

Tasks
1. Scaffold apps/desktop (Electron + electron-builder), spawn Next server, single window, dev mode against :3000.
2. Local provider: Ollama (OpenAI-compatible on 127.0.0.1:11434) allowed only in desktop server mode.
3. Ollama manager: detect, one-click install (official installer), start/stop, list, pull with progress, delete.
4. Hardware detection + Model Store (curated JSON + "will it run" verdict + HF GGUF search).
5. Terminals: node-pty + xterm.js tabs; quick-launch claude/codex/gemini/aider if installed, install command otherwise.
6. My AI Projects: scan approved folders (Claude Code, Codex, Gemini, Cursor, git repos, Ollama models), read-only cards.
7. Keys in OS keychain (safeStorage) on desktop.
8. Tray, Alt+Space quick-ask overlay, launch at startup, deep link moonlightc://, notifications.
9. CI matrix builds (win/mac/linux, x64+arm64) uploaded as a DRAFT GitHub release (owner publishes: rule 6).
10. Gate: install on this Windows PC, pull a model, chat with internet off, open Claude Code in the terminal.

Deferred: SQLite + sync (needs Supabase; localStorage in Electron is already durable on disk). Recorded in DECISIONS.md.
