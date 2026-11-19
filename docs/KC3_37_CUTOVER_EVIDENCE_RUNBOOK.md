# KC3-37 cutover evidence and recovery runbook

Prepared 2026-11-18 (America/Chicago). **Plan and disposable rehearsal only.**
This document does not authorize a curated or production migration, publication,
history change, backup copy, deletion, or deployment. It extends the
[remediation plan](KC3_37_REMEDIATION_PLAN.md),
[correction-history review](KC3_37_CORRECTION_HISTORY_REVIEW.md), and
[detached-volume proposal](KC3_37_DETACHED_VOLUME_AUDIT_PROPOSAL.md).
The KC3-34 accessibility hold remains in force.

## Actual local target and secondary-copy checkpoint

Read-only inspection on 2026-11-18/19 UTC identified the running local
container **`supabase_db_KC3`**, database **`postgres`**, on port **54322**.
`supabase/audits/kc3_37_content_inventory.sql` ran in a repeatable-read,
read-only transaction ending in rollback: 15 active places, 15 detail shells,
zero Google IDs/provider rows/Google hours, zero coordinate/time-zone/move
values, zero KC3 hours or overrides, and zero correction rows. The separate
read-only `kc3_37_publication_gate.sql` returned zero reviewed publications,
zero published Google counts, `client_gate_available=true`, all three old
Google RPC execute flags false, and the three reject triggers enabled. Thus the
**current** local target has no published content. The historical 88-place,
73-Google-row, 399-hour, three-correction state described in the remediation
plan is not present in this target; counts cannot prove where it went.

The detached Docker volumes `supabase_db_KC3ThirdSpaceValidation` (created
2026-10-29T11:20:07Z) and `supabase_db_KC3_37_Synthetic_Rehearsal`
(created 2026-10-29T03:41:20Z) still have their expected Supabase project
labels. `docker ps -a` showed no container mounting either. Their contents,
recovery state, and rights basis were **not** inspected. A separate
copy-disposition draft in the shared checkout is still unmerged; this runbook
does not assume its proposals are approved.
Hosted KC3 project IDs, backups, object stores, logs, recordings, and device
caches remain unidentified; the available connected Supabase account exposed
only an unrelated project, so no hosted KC3 query was made. No statement of
complete retirement follows from the local zero counts.

## Attended preflight: stop on any missing answer

1. Name **every exact target** (project ref, database, container/volume, region,
   deployed schema/client version, backup location, owner) and freeze old
   import, restore, and correction jobs. Identify the governing provider
   agreement and approved restricted handling/retention basis for any protected
   snapshot or copy. Do not run the detached-volume recovery proposal without
   its separate explicit rights/retention approval.
2. Review the three historical corrections **per field** with exact before,
   after, source URL, snapshot, notes, date, and KC3 ownership. Approve a
   specific immutable audit/redaction representation before implementing it.
   A correction-bearing target is refused by the current publisher; do not
   remove that refusal as a shortcut.
3. Complete each selected workbook row's attended identity, municipality,
   point/entrance, duplicate, lifecycle, category, current operation, rights,
   and hours review. Compare each explicit KC3 target UUID and `updated_at` to
   the live target. Decide unmatched legacy IDs and any coverage change. The
   15 seed rows, the 17 accepted franchise source-ID choices, and the
   [Pending duplicate packet](KC3_37_PENDING_DUPLICATE_EVIDENCE_2026-11-18.md)
   are review inputs, not Ready approvals.
4. In an approved restricted location, capture a consistent before snapshot
   of **exact** existing UUIDs, canonical values and provenance, details
   (including explicit null/false), KC3 hours, overrides, hidden/move decisions,
   publication ledger, and correction evidence. Record schema/version,
   snapshot time, access controls, checksums, and retention deadline. Compare
   to a separately approved backup; counts and the public RPC audit cannot
   replace this exact comparison. Never put protected values in GitHub, a
   workbook, logs, or a general worktree.

## Disposable go/no-go rehearsal

Use a separate Supabase project with unique ID/ports and **only synthetic**
rows. Apply the exact migration and client build intended for cutover. Exercise
reviewed new and matched publication, unchanged/unknown hours, preexisting KC3
details/hours/overrides, hidden/move refusal, correction-bearing refusal,
stale `updated_at`, duplicate targets, partial multi-row failure, and replay.
Record before/after protected snapshots and require
`verifyProtectedReconciliation(before, after) === []` for all existing IDs.
Test the approved correction-history disposition separately; the current
rehearsal does not encode or approve one. Run pgTAP, DB lint, integration,
Jest, static checks, export, and Web/native smoke appropriate to the actual
build. Stop if any required gate fails.

This session created **`KC3_37_Cutover_Evidence_1119`**, port **64322**
(API 64321), from `origin/main` with a fresh schema. It first used seeding
disabled for one synthetic UI fixture: a reviewed `Fixture cafe` was staged
and published **only there**. The read-only gate before the fixture showed
zero publications, the gate present, old RPCs unavailable, and reject triggers
enabled. Focused pgTAP `015` passed 16/16, `016_overture_reconciliation` 5/5,
and `019_post_cutover_operators` 38/38; each test transaction rolled back.
The first full suite run failed because seed was disabled and the committed UI
fixture collided with fixed IDs. The disposable project was then explicitly
reset with its normal seed enabled. The clean rerun passed **13 pgTAP files,
280 tests**; DB lint returned **no schema errors**. Anonymous integration
passed **20/20** tests, and the published synthetic HTTP fixture passed
**3/3**, cleaning up its synthetic records. Application Jest passed **20 suites,
163 tests**; typecheck, ESLint, formatting, and Web/iOS/Android Expo export all
passed. The disposable UI fixture was removed by the reset. No curated
database was reset or seeded.

The Expo Web server for the synthetic fixture returned HTTP 200, but its UI
could not be inspected: the computer-use browser inventory was empty and the
running Firefox surface returned `cgWindowNotFound`. No iOS simulator was
booted and `adb devices` showed no Android device. Thus **visual attribution,
Maps handoff, unavailable-hours presentation, Web keyboard behavior, and native
accessibility remain unrun attended checks**. The app and HTTP fixture tests
cover their component/API logic, not a visual or OS handoff. KC3-34's hold
remains intact.

## Cutover sequence after separate human approval

1. Recheck exact target identity and protected before snapshot in the attended
   window. Require the approved rights basis, row approvals, recovery owner,
   and rollback window. Freeze writer jobs and clients that could use old RPCs.
2. Apply the versioned migration to the exact target. Verify the public gate
   and reject triggers **before** reconnecting clients. Stage only reviewed
   batches; match existing IDs only through accepted explicit links. Run the
   dry-run reconciliation and inspect each `approvals.json` entry. Publisher
   operations are per-place transactions, so record the last committed ledger
   entry after every batch; a later failure does not undo earlier places.
3. Publish individually approved rows. Preserve stable UUIDs and KC3-owned
   values. For every affected and unaffected existing ID, compare exact
   protected values and `updated_at` to the approved before snapshot. Verify
   published Google IDs/provider rows/Google-hour places are all zero, old RPC
   execute flags false, reject triggers enabled, and no anonymous direct-table
   access. Inspect remaining **private** legacy counts separately; zero public
   Google values is not full historical cleanup.
4. Verify attribution, navigation destination/label, unavailable or unknown
   hours, duplicate identity selection, and error recovery on Web and native
   builds connected to the exact target. Keep KC3-34 attended accessibility
   checks and KC3-39 release gates open. Retire unsupported private history and
   secondary copies only through their separately approved disposition plan;
   repeat inventory afterward.

## Failure and recovery order

- **Before a transaction commits:** rollback, verify the ledger and exact
  protected snapshot, and leave the client gate closed. Do not continue on a
  changed target version.
- **After some places commit:** stop the publisher; list committed ledger IDs
  and compare each to approved rows and exact before/after snapshots. Preserve
  stable UUIDs, details, and KC3 hours. An incorrect reviewed publication is
  hidden through an audited, approved change and later corrected/republished;
  do not re-enable old Google-backed RPCs. Uncommitted rows remain private.
- **After a full pre-gate restore:** isolate the restored target from clients
  and writers. A restore can resurrect old grants, policies, triggers, and
  provider copies. Reapply the compatible migration and run the read-only gate,
  private-copy inventory, and exact protected comparison **before** reconnecting
  clients. If rights do not permit restoration of protected provider content,
  use an approved forward recovery instead of a general old dump.
- **If a secondary-copy purge fails:** leave the copy isolated, record its
  exact identifier, access owner, and retention deadline, and keep the release
  gate open. Never treat deletion of a database row as deletion from backups.

Only the owner/operator can approve rights, historical redaction, real workbook
Ready choices, exact target access, migration/publication/deletion, and release.
Phone suffices to review the decision packet; restricted target execution and
post-cutover verification require an attended laptop session. Agents can keep
improving synthetic tests, row evidence, and this runbook while those decisions
are pending.
