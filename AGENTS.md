# AI Agent Instructions

These instructions apply to any AI coding agent working in this repository.

## Before Making Changes

1. Read `README.md`.
2. Read the relevant files in `docs/`.
3. Inspect the existing code before proposing architecture changes.
4. Check `docs/DECISIONS.md` before reversing or replacing an existing decision.
5. Check `docs/ROADMAP.md` to understand the current project state.

## General Rules

- Treat the repository as the source of truth.
- Do not invent requirements that are not supported by `docs/PRODUCT.md` or explicit user instructions.
- Prefer the smallest change that satisfies the requirement.
- Preserve existing working behavior unless the task explicitly changes it.
- Follow existing conventions before introducing new patterns or dependencies.
- Do not add dependencies without a clear reason.
- Do not commit secrets, API keys, passwords, tokens, certificates, or private credentials.
- Use environment variables or the platform's secret-management mechanism for sensitive values.
- Add or update tests when behavior changes.
- Run relevant tests and build checks before considering work complete.
- Explain significant tradeoffs when introducing architectural changes.
- When a requested change appears to require violating an architectural constraint, stop and explain the conflict rather than changing the architecture.

## AI Development Workflow

- Follow [`docs/AI_OPERATIONS_STANDARD.md`](docs/AI_OPERATIONS_STANDARD.md)
  for the portable brief, permissions, verification, approval, and handoff rules.
  Apply [`docs/SOFTWARE_DEVELOPMENT_STANDARD.md`](docs/SOFTWARE_DEVELOPMENT_STANDARD.md)
  for KC3 branches, reviews, releases, and bug reports.
- Work from a scoped ticket with **Goal**, **Context**, and **Validation**. The
  Goal states the outcome and explicit, testable acceptance criteria; Context
  links the approved requirements, relevant repository decisions, constraints,
  and dependencies; Validation names the checks and evidence needed to show each
  criterion is met.
- Existing KC3 Notion tickets remain valid. Use their current properties and page
  content to supply this information; add missing detail to the ticket when
  needed. `docs/ROADMAP.md` remains the source of truth for scope, priority, and
  status.
- Before handing off work, record verification evidence for each acceptance
  criterion: the check performed, its result, and a link or location for output
  when available. Identify checks that were not run and the reason.
- Review the final diff for code quality and for opportunities to simplify it.
  Resolve findings or document why a proposed change was not made. Include both
  review outcomes in the handoff or pull request.
- For material changes, ask a verifier who did not implement the change to review
  the final diff and criterion evidence from a fresh context. Record findings
  and their disposition; this review does not replace human approval.
- Obtain explicit human approval before merging a pull request, applying a
  production database migration, or deploying. An AI review or passing checks
  do not constitute that approval.


# AGENTS.md

## Technology Constraints

- Primary language: TypeScript
- Frontend: React Native
- Framework: Expo
- Backend: Supabase
- Database: PostgreSQL via Supabase
- Authentication: Supabase Auth

### Hard constraints

- Do not introduce another programming language without explicit approval.
- Do not replace React Native, Expo, Supabase, or PostgreSQL without explicit approval.
- Do not perform framework migrations or architectural rewrites unless specifically instructed.
- Prefer existing project dependencies and patterns over introducing new libraries.

## Documentation Maintenance

When work changes the project, update the repository documentation in the same change when appropriate.

Update:

- `docs/PRODUCT.md` when product behavior, scope, users, or requirements change.
- `docs/ARCHITECTURE.md` when system structure, data models, APIs, major dependencies, or infrastructure change.
- `docs/DECISIONS.md` when a meaningful product or technical decision is made.
- `docs/ROADMAP.md` when work is completed, started, deferred, or reprioritized.
- `docs/DEVELOPMENT.md` when setup, testing, deployment, tooling, or development conventions change.

Do not leave important project knowledge solely in the AI conversation.

## Decision Logging

For significant decisions, add an entry to `docs/DECISIONS.md` containing:

- Date
- Decision
- Context
- Alternatives considered
- Reasoning
- Consequences / follow-up work

Minor implementation details do not require decision entries.

## Completion Standard

Before declaring a task complete:

1. Confirm the project builds or runs when applicable.
2. Run relevant tests.
3. Check for obvious regressions.
4. Update affected documentation.
5. Summarize what changed, what was tested, and any remaining risks or follow-up work.
