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
  from server state. Video phase2 remains disabled.
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
