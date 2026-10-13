# How to start the MoonlightC build

## One-time setup
1. Install Claude Code if it isn't already, and sign in.
2. Open **PowerShell**, then type `cd C:\Users\rober\MoonC` and press Enter.
3. Type `claude` and press Enter. If it asks whether to trust this folder's settings/hooks, choose **Yes**.
   That's what lets it run without stopping.
4. Inside Claude Code, run `/model`, pick Opus 5.5, and set effort to high.
5. Optional: run `/remote-control` so you can watch and answer from your phone.

## Paste this as your first message

```
Build MoonlightC from scratch in this folder. CLAUDE.md is your rulebook and docs/SPEC.md is the product;
they override any assumption you make.

I don't code. You do all the engineering: install missing tools with winget, create the GitHub repo, the Supabase
project and the Vercel project yourself (MCP servers or CLIs). If a CLI needs me to log in, put the exact command in
docs/OWNER_TODO.md, tell me in one line, and keep working on anything that isn't blocked.

First: create docs/PROGRESS.md with line 1 "STATUS: BUILDING" and a checklist of every phase in SPEC §14. Also add
.claude/hooks/.continue-count to .gitignore. Then start Phase 0 and keep going through the phases without waiting
for me. Never ship a button that doesn't work.
```

## Every session after that
Open PowerShell, run `cd C:\Users\rober\MoonC` then `claude --continue`, and type **continue**.

## Why it might still stop, and what to do
- **Usage limit reached.** Nothing can get around this. Wait for the reset time it shows, then type `continue`.
- **It needs you** (`STATUS: WAITING_ON_OWNER`). Open `docs/OWNER_TODO.md`, do the steps, then type `done, continue`.
- **It asks before something risky** (deleting a project, force-pushing, buying a domain). That's on purpose.
  Read it and answer.
- **25 automatic "keep going" nudges in a row.** That's a safety cap so a stuck loop can't burn your whole limit.
  Type `continue`.
