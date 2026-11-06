# Software Development Standard

This is KC3's software adapter to the [AI Operations Standard](AI_OPERATIONS_STANDARD.md).
It uses the existing repository, GitHub Actions, Expo, Supabase, and project
documentation. It does not select hosting, enable production access, or clear a
release gate.

## Change path

1. Start from an approved Goal / Context / Validation brief. Link the relevant
   product requirement, decision, roadmap item, and acceptance criteria.
2. Use a focused branch for non-trivial work. Use an isolated worktree when the
   current checkout contains unrelated changes or parallel work is authorized.
   Keep each worktree on one branch and assign one integration owner.
3. Make the smallest change consistent with the existing architecture. Add or
   update behavior tests and database authorization tests when applicable.
4. Run relevant local checks. For code changes, use typecheck, lint, formatting,
   application tests, database tests/integration tests when affected, and Expo
   export when a client or build path changes. Record exact commands and results.
5. Open a PR with criterion-level evidence, changed behavior, the final diff,
   review findings, skipped checks, and remaining risks. Require fresh passing
   `Application checks` and `Database checks` for changes that enter `main`.
6. Have a reviewer who did not implement the change inspect the final diff in a
   fresh context. The reviewer checks code quality, test sufficiency, security
   and data boundaries, and simplification. Resolve or explicitly defer findings.
7. The human owner approves the exact PR before merge. Passing CI and AI review
   do not constitute merge approval. Update affected project documentation and
   roadmap status in the same change.

GitHub branch rules should require the two existing CI job names when the owner
chooses to enforce merges through repository settings. Verify the configured
rule and a blocked failing-check attempt before calling it enforced. The CI file
alone does not prove a merge gate. No additional review service is required.

## Review prompts

**Code quality:** Does the diff meet each criterion? Are failure paths,
authorization, privacy, secrets, and relevant regressions covered? Are evidence
and comments consistent with the code?

**Simplification:** Can code, dependencies, abstractions, configuration, or
unrelated edits be removed while preserving the requested behavior? Does the
change follow existing patterns?

The independent reviewer records findings with file/line references and severity,
or states that none were found. The executor records each resolution and reruns
affected checks. A review of only a summary is insufficient for material code.

## Parallel work

Parallel agents are optional. Use them only for separable tasks with explicit
file or ownership boundaries. Each agent receives a brief, permissions, and its
own branch/worktree. Avoid concurrent edits to one migration chain, shared
contracts, or release files. The integration owner reconciles dependencies,
reruns the combined checks, and produces one reviewable PR. Do not add an
orchestrator merely to run this workflow.

## Release decision record

Prepare a release packet before a production migration or deployment:

- Version/commit, target environment, scope, owner, and approved window.
- Acceptance evidence and fresh CI results; device or accessibility evidence
  when the release depends on native behavior.
- Migration order, data protection and restore evidence, rollback steps, and
  the point after which rollback requires a forward fix.
- Targeted smoke checks, sanitized logs or health signals to watch, and a person
  responsible for observing them after release.
- Open risks and the owner's explicit approval for each production migration
  and deployment. Record actual outcome and follow-up after execution.

KC3 cannot currently execute a production release under this record. KC3-37
source rights and publication, KC3-34 spoken accessibility verification, and
production environment, backup/restore, operational access, and monitoring
decisions remain open. Follow their project documents before attempting a
release. An Expo export is build verification, not a signed build or deployment.

## Error and bug loop

Use existing user reports and available platform logs first. Record the affected
version/environment, time, observed symptom, impact, and a sanitized diagnostic
reference; do not copy credentials, personal data, or raw provider payloads into
tickets. The owner triages severity and pauses a release or publication if data
integrity, security, rights, or core access may be affected.

For each actionable bug: reproduce or state why reproduction is unavailable;
define the expected behavior; add a focused regression test when practical; fix
on a focused branch; run relevant checks and independent review; obtain human
approval for merge/release; then verify the production signal or user scenario.
Close with the cause, evidence, and any prevention follow-up. Review the queue at
a regular cadence after launch. Add paid error monitoring only if existing logs
and reports fail to identify actionable failures in time.
