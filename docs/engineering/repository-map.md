# Repository Map — Agent B Deliverable

> Inspection date: 2026-10-12  
> Inspector: Agent B — Repository Reconnaissance  
> Status: **COMPLETE** — Next.js 16.4.0 scaffold initialized and verified

---

## 1. Project Identity

| Item | Value |
|---|---|
| Project name | VIOLET STUDIO — AI Creative Workspace |
| Repository root | `/ez-gen-web/` |
| Package manager | pnpm 11.1.2 |
| Node version | v24.14.1 |
| Next.js version | 16.4.0 (with Turbopack, Cache Components, Partial Prefetching) |
| React version | 19.3.0 |
| Tailwind CSS | 4.3.3 (CSS-first — no tailwind.config.ts file) |

---

## 2. Current File Tree (pre-scaffold)

```
ez-gen-web/
└── index.html        # 1546-line self-contained UI prototype (DO NOT OVERWRITE)
```

No `package.json`, `node_modules`, `tsconfig.json`, `.next/`, or source directories exist
prior to initialization. The repository has never been a Node.js project.

---

## 3. HTML Reference File

**Path:** `index.html`  
**Lines:** 1546  
**Self-contained:** Yes — no external JavaScript runtime; icons are inline SVG sprites.

### External dependencies loaded via CDN

| Asset | URL | Usage |
|---|---|---|
| Google Fonts | fonts.googleapis.com | DM Sans, Manrope |
| Lucide CSS | cdnjs.cloudflare.com/ajax/libs/lucide | Import only — actual icons are inline SVG sprites |
| Unsplash images | images.unsplash.com | Placeholder thumbnails for gallery/projects |

### HTML sections (in order)

| Section | Element | Description |
|---|---|---|
| Sidebar | `<aside class="sidebar">` | Fixed navigation, workspace switcher, recent projects, credits, account |
| Topbar | `<header class="topbar">` | Breadcrumb, global search (⌘K), notifications, upgrade, avatar |
| Hero | `<section class="hero">` | Full-bleed CTA with background image, title, two buttons |
| Generator | `<section id="create">` | Mode tabs, prompt textarea, image upload, controls grid, generate button |
| Gallery | `<section id="explore">` | 4 creation cards with hover play button, duration, favorite |
| Projects | `<section id="projects">` | 3 project rows with status badge and context menu |
| Tools | `<section id="tools">` | 4 tool shortcut cards |
| Plan/Tip | `<section id="account">` | Credits usage panel + studio tip panel |
| Footer | `<footer class="footer">` | Copyright and prototype disclaimer |
| Preview modal | `#previewModal` | Image preview with "use as inspiration" action |
| Pricing modal | `#pricingModal` | Creator / Studio Pro plan comparison |
| Toast stack | `#toastStack` | Live region for notification toasts |

---

## 4. JavaScript State Machine

The HTML prototype uses a single IIFE with explicit shared state:

```js
const state = {
  mode: "text" | "image-video" | "image-image",
  ratio: "16:9" | "9:16" | "1:1",
  duration: 5 | 10,
  image: null | { file: File, url: string },
  isGenerating: boolean,
  generatedCount: number,
  activePreview: null | { title, image, prompt },
  search: string,
  lastFocused: Element | null,
  generationTimer: number | null,
  generationInterval: number | null
}
```

**Simulated generation flow:** 3.4-second timer with 650ms progress steps, then
opens preview modal — no real API call.

---

## 5. Interactions Inventory

| Interaction | Trigger | Current Behaviour |
|---|---|---|
| Mode switch | `.mode-tab` buttons | Changes textarea placeholder + credit estimate |
| Image upload | File input + drag-and-drop | Previews locally, no upload |
| Generate form submit | `#generateButton` | Simulated 3.4s → preview modal |
| Favourite toggle | `.favorite-btn` | Visual toggle + toast |
| Play preview | `.play-button` | Opens preview modal |
| Recent project click | `.recent-project` | Opens preview modal |
| Global search | `#globalSearch` input | Filters `.searchable` items client-side |
| Project context menu | `.menu-trigger` | Open / duplicate / delete project rows |
| Upgrade / manage plan | various buttons | Opens pricing modal |
| Workspace button | `#workspaceButton` | Toast only |
| Nav items | `.nav-item` | Scrolls to section + updates breadcrumb |
| Mobile menu | `#mobileMenu` | Toggles sidebar open class |
| Escape key | document keydown | Closes modals + sidebar + menus |
| ⌘K | document keydown | Focuses global search |

---

## 6. Actual Post-Scaffold Structure

Initialized with Next.js 16.4.0 (`create-next-app`), copied to project root:

```
ez-gen-web/
├── .env.example                # committed env template (actual values go in .env.local)
├── .gitignore                  # includes .env*, next-env.d.ts, .next/, node_modules/
├── AGENTS.md                   # Next.js auto-rules + project agent roster
├── CLAUDE.md                   # Project instructions for Claude Code
├── README.md                   # Default Next.js README (update when ready)
├── design-reference/
│   └── index.html              # UI prototype — READ ONLY
├── docs/
│   └── engineering/            # 7 architecture/contract/verification documents
├── eslint.config.mjs           # ESLint 9 flat config
├── next-env.d.ts               # Next.js type declarations (gitignored, auto-generated)
├── next.config.ts              # Turbopack + Cache Components + Partial Prefetching enabled
├── package.json                # name: ez-gen-web, includes type-check script
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── public/                     # Static SVG assets (replace with Violet Studio assets)
├── src/
│   └── app/
│       ├── globals.css         # Tailwind 4 CSS-first configuration (no tailwind.config.ts)
│       ├── layout.tsx          # Root layout (update with DM Sans + Manrope fonts)
│       └── page.tsx            # Placeholder home page
└── tsconfig.json               # strict: true, moduleResolution: bundler
```

**Key difference from Next.js 14/15:** Tailwind 4 uses CSS-first configuration.
There is no `tailwind.config.ts`. Tailwind tokens are defined in `globals.css` with `@theme`.
See `docs/engineering/frontend-architecture.md` for token configuration guidance.

---

## 7. Build / Lint / Type-check Commands (expected after scaffold)

| Command | Purpose |
|---|---|
| `pnpm dev` | Local development server (port 3000) |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | ESLint via `next lint` |
| `pnpm type-check` | `tsc --noEmit` (to be added to package.json) |

---

## 8. Baseline Verification Results (2026-10-12)

All checks run on the freshly scaffolded project with no application code added:

| Check | Command | Result |
|---|---|---|
| TypeScript | `pnpm type-check` | **PASS** — 0 errors |
| ESLint | `pnpm lint` | **PASS** — 0 errors |
| Production build | `pnpm build` | **PASS** — 2 routes (/ and /_not-found) |

Build output:
```
▲ Next.js 16.4.0 (Turbopack)
✓ Running next.config.ts took 2.1s
- Cache Components enabled
- Partial Prefetching enabled
✓ Compiled successfully in 5.1s
✓ Generating static pages (4/4) in 704ms
Route (app): / (Static), /_not-found (Static)
```

Any failure introduced after this point is a regression.

---

## 9. Blockers

| Blocker | Severity | Notes |
|---|---|---|
| No `package.json` | High | Resolved by scaffold in this phase |
| No test framework | Medium | No Jest/Vitest/Playwright present; must be added before implementation |
| No CI configuration | Low | Not needed for preparation phase |
| No `.env.example` | Medium | Backend URL and any API keys need documented env vars |
