# API Contract — ez-gen-web ↔ ez-gen-api

> Updated: 2026-10-12 (synced to `ez-gen-api` `main`)
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

## Not yet verified against the backend

The following were in the original proposal and have not been reconciled with `ez-gen-api`:
authentication (the web app currently uses a mock httpOnly-cookie session), uploads, project
listing, and credit balance. Confirm them before building on them.
