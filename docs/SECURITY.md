# MoonlightC security model

Report vulnerabilities privately through GitHub's "Report a vulnerability" button on the repository (Security tab).

## Secrets (API keys, tokens)
- **Web:** stored in the browser's localStorage on the user's device. They leave the device only inside a request to our
  API routes, which use them for that one provider call. Keys and message content are never stored or logged server-side.
- **Desktop:** stored in the OS keychain via Electron `safeStorage` (DPAPI / Keychain / libsecret); localStorage holds
  only blanks. Cloud sync to Supabase Vault comes with accounts (Phase 1).
- **Mods and artifacts** run in sandboxed iframes without `allow-same-origin`, so they can't read localStorage. Covered by
  e2e tests (`artifacts open in a sandbox that can't read the app's keys`).

## Server routes (`apps/web/src/app/api`)
- `src/proxy.ts` rejects any `/api` request whose `Origin` isn't MoonlightC itself, so other sites can't use a visitor's
  browser against our API. In the desktop app it also requires a loopback `Host` (blocks DNS rebinding).
- SSRF: user-supplied URLs (custom providers, connectors, `fetch_url`) must be public `https://` hosts. Private ranges,
  localhost, link-local and `.local/.internal` are refused; every redirect hop of `fetch_url` is checked again.
  Known limit: hostnames that resolve to private IPs aren't resolved and checked (documented in `server-guard.ts`).
- Errors returned to users are rewritten into plain messages; raw provider errors are truncated.

## Desktop app (`apps/desktop`)
- Windows run with `contextIsolation`, `sandbox`, no `nodeIntegration`. Pages get only the functions in `preload.cjs`.
- Every IPC handler checks the sender's URL is the app's own local origin.
- Navigation is locked to the local origin; other links open in the system browser. `openExternal` allows https only.
- `openPath` opens folders only (never files), and refuses shell metacharacters when launching editors.
- Permission requests are limited to microphone, notifications and clipboard write.
- Terminals are real shells by design; they start only when the user opens one.
- **Local MCP connectors** (commands on the user's computer) run only after the user approves the exact command line in
  a native OS dialog. The approval list is written by the main process; the web layer can't add to it.
- The bundled server listens on 127.0.0.1 on a random port.

## AI computer use (desktop, this PC)
- Each session must be approved by the person at the PC in a native dialog (pages can't approve it themselves).
- A blue frame and a banner show the whole time; the in-app banner has a Stop button.
- Global panic hotkey **Ctrl+Alt+Shift+M** ends the session from anywhere. Sessions end by themselves after 15 minutes.
- Steps the model marks destructive, plus keystrokes/commands that look destructive (Delete, `rm -rf`, `format`,
  `Remove-Item`…), require a second native confirmation; refusing ends the session.
- Every session and step is written to an audit log (`computer-audit.jsonl` in the app's data folder). Typed text is
  recorded only as a length, never its content.
- Only models that can see screenshots in tool results are allowed (Claude, GPT, Gemini via their own APIs, Azure, Bedrock).
- The test-only auto-approve switch is ignored by installed (packaged) builds.

## Connectors (MCP)
- Every tool defaults to **Ask every time**; the chat shows the tool's input and waits for Allow/Deny.
- Users can set Always allow or Never per tool. Tools set to Never are not offered to the model at all.

## Mods
- Manifests are validated (`packages/mods-sdk`); scripts are downloaded once at install and pinned.
- Before install, the user sees everything a mod adds and every permission it asks for.
- Mod code runs in an opaque-origin sandbox and communicates only through `postMessage`, with messages checked against
  the sandbox's window.

## Not built yet (tracked in PROGRESS.md)
- Remote control from other devices (SPEC §8): MFA, device pairing and approval, relay, remote screen/terminal/files.
- Accounts, RLS and Supabase Vault (Phase 1).
