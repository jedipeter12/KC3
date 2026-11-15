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
- Treat local Supabase targets as potentially curated. Before any reset, seed,
  fixture, migration, or write, identify the exact target and use a confirmed
  disposable project. Never reset the curated KC3 database. Production migrations,
  publication, deployment, and PR merges require explicit human approval;
  passing checks or an AI review do not grant it.
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
