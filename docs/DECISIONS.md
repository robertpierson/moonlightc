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

## 2026-10-13 Website is always light ("daytime moon")
- What: the marketing pages ignore the device's dark mode: pale lilac/blue/peach sky gradients, indigo-to-fuchsia gradient buttons and headline, and a pearl moon whose shadow side lets the sky show through. The app itself still follows light/dark.
- Why: owner disliked the dark site and the moon against the blue background; asked for clean with lots of gradients.
- Alternatives: a light and a dark variant (owner didn't want dark); a static moon image (the shader is small and now starts after load).

## 2026-10-13 Chrome extension: per-tab sharing, approvals in the extension's own window
- What: MV3 extension in apps/extension. The web app talks to it only through a bridge script that runs on moonlightc.vercel.app (localhost only in the test copy; the zip strips it). Only tabs the person shares are usable; a banner shows on them; risky clicks/submits are confirmed in an extension popup window (Deny is the default), sharing ends after 15 idle minutes, Alt+Shift+M stops all, actions are logged.
- Why: owner asked for browser/screen access through an extension. Confirming inside the page could be clickjacked by the page; an extension window can't be.
- Alternatives: externally_connectable with a fixed extension ID (needs a signing key and breaks when published under a new ID); approving in the chat (the AI SDK's client-tool approval path is less certain). Remote use from another device waits for Supabase (Phase 5).
- Updating: after changing apps/extension, run `pnpm --filter @moonc/extension zip` and commit the zip.

## 2026-10-13 First-party usage stats instead of PostHog (for now)
- What: /api/track writes event names plus a few short plain values to the Supabase events table (signed-in people; anonymous download counts via the server key). /admin reads them through admin_overview(). EU/EEA/UK/CH visitors are asked first; elsewhere it's disclosed in the privacy policy.
- Why: covers every /admin number in SPEC §3 without a third-party key or extra cookie; PostHog needs an owner account and key.
- Alternatives: PostHog (add later if the owner wants session replays or funnels; events can be forwarded).

## 2026-10-13 Chat | Cowork | Code, each with its own sidebar
- What: three modes like Claude. Chat sidebar: Projects, Studio, Subscriptions (+ Automations on desktop), project folders, 15 most recent chats, "All chats" page for the rest. Cowork: tasks list plus an access bar; files, screen control and browser tools are only offered in Cowork. Code: editor-style dark sidebar with folders of code projects, Terminal and Local projects (renamed from My AI Projects) on desktop. Memory and Usage moved into Settings.
- Why: owner asked for a clean sidebar tailored to each mode and for Claude-like projects, cowork and permission modes.
- Recent limit: 15 (pinned chats count toward it and sort first); everything else is one click away and searchable.
- Code permission modes: Ask (apply/reject each change), Auto-accept (default), Plan only (no file tools), Bypass (connector tools run without asking; confirmation dialog; tools set to "never" stay blocked; computer use is never bypassed).
