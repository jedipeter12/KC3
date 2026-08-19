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
