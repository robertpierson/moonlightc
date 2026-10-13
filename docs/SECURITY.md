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

## Connectors (MCP)
- Every tool defaults to **Ask every time**; the chat shows the tool's input and waits for Allow/Deny.
- Users can set Always allow or Never per tool. Tools set to Never are not offered to the model at all.

## Mods
- Manifests are validated (`packages/mods-sdk`); scripts are downloaded once at install and pinned.
- Before install, the user sees everything a mod adds and every permission it asks for.
- Mod code runs in an opaque-origin sandbox and communicates only through `postMessage`, with messages checked against
  the sandbox's window.

## Not built yet (tracked in PROGRESS.md)
- Remote control and devices (SPEC §8) with MFA, pairing approval, session indicators and a panic hotkey.
- Accounts, RLS and Supabase Vault (Phase 1).
