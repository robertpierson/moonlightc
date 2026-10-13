# MoonlightC (MoonC) — Standing rules for every Claude Code session

At the start of every session read `docs/PROGRESS.md` and resume from the first unchecked item (the owner may type
only "continue"). Read `docs/SPEC.md` §14 plus only the SPEC sections the current phase needs — not the whole file
every session.

## Run continuously (the owner wants this to never stop)
- Line 1 of `docs/PROGRESS.md` is always one of: `STATUS: BUILDING`, `STATUS: WAITING_ON_OWNER`, `STATUS: DONE`.
  While it says BUILDING, do not end your turn: finish a task, update PROGRESS.md, and start the next one.
- Never pause to ask "should I continue?", never wait for approval of a plan, and never stop at a phase gate. Verify the
  gate yourself, write the owner's "try this" list into `docs/OWNER_TODO.md`, and start the next phase.
- When something needs the owner (a login, an OAuth app, a key, a payment), add numbered steps to `docs/OWNER_TODO.md`
  and **keep building everything that isn't blocked by it**. Set `STATUS: WAITING_ON_OWNER` only when literally every
  remaining task is blocked, then end your turn with a 5-line summary pointing to OWNER_TODO.md. When the owner
  replies, set it back to BUILDING.
- Don't use plan mode (it waits for approval). Write a short plan to `docs/PLAN.md` at the start of each phase and proceed.
- If you hit the same error 3 times, record it in PROGRESS.md under "Known issues", work around it or move to the
  next unblocked task, and come back later.

## Be resource-efficient (the owner's usage limits are finite)
- Search with Grep/Glob and read only the line ranges you need; don't re-read files you already have in context.
- Never dump long output into the conversation: pipe builds, tests and logs through `tail`/`Select-Object -Last 40`
  or grep for errors.
- Take screenshots only at phase gates and for UI you just changed. Prefer Playwright assertions over looking at images.
- Delegate mechanical work (broad searches, running test suites, bulk renames, lint fixes) to subagents on a cheaper
  model (`sonnet` or `haiku`). Keep design, architecture, security and hard debugging on the main model. Never run
  more than 2 subagents at once.
- Install dependencies once per phase, not per task. Reuse components instead of regenerating similar code.
- Keep PROGRESS.md short: a checklist and the last 10 notes. Archive older notes to `docs/PROGRESS_ARCHIVE.md`.

## Who you are working for
- The owner (Shawn) does not code. You do 100% of the engineering: installing tools, writing code, creating
  databases, setting environment variables, deploying, testing, and fixing.
- When a step truly needs a human (logging in to a website, creating an OAuth app in a console, pasting an API key,
  paying for something), stop and give **numbered, click-by-click steps**: exact URL, exact button names, exact text
  to copy, and exactly where to paste it. One task at a time. Then verify it worked yourself.
- Explain results in plain English, in 3–6 lines. No jargon without a one-line explanation.

## The previous attempt failed. Do not repeat its failures.
A prior build ("MoonlightV", moonlightv.vercel.app) shipped a good-looking shell where almost nothing worked:
- Email/password sign-in returned "Invalid login credentials" and the account flow was confusing.
- The deployed web app had **no model of its own**: "This page has no model of its own — choose your PC in Settings".
  Everything depended on Ollama running on the same machine, so it was useless on any other device.
- "The model is not running. Start Ollama and it reconnects" — the app never installed or started anything itself.
- The GitHub dashboard showed all zeros; the "Claude Code" code tab was a placeholder; a LAN-only "MsV Chat" tab
  existed that nobody needed (do NOT rebuild it).
Do not reuse any code from that project. Start clean in this folder.

## Non-negotiable rules
1. **No fake UI.** Every button, tab, toggle and setting that ships must work end-to-end. If a feature isn't built,
   it is not visible. No placeholder data, no "coming soon" buttons, no dead settings. Empty states always offer one
   real next action (e.g. "Add an OpenAI key" that opens the working key form).
2. **Prove it before you say it's done.** For every task: typecheck, lint, unit tests, and a Playwright run against
   the real running app (local and then the Vercel preview URL). Take screenshots of key screens and look at them.
   Never report a feature as working that you have not exercised.
3. **Keep `docs/PROGRESS.md` current** after every completed task: checklist of phases/tasks, what's done, what's
   next, known issues, and every manual step the owner has completed. A brand-new session must be able to continue
   from this file alone.
4. **Record decisions** in `docs/DECISIONS.md` (one short entry per decision: what, why, alternatives).
5. **Secrets:** never commit them, never print them in full, never log API keys or message content. Use
   `.env.local` (git-ignored), Vercel env vars (via CLI/MCP), and Supabase secrets.
6. **Never do without the owner's OK** (log it in OWNER_TODO.md and work on something else meanwhile): spending money,
   deleting data or projects, anything irreversible, publishing a public release, or sending anything to a third
   party on the owner's behalf.
7. **Don't trust your memory for fast-moving facts.** Fetch AI model lists from each provider's API at runtime;
   check current docs/package versions before using a library; never hard-code model names as "latest".
8. **Security first for anything that touches a user's computer** (remote control, terminals, screen control,
   file access). Follow the safety requirements in `docs/SPEC.md` §8 exactly.
9. Work in the phase order in `docs/SPEC.md` §14. End each phase by passing its gate and adding a short "try this
   yourself" list (max 6 steps) to `docs/OWNER_TODO.md`, then continue immediately.
10. Small commits with clear messages, pushed to GitHub. Vercel deploys previews automatically; promote to
    production only after the phase gate passes.

## Tooling you are allowed and expected to use
- Supabase MCP / Supabase CLI for projects, migrations, RLS, auth config, storage, edge functions.
- Vercel MCP / Vercel CLI for projects, env vars, domains, deployments, logs.
- GitHub CLI (`gh`) for the repo, releases, and Actions.
- `winget` to install missing Windows prerequisites (Node LTS, pnpm, Git, GitHub CLI, Vercel CLI, Supabase CLI).
- Playwright for end-to-end testing and screenshots.
