# AI Operations Standard

This document defines a reusable, tool-neutral workflow for a one-person
software holding company. Each project keeps its own product requirements,
technical constraints, and source of truth. The human owner remains accountable
for scope, risk, and consequential actions.

## Task brief

Use the same three headings in a ticket, document, or message. Existing tracker
fields can hold the information; no tracker migration is required.

```text
Goal
- Outcome, deliverable, and explicit acceptance criteria.
- Decision owner and any deadline or budget limit.

Context
- Approved requirements, source links, constraints, dependencies, and facts to preserve.
- Agent role and allowed reads, edits, tools, external actions, and spending.
- Actions that require the owner's approval or must stop for clarification.

Validation
- Evidence for each acceptance criterion and who will check it.
- Checks, review method, and any required human approval.
- Where results, decisions, and unresolved risks will be recorded.
```

Criteria should describe observable outcomes. A missing requirement, authority,
or measurable completion condition must be resolved before changing behavior or
taking a consequential action.

## Roles and authority

| Role | Responsibility | Authority |
| --- | --- | --- |
| Human owner | Sets goals, approves scope and consequential actions, accepts residual risk. | Final approval; may delegate a bounded decision explicitly. |
| Planner | Turns approved intent into a brief and identifies dependencies. | Research and draft recommendations; cannot approve its own proposal. |
| Executor | Produces the scoped artifact and records evidence. | Works within the brief's stated permissions. |
| Independent verifier | Checks the artifact and evidence against the brief from a fresh context. | Reports findings; does not approve release, spending, or publication. |
| Specialist agent | Handles a named domain task under the same brief and permissions. | No standing authority beyond its assigned scope. |

The default for an unstated permission is read, analyze, and draft within the
task's available workspace. Routine reversible edits and tests may proceed when
the task authorizes implementation. External messages, publication, purchases,
financial transfers or filings, production changes, and permission changes need
explicit owner authorization for the specific action. A credential or connected
tool does not grant decision authority. Never expose secrets in a task brief or
handoff.

For software, a merge, production migration, and deployment each require explicit
human approval, as KC3 already specifies. For content, require approval before
publishing or sending externally. For marketing, require approval before campaign
launch or spend. For finance, require approval before a filing, payment, transfer,
or binding commitment. Agents may prepare reviewable drafts and evidence first.

## Verification and review

The executor records a result for every criterion: check or observation, outcome,
and a location for evidence. Mark unrun checks and unresolved criteria explicitly.
For material work, a verifier who did not build the artifact reviews it in a
separate session or fresh context. Use the same provider if that is sufficient;
provider diversity is optional. The verifier checks requirements, correctness,
source support, security/privacy, and whether the result can be simpler. The
executor resolves findings or records a reason for deferral. The human owner
checks the final evidence and makes any required approval decision.

Use a lighter review for low-risk, reversible tasks. Increase scrutiny when work
can affect customers, production data, money, legal obligations, or public claims.
An AI review and automated checks are evidence, not approval.

Domain-specific validation stays in the task brief:

| Work | Minimum evidence to consider |
| --- | --- |
| Software | Relevant tests, CI/build results, security and data-boundary review, and release observation when deployed. |
| Content | Source and rights checks, factual review, final rendered artifact, and publication approval. |
| Marketing | Claim support, audience and channel fit, budget/measurement plan, and launch or spend approval. |
| Finance | Source documents, reconciled calculations and assumptions, independent check of material figures, and approval before filing or moving funds. |
| Specialist agents | Evidence for the assigned domain plus a check that the agent stayed within its brief and permissions. |

## Handoff record

End each task with a concise record containing:

1. Outcome and changed artifacts or links.
2. Acceptance criteria with verification results and evidence locations.
3. Independent review findings and their disposition, when required.
4. Decisions and approvals, including approver, exact action, and date.
5. Remaining risks, blocked items, and next owner or trigger.

Store settled project knowledge in that project's source of truth. Link to
existing tickets and decisions; do not depend on chat history. The brief and
handoff use ordinary text so they can move between AI providers and tools.

## Adoption

Pilot this standard on a few real tasks before adding automation. Reuse existing
repositories, trackers, CI, and platform logs. Add a subscription or orchestration
service only when a measured gap justifies its cost and maintenance.

| Order | Adoption step | Launch impact | Complexity / added cost |
| --- | --- | --- | --- |
| Now | Use the brief, permissions, evidence, review, and handoff on several real tasks. | High | Low / none |
| Before consequential merges | Verify required CI checks and record a fresh-context review and human merge decision. | High | Low / none |
| Before production | Rehearse the software release packet, restore, rollback, and basic error observation alongside project-specific launch gates. | Critical | Medium / existing platform costs |
| After launch | Triage reports and logs on a regular cadence; measure whether a monitoring service is needed. | Medium | Low initially / optional later cost |
| When throughput warrants | Trial isolated parallel agents on independent tasks with one integration owner. | Low for current launch | Medium / agent usage cost |
