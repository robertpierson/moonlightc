STATUS: BUILDING

# MoonlightC progress

## Phases (SPEC §14)
- [x] 0 Setup: prerequisites, GitHub repo, Supabase project, Vercel project, monorepo scaffold, CI — gate: `pnpm build` green, empty app live at moonlightc.vercel.app
- [ ] 1 Accounts and metrics: sign-in methods, identity linking, onboarding, profiles, PostHog, /admin, privacy, terms
- [ ] 2 Chat core: provider registry, key vault, model picker, streaming/stop, chats, projects, attachments, artifacts, memory, modes, compare, search
- [ ] 3 Marketing site, download page, PWA
- [ ] 4 Desktop app: Electron, offline SQLite + sync, Ollama manager, Model Store, terminals, My AI Projects, tray/hotkey, CI release builds
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
- [ ] Modes/personas (General, Coder, Writer, Researcher, Tutor, Private incognito) + custom
- [ ] Attachments (images, PDFs, text/code files; drag-drop, paste)
- [ ] Artifacts side panel (HTML/SVG/Mermaid live, edit, download)
- [ ] Compare mode (2-4 models side by side)
- [ ] Command palette (Ctrl/Cmd+K)
- [ ] Tools: web search (Tavily/Exa/Brave BYOK), URL fetch
- [ ] Azure OpenAI + AWS Bedrock providers
- [ ] NEEDS SUPABASE: accounts sync, key vault (cloud), projects, memory (pgvector), cross-device chats

## Owner steps completed
(none yet)

## Known issues
- Vercel MCP returns 403/404 for this team; use Vercel CLI (logged in as robertpierson196-1427). In Git Bash prefix `vercel api` with MSYS_NO_PATHCONV=1.
- No Docker, so no local Supabase stack; test against the hosted project.

## Notes (last 10)
- 2026-10-13: Phase 2 chat core working locally on branch phase-2-chat (device-local storage until Supabase).
- 2026-10-13: Phase 0 done. Next: Phase 2 provider layer (no DB needed) while Supabase is blocked; Phase 1 resumes when OWNER_TODO #1 is done.
