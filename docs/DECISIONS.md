# Decisions

## 2026-10-13 Monorepo grows on demand
What: start with `apps/web` only; add `packages/*` (ui, core, agent, mods-sdk) in the phase that first needs them.
Why: no empty scaffolding; SPEC layout stays the target. Alternative: create all packages now (dead code until Phase 2+).

## 2026-10-13 Next.js 16.4 + React 19.3 + Tailwind 4, TypeScript 5
What: versions from create-next-app@16.4.0. TypeScript 7 exists but Next's template pins ^5; stay on 5 until Next supports 7.
Why: avoid toolchain breakage. Alternative: TS 7 (faster, unproven with Next).

## 2026-10-13 Tests: Vitest (unit, src/) + Playwright (e2e/, desktop + Pixel 7 projects)
Why: fast, standard; mobile project covers the 360px quality bar early.
