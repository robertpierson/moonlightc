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
- [x] R31 Remote: See screen from Cowork, full screen, leaving ends the session, smaller frames for busy screens
- [x] R32 Trusted mode on the PC (own devices skip Allow; logged; confirm dialog)
- [x] R33 Claude preselected instead of OpenRouter; OpenRouter is an option, not the pitch
- [x] R34 Model library back in the sidebar (desktop)
- [x] R35 Home PC local models usable in Chat on other devices (custom transport over the remote link; never synced)
- [x] R36 Key scan: fixed registry path bug; scans .env files and key formats; desktop offers found keys once
- [x] R37 Quick connect gallery: opens the company's key page and picks up the copied key (no pasting)
- [x] R38 Website: glossy navy palette, moon shading in navy
- [x] R39 GitHub sign-in: enabled by owner 2026-10-14; live button verified to reach GitHub with the right callback
- [x] R40 Readable selected/disabled buttons in dark mode (own "selected" colors); quick connect asks before opening a site
- [x] R41 Model menu in the message box; each company shows its main models (from the live list) + "Show all"; thinking level per company
- [x] R42 Models that fail with "not on your plan" / "not recognized" / "out of credit" are labeled; "Choose another model" button
- [x] R43 AI-written chat titles; Copy chat; Continue in a new chat (summary); Trash (30 days, restore, empty); no sideways scrolling in sidebars
- [x] R44 Remote screen (with sound on Windows, on/off + volume): live WebRTC video (Supabase channel for signaling, public STUN), picture fallback drawn flicker-free, zoom 100-300%, wheel and keyboard pass-through, clicks as screen fractions; screen capture only within 10 s of an allowed device asking
- [x] R45 Code tab: tabs on narrow screens, assistant + panel (hideable) on wide ones, project actions in a More menu, wrapping assistant header; rename/delete single code chats
- [x] R46 Code preview built in (public/preview-runtime.js: React + sucrase + tiny module loader, sandboxed srcdoc iframe; rebuild with scripts/build-preview-runtime.mjs); Sandpack removed (outside service was blocked on the owner's network)
- [x] R47 Trash button in the sidebar; Claude Code (desktop): the owner's installed `claude --print --output-format stream-json` is a model (Opus/Sonnet/Haiku 5.5) in Chat, Cowork and Code via lib/local-transport.ts; IPC only, clean env, stdin prompt, one CLI session per chat
- [x] R48 Sidebar shows 5 recent chats + See more; opening a chat no longer moves it to the top
- [x] R49 Staff panel (/admin, Settings > Staff for admins): right now (active people, PCs online, events/errors per hour), people list with search and per-person activity/devices/providers, errors grouped (app.error events: message, path, version only). staff_* SQL functions need admin + aal2. No keystroke logging or message content (declined).
- [x] R50 Remote game mode (held keys, mouse buttons, pointer-lock relative mouse, keyboard lock for Escape in full screen; input over the WebRTC data channel; held keys released when a session ends); fallback pictures smaller with two in flight
- [x] R51 Claude Code from other devices via the home PC ("claude" remote request, chat tier; models 'Claude Code · …' under Home PC; per-chat CLI session)
- [x] R52 Remote: lower delay (no jitter buffer, motion hint in game mode, 60 fps / 8 Mbps caps, host window never throttled), hi-fi stereo audio (no call filters), double Esc leaves game mode + full screen; raw relative mouse via SendInput (koffi) so games turn
- [x] R53 Model menu: company first, top 3 models + Show all; thinking Off for Gemini 2.5 Flash / OpenAI
- [x] R54 Other devices link to the home PC's AI models automatically (chat-only sessions: no prompt, no frame, no idle cut-off); remote control stays separate
- [x] R55 Separate Trash for Chat, Cowork and Code (code chats restorable into their project); Settings > Privacy > Empty all Trash
- [x] R56 Claude Code effort levels (--effort, here and via the home PC); AI access from own devices (chat/files/terminal) connects without the Allow prompt or frame, screen view/control still asks; remote-control and AI link use separate client ids; Home PC dropdown (Connect / Remote control); chat side panel in remote control
- [x] R57 Live sync: chats, settings and connections in the realtime publication; devices pull within ~0.3 s of a change elsewhere
- [x] R58 Unsent message text kept per chat; home PC shows Offline (no connect) when not seen for 3 min; home PC models only listed while connected
- [x] R59 (owner's list, 2026-10-16) Remote control picture-in-picture when leaving the tab (view-only, movable/resizable, control resumes on return)
- [x] R60 Sync web-search keys/settings across the account (searchKey not in SYNCED_KEYS; keys belong in Vault like connections)
- [x] R61 Done as account-level "Connect to my PCs without the code" (private.quick_access; can_use_device_channel accepts it). Was: "Remember this device" (not called risky): after one 2FA on a device, it can connect to the home PC without the code again; off by default; turn off without a code. Needs design: Supabase aal2 is per session, so use a device-bound credential stored in Vault + checked by a SECURITY DEFINER channel policy. Owner also wants any computer to connect without a code in emergencies: discuss risks before building
- [x] R62 Wake guide + MAC in Settings > Remote control. Was: Wake the home PC remotely (Wake-on-LAN needs an always-on device on the home network or a router with WoL; investigate options, owner steps likely)
- [x] R63 Adaptive theme (Settings > General > Follow the sun; lib/sun.ts): from the person's location, gets darker with the sun/moon cycle
- [x] R64 Allowed places for remote control (PC setting, off by default): IPs (with * wildcard) and countries; signed location notes from /api/attest (ATTEST_SECRET in Vercel), verified by the PC; blocked attempts listed with one-click Allow

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
- 2026-10-14: Owner confirmed remote control from Chromebook works end to end (0.6.0).
(none yet)

## Parked by the owner (2026-10-22, "some other day"): ask before starting any of these
Current version everywhere: 0.6.34 (desktop installed, web live, extension zip). Remote control: live video works
(normal rights), Shortcuts menu, Shift/Ctrl/Alt holds, Power menu (Sleep/Restart/Shut down; Lock removed).
1. Done 2026-10-22: admin mode is off (task gone, PromptOnSecureDesktop=1, normal startup entry back).
2. **"Stop the popup" switch (owner decision):** ConsentPromptBehaviorAdmin=0 so admin-approval boxes never appear
   (avoids getting stuck remotely). Lowers protection against malware; ~10 min to build. Explained, not built.
3. **Top-level background service** (like TeamViewer/Chrome Remote Desktop) to see/answer the sign-in screen and UAC/PIN
   boxes remotely: ~1-2 days + 2-3 owner-at-PC tests, secure screens choppier at first; security risk (account takeover
   = full PC control; owner turned off the authenticator requirement). Owner said not worth it for now.
4. Done 2026-10-23: TURN relay live (owner key in Vercel env; others add theirs in Settings > Account).
5. **Watch-only screen sharing from any browser** (no app; phones can't share their screen): offered, not chosen.
7. Self-test harness exists (`MoonlightC.exe --selftest` -> selftest-result.json) for screen-capture problems.

## Known issues
- Claude Code CLI default model (Fable) needs usage credits on the owner's plan; the panel defaults to Sonnet.
- Screenshot/Lighthouse servers: use PORT=3100 so Playwright's reuseExistingServer never picks up a stale build on 3000.
- Vercel previews are SSO-protected; tests send x-vercel-protection-bypass (secret in .env.local and GitHub secret VERCEL_AUTOMATION_BYPASS_SECRET).
- Vercel MCP returns 403/404 for this team; use Vercel CLI (logged in as robertpierson196-1427). In Git Bash prefix `vercel api` with MSYS_NO_PATHCONV=1.
- No Docker, so no local Supabase stack; test against the hosted project.
- A hard crash can still lose the last ~30 s of cookie changes (sign-in refresh). Cookie flush hooks break relaunch (CI bisect 2026-10-14); revisit with a different approach if it bites.
- Owner asked (2026-10-13): never move the mouse/keyboard or show windows on their PC. Locally run desktop e2e with `--grep-invert "computer use|remote control"`; those run in CI. Update desktop: `MoonlightC.exe --quit`, then installer `/S`, then `MoonlightC.exe --hidden`.

## Notes (last 10)
- 2026-11-09: owner saw the stone wall live and hated it; removed it entirely (kept the no-gradient polish, icons, brand marks, plain Download button). Ask what they dislike before adding big new sections.
- 2026-11-09: website polish per owner: removed corner chips, gradient text/buttons, card glow/tilt/fade-ups; Phosphor icons + real AI brand marks; home Download goes to /download; new stone wall on home (stones fly out in a wave on scroll); marquee/gallery fade at edges. 32/32 tests pass.
- 2026-11-09: owner found the floating hero chat bubbles ugly; removed them (component + CSS). Hero is back to headline, buttons, moon. Keep the hero clean.
- 2026-11-09: Motion round inspired by the owner's teen-assist.vercel.app: StickySteps now takes device=phone|laptop (pinned device frame, screens crossfade with blur+scale, progress rail with dots); Remote page set-up steps shown on a phone (4 new phone screens in demos.tsx), Models/Code on a laptop; floating chat bubbles around the home headline (enter one by one, bob, drift on scroll; xl screens only); reading-progress bar under the header; chips that scatter as the demo film grows (hidden where scroll timelines aren't supported and under reduced motion); second marquee row moving the other way. axe clean on 7 pages x 2 schemes; home+a11y e2e 32 passed. Tester guide for friends: docs/MoonlightC-Tester-Guide.txt.
- 2026-11-09: LAUNCHED. Owner said publish the desktop release (no Chrome Web Store; extension installs from the zip). Built 0.6.64 installers on CI (all 4 jobs green), attached the extension zip, published v0.6.64 as latest. Checked anonymously: releases/latest/download/* returns 200 for .exe/.dmg/.AppImage/.zip. Site redeployed so the main button reads Download for <OS>. Mac note now says Privacy & Security > Open Anyway (ad-hoc signed, not notarized). Desktop app has no auto-updater, so the owner's running copy was not touched. Old drafts v0.1.0 and v0.6.63 left as drafts.
- 2026-11-09: Website polish rounds (owner: 'make apple look bad', keep going). Moon: procedural craters/seas/grain, drawn once in 10 strips (no GPU watchdog risk), no blending (blending greyed the halo). Night sections around films (page + text colors animate together; header switches via IntersectionObserver -> html[data-night]); sideways gallery; word-by-word statement; count-ups; pointer spotlight + tilt; Lenis smooth scroll; moon under every page hero; Try it now box -> /app?q= (full page load; app prefills, never sends). Demo film re-shot with honest 'Sample answers' label and step marks; DEMO_CAMERA zooms (unit tested). Bugs found and fixed by my own checks: header keyframes dropped in an edit (now an e2e test), extension test race on Allow/Deny. Speed at 4x CPU throttle: LCP 0.24-0.39 s, CLS 0, 0-2 slow frames per page scroll. axe clean on 7 pages; home.spec 18 passed.
- 2026-11-08: 0.6.64. Owner: drop the small moon, a giant moon over the bottom half instead; more mature blue; Apple-style scroll scenes (ref: apple.com/macbook-pro/proled-xdr-display); separate pages; a real demo video. Built: moon shader rewritten as a horizon disc (draws only on scroll/resize); palette moved to deep navy (#24365f / #1b2744); pages /models /remote /code /extension with pinned scenes (CSS view-timeline 'scene-grow'), sticky steps (scenes.tsx), giant sliding names; shared PAGES and DEMO_CHAPTERS in site/pages.ts (client modules can't export data to server components). Demo video: the real app filmed headlessly with CDP screencast, answers from scripts/demo/demo-ai.mjs (stand-in, no AI spend), 26 s, 2.6 MB, labeled on the page as scripted answers; how to re-film in scripts/demo/README.md. axe clean on 7 pages; home.spec 14 passed locally.
- 2026-11-08: 0.6.63. Owner asked for a Cluely-style site in white/silver, no theme switching on the site, app dark by default, launch-ready Chrome extension. Site rebuilt (components/site: chrome.tsx header/footer, demos.tsx animated mockups, landing, download, doc pages); ThemeProvider forces light on /, /download, /privacy, /terms and defaults the app to dark. Moon shader bug: minified '#fff' was parsed as blue; fixed. axe clean on site pages in both schemes; headless screenshots desktop + phone, no overflow. Extension: navy icons 16-128 from the app icon, rebranded popup/confirm/banner, store listing + screenshots in apps/extension/store (store-shots.mjs). Launch blockers needing the owner: no public desktop release (only drafts), Web Store $5 fee. Both in OWNER_TODO. Follow-ups: usePathname in the root ThemeProvider broke prerendering of /share/[id], so routes are split into (app) (ThemeProvider, dark default, toasts) and (site) (SiteLight undoes the app's look). desktop.yml now makes one draft before the matrix (parallel builds had made two) and installs X11 headers for Linux robotjs; draft v0.6.63 has all 20 files. CI green; site live.
- 2026-11-07: 0.6.62. Keep this PC awake (off by default; on for the owner at their request): main-process prevent-app-suspension, checked with powercfg /requests on CI. Why: 4 idle sleeps on 11-06 (event 42 reason 7) with remote control on; the old blocker lives in the page. Not settled: whether the app was running during those sleeps (its files stopped changing at 11:08 AM, it next started at 11:41 PM, no crash logged). app-health.log now records start, quit, sleep and wake to answer that. Relay count: private.relay_usage had 0 rows ever. The viewer only counted its own candidate, so a relay on the PC's end was missed, and the panel rounded under 30 minutes to 0. Fixed and unit tested; not exercised on a real relayed session. Past relay time can't be recovered from the app; Cloudflare's dashboard has it. The 200-hour cap relies on this count. Installed on the owner's PC with stay-awake on. On 0.6.61 a `--quit` second copy hung for about 4 minutes and that install silently kept the old version; the retry worked. Possibly linked to the owner's slow open from Windows search (unproven); the second-copy fix shipped in 0.6.62. Update scripts must not wait on `--quit` and must check the version after.
- 2026-11-06: 0.6.61. Remote typing into Windows' credential box (passkey PIN). Cause: since the January 2026 update (CVE-2026-20824, KB5080542) CredentialUIBroker.exe runs at integrity 0x200a, above normal apps, and UIPI silently drops their input. Fix: opt-in helper (src/MoonlightCInput.cs) built at setup into Program Files, started on request by a Highest-rights scheduled task, typing only while that box is in front, no Ctrl/Alt/Windows keys, no logging. MoonlightC stays at normal rights so live capture keeps working. CI (.github/workflows/pin-box.yml, run 42185360495, true medium integrity): normal typing dropped; typing, Enter and a click on Cancel reach the box; refused with no box; off removes it. The box shows in screen capture (affinity 0). The website passkey call on the runner also opens CredentialUIBroker.exe, behind other windows. Also passes inside real Electron with the watchdog thread (run 42187107765). NOT tested: a real Windows Hello PIN (runners have none), and it needs the owner's Yes at the PC. Ships in the next build, not the installed 0.6.61: only the copy that stays starts the watchdog (a quitting second copy printed a koffi crash, seen on `--quit`; the running app wasn't affected). Also confirmed 11-05 11:07 AM on the owner's PC: the freeze fix let go of a stuck press and no freeze followed.
