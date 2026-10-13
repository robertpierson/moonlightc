STATUS: BUILDING

# MoonlightC progress

## Phases (SPEC §14)
- [x] 0 Setup: prerequisites, GitHub repo, Supabase project, Vercel project, monorepo scaffold, CI — gate: `pnpm build` green, empty app live at moonlightc.vercel.app
- [ ] 1 Accounts and metrics: sign-in methods, identity linking, onboarding, profiles, PostHog, /admin, privacy, terms
- [ ] 2 Chat core: provider registry, key vault, model picker, streaming/stop, chats, projects, attachments, artifacts, memory, modes, compare, search
- [x] 3 Marketing site, download page, PWA (built on branch phase-2-chat; ships to prod with Phase 1+2)
- [~] 4 Desktop app: Electron, offline SQLite + sync, Ollama manager, Model Store, terminals, My AI Projects, tray/hotkey, CI release builds
- [ ] 5 Devices and remote control (§8 safety)
- [ ] 6 Creative studio: images, video, audio, gallery
- [ ] 7 Connections and automations: MCP client, GitHub, Google, Discord, Spotify, Notion, Slack, YouTube, custom MCP, subscriptions, scheduled agents, deep research
- [ ] 8 Customization: distros, themes/editor, layout, mods SDK and store
- [ ] 9 Hardening: security review, RLS audit, perf, a11y, docs, v1.0 release

## Phase 0 tasks
- [x] Check prerequisites (node 22, pnpm 11, git, gh logged in as robertpierson; Vercel + Supabase via MCP)
- [x] Monorepo scaffold (pnpm + turbo, apps/web Next.js 16.4)
- [x] GitHub repo https://github.com/robertpierson/moonlightc (public, MIT)
- [x] Vercel project `moonlightc` (team app-project21, root apps/web, git-connected; main = production)
- [ ] Supabase project (BLOCKED: free-plan limit 2 active, see OWNER_TODO #1) — create in org umzghxzngixiedodscaa, us-east-2
- [x] CI (GitHub Actions: typecheck, lint, test, build, Playwright) green
- [x] Gate verified: build green, https://moonlightc.vercel.app 200, Playwright desktop+mobile pass on prod

## Phase 2 tasks (branch `phase-2-chat`, Vercel preview; merges after Phase 1)
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
- [ ] Azure OpenAI + AWS Bedrock providers
- [ ] NEEDS SUPABASE: accounts sync, key vault (cloud), projects, memory (pgvector), cross-device chats

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
- [ ] CI release builds (workflow desktop.yml -> draft release) — first run in progress
- [ ] Desktop SQLite + sync (needs Supabase)

## Owner steps completed
(none yet)

## Known issues
- Screenshot/Lighthouse servers: use PORT=3100 so Playwright's reuseExistingServer never picks up a stale build on 3000.
- Vercel previews are SSO-protected; tests send x-vercel-protection-bypass (secret in .env.local and GitHub secret VERCEL_AUTOMATION_BYPASS_SECRET).
- Vercel MCP returns 403/404 for this team; use Vercel CLI (logged in as robertpierson196-1427). In Git Bash prefix `vercel api` with MSYS_NO_PATHCONV=1.
- No Docker, so no local Supabase stack; test against the hosted project.

## Notes (last 10)
- 2026-10-13: Phase 4 working on Windows; desktop e2e 8 tests; release workflow triggered.
- 2026-10-13: Phase 3 done on branch. 38 e2e tests. Next: Phase 4 desktop (Electron) since Supabase still blocked.
- 2026-10-13: Draft PR https://github.com/robertpierson/moonlightc/pull/1 carries Phase 2; CI green; 27 e2e tests.
- 2026-10-13: Phase 2 chat core working locally on branch phase-2-chat (device-local storage until Supabase).
- 2026-10-13: Phase 0 done. Next: Phase 2 provider layer (no DB needed) while Supabase is blocked; Phase 1 resumes when OWNER_TODO #1 is done.
