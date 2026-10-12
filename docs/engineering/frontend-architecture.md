# Frontend Architecture — Agent D Deliverable

> Date: 2026-10-12  
> Stack: Next.js 15 App Router · TypeScript strict · Tailwind CSS · shadcn/ui · Lucide React  
> Status: Proposed — not yet implemented

---

## 1. App Router Directory Structure

```
src/
├── app/
│   ├── layout.tsx                 # Root layout: fonts, metadata, providers
│   ├── page.tsx                   # Dashboard (/ route) — composes all home sections
│   ├── globals.css                # Tailwind directives + CSS custom properties
│   │
│   ├── (dashboard)/               # Route group — shares dashboard layout
│   │   ├── layout.tsx             # Sidebar + Topbar shell (Client Component)
│   │   ├── library/page.tsx       # Full library view
│   │   ├── explore/page.tsx       # Community gallery
│   │   └── settings/page.tsx      # Account settings
│   │
│   ├── projects/
│   │   └── [id]/
│   │       └── page.tsx           # Individual project workspace
│   │
│   ├── pricing/
│   │   └── page.tsx               # Standalone pricing page
│   │
│   └── api/                       # Next.js Route Handlers (thin proxy layer)
│       ├── jobs/
│       │   ├── route.ts           # POST /api/jobs — create generation job
│       │   └── [id]/
│       │       └── route.ts       # GET /api/jobs/[id] — poll job status
│       ├── projects/
│       │   └── route.ts           # GET /api/projects — project history
│       └── credits/
│           └── route.ts           # GET /api/credits — user balance
│
├── components/
│   ├── ui/                        # shadcn/ui generated components (do not hand-edit)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── select.tsx
│   │   ├── toast.tsx              # or use sonner
│   │   └── ...
│   │
│   ├── layout/                    # Application shell
│   │   ├── Sidebar.tsx            # Client Component (nav state, mobile toggle)
│   │   ├── Topbar.tsx             # Client Component (search, notifications)
│   │   ├── BrandMark.tsx          # Server Component
│   │   └── AccountRow.tsx         # Client Component (auth state)
│   │
│   ├── dashboard/                 # Home page sections
│   │   ├── HeroSection.tsx        # Server Component
│   │   ├── GeneratorSection.tsx   # Client Component (form state)
│   │   ├── GallerySection.tsx     # Server Component wrapper
│   │   ├── ProjectsSection.tsx    # Server Component wrapper
│   │   ├── ToolsSection.tsx       # Client Component (tool actions)
│   │   └── AccountSection.tsx     # Server Component + Client sub-components
│   │
│   ├── generator/                 # Generator form sub-components
│   │   ├── GeneratorForm.tsx      # Client Component (react-hook-form)
│   │   ├── ModeTabs.tsx           # Client Component
│   │   ├── PromptEditor.tsx       # Client Component
│   │   ├── ImageUploadZone.tsx    # Client Component (drag-and-drop)
│   │   ├── SettingsGrid.tsx       # Client Component
│   │   ├── CreditEstimate.tsx     # Client Component
│   │   └── GenerateButton.tsx     # Client Component
│   │
│   ├── gallery/                   # Gallery components
│   │   ├── CreationCard.tsx       # Client Component (hover, favorite)
│   │   └── GalleryGrid.tsx        # Server or Client depending on data source
│   │
│   ├── projects/                  # Project list components
│   │   ├── ProjectRow.tsx         # Client Component (context menu)
│   │   ├── ProjectMenu.tsx        # Client Component
│   │   └── StatusBadge.tsx        # Server Component
│   │
│   └── shared/                    # Generic reusable components
│       ├── Modal.tsx              # Accessible modal wrapper
│       ├── Toast.tsx              # Toast provider/hook
│       ├── SegmentControl.tsx     # Segment button group
│       ├── ProgressBar.tsx        # Animated progress bar
│       └── Avatar.tsx             # User avatar
│
├── hooks/
│   ├── useGenerationJob.ts        # Poll job status until terminal state
│   ├── useCredits.ts              # SWR/React Query for credit balance
│   └── useProjects.ts             # SWR/React Query for project list
│
├── lib/
│   ├── api-client.ts              # Typed fetch wrapper for Go backend
│   ├── schemas.ts                 # Zod schemas for forms + API responses
│   └── utils.ts                   # cn(), formatDuration(), etc.
│
└── types/
    ├── api.ts                     # API response types (mirrors api-contract.md)
    ├── generation.ts              # Job, JobStatus, GenerationMode types
    └── project.ts                 # Project, ProjectStatus types
```

---

## 2. Server vs Client Component Boundaries

### Rule: default to Server Components

Only add `"use client"` when the component needs:
- Browser APIs (`useState`, `useEffect`, `useRef`)
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser-only APIs (FileReader, URL.createObjectURL, drag events)
- Third-party libraries that are not RSC-compatible

### Component classification

| Component | Directive | Reason |
|---|---|---|
| `app/layout.tsx` | Server | Metadata, font loading |
| `app/page.tsx` | Server | Composes sections, no interactivity at root level |
| `Sidebar.tsx` | `"use client"` | Mobile toggle state, active nav item |
| `Topbar.tsx` | `"use client"` | Search input, notification state |
| `HeroSection.tsx` | Server | Static content, no interactivity |
| `GeneratorForm.tsx` | `"use client"` | react-hook-form, file state, submit |
| `ImageUploadZone.tsx` | `"use client"` | File input, drag events, object URL |
| `ModeTabs.tsx` | `"use client"` | Mode selection state |
| `CreationCard.tsx` | `"use client"` | Hover state, favorite toggle |
| `ProjectRow.tsx` | `"use client"` | Context menu open/close |
| `GallerySection.tsx` | Server | Fetches gallery data server-side |
| `ProjectsSection.tsx` | Server | Fetches project list server-side |
| `Modal.tsx` | `"use client"` | Focus trap, body scroll lock |
| `StatusBadge.tsx` | Server | Pure display, no interactivity |
| `AccountRow.tsx` | `"use client"` | Auth state access |

---

## 3. Feature Module Conventions

Each feature area owns its own directory under `components/`. Rules:

1. A feature component does not import from another feature's directory.
2. Shared primitives live in `components/shared/` or `components/ui/`.
3. Data fetching logic lives in `hooks/` or server components, not in leaf UI.
4. Form schemas live in `lib/schemas.ts`, co-located when complex.

---

## 4. Data Access Pattern

### Server-side (dashboard initial load)
```typescript
// In a Server Component (e.g., ProjectsSection.tsx)
import { getProjects } from "@/lib/api-client";

export default async function ProjectsSection() {
  const projects = await getProjects(); // calls Go backend directly from server
  return <ProjectList projects={projects} />;
}
```

### Client-side (polling, mutations)
```typescript
// In a Client Component (e.g., GeneratorForm.tsx)
import { useGenerationJob } from "@/hooks/useGenerationJob";

const { job, isPolling } = useGenerationJob(jobId);
```

### API client
All calls to the Go backend go through `lib/api-client.ts`, which:
- Reads `NEXT_PUBLIC_API_URL` (server-side uses `API_URL`)
- Attaches auth headers
- Normalizes error responses into a typed `ApiError`

---

## 5. Environment Variables

| Variable | Scope | Description |
|---|---|---|
| `API_URL` | Server-only | Internal URL of the Go backend (never sent to browser) |
| `NEXT_PUBLIC_API_URL` | Public | External/client-accessible API URL if needed |
| `NEXTAUTH_SECRET` | Server-only | Session signing secret (when auth is added) |
| `NEXTAUTH_URL` | Server-only | App canonical URL for auth callbacks |

Rules:
- No `NEXT_PUBLIC_` prefix for secrets, tokens, or internal service URLs.
- `.env.local` is git-ignored. `.env.example` is committed with placeholder values.
- The Go backend credentials (BytePlus API key) must NEVER appear in any variable accessible to the browser.

---

## 6. Form Validation

Use **Zod + react-hook-form** for the generator form.

```typescript
// lib/schemas.ts
export const generationSchema = z.object({
  prompt: z.string().min(1, "Describe your scene to continue").max(2000),
  mode: z.enum(["text", "image-video", "image-image"]),
  model: z.enum(["violet-motion-2", "violet-cinema", "violet-fast", "violet-realism"]),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.union([z.literal(5), z.literal(10)]),
  quality: z.enum(["standard", "high"]),
  enhancePrompt: z.boolean(),
});
```

The `referenceImage` file is handled separately (not in Zod — use `useForm` `register` with a
custom validator) because `File` objects are not serializable.

---

## 7. Loading, Error, and Empty States

Each data-bearing section must implement four states:

| State | Implementation |
|---|---|
| Loading | Skeleton component matching card dimensions |
| Error | Error boundary with retry action |
| Empty | Empty state with CTA (see `.empty-state` class in design) |
| Success | Normal rendered content |

Use `loading.tsx` and `error.tsx` colocated with route segments for page-level states.

---

## 8. Generation Job Lifecycle (UI state machine)

```
idle
  → submitting        (form submit, POST to /api/jobs)
  → polling           (GET /api/jobs/[id] every 2s)
      → completed     (open preview modal, reset form)
      → failed        (show error toast, re-enable form)
  → cancelled         (user cancels, DELETE /api/jobs/[id])
```

The `useGenerationJob` hook encapsulates this lifecycle. The form component
observes job state and renders button labels accordingly.

---

## 9. Tailwind Configuration

Extend `tailwind.config.ts` to include:
- All CSS custom properties from `design-system.md` as Tailwind tokens
- The DM Sans and Manrope font families
- The custom `--ease` cubic-bezier as an animation timing value
- `backdropBlur` values matching the prototype

Use CSS custom properties in `globals.css` for runtime values (colors, radii);
reference them via `var()` in Tailwind arbitrary values where Tailwind tokens
are insufficient.

---

## 10. shadcn/ui Component Plan

Run `pnpm dlx shadcn@latest add <component>` for each:

| shadcn component | Used for |
|---|---|
| `button` | All button variants (override styles) |
| `dialog` | Preview and pricing modals |
| `select` | Model and quality dropdowns |
| `toast` | Or use `sonner` for the toast stack |
| `progress` | Credit usage bar |
| `separator` | Sidebar dividers |
| `tooltip` | Icon buttons |
| `dropdown-menu` | Project context menu |

After install, extend each component with the Violet Studio design tokens.
Do not use shadcn components unstyled.

---

## 11. Security Boundaries (Architecture Level)

- Route handlers in `app/api/` act as a thin authenticated proxy to the Go backend.
- No BytePlus credentials are read from the browser environment.
- File uploads are validated server-side (type, size) before forwarding to backend.
- User-supplied prompt text is treated as untrusted input — sanitized at the API boundary.
- See `frontend-security.md` for full security review.

---

## 12. Known Decisions Deferred

| Decision | Reason deferred |
|---|---|
| Authentication mechanism (NextAuth vs custom) | Requires backend auth design first |
| State management library (Zustand / Jotai / none) | Evaluate after first implementation phase |
| Data fetching library (SWR vs React Query vs native) | Evaluate after polling requirements are clear |
| CDN / image optimization strategy | Requires infrastructure decisions |
| i18n | Not in scope for v1 |
