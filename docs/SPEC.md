# MoonlightC — Product Spec

**One line:** the only AI app you need to open. MoonlightC brings every AI into one place: cloud models (Claude, GPT,
Gemini, Grok, Mistral and the rest), local models running on your own PC, image, video and voice generation,
coding agents, your connected accounts, and remote control of your own computers.
It is as simple as Windows out of the box and as customizable as Linux.

- **Name:** MoonlightC (short: MoonC). Domain to start with: `moonlightc.vercel.app`. A custom domain comes later and needs the owner's approval to buy.
- **Business model:** free and open source. MoonlightC doesn't sell AI. Users bring their own keys and their own
  local models. There are no usage caps from us, and users can fork it, mod it, and add their own AIs.
- **Surfaces:** (1) a marketing website, (2) the web app (installable as a PWA), and (3) a desktop app for Windows,
  macOS and Linux (x64 + arm64). All three share one account and stay in sync.

---

## 1. Architecture (recommended; change only with a written reason in DECISIONS.md)

Monorepo (pnpm workspaces + Turborepo) in this folder, pushed to a new GitHub repo `moonlightc` (public, MIT license):

```
apps/
  web/        Next.js (App Router) on Vercel: marketing site at /, web app at /app, admin at /admin, API routes
  desktop/    Electron app (electron-builder) that bundles the same app UI, works fully offline
packages/
  ui/         shared React components + design system (Tailwind, shadcn/ui, Radix)
  core/       shared logic: providers, chat engine, sync, types (TypeScript everywhere)
  agent/      the desktop "local agent": Ollama manager, terminals, file access, screen capture, input control
  mods-sdk/   public SDK + manifest schema for mods (themes, plugins, tools)
supabase/     migrations, RLS policies, edge functions, seed
docs/         SPEC.md, PROGRESS.md, DECISIONS.md, SECURITY.md, MODDING.md
```

- **Backend:** Supabase (Auth, Postgres + RLS on every table, Storage, Realtime, pgvector for memory, Vault for
  encrypted secrets, pg_cron for schedules, Edge Functions).
- **AI layer:** Vercel AI SDK with a provider registry. Every provider is a plugin implementing one interface
  (list models, chat stream, tools, vision, image, video, audio as supported). Any OpenAI-compatible endpoint can be
  added by URL + key, which covers LM Studio, vLLM, Together, Groq, OpenRouter, and so on.
- **Web → provider calls:** go through a thin streaming proxy route on Vercel. Keys are decrypted only inside that request
  and never logged.
- **Desktop → provider calls:** go direct. Local models work with zero internet.
- **Offline-first:** the desktop app keeps a local SQLite copy of chats and settings and syncs with Supabase when
  online, resolving conflicts last-write-wins per message. The PWA caches the shell and recent chats.
- **Analytics:** PostHog (product analytics, funnels, feature flags) plus Vercel Analytics.

## 2. Accounts, sign-up and linking
- Sign-in methods: Google, GitHub, Apple, Discord, Microsoft, email magic link, email + password, and phone (SMS OTP).
  - Phone needs an SMS provider (Twilio) that costs money, so ask the owner before enabling it and build everything else first.
- **Same person = same account:** enable Supabase automatic identity linking, so a Google login and an email login with the
  same verified email become one account. Settings → Accounts lets users link and unlink providers manually.
- Password flows must actually work: sign-up confirmation email, forgot password, reset, and clear error messages that
  say what to do next. Configure Supabase redirect URLs for production, preview, localhost and the desktop deep link
  (`moonlightc://auth`).
- MFA (TOTP) available to everyone, and **required** before enabling remote control (§8).
- **Onboarding (about 60 seconds, skippable after the first step):**
  1. Name and username.
  2. What do you use AI for? (multi-select)
  3. Which AI tools do you use today? (multi-select of about 30)
  4. How did you hear about us?
  5. Optional phone number.
  6. Pick a starting layout ("distro", §10).
  7. Connect your first model, with three paths: paste a key, sign in to OpenRouter (one key gets hundreds of models), or install a local model.
  - Age gate: confirm 13+.

## 3. Metrics (the owner wants as much as legally and ethically reasonable)
- **Profile data from onboarding:** the fields above, plus signup method and UTM/referrer.
- **Captured automatically:** country/region from Vercel geo headers, device/OS/browser, PWA installed, desktop app
  installed (and OS), providers connected (names only, never keys), local models installed, features used,
  session counts and retention.
- **Never** send message contents, prompts, files, or keys to analytics.
- Publish a privacy policy and terms. Show a cookie/analytics consent banner where it's legally required. Provide data export and account deletion that actually work.
- **`/admin` dashboard** (owner's account only, enforced by RLS plus a server check):
  - Signups per day, DAU/WAU/MAU, and the activation rate (connected ≥1 model and sent ≥1 message).
  - D1/D7/D30 retention cohorts, top features, provider mix, and local vs cloud usage.
  - Downloads by OS, and the onboarding answers as charts.

## 4. Chat (the core, must be excellent)
- **Model picker:**
  - Every connected provider plus local models, with search and favorites.
  - Per-chat model, with model switching mid-chat.
  - "Compare" mode: send one prompt to 2–4 models side by side.
- **Message handling:** streaming with a working Stop button (the stopped state is preserved), regenerate, edit and resend, branch from any message, copy, and read aloud.
- **Attachments:** images, PDFs, docs and code files, with drag-and-drop and paste.
- **Rendering:** markdown, math and code highlighting.
- **Artifacts / canvas:** HTML/React/SVG/Mermaid outputs render live in a side panel. Users can edit, download and share them.
- **Organization:** Projects (folders with their own instructions, files and memory), plus pin, rename, search across all chats, and export.
- **Modes and personas:**
  - Users can create their own: system prompt, default model, temperature, tools.
  - Ship good defaults: General, Coder, Writer, Researcher, Tutor/Learn (quizzes you), and Private.
  - Private mode is incognito: nothing is saved, and it can be local-only.
- **Memory:** opt-in. The AI saves facts and the user can view, edit and delete them, searchable via pgvector. Memory is shared across all models.
- **Tools available to any tool-capable model:** web search (BYOK: Tavily, Exa or Brave), URL fetch, a code interpreter (sandboxed in the browser via Pyodide, or local Python on desktop), image generation, and connected-account tools (§7).
- **Deep Research mode:** multi-step search with sources and a final report.
- **Voice mode:** speech-to-text (Whisper, either local or via API) and text-to-speech. Use realtime voice when the provider supports it.
- **Keyboard:** a command palette (Ctrl/Cmd+K) for everything.

## 5. Models and keys ("bring your own everything")
- **Cloud providers:** Anthropic, OpenAI, Google Gemini, xAI, Mistral, DeepSeek, Groq, Together, Perplexity, Cohere,
  OpenRouter, Azure OpenAI, AWS Bedrock, and any OpenAI-compatible URL.
  - Validate each key on paste with a real test call.
  - Show which models it unlocks, fetched live from the provider.
  - Show the estimated cost per message when pricing is known.
- **Key storage:**
  - Desktop: the OS keychain (Electron `safeStorage`).
  - Cloud sync (optional, default on): Supabase Vault, encrypted at rest and decrypted only server-side at request time.
  - Users can choose "this device only".
- **Claude and ChatGPT subscriptions:** third-party apps are **not allowed** to sign in with a Claude Pro/Max
  subscription (Anthropic banned this in Feb 2026). Do not build any token-extraction or "log in with Claude.ai"
  workaround. Instead:
  1. An API key, or OpenRouter.
  2. The **Terminals** feature (§6): users run the official `claude`, `codex` and `gemini` CLIs themselves inside
     MoonlightC's built-in terminal, under their own login. This is like a terminal in VS Code. MoonlightC only
     hosts the terminal. It does not script, intercept, or reuse their credentials.
  - Explain this clearly in the UI so users understand why.
- **Local models (desktop app):**
  - Detect Ollama. If it's missing, offer one-click install, then start and stop it automatically. The user never opens a terminal.
  - **Model Store:**
    - Browse a curated catalog (a JSON file in the repo) plus search across Hugging Face GGUF models.
    - Ollama can pull `hf.co/...` models directly.
    - Each card shows size, what it's good at, license, and a **"will it run on your PC?"** verdict based on detected
      GPU VRAM, RAM and disk (Great / Slow / Won't fit).
    - One-click download with a progress bar, pause and resume.
  - Also detect LM Studio, llama.cpp servers, and ComfyUI if they're installed.
  - Local models appear in the same model picker. Offline mode works with zero internet.
- **Using a PC's local models from other devices:** through the paired device relay (§8), so a phone can chat with
  the home PC's Gemma/Llama while the PC is on. The UI shows clearly which device is answering.

## 6. Code and agents
- **Code workspace:** describe an app, then the AI writes it and it runs live in a preview pane (Sandpack or WebContainers
  in the browser, real filesystem on desktop). It has a file tree, editor (Monaco), diff view, and download as zip.
  - Push to a new GitHub repo and deploy to Vercel in one click once those accounts are connected.
- **Terminals (desktop, and remote via §8):**
  - A real terminal using xterm.js + node-pty, with tabs.
  - Quick-launch buttons for Claude Code, Codex CLI, Gemini CLI and Aider (shown only if installed; offer an install command if not).
- **"My AI Projects" view (desktop):**
  - Scans folders the user approves for:
    - Claude Code projects (`~/.claude/projects`)
    - Codex sessions (`~/.codex`)
    - Gemini CLI (`~/.gemini`)
    - Cursor workspaces
    - Git repos
    - Ollama models
  - Shows them as cards with last activity, plus buttons to open the folder, open in VS Code/Cursor, or resume the session in a MoonlightC terminal.
  - Read-only unless the user acts.
- **Automations:** scheduled or triggered agents. Examples: "every morning summarize my Gmail", "when a GitHub PR opens,
  review it". Cloud models run on the server (pg_cron + edge function); local models run on the user's desktop when it's online.
  Users can see a run history.

## 7. Connections (MoonlightC is an MCP client, and MCP is the plugin standard)
- Settings → Connections lists one-click OAuth connectors. Each one exposes tools the AI can use, with per-tool permission ("ask every time", "always allow", or "never").
- **Build first:** GitHub (real stats dashboard, repos, issues, PRs), Google (Gmail, Calendar, Drive), Discord (bot + DMs/servers the user authorizes), Spotify, Notion, Slack, YouTube.
- **Then:** Instagram (Meta Graph API only works for Business/Creator accounts and needs Meta app review, so say so in the UI), X (the API is paid, so make it BYOK), Reddit, Twitch, Dropbox, OneDrive, Linear, Figma.
- **Custom MCP:** paste any MCP server URL or a local command (desktop) to add a connector. This is how power users add anything.
- **Subscriptions hub:** finds subscriptions from Gmail receipts (only with consent), shows renewal dates and monthly total, sends reminders before renewals, and links to each "manage subscription" page.
  - It never pays or renews anything automatically. Payments always stay with the user.

## 8. Devices and remote control (highest-risk feature; security is mandatory)
**Goal:** from a phone, Chromebook or any browser signed in to the same account, control your own PCs.

- **Devices list:**
  - Every desktop app install registers itself as a device under the user's account, with name, OS, online status, and local models available.
  - Devices signed in with the same account appear automatically, so nothing needs to be typed.
- **Pairing:**
  - The first time device B tries to control PC A, PC A shows a native prompt: "Allow 'Chromebook (Shawn)' to control this PC?".
  - Permission tiers (View screen / Files / Terminal / Full control), each with an option to remember.
  - A QR or 6-digit code fallback.
- **Transport:**
  - The desktop agent keeps an outbound connection to Supabase Realtime, so it needs no port forwarding.
  - Screen streaming uses WebRTC, with Supabase Realtime as signaling and a TURN fallback.
- **Remote features:**
  - Live screen view and control (mouse/keyboard).
  - Remote terminal.
  - Browse, upload and download files.
  - Chat with the PC's local models.
  - Start/stop Ollama, and launch apps.
  - Wake-on-LAN when supported.
- **AI computer use:** "do this on my PC". An agent loop takes screenshots, the model decides, and the agent clicks and types (Anthropic computer-use tool or OpenAI equivalent, using the user's key).
  - Runs locally or remotely.
  - Every session must be approved on the PC.
  - Shows a visible overlay on the PC while active.
- **Mandatory safety:**
  - MFA is required to turn remote control on.
  - Per-device approval that can be revoked any time.
  - A visible on-screen indicator whenever someone is connected.
  - A global panic hotkey (Ctrl+Alt+Shift+M) that kills all remote sessions.
  - An audit log of every remote action (who, what, when).
  - Session timeout.
  - Remote control is off by default.
  - Destructive commands from AI agents (delete, purchase, send message, install) always ask first.

## 9. Creative studio
- **Images:** generate and edit (inpaint, upscale, remove background) with BYOK providers: OpenAI, Google, fal.ai,
  Replicate (FLUX and others), Stability, Ideogram, Recraft, and local ComfyUI or Stable Diffusion if detected.
- **Video:** text-to-video and image-to-video via BYOK (Google Veo, Runway, Luma, Kling and Pika via fal/Replicate).
- **Audio:** TTS voices (ElevenLabs, OpenAI, local Piper), music (via fal/Replicate), transcription.
- **Gallery:** every generation is saved to Supabase Storage with prompt, model, cost and seed. Users can remix it, send it to chat, or post it to a connected account.
- Model lists for each provider are fetched live wherever the API allows it.

## 10. Customization: "simple like Windows, moddable like Linux"
- **Distros:** one-click presets that set layout, enabled features, default models and theme. Users can save and share their own, export to JSON, and import from a link.
  - **Moon** (minimal: chat only, huge input)
  - **Studio** (creative)
  - **Forge** (coder: code + terminals + projects)
  - **Command** (power user: everything, dense)
  - **Offline** (local models only)
- **Themes:** a full design-token system using CSS variables. Ship Silver (metallic glass), Graphite, Midnight, Paper (light) and High-Contrast. Includes a theme editor with live preview and custom backgrounds/wallpapers.
- **Layout:** drag panels, dock and undock, hide anything, and rebind any keyboard shortcut.
- **Mods:**
  - Manifest-based plugins (`mods-sdk`) that can add tools (MCP), UI panels (sandboxed iframe with a postMessage API), slash commands, themes and personas.
  - An in-app **Mod Store** backed by a public GitHub registry repo (`moonlightc-mods`, `index.json`). Install with one click; every mod shows its permissions before install.
  - `docs/MODDING.md` with a working example mod.
- **Open source:** README with screenshots, CONTRIBUTING, and issue templates, so people can fork it and add their own AIs.

## 11. Marketing website (`/`)
- **Quality bar:** feels like a top-tier AI company crossed with Apple product pages, but more modern and surprising.
  It must be original: no copied assets, layouts or copy from Higgsfield, Apple, or anyone else.
- **Tech:** Next.js, Framer Motion and/or GSAP ScrollTrigger, Lenis smooth scroll, react-three-fiber or WebGL shaders for
  the hero (an animated moon/light motif), View Transitions.
- **Performance and accessibility:** Lighthouse ≥ 90 on mobile, honor `prefers-reduced-motion`, and full keyboard access.
- **Sections:**
  1. Hero with the product name, a tagline, "Open web app" and "Download" buttons, and a live product preview.
  2. "Every AI, one app": a marquee of the providers it works with.
  3. A scroll-driven feature story covering chat, compare, local models, studio, code, remote control and mods.
  4. An interactive "distros" switcher that restyles a mock UI live.
  5. Privacy and open source (BYOK, local-first, MIT).
  6. Download section.
  7. FAQ.
  8. Footer with links to GitHub, Discord, Privacy and Terms.
- **Download page (`/download`):**
  - Auto-detects the visitor's OS and architecture and shows the right primary button.
  - Lists all builds: Windows (.exe, arm64), macOS (universal .dmg), Linux (.AppImage, .deb, .rpm, arm64 for Pi/Chromebook), plus "Install the web app (PWA)" instructions per browser.
  - Pulls the latest version, size and release notes from GitHub Releases automatically.
- **PWA:** manifest, icons, service worker, install prompt, and offline shell.

## 12. Desktop app
- Electron + electron-builder. Builds are done by GitHub Actions on a matrix (windows, macos, ubuntu; x64 + arm64) and published to GitHub Releases, with auto-update via electron-updater.
- **Code signing:** builds start unsigned, with the SmartScreen and macOS Gatekeeper warnings documented on the download page.
  Signing costs money (an Apple Developer account is $99/yr; a Windows certificate costs extra), so ask the owner first.
- **Native features:** a system tray, a global hotkey (Alt+Space) that opens a quick-ask overlay over any app, launch at startup (optional), native notifications, the `moonlightc://` deep link for auth, and drag-and-drop from the OS.
- **First run:** sign in (or use it offline without an account), detect hardware, offer to install Ollama plus one recommended model that fits the hardware, and register as a device.

## 13. Quality bar (applies to everything)
- Responsive from a 360px phone to an ultrawide screen.
- Dark and light modes.
- WCAG AA contrast.
- Loading, empty and error states for every screen.
- Optimistic UI.
- No layout jank.
- Errors are human-readable and offer a fix.
- Every list paginates or virtualizes.
- Tests:
  - Unit tests for core logic.
  - Playwright end-to-end tests for every primary flow, run in GitHub Actions on every PR.
- Run the Supabase security and performance advisors after each schema change and fix the findings.

## 14. Build phases and gates
Each phase ends only when its gate passes, verified by you with Playwright plus screenshots, then by the owner with a short checklist.

| # | Phase | Gate (must be true) |
|---|---|---|
| 0 | **Setup:** install prerequisites with winget; create the GitHub repo, Supabase project and Vercel project; scaffold the monorepo; set up CI | `pnpm build` is green; an empty app is live at moonlightc.vercel.app; PROGRESS.md exists |
| 1 | **Accounts and metrics:** all sign-in methods (except phone until approved), identity linking, onboarding, profiles, PostHog, /admin, privacy and terms | The owner signs up with Google on his PC, signs in on his phone with the same Google account, lands in the same account, and sees himself in /admin |
| 2 | **Chat core:** provider registry, key vault, model picker, streaming and stop, chats, projects, attachments, artifacts, memory, modes, compare, search | Works with an OpenRouter or Anthropic key from a phone with no PC involved |
| 3 | **Marketing site, download page and PWA** | Lighthouse ≥ 90 on mobile; the PWA installs on Windows and Android; the download page detects OS |
| 4 | **Desktop app:** Electron shell, offline SQLite and sync, Ollama manager, Model Store, terminals, My AI Projects, tray and hotkey, CI release builds | Install on Windows, pull a model with one click, chat with the internet off, open Claude Code in the built-in terminal |
| 5 | **Devices and remote control:** registration, pairing and approval, relay, remote terminal and files, screen view and control, computer use, all of §8's safety features | From a phone: approve the pairing, view the PC screen, run a terminal command, chat with the PC's local model; the panic hotkey kills the session |
| 6 | **Creative studio:** images, video, audio, gallery | Generate an image and a short video with BYOK keys; both are saved in the gallery |
| 7 | **Connections and automations:** MCP client, GitHub, Google, Discord, Spotify, Notion, Slack, YouTube, custom MCP, subscriptions hub, scheduled agents, deep research | Connect GitHub (the dashboard shows real stats), ask the AI about your PRs, schedule a daily Gmail summary that runs |
| 8 | **Customization:** distros, themes and editor, layout, mods SDK and store | Switching distros restyles the app; installing the example mod adds a working tool |
| 9 | **Hardening:** security review of §8, RLS audit, load and performance pass, accessibility pass, docs, v1.0 release | No critical findings; a full Playwright suite is green; v1.0.0 is published to GitHub Releases |

Phase 2 can start while the owner completes any manual OAuth setup from Phase 1.
Never let unfinished phases leak visible UI into production.
