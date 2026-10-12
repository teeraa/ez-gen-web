<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# VIOLET STUDIO — Agent Team Responsibilities

> This section is maintained by Agent A (Coordinator).
> The section above is auto-maintained by Next.js and must not be removed.
> See `CLAUDE.md` for development rules and environment setup.

## Agent Roster

| Agent | Role | Primary Files |
|---|---|---|
| **A — Coordinator** | Architecture decisions, conflict resolution, final sign-off | `CLAUDE.md`, `AGENTS.md`, `docs/engineering/` |
| **B — Repository Reconnaissance** | Inspect codebase, record baseline | `docs/engineering/repository-map.md` |
| **C — UI and Design Analyst** | HTML → component mapping, design tokens | `docs/engineering/ui-feature-map.md`, `docs/engineering/design-system.md` |
| **D — Architecture Specialist** | App Router structure, component rules | `docs/engineering/frontend-architecture.md` |
| **E — API Contract Specialist** | Backend API proposals | `docs/engineering/api-contract.md` |
| **F — Quality Specialist** | Verification procedures, acceptance criteria | `docs/engineering/verification-playbook.md` |
| **G — Security Reviewer** | Trust boundaries, secret handling | `docs/engineering/frontend-security.md` |

## Current Phase: ENVIRONMENT PREPARATION

**What is complete:**
- Repository inspected and mapped
- Next.js 16.4.0 scaffold initialized and verified
- Design reference preserved at `design-reference/index.html`
- All 7 engineering documents produced
- Baseline verification: type-check, lint, build all pass

**What is NOT yet done:**
- No product features implemented
- No real API calls connected
- No authentication wired up
- No shadcn/ui components installed
- No Violet Studio Tailwind tokens configured

## Handoff Rules

1. **One owner per file.** Only the assigned agent edits its deliverable files.
   Coordinate through Agent A if two agents need to touch the same file.
2. **No concurrent edits.** Do not edit the same file simultaneously.
3. **Verify before marking done.** Every deliverable requires evidence:
   passing `pnpm lint && pnpm type-check && pnpm build` for code changes;
   browser smoke test for UI changes; explicit checklist entry for documentation.
4. **Document blockers immediately.** If a task cannot be completed, add the
   blocker to `docs/engineering/repository-map.md` section 9.

## Implementation Phase Prerequisites (not yet started)

Before any implementation agent begins:
- [ ] shadcn/ui initialized: `pnpm dlx shadcn@latest init`
- [ ] Violet Studio Tailwind tokens added to `src/app/globals.css`
- [ ] DM Sans and Manrope fonts configured in `src/app/layout.tsx`
- [ ] `.env.local` configured with `API_URL`
- [ ] `docs/engineering/api-contract.md` verified against actual `ez-gen-api`

## File Ownership Map

| Path | Owned by | Notes |
|---|---|---|
| `CLAUDE.md` | Agent A | Do not edit unless resolving conflict |
| `AGENTS.md` | Agent A | The `nextjs-agent-rules` block is auto-managed by Next.js |
| `design-reference/index.html` | No agent | Read-only reference — never edit |
| `src/app/globals.css` | Agent D | Tailwind tokens live here |
| `src/app/layout.tsx` | Agent D | Root layout, fonts, metadata |
| `src/app/page.tsx` | Dashboard agent | Home route |
| `src/components/layout/` | Layout agent | Sidebar, Topbar |
| `src/components/generator/` | Generator agent | Form, upload, controls |
| `src/components/gallery/` | Gallery agent | Creation cards |
| `src/components/projects/` | Projects agent | Project rows, menus |
| `src/lib/api-client.ts` | API agent | Typed Go backend client |
| `src/lib/schemas.ts` | API agent | Zod schemas |
| `docs/engineering/` | Respective agents | See Agent Roster above |
