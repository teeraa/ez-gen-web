# Next.js frontend agent workflow

Project-scoped Codex agents:

- `nextjs_fe_designer`: defines scoped product flows and visual/component design.
- `nextjs_fe_developer`: implements assigned frontend tasks and verifies behavior.
- `nextjs_ux_ui_reviewer`: independently reviews rendered usability, visual consistency and accessibility.
- `nextjs_fe_auditor`: independently audits the final changes without editing them.

These instructions adapt [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/main/pstack)
principles of depth before parallelism, reproduction, and runtime verification to
this repository. They do not install pstack or claim its full workflow is present.
The format follows [official Codex subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Usage

Definitions are in `.codex/agents/`. Open a new Codex session in this trusted
project if they are not discovered in the current session. Models, permissions
and available tools inherit from the parent. Browser capability is session-dependent; use an available browser/Playwright when present and disclose unavailable checks;
the auditor's instruction to avoid edits is not a separate read-only sandbox.

Example request:

> Use nextjs_fe_developer to implement [feature and observable acceptance criteria]
> in [assigned files]. After edits settle, use nextjs_fe_auditor to audit the
> final changes against [base commit]. Fix findings and re-audit. Return evidence.

The coordinator assigns ownership under AGENTS.md. Run implementation then audit
sequentially in a shared checkout; do not run builds concurrently against `.next`.
The auditor reports findings to the coordinator and the developer fixes them.

For design routing, current visual direction and UX acceptance, read
[UX/UI workflow](ux-ui-workflow.md). A small visual bug may reuse the existing
design with a recorded reason; the affected UI still requires independent review.

## Development loop

1. Inspect scope, source state, phase prerequisites and relevant installed guides.
2. Define observable acceptance criteria and identify the feature entry/data flow.
3. Reproduce a bug or establish initial feature behavior and baseline checks.
4. Implement within assigned files and verify affected runtime behavior.
5. Run `pnpm lint && pnpm type-check && pnpm build` for code changes.
6. Audit independently; fix findings and repeat affected checks on final changes.
7. For recurring demonstrated defects, add appropriate regression coverage or
   propose a narrow lint/type/CI constraint. Prose rules alone are not enforcement.

Current security, ownership and verification rules remain in force. Historical
scaffold checklists are not new prerequisites: inspect installed source and latest
approved Thai/Prompt direction instead of reinstalling old fonts or disabling
working auth/provider integration. Creating roles alone does not configure secrets
or verify API contracts. Route actual implementation blockers through
the coordinator to repository-map.md section 9. Older engineering proposals have
stale Next.js/Tailwind examples; prefer CLAUDE.md and the installed Next.js guides.

## Evidence and verdict

For each task provide scope, base commit, final commit where available, changed
files, and evidence identifying the source state tested. For uncommitted changes,
include a diff fingerprint and account for untracked task files.

Use this acceptance matrix:

| Criterion | Scenario | Expected | Observed | Status | Evidence path |
| --- | --- | --- | --- | --- | --- |
| Task-specific behavior | Reproducible actions | Observable outcome | Actual outcome | PASS / FAIL / BLOCKED / NOT RUN | Log, screenshot or trace |

Record commands actually run, exit codes, relevant environment details, and
pre-existing failures versus regressions. For UI changes include the route/setup,
browser actions, desktop and 375px screenshots, visual comparison with the design
reference, keyboard/focus checks, console/network results and relevant
success/error/loading/empty scenarios. Disclose mock boundaries and unavailable
integrations. Performance claims need comparable before/after measurements.

Store evidence in a task-specific temporary/artifact directory and report exact
paths without credentials or private payloads. Invalidate affected evidence after
later changes. Findings need severity, file:line, trigger, expected/actual behavior,
impact and reproducible evidence.

PASS requires current evidence for every applicable gate and no blocking finding.
FAIL means a demonstrated acceptance failure. BLOCKED means required verification
cannot be completed. Never infer browser success from a passing build.

## Definition validation checklist

- [x] Separate implementation ownership from independent audit.
- [x] Preserve installed-version guides, phase restrictions and parent permissions.
- [x] Require observable criteria and evidence tied to final source state.
- [x] Distinguish missing verification from success.
- [ ] Exercise a complete product task with browser and independent audit evidence;
  deferred until an implementation task is assigned.
