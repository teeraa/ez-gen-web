# API Contract — ez-gen-web ↔ ez-gen-api

> Updated: 2026-10-13 (synced to `ez-gen-api` `main` @ f6a0246)
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

### Timeline editor extension — **PROPOSED, not yet in backend**

> Status: **proposed by frontend**, awaiting `ez-gen-api`. The baseline body above keeps working;
> these fields are additive and all optional, so an old backend can ignore them and still produce
> a (non-trimmed, 3-position) merge. The editor UI (`/studio/scenes/export`) sends this shape; until
> the backend honours it, trims and free text placement will not appear in the rendered MP4.
> **Backend wins** — reconcile units (seconds vs frames) and field names before relying on it.

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
