# Plan: investor round (Nov 18, 2026)

Owner asked (Nov 18, 2026, then went to sleep; "keep working, put it live after"):
- Site: cooler, metallic greys (watered-down tungsten/cobalt, never warm), a texture you can actually see, sharp on
  every screen (phone, Chromebook, laptop, desktop, ultrawide, short landscape). Investor-ready.
- Research, again and again, what today's AI apps lack (e.g. browser remote control, good images), then fix those in MoonlightC.
- Commands like Claude's slash commands, but Python-simple.
- A free built-in course on the site (like Anthropic's courses) teaching everything: the app, themes, connectors,
  Vercel, Supabase, and connecting Claude Code.
- More customizing: a few modes up to "full creative control", previewed live before saving (like Discord).
- Fix all bugs. Not hundreds of random tabs.

Steps (each: build, typecheck, lint, unit, Playwright, screenshots; then push):
1. Palette + texture: cool tungsten/cobalt silver tokens, visible grain/brush, contrast checked; viewport matrix
   screenshots (375x812, 412x915, 768x1024, 1366x768 Chromebook, 1440x900, 1920x1080, 2560x1080, 900x500 landscape).
2. Research loop (subagent): gaps in current AI apps, with sources -> docs/RESEARCH.md, ranked by value and feasibility.
3. Simple commands in chat: "/" menu, plain-word commands, /help, your own commands with {input}.
4. Course at /course: modules and lessons, progress kept in the browser, accurate to the real app.
5. Customization modes (Simple, Standard, Full control) with live preview and Save / Reset.
6. Features from the research, highest value first.
7. Bug sweep (full suites, site audit), investor polish, push live, OWNER_TODO "try this" list.
