# Frontend design and UX/UI workflow

Owner: project-pm. Added2026-10-15. Uses project-scoped Codex role definitions,
not an installed pstack plugin or an automatic CI gate.

## Roles and ownership

| Role | Responsibility | Default write scope |
| --- | --- | --- |
| nextjs_fe_designer | User flow, hierarchy, visual/interaction specification, Thai copy and acceptance criteria | Assigned design documents/assets only |
| nextjs_fe_developer | Implement components, state, API integration and verification | Assigned product files |
| nextjs_ux_ui_reviewer | Independent rendered usability, visual and accessibility checks | None; return findings/evidence |
| nextjs_fe_auditor | Independent code, security, API, architecture and build audit | None; return findings/evidence |
| project-pm | Contracts, owners, sequencing, acceptance and cross-repo coordination | Assigned coordination records |

Definitions live in `.codex/agents/` under the Web repo. Models and permissions
inherit; no global settings or additional tools are installed. Project discovery
may require a new trusted session. If a custom name is unavailable, PM loads the
exact role TOML instructions into a fresh generic delegate and discloses fallback.
Role instructions are behavioral constraints, not a separate read-only sandbox.
[Official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents)
was checked for the standalone name/description/developer_instructions format.

## Shared design direction

Latest user instructions take priority over old documents and archived HTML.
Current approved product direction: Idea First; Thai copy with Prompt; restrained
blue actions; readable white/neutral Liquid Glass; cinematic imagery/video only
where it helps. Dense text and inputs need opaque readable surfaces. Preserve
working authentication, API/provider integration and truthful asynchronous states.
Use [phase-one implementation notes](character-studio-phase1.md) and actual
components as the current baseline. Older design-system/prototype files are
references, not permission to restore retired colors/fonts or rewrite the app.

## Execution

1. PM records task outcome, existing behavior, allowed files, current design
   references, source snapshot, API dependencies and observable criteria.
2. Designer inspects the real flow and returns a small developer-ready brief:
   primary action, component reuse, states, Thai copy, responsive layout, tokens,
   keyboard/focus and acceptance checks. For a small bug PM may explicitly reuse
   current design and skip a new brief. Resolve BE contracts before integration.
3. Developer implements within ownership. Use relevant installed Next guides,
   clean up external synchronization and preserve immutable generation retries.
   Run lint/type-check/build and meaningful behavior checks.
4. Stop writers. PM supplies final changed-file hashes (including untracked task
   files), screenshots/test artifacts and fixture boundaries to fresh reviewers.
5. UX/UI reviewer verifies rendered affected routes at375/1440 and768 when layout
   changes, keyboard/focus, contrast/touch targets, success/error/loading/empty/
   disabled states and state transitions. Inspect computed critical CSS, not only
   authored selectors. CSS/build regressions require the user's actual running
   URL and final production artifact; record server/port/browser/source identity.
   Avoid full-page sticky/animation screenshot artifacts.
6. Engineering auditor checks code/contracts/security and required gates. Keep
   author results distinct from independently rerun checks. Neither review role
   can approve its own authored design/implementation. Parallel reviews require
   separate processes and coordinated build directories; same-checkout writes
   stay serialized. PM can serialize reviews when agent slots are limited.
7. Return actionable findings to the owner, fix, and rerun affected checks/review.
   After two failed repairs revisit the premise before another patch, following
   the existing Lauren Tan adaptation. Do not spend AI credits for verification.
8. PM records PASS only with applicable evidence and no blocking finding. Missing
   browser/provider access is BLOCKED/NOT_RUN for that check; never invent proof.
   Aesthetic suggestions are not blockers unless tied to user impact/requirements.
   Medium findings need a fix or an explicit risk decision. Prose is not CI.

## Required review evidence

For each affected flow record: source snapshot; route/server/build; browser and
viewport; actions; expected/actual; status; viewport screenshot; console/network
notes; relevant computed CSS; author versus independent checks; mock boundaries.
Use PASS/FAIL/BLOCKED/NOT_RUN. Findings include severity, file:line, reproduction,
user impact and focused remediation. Later source changes invalidate affected
acceptance. Store artifacts under task-specific engineering QA/review paths and
exclude tokens, credentials and private uploaded data.

Regression priorities from this project: chips rendered as joined text, missing
CSS Module class exports, lost glass blur in emitted CSS, textarea focus overflow,
mismatched composer/result widths, reference preview/replacement failures and
mutable unknown generation retries. Add scoped executable checks for demonstrated
recurrences when code is changed; this workflow alone does not install those tests.

## Example PM task

> ให้ nextjs_fe_designer ออกแบบ flow แนบภาพอ้างอิงตามหน้าปัจจุบัน ส่ง brief ให้
> nextjs_fe_developer แล้วให้ nextjs_ux_ui_reviewer ตรวจ375/1440บน URLจริงและ
> production build พร้อมให้ nextjs_fe_auditor ตรวจโค้ดและ API ก่อน PM ตรวจรับ
