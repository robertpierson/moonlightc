# Research round 2: what competitors have that MoonlightC lacks

Method: 16 web searches plus 5 page fetches (TypingMind feature list, Open WebUI features, Msty Studio features,
LibreChat features, plus search digests for the rest). "Lacks" is judged against the feature list in the owner's brief,
not by reading the code, so check the repo before building (some items may be partly there).
Sizes: S = about a day, M = a few days, L = a week or more. None of the items need a paid dependency unless noted.

## 1) Top 15 missing features, ranked

1. **Knowledge base / chat with your files (RAG)**
   - Who: TypingMind, Msty (Knowledge Stacks), LibreChat, Open WebUI, Cherry Studio, Chatbox, LobeChat, Claude Projects, Gemini.
   - Why users like it: the model answers from their own PDFs, notes and sites, and shows where the answer came from.
   - Build (M): attach files, URLs and pasted text to a Project; split into chunks, embed with the user's own key (OpenAI/Google/Voyage)
     or a free embedding model, store in Supabase pgvector (web) or a local file (desktop); retrieve top chunks, cite sources.
     Add a "test retrieval" box like Cherry's. Cost: embedding calls only, paid by the user's key.
2. **Ask many models at once (side-by-side chat) and @mention a model in a thread**
   - Who: Msty (Split Chats), Cherry Studio, Open WebUI, TypingMind, Poe (@mention bots), Perplexity (Model Council), LibreChat.
   - Why: the most-praised power-user feature; you pick the best answer instead of guessing the best model.
   - Build (M): one prompt fans out to 2-4 chosen models in parallel columns; "keep this one" continues the chat with the winner.
     Reuse Studio's Compare layout and the existing mid-chat model switch. @model in the composer routes one turn to that model.
3. **Deep Research (long cited report)**
   - Who: Perplexity, ChatGPT, Claude Research, Gemini (Deep Research Max), Open WebUI.
   - Why: one question becomes a sourced multi-page report instead of a chat reply.
   - Build (M): a loop of plan, several web searches, read pages, write; stream progress steps; save the report as an artifact.
     Reuse the existing web search tool; cap steps and tokens and show cost before starting. Runs on the user's own key.
4. **Scheduled tasks / automations**
   - Who: ChatGPT (Scheduled Tasks, which replaced Pulse in 2026), LibreChat (Scheduled Chats), Open WebUI (Automations), Msty (Turnstiles, paid).
   - Why: a daily briefing or weekly report shows up without anyone asking.
   - Build (M): save a prompt plus model plus connectors plus schedule; run via Vercel Cron on web or an Electron timer on desktop;
     result lands as a new chat with a notification. Keys must be available server-side, so use the existing encrypted key sync and a budget cap per run.
5. **Global hotkey quick chat, "act on selected text", and screenshot-to-ask (desktop)**
   - Who: BoltAI (instant chat bar, inline AI command, ShotSolve), Cherry Studio, Chatbox, ChatGPT desktop.
   - Why: AI is one keystroke away in any app; BoltAI users cite this as the reason they pay.
   - Build (M): Electron globalShortcut opens a small always-on-top input; a second shortcut grabs the selection (clipboard method first,
     accessibility later) and runs a saved slash command on it; third shortcut uses desktopCapturer. Must be tested in CI, not on the owner's PC.
6. **Share a chat by link, and export as PDF/HTML**
   - Who: TypingMind, ChatGPT, Claude, Poe, Perplexity (Pages).
   - Why: easy to show a result to someone without copy-paste.
   - Build (S): "Share" stores a read-only snapshot under a random id in Supabase (owner can revoke; private chats cannot be shared);
     public page renders it. PDF via print stylesheet. Needs owner OK before any public sharing ships (CLAUDE.md rule 6).
7. **Canvas editing of a reply (select text, rewrite, change tone)**
   - Who: TypingMind (Canvas), ChatGPT canvas, Gemini Canvas, Open WebUI Notes.
   - Why: you refine a document in place instead of re-prompting the whole thing.
   - Build (M): a document-type artifact with a text editor; selecting a range shows "Shorter / Friendlier / Fix grammar / Custom"; the model
     returns only the replacement for that range. Keep version history so undo works.
8. **Connect any OpenAI-compatible endpoint, and serve MoonC's own as one**
   - Who: Jan and LM Studio (local OpenAI-style server), TypingMind (custom endpoints), Chatbox, LibreChat, Cherry Studio, Open WebUI.
   - Why: lets people use LM Studio, vLLM, OpenRouter, a company gateway or a home server without waiting for official support.
   - Build (S for client, M for server): "Add custom provider" form (base URL, key, model list fetched from /v1/models).
     Desktop could also expose a localhost OpenAI-style endpoint so other tools reuse the user's keys; guard it with a token and localhost-only binding.
9. **Ready-made assistant library (Gems / Agents / Assistant Market)**
   - Who: LobeChat (Assistant Market), TypingMind (60+ agents), Gemini Gems, ChatGPT GPTs, Poe, Open WebUI community presets.
   - Why: a new user gets useful specialists in one click and needs no prompt writing.
   - Build (S): ship 30-50 reviewed personas as a JSON file the existing Modes system can import; "Install" button; allow import/export of a mode as a file.
     Avoid a live community store at first (moderation cost).
10. **Resumable and background generation**
    - Who: LibreChat (resumable streams), ChatGPT (keeps running when you leave), TypingMind (parallel chats while one streams).
    - Why: a refresh, tab switch or dropped connection no longer kills a long answer.
    - Build (M): on the server, persist streamed chunks to a row keyed by message id; the client re-attaches on load. Also allow starting a second
      chat while the first is generating. Simple row polling is fine before real streaming resume.
11. **Per-chat model controls: reasoning effort, temperature, max tokens, system prompt override**
    - Who: TypingMind (Max effort option, July 2026), LibreChat presets, Open WebUI, Cherry Studio, Chatbox, Msty.
    - Why: users want the cheap fast setting for easy questions and deep thinking for hard ones.
    - Build (S): a small "Tune" popover on the model picker; only show controls the selected model's provider API actually supports
      (read from the provider, per CLAUDE.md rule 7). Save as part of a mode/preset.
12. **Personal model arena (vote on compared answers, leaderboard)**
    - Who: Open WebUI (arena, ELO leaderboard); Perplexity Model Council has a similar compare idea.
    - Why: people learn which model is actually best for their own tasks, which feeds Auto model.
    - Build (S, after item 2): thumbs-up on the winning column stores model, task type and result; stats page ranks models; Auto model
      can read the ranking as a hint. Stays local or in the user's own account.
13. **Live voice with camera or screen share**
    - Who: Gemini Live, ChatGPT voice/video, Open WebUI (voice and video calls).
    - Why: "look at this" and talk it through is the feature people show off.
    - Build (L): extends talk mode with realtime APIs (OpenAI Realtime or Gemini Live, user's key) plus getDisplayMedia frames sent every few seconds.
      Heavy and key-cost sensitive; add a visible recording indicator and a per-session spend cap.
14. **Translation panel (translate a chat or text with its own model setting)**
    - Who: Cherry Studio (dedicated translation page with its own model), Chatbox, LobeChat; also Google/DeepL-style users.
    - Why: a fast, cheap model for translating without disturbing a main chat.
    - Build (S): a page with two boxes and a language pair, using the cheapest working model; "translate this message" in the message menu.
15. **Locked chats / app lock**
    - Who: ChatGPT (locked chats, October 2026), Claude and Gemini mobile app locks.
    - Why: protects sensitive chats on shared computers; fits MoonC's private-chat story.
    - Build (S): PIN (hashed, local) gates chosen chats; Electron can add OS biometric (Windows Hello) later. Be clear it is a screen lock,
      not stronger encryption, unless chats are encrypted with a PIN-derived key.

Near misses (worth a later look): Notes workspace (Open WebUI), subagents (LibreChat), team workspaces with roles and SSO (TypingMind Teams, LibreChat,
Open WebUI, Msty; L, not needed for a solo-owner product), headless server mode (LM Studio llmster), Cherry-style mini apps (embedding other AI sites; low value).

## What users praise most (one line each)
- TypingMind: pay once, bring your keys, fast UI, prompt library, canvas, many plugins. Complaint: no free tier, price confusion.
- Msty: split chats and local-model polish; knowledge stacks; privacy. Some advanced flows (Turnstiles) are paid.
- LibreChat: best at juggling many providers and keys, agents, code interpreter, resumable streams, multi-user.
- Open WebUI: huge ecosystem, RAG, channels, Python tools, arena. Complaint: rough for non-technical people.
- Cherry Studio: everything-in-one desktop client, multi-model asks, knowledge base, translation, mini apps.
- LobeChat: the nicest looking open client; assistant market; plugin and TTS support.
- Jan / LM Studio: easy local models, local OpenAI-style server, MCP, headless daemon (LM Studio 0.4).
- Chatbox: simple cross-platform apps (desktop and mobile), local knowledge base.
- BoltAI: system-wide shortcuts, select-text actions, dictation anywhere, native Mac feel.
- Poe: many bots in one thread with @mention, creator payouts.
- Perplexity: cited answers, Deep Research, Labs, Comet browser agent.
- ChatGPT / Claude / Gemini: scheduled tasks and Work agent (ChatGPT), Projects, Research, Skills and memory (Claude), Gems, Canvas, Live (Gemini).

## 2) Already covered (do not rebuild)
- Chat with any model, mid-chat switching, Auto model, Free mode (Poe, TypingMind, LibreChat, Cherry, all do the first part).
- Projects, memory (opt-in and editable), private/temporary chats (LibreChat Temporary Chat), forking/branching, chat threads.
- Export/import, full-text chat search, slash commands and user-defined prompts (TypingMind prompt library basics), modes/personas (Gems, GPTs).
- Artifacts (Claude, LibreChat, Gemini Canvas for code/apps), Code workspace with preview, Fix it, GitHub push and Vercel deploy.
- Image, video and voice generation (Open WebUI, LibreChat image gen, Msty Media Studio) plus Improve prompt and Compare models.
- MCP connectors with one-click setups (TypingMind, LibreChat, Jan, LM Studio all use MCP), Claude plugins and a mods SDK (LibreChat Agent Plugins, Skills).
- Local models through Ollama; voice input and talk mode; web search and Python (LibreChat Code Interpreter, Open WebUI code execution).
- Remote control of a home PC; Chrome extension that acts in tabs (Perplexity Comet, ChatGPT agent mode comparable).
- Memory meter, continue-in-new-chat, monthly budget, usage and cost stats; themes and Full control appearance.
- Claude Code integration on desktop (BoltAI also drives Claude Code / Codex CLI).

## 3) Sources
- TypingMind feature list: https://docs.typingmind.com/feature-list and changelog https://feedback.typingmind.com/changelog
- Open WebUI features: https://docs.openwebui.com/features.txt
- Msty Studio features: https://msty.ai/studio/features ; split chats https://msty.ai/blog/multiverse-split-chats-conversations
- LibreChat features: https://www.librechat.ai/docs/features ; agents https://www.librechat.ai/docs/features/agents
- Cherry Studio docs: https://docs.cherry-ai.com/docs/en-us
- LobeChat docs: https://lobehub.com/docs
- Chatbox knowledge base: https://docs.chatboxai.app/en/guides/knowledge-base
- BoltAI features: https://help.boltai.com/articles/2306606-features and https://help.boltai.com/articles/1041393-inline-ai
- LM Studio 0.4.0: https://lmstudio.ai/blog/0.4.0 ; Jan MCP/API summaries via https://dev.to/jovan_chan_9500711396d4e6/jan-ai-review-2026-13ei
- ChatGPT scheduled tasks: https://alternativeto.net/news/2026/6/chatgpt-launches-new-scheduled-tasks-and-prepares-to-sunset-pulse/ ; release notes https://help.openai.com/en/articles/6825453-chatgpt-release-notes
- Claude features: https://support.claude.com/en/articles/12138966-release-notes
- Gemini features: https://www.tomsguide.com/ai/gemini-isnt-just-a-chatbot-anymore-here-are-13-things-it-can-do-in-2026
- Perplexity: https://suprmind.ai/hub/perplexity/features/ and https://beginnersinai.org/whats-new-perplexity-2026/
- Poe: https://techcrunch.com/2024/04/09/poe-introduces-a-price-per-message-revenue-model-for-ai-bot-creators ; multi-bot chat https://itc.ua/en/news/poe-introduces-chat-with-multiple-ai-bots-to-work-with-different-models-simultaneously
- Comparisons: https://geekflare.com/ai/top-multi-ai-chat-clients/ ; https://blog.elest.io/the-best-open-source-chatgpt-interfaces-lobechat-vs-open-webui-vs-librechat/ ; https://aitoolsatlas.ai/compare/boltai-vs-msty
- Caveat: no Reddit/HN thread was returned directly; user-praise notes come from comparison articles and may reflect reviewer opinion. Pricing claims were inconsistent and are omitted.
