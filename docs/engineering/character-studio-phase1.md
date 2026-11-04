# Character Studio frontend — phase one

Scope: Idea First brief → secure authentication → character image generation →
background status → validated image preview → reusable personal Asset Library.
Film/ad creation, new project planning, and new scene workflows are deferred.
Existing character/style profiles, scene generation, sharing, and export routes
are preserved; their external integrations have not been reverified here.

## Contract and trust boundaries

The authoritative shared contract is
[`ez-gen-api/docs/engineering/character-studio-api-contract.md`](../../../ez-gen-api/docs/engineering/character-studio-api-contract.md).
`src/lib/creative-api.ts` supplies typed image and library requests. Every browser
request goes through `/api/proxy`; the route reads the HttpOnly session cookie,
adds the backend Bearer token, and rejects mismatched mutation origins. Provider
credentials stay on the API server. `/auth/me` validates the studio session.
Login/signup use server actions against the real backend authentication routes.
The historical mock account module is unused; demo credentials are not displayed.

The Next proxy adds optional `data.connectionMode` metadata to successful image
capability responses. Server-only `STUDIO_CONNECTION_MODE=fixture` identifies an
explicit isolated QA run; otherwise the value is `configured`. This describes the
connection mode, not verified provider activation, storage readiness or billing.
The raw Go API contract is unchanged. Never use fixture mode for the user trial:
point its server-only `API_URL` at the intended API instead. QA must set the flag
explicitly so synthetic provider output cannot be mistaken for real AI output.

Image jobs poll real `/jobs/:id`, with indeterminate state and no invented progress
or prices. Capability disabled/error prevents submission. Completed images require
`result.mediaType=image` and a real URL; the backend validates durable bytes before
completion and again checks ownership/source when saving. Explicit retry after a
failed provider job uses a new idempotency key. Ambiguous transport failures reuse
the original key and payload. Draft, active job, and pending key survive a page
reload in sessionStorage; sign-out clears these values. Auth tokens never enter
browser storage. Library search/pagination run on the backend, metadata edits
persist, and deletion removes library metadata while preserving original jobs.

## Design and operation

The final design uses white (#ffffff) and parchment (#f5f5f7) surfaces, ink
(#1d1d1f) typography, a single action blue (#0066cc), and quiet hairline utility
cards with 18px corners. The homepage now uses the supplied landscape video with a static poster and a pause control. Navigation, composer and result panels use neutral translucent white glass with 24px backdrop blur, reflective borders and inset highlights. Dense fields retain opaque readable surfaces. Composer and result share a 960px responsive shell, and textarea focus stays inside its bounds. Reduced motion uses the poster without fetching the video. Decorative gradient headings, optical blobs, rainbow surfaces and
coral actions were removed from the delivered phase-one theme. Thai copy and
Prompt remain consistent. Dense controls use readable opaque surfaces. Button
press and indeterminate feedback honor `prefers-reduced-motion`; informational
steps are text-led and do not imply generated sample content.

Configure server-only `API_URL` for the running Go API. Use `pnpm dev` normally.
To coexist with another development session:

```sh
API_URL=http://127.0.0.1:8080 NEXT_BUILD_DIR=.next-qa pnpm dev --port 55442
NEXT_BUILD_DIR=.next-build-check pnpm build
```

`NEXT_BUILD_DIR` only isolates generated build files; defaults remain `.next`.
No new runtime dependencies were introduced. Generation availability also requires
the backend's activated image model, object storage, migration, worker and JWT
configuration. Do not use paid provider calls as smoke tests without approval.

## Verification

Executed: `pnpm type-check`, `pnpm lint`, and isolated production `pnpm build`.
Initial lint caught reading a ref in JSX; immutable prompt state replaced that ref
read before final verification. Browser/API integration evidence is supplied by the
independent QA agent and uses actual frontend/backend with external provider and
storage fixtures. Fixture evidence is not live paid-provider verification.

Pre-existing changes preserved: CLAUDE.md, repository-map.md, agent configuration,
workflow documentation, and deletion of archived design-reference/index.html.
Current visual reference was read from `/Users/mac/Downloads/index (1).html`;
reference files were never edited.

Delivered phase-one copy is Thai, with the existing Prompt Thai/Latin font retained.
Job machine states remain unchanged in API data and map to Thai display labels.
New backend error messages are Thai. Generated media uses intrinsic aspect ratio
on narrow screens. Fixed/sticky navigation screenshots must be taken after layout
settles and scrolling to the intended viewport; full-page captures after automatic
scrolling can show misleading fixed-element offsets.

Independent audit identified that an older terminal result could cause ambiguous
variation retries to receive new keys. The final recovery state now persists the
immutable prompt/aspect/reference payload, submission key and confirmed job ID.
Only observing that same job in a terminal state permits another billed attempt.
Lost POST responses and failed follow-up GETs reuse the original key across reload.
Definitive client rejection releases the pending attempt for corrected input.
A Thai recovery notice explains immutable retry data and distinguishes older
results. Regression: `node --test tests/image-submission.test.mjs` (three cases).
Library paging recovers after removing its final row; mobile drawer keyboard focus
is contained while open and returned to its trigger on close.

## Character design controls

The brief includes Thai single-selection style and mood chips, plus a reference
format selector. Fresh requests send optional `visualStyle`, `mood`, and
`designFormat` to the image-job API; the Go server validates, normalizes and
compiles these into its versioned character-reference prompt. Defaults are
`auto`, `neutral`, and `full_body`. Full body recommends a frontal, relaxed,
head-to-toe character on a plain background for a single video reference;
turnaround is a three-view design sheet, and portrait is an additional face
reference. These are prompt instructions, not a guarantee of model identity or
an industry-wide interchange standard. Users review anatomy and clothing before
reuse. Aspect ratio starts at 3:4 if supported and remains independently editable;
format selection never silently overrides a chosen ratio.

A version-1 JSON session draft preserves brief, ratio and all three selections
through public-to-sign-in navigation. Legacy text drafts remain readable. Pending
submission signatures freeze the complete request, including selected tags;
ambiguous retries preserve the same key and unmodified signature, including older
payloads that omitted these fields and unknown future fields. Controls are locked
while submitting, processing or recovering an ambiguous request. New selection
values apply only to a new confirmed attempt. Job `rawPrompt` and
`characterDesign` provide the result's frozen brief/options after reload; mutable
composer selections never relabel an older result. Asset creation uses the raw
brief for both prompt and description, never expanded compiler instructions.

### Character reference upload and scoped controls

The main composer exposes an image reference before advanced settings. Authenticated users upload one PNG/JPEG/WebP up to 8 MiB through the existing Next proxy and `uploadsApi.upload`; generation submits only the returned `referenceImageId`. Guests are sent to sign-in with their textual draft preserved, without anonymous uploads. Browser decoding rejects unreadable images before upload; backend validation remains authoritative. Replacement failure keeps the prior reference, and controls lock during upload, active jobs, and ambiguous-submission recovery. Local object-URL thumbnails are revoked on replacement/unmount and never persisted. Draft storage contains only UUID, filename, and expiry; expired references are excluded from restored editable drafts. Pending submissions retain their immutable reference ID across reload, with an attached-state label when no thumbnail is available. No provider call is performed by attaching an image.

Style/mood chips and format controls now use an explicitly imported CSS Module with wrapped pill geometry, selected state, keyboard focus, disabled state and mobile sizing, avoiding reliance on newly appended global feature rules.

Turbopack's Tailwind loader remains enabled for global CSS but excludes `*.module.css` via a documented `condition.not.path` rule. The previous unconditional `as: "*.css"` rewrite discarded CSS Module class exports, leaving the controls unstyled even with the stylesheet present. Scoped component styles use native Next CSS Module processing.

## Product image extension — PRODUCT-IMAGE-20261020

The existing public/signed-in composer now offers สร้างตัวละคร / สร้างสินค้า.
Product mode describes shape, material and packaging; shared mood options use
โทนภาพ with โดดเด่น / สุขุม / สดใส. Character-only reference formats are hidden and
omitted from product requests. A product reference is one uploaded image/packshot.
The existing design is reused with a scoped 44px minimum for category buttons;
no global CSS, provider, authentication or production editor behavior is changed.

Category persists with guest drafts through sign-in and reload. Unknown requests
lock category changes and preserve the original category/options/key, including
when an older terminal result is displayed. Matching terminal requests can finish
without preventing a new category choice. Result text, names, help and save type
come from the completed job; changing the composer mode cannot relabel a result.
The library filters characters or สินค้า/พร็อพ, resets pagination/search, preserves
category-appropriate empty creation, and omits video actions for prop assets.

Unit coverage checks legacy drafts, product format omission, category snapshot
immutability, and job-based asset metadata/raw prompt bounds. The standalone
`tests/product-image.browser.mjs` uses a loopback auth fixture and intercepted
browser API calls, exercising guest sign-in draft recovery, reload, both result
category/mode combinations, ambiguous retries with an older terminal result,
upload locking, activity save and library success/loading/empty/error at
1440/768/375. Configure `BASE_URL`, `FIXTURE_PORT`, `ARTIFACT_DIR`,
`PLAYWRIGHT_MODULE` and `CHROME_PATH` as needed. Its generated media is a local
1px fixture; passing this harness does not establish live provider readiness.
Final command results, source hashes, screenshots and independent review belong
to the coordinator task evidence.

Rollout guard: an older backend without `image-capabilities.categories` is treated as
character-only. Product submission/replay is blocked before a request is sent, including
an unresolved product snapshot with an older character result. Guest selection/draft
recovery remains available. The browser fixture explicitly checks both old-capability
new-product submission and old-capability product replay produce no POST.
