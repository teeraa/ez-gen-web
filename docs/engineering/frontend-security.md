# Frontend Security Review — Agent G Deliverable

> Date: 2026-10-12  
> Reviewer: Agent G — Security Specialist  
> Scope: Frontend trust boundaries, data flow, and client-side risks  
> Status: Evidence-based analysis of the prototype — not verified against a running implementation

---

## 1. Trust Boundary Architecture

```
Browser (untrusted)
    │
    │  HTTPS
    ▼
Next.js App (trusted server — Route Handlers)
    │
    │  Internal network / HTTPS
    ▼
Go Fiber API — ez-gen-api (trusted backend)
    │
    │  HTTPS + API Key (server-only)
    ▼
BytePlus ModelArk (external AI provider)
```

**Critical rule:** The BytePlus API key must only exist in the Go backend environment.
It must never appear in:
- Any `NEXT_PUBLIC_*` environment variable
- Any client-side bundle (check with `pnpm build && grep -r "BYTEPLUS" .next/`)
- Any API response returned to the browser
- Any error message surfaced to the user

---

## 2. Secret Exposure Risks

### 2.1 Environment Variables

| Risk | Severity | Mitigation |
|---|---|---|
| BytePlus API key in `NEXT_PUBLIC_` variable | Critical | Never use `NEXT_PUBLIC_` for secrets. Use `API_URL` (server-only). |
| BytePlus API key accidentally bundled | Critical | Run `grep -r "byteplus\|modelark" .next/static/` after each build |
| `.env.local` committed to git | High | Verify `.gitignore` includes `.env.local`, `.env*.local` |
| Hardcoded credentials in source | High | Run `grep -rn "api.byteplus\|apikey\|api_key" src/` in CI |

**Required `.gitignore` entries:**
```
.env.local
.env*.local
.env.production
```

### 2.2 Build-time Leak Check

Add to CI or pre-release checklist:
```bash
pnpm build
# Check that no secrets leaked into client bundle
grep -r "byteplus\|modelark\|secret\|api_key" .next/static/ && echo "LEAK DETECTED" || echo "Clean"
```

---

## 3. API Authentication

### 3.1 Current prototype state
The HTML prototype has no authentication — all operations are anonymous.

### 3.2 Implementation requirements

- All `/v1/` endpoints on the Go backend must require authentication.
- The Next.js Route Handlers forward the user's session token (not a service-level key).
- Never forward the BytePlus API key through Route Handlers.
- Session tokens must be `httpOnly`, `Secure`, `SameSite=Strict` cookies.
- Do not store tokens in `localStorage` or `sessionStorage` (XSS-accessible).

### 3.3 Route Handler security
```typescript
// app/api/jobs/route.ts — server-side only
import { verifySession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await verifySession(req); // validates JWT, never trusts client claims
  if (!session) return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  // ... forward to Go backend with user context
}
```

---

## 4. User-Provided Input Risks

### 4.1 Prompt text injection

**Risk:** User-crafted prompts may attempt to manipulate the AI model or extract
system prompts from the generation pipeline.

**Frontend mitigation:**
- Enforce max length of 2000 characters (already in the prototype via `maxlength`)
- Strip null bytes and control characters before submission
- Do not render user-provided prompt text as HTML — use `textContent` or React's
  default text rendering (never `dangerouslySetInnerHTML`)

**Backend mitigation (owned by ez-gen-api):**
- Validate and sanitize on the server
- Do not trust `prompt` field values from the client

### 4.2 File upload risks

**Risk:** A user uploads a malicious file disguised as an image.

**Frontend validation (defense in depth, not sufficient alone):**
```typescript
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

if (!ALLOWED_TYPES.includes(file.type)) throw new Error("INVALID_FILE_TYPE");
if (file.size > MAX_SIZE) throw new Error("FILE_TOO_LARGE");
```

**Note:** MIME type checking on the client is insufficient — `file.type` can be
spoofed. The Go backend must re-validate the file's magic bytes and reject
non-image content.

**Additional controls needed at the backend:**
- Re-validate MIME type by reading magic bytes (not trusting `Content-Type`)
- Strip EXIF metadata before forwarding to BytePlus
- Scan for embedded scripts (SVG with `<script>`, polyglot files)
- Enforce max dimensions to prevent decompression bombs

### 4.3 URL-based image references

If the UI ever allows users to provide external image URLs (not present in the
current prototype but a common extension):
- Never fetch external URLs server-side without a strict allowlist or SSRF protection
- Never proxy external URLs directly to BytePlus

---

## 5. XSS Prevention

### 5.1 Project titles and prompt text

User-generated content (project titles, prompt text) must never be rendered
with `dangerouslySetInnerHTML`. In the prototype, all user content is set via
`textContent` — maintain this in React.

```typescript
// SAFE
<h3>{project.title}</h3>

// UNSAFE — never do this
<h3 dangerouslySetInnerHTML={{ __html: project.title }} />
```

### 5.2 Generated media URLs

If the API returns media URLs (signed CDN URLs):
- Validate the URL is from a trusted domain before rendering in `<img>` or `<video>`
- Use `next/image` with a configured domain allowlist in `next.config.ts`:
```typescript
images: {
  remotePatterns: [
    { protocol: "https", hostname: "cdn.violetstudio.app" },
    // Do NOT add a wildcard ("**") pattern
  ]
}
```

### 5.3 Content Security Policy

Add a CSP header in `next.config.ts`:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https://cdn.violetstudio.app https://images.unsplash.com;
  media-src 'self' https://cdn.violetstudio.app;
  connect-src 'self';
  frame-ancestors 'none';
```

Adjust as the actual CDN domain and font hosting are finalized.

---

## 6. CORS

The Go backend must only allow requests from known frontend origins.

Expected CORS configuration on `ez-gen-api`:
```
Access-Control-Allow-Origin: https://violetstudio.app
Access-Control-Allow-Methods: GET, POST, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
```

**Do not use `Access-Control-Allow-Origin: *`** — this would allow any site to
make credentialed requests if the auth scheme ever uses cookies.

For local development, the origin should be `http://localhost:3000` only, not a wildcard.

---

## 7. Error Handling Security

Error messages returned from the backend must not include:
- Internal file paths
- Stack traces
- Database query details
- BytePlus provider error messages containing internal model identifiers

**Frontend behavior:**
- Log the full `requestId` and error details to the browser console for debugging
- Display only the `message` field to the user, never raw error objects
- Never surface HTTP status codes or internal codes directly in the UI

```typescript
// SAFE
toast("Generation failed", error.message);

// UNSAFE
toast("Generation failed", JSON.stringify(error));
```

---

## 8. Rate Limiting and Abuse Prevention

The frontend cannot enforce rate limits reliably. The following must be
implemented at the backend:

- Per-user concurrent job limit
- Per-user daily credit limit (already in the design as "monthly credits")
- Upload rate limiting (uploads per hour)
- Prompt submission throttle

**Frontend defensive measures:**
- Disable the generate button while a job is in-flight (`isGenerating` state)
- Do not allow re-submission until the current job reaches a terminal state
- Enforce file size and type on the client as a UX improvement (not a security control)

---

## 9. Third-Party Dependencies

Before adding any npm package, verify:
- Package is actively maintained (last published < 12 months)
- No known critical CVEs (`pnpm audit`)
- Does not require `dangerouslySetInnerHTML` or DOM manipulation outside React

```bash
# Run after any dependency change
pnpm audit --audit-level high
```

---

## 10. Security Checklist (Pre-launch)

- [ ] BytePlus API key absent from all `NEXT_PUBLIC_` vars and client bundles
- [ ] `.env.local` confirmed in `.gitignore`
- [ ] CSP header configured and tested
- [ ] All user input rendered as text, never HTML
- [ ] Image uploads validated server-side (magic bytes)
- [ ] Session tokens in httpOnly cookies, not localStorage
- [ ] next/image configured with explicit domain allowlist
- [ ] CORS restricted to known frontend origin
- [ ] `pnpm audit` passes with no high/critical vulnerabilities
- [ ] Error messages do not leak internal details to browser
- [ ] No SSRF risk from external URL handling

---

## 11. Issues Not Yet Verifiable

| Issue | Reason |
|---|---|
| BytePlus key isolation in ez-gen-api | Backend not yet inspected |
| CORS configuration | Go backend not yet running |
| Session token security | Auth mechanism not yet chosen |
| CDN URL validation | CDN domain not yet known |
| Upload magic byte validation | Server-side code not yet written |

These must be verified before the first production deployment. This review covers
the frontend boundary only.
