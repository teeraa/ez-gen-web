# Director Web integration — 2026-11-04

Status: Director integration and independent acceptance complete. This report describes
the local integration snapshot, not a production deployment.

Director now reads and mutates server projects through `/api/proxy/director/*`.
The old localStorage project/demo store, procedural artwork and simulated
generation timers have been removed. Existing browser-only demo projects are not
migrated. The existing visual design and CSS were preserved.

## Implemented behavior

- Server project create/list/search/paging/delete/detail and navigation/settings.
- Capabilities supply styles, static sample URLs, aspect ratios, resolutions,
  models, limits, cameras and prices; project estimates drive generation costs.
- Idea autosave600ms and immediate option changes; explicit scene save; shot
  autosave600ms/blur. Serialized mutations use the latest revision. Newer drafts
  survive poll responses and earlier saves. Dirty scenes block storyboard work.
- Cover generation/clear/shot selection, story create/replace/rewrite,
  storyboard settings/create/replace, shot editing/add/delete/regenerate/retry.
- Real character library and Character Studio image-job/save integration.
- Visibility-aware2s polling, conditional ETags and unconditional signed-media
  refresh with guards against repeated image-error fetch loops. Progress derives
  from server state. Shot video (2026-11-04 follow-up) uses `POST /video`: whole-story
  and per-shot buttons gated by `capabilities.videoEnabled` and the model's
  `aspectRatios`; finished clips play in the shot viewer and polling continues
  while any shot video is queued/processing.
- Immutable UUID/payload submissions survive ambiguous responses and reload;
  logout clears persisted and in-memory requests. Thai errors expose request IDs,
  revision conflicts, insufficient points and retry timing where provided.
- Proxy PATCH/DELETE bodies and ETag/Retry-After/304/204 handling. Exact browser
  Origin is checked against validated actual Host and scheme to avoid Next16
  loopback normalization rejecting legitimate requests; cross-origin guards and
  upload protections remain covered by tests.
- Shared ShellFrame pathname listener is isolated under Suspense, preserving
  the frame and mobile drawer behavior while allowing production prerender.

## Verification

| Check | Observed |
| --- | --- |
| Web lint and type-check | PASS; two existing lint warnings outside Director |
| Director unit/proxy regression | PASS16/16, independently rerun |
| Production build | PASS using supported Next webpack mode, all33pages prerendered |
| Default Turbopack command | BLOCKED by local helper-port EPERM, not reported as passed |
| Real Next→proxy→Go→PostgreSQL browser flow | PASS1440/375, findings empty and zero pageerrors |
| Go build/vet with test-only fixture | PASS |
| Director PostgreSQL race tests | PASS; prior unrelated full-suite FFmpeg WebP encoder limitation remains |
| Fresh engineering audit | PASS; no material findings remain |
| Fresh UX review | PASS1440/768/375; modal focus, mobile names, loading/error/retry rechecked independently |

The full browser flow covers accepted request with dropped response/reload/exact
replay, actual402/refund/retry, revision409 and explicit retry, immediate back-save,
scene late edits, story/rewrite, storyboard, stale images/regeneration, add/delete,
shot covers, persistence/search/delete, ETag304 and media refresh guards.

Fixture boundaries are explicit: Director HTTP handlers, PostgreSQL persistence
and worker lifecycle are real. Analysis/image/storage/session providers are
isolated test doubles. Character Studio/error-availability scenarios use labeled
API-response fixtures; no paid providers or deployed database were used. Browser
edits during planning use the current description in the later image submission;
Go race tests separately exercise edits after image submission.

Evidence: `/tmp/director-web-20261104/browser-final/results.json`, screenshots
and log; `/tmp/director-web-20261104/snapshot-final.json`; independent auditor and
UX artifacts under the same directory. Detailed ownership, baseline, findings
and exact command logs are in the workspace
`docs/engineering/tasks/director-web-20261104.md`.

Final independent UX evidence is `ux/final-recheck.json` with matching before/after
source manifests. All material engineering and UX findings are resolved. Human
documentation review remains pending; no human approval is claimed.

## Before deployment

Apply migration029 through the operator deployment process, configure model and
storage services plus six style samples, and explicitly fund Director point
accounts (which start at zero). This task does not run deployment migrations,
fund production accounts, commit or deploy.

Director costs and insufficient-balance messages use the real API. The existing
global points widget/payment integration remains separate; its mock account
display is not a Director account balance. No payment/top-up endpoint was added.

## Series and episodes — 2026-11-08

Status: implemented against the fixed wire contract in
the coordinator task record `2026-11-08-director-series-episodes.md`; see the "Director series & episodes"
section of [api-contract.md](api-contract.md) for the endpoints. Not yet verified
against a running API (built in parallel) or in a browser.

- Hub `/studio/director`: "สร้างโปรเจกต์" creates a series (`POST /series`: name,
  aspect ratio, style, resolution; no cast picker existed in the create flow, so
  `characterAssetIds` is not sent) and opens its Episodes page. The hub lists series
  (`GET /series`, cover, episode count, updated time, rename via `PATCH /series/:id`,
  delete via `DELETE /series/:id` with a Thai `SERIES_BUSY` message), and below them
  "โปรเจกต์เดี่ยว (เดิม)" with the unchanged `GET /projects` search/paging/delete.
  The legacy section is hidden when there are no standalone projects and no search.
  An uncertain pre-series `create-project` submission can still be replayed or discarded.
- Episodes `/studio/director/series/[seriesId]` (`GET /series/:id`): header with name,
  defaults and episode count; "ตั้งค่าโปรเจกต์" edits name/defaults (`PATCH`, revision
  conflict reloads) and deletes the series; episode cards show ตอนที่ N, title, step,
  story/storyboard status, cover and updated date, with title rename
  (`GET /projects/:id` for revision, then `PATCH /projects/:id {revision, episodeTitle}`)
  and delete (`DELETE /projects/:id`). "สร้างตอนใหม่" (optional title) posts
  `/series/:id/episodes` and opens `/studio/director/<episodeId>` at the Idea step.
  Loading, not-found, error/retry and empty (primary CTA) states are present.
- Episode page: when `seriesId` is set, the header shows the breadcrumb
  "ชื่อโปรเจกต์ › ตอนที่ N: title" (series name from `GET /series/:id`), back/arrow and
  delete return to the Episodes page, and the settings menu edits the episode title
  (may be cleared). Standalone projects are unchanged.
- `tests/director.browser.mjs` now drives create series (drop/reload/replay) -> Episodes empty
  state -> create episode -> Idea step + breadcrumb, back to Episodes, and deletes the episode
  and series. Not yet run against a series-capable API.
