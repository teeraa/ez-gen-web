# Verification Playbook — Agent F Deliverable

> Date: 2026-10-12  
> Status: Procedures documented — actual results will be recorded after scaffold completes

---

## 1. Baseline: Distinguishing Pre-existing Failures from Regressions

Before any implementation work begins, run all checks and record results.
Any failure that exists in the baseline is **not** a regression.

Baseline recording procedure:
```bash
# Record current check state
pnpm type-check 2>&1 | tee docs/engineering/baseline/typecheck.txt
pnpm lint       2>&1 | tee docs/engineering/baseline/lint.txt
pnpm build      2>&1 | tee docs/engineering/baseline/build.txt
```

After implementation work, compare against the baseline.
A new failure that was not in the baseline is a regression that must be fixed
before merging.

---

## 2. Environment Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Edit .env.local with local values
# Required: API_URL=http://localhost:8080
# Optional: NEXT_PUBLIC_API_URL=http://localhost:8080

# 4. Start development server
pnpm dev
# → http://localhost:3000
```

Expected output: Next.js compiled successfully, accessible at localhost:3000.

---

## 3. Development Checks

### 3.1 TypeScript

```bash
pnpm type-check
# → Runs: tsc --noEmit
```

**Pass criteria:** Zero errors. Warnings are acceptable but must be tracked.

**Common issues after scaffold:**
- `strict: true` may flag implicit `any` in generated shadcn components — fix each explicitly
- Return type annotations required on exported functions
- `exactOptionalPropertyTypes` may flag missing `| undefined` in interfaces

### 3.2 ESLint

```bash
pnpm lint
# → Runs: next lint
```

**Pass criteria:** Zero errors. Fix all `error`-level rules before merge.
`warn`-level rules must not increase across a PR.

### 3.3 Combined pre-merge check

```bash
pnpm lint && pnpm type-check && pnpm build
```

All three must pass before any PR is merged.

---

## 4. Build Verification

```bash
pnpm build
```

**Pass criteria:**
- Exit code 0
- No TypeScript compilation errors
- All routes listed in the route map compile without error
- No missing environment variable warnings for required vars

**Check production build output:**
```bash
pnpm build && pnpm start
# → http://localhost:3000 (production mode)
```

Verify in a browser that the page renders correctly in production mode.

---

## 5. Browser Smoke Tests

Run after every significant change. These are manual procedures until Playwright
is added.

### 5.1 Dashboard load
1. Open `http://localhost:3000`
2. Verify: sidebar renders, hero section visible, generator form visible
3. Verify: no console errors

### 5.2 Generator form — text mode
1. Type a prompt in the textarea
2. Verify: character counter updates
3. Select a model from the dropdown
4. Verify: credit estimate updates
5. Change duration to 10s
6. Verify: credit estimate increases to 45+
7. Click "Generate Video"
8. Verify: button enters loading state
9. Wait for completion or backend error

### 5.3 Generator form — image mode
1. Click "Image to Video" tab
2. Verify: textarea placeholder changes
3. Click the upload zone
4. Select a PNG/JPG image under 8 MB
5. Verify: preview thumbnail appears
6. Verify: remove button appears
7. Click remove button
8. Verify: upload zone resets

### 5.4 Gallery
1. Hover over a creation card
2. Verify: image scales, play button appears
3. Click play button
4. Verify: preview modal opens with image
5. Click "Use as inspiration"
6. Verify: textarea is pre-filled, modal closes, scroll to generator

### 5.5 Projects context menu
1. Click the "..." button on a project row
2. Verify: context menu opens
3. Click "Open project"
4. Verify: preview modal opens
5. Press Escape
6. Verify: modal closes

### 5.6 Mobile responsive
1. Open browser DevTools → responsive mode → 375px wide
2. Verify: sidebar is hidden (off-canvas)
3. Click the hamburger menu
4. Verify: sidebar slides in
5. Click outside the sidebar
6. Verify: sidebar closes

### 5.7 Keyboard accessibility
1. Tab through all interactive elements
2. Verify: focus ring visible on each (purple outline from design)
3. Open a modal
4. Verify: focus trapped inside modal
5. Press Escape
6. Verify: modal closes, focus returns to trigger

---

## 6. Visual Regression Review

Until an automated tool (Playwright visual comparison) is configured, use
the manual procedure below to check against the HTML reference.

### Procedure
1. Open `design-reference/index.html` in a browser (via a static server, not
   `file://` — some fonts and object URLs behave differently)
2. Open the Next.js app at `localhost:3000`
3. Compare side-by-side at 1440px, 1024px, 768px, and 375px

### What to check (derived from `design-system.md`)

| Check | Expected |
|---|---|
| Background color | `#08080d` (very dark, near-black with slight purple) |
| Sidebar opacity | Near-opaque dark surface, not transparent |
| Active nav item | Purple gradient background, light purple text |
| Hero H1 | Manrope 750, clamp size, `-2.2px` letter-spacing |
| Generator card | Slight inner glow at top edge |
| Mode tab indicator | Purple glass pill |
| Button hover | Lifts 2px, brightness increases |
| Creation card hover | Image scales, play button fades in |
| Toast | Slides in from bottom-right |
| Modal | Backdrop blur visible |

---

## 7. Accessibility Checks

Run with browser DevTools Accessibility panel or axe browser extension.

**Required:** Zero critical or serious violations before any feature is marked done.

Key checks for this application:
- All images have meaningful `alt` text (or `alt=""` for decorative images)
- All icon buttons have `aria-label`
- Modals use `role="dialog"` and `aria-modal="true"`
- Toast region has `aria-live="polite"`
- Segment controls use `role="group"` with `aria-label`
- Color contrast: text against background meets WCAG AA (4.5:1 for normal text)
  - Note: `var(--subtle)` (`#696477`) against `var(--bg)` (`#08080d`) — verify ratio
  - Note: `var(--muted)` (`#9893a8`) against `var(--bg)` — verify ratio

---

## 8. Known Limitations

| Limitation | Notes |
|---|---|
| No Playwright configured | Add when first feature is complete |
| No visual snapshot baseline | Defer until UI is stabilized |
| Backend not running locally | Generation tests require mock or real backend |
| Unsplash images | Thumbnail placeholders — not available offline |
| Signed media URLs | Cannot test media download without backend |

---

## 9. Acceptance Criteria per Feature

Each implemented feature must satisfy:

- [ ] TypeScript compiles without new errors (`pnpm type-check`)
- [ ] ESLint passes without new errors (`pnpm lint`)  
- [ ] Production build succeeds (`pnpm build`)
- [ ] Browser smoke test passes for the feature's golden path
- [ ] Browser smoke test passes for the known edge cases
- [ ] No new console errors introduced
- [ ] Mobile layout verified at 375px
- [ ] Focus management correct for interactive elements
- [ ] No accessibility violations (axe or DevTools)
- [ ] Compared visually against `design-reference/index.html` at ≥2 breakpoints

---

## 10. Actual Baseline Verification Results (2026-10-12)

### TypeScript check result
```
$ pnpm type-check
→ PASS (0 errors)
```

### ESLint result
```
$ pnpm lint
→ PASS (0 errors)
```

### Build result
```
$ pnpm build
▲ Next.js 16.4.0 (Turbopack)
✓ Compiled successfully in 5.1s
Route (app): / (Static), /_not-found (Static)
→ PASS
```

### Browser smoke test
Deferred — scaffolded `page.tsx` shows default Next.js welcome page.
Run after the first Violet Studio component is implemented.

---

## 11. Next.js 16 and Tailwind 4 Notes

**Tailwind CSS 4 uses CSS-first configuration.** There is no `tailwind.config.ts`.
All custom tokens are defined in `src/app/globals.css` using `@theme`:

```css
@import "tailwindcss";

@theme {
  --color-canvas: #08080d;
  --color-violet-500: #9b6dff;
  --font-sans: "DM Sans", sans-serif;
  --font-display: "Manrope", sans-serif;
}
```

**Next.js 16 differences from 15:** Cache Components, Partial Prefetching, and Turbopack
as default. Read `node_modules/next/dist/docs/` before implementing any Next.js-specific pattern.
