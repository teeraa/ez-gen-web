# UI Feature Map — Agent C Deliverable

> Inspection date: 2026-10-12  
> Source: `index.html` — 1546-line prototype  
> Status: Mapped — no components implemented

---

## Page Architecture

```
AppShell
├── Sidebar                (fixed left, off-canvas on mobile)
│   ├── BrandMark
│   ├── WorkspaceSwitcher
│   ├── NavList
│   ├── RecentProjects
│   └── SidebarBottom
│       ├── CreditsWidget
│       └── AccountRow
│
└── Main
    ├── Topbar             (sticky)
    │   ├── MobileMenuButton
    │   ├── Breadcrumb
    │   └── TopActions
    │       ├── GlobalSearch
    │       ├── NotificationButton
    │       ├── WhatsNewButton
    │       ├── UpgradeButton
    │       └── Avatar
    │
    └── Content
        ├── HeroSection
        ├── GeneratorSection
        │   └── GeneratorForm
        │       ├── ModeTabs
        │       ├── PromptEditor
        │       │   ├── PromptTextarea
        │       │   ├── CharCounter
        │       │   └── PromptTip
        │       ├── ReferenceRow
        │       │   ├── ImageUploadZone
        │       │   └── EnhanceToggle
        │       ├── SettingsGrid
        │       │   ├── ModelSelect
        │       │   ├── AspectRatioControl
        │       │   ├── DurationControl
        │       │   └── QualitySelect
        │       └── GeneratorFooter
        │           ├── CreditEstimate
        │           └── GenerateButton
        ├── GallerySection
        │   └── GalleryGrid
        │       └── CreationCard[]
        │           ├── CreationImage (with vignette, overlays)
        │           ├── PlayButton
        │           ├── FavoriteButton
        │           ├── DurationBadge
        │           ├── ModelTag
        │           └── CreationInfo
        ├── ProjectsSection
        │   └── ProjectList
        │       └── ProjectRow[]
        │           ├── ProjectThumb
        │           ├── ProjectDetail (title, date, status)
        │           └── ProjectMenu (open / duplicate / delete)
        ├── ToolsSection
        │   └── ToolsGrid
        │       └── ToolCard[] (4 tools)
        ├── AccountSection
        │   ├── PlanPanel (credits, progress)
        │   └── TipPanel (studio tip)
        └── PageFooter
```

---

## Component Inventory

### 1. Sidebar

**CSS class:** `.sidebar`  
**Behaviour:**
- Fixed position, 238px wide on desktop
- Transforms off-canvas (`translateX(-100%)`) on ≤850px
- Opens via `.open` class toggled by mobile menu button
- Closes on outside click (≤850px) and `Escape` key

**Sub-components:**

| Sub-component | Class | Notes |
|---|---|---|
| Brand | `.brand` | Logo symbol + "VIOLET STUDIO" text |
| WorkspaceSwitcher | `.workspace` | Shows workspace name, triggers toast on click |
| NavItem | `.nav-item` | Active state with purple gradient; updates breadcrumb |
| RecentProject | `.recent-project` | Thumbnail + title + date; opens preview on click |
| CreditsWidget | `.credits-mini` | Progress bar, remaining/total display |
| AccountRow | `.account` | Avatar, name, plan, settings button |

**Candidate React component:** `<Sidebar>` with `<NavItem>`, `<RecentProjectItem>`, `<CreditsWidget>`, `<AccountRow>` as children.

---

### 2. Topbar

**CSS class:** `.topbar`  
**Behaviour:**
- `position: sticky; top: 0; z-index: 30`
- Blurred background (`backdrop-filter: blur(22px)`)
- Search collapses to icon at ≤560px

**Sub-components:**

| Sub-component | Behaviour |
|---|---|
| GlobalSearch | Keyboard shortcut ⌘K; filters `.searchable` items live |
| NotificationButton | Toast on click |
| UpgradeButton | Opens pricing modal |

---

### 3. Hero Section

**CSS class:** `.hero`  
**Behaviour:**
- Background image (`Unsplash`) positioned right 34%–100% with left fade overlay
- Two CTAs: "Start creating" (scrolls to generator) and "Explore gallery" (scrolls to gallery)
- Decorative violet radial glow (`:after` pseudo-element)

**Image dependency:** Unsplash placeholder. Replace with a static asset or `next/image` optimized image.

---

### 4. Generator / Creative Canvas

**CSS class:** `.generator`  
**Behaviour:**

#### Mode Tabs
Three modes with distinct behaviours:

| Mode | Textarea placeholder | Upload required | Credit multiplier |
|---|---|---|---|
| `text` | General scene description | Optional | 1× |
| `image-video` | How image should come to life | Required | 1× |
| `image-image` | How to transform the image | Required | 0.6× |

#### Image Upload
- Accepts: PNG, JPG, WEBP, max 8 MB
- Drag-and-drop support
- Inline preview with remove button
- Object URL created locally (no upload in prototype)

#### Controls Grid
- **AI Model:** Select (Violet Motion 2.0, Cinema, Fast, Realism) — affects credit estimate
- **Aspect Ratio:** Segment control (16:9, 9:16, 1:1)
- **Duration:** Segment control (5s, 10s) — affects credit estimate
- **Quality:** Select (Standard, High) — affects credit estimate

#### Credit Estimate Formula
```
base = duration === 10 ? 45 : 25
if quality === "High": base += 20
if model === "Violet Cinema": base += 10
if model === "Violet Realism": base += 5
if mode === "image-image": base = max(10, round(base * 0.6))
if mode === "image-video" && !image: base = max(10, base - 5)
```

#### Generate Button States
| State | Label | Icon | Style |
|---|---|---|---|
| Idle | "Generate Video" | sparkles | Enabled, gradient |
| Validating | — | — | Checks prompt + image |
| Generating | Progress step text | clock (spinning) | Disabled |
| Complete | "Generate Video" | sparkles | Re-enabled |

#### Simulated Generation Steps (650ms each)
1. "Preparing studio..."
2. "Refining your prompt..."
3. "Composing the scene..."
4. "Applying cinematic details..."
5. "Finalizing preview..."

Total simulated time: 3.4 seconds.

**In the real implementation:** submit to backend → poll job status → open preview on completion.

---

### 5. Gallery (Creation Cards)

**CSS class:** `.gallery-grid` / `.creation-card`  
**Layout:** 4 columns → 2 columns (≤1250px) → 1 column (≤560px)

| Element | Behaviour |
|---|---|
| Image | Scales `1.055` + dims on hover |
| Play button | Fades in on hover; opens preview modal |
| Favorite button | Toggles filled heart; toast notification |
| Model tag | Glass badge showing AI model name |
| Duration | Bottom-left glass overlay |
| More button | Toast only in prototype |

**Search integration:** Each card has `data-search` attribute for client-side filtering.

---

### 6. Projects Section

**CSS class:** `.project-list` / `.project-row`  
**Layout:** 3 columns → 2 columns (≤1250px) → 1 column (≤560px)

**Status badges:** `completed` (green), `processing` (purple), `draft` (grey)

**Context menu actions:**
- Open project → opens preview modal
- Duplicate → clones DOM node, prepends to list
- Remove project → removes from DOM + toast

**Dynamic creation:** After a simulated generation, `addGeneratedProject()` prepends a new `project-row` to the list.

---

### 7. Tools Grid

**CSS class:** `.tools-grid`  
**Layout:** 4 columns → 2 columns (≤1250px) → 2 columns (≤560px, column layout)

| Tool | Icon color | Action on click |
|---|---|---|
| AI Video Generator | Purple | Selects "text" mode, scrolls to generator |
| Image Animator | Blue | Selects "image-video" mode |
| Motion Control | Rose | Toast explaining camera movement in prompts |
| Video Enhancer | Green | Sets quality to "High", updates credits |

---

### 8. Plan / Tip Panels

**CSS classes:** `.plan-panel` / `.tip-panel`  
**Layout:** 2 columns → 1 column (≤850px)

- **PlanPanel:** Shows credit usage (2,450 / 5,000), progress bar, resets date, "Manage plan" → pricing modal
- **TipPanel:** Static copywriting tip about prompt quality

---

### 9. Preview Modal

**CSS class:** `#previewModal`  
**Opens from:** Play buttons, recent projects, project "Open" action, post-generation

| Element | Behaviour |
|---|---|
| Image frame | Shows reference image or placeholder orb |
| Caption | Title + subtitle |
| Use as inspiration | Fills prompt textarea with generated text, closes modal |
| Generated result banner | Shown only after simulated generation |

---

### 10. Pricing Modal

**CSS class:** `#pricingModal`  
**Opens from:** Upgrade button, "Manage plan" button

Two plan cards: Creator ($19/mo) and Studio Pro ($49/mo).  
All plan actions show toasts; no payment processing.

---

### 11. Toast Notifications

**CSS class:** `.toast-stack` (fixed, bottom-right)  
**Auto-dismiss:** 4500ms  
**Types:** `info` (sparkles), `success` (check), `error` (close)

---

## Interaction Summary Table

| Feature | Prototype behaviour | Real implementation needed |
|---|---|---|
| Generate video | Simulated 3.4s delay | POST to backend, poll status |
| Image upload | Local object URL | Upload to backend / object storage |
| Favorite | Client state only | Persist to user account |
| Project history | Static + DOM manipulation | Fetch from backend |
| Credit balance | Hardcoded 2,450 | Fetch from backend |
| Pricing | Static display | Connect to billing service |
| Search | Client-side data attribute filter | May need server-side search later |
| Notifications | Toast with static message | Connect to notification service |
| Auth / account | Hardcoded "Jordan Davis" | Authentication system required |

---

## Pages / Routes to Implement

Based on the prototype, the following App Router routes are proposed:

| Route | Description |
|---|---|
| `/` (home) | Dashboard with hero, generator, gallery, projects, tools |
| `/create` | Focused generator view (optional split) |
| `/library` | Full gallery / projects listing |
| `/projects/[id]` | Individual project workspace |
| `/explore` | Community gallery |
| `/settings` | Account and workspace settings |
| `/pricing` | Full pricing page |

For the initial implementation, all sections can live on the `/` route as a scrollable
single-page dashboard, matching the prototype.
