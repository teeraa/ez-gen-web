# API Contract — Agent E Deliverable

> Date: 2026-10-12  
> Status: **Proposed** — not verified against `ez-gen-api` backend  
> Backend: Go Fiber (`ez-gen-api`)  
> Provider: BytePlus ModelArk (accessed only from the Go backend)

All endpoints below are proposals. They must be verified and reconciled with the
actual `ez-gen-api` implementation before any frontend code is written against them.

---

## Design Principles

1. The frontend never calls BytePlus directly.
2. All job identifiers are application-level UUIDs, not BytePlus task IDs.
3. API responses are normalized — no BytePlus-specific fields reach the browser.
4. Errors always include a machine-readable `code` and a human-readable `message`.
5. Every mutable operation is idempotent where possible.
6. All timestamps are ISO 8601 UTC strings.

---

## Base URL

| Environment | Value |
|---|---|
| Local backend | `http://localhost:8080` |
| Production | `https://api.violetstudio.app` (TBD) |

The Next.js server reads `API_URL` from the environment. The browser never sees this URL.

---

## Authentication

> **Note:** The authentication mechanism has not been specified by the backend team.
> The contract below assumes JWT bearer tokens issued by the backend.
> Replace with the actual scheme once confirmed.

All authenticated endpoints require:
```
Authorization: Bearer <jwt-token>
```

Unauthenticated requests return:
```json
{ "code": "UNAUTHORIZED", "message": "Valid authentication required" }
```
HTTP 401.

---

## Endpoints

### 1. Create Generation Job

```
POST /v1/jobs
```

**Purpose:** Submit a new AI video generation request.

**Request body:**
```typescript
{
  prompt: string;          // 1–2000 characters
  mode: "text" | "image-video" | "image-image";
  model: "violet-motion-2" | "violet-cinema" | "violet-fast" | "violet-realism";
  aspectRatio: "16:9" | "9:16" | "1:1";
  duration: 5 | 10;        // seconds
  quality: "standard" | "high";
  enhancePrompt: boolean;
  referenceImageId?: string; // returned by POST /v1/uploads (required for image modes)
}
```

**Success response — HTTP 201:**
```typescript
{
  jobId: string;            // UUID — use this for all subsequent calls
  status: "queued";
  estimatedCredits: number;
  createdAt: string;        // ISO 8601
}
```

**Error responses:**
| HTTP | code | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid field(s); `details` array names each violation |
| 402 | `INSUFFICIENT_CREDITS` | Not enough credits |
| 422 | `IMAGE_REQUIRED` | Mode requires a reference image |
| 429 | `RATE_LIMITED` | Too many concurrent jobs |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

### 2. Get Job Status

```
GET /v1/jobs/:jobId
```

**Purpose:** Poll job progress. Call every 2 seconds until terminal state.

**Success response — HTTP 200:**
```typescript
{
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;              // 0–100 (UI progress bar)
  currentStep?: string;          // Human-readable current step label
  model: string;
  aspectRatio: string;
  duration: number;
  quality: string;
  creditsCharged?: number;       // Set on completion
  result?: {
    thumbnailUrl: string;        // Signed URL, short-lived (prefer using mediaUrl)
    mediaUrl: string;            // Signed URL for the generated video/image
    mediaType: "video" | "image";
    expiresAt: string;           // ISO 8601 — client should re-fetch if expired
  };
  error?: {
    code: string;
    message: string;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

**Polling rules (frontend):**
- Poll every 2 seconds while `status` is `queued` or `processing`.
- Stop polling on `completed`, `failed`, or `cancelled`.
- Back off to 5 seconds after 30 consecutive polls with no status change.
- Display `currentStep` in the generate button label during polling.

---

### 3. Cancel Job

```
DELETE /v1/jobs/:jobId
```

**Purpose:** Cancel a queued or processing job.

**Success response — HTTP 200:**
```typescript
{ jobId: string; status: "cancelled" }
```

**Error responses:**
| HTTP | code | Cause |
|---|---|---|
| 404 | `JOB_NOT_FOUND` | Job does not exist or belongs to another user |
| 409 | `JOB_NOT_CANCELLABLE` | Job already completed or failed |

---

### 4. Upload Reference Image

```
POST /v1/uploads
Content-Type: multipart/form-data
```

**Purpose:** Upload a reference image before submitting a generation job.

**Form fields:**
```
file: <binary>    (PNG, JPG, or WEBP, max 8 MB)
```

**Success response — HTTP 201:**
```typescript
{
  uploadId: string;          // Pass as referenceImageId in POST /v1/jobs
  filename: string;
  sizeBytes: number;
  mimeType: string;
  expiresAt: string;         // ISO 8601 — upload is temporary
}
```

**Error responses:**
| HTTP | code | Cause |
|---|---|---|
| 400 | `INVALID_FILE_TYPE` | Only PNG/JPG/WEBP accepted |
| 413 | `FILE_TOO_LARGE` | Exceeds 8 MB limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type mismatch |

---

### 5. List Projects

```
GET /v1/projects?page=1&limit=20&status=completed
```

**Purpose:** Fetch the user's project history.

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Pagination page |
| `limit` | number | 20 | Items per page (max 50) |
| `status` | string | all | Filter: `completed`, `processing`, `draft` |
| `q` | string | — | Full-text search on project title/prompt |

**Success response — HTTP 200:**
```typescript
{
  items: Array<{
    projectId: string;
    title: string;
    status: "completed" | "processing" | "draft" | "failed";
    thumbnailUrl?: string;
    prompt: string;
    model: string;
    duration: number;
    aspectRatio: string;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
}
```

---

### 6. Get Project

```
GET /v1/projects/:projectId
```

**Purpose:** Full project detail including media URL.

**Success response — HTTP 200:**
```typescript
{
  projectId: string;
  title: string;
  status: "completed" | "processing" | "draft" | "failed";
  jobId: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  duration: number;
  quality: string;
  creditsCharged?: number;
  thumbnailUrl?: string;
  mediaUrl?: string;         // Signed, short-lived
  mediaType?: "video" | "image";
  mediaExpiresAt?: string;
  referenceImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 7. Delete Project

```
DELETE /v1/projects/:projectId
```

**Purpose:** Remove a project from the user's history.

**Success response — HTTP 204 (no body)**

---

### 8. Get Credit Balance

```
GET /v1/credits
```

**Success response — HTTP 200:**
```typescript
{
  used: number;
  total: number;
  remaining: number;
  resetsAt: string;         // ISO 8601 — billing cycle reset
  plan: "free" | "creator" | "studio-pro";
}
```

---

## Error Response Shape

All error responses share this envelope:

```typescript
{
  code: string;           // Machine-readable constant (e.g., "INSUFFICIENT_CREDITS")
  message: string;        // Human-readable, may be shown to the user
  details?: Array<{
    field: string;        // For VALIDATION_ERROR — the field that failed
    message: string;
  }>;
  requestId: string;      // Correlation ID for debugging
}
```

The `requestId` must be logged by the frontend for support tracing.

---

## Job Status State Machine

```
queued ──→ processing ──→ completed
   │              │
   └──── cancelled ←──┘
              │
            failed
```

Terminal states: `completed`, `failed`, `cancelled`.

The frontend must handle all five states explicitly and never assume a job will
eventually complete.

---

## Model Name Mapping

The UI displays friendly names; the API accepts model identifiers:

| UI label | API model value |
|---|---|
| Violet Motion 2.0 · Recommended | `violet-motion-2` |
| Violet Cinema · Cinematic | `violet-cinema` |
| Violet Fast · Quick draft | `violet-fast` |
| Violet Realism · Photoreal | `violet-realism` |

---

## Frontend API Client Contract

The Next.js layer (`lib/api-client.ts`) exposes typed functions:

```typescript
createJob(params: CreateJobParams): Promise<CreateJobResponse>
getJob(jobId: string): Promise<JobResponse>
cancelJob(jobId: string): Promise<void>
uploadImage(file: File): Promise<UploadResponse>
listProjects(options?: ListProjectsOptions): Promise<ProjectsResponse>
getProject(projectId: string): Promise<ProjectResponse>
deleteProject(projectId: string): Promise<void>
getCredits(): Promise<CreditsResponse>
```

All Zod schemas for these types live in `lib/schemas.ts` and validate
server responses at runtime.

---

## Unresolved Questions

| Question | Impact |
|---|---|
| Authentication mechanism | Affects all authenticated calls |
| BytePlus model names | API model values may differ from proposed names |
| Upload destination | Does backend return a CDN URL or a proxy URL? |
| Signed URL refresh strategy | How long are `mediaUrl` URLs valid? |
| Webhook vs polling | Backend may support WebSocket/SSE in addition to polling |
| Rate limits | Per-user concurrent job limit not yet defined |
| CORS policy | Must confirm allowed origins for the Go backend |
