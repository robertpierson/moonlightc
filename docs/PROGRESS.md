STATUS: BUILDING

# MoonlightC progress

## Phases (SPEC §14)
- [x] 0 Setup: prerequisites, GitHub repo, Supabase project, Vercel project, monorepo scaffold, CI — gate: `pnpm build` green, empty app live at moonlightc.vercel.app
- [ ] 1 Accounts and metrics: sign-in methods, identity linking, onboarding, profiles, PostHog, /admin, privacy, terms
- [ ] 2 Chat core: provider registry, key vault, model picker, streaming/stop, chats, projects, attachments, artifacts, memory, modes, compare, search
- [x] 3 Marketing site, download page, PWA (built on branch phase-2-chat; ships to prod with Phase 1+2)
- [x] 4 Desktop app (on branch; SQLite+sync waits for Supabase): Electron, offline SQLite + sync, Ollama manager, Model Store, terminals, My AI Projects, tray/hotkey, CI release builds
- [ ] 5 Devices and remote control (§8 safety)
- [~] 6 Creative studio: images, video, audio, gallery
- [~] 7 Connections and automations: MCP client, GitHub, Google, Discord, Spotify, Notion, Slack, YouTube, custom MCP, subscriptions, scheduled agents, deep research
- [x] 8 Customization (on branch; drag/dock deferred): distros, themes/editor, layout, mods SDK and store
- [~] 9 Hardening (a11y: 0 axe violations; SECURITY.md; rest after Phases 1/5): security review, RLS audit, perf, a11y, docs, v1.0 release

## Owner requests (2026-10-13, do in this order; these come before blocked Phase 1 work)
- [x] R1 Remove Compare (owner doesn't want it)
- [x] R2 Mode menu: 3 main modes + "More options" (rest also reachable in Settings)
- [x] R3 Chat / Code switch at the top (Code is its own tab, like Claude)
- [x] R4 Full Settings screen like Claude's: General, Models & keys (all keys, masked), Auto model, Connectors, Local models (downloaded), Plugins, Appearance, Privacy & data, Shortcuts
- [x] R5 Auto model: picks a model per task type (everyday / coding / deep thinking / quick / images), mapped in Settings
- [x] R6 Claude plugins: install from GitHub (plugin.json / marketplace.json): skills, slash commands, MCP servers
- [x] R7 Marketing site: light, clean, lots of gradients; moon must not clash with the background
- [x] R8a File access in the desktop app: shared folders (native picker), list/search/read, write asks first, activity log
- [x] R8b Chrome extension: the AI can see and act in browser tabs you allow (local, no Supabase needed)
- [x] R9 Dark theme: dark blue with black accents (no light blue); light mode polished
- [x] R10 Profile (name, picture) + save your own themes
- [x] R11 Update the installed desktop app to match the web app; test copies run hidden
- [ ] R8c (needs Supabase, Phase 5) remote control from another device

## Phase 0 tasks
- [x] Check prerequisites (node 22, pnpm 11, git, gh logged in as robertpierson; Vercel + Supabase via MCP)
- [x] Monorepo scaffold (pnpm + turbo, apps/web Next.js 16.4)
- [x] GitHub repo https://github.com/robertpierson/moonlightc (public, MIT)
- [x] Vercel project `moonlightc` (team app-project21, root apps/web, git-connected; main = production)
- [ ] Supabase project (BLOCKED: free-plan limit 2 active, see OWNER_TODO #1) — create in org umzghxzngixiedodscaa, us-east-2
- [x] CI (GitHub Actions: typecheck, lint, test, build, Playwright) green
- [x] Gate verified: build green, https://moonlightc.vercel.app 200, Playwright desktop+mobile pass on prod

## Phase 2 tasks (LIVE in production since PR #1 merge)
- [x] Provider registry (packages/core): 11 providers + custom URL, live model lists, key validation, cost estimate
- [x] /api/models + /api/chat streaming proxy, SSRF guard, friendly errors
- [x] Chat UI: model picker (search, favorites), stream + Stop (partial kept), edit/resend, regenerate, branch, copy, read aloud, markdown/code/math/mermaid, search, pin, rename, export, delete; device-local storage
- [x] e2e: mock OpenAI-compatible provider (e2e/mock-openai.mjs); 10 tests pass desktop+mobile
- [x] Modes/personas (General, Coder, Writer, Researcher, Tutor, Private incognito) + custom
- [x] Attachments (images, PDFs, text/code files; drag-drop, paste)
- [x] Artifacts side panel (HTML/SVG/Mermaid live, edit, download)
- [x] Compare mode (2-4 models side by side)
- [x] Command palette (Ctrl/Cmd+K)
- [x] Tools: web search (Tavily/Exa/Brave BYOK), URL fetch
- [x] Voice typing (Whisper via OpenAI/Groq key, browser fallback); read aloud
- [x] Code interpreter (Pyodide in browser worker)
- [x] Deep Research mode
- [x] Azure OpenAI + AWS Bedrock providers (unit-tested with mocks; real-key check needs owner keys)
- [x] Projects (instructions + files) and opt-in Memory (save_memory tool, view/edit/delete/search) — on device
- [x] DB schema + RLS ready (supabase/migrations, PGlite tests 7/7)
- [ ] NEEDS SUPABASE: accounts sync, cloud key vault, cross-device chats, pgvector memory search

## Phase 3 (on branch phase-2-chat)
- [x] Home: WebGL moon hero (phase follows scroll), provider marquee, feature story (built features only), privacy/open source, download CTA, FAQ, footer
- [x] /download: OS+arch detection, builds from GitHub Releases (hourly cache), PWA install steps per browser
- [x] PWA: manifest, icons, service worker (offline shell), install button
- [x] /privacy, /terms (honest about current data flow; update when accounts/analytics land)
- [x] Gate: Lighthouse mobile home 92/100/96/100, download 92; Chrome installability errors = none on preview (desktop + Android emulation)
- Distros switcher section deferred to Phase 8 (distros don't exist yet; no fake UI)

## Phase 4 (desktop, on branch phase-2-chat) — see docs/PLAN.md
- [x] Electron shell runs the Next app as a local server (standalone build, NODE_PATH -> deps/.pnpm/node_modules)
- [x] Secure preload bridge; API origin/Host guard (src/proxy.ts)
- [x] Ollama manager (detect, one-click install, start/stop), Ollama provider (desktop only)
- [x] Model Store: catalog (sizes/licenses from registry), hardware verdicts, HF GGUF search, pull with pause/resume
- [x] Terminals (node-pty + xterm), CLI quick launch / install
- [x] My AI Projects (Claude Code, Codex, Gemini, Cursor, git, Ollama; approved folders only)
- [x] Keys in OS keychain (safeStorage), start at login, tray, Alt+Space quick ask, moonlightc:// protocol
- [x] Windows installer built + silently installed + verified on this PC (server 200, foreign origin 403)
- [x] Gate checks: one-click model download + local chat (e2e), Claude Code opens in terminal (e2e). Chat path is local-only (127.0.0.1 -> Ollama).
- [x] CI release builds: Windows x64/arm64, macOS arm64/x64 (ad-hoc signed), Linux AppImage/deb/rpm x64/arm64 -> DRAFT release v0.1.0
- [x] Detect LM Studio / llama.cpp servers (desktop)
- [ ] Desktop SQLite + sync (needs Supabase)

## Phase 5 (remote control)
- [x] Local AI computer use on this PC: native per-session approval, overlay frame + in-app banner, Ctrl+Alt+Shift+M panic, 15-min timeout, destructive-step confirmation, audit log + viewer; vision-capable models only (12 desktop e2e)
- [ ] BLOCKED on Supabase: device registry, pairing/approval, MFA, relay (Realtime + WebRTC), remote screen/terminal/files, remote local-model chat

## Phase 6 (studio, on branch)
- [x] Studio: image/video/voice via fal, OpenAI, Google, xAI, Replicate, ElevenLabs; live model lists (fal catalog, Replicate collections, provider /models)
- [x] Video via startVideo + polling (no function timeouts); video downloaded from provider URL in browser
- [x] Gallery on device (IndexedDB): remix, download, send image to chat; Supabase Storage mirror later
- [x] e2e with faked provider routes; unit tests for model listing
- [ ] Gate needs real fal key (owner) — see OWNER_TODO

## Phase 7 (connections, on branch)
- [x] MCP client: custom URL connectors, desktop local commands (native approval dialog + allowlist), per-tool ask/always/never, in-chat approval
- [x] GitHub connector via token: live stats dashboard + GitHub MCP (46 tools) — verified with real GitHub
- [x] OAuth framework (PKCE, signed state, refresh) + Google connector: Gmail search/read, Calendar list/create (asks first), Drive search; desktop sign-in via website + moonlightc:// link; e2e with fake Google. Needs owner's Google OAuth client (OWNER_TODO #2)
- [x] MCP OAuth sign-in (discovery + dynamic client registration + PKCE, browser-held state): one-click Notion, Linear, Jira & Confluence, Asana, Sentry, Canva, Vercel, Supabase (start step verified against the real servers)
- [x] X (Twitter) bring-your-own bearer token: search recent posts (token checked live)
- [x] One-click MCP gallery extended: Zapier, monday.com, Airtable, Cloudflare, Webflow, Wix, PostHog, Intercom, Stripe, Square
- [x] YouTube (via the Google connector): search, my subscriptions, my playlists
- [x] Spotify (now playing, search, play/pause, playlists), Slack (channels, read, search, send with approval), Discord (servers): built and tested with fakes; appear once owner adds app credentials (OWNER_TODO #3)
- [x] Desktop automations: scheduled prompts on this computer (tray), run history, notifications, continue in chat
- [x] Subscriptions hub: consented Gmail receipt scan (sender/subject/date/snippet only) -> user's model extracts recurring charges; monthly totals per currency; renewal reminders (in-app + desktop notifications); manage links; manual add. Never pays or cancels.
- [ ] Cloud scheduled agents (pg_cron): need Supabase

## Phase 8 (customization, on branch)
- [x] Distros: Moon, Studio, Forge, Command, Offline + save/export/import/share link (validated, asks before applying)
- [x] Themes: Moonlight, Silver, Graphite, Midnight, Paper, High contrast; editor (8 tokens, roundness, wallpaper + tint)
- [x] Layout: hide sections, sidebar left/right, compact, big input; rebindable shortcuts (palette, new chat)
- [x] Mods: packages/mods-sdk, Mod Store (registry https://github.com/robertpierson/moonlightc-mods), permission review, sandboxed tools/panels, commands, modes, themes; docs/MODDING.md; example Unit Converter
- [x] README with screenshots, CONTRIBUTING, issue templates
- [x] Gate (local): switching distros restyles the app; installing the example mod adds a working tool (e2e)
- [ ] Drag/dock/undock panels (deferred: no panel system worth docking yet)

## Code workspace (SPEC §6, live)
- [x] Describe an app -> AI edits files via write_files/delete_files (browser-executed), live Sandpack preview, Monaco editor, diff + undo per change, zip download, push to a new private GitHub repo + Deploy on Vercel link, Save to folder (desktop). Projects in IndexedDB.

## Owner steps completed
(none yet)

## Known issues
- Screenshot/Lighthouse servers: use PORT=3100 so Playwright's reuseExistingServer never picks up a stale build on 3000.
- Vercel previews are SSO-protected; tests send x-vercel-protection-bypass (secret in .env.local and GitHub secret VERCEL_AUTOMATION_BYPASS_SECRET).
- Vercel MCP returns 403/404 for this team; use Vercel CLI (logged in as robertpierson196-1427). In Git Bash prefix `vercel api` with MSYS_NO_PATHCONV=1.
- No Docker, so no local Supabase stack; test against the hosted project.

## Notes (last 10)
- 2026-10-13: Desktop 0.2.0 built and installed on the owner's PC (silent NSIS). Fixed data loss: desktop now keeps port 47821 (saved in userData/port.json) so localStorage survives restarts. 14 desktop e2e.
- 2026-10-13: R9/R10: black accents on dark blue, link color token, profile name+picture (greets you, AI knows your name), My themes. Desktop tests now run hidden (no extra window/tray). 99 web e2e, 13 desktop e2e.
- 2026-10-13: R8b Chrome extension (apps/extension; zip at /downloads): share a tab, AI reads/clicks/types/opens; risky steps confirmed in an extension window (clickjack-proof), 15-min idle stop, Alt+Shift+M, audit. 97 web e2e incl. real-extension test.
- 2026-10-13: R8a desktop file access (folder grants live in the desktop app; server re-checks every path incl. links); 13 desktop e2e, 64 unit.
- 2026-10-13: R7 website redesign: always-light daytime-moon look with gradients; moon setup deferred until idle (Lighthouse mobile 92, a11y 100). 96 web e2e.
- 2026-10-13: R6 Claude plugins from GitHub (skills via load_skill, slash commands, agents as modes, MCP connectors; browse Anthropic's directory, verified against the real 315-plugin list). Fixed: mode/model changes didn't stick in a just-started chat. 96 web e2e.
- 2026-10-13: Owner requests R1-R5: Compare removed, mode menu (3 pinned + More options), Chat/Code switch, Claude-style Settings, Auto model; sign-in code ready (hidden until Supabase). 92 web e2e.
- 2026-10-13: X BYOK + 10 more one-click MCP services; in-text links underlined (a11y); 92 web e2e.
- 2026-10-13: Multi-provider OAuth (Google, Spotify, Slack, Discord); fixed desktop search-key deletion bug; 90 web e2e.
- 2026-10-13: Subscriptions hub; 87 web e2e.
