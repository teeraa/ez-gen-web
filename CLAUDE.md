# VIOLET STUDIO — Claude Code Instructions

## Project Overview

VIOLET STUDIO is a premium AI video generation platform. This repository (`ez-gen-web`)
is the Next.js frontend. The Go Fiber backend is a separate repository (`ez-gen-api`).
The AI provider is BytePlus ModelArk, accessed only through the Go backend.

## Stack

| Technology | Version | Notes |
|---|---|---|
| Next.js | 16.4.0 | App Router, Turbopack, Cache Components |
| React | 19.3.0 | Server Components are the default |
| TypeScript | 5.x | strict mode, exact paths |
| Tailwind CSS | 4.x | No config file — uses CSS-first config |
| shadcn/ui | latest | Install components via `pnpm dlx shadcn@latest add <name>` |
| Lucide React | latest | Icon library |
| pnpm | 11.1.2 | Required package manager |

> **IMPORTANT:** This is Next.js 16, not 15 or 14. APIs may differ from training data.
> Always read `node_modules/next/dist/docs/` before implementing Next.js-specific features.

## Design Reference

`design-reference/index.html` — the complete UI prototype. All visual decisions
must be verified against this file. Do not modify it.

## Engineering Documentation

All architecture decisions and contracts are in `docs/engineering/`:

| File | Owner | Contents |
|---|---|---|
| `repository-map.md` | Agent B | File structure, scripts, interactions |
| `ui-feature-map.md` | Agent C | Component inventory and interaction map |
| `design-system.md` | Agent C | Tokens, typography, colors, animations |
| `frontend-architecture.md` | Agent D | App Router structure, component rules |
| `api-contract.md` | Agent E | Backend API proposals |
| `verification-playbook.md` | Agent F | How to verify all changes |
| `frontend-security.md` | Agent G | Trust boundaries and security rules |

Read the relevant document before implementing any feature in that area.

## Development Commands

```bash
pnpm dev          # Start dev server → http://localhost:3000
pnpm build        # Production build
pnpm start        # Serve production build
pnpm lint         # ESLint (must pass before any commit)
pnpm type-check   # TypeScript (must pass before any commit)
```

Pre-merge gate: `pnpm lint && pnpm type-check && pnpm build`

## Baseline Verification Results (2026-10-12)

All three checks pass on the scaffolded project with no code changes applied:

- `pnpm type-check` → **PASS** (0 errors)
- `pnpm lint` → **PASS** (0 errors)
- `pnpm build` → **PASS** (Turbopack, 2 routes: `/` and `/_not-found`)

Any new failure after changes is a regression and must be fixed before merging.

## Critical Rules

### Security
1. BytePlus credentials must NEVER appear in any `NEXT_PUBLIC_` variable.
2. User-supplied content must never be rendered with `dangerouslySetInnerHTML`.
3. File uploads must be validated server-side (not just client-side).
4. Session tokens go in httpOnly cookies — never localStorage.
5. Run `pnpm audit --audit-level high` after any dependency change.

### Architecture
1. Default to Server Components. Add `"use client"` only when the component needs
   browser APIs, event handlers, or incompatible third-party libraries.
2. All Go backend calls from the browser must go through Next.js Route Handlers.
3. The credit estimate formula and generation modes must match `api-contract.md`.
4. Do not implement features not present in `design-reference/index.html` unless
   explicitly requested.

### Code style
1. TypeScript strict mode — no `any`, no `!` non-null assertions without a comment.
2. No comments that describe what the code does — only document non-obvious WHY.
3. No unused imports, variables, or exports.
4. Prefer reading the design-system tokens from `globals.css` CSS variables rather
   than hardcoding hex values.

### Do NOT
- Rewrite the design reference file (`design-reference/index.html`)
- Upgrade major dependencies without explicit approval
- Implement real BytePlus API calls, payments, or authentication in this phase
- Skip the `pnpm lint && pnpm type-check` gate before committing

## Environment Setup

```bash
cp .env.example .env.local
# Edit .env.local:
# API_URL=http://localhost:8080  ← internal URL to ez-gen-api
```

## Agent Coordination

See `AGENTS.md` for agent responsibilities and handoff rules.
The Coordinator (Agent A) owns all cross-cutting architecture decisions.
Agents must not edit overlapping files concurrently.
