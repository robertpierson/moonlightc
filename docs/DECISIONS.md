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

## 2026-10-13 Sync and keys without a server secret
- What: signed-in devices sync chats (+messages), settings (a safe subset, never tokens) and connections. Keys go into Supabase Vault via set_connection_key and come back only to their owner via get_my_connection_key. Account deletion and anonymous download counts use security-definer functions, so the web server holds no Supabase secret key.
- Why: one account on PC and phone must see the same chats and keys (Phase 1 gate); the owner can't hand over a service key, and fewer secrets on the server is safer.
- Trade-off: a signed-in session can read its own keys (same trust as keeping them in the browser, which is how it already worked). Conflicts: last change wins per chat and for settings.
- Admins: private.admin_emails (not exposed through the API, not in the repo) marks the owner's account admin at sign-up.

## 2026-10-13 Remote control over Supabase Realtime (screen as JPEG frames for now)
- What: each desktop app registers in public.devices; remote sessions use private Realtime channels device:<id> whose RLS only admits the owner with an aal2 (two-step) session on both ends. The PC approves each device in a native prompt (optional remember), and every bridge call re-checks the approved tiers (view, control, files, terminal, chat). Screen streams as ~1024px JPEG frames on request (about 2 per second), not WebRTC.
- Why: no port forwarding, no extra server, and the strongest checks live in the database and on the PC. JPEG frames work everywhere without a TURN server; WebRTC can replace them later for smoother video.
- Safety (SPEC §8): off by default, MFA required, per-device approval and revoke, orange on-screen frame, Ctrl+Alt+Shift+M ends AI and remote sessions, 15-minute idle timeout, audit log in Settings > Remote control. Files are limited to the home folder.

## Home PC = remote-control channel + client-side AI tools (2026-10-13)
What: "Make this my home PC" flags one device (devices.is_home). Cowork on another device connects over the existing remote-control channel (files + terminal tiers, approved on the PC) and the AI gets pc_list_files / pc_read_file / pc_write_file / pc_run_command, executed in the browser through that channel. Writes and commands also need Allow on the device you're using.
Why: reuses the already-audited remote path (aal2 + RLS, PC-side tier checks, home-folder jail, panic key); no new server or tunnel.
Alternatives: a relay server running the AI on the PC (more moving parts, PC must hold the keys); SSH/tunnels (setup the owner can't do).

## Background changes skip the Settings save bar (2026-10-13)
What: updateNow() applies a change to both the live state and the saved snapshot; used for defaults picked automatically (local models found, first key added) and memories the AI saves. The unsaved check compares by value.
Why: those changes made Settings look unsaved and blocked leaving it.

## Quick connect = open key page + pick up the copied key (2026-10-14)
What: tiles for Claude, ChatGPT, Gemini… open the company's API-key page; when the app regains focus it reads the clipboard (desktop: only text shaped like a key; web: browser permission) and connects automatically.
Why: Anthropic, OpenAI and Google offer no OAuth flow that issues API keys to third-party apps; OpenRouter (which does) stays as its own sign-in.

## Home PC models in Chat via a client-side transport (2026-10-14)
What: a hidden "home-pc" connection lists the PC's Ollama models while connected; chat-view routes those requests over the remote link instead of /api/chat. Local and home-PC connections are never synced.
Why: the models only exist on the PC; the server can't reach them.

## Remote screen as WebRTC video (2026-10-14)
What: the PC streams its screen over a direct WebRTC connection; the existing private Realtime channel carries the offer/answer; public STUN (Google, Cloudflare) only tells each side its address. If the network blocks it, JPEG pictures over Realtime (drawn after decoding, so no flicker). The desktop app grants one screen capture only within 10 s of a connected device with "see the screen" asking; ending the session (panic key, timeout) stops the stream.
Why: polling JPEG screenshots over Realtime gave a few frames a second and flickered.
Alternatives: a TURN relay (works on stricter networks, costs money; add if picture fallback is common).

## Staff panel access = admin account + two-step code, no shared password (2026-10-15)
What: Settings > Staff and /admin show only for profiles.is_admin; the people/errors/live functions also require aal2.
Why: a password in the code would be public on GitHub; the owner's account with two-step sign-in is stronger. Keystrokes and message content are never recorded (privacy, law, and the app's own promise).

## PC access without the code, and allowed places (2026-10-18)
What: an account switch (off by default) lets signed-in devices reach the owner's PCs without two-step sign-in; turning it on needs the code once, off needs nothing. Separately, a PC can allow remote control only from chosen networks/countries, using location notes signed by the website (HMAC, 5-minute expiry) and checked by the PC.
Why: the owner asked for code-free access in emergencies and for a location lock. The trade-off (password alone reaches the PC) is stated next to the switch.

## 2026-10-21: Admin mode for remote control (opt-in, off by default)
- **What:** a scheduled task starts MoonlightC elevated at logon, and UAC prompts move off the secure desktop
  (PromptOnSecureDesktop=0). Remote sessions can then see and answer UAC/PIN prompts (the owner types his own PIN),
  and the remote terminal is admin. One UAC "Yes" to turn it on or off; a warning is shown first.
- **Why:** the owner was locked out remotely by Windows prompts that no non-elevated app can see or answer.
- **Alternatives:** a SYSTEM service that injects input on the secure desktop and the sign-in screen (the TeamViewer
  model): more power and much more attack surface, not built. Turning UAC off entirely: rejected.
- **Not covered:** the Windows sign-in screen after a restart. The fix for that is "sign in by itself" (netplwiz), where
  the owner types the password himself.

## 2026-10-22: Admin mode retired
- **What:** admin mode can no longer be turned on; Settings only offers turning it off, which restarts MoonlightC with normal rights.
- **Why:** a self-test on the owner's PC showed Windows refuses every live screen capture (getDisplayMedia, desktop source) for the app running elevated ("Could not start video source"), while the same calls work at normal rights. That forced slow pictures for remote control.
- **Instead:** "sign in by itself" covers the post-restart sign-in screen; UAC prompts can be avoided rather than answered remotely.

## 2026-10-24: Relay stays on Cloudflare (owner's key = owner only)
- **What:** the owner's Cloudflare TURN key serves only the owner account (capped at 200 h/month, inside the free 1,000 GB).
  Everyone else brings their own free Cloudflare key (Settings > Account) or gets pictures on blocked networks.
- **Why:** sharing one free key doesn't scale and could cost the owner money; the owner has no budget.
- **Alternative parked:** a self-hosted relay (coturn) on Oracle Cloud Always Free (10 TB/month), for when MoonlightC
  needs to give relay to many users. Needs the owner's sign-up (card check).
