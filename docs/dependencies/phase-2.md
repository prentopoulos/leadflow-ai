# Phase 2 dependency decision

Decision date: 2026-10-25. Scope: local, synthetic Phase 2 operator views.

Peter authorized these downloads in the Phase 2 grilling (PROJECT.md "Phase 2 decisions"). They
serve only the web application. No provider SDK, Firebase client SDK, SSE package, or email library
is added, and the API and runtime gain no new dependency.

## Selected versions

Registry metadata checked on 2026-10-25. All are exact-pinned in `apps/web/package.json`.

| Package | Version | Released | Licence | Purpose |
|---|---|---|---|---|
| `recharts` | `3.10.1` | 2026-07-25 | MIT | Metrics charts. Recharts 3 enables its accessibility layer (ARIA roles, keyboard navigation) by default, and `isAnimationActive` turns animation off for reduced motion. |
| `react-is` | `19.3.1` | 2026-10-14 | MIT | Required peer of Recharts; pinned to the installed React version. |
| `lucide-react` | `1.61.0` | 2026-10-21 | ISC | Icons; the icon set PROJECT §4 names. |
| `@radix-ui/react-slot` | `1.5.0` | 2026-10-12 | MIT | `asChild` composition for the shadcn/ui button. |
| `@radix-ui/react-tabs` | `1.2.1` | 2026-10-12 | MIT | Accessible view tabs (roving focus, arrow keys) for the shadcn/ui tabs component. |
| `class-variance-authority` | `0.7.1` | 2024-11-26 | Apache-2.0 | shadcn/ui component variants. |
| `clsx` | `2.1.1` | 2024-04-23 | MIT | Class composition for the shadcn/ui `cn` helper; also a Recharts dependency. |
| `tailwind-merge` | `3.7.0` | 2026-09-12 | MIT | Tailwind-aware class merging for `cn`; version 3 targets Tailwind CSS 4. |

Recharts brings its own exact transitive set (`@reduxjs/toolkit`, `react-redux`, `immer`,
`reselect`, `victory-vendor` d3 modules, `es-toolkit`, `eventemitter3`, `decimal.js-light`,
`tiny-invariant`, `use-sync-external-store`). None declares an install script, so `allowBuilds` is
unchanged.

## shadcn/ui method

shadcn/ui is copied source, not a runtime package. The views need two components, button and
tabs, placed under `apps/web/src/components/ui/` from the shadcn 4.22.1 `radix` base, with
imports pointed at the two individual Radix primitives and a local `cn` helper in
`apps/web/src/lib/utils.ts`. Tables and panels stay semantic HTML on the Phase 1 tokens. The
`shadcn init` command was not run, because it rewrites the global stylesheet and Vite configuration
that carry the accepted Phase 1 visual direction. Component styles use the existing Phase 1 tokens.

## Alternatives considered

- The unified `radix-ui` package (1.8.1) was installed first and then removed. It pulls every Radix
  primitive (113 packages), and the views need only two.
- shadcn's default `base` library (Base UI) was not chosen, because the owner authorized the Radix
  dependencies.
- Hand-rolled SVG charts would avoid Recharts' transitive set, but PROJECT §4 names Recharts and its
  default accessibility layer covers keyboard and screen-reader access that hand-rolled charts would
  have to rebuild.
- Server-Sent Events (`@fastify/sse` 0.6.1) were not added; revision-aware polling covers a single
  local operator (settled in grilling).

## Limits and recheck triggers

`pnpm peers check` reports only the pre-existing `eslint-plugin-jsx-a11y` 6.10.2 peer range against
ESLint 10, carried from Phase 0. Recheck these pins when React, Tailwind CSS, or Vite changes, and
run `pnpm audit:dependencies` (separately authorized registry access) before Phase 2 is merged.
