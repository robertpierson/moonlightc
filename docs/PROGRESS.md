STATUS: BUILDING

# MoonlightC progress

## Phases (SPEC §14)
- [x] 0 Setup: prerequisites, GitHub repo, Supabase project, Vercel project, monorepo scaffold, CI — gate: `pnpm build` green, empty app live at moonlightc.vercel.app
- [ ] 1 Accounts and metrics: sign-in methods, identity linking, onboarding, profiles, PostHog, /admin, privacy, terms
- [ ] 2 Chat core: provider registry, key vault, model picker, streaming/stop, chats, projects, attachments, artifacts, memory, modes, compare, search
- [x] 3 Marketing site, download page, PWA (built on branch phase-2-chat; ships to prod with Phase 1+2)
- [x] 4 Desktop app (on branch; SQLite+sync waits for Supabase): Electron, offline SQLite + sync, Ollama manager, Model Store, terminals, My AI Projects, tray/hotkey, CI release builds
- [~] 5 Devices and remote control (§8 safety): built (devices, approval, Realtime relay, screen/control/terminal/files/local-model chat, aal2-only channels, overlay, panic, timeout, audit); live phone↔PC check needs the owner's account with two-step sign-in
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
- [x] R12 Sidebar per tab: Chat shows chat things only; Code shows code things (terminal, Projects renamed from My AI Projects); visibly different Code sidebar
- [x] R13 Recent chats only in sidebar; older in "All chats" (click to open)
- [x] R14 Memory and settings-like items move into Settings
- [x] R15 Projects like Claude: folders grouping chats, with instructions, files, connectors and skills per project; code projects in folders too
- [x] R16 Code permission modes: Ask, Auto-accept edits, Plan, Bypass (warning)
- [x] R17 Cowork tab (Chat | Cowork | Code): files, screen and browser tabs with permissions
- [x] R18 Settings > Usage: tokens and cost per model, OpenRouter credits and limits
- [x] R19 Rebuild + install desktop so it matches
- [x] R8c (needs Supabase, Phase 5) remote control from another device
- [x] R20 Same colors in every tab (Code sidebar back to normal)
- [x] R21 Toggle buttons show selected immediately (even while hovered)
- [x] R22 Code: a project is a group of chats; chats saved (same model as Chat and Cowork)
- [x] R23 Plugins & mods catalog: featured row, then everything, searchable
- [x] R24 Settings > Usage: your plans first (what you pay), tokens, value at list prices
- [x] R25 Desktop: scan this PC for existing API keys (environment) and add them with one click
- [x] R26 Rebuild + install desktop app (0.5.0 installed silently on owner PC)
- [x] R27 Settings: Discord-style "unsaved changes — Reset / Save" bar; leaving with unsaved changes is blocked
- [x] R29 Fix: finishing onboarding looped back to step 1 (email link pointed at onboarding); already-onboarded people skip it
- [x] R28 Home PC: from any signed-in device, the AI works on your home PC's folders and code projects (with your approval)
- [x] R30 Final pass: verify sign-in, create account, key checks and every feature; web app, desktop app and Chrome extension all on the same version

## Phase 0 tasks
- [x] Check prerequisites (node 22, pnpm 11, git, gh logged in as robertpierson; Vercel + Supabase via MCP)
- [x] Monorepo scaffold (pnpm + turbo, apps/web Next.js 16.4)
- [x] GitHub repo https://github.com/robertpierson/moonlightc (public, MIT)
- [x] Vercel project `moonlightc` (team app-project21, root apps/web, git-connected; main = production)
- [x] Supabase project MoonlightC (ref znkusjdspjssmwohrbzl, us-east-2): migrations applied, advisors clean, auth URLs + manual linking set, owner email auto-admin (private list)
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
- A hard crash can still lose the last ~30 s of cookie changes (sign-in refresh). Cookie flush hooks break relaunch (CI bisect 2026-10-14); revisit with a different approach if it bites.
- Owner asked (2026-10-13): never move the mouse/keyboard or show windows on their PC. Locally run desktop e2e with `--grep-invert "computer use|remote control"`; those run in CI. Update desktop: `MoonlightC.exe --quit`, then installer `/S`, then `MoonlightC.exe --hidden`.

## Notes (last 10)
- 2026-10-14: Fix: desktop lost its sign-in when force-closed for an update (Electron writes cookies on a timer). Updates now use `MoonlightC.exe --quit` (clean exit), installer `/S`, `MoonlightC.exe --hidden` (tray only; also start-with-Windows). A crashed app's leftover server is ended on start (only if it answers as MoonlightC) so the port and data stay. Tried flushing cookies on every change: it made quick relaunches hang on CI (bisected), so removed. All apps 0.5.4.
- 2026-10-14: Fix: phone couldn't reach home PC (phone session was aal1; Realtime RLS needs aal2). Cowork home-PC Connect now asks for the two-step code first and shows the real error. All apps 0.5.1.
- 2026-10-13: R25 key scan (env vars + Windows user env, masked, add only picked) and R28 home PC (Settings > Remote control > Make this my home PC; Cowork on another device connects, AI gets pc_list/read/write/run tools, writes + commands need Allow on that device, PC still enforces tiers + home folder, audit). Fixed: background defaults (Ollama auto-detect) made Settings look unsaved and blocked leaving; unsaved changes blocked quitting the desktop app (now asks). All versions 0.5.0. 77 unit, 113 web e2e, 11 PGlite, 18 desktop e2e.
- 2026-10-13: Remote control: devices table + private Realtime channels (owner + aal2 only, enforced by RLS), PC approves each device (remember option), screen ~2 fps JPEG, mouse/keyboard, xterm terminal, home-folder files, local-model chat; orange overlay, one panic key for AI + remote, 15-min idle end, audit. 11 PGlite, 72 unit, 15 desktop e2e.
- 2026-10-13: Supabase live. Accounts on (email + magic link; Google/GitHub need owner OAuth apps). Sync engine (chats, settings, keys via Vault) with two-device test; delete account + download counts via DB functions (no secret key). Vercel env set; desktop build bakes the public URL/key. 10 PGlite, 69 unit, 109 web e2e.
- 2026-10-13: Chat | Cowork | Code modes with their own sidebars (editor-style Code sidebar), recents capped at 15 + All chats, Claude-style chat Projects (move chats in, connectors + skills per project), code folders, code permission modes (ask/auto/plan/bypass), Cowork (files, screen, browser with permissions), Settings > Usage (tokens, est. cost, OpenRouter credits) and Memory. 109 web e2e, 14 desktop e2e, 67 unit.
- 2026-10-13: Sign in with OpenRouter (PKCE, web + desktop deep link). Phase 1 prep, hidden until Supabase: onboarding (7 steps, 13+), Settings > Account (link/unlink, TOTP two-step, export, delete), /admin (retention, onboarding answers, downloads, local vs cloud), /api/track with EU consent, privacy text. 8 PGlite tests, 66 unit, 102 web e2e.
- 2026-10-13: Desktop 0.2.0 built and installed on the owner's PC (silent NSIS). Fixed data loss: desktop now keeps port 47821 (saved in userData/port.json) so localStorage survives restarts. 14 desktop e2e.
- 2026-10-13: R9/R10: black accents on dark blue, link color token, profile name+picture (greets you, AI knows your name), My themes. Desktop tests now run hidden (no extra window/tray). 99 web e2e, 13 desktop e2e.
- 2026-10-13: R8b Chrome extension (apps/extension; zip at /downloads): share a tab, AI reads/clicks/types/opens; risky steps confirmed in an extension window (clickjack-proof), 15-min idle stop, Alt+Shift+M, audit. 97 web e2e incl. real-extension test.
