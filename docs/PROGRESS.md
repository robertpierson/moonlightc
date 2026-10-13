STATUS: BUILDING

# MoonlightC progress

## Phases (SPEC §14)
- [ ] 0 Setup: prerequisites, GitHub repo, Supabase project, Vercel project, monorepo scaffold, CI — gate: `pnpm build` green, empty app live at moonlightc.vercel.app
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
- [ ] Monorepo scaffold (pnpm + turbo, apps/web Next.js)
- [ ] GitHub repo `moonlightc` (public, MIT)
- [ ] Vercel project `moonlightc` linked to repo
- [ ] Supabase project (BLOCKED: free-plan limit, see OWNER_TODO #1)
- [ ] CI (GitHub Actions: typecheck, lint, test, build, Playwright)
- [ ] Gate verified

## Owner steps completed
(none yet)

## Known issues
(none)

## Notes (last 10)
- 2026-10-13: session 1 started.
