# Decisions

## 2026-10-13 Monorepo grows on demand
What: start with `apps/web` only; add `packages/*` (ui, core, agent, mods-sdk) in the phase that first needs them.
Why: no empty scaffolding; SPEC layout stays the target. Alternative: create all packages now (dead code until Phase 2+).

## 2026-10-13 Next.js 16.4 + React 19.3 + Tailwind 4, TypeScript 5
What: versions from create-next-app@16.4.0. TypeScript 7 exists but Next's template pins ^5; stay on 5 until Next supports 7.
Why: avoid toolchain breakage. Alternative: TS 7 (faster, unproven with Next).

## 2026-10-13 Tests: Vitest (unit, src/) + Playwright (e2e/, desktop + Pixel 7 projects)
Why: fast, standard; mobile project covers the 360px quality bar early.

## 2026-10-13 Provider layer: 4 AI SDK packages, not 13
What: native SDKs for Anthropic, OpenAI, Google; `@ai-sdk/openai-compatible` for OpenRouter, xAI, Mistral, DeepSeek, Groq,
Together, Perplexity, Cohere (compat API) and custom URLs. Model lists fetched live from each provider's /models endpoint;
that same call validates the key. Pricing shown only where the API publishes it (OpenRouter).
Why: fewer deps; all these expose OpenAI-compatible chat. Alternative: one package per provider (swap in if a provider needs
features the compat layer lacks). Azure OpenAI and AWS Bedrock still to add (different auth).

## 2026-10-13 Unreleased phases live on branches
What: phases that can't pass their gate yet are built on `phase-N-*` branches (Vercel preview URLs), merged to main only after the gate.
Why: SPEC "never let unfinished phases leak visible UI into production".

## 2026-10-13 Voice typing: Whisper via the user's OpenAI or Groq key, browser speech as fallback
What: fixed Whisper ids `whisper-1` (OpenAI) and `whisper-large-v3-turbo` (Groq); these are stable ids, not "latest" aliases.
If neither key exists, use the browser's SpeechRecognition (audio goes to the browser vendor; the button tooltip says so). Hidden if neither works.

## 2026-10-13 Desktop = Electron running the same Next.js app as a local server
What: apps/desktop spawns the Next "standalone" build (DESKTOP_BUILD=1) on 127.0.0.1:<random port> using Electron's own
Node, and opens it in a sandboxed window. Desktop-only features go through a small preload bridge (`window.moonc`).
Why: one UI codebase, API routes work offline for local models, no duplicate chat engine. Alternative: static export (no
API routes) or loading the hosted site (not offline).
Security: contextIsolation + sandbox, no Node in pages, IPC checks the sender URL, navigation locked to the local origin,
/api rejects cross-origin requests and non-loopback Host headers (DNS rebinding).

## 2026-10-13 SQLite + sync deferred until accounts exist
What: desktop keeps chats in Chromium localStorage (persisted on disk under userData) for now; keys go to the OS keychain
via safeStorage. SQLite arrives with Supabase sync (needs the database first).
Why: avoid a native module and a migration with nothing to sync against yet.

## 2026-10-13 Ship finished phases 2-8 to production before Phase 1
What: merge PR #1 (chat, site, PWA, desktop downloads page, studio, connections, customization) to main while accounts wait
on the Supabase slot (OWNER_TODO #1).
Why: everything visible works end to end on the device (no accounts needed); keeping it on a protected preview gave the
owner nothing usable. Account-only features stay hidden until Phase 1. Alternative: wait for the owner (blocked indefinitely).
Rollback: Vercel "Instant Rollback" to the previous production deployment.

## 2026-10-13 Owner UX requests: Settings, Chat/Code switch, Auto model, no Compare
- What: removed Compare; Connectors, Plugins & mods, Local models, Appearance, Modes, keys and privacy moved into one Claude-style Settings screen; Chat/Code switch at the top of the sidebar; mode menu shows pinned modes (General, Deep Research, Private) with the rest under "More options"; "Auto" model routes each message by task type to models the user assigns in Settings.
- Why: owner asked for it (fewer top-level items, coding as its own tab, settings like Claude's).
- Alternatives: an AI classifier for Auto (costs a model call per message; keyword rules first, upgrade if picks are wrong); keeping Compare behind a setting (owner said not needed).

## 2026-10-13 Claude plugins run inside MoonlightC (partial support, shown honestly)
- What: install Claude Code plugins from GitHub in the browser (GitHub tree API + raw files, the visitor's own rate limit). Skills: listed in the instructions, full text loaded on demand through a browser-side load_skill tool. Commands: slash commands with $ARGUMENTS/$1. Agents: modes. MCP: remote servers connect like other connectors; stdio only in the desktop app with its approval prompt. Hooks, bin/, LSP, monitors and shell snippets are listed as not supported before install.
- Why: owner wants "the same plugins as Claude". These parts map cleanly onto a chat app; the rest needs Claude Code's local runtime.
- Alternatives: server-side fetching (shared Vercel IP would hit GitHub's anonymous limit fast); running hooks/scripts (unsafe in a browser, needs a sandbox).
