# พื้นที่สร้างวิดีโอ

Implemented routes: `/studio/projects` and `/studio/projects/[id]`. The character creator and legacy scenes remain available. Current authoritative contract is `ez-gen-api/docs/engineering/video-production-api-contract.md` in the sibling API repository.

Two contextual sections: scene/clip creation and editing/export. Project creation saves a manual first scene from the brief; this is not AI script generation. Scene settings and authorized character asset references are persisted before explicit billed generation. Capabilities come from the server; configuration availability does not prove provider activation. Unknown costs are shown as unknown. Job states are asynchronous, without fabricated progress. Successful versions remain selectable; previously selected output stays visible during regeneration.

Scene and editor draft changes survive tab/scene switches and reload in session storage. Explicit save persists server-side. Paid submission payload and UUID remain frozen through ambiguous network failures and reload; definitive validation/auth/resource failures clear the pending attempt. Logout clears production session drafts. Editor saves use the project revision and report conflicts rather than silently overwrite server changes. Clip versions are explicit; trim ranges, inclusion and order are persisted. Native preview is labeled as an individual clip, respects its trim, and never claims to be the assembled result. Export snapshots 1–20 distinct scene/version clips, tracks real export jobs, supports retry and fetches fresh signed output URLs on preview/download.

Scope: hard-cut order/trim and MP4 720p/1080p output, capabilities permitting. Audio, text overlays and transitions have no controls in this first production workspace; existing legacy rendering APIs are preserved. No in-app mocked generation or fake download. Fixture connection mode displays a clear warning.

Verification owned by implementation: lint/type checks and `node --test tests/*.test.mjs`; current tests cover invalid trims, unknown duration and full-duration sentinel. Coordinator owns final production build and independent rendered QA against actual services with external provider/storage fixtures. No paid AI requests made by the implementation agent. Runtime/build integration is not inferred from source or unit checks.


Readiness bug fixes (FLOW-READINESS-20261020): output selection consumes the exact
`{sceneId,selectedJobId}` response and updates the existing scene. A URL-imported
reference is consumed when the first scene mounts; later removal/selection and delayed
responses cannot reapply the URL import. The native reference dialog ignores a stale
close event from a StrictMode cleanup when it has already reopened, has a labelled
heading, and returns focus on close. These small behavior fixes reuse the current design;
no layout, CSS or dependency changes are involved.

`tests/production-flow.browser.mjs` is a standalone local fixture regression, requiring
Playwright via `PLAYWRIGHT_MODULE`, Chrome via optional `CHROME_PATH`, and a separate
Next server at `127.0.0.1:13001` started with `API_URL=http://127.0.0.1:18081`. The
script owns the loopback auth fixture on port18081 and intercepts browser API calls.
It tests imported-reference removal during a delayed response, picker StrictMode lifetime,
loading/error/empty states, Escape/focus return, replacement, immediate selection and
assembly at1440/375. This mocked boundary does not prove live backend/provider readiness.
Final gate/runtime results and source hashes are recorded in the coordinator task evidence.

## POLLING-BACKGROUND-20261020

Reference mode intent is preserved for existing saved scenes and session drafts,
including URL imports and delayed asset responses. A new reference in text mode
prefers appearance reference where supported. Replacing an existing reference or
changing to a model that supports the current mode preserves the selected mode.
The existing scene description carries place/background instructions; no new field,
automatic crop/removal or identity guarantee is introduced. First-frame mode explains
that its background may remain, and capable models offer an explicit appearance switch.

GET refreshes use one completion-based controller per active resource/context:
scene4s, image job3s, activity5s, legacy job>=2.5s, legacy export>=3s. Periodic
refresh stops when terminal/empty or no exports are active. Visibility pauses and
invalidates in-flight work; visible/focus refreshes coalesce. GET errors stop scheduled
retries and retain content with manual refresh. Manual buttons retain keyboard focus
while busy through aria-disabled guards. Generation POSTs are never scheduled by polling.

Scene refresh directly resolves selected/pending/known-active jobs absent from the
current page, replacing stale responses and resolving evicted active versions. Unknown
POST attempts without a job ID retain the immutable manual same-key recovery path.
Signed media URLs can receive a one-shot expiry refresh after terminal completion;
a failed/invalid/same expired deadline cannot create a loop. A new future deadline is
required to rearm, and media error refresh is rate limited. Legacy completion actions
fire once per resource despite later focus/expiry refreshes.

Deterministic tests cover completion scheduling, hidden/context cancellation, focus
coalescing, rapid visibility changes, terminal/error stop, expiry guards and legacy
completion semantics. `tests/polling-background.browser.mjs` uses loopback auth/API
fixtures and a valid local MP4, never a paid provider. It covers reference intent,
background help, manual recovery, retained content/focus and idle request counts at
1440/375. Headless visibility transitions are explicitly simulated document events.
