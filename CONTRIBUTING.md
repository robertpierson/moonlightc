# Contributing to MoonlightC

Thanks for helping. A few rules keep MoonlightC trustworthy:

1. **No fake UI.** Every button you add must work end to end. If a feature isn't finished, it isn't visible.
2. **Tests with every change.** Unit tests (Vitest) for logic, Playwright for flows. Run `pnpm typecheck && pnpm lint && pnpm test`
   and `pnpm build && pnpm --filter @moonc/web e2e` before opening a pull request.
3. **Keys and chats stay private.** Never log API keys or message content. Anything that touches a user's computer
   (terminals, files, screen) needs explicit user approval and a security review.
4. **Fetch fast-moving facts at runtime.** Don't hard-code model lists or "latest" model names.

## Adding an AI provider
Add an entry to `packages/core/src/providers.ts` (`PROVIDERS`). OpenAI-compatible providers need only a base URL.
Add a unit test in `providers.test.ts`.

## Adding a mod
See [docs/MODDING.md](docs/MODDING.md).

## Pull requests
Small, focused PRs with a clear description. CI must be green.
