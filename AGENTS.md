# KC3 coding agent instructions

This is the shared entry point for Codex, Claude Code, Cursor, and other coding
agents. The repository is the source of truth. Follow the user's scoped request;
do not infer product requirements from a task title.

## Start with the task

1. Read this file and inspect the files you expect to change. Read `README.md`
   for repository orientation when the task spans unfamiliar areas.
2. Read only the documents needed for the task:
   - Product behavior or scope: `docs/PRODUCT.md` and the relevant feature
     contract. Confirm approval before changing behavior.
   - Architecture, dependencies, API, or data model: `docs/ARCHITECTURE.md` and
     `docs/DECISIONS.md` before proposing a replacement.
   - Priorities, project status, or ticket closure: `docs/ROADMAP.md`.
   - Setup, checks, CI, or local database work: `docs/DEVELOPMENT.md`.
   - KC3-37 source, review, or publication work: the relevant KC3-37 document
     linked from `README.md`; preserve its attended review gates.
3. For material implementation or handoff work, use the brief, evidence, review,
   and approval rules in `docs/AI_OPERATIONS_STANDARD.md` and the KC3 change path
   in `docs/SOFTWARE_DEVELOPMENT_STANDARD.md`. A small, reversible edit needs
   only the applicable rules here and focused validation.

If a requirement, authority, or architectural constraint conflicts with the
request, stop the affected change and explain the conflict. Prefer the smallest
change that preserves existing behavior and follows local patterns. Add a
dependency only with a clear reason.

## Boundaries and approval

- TypeScript is the primary application language; React Native, Expo, Supabase,
  PostgreSQL, and Supabase Auth are the approved stack. Tooling may use the
  repository's existing JavaScript convention. Do not introduce another
  application language, replace the stack, or perform a framework migration or
  architectural rewrite without explicit approval.
- Never commit credentials or place privileged keys in `EXPO_PUBLIC_` variables
  or client code. Use local environment files or platform secret management.
- Treat local Supabase targets as potentially curated. Identify the exact target
  before any database command. Run resets, seeds, and test fixtures only in a
  confirmed disposable project; never reset the curated KC3 database. Curated
  writes and migrations must follow their documented attended procedures and
  approval gates. Production migrations, publication, deployment, and PR merges
  require explicit human approval; passing checks or an AI review do not grant it.
- KC3-37 Ready decisions, source publication, and protected data require their
  documented attended review. Do not infer approval from a passing test.

## Validate and hand off

- Add or update tests when behavior changes. For TypeScript or client changes,
  run relevant Jest tests, typecheck, lint, formatting, and an Expo export when
  the build path changes. For SQL, permissions, or RPC changes, also run pgTAP,
  database lint, and relevant integration checks against a **confirmed
  disposable** local Supabase project. Documentation-only changes need link and
  diff review; use the fast staged guard if it is installed. CI runs the full
  application and disposable database jobs on PRs. See `docs/DEVELOPMENT.md`
  for exact commands and prerequisites.
- Before claiming completion, inspect the final diff for correctness, security,
  regressions, and simpler options. Record exact checks, results, skipped checks,
  review findings, and remaining risks in the PR or handoff. Material changes
  need a reviewer who did not implement them, per the standards above.
- Update `docs/PRODUCT.md` for approved behavior/scope changes,
  `docs/ARCHITECTURE.md` for system or data changes, `docs/DECISIONS.md` for
  meaningful decisions, `docs/ROADMAP.md` for status, and `docs/DEVELOPMENT.md`
  for workflow/tooling changes. A decision entry records date, decision, context,
  alternatives, reasoning, and consequences. Do not leave durable knowledge only
  in chat.

## Development Operations Reporting Protocol

Use this protocol for KC3 ticket work so the Chief of Staff can inspect progress
through GitHub and Notion without access to live agent conversations. The
existing Notion ticket database remains the source of truth for ticket-level
scope, ownership, dependencies, and completion. Repository documents govern
approved product and technical scope and roadmap priorities; resolve conflicts
in favor of the repository as `docs/DEVELOPMENT.md` directs. GitHub holds
implementation evidence and operational handoffs. Do not change the central
Operations Dashboard or create duplicate Notion tickets without authorization.

### Execution status

Use exactly one of these values for the **ticket's execution status**:

- `IN_PROGRESS` — an agent is actively implementing assigned work.
- `AGENT_ACTIONABLE` — work can continue without owner involvement, including
  after an agent session ends.
- `AWAITING_OWNER` — a specific human action is required to advance the work.
- `AWAITING_APPROVAL` — an owner approval or decision is required.
- `BLOCKED_EXTERNAL` — an external dependency or service must change before the
  affected work can continue.
- `READY_FOR_REVIEW` — implementation and its evidence are ready for the required
  review.
- `COMPLETE` — established acceptance criteria and required validation are
  satisfied; do not use this state merely because an agent session ended.

Report ticket status separately from agent session activity. An inactive session
does not make a ticket blocked. Before ending an unfinished session, replace
`IN_PROGRESS` with the state that describes the remaining work. Do not imply an
agent is still running after its session ends. Identify independent work that
can continue even when one task or decision is blocked; do not mark the whole
project blocked for a narrower dependency.

### Persistent status record

Keep one clearly identified `Development Operations Status` section in the
associated GitHub PR, preferably in its description, and update that section
when status changes. Use the same section in an existing linked GitHub issue
when there is no PR and the issue is appropriate. Create a scoped issue only
when a genuine blocker needs tracking and the repository workflow permits it;
check for an existing issue first. Do not create empty commits, PRs, duplicate
issues, or unnecessary tracking records solely to publish status. If no suitable
GitHub record exists or publishing is unavailable, include the status in the
final Codex response and say explicitly that it is not externally visible.

Keep these field names and this order unchanged for automated parsing. Use
`None` for an inapplicable blocker, action channel, or URL; use the actual Notion
ticket ID when one exists and `None` when none is linked. Use `Yes` or `No` for
human action, `Phone`, `Laptop`, `Either`, or `None` for the channel, and an ISO
8601 UTC timestamp for `Updated At`.

```text
## Development Operations Status
Project: KC3
Ticket: [Notion ticket ID or None]
Execution Status: [One standardized status above]
Human Action Required: [Yes | No]
Action Channel: [Phone | Laptop | Either | None]
Blocker: [Specific blocker or None]
Exact Next Step: [Actionable instruction]
Downstream Impact: [What this blocks]
Completed Work: [Summary]
Remaining Work: [Summary]
Validation Results: [Exact checks, outcomes, and evidence; identify unrun checks]
PR or Issue URL: [URL or None]
Updated At: [YYYY-MM-DDTHH:MM:SSZ]
```

Publish meaningful updates when substantive ticket work begins, a blocker or
owner action appears, a milestone is reached, a PR opens or materially changes,
validation fails or recovers, work becomes ready for review, or an agent session
ends or pauses. Update the existing status section rather than adding repetitive
records when nothing meaningful changed. Make the change since the previous
update clear in `Completed Work`, `Remaining Work`, or `Validation Results`.

### Action and handoff decisions

Before escalating, check whether an agent can research, implement, test, fix,
document, prepare configuration, review requirements, propose a solution, or
draft a decision within its authority. Reserve human handoffs for actions such
as identity verification, financial commitments, production credential or
security approvals, product or business decisions, physical-device testing,
final release approval, or authenticated owner access. Never request secrets in
GitHub issues, PRs, or committed files.

For each human handoff, state the exact action, why an agent cannot perform it,
where to perform it, whether a phone suffices, what work it unlocks, and whether
independent agent work can continue. Put the action in `Exact Next Step`, the
constraint in `Blocker`, the device in `Action Channel`, and the unlocked work in
`Downstream Impact` and `Remaining Work`. If necessary, add concise detail below
the status fields without changing their names. Prioritize actions by downstream
tasks blocked, critical-path impact, agent autonomy, owner effort, and whether
the owner can act from a phone during the workday. Do not escalate minor
implementation decisions unnecessarily.

Before ending a coding session, update the persistent record when available and
provide a handoff with completed work, validation results, outstanding blockers,
the next agent-actionable step, any human action, the ticket and PR or issue
links, and an explicit statement of whether agent work can continue without the
owner. Follow the existing validation, independent-review, and approval gates
above; reporting status never grants permission to merge, deploy, modify
production data, change architecture outside scope, spend money, expose secrets,
or take another irreversible action. Do not work in unrelated repositories.
