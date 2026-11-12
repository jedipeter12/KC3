# KC3-37 detached-volume aggregate audit proposal

**Prepared:** 2026-11-10 (America/Chicago). **Status:** awaiting owner decision.
This document is a proposed procedure, not authorization. No volume was copied,
recovered, queried for rows, or deleted to prepare it.

## Decision requested

Authorize a one-time, local **aggregate-only** inventory of these two detached
Docker volumes, one at a time:

| Original volume | Supabase CLI project label | Current evidence |
| --- | --- | --- |
| `supabase_db_KC3ThirdSpaceValidation` | `KC3ThirdSpaceValidation` | Detached PostgreSQL 17 cluster; control-file state `in production` |
| `supabase_db_KC3_37_Synthetic_Rehearsal` | `KC3_37_Synthetic_Rehearsal` | Detached PostgreSQL 17 cluster; control-file state `in production` |

Names and labels were rechecked read-only on 2026-11-10. The prior
[remediation inventory](KC3_37_REMEDIATION_PLAN.md) records the control-file
evidence. The names do **not** prove that either volume contains only synthetic
data. Assume a copy could contain real Google-derived facts and correction
history. The original volumes remain untouched and detached.

This authorization would permit creating a temporary physical copy of each
volume and allowing PostgreSQL crash recovery **on the copy only**. That is a
copy of potentially provider-derived content even though the report contains
only counts. The owner must confirm that the applicable account agreement or
other reviewed basis permits this bounded internal remediation copy. If that
basis is unknown, defer the audit. Operational approval does not itself settle
provider rights.

## Proposed execution boundary

1. **Preflight, read-only.** Recheck both exact source names and project labels,
   PostgreSQL major version, volume sizes, and that no container references
   either original volume. Record the locally available PostgreSQL/Supabase
   image digest used for recovery. Confirm adequate local space and the approved
   24-hour retention window. If a source has changed, is attached, or a
   compatible image is unavailable, stop before copying. Do not pull an image
   or attach an original volume to a database or API service as a workaround.
2. **Copy one original at a time.** Create a uniquely named Docker working
   volume outside the repository. Use a temporary container with network
   disabled, the original mounted **read-only**, and the working volume mounted
   writable. Copy the complete PostgreSQL data directory while preserving
   permissions and ownership. Do not write a dump, CSV, SQL export, or copy into
   a worktree. Verify the copy command exited successfully; on failure, leave
   the original alone, isolate the incomplete working copy, and report failure.
3. **Recover only the working copy.** Start a PostgreSQL 17 container pinned to
   the checked compatible local image, with the working volume as its data
   directory, `--network none`, no published ports, and no Kong, REST, Studio,
   or Supabase API. PostgreSQL may replay WAL and change the working copy. It
   must never mount the original. If recovery fails or needs missing WAL or a
   different image, stop and report; do not edit the original, reset a cluster,
   or run migrations.
4. **Run aggregate SQL through `docker exec` only.** Confirm the database name
   and that the expected KC3 tables exist. Run
   [`supabase/audits/kc3_37_content_inventory.sql`](../supabase/audits/kc3_37_content_inventory.sql)
   with `psql -X -v ON_ERROR_STOP=1` against each KC3 application database found
   in that copy. The script uses a repeatable-read, read-only transaction ending
   in rollback. Capture only its aggregate counts and provider-column
   population counts. If schemas differ, stop and propose a reviewed read-only
   query adjustment; do not migrate the copy merely to make the audit pass.
5. **Report and dispose.** Record the source volume name and label, image
   digest, copy/recovery success or failure, database/schema presence, counts
   for places, Google IDs/provider rows/hours, KC3 details/hours/overrides, and
   correction history, plus any unknowns. Do not print row IDs, names,
   addresses, provider values, source URLs, exact correction snapshots,
   credentials, or raw SQL result rows. Stop the recovery container and remove
   **only the newly created working volume** within 24 hours. Verify removal.
   If removal fails, keep it isolated and report the remaining copy and owner
   action needed. Keep both original volumes unchanged for later disposition.

The operator will make a short execution record with command timestamps,
exact original and working volume identifiers, aggregate results, cleanup
confirmation, and deviations. The report belongs in `docs/` only if it contains
no provider values or secrets. Container logs, physical WAL, host backups, and
Docker's own storage history are outside this count audit; removal of a working
volume is not a claim of secure erasure. Host backup behavior for new Docker
volumes is unverified and must be accepted or constrained before execution.

## Stop conditions and limits

- Stop if the owner cannot confirm authority to make a bounded internal copy,
  the 24-hour retention arrangement, or who may access the local Docker host.
- Stop if either source is no longer detached, its label differs, the original
  cannot be mounted read-only, recovery requires changes to the original, or
  the copy would expose a PostgreSQL port or API.
- Stop on missing WAL, incompatible PostgreSQL/extension image, unexpected
  databases or schema, or an audit error. Report the failure without trying a
  reset, migration, publication, or destructive repair.
- This approval covers neither row-level correction review nor provider-value
  export. If correction rows are found, their exact-field review needs a
  separate scoped decision under
  [KC3-37 correction history review](KC3_37_CORRECTION_HISTORY_REVIEW.md).
- It covers no hosted target, curated `KC3` database, original-volume deletion,
  private-copy purge, publication, deployment, or KC3-37 release clearance.

## How to approve, change, or deny

Reply in the chat with one of these decisions. Do not put credentials in the
reply or this file.

**Approve:** “I authorize the one-time aggregate audit in
`docs/KC3_37_DETACHED_VOLUME_AUDIT_PROPOSAL.md` for the two named detached
volumes. I confirm I have authority for a temporary internal copy under the
applicable data-use terms. Only the agent and the local Docker host owner may
access the working copies. I accept local Docker working volumes retained for
no more than 24 hours, including the documented uncertainty about host backups.
The agent may recover and query copies as described, then remove only those new
copies. I do not authorize row-level export, changes to originals or the curated
database, hosted access, publication, or cleanup of existing copies.”

**Change:** State the specific boundary to change, such as access, retention,
storage location, or which volume is covered. The agent should revise this
proposal before executing the changed procedure.

**Deny or defer:** “Do not copy or recover either detached volume. Keep their
contents unknown and the originals isolated.” No audit or disposal follows.

An approval should be given only by the person authorized to govern these
volumes and the potentially copied provider content. If that authority or the
applicable terms are uncertain, choose **defer** until they are resolved.
