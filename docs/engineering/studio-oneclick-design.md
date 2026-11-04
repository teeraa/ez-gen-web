# STUDIO-ONECLICK-20261022 — Studio สร้างวิดีโอในครั้งเดียว

Owner: nextjs_fe_designer (generic delegate using exact project role). Path: feature.
Status: READY for implementation after PM reconciles authoritative backend contract.
Source inspected 2026-10-22 11:04 UTC; Web HEAD `2d629bae3e98f26aeefce080121b8b5a03049795`.
Only this new document is owned by designer. Existing extensive dirty/untracked work is preserved.

## Outcome and shared design decision

ผู้ใช้แนบภาพ บอกลักษณะตัวละคร ฉาก และบทพูด แล้วกด **สร้างวิดีโอ** ครั้งเดียว ระบบสร้างตัวละครสังเคราะห์โดยคงเค้าโครงเดิม บันทึกตัวละครเข้าคลัง ใช้ภาพที่สร้างแล้วเป็นภาพอ้างอิงวิดีโอ และบันทึกวิดีโอเข้าคลังโดยอัตโนมัติ งานดำเนินต่อบน server แม้ปิดหน้า ผู้ใช้กลับมาเห็นงานเดิมได้ ไม่ต้องย้ายภาพหรือกดบันทึกเอง

Baseline: `/studio` renders `Composer` with category/design controls, image generation, browser session restoration and manual save. `/studio/library` renders `AssetLibrary`, currently character/prop assets only. Navigation splits character creation and video projects and includes several quick-create links. This makes a single intent span separate routes/actions. New design replaces this primary hierarchy; existing project editing/settings routes remain accessible. No provider calls or browser reproduction performed by designer.

Data flow: uploaded reference → durable server-owned request snapshot → synthesized image → persisted character asset → video from that generated image plus scene/dialogue → persisted video asset. Browser submits one intent and observes authoritative server state. Browser must never launch stage two from a polling effect. Retry identity, running-job discovery, step outcomes, durable asset identities and available settings come from PM-approved backend contract; the terms below are UI concepts, not proposed JSON field names.

## Entry and hierarchy

Primary route `/studio`, nav label **สร้างวิดีโอ**. H1 **จากภาพของคุณ สู่เรื่องราวใหม่**. Supporting copy **สร้างตัวละครสังเคราะห์ที่คงเค้าโครงเดิม แล้วสร้างวิดีโอและเก็บเข้าคลังให้อัตโนมัติ**. Avoid guarantees of exact identity or photorealistic output.

Primary nav: สร้างวิดีโอ; คลังผลงาน; ประวัติการสร้าง. Secondary section: โปรเจกต์วิดีโอ (existing advanced editor); ตั้งค่า. Remove duplicate quick-create cluster from primary navigation. Account/logout retain current semantics. Topbar action **สร้างใหม่** returns to main form; it does not cancel a running job. Existing routes and direct links continue working.

One main composer card, in this order:

1. **ภาพอ้างอิง** (required): click/drop upload region with text **เลือกภาพ หรือวางภาพที่นี่** and actual capability-backed file limits. Once selected: contained thumbnail, filename, buttons **เปลี่ยนภาพ**, **นำภาพออก**. Identify it as **ภาพต้นฉบับ · ใช้สร้างตัวละคร**. Never show source upload in generated-result slot.
2. **ลักษณะตัวละคร** (required multiline): placeholder **เช่น ตัวละครสังเคราะห์ในชุดแจ็กเก็ตสีครีม คงใบหน้าและทรงผมใกล้ภาพอ้างอิง**. Helper **บอกสิ่งที่อยากปรับ ระบบจะใช้ภาพอ้างอิงเพื่อรักษาเค้าโครงเดิม**.
3. **ฉากและการเคลื่อนไหว** (required multiline): placeholder **เช่น เดินผ่านสวนยามเช้า หันมามองกล้อง แสงธรรมชาติ**.
4. **บทพูด** (optional multiline): helper **เว้นว่างได้ หากใส่บทพูด ระบบจะใช้ในการสร้างเสียงของวิดีโอ**. Preserve original user text including Thai; do not silently translate, trim dialogue content or promise exact voice/lip synchronization. No voice picker unless contract actually supports it.
5. Disclosure **ตั้งค่าเพิ่มเติม**: expose only backend-supported ratio/duration/style options with real defaults and capability limits. Main flow uses one video-ready character image, never a multi-view design turnaround. No required character name, project name, mood grids or model picker. Capability failure offers retry and blocks submit with explanation.
6. Full-width blue primary **สร้างวิดีโอ** and quiet line **ตัวละครและวิดีโอจะบันทึกเข้าคลังให้อัตโนมัติ**. No invented credits, price or time estimate. If configured server pricing is later exposed, PM must agree copy/meaning first.

## Result panel and durable activity

At desktop composer and result are siblings under one max-width container. Result title **ผลงานจากคำขอนี้**. Empty state uses a simple film icon, **วิดีโอของคุณจะแสดงที่นี่**, explanatory copy; no fake sample output. Running view shows immutable brief summary and semantic ordered timeline:

- สร้างตัวละครสังเคราะห์
- บันทึกตัวละครเข้าคลัง
- สร้างวิดีโอ
- บันทึกวิดีโอเข้าคลัง

Timeline state comes only from authoritative server evidence: **รอดำเนินการ**, **กำลังดำเนินการ**, **เสร็จแล้ว**, **ไม่สำเร็จ**. If backend combines generation/save stages, render a combined step rather than infer an intermediate success. No simulated percentage, timed stage transition or fake countdown. Indeterminate spinner only on actual active step; text remains meaningful without animation. Inline note **ออกจากหน้านี้ได้ งานจะดำเนินต่อและเก็บไว้ในประวัติ** only once durable acceptance is confirmed.

Generated character appears when available with **ตัวละครสังเคราะห์** caption and **ดูในคลังตัวละคร** only when persistence is confirmed. Video preview uses native controls, poster if available, no autoplay sound; **ดูในคลังวิดีโอ** only when saved. Loading a signed URL or replacing expired URLs must not create another generation. Never replace an unavailable generated image with original reference.

Below primary workspace: **งานล่าสุด** compact list restored from server, showing brief excerpt, timestamp, truthful state and **ดูงาน**. Initial job loading shows skeleton + **กำลังโหลดงานของคุณ**. No jobs: **ยังไม่มีงาน เริ่มจากภาพแรกของคุณได้เลย**. Failed list loading is a retryable panel error, not empty history. Selecting a job loads its immutable summary/results and its recovery actions; do not overwrite unsent form input silently.

## Library

Keep `/studio/library` as shared destination. Visually separate **ตัวละคร**, **วิดีโอ**, and existing **สินค้า/พร็อพ** views using labeled native buttons/links with selected state; no joined text. Concrete navigation/query names depend on FE/PM integration. Character cards use generated image; video cards use actual poster or film placeholder, title, saved timestamp, native preview and download only if real URL exists. No manual save CTA. Existing rename/delete controls remain where supported; no unsupported video operations. Running jobs live in history, not fabricated saved asset cards. Empty tab offers **สร้างวิดีโอแรก**. Error preserves selected view and query and offers retry. Loading is distinguishable from empty.

## State and recovery specification

| Situation | User-visible behavior | Allowed action |
| --- | --- | --- |
| Initial server restore | Show loading of active/recent work; preserve draft | Wait/retry failed lookup; never silently assume no prior job |
| Upload underway | Thumbnail placeholder and กำลังอัปโหลดภาพ; submit unavailable | Replace after completion or supported abort; no unimplemented cancel |
| Invalid/expired upload | Inline error linked to upload field; keep typed text | Select a valid replacement; validate with actual backend rules |
| Missing required input | Submit validation summary + field-specific errors | Focus first invalid control; retain all input |
| Submit in flight | กำลังส่งคำขอ; disable duplicate action | No second request with fresh identity |
| Submission outcome unknown | ยังยืนยันคำขอไม่ได้ กำลังตรวจสอบงานเดิม | ตรวจสอบอีกครั้ง / ส่งคำขอเดิมอีกครั้ง with same immutable payload and identity; do not show สร้างใหม่ as retry |
| Accepted/running | Locked snapshot, timeline, separate start-new action | Leave/reopen; refresh authoritative status without creating a job |
| Polling/network error | ตรวจสอบสถานะไม่สำเร็จ งานอาจยังดำเนินอยู่ | ตรวจสอบอีกครั้ง; do not label generation failed |
| Image generated but save pending/failed | Display actual image and real pending/error step | Retry server-supported persistence; never claim saved |
| Character saved, video failed | Keep character preview/link; ตัวละครบันทึกแล้ว แต่สร้างวิดีโอไม่สำเร็จ | ลองสร้างวิดีโออีกครั้ง resumes missing stage via backend-supported retry; preserve image and prior snapshot |
| Video generated but save failed | Preview may remain; ยังบันทึกวิดีโอเข้าคลังไม่สำเร็จ | Retry save via supported backend action; never regenerate solely to save |
| Full success | Both previews with persisted links; บันทึกเข้าคลังแล้ว | View library, play video, start separate new request |
| Backend lacks precise resume support | Explain actual failure and retain successful assets | Do not present a fake stage-only retry; PM must resolve contract gap before acceptance |

Retry is distinct from new generation. Editing a submitted snapshot requires an explicit new request. Cancellation is absent unless backend supports it. Generation failure and status-fetch failure must use different labels and actions. Library expiry errors request refreshed URLs, not generation retries.

## Layout, components and visual tokens

Use current Prompt font, restrained blue `#0066cc`, neutral off-white canvas, white opaque form fields, subtle border and shadow. Glass belongs to shell/topbar and low-density surfaces; primary inputs/results stay readable. Reuse existing global variables and current button/nav primitives; scoped module styles for new layout to avoid destabilizing project editor. Validate actual contrast: text 4.5:1, large text and essential boundaries/focus 3:1. Do not claim measured ratios from this document.

Spacing scale 8/12/16/24/32px; cards 20px radius, inputs 12px, buttons 12px. Body 15–16px line-height1.6; labels14px semibold; heading28–32px desktop,24px mobile. Form textareas minimum104px, dialogue88px, resize vertically. Upload thumbnail aspect-fit, max-height180px. Preview surfaces reserve sensible aspect ratio from actual selected output to avoid jumps.

- **1440px:** existing sidebar ~224px; content max-width1120px with32px padding. Two columns minmax(0,1fr) / minmax(0,1fr),24px gap; result top aligned. Recent jobs spans both. No nested scrollers or sticky composer; long copy scrolls naturally.
- **768px:** shell mobile drawer,24px page gutters; single-column workspace, composer first, results next; keep upload/fields full width. Header actions must not overlap breadcrumb. Library2-column cards.
- **375px:**16px gutters; full-width single-column cards with16px padding; H1 wraps naturally; primary button full width, minimum48px height. Buttons may wrap, no horizontal overflow. Results follow form with anchor link **ดูสถานะงาน** after acceptance; focus moves to status heading once, not every poll. Library1-column cards. No sticky footer covering keyboard/input or results.

Reuse map: `StudioNav` shell and auth; `Composer` primary entry (replace character-only hierarchy in place or delegate to a focused new component); existing upload validation/API and preview-refresh helpers where semantically compatible; `AssetLibrary` views; current jobs/history route for durable activity. Browser-only state is form/upload interaction and job selection. Durable orchestration belongs to Go, accessed through Next Route Handlers. Installed guide `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` read; no framework code authored.

Keyboard: native form labels with required/optional text, errors via aria-describedby, file selection operable by button/keyboard; drag/drop never sole input. All primary targets≥44px; clear 2px focus outline with offset. Disclosure uses expanded state; library views use native buttons or route links rather than incomplete ARIA tabs. Live region polite for step changes only, never every poll. Error summary uses alert on actionable failure. Mobile drawer preserves existing focus trap/Escape/return focus. Reduced motion removes decorative movement and spinners retain text. Video has accessible label and keyboard-native controls. Focus never jumps on restored job polling.

## Feature map and observable acceptance

| Criterion | UI/code path for developer | Observable browser check |
| --- | --- | --- |
| One intent, one primary submit | `/studio` Composer → proxy → durable workflow | Supply photo+character+scene+optional Thai dialogue, click once; one accepted workflow; dialogue unchanged |
| Original never drives video | Generated-image preview and server workflow | Distinct original/generated fixture identities; request evidence confirms generated ID feeds video; source preview labeled separately |
| Automatic persistence | Results and AssetLibrary | Without save click, generated character and video appear in appropriate library views |
| Durable continuation | Jobs restore/history + authoritative status | Close page after image stage; reopen/new session; same server workflow completes, no browser-created video job |
| Partial recovery | Result timeline + retry controls | Video failure retains saved character; retry resumes supported stage without new character |
| Unknown submit deduplication | Submit pending/recovery controls | Drop submit response then retry; unchanged payload/identity, one server workflow |
| Honest status | Timeline/error panels | Poll failure is not generation failure; no fake percentage or success before asset persistence |
| Usable at all sizes | Shell/form/result/library | 375/768/1440 screenshots, no overflow; labels and controls readable, keyboard order sensible |
| Empty/error/loading | Main and library states | Separate fixtures for each; failed fetch never rendered as empty success |
| Accessible controls | Form/nav/video | Keyboard-only upload, errors, disclosure, retry, library; measured targets and computed contrast/focus |

## Implementation handoff and review

Developer: implement the single cohesive feature above within PM-assigned files only. First reconcile contracts and snapshot current dirty source. Do not invent endpoints/status names, poll-driven orchestration, unsupported pricing/settings, manual-save prerequisites or exact audio quality promises. Record any backend capability gap before integration. Preserve auth, old project editor and historical job retry behavior.

Author checks: `pnpm lint`, `pnpm type-check`, `pnpm build` plus meaningful fixture-backed browser paths above; dependency changes additionally audit high severity. Serialize builds. Use isolated fake providers; do not call paid generation. Record commands/time/exit, changed-file hashes including untracked files, browser URL/server/build identity and sanitized artifacts. Designer authored no product code; runtime and production checks are NOT_RUN, not PASS.

After writers stop, fresh independent UX/UI reviewer verifies actual user URL, computed styles, desktop/375/768 evidence, keyboard, all affected states and final production artifact. Fresh engineering auditor checks contract/security/retry/orchestration and gates; reviewers must challenge author evidence rather than approve this prose. Independent review remains pending. Design document checks: inspected actual paths and current source; no invented API schema; no build required for this documentation-only deliverable.
