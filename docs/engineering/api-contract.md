# API Contract — ez-gen-web ↔ ez-gen-api

> Updated: 2026-10-14 (synced to `ez-gen-api` `main` — storyboard export + timeline editor live)
> Source of truth: `ez-gen-api/docs/engineering/video-generation-api-contract.md` and
> `ez-gen-api/docs/engineering/violet-dna-api-contract.md`. **If this file disagrees with the
> backend docs, the backend wins** — update this file.
> Provider: BytePlus ModelArk (only the Go backend talks to it).

---

## Design Principles

1. The browser never calls BytePlus or `ez-gen-api` directly — everything goes through the
   Next.js proxy `src/app/api/proxy/[...path]/route.ts` (`/api/proxy/<path>` → `${API_URL}/open/v1/<path>`).
2. Job IDs are application UUIDs, never BytePlus task IDs.
3. Errors carry a machine-readable `code` and a human-readable `message`.
4. Timestamps are ISO 8601 UTC strings.

## Envelope

Every success response is wrapped; always read from `data`:

```json
{ "data": { ... }, "requestId": "..." }
```

Errors:

```typescript
{
  code: string;                                  // e.g. "VALIDATION_ERROR"
  message: string;
  details?: Array<{ field: string; message: string }>;
  requestId: string;
}
```

`src/lib/api.ts` (`apiFetch`) unwraps `data` and throws an `Error` carrying `code` and `details`.
User-facing text for known codes lives in `src/lib/api-errors.ts`.

---

## Jobs

### `GET /open/v1/jobs/:jobId`

```typescript
{
  jobId: string;
  status: "queued" | "submitted" | "processing" | "succeeded" | "failed" | "cancelled";
  progress: number;                       // 0–100
  currentStep: "queued" | "generating" | "saving" | "done" | "failed" | "cancelled" | null;
  estimatedSecondsRemaining: number | null;
  model: ModelId;
  aspectRatio: AspectRatio;
  duration: number;
  quality: "standard" | "high";
  creditsCharged: number | null;
  result: {
    mediaUrl: string;                     // Supabase signed URL, valid 1 hour
    thumbnailUrl: string;                 // may be "" if the still couldn't be stored
    mediaType: "video" | "image";
    expiresAt: string | null;             // when mediaUrl / thumbnailUrl stop working
  } | null;
  error: { code: string; message: string } | null;
  sceneId: string | null;
  compiledPrompt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
```

**Status flow:** `queued → submitted → processing → succeeded | failed | cancelled`.
`submitted` is a working state (shown like `processing`). After the provider finishes, the job
stays `processing` with `currentStep: "saving"` while the backend copies the file into storage,
so this tail can take a while.

**Polling rules (implemented in `src/hooks/use-polling.ts`):**
- One loop per `jobId`; the next request is scheduled only after the previous one settles.
- Interval 2.5 s (never faster than 2 s).
- The `useEffect` cleanup clears the timer on unmount / `jobId` change.
- Stop immediately on `succeeded`, `failed` or `cancelled`.
- `select-output` is called at most once per job (ref-guarded) and never restarts polling.

**Progress UI (implemented in `JobProgressBar`):**
- Bar shows `max(previously shown, progress)` — it never moves backwards — with a ~1.5 s width
  transition between polls.
- Capped at 99 % until `status === "succeeded"`.
- Label from `currentStep`: `queued` "รอคิว…", `generating` "กำลังสร้างวิดีโอ…", `saving` "กำลังบันทึก…".
- Adds "เหลือประมาณ N วินาที" when `estimatedSecondsRemaining > 0`, "ใกล้เสร็จแล้ว…" when it is `0`.

**Media URLs:**
- Play `result.mediaUrl` directly: `<video src controls playsInline>` — no `crossOrigin`,
  no `fetch()`/blob.
- Host: `https://<ref>.supabase.co/storage/v1/object/sign/...`. The app currently has no CSP and
  doesn't use `next/image` for thumbnails; if either is added, allow `<ref>.supabase.co` in
  `media-src`/`img-src` or `images.remotePatterns`.
- URLs expire after 1 hour. Never persist them (no localStorage / FE DB) — keep the `jobId` and
  re-`GET` the job. The player re-fetches shortly before `expiresAt` and once automatically on
  `<video onError>`.
- A scene only stores `selectedJobId`; the scene page fetches that job to get `mediaUrl`.

### Job error codes

| `error.code` / HTTP code | Meaning | UI |
|---|---|---|
| `OUTPUT_EXPIRED` | Video couldn't be saved within 24 h of generation | "บันทึกวิดีโอไม่ทัน กรุณาสร้างใหม่" + "สร้างใหม่" button |
| `422 MODEL_NOT_SUPPORTED` | Duration / aspect ratio / mode outside the model's limits | "ความยาวหรือสัดส่วนนี้ไม่รองรับในโมเดลปัจจุบัน" |
| `400 VALIDATION_ERROR` | Invalid field(s); see `details[].field` | Field-level message |
| `409 JOB_NOT_SHAREABLE` | Share/download on a job that isn't `succeeded` or not yet in storage | "วิดีโอยังบันทึกไม่เสร็จ ลองใหม่อีกสักครู่" |

---

## Sharing

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/open/v1/jobs/:jobId/shares` | ✅ | Create or return the job's share link (201 new / 200 existing) |
| `DELETE` | `/open/v1/shares/:shareId` | ✅ | Revoke (204, no body); the link may keep working ≤ 60 s; re-sharing mints a new URL |
| `GET` | `/open/v1/jobs/:jobId/download` | ✅ | Signed URL that forces a save |
| `GET` | `/public/v1/shares/:token` | ❌ | Data for the public share page |

```typescript
// POST /jobs/:jobId/shares
{ shareId: string; jobId: string; url: string; viewCount: number; createdAt: string }
// GET /jobs/:jobId/download
{ url: string; filename: string; expiresAt: string | null }   // filename e.g. violet-studio-1a2b3c4d.mp4
// GET /public/v1/shares/:token  (omits prompt, owner, job ID)
{ mediaUrl: string; thumbnailUrl: string | null; downloadUrl: string; mediaType: "video" | "image";
  aspectRatio: AspectRatio; duration: number; expiresAt: string | null; createdAt: string }
```

- `url` is built by the backend from `PUBLIC_WEB_BASE_URL` and points at this app's `/s/:token`
  route — that env must be the real web origin. Tokens are 43-char base64url.
- Share/download return 404 for unknown jobs and `409 JOB_NOT_SHAREABLE` as above.

**Share sheet** (`src/components/dna/share-sheet.tsx`, shown on succeeded jobs): copy link,
LINE (`social-plugins.line.me/lineit/share?url=`), Facebook (`facebook.com/sharer/sharer.php?u=`),
download, revoke (confirmed), view count, and a "TikTok/Reels" badge for 9:16. File sharing
(`navigator.share({ files })`) is offered only where `navigator.canShare` accepts a video file;
the file is fetched when the sheet opens so the share call runs directly from the tap (iOS
Safari rejects it otherwise). If the `fetch()` of the signed URL fails (e.g. CORS), only file
sharing is hidden — **CORS against the real Supabase origin still needs a check in production**.

**Public page** `src/app/s/[token]/page.tsx` (no login; `/s` is outside the auth proxy matcher):
- Fetches `GET {API_URL}/public/v1/shares/:token` server-side through a `"use cache"` function
  (`cacheLife` 60 s) — the backend rate-limits per IP and every request comes from this server.
  Malformed tokens never reach the backend.
- `generateMetadata` emits `og:type=video.other`, `og:url`, title/description, `og:image`
  (thumbnail, or the permanent `/og-share.png` brand image when null), `og:video*` with size from
  `aspectRatio`, `twitter:card=summary_large_image`, and `robots: noindex, nofollow`.
- Unknown/revoked token → "ลิงก์นี้ไม่มีอยู่หรือถูกยกเลิกแล้ว". Crawlers (Facebook/LINE/Twitter/
  Slack bots, which receive blocking metadata) get **HTTP 404**; regular browsers see the same page
  with HTTP 200 because Cache Components streams the static shell before the lookup finishes.
- Absolute OG URLs use `PUBLIC_WEB_BASE_URL` (see `.env.example`), falling back to the Host header.

---

## Models

All model IDs currently run on **Seedance 1.0 Pro** (backend `ARK_DEFAULT_MODEL`). Requests outside
these limits return `422 MODEL_NOT_SUPPORTED`.

| UI label | `model` |
|---|---|
| EZ-Motion 2.0 | `violet-motion-2` |
| EZ-Cinema | `violet-cinema` |
| EZ-Fast | `violet-fast` |
| EZ-Realism | `violet-realism` |
| EZ-Classic | `violet-classic` |

| Limit | Value |
|---|---|
| Duration | 4–12 s |
| Aspect ratio | `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `21:9` |
| `image_image` (reference image) | not supported — hidden |
| Audio | none — audio tags hidden |

These live in `src/lib/model-capabilities.ts` and must be updated whenever `ARK_DEFAULT_MODEL`
changes. **Requested:** `GET /open/v1/models` returning per-model ratios, min/max duration and
audio/image support, so the UI can read limits instead of hardcoding them (the file is already
shaped like that response).

---

## VIOLET DNA scenes

### Characters per scene (max 3)

Scene responses (`GET /dna/scenes`, `GET /dna/scenes/:id`, create/update responses) include:

```typescript
characters: Array<{ id: string; name: string; sortOrder: number }>;  // always an array, sorted; [0] = lead
characterProfileId: string | null;   // deprecated — equals characters[0]
```

Requests (`POST /open/v1/dna/scenes`, `PUT /open/v1/dna/scenes/:id`):

```typescript
characterProfileIds?: string[];      // ordered, unique, max 3
```

- `PUT` with a list **replaces** all characters; `[]` clears them; omitting the field leaves them unchanged.
- Don't send the single `characterProfileId` in new code: the backend still accepts it during the
  transition, but on `PUT` it replaces the whole list with that one character.
- Errors: `400 VALIDATION_ERROR` with `details[].field === "characterProfileIds"` (more than 3,
  duplicates, not a UUID); `404 NOT_FOUND` when a character is deleted or not the user's → the
  form reloads the character list.
- Multiple characters are text-only for the current model (no reference images), so traits can
  swap between characters; the UI warns at 3 and suggests naming characters in the action text
  ("Elena ยื่นข้าวเหนียวให้ Somchai").

### Storyboard preview

`GET /dna/scenes` and `GET /dna/scenes/:id` include per scene:

```typescript
preview: {
  jobId: string;
  isSelected: boolean;        // false = latest succeeded clip, not the selected output
  thumbnailUrl: string | null;
  mediaUrl: string;
  mediaType: "video" | "image";
  expiresAt: string | null;   // signed 1 h
} | null;                     // nothing generated yet (or still generating)
```

Storyboard cards (`SceneCard` + `ScenePreviewMedia`) show `thumbnailUrl` as a lazy `<img>`, or an
early video frame when it is null; a muted looping `<video>` is mounted only for the hovered
(desktop) or tapped (touch) card. `preview === null` shows "ยังไม่มีวิดีโอ" + Generate.
`isSelected === false` shows "ล่าสุด (ยังไม่ได้เลือก)" and "ใช้คลิปนี้" (→ `select-output`, then
refetch). The list is refetched (silently, throttled to once per 30 s) on media `onError` and when
the tab regains focus after any `expiresAt`. No per-scene `GET /jobs/:id` calls.

### `POST /open/v1/dna/scenes/:id/generate`

Uses all of the scene's characters — the UI sends no characters. Send `characterProfileIds` only
to override the set for that one job (the scene is unchanged).

### `PUT /open/v1/dna/scenes/:id/select-output/:jobId`

Marks a succeeded job as the scene's output. Called once per job.

### `POST /open/v1/dna/scenes/:id/continue`

- `useLastFrame: true` uses the last frame of the previous scene's selected output as the first
  frame. Requires that the previous scene has a selected output whose job succeeded; otherwise the
  backend silently generates text-only. The UI sends `useLastFrame: false` and says so when there
  is no selected output.
- The new scene inherits **all** characters from the previous scene, in order. The UI re-fetches
  scenes after continuing.

---

## Storyboard Export

Merges the selected clips of 2–20 scenes, in order, into one MP4, with optional background
audio and burned-in text. Asynchronous: create → poll → download. Full baseline spec lives in
`ez-gen-api` (`storyboard-export-api-contract.md`, 2026-10-14).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/open/v1/uploads` | ✅ | Upload audio/image (multipart `file`) → `{ uploadId, mimeType, sizeBytes, expiresAt }` |
| `POST` | `/open/v1/exports` | ✅ | Queue a merge → `{ exportId, status: "queued", ... }` |
| `GET`  | `/open/v1/exports/:id` | ✅ | Poll `{ status: "queued"\|"processing"\|"succeeded"\|"failed", error, ... }` |
| `GET`  | `/open/v1/exports?page&limit` | ✅ | Paginated export history |
| `GET`  | `/open/v1/exports/:id/download` | ✅ | Signed URL (≈1 h) forcing `export-<id>.mp4` |

Implemented in `src/lib/api.ts` (`exportsApi`, `uploadsApi`), `src/hooks/use-export-polling.ts`
(poll ≥ 3 s, stop on `succeeded`/`failed`), and the quick-merge dialog
`src/components/dna/export-dialog.tsx`. A scene is eligible only when it has a selected,
succeeded job stored as video (`SceneDTO.selectedJobId` + `preview.mediaType === "video"`);
otherwise `POST /exports` returns `422 SCENE_HAS_NO_OUTPUT`.

### Baseline `POST /open/v1/exports` body

```typescript
{
  sceneIds: string[];                 // 2–20, presentation order, each with a selected succeeded clip
  audioUploadId?: string | null;      // an audio upload
  audioVolume?: number | null;        // gain; 1.0 == clip audio. default 1.0
  textLayers?: Array<{
    sceneId: string;                  // must be in sceneIds
    text: string;                     // 1–200 chars, shown the whole clip
    position?: "top" | "center" | "bottom";   // default bottom
    fontSize?: number;                // px, default 48
    color?: string;                   // hex without '#', default "FFFFFF"
  }> | null;
}
```

### Export error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Field validation (e.g. fewer than 2 scenes) |
| `INVALID_FILE_TYPE` | 400 | `audioUploadId` is not audio / upload is an unsupported type |
| `FILE_TOO_LARGE` | 413 | Upload over its limit (image 8 MB, audio 50 MB) |
| `SCENE_HAS_NO_OUTPUT` | 422 | A scene lacks a selected succeeded video |
| `EXPORT_NOT_READY` | 409 | Download requested before the export finished |
| `NOT_FOUND` | 404 | Export / scene / upload missing or owned by another user |

### Timeline editor extension — **implemented in backend**

> Status: **implemented** in `ez-gen-api`. The baseline body above keeps working; these fields are
> additive and all optional. The editor UI (`/studio/scenes/export`) sends this shape and also sends
> `sceneIds` plus a derived `position` so the request stays valid for the baseline path — `clips`
> wins when both are present. **Backend wins** — if units or field names drift, reconcile here.

Superset of the baseline `POST /open/v1/exports` body:

```typescript
{
  // `clips` supersedes `sceneIds`. If both are sent, `clips` wins. Each scene still appears
  // at most once (text layers bind to a clip by sceneId).
  clips?: Array<{
    sceneId: string;
    trimStart?: number;   // seconds from the clip start, default 0
    trimEnd?: number;     // seconds from the clip start, default = full duration; trimEnd > trimStart
  }>;

  sceneIds?: string[];    // legacy; omit when `clips` is present

  audioUploadId?: string | null;
  audioVolume?: number | null;

  textLayers?: Array<{
    sceneId: string;
    text: string;                         // 1–200 chars
    // Free placement; normalized 0..1 of the frame, anchor = text box centre.
    // When x/y are absent the backend falls back to `position` (baseline behaviour).
    x?: number;                           // 0 (left) … 1 (right)
    y?: number;                           // 0 (top)  … 1 (bottom)
    position?: "top" | "center" | "bottom";
    fontSize?: number;                    // px at 1080-height reference; backend scales to output
    color?: string;                       // hex without '#'
    align?: "left" | "center" | "right";  // default center
    // Timing, in seconds **relative to the clip's trimmed start**. Absent = the whole clip.
    startTime?: number;
    endTime?: number;
  }> | null;
}
```

Notes for the backend:
- Trim precision is seconds (float); snap to the nearest frame at the clip's fps. The UI never
  assumes a fixed fps — it reads each clip's real duration from the `<video>` metadata of
  `preview.mediaUrl`.
- `fontSize` is authored against a 1080-px-tall preview; scale it to the real output height.
- A clip's playable range in the timeline is `[trimStart, trimEnd]`; total export duration is the
  sum of trimmed clip lengths.

---

## Not yet verified against the backend

The following were in the original proposal and have not been reconciled with `ez-gen-api`:
authentication (the web app currently uses a mock httpOnly-cookie session), uploads, project
listing, and credit balance. Confirm them before building on them.


## Production workspace readiness corrections (2026-10-20)

The additive production contract in the sibling API repository,
`docs/engineering/video-production-api-contract.md`, governs projects, scene versions,
library references, capabilities and persisted editing/export. Current auth uses backend
`/open/v1/auth/login`, `/register` and `/me` with an httpOnly session cookie; the historical
mock-auth note above is superseded.

`PUT /dna/scenes/:id/select-output/:jobId` returns `{sceneId, selectedJobId}`,
not a full scene. The production client merges the selected job into its existing scene
so the selection indicator and assembly entry update immediately. Library URL imports
are consumed once per workspace; removing or replacing a reference must survive scene/tab
remounts and late asset responses.

## Product image category (PRODUCT-IMAGE-20261020)

`POST /image-jobs` accepts optional `category: "character" | "product"`, defaulting to
`character`. Both categories use the existing `visualStyle`, `mood`, `aspectRatio`,
optional uploaded `referenceImageId`, prompt and idempotency key. Product requests
omit `designFormat` entirely; a character format on a product request is invalid.
Product generation is a single product packshot, not a character design sheet.
The category and all options are part of the immutable pending request snapshot;
ambiguous retries retain the original key and payload across reloads.

Image JobDTO adds optional `imageCategory` (missing legacy value means character),
`productDesign: {visualStyle?, mood?}` for product jobs, and `characterDesign` only
for character jobs. Result labels and asset saving follow the completed job category,
not the current composer toggle. Product images are saved as existing asset type
`prop`; character images use `character`. Asset prompt/provenance is validated and
owned by the backend; UI description uses the job's raw prompt with a bounded
legacy fallback rather than provider-compiled instructions.

`GET /assets?type=prop` lists products/props. The library category toggle resets
search/page, product empty-state creation links use `/studio?category=product`,
and product cards do not expose a video creation action. Production reference
pickers remain character-only. Existing browser requests still use the Next proxy.

Image capabilities optionally advertise `categories: ["character", "product"]`.
A missing field is a legacy character-only backend. Guest product drafts remain
available, but authenticated product submission and immutable product retries require
explicit product advertisement; otherwise the UI shows โหมดสร้างสินค้ายังไม่พร้อมใช้งาน
and sends no product request. This avoids interpreting an ignored category as a billed
character request during an older-backend rollout. Capability availability is not proof
that a provider account is activated.

## Polling and reference intent (POLLING-BACKGROUND-20261020)

No request/response schema or mode values change. The existing scene description
carries environment/background instructions. `image_image` requests appearance reference;
`image_video` uses the whole first frame and may retain its background. Existing saved
or draft mode intent is preserved; the UI does not silently convert first-frame scenes.
Backend prompt guidance does not imply segmentation or guaranteed identity fidelity.

Frontend polling is GET-only, serialized after completion, paused when hidden and stopped
for terminal/empty data. Selected, known pending and previously active off-page scene jobs
are fetched directly so fresh status/media replaces stale state. Manual/focus/visible
refresh remains available, with bounded one-shot signed URL expiry/error refresh.
Unknown generation POST outcomes are retried only explicitly with the original snapshot
and idempotency key; polling cannot create generation POSTs. AbortSignal support added
to frontend GET clients is a client lifecycle detail, not an API contract field.


## Synthetic character reference with image-to-image (2026-10-22)

`GET /image-capabilities` exposes `supportsCharacterReferenceImage: boolean`,
`characterReferenceMode: "image_to_image"`, and
`characterReferenceUnavailableReason: string | null`. Character reference support
requires an enabled image model. `supportsReferenceImage` continues to describe
product references. Missing/false character support, a disabled image model or an
unrecognized/legacy `text_description` mode disables new character reference
requests in the browser; text-only generation remains available after removing a
restored reference.

`POST /image-jobs` retains its existing request shape including `referenceImageId`.
For character references the backend sends the reference image directly to the
image generator with a prompt to create a synthetic character preserving the
original outline and visual features as closely as possible, applying requested
changes. Product references retain their existing behavior. Exact likeness and
video moderation acceptance are not guaranteed. Unavailable character reference
support returns definitive `503 CHARACTER_REFERENCE_UNAVAILABLE` before creating
a new job. Unresolved idempotent retries retain their original body/key even if
capabilities change.


## Studio one-click pipeline (2026-10-22)

Authoritative contract: `ez-gen-api/docs/engineering/studio-pipeline-api-contract.md` in sibling repository. Browser uses Next `/api/proxy` for all calls. POST `studio-pipelines` submits referenceImageId, characterPrompt, scenePrompt, optional dialogue, visualStyle, aspectRatio, durationSeconds, modelId, quality and immutable UUID idempotencyKey. Defaults: cinematic_realistic / 9:16 / 5 / violet-motion-2 / standard. GET list (items,total,page,limit), GET by id and POST `:id/retry` with `{}` observe/resume backend-owned work; browser never creates child image/video jobs. GET `studio-pipeline-capabilities` provides enabled, supportsDialogue, unavailableReason, aspectRatios and durations. Pipeline status is queued/processing/succeeded/failed/needs_attention; stage image/save_character/video/save_video/done. canRetry alone authorizes resume. Asset IDs and signed media URLs with nullable expiry are independently nullable; persisted IDs govern library links. Submission uncertainty retains identical payload/key; status-fetch failure never becomes generation failure. Library supports type=video through existing assets endpoint. Native dialogue text is passed unchanged; no exact speech or lip-sync guarantee.


### Character sources (2026-10-26)

POST `studio-pipelines`: optional UUID `referenceImageId` (upload) or
`characterAssetId` (Library), mutually exclusive. Neither means text-to-image.
`characterPrompt` is required for upload/text; Library sends an empty string and
uses the selected generated character without generating a replacement.
`scenePrompt` remains required in all modes. Existing immutable request/key replay
also applies to text and Library, including after reload. DTO adds `sourceMode`
(`upload` / `text` / `library`); legacy DTOs without it retain upload display.
Capabilities add `textEnabled`, `libraryEnabled`, `libraryAspectRatios`,
`libraryDurations`; `enabled`/`aspectRatios`/`durations` retain upload semantics.
Library starts at video and only requires video capability.

Picker calls existing `GET assets?type=character&limit=20&page=N&search=` via
Next proxy. It offers generated `status=ready`, non-null jobId, null uploadId
assets. This is an advisory UI filter: backend authoritatively validates owned,
nondeleted generated character image, succeeded character job, matching durable
output and no upload linkage. Invalid provenance returns 409
`ASSET_SOURCE_NOT_READY`; missing/other-owner asset returns 404. A Library choice
is mandatory in Library mode; an empty selection never becomes text-to-image.
No new browser-to-backend transport or provider call is introduced.

### Pipeline validation feedback (2026-10-26)

A pipeline `400 VALIDATION_ERROR` may include `details:[{field,reason,message}]`.
Allowlisted fields: referenceImageId, characterAssetId, idempotencyKey,
characterPrompt, scenePrompt, dialogue, visualStyle. Reasons: invalid_uuid,
conflicting_sources, required, too_long, dialogue_encoding_budget, prompt_budget,
invalid_option, invalid_image. Combined compiled scene/dialogue budget failure
uses scenePrompt/prompt_budget; JSON-quoted dialogue budget uses
dialogue/dialogue_encoding_budget. Browser validates known field/reason pairs and
bounded detail shape, then displays fixed Thai copy rather than raw server text.
Malformed or unknown details retain generic 4xx feedback. 401/429 policies are
unchanged; all 4xx clear pending, while unknown/5xx keeps the original payload/key
for immutable retry. Client does not guess provider budgets or truncate text.

## Story Flow (isolated addition)

Browser calls use `/api/proxy/story-flow/*` through the existing authenticated
proxy. Backend-authoritative contract: `../../ez-gen-api/docs/engineering/story-flow-api-contract.md`.
Typed client: `src/lib/story-flow-api.ts`; entry `/studio/story-flow` and project
workspace `/studio/story-flow/[id]`. This domain does not write existing production
projects, scenes, generation jobs, pipeline submissions or exports. Source inputs
are immutable after creation; create a new Story Flow project to change them.
Capabilities supply models, aspect ratios, qualities and scene/shot limits.
Unknown POST outcomes retain the exact request and idempotency key across reload;
explicit retry replays that request. Progress uses durable completed shot counts.
Images/clips and final output are shown only for the current server project revision.
Browser fixture coverage in `tests/story-flow.browser.mjs` uses no paid generation.

## Video editor phase 1

The authoritative [video editor API contract](../../../ez-gen-api/docs/engineering/video-editor-api-contract.md) defines the independent `/open/v1/video-editor` domain. Browser access is only through `/api/proxy/video-editor` with the existing httpOnly session and same-origin mutation checks.

The editor uses persisted project/media IDs. Timeline segments have unique IDs and may reference the same uploaded asset repeatedly. Saves carry a revision and never silently overwrite a `REVISION_CONFLICT`; local recovery JSON can be downloaded before loading the latest server draft. Import supports MP4/MOV/WebM up to 50 MiB/file, with actual XHR byte progress followed by server processing. Upload retries retain the original `clientUploadId` and File; ambiguous responses reconcile against the owned media list. Sources/thumbnails are server-owned signed URLs refreshed through the assets endpoint, never persisted URL values in the saved draft.

Save and export enforce 20 segments and 1200 seconds total. Export saves the current draft first, then submits a stable request ID with revision and resolution (720p/1080p). Ambiguous export submissions reuse their original request/payload. Existing jobs are reloaded on reopening the project and polled while queued/processing; retry preserves the job's snapshot. Download requests a fresh signed URL. Project selection is represented by `?project=<UUID>`; pending edits/imports are protected before switching or unloading. AI planning remains unavailable in phase 1.

Client/types: `src/lib/video-editor-api.ts`; editor persistence and async state: `src/components/ai-editor/use-editor-project.ts`. The generic proxy adds a bounded 55 MiB multipart transport only for video-editor asset uploads and a 145-second upstream timeout for that path. Existing generation routes retain their prior behavior.

## Video editor phase 2

AI planning extends `/open/v1/video-editor`, through the same authenticated Next proxy. The authoritative [AI editor contract](../../../ez-gen-api/docs/engineering/video-editor-ai-api-contract.md) and workspace task record define the job state machine. Client/types: `src/lib/video-editor-ai-api.ts`; state and review UI: `src/components/ai-editor/use-editor-ai.ts` and `ai-assistant-panel.tsx`.

The user selects at most eight ready owned assets (600 seconds of source), supplies a brief and target duration, and explicitly consents to sampled images/transcribed text being processed externally. `ai-capabilities` supplies availability, limits, provider notice and supported options. Missing provider configuration disables new analysis; it does not disable the manual editor or existing draft review/apply. Test provider mode is visibly marked only when the server explicitly returns `connectionMode: fixture`. No music, subtitle, filler or shake-detection output is fabricated.

Analysis saves the current local timeline first, then creates a revision-bound job. Source transcription/visual summaries and concepts are durable server data. The 2–3 concepts are independent, single-select alternatives; each aims at the requested target duration rather than dividing that target among concepts. Generated draft duration is the sum of selected source windows. Shorter output is accepted without a minimum target percentage, including legacy revision-1 review drafts without a manual save. Generated plans remain nonempty, select unique valid evidence IDs within source bounds, use at most 20 segments, and cannot exceed the requested target plus 0.05 seconds or the 1200-second limit. Preflight does not reject solely because usable footage is shorter than the target. Historical `AI_INSUFFICIENT_EVIDENCE` and `AI_DURATION_MISMATCH` failures permit an explicit user retry under the existing budget, attempt and availability limits; retries and regeneration never run automatically. Exact target duration is not guaranteed. A selected concept produces a separate draft: no generated plan changes the live timeline before human approval. Draft trim, order or volume edits clear approvals and must be saved with `draftRevision` before all scene IDs can be approved and applied. Apply carries project and draft revisions; local dirty edits or a newer server project are never overwritten by an asynchronous response. An older exact apply replay is reconciled against the latest owned project rather than rolling the UI back. One Undo step restores the prior timeline after an accepted new plan.

When `ai-capabilities.autoCompose === true`, new requests default to `autoCompose: true` (optional on the wire; omitted is legacy false). The server selects its recommended concept and queues planning without a concept-selection step. `AiJob.autoCompose` distinguishes this path from historical/manual jobs. Brief + selected footage + existing cloud consent are sufficient; duration/style/original-audio controls remain under advanced settings. Auto review offers one complete playable preview followed by one “ใช้ฉบับตัดต่อนี้” action. That action sends all current scene IDs in the revision-guarded apply request synchronously; it does not bypass stale/local-dirty protections.

Drafts may add `textLayers?: EditorTextLayer[]`, `audioClips?: EditorAudioClip[]`, and `compositionNotes?: string[]`; omitted arrays mean empty, including auto drafts with no supplemental audio. Audio/text layers may contain `originJobId?: UUID`. Normalization, save, history and reload preserve that ownership marker. Preview and apply preserve unowned manual tracks and replace AI-owned tracks. Generated captions come from contained speech evidence; a music bed uses only an existing supplied project audio asset and is skipped when manual audio already exists. No voiceover or music generation is claimed. A draft edit hides the complete preview until saving returns authoritative, recomputed composition. Preview playback never saves or replaces the manual timeline.

Pending create/select/apply/retry bodies retain their original identities in owner/project-scoped `sessionStorage` keys prefixed `violet-editor-ai-request:`. Recovery is validated through the authenticated owner and owned job endpoints before rendering a restored job; logout clears these keys. No API keys, source storage keys, signed URLs, raw audio or transcripts are stored there. Draft edits can be recovered across reload and downloaded separately as JSON. Polling is scoped to project/job lifetime with an in-flight guard; list updates do not abort other refreshes. Cancellation and quota failures remain explicit user-visible states, with no automatic model/provider fallback or automatic billable retry.

Browser acceptance uses real Next/Go/PostgreSQL/storage/FFmpeg and explicitly injected local providers; such fixtures verify the application flow, not live Gemini quality. Live-provider testing requires secure server configuration and is reported separately.

AI editor existing-job status polling reads the owned job directly without schema introspection or ASR/provider readiness checks. Explicitly disabled AI and a missing AI job table return `503 AI_UNAVAILABLE`. Other database status-read failures return `503 AI_STATUS_UNAVAILABLE` with `อ่านสถานะงานไม่ได้ชั่วคราว กรุณาลองใหม่`; this temporary polling failure is separate from the job's persisted `failureCode`. Worker claim-observation errors retry within the bounded work deadline rather than being treated as confirmed cancellation.

Transcript refinement is additive inside each transcript: optional `refinement: {text,segments:[{segmentIndex,text,uncertain}]}`. Absent/null means raw/legacy, never implied refinement. Original `text`, `segments`, word tokens and timestamps remain unchanged. Stage remains `transcribing` while raw transcripts exist and refinement is pending (the UI derives “กำลังเรียบเรียงบทพูด” from this state); refined transcripts are persisted and displayed openly before visual/concept completion. Source text is conservatively interpreted without inventing speech; uncertain segments retain the raw segment text and are marked for review. Concepts and planning use refined source context with original evidence boundaries. The UI labels the AI version, keeps raw ASR in a keyboard-accessible disclosure, and states that original audio is unchanged. Refinement uses one additional budgeted cloud call for uncached speech; silent sources need none. The client rejects malformed or incomplete segment mappings.

### AI editor duration notices (2026-10-29)

The AI editor retains the immutable requested duration in `job.targetDuration`. Each concept's existing `duration` is an estimate and each draft's `duration` is its actual total. Both optionally include `durationReason?: string` (at most 2,000 characters), explaining a result below 95% of the requested target. Missing fields remain valid for historical jobs; the UI states that no detailed reason was supplied rather than inventing one. These notices never disable selecting a concept, reviewing, approving or applying a shorter draft. Existing ownership/revision/approval guards still apply. Locally changed draft segments use their recalculated total and suppress the old server reason until the saved draft supplies a current one. Backend details: `ez-gen-api/docs/engineering/video-editor-ai-api-contract.md`.

### Video editor audio and text tracks (2026-11-02)

Authoritative decision: workspace task `docs/engineering/tasks/ai-editor-audio-text-20261102.md` ("Contract decision"), extending the backend video editor contract.

- `Asset.kind: "video" | "audio"` (missing ⇒ `video`). Audio uses the same multipart upload route: MP3, WAV, M4A/AAC, ≤50 MiB, ≤1,200 s; `width=height=0`, `frames=[]`, signed `previewUrl`. Video `segments` and AI job asset selection use video assets only; the editor lists audio only in the เสียง tab.
- `Project.audioClips: {id,assetId,at,start,end,volume}[]` — UUID ids, owned ready audio asset, timeline `at ≥ 0`, `0 ≤ start < end ≤ sourceDuration`, `volume` 0..1, `at + (end-start) ≤ 1200`, max 20.
- `Project.textLayers: {id,text,start,end,x,y,fontSize,color,align,scaleX?,scaleY?}[]` — UUID ids, timeline `0 ≤ start < end ≤ 1200`, trimmed non-blank text ≤500 Unicode chars and ≤6 lines, `x,y` 0..1, `fontSize` 12..200 px at a 1080-height reference, `color` `#RRGGBB`, `align` `left|center|right`, max 50. Anchor: `x,y` are the box centre for every alignment; `align` only aligns lines inside the box. Optional finite `scaleX,scaleY` default to 1 and accept 0.1..5; they stretch the text width/height independently around that centre, with the resulting box clamped inside the frame (top/left wins for oversized text). Preview scales font by frame height / 1080 and does not auto-wrap. Stage dragging moves the layer, side/corner handles resize it, arrows move it and Shift+arrows resize it; one pointer gesture is one undo entry. `capabilities.textTransforms === true` enables width/height resizing; an older backend that omits it keeps position dragging but disables resize controls to avoid silently losing transforms on save.
- Both arrays are always present in newer responses; the web normalises missing/malformed values to `[]`. `PUT /projects/:id` sends `audioClips`/`textLayers` only when `capabilities.maxAudioClips`/`maxTextLayers` exist (older backends never receive unknown fields; audio upload/text save are then disabled with a notice). Omitted = keep stored value; present = replace.
- `GET /capabilities` adds `maxAudioClips`, `maxTextLayers`, `textOverlays: boolean`, `audioFormats`. When `textOverlays === false` the editor still edits/saves text but disables export while text layers exist (the server would return `503 MEDIA_UNAVAILABLE`).
- Output duration = sum of video segments. Preview and export cut audio past the end; text layers starting at/after the end are dropped.
- "สร้างซับจากบทพูด" maps the latest AI job transcripts client-side (`src/components/ai-editor/subtitles.ts`): refined segment text unless `uncertain`, intersected with every video segment of that asset (`at + (t - start)`), wrapped to ≤2 lines per layer, capped by `maxTextLayers`. Generated subtitle ids are valid UUIDs carrying a fixed node marker so regenerating replaces only previously generated subtitles after confirmation.

Client: `src/lib/video-editor-api.ts`, `src/components/ai-editor/{tracks.ts,subtitles.ts,use-audio-preview.ts,track-panels.tsx}`; tests `tests/audio-text-tracks.test.mjs`.


### Studio Draft and Final refinement (2026-11-02)

`POST studio-pipelines` accepts optional boolean `draft` (default false). Eligibility follows the actual resolved model from `studio-pipeline-capabilities.models[]`, including account overrides. Each entry supplies `id`, truthful Seedance version/variant `label`, `supportsDraft` and model-specific existing source/output/audio capabilities. The top-level capabilities remain for older clients.

Pipeline responses add `isDraft`, `modelId`, `modelLabel`, `aspectRatio`, `durationSeconds`, `quality`, `canCreateFinal`, nullable `sourceDraftId`, `draftExpiresAt` and `finalUnavailableReason`. Draft means provider preview 480p; a linked final is provider refinement 1080p. Ordinary standard video is not labelled 1080p. The result and history preserve mode labels across reload.

`POST studio-pipelines/:id/finalize` accepts only `{idempotencyKey: UUID}` and returns a new pipeline with `sourceDraftId` and `isDraft:false`; the original draft stays intact. The backend verifies owner, completed draft, retention, original pinned provider model and provenance. It looks up the provider draft ID internally. Final refinement reuses original content/settings and is separately charged. `409 DRAFT_EXPIRED` is actionable: create a new video. New draft retention is 14 days (older provider drafts 7 days); the UI uses backend eligibility/expiry.

The browser keeps uncertain final source ID and idempotency key in `sessionStorage` (`violet-pipeline-final-submission`) and replays only the exact final request after network/5xx uncertainty or reload. While unresolved, source/settings/new generation are locked. HTTP4xx releases pending state and displays fixed Thai recovery text, never provider diagnostics. Browser calls remain behind `/api/proxy`; no provider task IDs or credentials are stored.


### Pipeline create validation feedback (2026-11-02 follow-up)

Malformed JSON and request schema validation errors return HTTP400 `VALIDATION_ERROR` with at most eight `{field,reason,message}` details. Canonical create-request fields use `invalid_uuid`/`required`/`invalid_type` for UUIDs; `required`/`too_long`/`invalid_type` for text; `invalid_option`/`invalid_type` for enums; `out_of_range`/`invalid_type` for `durationSeconds`; and `invalid_type` for `draft`. The fallback pair is `body`/`malformed_json`. Existing facade-specific validation pairs and HTTP422 behavior remain unchanged.

The client accepts only recognized field/reason pairs and renders locally generated Thai feedback naming the affected field. It never displays submitted values, parser diagnostics, raw backend messages or provider text. Invalid/oversized detail arrays fall back to the existing generic recovery path. The request payload, 4xx pending-state release and uncertain network/5xx immutable replay remain unchanged. This fixes an observable feedback gap; the cause of any particular rejected user payload still requires its sanitized field values and types.


### Studio Library character UUID compatibility (2026-11-02)

Pass Library `Asset.id` unchanged as `characterAssetId`. This field accepts a
canonical UUID of any version, including UUIDv5 generated deterministically by
the pipeline's asset-saving step; it is not restricted to UUIDv4. UUIDv4/v7
character IDs are also syntactically accepted. Missing/foreign/nil UUID assets
still return 404 `NOT_FOUND` after owner/provenance lookup. Malformed or
noncanonical UUID strings return 400 `VALIDATION_ERROR` with
`characterAssetId/invalid_uuid`. Upload `referenceImageId` and create/finalize
`idempotencyKey` continue to require UUIDv4. No client payload transformation or
asset regeneration is needed.


### Thai dialogue duration advisory (2026-11-02)

Studio may show a nonblocking, explicitly approximate advisory when Thai dialogue appears much denser than the selected video duration and the selected resolved model supports native dialogue. It neither changes the request nor disables generation, and it never truncates, translates or rewrites speech. Changing duration/text or clearing dialogue recomputes the hint; an unresolved original submission uses its immutable dialogue and duration.

The engineering heuristic counts Thai letter-bearing grapheme clusters via `Intl.Segmenter` (combining tone/vowel marks do not add units), plus Latin word tokens only for mixed Thai text. Weights are eight Thai grapheme units/second and 2.5 Latin words/second, with a one-second excess margin before warning. These are deliberately rough, tunable engineering weights, not measured Thai speech rates, phonetic syllable counts, a provider limit or an exact duration prediction. English-only input keeps its prior behavior. Actual voice pace, pauses and synthesis vary; the UI labels this limitation and offers increasing duration or shortening dialogue as optional guidance.


### Studio terminal provider failure copy (2026-11-02)

A `failed` pipeline with `failureCode:PROVIDER_OUTPUT_REJECTED` displays a fixed Thai explanation that the provider rejected the generated video in its content-policy check, with optional guidance to adjust the description/reference and create a new request. It does not infer a specific copyright, identity or legal violation. `PROVIDER_GENERATION_FAILED` identifies confirmed terminal generation failure separately. These failures do not offer retry when `canRetry:false`; no automatic generation request is sent.

`needs_attention` keeps uncertainty wording and advises checking the existing job and usage before manually creating another request. Unknown failure codes use fixed generic copy. The existing saved-character context remains. Studio never renders `failureMessage` or arbitrary provider diagnostics, signed URLs, or submitted tokens as failure copy.


### Studio writing space (2026-11-02)

Scene and dialogue textareas use the full available form width, larger initial heights and native vertical resizing. The existing desktop two-column layout, preview and mobile order remain unchanged. There is no writing-space toggle. Input resizing does not modify or resubmit pending requests.

Counters and help identify 2,000 scene characters and1,000 dialogue characters as the configured Studio limits. These are application guards, not a statement of a provider hard limit; scene/dialogue are also subject to the existing compiled request budget. No provider/API/prompt-budget limits change and no combined remaining counter is invented.

### Video editor clip effects (2026-11-03)

Capability `clipEffects: true` (absent on older backends) gates every field below; the web client sends none of them otherwise.

- `Segment.speed?: number` — 0.25..4; absent or 1 = normal. A segment lasts `(end-start)/speed` timeline seconds, and the 1,200 s ceiling counts timeline seconds. Export: `setpts=(PTS-STARTPTS)/speed` and pitch-preserving `atempo` stages, each within 0.5–2.
- `Segment.fadeIn?/fadeOut?: number` — timeline seconds, each 0..10, `fadeIn+fadeOut ≤` segment timeline length. Export fades picture from/to black (`fade`) and the segment's own audio (`afade`); text layers stay visible because they are drawn after the concat.
- `AudioClip.fadeIn?/fadeOut?: number` — seconds of source span, same limits against `end-start`. A clip cut at the video end keeps its fade-in and shrinks its fade-out to fit the remaining part.
- Detached audio: `AudioClip.assetId` may name a ready **video** asset with `hasAudio: true`; the web client mutes the source segment (`volume: 0`) when detaching and allows it only at speed 1.
- Defaults are omitted from stored JSON (`omitempty`), so older projects and readers are unchanged. No migration: segments and audio clips are JSONB.
- Snap while dragging and trimming is client-only (0, playhead, video cuts, other audio/text edges; 8 px reach).

### Video editor looks, transitions, text styles and image layers (2026-11-03)

- Capability `clipStyles: true` gates segment looks, transitions and text styles; the web client never sends them otherwise (older servers would drop them silently).
- Segment look (all optional, flat on the segment): `brightness`/`contrast`/`saturation` −1..1 → FFmpeg `eq` brightness·0.3, contrast 1+c/2, saturation 1+s (−1 = greyscale); `fit: "cover"` fills by cropping (default letterbox); `zoom` 1..3; `panX`/`panY` −1..1 pick the visible part (−1 = left/top). Preview uses an SVG filter with the same formula and the same scale→pad→crop geometry.
- Segment `transition` (`fade`, `fadeblack`, `fadewhite`, `wipeleft`, `wiperight`, `slideleft`, `slideright`, `circleopen`) with `transitionDuration` 0.1..2 s, at most half of this and the previous segment; never on the first. The segment starts that much earlier, so the total is Σ(timeline lengths) − Σ(transitions). Export: `xfade` + `acrossfade` (tri), `concat` where a clip has none; with no transitions the legacy single `concat` is unchanged.
- Text style: `outlineWidth` 0..20 px@1080 with `outlineColor`; `boxOpacity` 0..1 with `boxColor` (box padding = round(0.3·font px) + outline); `animation` `fade` | `slide` (0.3 s or a third of short layers; slide rises 4% of the height). Style is painted outside the measured text box, so clamping is unchanged.
- Image layers (capability `imageLayers: true`, requires **migration 028**): assets of kind `image` (PNG/JPEG/WebP stills ≤ 4096 px, decoded on upload); `Project.imageLayers: {id, assetId, start, end, x, y, width, opacity}[]` max 20 — centre x/y 0..1, width 0.02..1 of the frame width, opacity 0.05..1. Overlaid under text; clipped to the video like text.
- Ripple delete (client only): deleting a video clip shifts later audio/text/image items left by the amount the video got shorter.

### Director API handoff (2026-11-04)

Backend authority: [Director v1 contract](../../../ez-gen-api/docs/engineering/director-api-contract.md).
The API domain is `/open/v1/director`; browser calls use
`/api/proxy/director/*`. The follow-up Web integration task replaces the
localStorage prototype in `src/components/director/*` with typed server data.
Model IDs, choices, limits and prices come from capabilities and project estimates;
legacy browser-only demo projects are not migrated into server projects.

The shared proxy supports PATCH, `If-None-Match` forwarding, response
`ETag`/`Retry-After` forwarding and DELETE bodies (cover/shot deletes may also use
`?revision=`). It keeps 204/304 responses bodyless and preserves authentication,
same-origin mutation checks and upload size/type guards.
When an image URL expires or fails to load, omit `If-None-Match` on the refresh
GET so a 200 response supplies new signed URLs. The project ETag tracks stored
data and can stay unchanged after URL expiration; a conditional refresh can
therefore return 304 without repairing the expired URL.

Project user edits are serialized with the latest revision; worker progress does
not increment it. Navigation-only step changes do not increment revision.
AI requests retain immutable UUID-keyed payloads in sessionStorage until a
definitive response. An ambiguous disconnect must replay that exact payload,
including its original revision, rather than generate a new key. Logout clears
Director submissions along with other studio submissions.

Deployment requires migration029 and configured model/storage services; the six
static style samples are optional (blank `sampleImageUrl` shows a placeholder).
Director point accounts start at zero; no browser mock balance or payment/top-up
endpoint is provided by this integration. Shot video uses
`POST /projects/:id/video` (`shotIds?`), gated by `capabilities.videoEnabled`;
each shot exposes `video: null | {status, progress, url, stale, …}` and the
video models are Seedance 2.0 Fast / 2.5 / 2.0 (`aspectRatios` per model) and story/image
model names show the configured model (e.g. Gemini 3.5 Flash, Seedream 5.0). Verification status and fixture boundaries are
recorded in the workspace task `docs/engineering/tasks/director-web-20261104.md`.
